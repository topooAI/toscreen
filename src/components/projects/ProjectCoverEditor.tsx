import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { ProjectCoverFocus } from './projectCoverFocus'
import { estimateVisibleSourceWidth, getProjectCoverDetailScale } from './projectCoverScale'
import styles from './ProjectHome.module.css'

interface CoverProject {
  name: string
  projectPath: string
  thumbnailPath?: string
}

interface CoverEditorInfo {
  sourcePath: string
  sourceWidth?: number
  sourceHeight?: number
  durationMs: number
  timeMs: number
  focus: ProjectCoverFocus
  mode: 'auto' | 'custom'
}

interface ProjectCoverEditorProps {
  project: CoverProject | null
  onClose: () => void
  onSaved: () => void
}

export function ProjectCoverEditor({ project, onClose, onSaved }: ProjectCoverEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const draggingRef = useRef(false)
  const [info, setInfo] = useState<CoverEditorInfo | null>(null)
  const [timeMs, setTimeMs] = useState(0)
  const [focus, setFocus] = useState<ProjectCoverFocus>({ x: 50, y: 46 })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!project) { setInfo(null); return }
    let active = true
    void window.electronAPI.getProjectCoverEditor(project.projectPath).then(result => {
      if (!active) return
      if (!result.success) { toast.error('Unable to edit cover', { description: result.error }); onClose(); return }
      const next = result as CoverEditorInfo & { success: true }
      setInfo(next)
      setTimeMs(next.timeMs)
      setFocus(next.focus)
    })
    return () => { active = false }
  }, [project, onClose])

  const seek = (nextTimeMs: number) => {
    setTimeMs(nextTimeMs)
    if (videoRef.current) videoRef.current.currentTime = nextTimeMs / 1000
  }

  const chooseFocus = (event: MouseEvent<HTMLDivElement> | PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const crop = info ? getCropSize(info) : { width: 20, height: 20 }
    const x = (event.clientX - rect.left) / rect.width * 100
    const y = (event.clientY - rect.top) / rect.height * 100
    setFocus({
      x: Number(Math.min(100 - crop.width / 2, Math.max(crop.width / 2, x)).toFixed(2)),
      y: Number(Math.min(100 - crop.height / 2, Math.max(crop.height / 2, y)).toFixed(2)),
    })
  }

  const save = async () => {
    if (!project || !info) return
    setSaving(true)
    try {
      const result = await window.electronAPI.setProjectCover(project.projectPath, { timeMs, focus })
      if (!result.success) throw new Error(result.error)
      toast.success('Cover updated')
      onSaved()
      onClose()
    } catch (error) {
      toast.error('Unable to update cover', { description: String(error) })
    } finally { setSaving(false) }
  }

  const useAutomatic = async () => {
    if (!project) return
    setSaving(true)
    try {
      const result = await window.electronAPI.resetProjectCover(project.projectPath)
      if (!result.success) throw new Error(result.error)
      toast.success('Automatic cover restored')
      onSaved()
      onClose()
    } catch (error) {
      toast.error('Unable to restore automatic cover', { description: String(error) })
    } finally { setSaving(false) }
  }

  return <Dialog open={Boolean(project)} onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent className={styles.coverEditorDialog}>
      <DialogHeader>
        <DialogTitle className={styles.coverEditorTitle}>Choose cover</DialogTitle>
        <DialogDescription className={styles.coverEditorDescription}>Drag the timeline to choose a frame. Drag the crop box to position it.</DialogDescription>
      </DialogHeader>
      {info ? <>
        <div
          className={styles.coverEditorPreview}
          style={{ aspectRatio: `${info.sourceWidth || 16} / ${info.sourceHeight || 9}` }}
          onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); chooseFocus(event) }}
          onPointerMove={event => { if ((event.buttons & 1) === 1 || event.currentTarget.hasPointerCapture(event.pointerId)) chooseFocus(event) }}
          onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
          onMouseDown={event => { draggingRef.current = true; chooseFocus(event) }}
          onMouseMove={event => { if (draggingRef.current) chooseFocus(event) }}
          onMouseUp={() => { draggingRef.current = false }}
          onMouseLeave={() => { draggingRef.current = false }}
        >
          <video
            ref={videoRef}
            src={toFileUrl(info.sourcePath)}
            muted
            playsInline
            preload="metadata"
            onLoadedMetadata={event => { event.currentTarget.currentTime = timeMs / 1000 }}
          />
          <span className={styles.coverEditorCrop} style={{
            left: `${focus.x}%`,
            top: `${focus.y}%`,
            width: `${getCropSize(info).width}%`,
            height: `${getCropSize(info).height}%`,
          }}><i /><i /></span>
        </div>
        <div className={styles.coverEditorTimeline}>
          <input
            aria-label="Cover frame"
            type="range"
            min={0}
            max={Math.max(1, info.durationMs)}
            step={50}
            value={Math.min(timeMs, Math.max(1, info.durationMs))}
            onChange={event => seek(Number(event.target.value))}
          />
          <span>{formatTime(timeMs)} / {formatTime(info.durationMs)}</span>
        </div>
      </> : <div className={styles.coverEditorLoading} />}
      <DialogFooter className={styles.coverEditorFooter}>
        <button type="button" className={styles.coverEditorSecondary} disabled={saving || !info} onClick={() => void useAutomatic()}>Use automatic</button>
        <button type="button" className={styles.coverEditorPrimary} disabled={saving || !info} onClick={() => void save()}>{saving ? 'Saving…' : 'Save cover'}</button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}

function formatTime(ms: number) {
  const seconds = Math.max(0, ms) / 1000
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}.${Math.floor(seconds * 10) % 10}`
}

function toFileUrl(filePath: string) { return encodeURI(`file://${filePath}`) }

function getCropSize(info: CoverEditorInfo) {
  const sourceWidth = Math.max(1, Number(info.sourceWidth || 3840))
  const sourceHeight = Math.max(1, Number(info.sourceHeight || sourceWidth * 9 / 16))
  const visibleWidth = estimateVisibleSourceWidth(sourceWidth, getProjectCoverDetailScale(sourceWidth))
  const visibleHeight = visibleWidth / (350 / 198)
  return {
    width: Math.min(92, visibleWidth / sourceWidth * 100),
    height: Math.min(92, visibleHeight / sourceHeight * 100),
  }
}
