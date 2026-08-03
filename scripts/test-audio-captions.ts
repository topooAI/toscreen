import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { createProjectFromLegacyEditorState, restoreLegacyEditorStateFromProjectModel } from '../src/components/video-editor/project/legacyAdapter'
import { getProjectRenderSettings } from '../src/components/video-editor/project/renderSettings'
import { bundledMusicToAudioRegion, mergeSubtitles, splitSubtitle, subtitleToAnnotation, transcriptToSubtitles, defaultSubtitleStyle } from '../src/components/video-editor/mediaFeatures'
import { cleanupTranscriptionMix, transcriptionHelperPath, transcriptionMixPath } from '../electron/transcriptionRuntime'

const manifest = JSON.parse(fs.readFileSync('public/music/LICENSES.json','utf8'))
assert.equal(manifest.license,'CC0-1.0'); assert.equal(manifest.tracks.length,2)
for(const track of manifest.tracks){ const file=`public/music/${track.file}`; const bytes=fs.readFileSync(file); assert.equal(bytes.subarray(0,4).toString(),'RIFF'); assert.ok(bytes.length>100000); assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),manifest.verification.sha256[track.file]) }
assert.match(manifest.dedication,/owned.*CC0.*no sampled/i)
const edited={id:'edited',startMs:0,endMs:900,text:'Keep me',userEdited:true,style:{...defaultSubtitleStyle}}
const generated=transcriptToSubtitles([{startMs:1000,endMs:2000,text:'hello world'}],[edited])
assert.equal(generated[0].text,'Keep me'); assert.equal(generated[1].text,'hello world')
const split=splitSubtitle(generated[1],1500); assert.equal(split.length,2); assert.equal(mergeSubtitles(split[0],split[1]).text,'hello world')
const annotation=subtitleToAnnotation({...generated[1],style:{...defaultSubtitleStyle,animation:'pop'}}); assert.equal(annotation.animation,'pop')
const packagedRoot='/Applications/ToScreen.app/Contents/Resources', musicUrl=`toscreen://${packagedRoot}/music/${manifest.tracks[0].file}`
const music=bundledMusicToAudioRegion(manifest.tracks[0],500,musicUrl); assert.equal(music.startMs,500); assert.equal(music.role,'imported'); assert.equal(music.sourceUrl,musicUrl)
assert.equal(transcriptionHelperPath(packagedRoot,'/dev/app',true),`${packagedRoot}/transcriber/ToScreenTranscriber.app/Contents/MacOS/ToScreenTranscriber`)
const tempMix=transcriptionMixPath(os.tmpdir(),4242); fs.writeFileSync(tempMix,'temporary'); assert.equal(await cleanupTranscriptionMix(tempMix),true); assert.equal(fs.existsSync(tempMix),false); assert.equal(await cleanupTranscriptionMix(path.join(os.tmpdir(),'unrelated.wav')),false)
const ordinaryAnnotation={...annotation,id:'ordinary-note',content:'ordinary',textContent:'ordinary'}
const baseInput={videoPath:'/tmp/p.mp4',originalVideoPath:'/tmp/o.mov',durationSeconds:5,projectDurationSeconds:5,zoomRegions:[],trimRegions:[],annotationRegions:[ordinaryAnnotation],audioRegions:[music],subtitleRegions:generated,cursorData:[],cursorSize:1,cursorSmoothing:true,showVectorCursor:true,cursorOffset:0,cropRegion:{x:0,y:0,width:1,height:1},wallpaper:'',shadowIntensity:0,showBlur:false,motionBlurEnabled:false,borderRadius:0,padding:0,aspectRatio:'16:9' as const,exportQuality:'good' as const}
let project=createProjectFromLegacyEditorState(baseInput)
assert.equal(project.tracks.find(track=>track.name==='Subtitles')?.type,'annotation'); assert.equal(project.clips.filter(clip=>clip.trackId==='track-subtitle-main').length,2)
for(let round=0;round<3;round++){ const restoredRound=restoreLegacyEditorStateFromProjectModel(project); assert.equal(restoredRound.annotationRegions.length,1); assert.equal(restoredRound.subtitleRegions?.length,2); assert.equal(new Set(restoredRound.subtitleRegions?.map(item=>item.id)).size,2); const rendered=getProjectRenderSettings(project).timeline.annotationRegions; assert.equal(rendered.filter(item=>item.id==='ordinary-note').length,1); for(const subtitle of generated) assert.equal(rendered.filter(item=>item.id===subtitle.id).length,1); project=createProjectFromLegacyEditorState({...baseInput,annotationRegions:restoredRound.annotationRegions,subtitleRegions:restoredRound.subtitleRegions}) }
const restored=restoreLegacyEditorStateFromProjectModel(project); assert.deepEqual(restored.subtitleRegions,generated); assert.equal(restored.audioRegions[0].name,manifest.tracks[0].title)
const withoutLegacy=structuredClone(project); delete withoutLegacy.legacyState?.subtitleRegions
assert.deepEqual(restoreLegacyEditorStateFromProjectModel(withoutLegacy).subtitleRegions?.map(item=>item.text),generated.map(item=>item.text))
const afterDelete=createProjectFromLegacyEditorState({...baseInput,subtitleRegions:generated.filter(item=>item.id!=='edited')}); const deletedState=restoreLegacyEditorStateFromProjectModel(afterDelete); assert.equal(deletedState.subtitleRegions?.some(item=>item.id==='edited'),false); assert.equal(afterDelete.clips.some(clip=>clip.id==='edited'),false); assert.equal(getProjectRenderSettings(afterDelete).timeline.annotationRegions.some(item=>item.id==='edited'),false)
const preview=fs.readFileSync('src/components/video-editor/VideoPlayback.tsx','utf8'), exporter=fs.readFileSync('src/lib/exporter/annotationRenderer.ts','utf8'), panel=fs.readFileSync('src/components/video-editor/MediaFeaturesPanel.tsx','utf8')
for(const token of ["animation === 'fade'","animation === 'pop'"]){ assert.ok(preview.includes(token)); assert.ok(exporter.includes(token)) }
for(const token of ['Add to Audio Track','Transcribe','Split','Merge next','Delete','fontFamily','backgroundColor']) assert.ok(panel.includes(token))
console.log('Audio/captions executable audit passed: CC0 assets, transcription protection, subtitle operations, project roundtrip, timeline UI, preview/export parity.')
