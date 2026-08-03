import { app, dialog, safeStorage, shell } from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { copyOriginalSources, type OriginalSource } from './originalExtraction';
import { encodeGifFromFile, type GifEncodeOptions } from './gifEncoderCore';
import {validateTopooCallback} from '../shared/topooAuthState';


const tokenPath = () => path.join(app.getPath('userData'), 'topoo-session.bin');
const authStatePath = () => path.join(app.getPath('userData'),'topoo-auth-state.json');
export async function beginTopooSignIn(){const state=crypto.randomBytes(24).toString('hex');await fs.writeFile(authStatePath(),JSON.stringify({state,expiresAt:Date.now()+10*60_000}),{mode:0o600});return `https://auth.topoo.ai/api/auth/signin?callbackUrl=${encodeURIComponent(`toscreen://auth/callback?state=${state}`)}&state=${state}`;}
export async function consumeTopooCallback(rawUrl:string){let expected:any;try{expected=JSON.parse(await fs.readFile(authStatePath(),'utf8'));}catch{throw new Error('No pending Topoo sign-in');}await fs.rm(authStatePath(),{force:true});await storeTopooToken(validateTopooCallback(rawUrl,expected));}
export async function storeTopooToken(token: string) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('OS protected storage is unavailable');
  await fs.writeFile(tokenPath(), safeStorage.encryptString(token));
}
export async function readTopooToken() { try { return safeStorage.decryptString(await fs.readFile(tokenPath())); } catch { return null; } }
export async function clearTopooToken() { await fs.rm(tokenPath(), { force: true }); }

export async function fetchTopooSession() {
  const token = await readTopooToken(); if (!token) return { state: 'signed-out' as const };
  try {
    const response = await fetch('https://auth.topoo.ai/api/auth/session', { headers: { authorization: `Bearer ${token}` } });
    if (response.status === 401) { await clearTopooToken(); return { state: 'expired' as const }; }
    if (!response.ok) throw new Error(`Topoo Auth ${response.status}`);
    const raw = await response.json() as any; const user = raw.user ?? raw;
    return { state: 'signed-in' as const, user: { id: user.id, email: user.email, displayName: user.displayName ?? user.nickname ?? user.email, nickname: user.nickname, avatarUrl: user.avatarUrl ?? user.avatar_url } };
  } catch (error) { return { state: 'offline' as const, message: String(error) }; }
}

export async function encodeGif(videoData: ArrayBuffer, options: GifEncodeOptions, outputPath: string, onProgress?: (percentage: number) => void, signal?: AbortSignal) {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'toscreen-gif-')); const input = path.join(temp, 'render.mp4');
  try {
    await fs.writeFile(input, Buffer.from(videoData)); return await encodeGifFromFile(input,options,outputPath,onProgress,signal);
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
}

export async function chooseGifPath(defaultName: string) { const result = await dialog.showSaveDialog({ defaultPath: path.join(app.getPath('downloads'), defaultName), filters: [{ name: 'GIF image', extensions: ['gif'] }] }); return result.canceled ? null : result.filePath; }

export async function extractOriginals(sources: OriginalSource[], projectManifest: unknown) {
  const selected = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] }); if (selected.canceled) return { cancelled: true, items: [] };
  return { cancelled: false, ...await copyOriginalSources(sources, projectManifest, selected.filePaths[0]) };
}

export const openLocalPath = (target: string) => shell.openPath(target);

async function fileChecksum(filePath:string){return new Promise<string>((resolve,reject)=>{const hash=crypto.createHash('sha256');const stream=createReadStream(filePath);stream.on('data',chunk=>hash.update(chunk));stream.on('error',reject);stream.on('end',()=>resolve(hash.digest('hex')));});}
function trustedShareService(raw:string){const configured=process.env.TOPOO_SHARE_URL||'https://share.topoo.ai';const requested=new URL(raw);const trusted=new URL(configured);if(requested.origin!==trusted.origin)throw new Error('Untrusted Topoo Share service origin');return trusted.origin;}
async function retryFetch(url:string,init:RequestInit,signal?:AbortSignal){let error:unknown;for(let attempt=0;attempt<3;attempt++){if(signal?.aborted)throw new Error('Cancelled');try{const response=await fetch(url,{...init,signal});if(response.ok||response.status<500)return response;error=new Error(`HTTP ${response.status}`);}catch(value){error=value;}await new Promise(resolve=>setTimeout(resolve,250*2**attempt));}throw error;}
export async function quickShare(filePath: string, input: { title: string; visibility: 'public' | 'unlisted' | 'private'; expiresAt?: string | null; serviceUrl: string; onProgress?: (value: number) => void }, signal?:AbortSignal) {
  const serviceUrl=trustedShareService(input.serviceUrl);const token = await readTopooToken(); if (!token) throw new Error('Sign in to Topoo first'); const stat=await fs.stat(filePath);const checksum=await fileChecksum(filePath);const contentType=path.extname(filePath).toLowerCase()==='.gif'?'image/gif':'video/mp4';const headers={authorization:`Bearer ${token}`,'content-type':'application/json'};const checkpointFile=path.join(app.getPath('userData'),`share-upload-${checksum}.json`);let checkpoint:any=null;try{checkpoint=JSON.parse(await fs.readFile(checkpointFile,'utf8'));}catch{}
  let upload:any;if(checkpoint?.uploadId){const resumed=await retryFetch(`${serviceUrl}/v1/uploads/${checkpoint.uploadId}`,{headers},signal);if(resumed.ok)upload=await resumed.json();}
  if(!upload){const created=await retryFetch(`${serviceUrl}/v1/uploads`,{method:'POST',headers,body:JSON.stringify({size:stat.size,checksum,contentType})},signal);if(!created.ok)throw new Error(`Create upload failed ${created.status}`);upload=await created.json();await fs.writeFile(checkpointFile,JSON.stringify({uploadId:upload.id,filePath,checksum}));}
  const completed=new Set<number>((upload.completedParts??[]).map((part:any)=>Number(part.partNumber)));const handle=await fs.open(filePath,'r');try{for(let partNumber=1,offset=0;offset<stat.size;partNumber++,offset+=upload.partSize){if(completed.has(partNumber))continue;if(signal?.aborted)throw new Error('Cancelled');const length=Math.min(upload.partSize,stat.size-offset);const buffer=Buffer.allocUnsafe(length);await handle.read(buffer,0,length,offset);const body=buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength) as ArrayBuffer;const response=await retryFetch(`${serviceUrl}/v1/uploads/${upload.id}/parts/${partNumber}`,{method:'PUT',headers:{authorization:`Bearer ${token}`,'content-length':String(length)},body},signal);if(!response.ok)throw new Error(`Part ${partNumber} failed ${response.status}`);input.onProgress?.(Math.min(92,(offset+length)/stat.size*92));}}catch(error){if(signal?.aborted){await fetch(`${serviceUrl}/v1/uploads/${upload.id}`,{method:'DELETE',headers:{authorization:`Bearer ${token}`}}).catch(()=>{});await fs.rm(checkpointFile,{force:true});}throw error;}finally{await handle.close();}
  const finalized=await retryFetch(`${serviceUrl}/v1/uploads/${upload.id}/finalize`,{method:'POST',headers,body:'{}'},signal);if(!finalized.ok)throw new Error(`Finalize failed ${finalized.status}`);await fs.rm(checkpointFile,{force:true});const share=await retryFetch(`${serviceUrl}/v1/shares`,{method:'POST',headers,body:JSON.stringify({uploadId:upload.id,title:input.title,visibility:input.visibility,expiresAt:input.expiresAt})},signal);if(!share.ok)throw new Error(`Create share failed ${share.status}`);input.onProgress?.(100);return share.json();
}
export async function shareApi(serviceUrl:string,method:string,apiPath:string,body?:unknown){const trusted=trustedShareService(serviceUrl);if(!apiPath.startsWith('/v1/'))throw new Error('Invalid Share API path');const token=await readTopooToken();if(!token)throw new Error('Sign in to Topoo first');const response=await fetch(`${trusted}${apiPath}`,{method,headers:{authorization:`Bearer ${token}`,...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});if(!response.ok)throw new Error(`Share API ${response.status}: ${await response.text()}`);return response.status===204?null:response.json();}
