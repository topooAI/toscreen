import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { ProjectCoverFocus } from './projectCoverFocus'
import styles from './ProjectHome.module.css'

interface CoverProject {
  name: string
  projectPath: string
  thumbnailPath?: string
}

interface CoverEditorInfo {
  sourcePath: string
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

  const chooseFocus = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setFocus({
      x: Number(((event.clientX - rect.left) / rect.width * 100).toFixed(2)),
      y: Number(((event.clientY - rect.top) / rect.height * 100).toFixed(2)),
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
        <DialogDescription className={styles.coverEditorDescription}>Choose a frame, then click the point that should stay centered.</DialogDescription>
      </DialogHeader>
      {info ? <>
        <div className={styles.coverEditorPreview} onClick={chooseFocus}>
          <video
            ref={videoRef}
            src={toFileUrl(info.sourcePath)}
            muted
            playsInline
            preload="metadata"
            onLoadedMetadata={event => { event.currentTarget.currentTime = timeMs / 1000 }}
          />
          <span className={styles.coverEditorTarget} style={{ left: `${focus.x}%`, top: `${focus.y}%` }} />
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
