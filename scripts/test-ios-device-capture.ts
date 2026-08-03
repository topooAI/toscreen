import assert from 'node:assert/strict'
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const helper='public/ios-device-capture/ToScreenIOSCapture.app/Contents/MacOS/ToScreenIOSCapture'
const bytes=fs.readFileSync(helper); assert.equal(bytes.readUInt32BE(0),0xcafebabe); const architectures=new Set<number>(); for(let index=0;index<bytes.readUInt32BE(4);index++)architectures.add(bytes.readUInt32BE(8+index*20)); assert.deepEqual(architectures,new Set([0x01000007,0x0100000c]))
const discovery=spawnSync(helper,['discover'],{encoding:'utf8'}); assert.equal(discovery.status,0); const devices=JSON.parse(discovery.stdout); assert.ok(Array.isArray(devices)); for(const device of devices){ assert.equal(typeof device.id,'string'); assert.equal(typeof device.name,'string'); assert.equal(typeof device.connected,'boolean'); assert.match(device.audioSupport,/muxed.*separate macOS system audio is unavailable/i) }
const swift=fs.readFileSync('electron/ios-device-capture.swift','utf8'), ipc=fs.readFileSync('electron/iosDeviceCapture.ts','utf8'), launch=fs.readFileSync('src/components/launch/LaunchWindow.tsx','utf8'), hook=fs.readFileSync('src/hooks/useScreenRecorder.ts','utf8')
for(const token of ['DiscoverySession(deviceTypes: [.external], mediaType: .muxed','kCMMuxedStreamType_EmbeddedDeviceScreenRecording','wasDisconnectedNotification','AVCaptureMovieFileOutput']) assert.ok(swift.includes(token))
for(const token of ['ios-device-discover','ios-device-preview-start','ios-device-recording-start','ios-device-recording-stop','ios-device-recording-cancel']) assert.ok(ipc.includes(token))
assert.ok(!launch.includes('Camera or iPhone/iPad')); for(const token of ['No wired iPhone/iPad screen detected.','startIOSDevicePreview','System audio unavailable','iosDeviceId']) assert.ok(launch.includes(token)); for(const token of ['startIOSDeviceRecording','stopIOSDeviceRecording','cancelIOSDeviceRecording']) assert.ok(hook.includes(token))
console.log(JSON.stringify({status:'ok',devices:devices.length,hardwareAcceptance:devices.length?'required: record at least 5 seconds':'Not completed: no wired iPhone/iPad screen device detected'},null,2))
