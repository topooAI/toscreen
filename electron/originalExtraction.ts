import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';

export interface OriginalSource { kind: string; path?: string | null; required?: boolean; classification?: 'original' | 'sidecar' | 'proxy' }
export interface OriginalCopyItem { kind:string; classification:'original'|'sidecar'|'proxy'|'manifest'; source?:string; status:'copied'|'missing'|'failed'; destination?:string; size?:number; checksum?:string; error?:string }

async function checksum(filePath:string) {
  const hash=createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}
export async function copyOriginalSources(sources: OriginalSource[], projectManifest: unknown, destination: string) {
  await fs.mkdir(destination,{recursive:true}); const items: OriginalCopyItem[] = [];
  const seen=new Set<string>();
  for(const source of sources){
    const classification=source.classification??(source.kind.includes('sidecar')?'sidecar':'original');
    if(!source.path){items.push({kind:source.kind,classification,status:source.required?'failed':'missing',error:'Source path unavailable'});continue;}
    const resolved=path.resolve(source.path);
    if(seen.has(resolved))continue;
    seen.add(resolved);
    try{
      const sourceStat=await fs.stat(resolved);
      const target=path.join(destination,path.basename(resolved));
      await fs.copyFile(resolved,target);
      const targetStat=await fs.stat(target);
      if(sourceStat.size!==targetStat.size)throw new Error('Size verification failed');
      const [sourceChecksum,targetChecksum]=await Promise.all([checksum(resolved),checksum(target)]);
      if(sourceChecksum!==targetChecksum)throw new Error('Checksum verification failed');
      items.push({kind:source.kind,classification,source:resolved,status:'copied',destination:target,size:targetStat.size,checksum:targetChecksum});
    }catch(error){items.push({kind:source.kind,classification,source:resolved,status:source.required?'failed':'missing',error:String(error)});}
  }
  const manifestPath=path.join(destination,'toscreen-extraction-report.json');
  await fs.writeFile(manifestPath,JSON.stringify({exportedAt:new Date().toISOString(),project:projectManifest,files:items},null,2));
  const manifestStat=await fs.stat(manifestPath);
  items.push({kind:'extraction-report',classification:'manifest',status:'copied',destination:manifestPath,size:manifestStat.size,checksum:await checksum(manifestPath)});
  return{destination,items};
}
