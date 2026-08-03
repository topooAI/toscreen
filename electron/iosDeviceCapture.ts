import { app, BrowserWindow, ipcMain } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { RECORDINGS_DIR } from './main'

type IOSDevice = { id: string; name: string; connected: boolean; suspended: boolean; inUse: boolean; transportType: number; audioSupport: string }
let previewProcess: ChildProcessWithoutNullStreams | null = null
let recordingProcess: ChildProcessWithoutNullStreams | null = null
let recordingOutput: string | null = null
let recordingResult: Promise<{ success: boolean; outputPath?: string; error?: string }> | null = null

export function iosCaptureHelperPath() {
  const root = app.isPackaged ? process.resourcesPath : path.join(app.getAppPath(), 'public')
  return path.join(root, 'ios-device-capture', 'ToScreenIOSCapture.app', 'Contents', 'MacOS', 'ToScreenIOSCapture')
}
async function runJSON(args: string[]) {
  return new Promise<any>((resolve, reject) => { const child = spawn(iosCaptureHelperPath(), args); let stdout=''; let stderr=''; child.stdout.on('data', chunk=>stdout+=chunk); child.stderr.on('data',chunk=>stderr+=chunk); child.once('error',reject); child.once('exit',code=>{ if(code===0){ try{resolve(JSON.parse(stdout.trim()))}catch{reject(new Error('Invalid iOS capture helper response'))} } else reject(new Error(stderr.trim() || stdout.trim() || `iOS capture helper exited ${code}`)) }) })
}
export async function discoverIOSScreenDevices(): Promise<IOSDevice[]> { return await runJSON(['discover']) }

export function registerIOSDeviceCaptureHandlers(getMainWindow: () => BrowserWindow | null) {
  ipcMain.handle('ios-device-discover', async () => { try { return { success:true, devices:await discoverIOSScreenDevices() } } catch(error){ return { success:false, devices:[], error:String(error) } } })
  ipcMain.handle('ios-device-preview-start', async (_, deviceId:string) => { previewProcess?.kill('SIGTERM'); previewProcess=spawn(iosCaptureHelperPath(),['preview',deviceId]); previewProcess.once('exit',()=>{previewProcess=null; getMainWindow()?.webContents.send('ios-device-state',{type:'preview-stopped'})}); return {success:true} })
  ipcMain.handle('ios-device-preview-stop', () => { previewProcess?.kill('SIGTERM'); previewProcess=null; return {success:true} })
  ipcMain.handle('ios-device-recording-start', async (_, deviceId:string) => {
    if(recordingProcess) return {success:false,error:'An iOS device recording is already active'}
    await fs.mkdir(RECORDINGS_DIR,{recursive:true}); recordingOutput=path.join(RECORDINGS_DIR,`ios-screen-${Date.now()}.mov`)
    const child=spawn(iosCaptureHelperPath(),['record',deviceId,recordingOutput]); recordingProcess=child
    let buffer=''; let started=false
    recordingResult=new Promise(resolve=>{ child.stdout.on('data',chunk=>{ buffer+=chunk.toString(); const lines=buffer.split('\n'); buffer=lines.pop()||''; for(const line of lines){ try{const event=JSON.parse(line); if(event.type==='started') started=true; if(event.type==='error') getMainWindow()?.webContents.send('ios-device-state',event)}catch{} } }); child.once('error',error=>resolve({success:false,error:String(error)})); child.once('exit',async code=>{ const output=recordingOutput; recordingProcess=null; recordingOutput=null; if(code===0&&output){resolve({success:true,outputPath:output})}else{if(output)await fs.unlink(output).catch(()=>undefined);resolve({success:false,error:`iPhone/iPad capture ended unexpectedly (${code}); reconnect and unlock the device`})} }) })
    await new Promise(resolve=>setTimeout(resolve,350)); if(!recordingProcess || !started) return await recordingResult
    return {success:true,outputPath:recordingOutput,audioSupport:'Muxed device audio is included only when the iOS device exposes it; separate macOS system audio is unavailable.'}
  })
  ipcMain.handle('ios-device-recording-stop', async () => { if(!recordingProcess||!recordingResult)return {success:false,error:'No active iPhone/iPad recording'}; recordingProcess.kill('SIGTERM'); return await recordingResult })
  ipcMain.handle('ios-device-recording-cancel', async () => { const output=recordingOutput; recordingProcess?.kill('SIGKILL'); recordingProcess=null; recordingOutput=null; if(output)await fs.unlink(output).catch(()=>undefined); return {success:true} })
}
