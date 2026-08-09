import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { ProjectCoverFocus } from './projectCoverFocus'
import { estimateVisibleSourceWidth, getProjectCoverDetailScale, getProjectCoverMaxFrameScale } from './projectCoverScale'
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
  frameScale: number
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
  const dragRef = useRef<{
    mode: 'move' | 'resize'
    startClientX: number
    startClientY: number
    startFocus: ProjectCoverFocus
    startFrameScale: number
    cornerX?: -1 | 1
    cornerY?: -1 | 1
  } | null>(null)
  const [info, setInfo] = useState<CoverEditorInfo | null>(null)
  const [timeMs, setTimeMs] = useState(0)
  const [frameScale, setFrameScale] = useState(1)
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
      setFrameScale(next.frameScale)
      setFocus(next.focus)
    })
    return () => { active = false }
  }, [project, onClose])

  const seek = (nextTimeMs: number) => {
    setTimeMs(nextTimeMs)
    if (videoRef.current) videoRef.current.currentTime = nextTimeMs / 1000
  }

  const chooseFocus = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const crop = info ? getCropSize(info, frameScale) : { width: 20, height: 20 }
    const x = (event.clientX - rect.left) / rect.width * 100
    const y = (event.clientY - rect.top) / rect.height * 100
    setFocus({
      x: Number(Math.min(100 - crop.width / 2, Math.max(crop.width / 2, x)).toFixed(2)),
      y: Number(Math.min(100 - crop.height / 2, Math.max(crop.height / 2, y)).toFixed(2)),
    })
  }

  const beginCropDrag = (event: PointerEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      mode: 'move',
      startClientX: event.clientX,
      startClientY: event.clientY,
      startFocus: focus,
      startFrameScale: frameScale,
    }
  }

  const beginCropResize = (event: PointerEvent<HTMLButtonElement>, cornerX: -1 | 1, cornerY: -1 | 1) => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      mode: 'resize',
      startClientX: event.clientX,
      startClientY: event.clientY,
      startFocus: focus,
      startFrameScale: frameScale,
      cornerX,
      cornerY,
    }
  }

  const updateCropDrag = (event: PointerEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!info || !dragRef.current) return
    const preview = event.currentTarget.closest(`.${styles.coverEditorPreview}`) as HTMLElement | null
    if (!preview) return
    const rect = preview.getBoundingClientRect()
    const drag = dragRef.current
    const dx = (event.clientX - drag.startClientX) / rect.width * 100
    const dy = (event.clientY - drag.startClientY) / rect.height * 100
    const startCrop = getCropSize(info, drag.startFrameScale)

    if (drag.mode === 'move') {
      setFocus(clampFocus({ x: drag.startFocus.x + dx, y: drag.startFocus.y + dy }, startCrop))
      return
    }

    const widthRatio = (drag.cornerX || 1) * dx / Math.max(1, startCrop.width)
    const heightRatio = (drag.cornerY || 1) * dy / Math.max(1, startCrop.height)
    const nextScale = Math.min(
      getProjectCoverMaxFrameScale(info.sourceWidth, info.sourceHeight),
      Math.max(.65, drag.startFrameScale * (1 + (widthRatio + heightRatio) / 2)),
    )
    const nextCrop = getCropSize(info, nextScale)
    const oppositeX = drag.startFocus.x - (drag.cornerX || 1) * startCrop.width / 2
    const oppositeY = drag.startFocus.y - (drag.cornerY || 1) * startCrop.height / 2
    setFrameScale(Number(nextScale.toFixed(3)))
    setFocus(clampFocus({
      x: oppositeX + (drag.cornerX || 1) * nextCrop.width / 2,
      y: oppositeY + (drag.cornerY || 1) * nextCrop.height / 2,
    }, nextCrop))
  }

  const endCropDrag = (event: PointerEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dragRef.current = null
  }

  const save = async () => {
    if (!project || !info) return
    setSaving(true)
    try {
      const result = await window.electronAPI.setProjectCover(project.projectPath, { timeMs, frameScale, focus })
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
        <DialogDescription className={styles.coverEditorDescription}>Choose a frame, then drag or resize the crop box.</DialogDescription>
      </DialogHeader>
      {info ? <>
        <div
          className={styles.coverEditorPreview}
          style={{ aspectRatio: `${info.sourceWidth || 16} / ${info.sourceHeight || 9}` }}
          onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); chooseFocus(event) }}
          onPointerMoveCapture={event => {
            if (dragRef.current) updateCropDrag(event)
            else if ((event.buttons & 1) === 1 || event.currentTarget.hasPointerCapture(event.pointerId)) chooseFocus(event)
          }}
          onPointerUpCapture={event => {
            if (dragRef.current) endCropDrag(event)
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
          }}
          onPointerCancelCapture={event => { if (dragRef.current) endCropDrag(event) }}
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
            width: `${getCropSize(info, frameScale).width}%`,
            height: `${getCropSize(info, frameScale).height}%`,
          }}
            onPointerDown={beginCropDrag}
          >
            <button type="button" aria-label="Resize cover from top left" className={styles.coverEditorHandleNW} onPointerDown={event => beginCropResize(event, -1, -1)} />
            <button type="button" aria-label="Resize cover from top right" className={styles.coverEditorHandleNE} onPointerDown={event => beginCropResize(event, 1, -1)} />
            <button type="button" aria-label="Resize cover from bottom left" className={styles.coverEditorHandleSW} onPointerDown={event => beginCropResize(event, -1, 1)} />
            <button type="button" aria-label="Resize cover from bottom right" className={styles.coverEditorHandleSE} onPointerDown={event => beginCropResize(event, 1, 1)} />
          </span>
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

function getCropSize(info: CoverEditorInfo, frameScale = 1) {
  const sourceWidth = Math.max(1, Number(info.sourceWidth || 3840))
  const sourceHeight = Math.max(1, Number(info.sourceHeight || sourceWidth * 9 / 16))
  const visibleWidth = estimateVisibleSourceWidth(sourceWidth, getProjectCoverDetailScale(sourceWidth)) * frameScale
  const visibleHeight = visibleWidth / (350 / 198)
  return {
    width: Math.min(92, visibleWidth / sourceWidth * 100),
    height: Math.min(92, visibleHeight / sourceHeight * 100),
  }
}

function clampFocus(focus: ProjectCoverFocus, crop: { width: number; height: number }): ProjectCoverFocus {
  return {
    x: Number(Math.min(100 - crop.width / 2, Math.max(crop.width / 2, focus.x)).toFixed(2)),
    y: Number(Math.min(100 - crop.height / 2, Math.max(crop.height / 2, focus.y)).toFixed(2)),
  }
}
