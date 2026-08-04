import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createProjectFromLegacyEditorState, restoreLegacyEditorStateFromProjectModel } from '../src/components/video-editor/project/legacyAdapter'
import { getProjectRenderSettings } from '../src/components/video-editor/project/renderSettings'
import { defaultSubtitleStyle, transcriptToSubtitles } from '../src/components/video-editor/mediaFeatures'

const helperApp = path.resolve('public/transcriber/ToScreenTranscriber.app')
const helperExecutable = path.join(helperApp, 'Contents', 'MacOS', 'ToScreenTranscriber')

function finish(status: 'completed' | 'not_completed' | 'failed', detail: Record<string, unknown>, code: number): never {
  console.log(JSON.stringify({ status, check: 'macos_transcription_e2e', ...detail }, null, 2))
  process.exit(code)
}
function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { encoding: 'utf8' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(result.stderr.trim() || result.stdout.trim() || `${command} exited ${result.status}`)
  return result
}
function classify(message: string) {
  if (/Siri and Dictation are disabled/i.test(message)) return 'siri_and_dictation_disabled'
  if (/permission was not granted|denied|restricted/i.test(message)) return 'speech_recognition_permission_unavailable'
  if (/on-device speech recognition is unavailable|recognition is unavailable/i.test(message)) return 'on_device_recognition_unavailable'
  return 'transcription_failed'
}

if (process.platform !== 'darwin') finish('not_completed', { reason: 'macos_required' }, 2)
if (!fs.existsSync(helperExecutable)) finish('failed', { reason: 'bundle_helper_missing', helperApp }, 1)

const evidenceDirectory = await fsp.mkdtemp(path.join(os.tmpdir(), 'toscreen-transcription-acceptance-'))
const authorizationPath = path.join(evidenceDirectory, 'authorization.json')
try {
  run('/usr/bin/open', ['-n', '-W', helperApp, '--args', '--authorization-status', authorizationPath])
} catch (error) {
  finish('failed', { reason: 'bundle_preflight_launch_failed', error: String(error), evidenceDirectory }, 1)
}
const authorization = JSON.parse(await fsp.readFile(authorizationPath, 'utf8'))
if (authorization.status !== 'authorized') {
  finish('not_completed', {
    reason: `speech_recognition_${authorization.status}`,
    authorization,
    action: 'Grant Speech Recognition permission to ToScreenTranscriber, then rerun. This acceptance does not request permission or open System Settings.',
    evidenceDirectory,
  }, 2)
}

const audioPath = path.join(evidenceDirectory, 'synthetic-speech.aiff')
run('/usr/bin/say', ['-v', 'Samantha', '-r', '155', '-o', audioPath, 'ToScreen transcription acceptance verifies editable subtitles and project recovery.'])
const resultPath = path.join(evidenceDirectory, 'result.jsonl')
const cancellationPath = path.join(evidenceDirectory, 'cancel')
await fsp.writeFile(resultPath, '')

let launchError: string | null = null
try {
  run('/usr/bin/open', ['-n', '-W', helperApp, '--args', audioPath, 'en-US', resultPath, cancellationPath])
} catch (error) { launchError = String(error) }

const events = (await fsp.readFile(resultPath, 'utf8')).split('\n').filter(Boolean).flatMap(line => {
  try { return [JSON.parse(line)] } catch { return [] }
})
const errorEvent = events.find(event => event.type === 'error')
if (errorEvent || launchError) {
  const message = String(errorEvent?.message || launchError)
  finish('not_completed', { reason: classify(message), error: message, eventTypes: events.map(event => event.type), evidenceDirectory }, 2)
}
const resultEvent = events.find(event => event.type === 'result')
const segments = Array.isArray(resultEvent?.segments)
  ? resultEvent.segments.filter((segment: any) => Number.isFinite(segment.startMs) && Number.isFinite(segment.endMs) && segment.endMs > segment.startMs && String(segment.text || '').trim())
  : []
if (segments.length === 0) finish('failed', { reason: 'empty_transcription_segments', eventTypes: events.map(event => event.type), evidenceDirectory }, 1)

const subtitles = transcriptToSubtitles(segments, [])
const edited = subtitles.map((subtitle, index) => index === 0 ? { ...subtitle, text: `${subtitle.text} edited`, userEdited: true, style: { ...subtitle.style, animation: 'fade' as const } } : subtitle)
const baseInput = {
  videoPath: path.join(evidenceDirectory, 'preview.mp4'), originalVideoPath: path.join(evidenceDirectory, 'source.mov'), durationSeconds: 10, projectDurationSeconds: 10,
  zoomRegions: [], trimRegions: [], annotationRegions: [], audioRegions: [], subtitleRegions: edited, cursorData: [], cursorSize: 1, cursorSmoothing: true,
  showVectorCursor: true, cursorOffset: 0, cropRegion: { x: 0, y: 0, width: 1, height: 1 }, wallpaper: '', shadowIntensity: 0,
  showBlur: false, motionBlurEnabled: false, borderRadius: 0, padding: 0, aspectRatio: '16:9' as const, exportQuality: 'good' as const,
}
const project = createProjectFromLegacyEditorState(baseInput)
const projectPath = path.join(evidenceDirectory, 'caption-project.json')
await fsp.writeFile(projectPath, JSON.stringify(project, null, 2))
const reopened = JSON.parse(await fsp.readFile(projectPath, 'utf8'))
const restored = restoreLegacyEditorStateFromProjectModel(reopened)
const rendered = getProjectRenderSettings(reopened).timeline.annotationRegions
const firstEdited = restored.subtitleRegions?.[0]
if (restored.subtitleRegions?.length !== edited.length || !firstEdited?.userEdited || !firstEdited.text.endsWith(' edited') || rendered.filter(item => edited.some(subtitle => subtitle.id === item.id)).length !== edited.length) {
  finish('failed', { reason: 'subtitle_project_or_render_contract_failed', evidenceDirectory }, 1)
}

finish('completed', {
  helperLaunch: { appBundle: helperApp, mechanism: '/usr/bin/open -n -W <app> --args' },
  authorization,
  syntheticAudio: audioPath,
  transcription: { segmentCount: segments.length, nonEmpty: true, text: segments.map((segment: any) => segment.text).join(' ') },
  subtitleContract: { edited: true, projectSavedAndReopened: true, previewExportSharedRenderData: true, defaultStyle: defaultSubtitleStyle },
  evidenceDirectory,
  note: 'All evidence is isolated and retained. No user media, TCC database, System Settings, or existing project was modified.',
}, 0)
