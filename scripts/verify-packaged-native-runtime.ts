import { accessSync, constants } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const appPath = path.resolve(process.argv[2] || 'release/0.0.34/mac-arm64/ToScreen.app')
const resourcesPath = path.join(appPath, 'Contents', 'Resources')
const executablePath = path.join(appPath, 'Contents', 'MacOS', 'ToScreen')
const recorderPath = path.join(
  resourcesPath,
  'app.asar.unpacked',
  'node_modules',
  'node-mac-recorder',
  'build',
  'Release',
  'mac_recorder.node',
)
const ffmpegPath = path.join(
  resourcesPath,
  'app.asar.unpacked',
  'node_modules',
  '@ffmpeg-installer',
  'darwin-arm64',
  'ffmpeg',
)

for (const requiredPath of [executablePath, recorderPath, ffmpegPath]) {
  accessSync(requiredPath, constants.R_OK)
}
accessSync(ffmpegPath, constants.X_OK)

const recorderProbe = spawnSync(
  executablePath,
  ['-e', "require(process.argv[1]); console.log('native-recorder:ok')", recorderPath],
  {
    encoding: 'utf8',
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  },
)

if (recorderProbe.status !== 0 || !recorderProbe.stdout.includes('native-recorder:ok')) {
  throw new Error(`Packaged native recorder failed to load: ${recorderProbe.stderr || recorderProbe.stdout}`)
}

const ffmpegProbe = spawnSync(ffmpegPath, ['-version'], { encoding: 'utf8' })
if (ffmpegProbe.status !== 0 || !ffmpegProbe.stdout.startsWith('ffmpeg version')) {
  throw new Error(`Packaged FFmpeg failed to execute: ${ffmpegProbe.stderr || ffmpegProbe.stdout}`)
}

console.log(JSON.stringify({
  status: 'ok',
  appPath,
  nativeRecorder: recorderPath,
  ffmpeg: ffmpegPath,
}, null, 2))
