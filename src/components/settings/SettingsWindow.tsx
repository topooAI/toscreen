import { useRef, useState, type ReactNode } from 'react'
import {
  Check,
  Download,
  Keyboard,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  loadEditorPreferences,
  resetEditorPreferences,
  saveEditorPreferences,
  type EditorPreferences,
  type SettingsPane,
} from '@/lib/editorPreferences'

const PANES: Array<{
  id: SettingsPane
  label: string
  icon: typeof Settings2
}> = [
  { id: 'general', label: 'General', icon: Settings2 },
  { id: 'editing', label: 'Editing', icon: SlidersHorizontal },
  { id: 'export', label: 'Export', icon: Download },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
]

const ASPECT_RATIOS: EditorPreferences['aspectRatio'][] = ['16:9', '9:16', '1:1', '4:3', '4:5']
const EXPORT_QUALITIES: Array<{
  value: EditorPreferences['exportQuality']
  label: string
  description: string
}> = [
  { value: 'medium', label: 'Medium', description: 'Smaller file' },
  { value: 'good', label: 'Good', description: 'Balanced' },
  { value: 'source', label: 'Source', description: 'Highest quality' },
]

function SettingRow({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-[64px] items-center justify-between gap-8 border-b border-[var(--ui-border)] px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-[var(--ui-text-primary)]">{title}</div>
        {description && (
          <div className="mt-1 max-w-[300px] text-[11px] leading-4 text-[var(--ui-text-tertiary)]">{description}</div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function SegmentedButton<T extends string>({
  items,
  value,
  onChange,
}: {
  items: Array<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--ui-border-strong)] bg-[var(--ui-control)] p-0.5">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={`h-7 rounded-md px-3 text-[11px] transition-colors ${
            value === item.value
              ? 'bg-[var(--ui-segment-selected)] text-[var(--ui-segment-selected-text)] shadow-sm'
              : 'text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)]'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export function SettingsWindow() {
  const [preferences, setPreferences] = useState(loadEditorPreferences)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveVersionRef = useRef(0)

  const persist = async (next: EditorPreferences) => {
    const version = ++saveVersionRef.current
    setSaveState('saving')
    try {
      const saved = await saveEditorPreferences(next)
      if (saveVersionRef.current === version) {
        setPreferences(saved)
        setSaveState('saved')
      }
    } catch {
      if (saveVersionRef.current === version) setSaveState('error')
    }
  }

  const updatePreferences = (patch: Partial<EditorPreferences>) => {
    const next = { ...preferences, ...patch }
    setPreferences(next)
    void persist(next)
  }

  const selectPane = (pane: SettingsPane) => {
    if (pane === preferences.lastSettingsPane) return
    updatePreferences({ lastSettingsPane: pane })
  }

  const handleReset = async () => {
    const version = ++saveVersionRef.current
    setSaveState('saving')
    try {
      const reset = await resetEditorPreferences()
      if (saveVersionRef.current === version) {
        setPreferences({ ...reset, lastSettingsPane: 'general' })
        setSaveState('saved')
      }
    } catch {
      if (saveVersionRef.current === version) setSaveState('error')
    }
  }

  const activePane = preferences.lastSettingsPane
  const activePaneLabel = PANES.find((pane) => pane.id === activePane)?.label ?? 'Settings'

  return (
    <main className="h-screen overflow-hidden bg-[var(--ui-bg)] text-[var(--ui-text-primary)]">
      <div
        className="flex h-10 items-center justify-center border-b border-[var(--ui-border)] bg-[var(--ui-panel)] text-[12px] font-medium text-[var(--ui-text-secondary)]"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {activePaneLabel}
      </div>

      <div className="flex h-[calc(100vh-40px)]">
        <nav className="w-[166px] shrink-0 border-r border-[var(--ui-border)] bg-[var(--ui-panel)] px-2.5 py-3">
          <div className="space-y-1">
            {PANES.map((pane) => {
              const Icon = pane.icon
              const selected = pane.id === activePane
              return (
                <button
                  key={pane.id}
                  type="button"
                  onClick={() => selectPane(pane.id)}
                  className={`flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[12px] transition-colors ${
                    selected
                      ? 'bg-[#34B27B]/16 text-[#65d6a4]'
                      : 'text-[var(--ui-text-secondary)] hover:bg-[var(--ui-control)] hover:text-[var(--ui-text-primary)]'
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                  <span>{pane.label}</span>
                </button>
              )
            })}
          </div>

          <div className="absolute bottom-4 left-4 flex items-center gap-1.5 text-[10px] text-[var(--ui-text-tertiary)]">
            {saveState === 'saving' && <span>Saving…</span>}
            {saveState === 'saved' && <><Check className="h-3 w-3 text-[#34B27B]" /> Saved</>}
            {saveState === 'error' && <span className="text-red-400">Could not save</span>}
          </div>
        </nav>

        <section className="min-w-0 flex-1 overflow-y-auto px-7 py-6">
          {activePane === 'general' && (
            <div>
              <h1 className="text-[18px] font-semibold tracking-tight">General</h1>
              <p className="mt-1.5 text-[12px] leading-5 text-[var(--ui-text-secondary)]">
                These defaults are used when ToScreen creates a new project. Existing projects keep their saved settings.
              </p>

              <div className="ui-glass-surface mt-6 overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)]">
                <SettingRow
                  title="Appearance"
                  description="Switch the complete ToScreen interface without changing video output."
                >
                  <SegmentedButton
                    items={[
                      { value: 'light', label: 'Light' },
                      { value: 'dark', label: 'Dark' },
                    ]}
                    value={preferences.theme}
                    onChange={(theme) => updatePreferences({ theme })}
                  />
                </SettingRow>
                <SettingRow
                  title="New project defaults"
                  description="Restore the canvas, cursor, and export defaults that ship with ToScreen."
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleReset()}
                    className="border-[var(--ui-border-strong)] bg-[var(--ui-control)] text-[var(--ui-text-primary)] hover:bg-[var(--ui-control-hover)] hover:text-[var(--ui-text-primary)]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset Defaults
                  </Button>
                </SettingRow>
              </div>
            </div>
          )}

          {activePane === 'editing' && (
            <div>
              <h1 className="text-[18px] font-semibold tracking-tight">Editing</h1>
              <p className="mt-1.5 text-[12px] leading-5 text-[var(--ui-text-secondary)]">Choose how a newly recorded project starts.</p>

              <div className="ui-glass-surface mt-6 overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)]">
                <SettingRow title="Canvas ratio" description="Default output frame for new projects.">
                  <SegmentedButton
                    items={ASPECT_RATIOS.map((ratio) => ({ value: ratio, label: ratio }))}
                    value={preferences.aspectRatio}
                    onChange={(aspectRatio) => updatePreferences({ aspectRatio })}
                  />
                </SettingRow>

                <SettingRow title="Cursor style" description="Use ToScreen's clean cursor or preserve the recorded system cursor.">
                  <SegmentedButton
                    items={[
                      { value: 'toscreen', label: 'ToScreen' },
                      { value: 'system', label: 'System' },
                    ]}
                    value={preferences.cursorStyle === 'system' ? 'system' : 'toscreen'}
                    onChange={(value) => updatePreferences({
                      showVectorCursor: value === 'toscreen',
                      cursorStyle: value === 'toscreen' ? 'toscreen' : 'system',
                    })}
                  />
                </SettingRow>

                <SettingRow title="Cursor size" description={`${preferences.cursorSize.toFixed(1)}× in new projects.`}>
                  <Slider
                    className="w-[170px]"
                    min={0.5}
                    max={3}
                    step={0.1}
                    value={[preferences.cursorSize]}
                    onValueChange={([cursorSize]) => updatePreferences({ cursorSize })}
                  />
                </SettingRow>

                <SettingRow title="Smooth cursor movement" description="Interpolate recorded pointer movement.">
                  <Switch
                    checked={preferences.cursorSmoothing}
                    onCheckedChange={(cursorSmoothing) => updatePreferences({ cursorSmoothing })}
                  />
                </SettingRow>

                <SettingRow title="Motion blur" description="Add subtle blur during animated zoom movement.">
                  <Switch
                    checked={preferences.motionBlurEnabled}
                    onCheckedChange={(motionBlurEnabled) => updatePreferences({ motionBlurEnabled })}
                  />
                </SettingRow>
              </div>
            </div>
          )}

          {activePane === 'export' && (
            <div>
              <h1 className="text-[18px] font-semibold tracking-tight">Export</h1>
              <p className="mt-1.5 text-[12px] leading-5 text-[var(--ui-text-secondary)]">Set the initial export quality for new projects.</p>

              <div className="ui-glass-surface mt-6 overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)]">
                {EXPORT_QUALITIES.map((quality) => (
                  <button
                    key={quality.value}
                    type="button"
                    onClick={() => updatePreferences({ exportQuality: quality.value })}
                    className="flex min-h-[62px] w-full items-center gap-3 border-b border-[var(--ui-border)] px-4 text-left last:border-b-0 hover:bg-[var(--ui-control)]"
                  >
                    <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                      preferences.exportQuality === quality.value
                        ? 'border-[#34B27B] bg-[#34B27B]'
                        : 'border-[var(--ui-border-strong)]'
                    }`}>
                      {preferences.exportQuality === quality.value && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>
                    <span>
                      <span className="block text-[13px] font-medium text-[var(--ui-text-primary)]">{quality.label}</span>
                      <span className="mt-0.5 block text-[11px] text-[var(--ui-text-tertiary)]">{quality.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activePane === 'shortcuts' && (
            <div>
              <h1 className="text-[18px] font-semibold tracking-tight">Shortcuts</h1>
              <p className="mt-1.5 text-[12px] leading-5 text-[var(--ui-text-secondary)]">Standard macOS shortcuts available throughout ToScreen.</p>

              <div className="ui-glass-surface mt-6 overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)]">
                {[
                  ['Open Settings', '⌘,'],
                  ['Close Window', '⌘W'],
                  ['Hide ToScreen', '⌘H'],
                  ['Quit ToScreen', '⌘Q'],
                ].map(([label, shortcut]) => (
                  <div key={label} className="flex h-[52px] items-center justify-between border-b border-[var(--ui-border)] px-4 last:border-b-0">
                    <span className="text-[13px] text-[var(--ui-text-primary)]">{label}</span>
                    <kbd className="min-w-9 rounded-md border border-[var(--ui-border-strong)] bg-[var(--ui-control)] px-2 py-1 text-center font-mono text-[11px] text-[var(--ui-text-secondary)]">
                      {shortcut}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
