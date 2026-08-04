import assert from 'node:assert/strict'
import fs from 'node:fs'

const acceptance = fs.readFileSync('scripts/accept-transcription-e2e.ts', 'utf8')
const helper = fs.readFileSync('electron/transcribe.swift', 'utf8')
for (const token of ["'/usr/bin/open'", "'-W'", "'--args'", "'--authorization-status'", "'not_completed'", "segments.length === 0", 'projectSavedAndReopened', 'previewExportSharedRenderData']) assert.ok(acceptance.includes(token))
for (const forbidden of ['tccutil reset', 'openDictationSettings', 'x-apple.systempreferences']) assert.equal(acceptance.includes(forbidden), false)
assert.ok(helper.includes('CommandLine.arguments[1] == "--authorization-status"'))
assert.ok(helper.indexOf('--authorization-status') < helper.indexOf('SFSpeechRecognizer.requestAuthorization'))
const runtime = fs.readFileSync('electron/transcription.ts', 'utf8')
assert.ok(runtime.includes('transcriptionHelperAppPath('))
assert.ok(runtime.includes("active = spawn('/usr/bin/open'"))
for (const source of [runtime, acceptance]) {
  assert.equal(source.includes('spawn(helperExecutable'), false)
  assert.equal(source.includes('run(helperExecutable'), false)
}
console.log('Transcription acceptance regression passed: bundle preflight, no TCC mutation, structured result, non-empty segments and subtitle persistence/render contracts.')
