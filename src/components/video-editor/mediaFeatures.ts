import type { AnnotationRegion, AudioRegion } from './types'

export type SubtitleAnimation = 'none' | 'fade' | 'pop'
export interface SubtitleRegion {
  id: string; startMs: number; endMs: number; text: string; userEdited?: boolean
  style: { fontFamily: string; fontSize: number; color: string; backgroundColor: string; position: 'top' | 'center' | 'bottom'; align: 'left' | 'center' | 'right'; animation: SubtitleAnimation }
}
export interface TranscriptSegment { startMs: number; endMs: number; text: string }

export const defaultSubtitleStyle: SubtitleRegion['style'] = { fontFamily: 'Geist Sans', fontSize: 36, color: '#ffffff', backgroundColor: '#00000099', position: 'bottom', align: 'center', animation: 'fade' }

export function transcriptToSubtitles(segments: TranscriptSegment[], existing: SubtitleRegion[]): SubtitleRegion[] {
  const protectedRegions = existing.filter(item => item.userEdited)
  return [...protectedRegions, ...segments.map((item, index) => ({ id: `subtitle-${Date.now()}-${index}`, ...item, text: item.text.trim(), style: { ...defaultSubtitleStyle } }))].sort((a, b) => a.startMs - b.startMs)
}
export function splitSubtitle(region: SubtitleRegion, atMs: number): SubtitleRegion[] {
  if (atMs <= region.startMs || atMs >= region.endMs) return [region]
  const words = region.text.trim().split(/\s+/); const pivot = Math.max(1, Math.floor(words.length / 2))
  return [{ ...region, id: `${region.id}-a`, endMs: atMs, text: words.slice(0, pivot).join(' '), userEdited: true }, { ...region, id: `${region.id}-b`, startMs: atMs, text: words.slice(pivot).join(' '), userEdited: true }]
}
export function mergeSubtitles(first: SubtitleRegion, second: SubtitleRegion): SubtitleRegion {
  return { ...first, id: `${first.id}-merged`, endMs: Math.max(first.endMs, second.endMs), text: `${first.text} ${second.text}`.trim(), userEdited: true }
}
export function subtitleToAnnotation(region: SubtitleRegion): AnnotationRegion {
  const y = region.style.position === 'top' ? 12 : region.style.position === 'center' ? 45 : 82
  return { id: region.id, startMs: region.startMs, endMs: region.endMs, type: 'text', content: region.text, textContent: region.text, position: { x: 10, y }, size: { width: 80, height: 12 }, style: { color: region.style.color, backgroundColor: region.style.backgroundColor, fontSize: region.style.fontSize, fontFamily: region.style.fontFamily, fontWeight: 'bold', fontStyle: 'normal', textDecoration: 'none', textAlign: region.style.align }, zIndex: 100, animation: region.style.animation } as AnnotationRegion
}
export function bundledMusicToAudioRegion(track: { id: string; title: string; file: string; durationSeconds: number }, startMs: number, sourceUrl: string): AudioRegion {
  return { id: `music-${track.id}-${Date.now()}`, startMs, endMs: startMs + track.durationSeconds * 1000, sourceUrl, volume: .35, name: track.title, role: 'imported', isDetached: true, totalDurationMs: track.durationSeconds * 1000, sourceStartMs: 0, sourceEndMs: track.durationSeconds * 1000 }
}
