import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const WRITE_CONFIRMATION='I_UNDERSTAND_THIS_WRITES_TO_PRODUCTION';
const RESOURCE_CONFIRMATION='USE_DEDICATED_DISPOSABLE_TEST_RESOURCES';
const base=new URL(process.env.TOPOO_SHARE_URL||'https://share.topoo.ai');
const writeRequested=process.argv.includes('--write');
const probeRequested=process.argv.includes('--probe');
const ownerToken=process.env.TOPOO_SHARE_OWNER_TOKEN||'';
const commenterToken=process.env.TOPOO_SHARE_COMMENTER_TOKEN||'';
const fixturePath=process.env.TOPOO_SHARE_FIXTURE||'';
const runId=`toscreen-acceptance-${new Date().toISOString().replace(/[:.]/g,'-')}-${crypto.randomUUID().slice(0,8)}`;
const evidence:any={runId,mode:writeRequested?'write':'dry-run',serviceOrigin:base.origin,startedAt:new Date().toISOString(),steps:[],residualResources:[]};
const record=(name:string,status:string,details:Record<string,unknown>={})=>evidence.steps.push({name,status,at:new Date().toISOString(),...details});
if(base.protocol!=='https:')throw new Error('TOPOO_SHARE_URL must use HTTPS.');
async function request(apiPath:string,init:RequestInit={},expected?:number[]){const response=await fetch(new URL(apiPath,base),init);if(expected&&!expected.includes(response.status))throw new Error(`${init.method||'GET'} ${apiPath} returned ${response.status}: ${await response.text()}`);return response;}
const auth=(token:string,body?:unknown,method='GET'):RequestInit=>({method,headers:{authorization:`Bearer ${token}`,...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});

async function dryRun(){
  if(!probeRequested){record('network','skipped',{reason:'Default dry-run performs no network requests. Add --probe for explicit read-only production checks.'});record('mutation-gate','passed',{writesPerformed:false,networkPerformed:false,requiredWriteFlag:'--write',doubleConfirmation:true});return;}
  const health=await request('/health',{},[200]);record('health','passed',{body:await health.json()});
  const viewer=await request('/s/dry-run-probe',{},[200]);const html=await viewer.text();if(!html.includes('Sign in with Topoo'))throw new Error('Viewer page is missing Topoo sign-in.');record('viewer-shell','passed',{csp:viewer.headers.get('content-security-policy')});
  for(const [name,slug,expected] of [['public-anonymous',process.env.TOPOO_SHARE_EXISTING_PUBLIC_SLUG,200],['private-anonymous',process.env.TOPOO_SHARE_EXISTING_PRIVATE_SLUG,403]] as const){if(!slug){record(name,'skipped',{reason:'No dedicated existing slug supplied.'});continue}const response=await request(`/v1/shares/${encodeURIComponent(slug)}`);if(response.status!==expected)throw new Error(`${name} expected ${expected}, got ${response.status}`);record(name,'passed',{slug,status:response.status});}
  record('mutation-gate','passed',{writesPerformed:false,networkPerformed:true,probeMode:'read-only',requiredWriteFlag:'--write',doubleConfirmation:true});
}

async function writeLifecycle(){
  if(process.env.TOPOO_SHARE_ACCEPT_WRITE!==WRITE_CONFIRMATION||process.env.TOPOO_SHARE_TEST_RESOURCE_ACK!==RESOURCE_CONFIRMATION)throw new Error('Production writes refused: both explicit confirmations are required.');
  if(!ownerToken||!commenterToken)throw new Error('Production writes require TOPOO_SHARE_OWNER_TOKEN and TOPOO_SHARE_COMMENTER_TOKEN.');
  if(!fixturePath)throw new Error('Production writes require TOPOO_SHARE_FIXTURE pointing to a dedicated disposable fixture.');
  const fixture=await fs.readFile(fixturePath),extension=path.extname(fixturePath).toLowerCase(),contentType=extension==='.gif'?'image/gif':extension==='.mp4'?'video/mp4':'';if(!contentType)throw new Error('Fixture must be MP4 or GIF.');
  const checksum=crypto.createHash('sha256').update(fixture).digest('hex');let publicSlug='',privateSlug='',commentId='';
  try{
    let response=await request('/v1/uploads',auth(ownerToken,{size:fixture.length,checksum,contentType},'POST'),[201]);const upload=await response.json() as any;record('upload-create','passed',{uploadId:upload.id,bytes:fixture.length,checksum});
    const partSize=Number(upload.partSize);let completed=new Set<number>((upload.completedParts||[]).map((part:any)=>Number(part.partNumber)));
    for(let offset=0,part=1;offset<fixture.length;offset+=partSize,part++){if(!completed.has(part)){const chunk=fixture.subarray(offset,Math.min(offset+partSize,fixture.length));await request(`/v1/uploads/${upload.id}/parts/${part}`,{method:'PUT',headers:{authorization:`Bearer ${ownerToken}`,'content-length':String(chunk.length)},body:chunk},[200]);}if(part===1){response=await request(`/v1/uploads/${upload.id}`,auth(ownerToken),[200]);completed=new Set(((await response.json() as any).completedParts||[]).map((item:any)=>Number(item.partNumber)));if(!completed.has(1))throw new Error('Checkpoint did not persist part 1.');record('upload-checkpoint-resume','passed',{uploadId:upload.id,completedParts:[...completed]});}}
    response=await request(`/v1/uploads/${upload.id}/finalize`,auth(ownerToken,{},'POST'),[200]);record('upload-finalize','passed',{uploadId:upload.id,result:await response.json()});
    const create=async(visibility:'public'|'private')=>(await (await request('/v1/shares',auth(ownerToken,{uploadId:upload.id,title:`[Acceptance ${runId}] ${visibility}`,visibility},'POST'),[201])).json() as any).slug;
    publicSlug=await create('public');privateSlug=await create('private');evidence.residualResources.push({type:'sealed-upload',id:upload.id,cleanup:'No product hard-delete API.'},{type:'share',slug:publicSlug,cleanup:'Revoked in finally.'},{type:'share',slug:privateSlug,cleanup:'Revoked in finally.'});
    await request(`/v1/shares/${publicSlug}`,{},[200]);record('public-anonymous','passed',{slug:publicSlug});await request(`/v1/shares/${privateSlug}`,{},[403]);await request(`/v1/shares/${privateSlug}`,auth(ownerToken),[200]);record('private-policy','passed',{slug:privateSlug,anonymous:403,owner:200});
    response=await request(`/v1/shares/${publicSlug}/comments`,auth(commenterToken,{timestampMs:1000,body:`[Acceptance ${runId}] lifecycle comment`},'POST'),[201]);commentId=(await response.json() as any).id;const comments=(await (await request(`/v1/shares/${publicSlug}/comments`,{},[200])).json() as any).items;if(!comments.some((item:any)=>item.id===commentId))throw new Error('Created comment was not readable.');await request(`/v1/shares/${publicSlug}/comments/${commentId}`,auth(ownerToken,{resolved:true},'PATCH'),[200]);await request(`/v1/shares/${publicSlug}/comments/${commentId}`,auth(commenterToken,undefined,'DELETE'),[200]);commentId='';record('comment-lifecycle','passed',{created:true,read:true,resolvedByOwner:true,deletedByAuthor:true});
  }finally{
    if(commentId&&publicSlug)await request(`/v1/shares/${publicSlug}/comments/${commentId}`,auth(commenterToken,undefined,'DELETE')).catch(error=>record('cleanup-comment','failed',{error:String(error)}));
    for(const slug of [publicSlug,privateSlug].filter(Boolean))await request(`/v1/shares/${slug}`,auth(ownerToken,{revoked:true},'PATCH')).then(()=>record('cleanup-revoke','passed',{slug})).catch(error=>record('cleanup-revoke','failed',{slug,error:String(error)}));
    for(const slug of [publicSlug,privateSlug].filter(Boolean)){const status=(await request(`/v1/shares/${slug}`,auth(ownerToken))).status;if(status!==403)throw new Error(`Revoked share ${slug} remained accessible (${status}).`);record('revoked-policy','passed',{slug,ownerStatus:status});}
  }
}
try{if(writeRequested)await writeLifecycle();else await dryRun();evidence.status='passed';}catch(error){evidence.status='failed';evidence.error=String(error);process.exitCode=1;}finally{evidence.finishedAt=new Date().toISOString();console.log(JSON.stringify(evidence,null,2));}
