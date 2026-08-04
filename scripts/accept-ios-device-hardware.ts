import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'

type Device = {
  id: string
  name: string
  connected: boolean
  suspended: boolean
  inUse: boolean
  audioSupport: string
}

const helper = path.resolve('public/ios-device-capture/ToScreenIOSCapture.app/Contents/MacOS/ToScreenIOSCapture')
const minimumRecordingMs = 6_000

function result(status: 'completed' | 'not_completed' | 'failed', details: Record<string, unknown>, exitCode: number): never {
  console.log(JSON.stringify({ status, check: 'ios_device_hardware_acceptance', ...details }, null, 2))
  process.exit(exitCode)
}

function run(command: string, args: string[]) {
  const execution = spawnSync(command, args, { encoding: 'utf8' })
  if (execution.error) throw execution.error
  if (execution.status !== 0) throw new Error(execution.stderr.trim() || execution.stdout.trim() || `${command} exited ${execution.status}`)
  return execution.stdout.trim()
}

function findFfprobe(): string | null {
  const configured = process.env.FFPROBE_PATH
  if (configured && fs.existsSync(configured)) return configured
  const lookup = spawnSync('which', ['ffprobe'], { encoding: 'utf8' })
  return lookup.status === 0 && lookup.stdout.trim() ? lookup.stdout.trim() : null
}

if (!fs.existsSync(helper)) result('failed', { reason: 'helper_missing', helper }, 1)

let devices: Device[]
try {
  devices = JSON.parse(run(helper, ['discover']))
} catch (error) {
  result('failed', { reason: 'discovery_failed', error: String(error) }, 1)
}

const eligible = devices.filter(device =>
  typeof device.id === 'string' && device.id.length > 0 &&
  typeof device.name === 'string' &&
  device.connected === true && device.suspended === false && device.inUse === false &&
  /muxed-device-stream/i.test(device.audioSupport || '')
)

if (eligible.length === 0) {
  result('not_completed', {
    reason: 'no_eligible_wired_iphone_or_ipad_screen',
    discoveredDevices: devices.map(({ id, name, connected, suspended, inUse }) => ({ id, name, connected, suspended, inUse })),
    action: 'Connect one unlocked iPhone or iPad by USB, approve Trust, close apps using its screen source, then rerun npm run accept:ios-device.',
  }, 2)
}

const requestedId = process.env.TOSCREEN_IOS_DEVICE_ID
const device = requestedId ? eligible.find(item => item.id === requestedId) : eligible[0]
if (!device) result('not_completed', { reason: 'requested_device_not_eligible', requestedId, eligibleDeviceIds: eligible.map(item => item.id) }, 2)

const ffprobe = findFfprobe()
if (!ffprobe) result('not_completed', { reason: 'ffprobe_missing', action: 'Install ffprobe or set FFPROBE_PATH, then rerun the acceptance.' }, 2)

const evidenceDirectory = await fsp.mkdtemp(path.join(os.tmpdir(), 'toscreen-ios-acceptance-'))
const outputPath = path.join(evidenceDirectory, 'wired-ios-screen.mov')
const child = spawn(helper, ['record', device.id, outputPath], { stdio: ['ignore', 'pipe', 'pipe'] })
let stdout = ''
let stderr = ''
let started = false

child.stdout.on('data', chunk => {
  stdout += chunk.toString()
  for (const line of stdout.split('\n')) {
    try {
      if (JSON.parse(line).type === 'started') started = true
    } catch { /* wait for a complete JSON line */ }
  }
})
child.stderr.on('data', chunk => { stderr += chunk.toString() })

const startDeadline = Date.now() + 8_000
while (!started && child.exitCode === null && Date.now() < startDeadline) await new Promise(resolve => setTimeout(resolve, 100))
if (!started) {
  child.kill('SIGKILL')
  result('failed', { reason: 'recording_did_not_start', device: { id: device.id, name: device.name }, stderr: stderr.trim(), evidenceDirectory }, 1)
}

await new Promise(resolve => setTimeout(resolve, minimumRecordingMs))
child.kill('SIGTERM')
const exitCode = await new Promise<number | null>(resolve => child.once('exit', resolve))
if (exitCode !== 0 || !fs.existsSync(outputPath)) {
  result('failed', { reason: 'normal_stop_failed', exitCode, stderr: stderr.trim(), evidenceDirectory }, 1)
}

const probe = JSON.parse(run(ffprobe, ['-v', 'error', '-show_entries', 'format=format_name,duration,size:stream=index,codec_type,codec_name,duration', '-of', 'json', outputPath]))
const durationSeconds = Number(probe.format?.duration)
const sizeBytes = Number(probe.format?.size)
const videoStreams = Array.isArray(probe.streams) ? probe.streams.filter((stream: any) => stream.codec_type === 'video') : []
const isMov = /mov|mp4|m4a|3gp|3g2|mj2/.test(String(probe.format?.format_name || ''))

if (!isMov || !Number.isFinite(durationSeconds) || durationSeconds < 5 || !Number.isFinite(sizeBytes) || sizeBytes <= 0 || videoStreams.length === 0) {
  result('failed', { reason: 'invalid_recorded_media', outputPath, probe }, 1)
}

const hookSource = await fsp.readFile('src/hooks/useScreenRecorder.ts', 'utf8')
const editorHandoffWired = hookSource.includes('stopIOSDeviceRecording') && hookSource.includes('finishRecording(result.outputPath')
if (!editorHandoffWired) result('failed', { reason: 'editor_handoff_contract_missing', outputPath }, 1)

result('completed', {
  device: { id: device.id, name: device.name },
  selectedFromEligibleCount: eligible.length,
  normalStop: true,
  media: { outputPath, durationSeconds, sizeBytes, videoTrackCount: videoStreams.length, codecs: videoStreams.map((stream: any) => stream.codec_name) },
  editorHandoff: { eligible: true, evidence: 'useScreenRecorder stops the device helper and passes its outputPath to finishRecording.' },
  evidenceDirectory,
  note: 'Evidence is intentionally retained; no existing user recording was read, moved, or deleted.',
}, 0)
