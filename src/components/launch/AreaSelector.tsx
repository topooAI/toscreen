import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { clampSelection, selectionToGlobalBounds, type Rectangle } from './recordingGeometry'
import styles from './LaunchWindow.module.css'

export function AreaSelector({ onApply }: { onApply: (source: ProcessedDesktopSource, bounds: Rectangle) => void }) {
  const [screens, setScreens] = useState<ProcessedDesktopSource[]>([])
  const [selected, setSelected] = useState<ProcessedDesktopSource | null>(null)
  const [displayBounds, setDisplayBounds] = useState<Rectangle | null>(null)
  const [selection, setSelection] = useState<Rectangle>({ x: 40, y: 30, width: 240, height: 135 })
  const previewRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ mode: 'move' | 'resize'; x: number; y: number; initial: Rectangle } | null>(null)

  useEffect(() => { void window.electronAPI.getSources({ types: ['screen'], thumbnailSize: { width: 640, height: 360 } }).then(items => { setScreens(items); setSelected(items[0] || null) }) }, [])
  useEffect(() => { if (selected) void window.electronAPI.getDisplayBounds(selected.display_id).then(setDisplayBounds) }, [selected])

  const pointerDown = (event: PointerEvent, mode: 'move' | 'resize') => {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { mode, x: event.clientX, y: event.clientY, initial: selection }
  }
  const pointerMove = (event: PointerEvent) => {
    if (!drag.current || !previewRef.current) return
    const dx = event.clientX - drag.current.x
    const dy = event.clientY - drag.current.y
    const next = drag.current.mode === 'move'
      ? { ...drag.current.initial, x: drag.current.initial.x + dx, y: drag.current.initial.y + dy }
      : { ...drag.current.initial, width: drag.current.initial.width + dx, height: drag.current.initial.height + dy }
    setSelection(clampSelection(next, { x: 0, y: 0, width: previewRef.current.clientWidth, height: previewRef.current.clientHeight }))
  }
  const apply = () => {
    if (!selected || !displayBounds || !previewRef.current) return
    onApply(selected, selectionToGlobalBounds(selection, { x: 0, y: 0, width: previewRef.current.clientWidth, height: previewRef.current.clientHeight }, displayBounds))
  }

  return <div className={styles.areaSelector}>
    <select value={selected?.id || ''} onChange={event => setSelected(screens.find(item => item.id === event.target.value) || null)}>{screens.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
    <div ref={previewRef} className={styles.areaPreview} style={{ backgroundImage: selected?.thumbnail ? `url(${selected.thumbnail})` : undefined }}>
      <div className={styles.areaShade} />
      <div className={styles.areaSelection} style={{ left: selection.x, top: selection.y, width: selection.width, height: selection.height }} onPointerDown={event => pointerDown(event, 'move')} onPointerMove={pointerMove} onPointerUp={() => { drag.current = null }}>
        <i onPointerDown={event => { event.stopPropagation(); pointerDown(event, 'resize') }} onPointerMove={pointerMove} onPointerUp={() => { drag.current = null }} />
      </div>
    </div>
    <button onClick={apply}>Use selected area</button>
  </div>
}
