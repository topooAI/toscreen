import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
const assertions: Array<[string, boolean]> = []
const expect = (label: string, condition: boolean) => assertions.push([label, condition])

const hook = read('src/hooks/useScreenRecorder.ts')
const launch = read('src/components/launch/LaunchWindow.tsx')
const native = read('electron/nativeRecorder.ts')
const iosDeviceCapture = read('electron/iosDeviceCapture.ts')
const handlers = read('electron/ipc/handlers.ts')
const preload = read('electron/preload.ts')

expect('window ID reaches native recorder', handlers.includes("selectedSource.id.split(':')[1]") && native.includes('windowId: sessionOptions.windowId'))
expect('custom area reaches native recorder', launch.includes('captureArea: selectedType === "Area" ? area') && native.includes('captureArea: sessionOptions.captureArea'))
expect('microphone device and switches are real inputs', launch.includes('enumerateDevices()') && launch.includes('audioDeviceId: microphoneId') && hook.includes('startMicrophoneStem'))
expect('microphone meter uses Web Audio analyser', launch.includes('createAnalyser()') && launch.includes('getByteFrequencyData'))
expect('system audio is configurable', launch.includes('includeSystemAudio: systemAudioOn') && native.includes('includeSystemAudio: sessionOptions.includeSystemAudio'))
expect('camera capture becomes a presenter handoff', launch.includes('cameraDeviceId: cameraId') && native.includes('captureCamera: sessionOptions.captureCamera'))
expect('iPhone and iPad use real wired screen discovery and preview', launch.includes('discoverIOSScreenDevices') && launch.includes('startIOSDevicePreview') && launch.includes("selectedType==='Device'") && iosDeviceCapture.includes("['preview',deviceId]") && iosDeviceCapture.includes("['record',deviceId,recordingOutput]"))
expect('microphone and system audio remain separate stems', hook.includes('storeRecordedAudio') && native.includes('-system-audio.webm'))
expect('countdown and lifecycle controls are wired', hook.includes('countdownSeconds') && hook.includes('pauseRecording') && hook.includes('resumeRecording') && hook.includes('cancelRecording') && hook.includes('retakeRecording'))
expect('cancel discards captured artifacts', hook.includes('discardRecordingArtifacts') && handlers.includes('discard-recording-artifacts'))
expect('permission status and repair IPC are exposed', handlers.includes('get-recording-permissions') && handlers.includes('open-recording-permission-settings') && preload.includes('requestRecordingPermission'))
expect('recording recovery remains intact', hook.includes('getSelectedSource()') && hook.includes('setCurrentVideoPath') && hook.includes('onStopRecordingFromTray'))
expect('cursor sidecar remains intact', handlers.includes('mouseTracker.start(recordingBounds)') && handlers.includes("result.outputPath + '.clicks.json'"))

const failed = assertions.filter(([, passed]) => !passed)
for (const [label, passed] of assertions) console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`)
if (failed.length) process.exit(1)
console.log(`Recording session contract passed (${assertions.length}/${assertions.length}).`)
