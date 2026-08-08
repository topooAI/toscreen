import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { FolderOpen, MoreHorizontal, Search, Trash2, Video, X } from 'lucide-react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { TopooUserPill } from '@/components/video-editor/TopooUserPill'
import { ImportVideoMorphIcon, ImportPackageMorphIcon, NewRecordingMorphIcon } from '@/components/common/MorphIcon'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { locateProjectCoverImage, type ProjectCoverFocus } from './projectCoverFocus'
import { getProjectCoverDetailScale, getProjectCoverImagePlacement } from './projectCoverScale'
import styles from './ProjectHome.module.css'

interface RecentProject {
  id: string; name: string; projectPath: string; thumbnailPath?: string; updatedAt: string
  thumbnailSourceWidth?: number; thumbnailSourceHeight?: number
  durationMs: number; assetStatus: 'ready' | 'missing' | 'missing-project' | 'corrupt' | 'recovered'; missingAssets: string[]
}

export function ProjectHome() {
  const [hoveredButton, setHoveredButton] = useState<'video' | 'package' | 'record' | null>(null)
  const [projects, setProjects] = useState<RecentProject[]>([])
  const [coverFocus, setCoverFocus] = useState<Record<string, ProjectCoverFocus>>({})
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'updated' | 'name' | 'duration'>('updated')
  const refresh = useCallback(async () => { const result = await window.electronAPI.listRecentProjects(); if (result.success) setProjects(result.projects) }, [])
  useEffect(() => {
    void refresh()
    return window.electronAPI.onProjectCoversUpdated(() => { void refresh() })
  }, [refresh])
  const visible = useMemo(() => [...projects].filter(item => item.name.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'duration' ? b.durationMs - a.durationMs : +new Date(b.updatedAt) - +new Date(a.updatedAt)), [projects, query, sort])
  const open = async (projectPath: string) => { try { const result = await window.electronAPI.openProject(projectPath); if (!result.success) throw new Error(result.error); await window.electronAPI.switchToEditor() } catch (error) { toast.error('Unable to open project', { description: String(error) }); void refresh() } }
  const importPackage = async () => { try { const result = await window.electronAPI.importProjectPackage(); if (result.success) { toast.success('Portable project imported'); await window.electronAPI.switchToEditor() } } catch (error) { toast.error('Package validation failed', { description: String(error) }) } }
  const importVideo = async () => { const result = await window.electronAPI.openVideoFilePicker(); if (result.success && result.path) { await window.electronAPI.newProject(); await window.electronAPI.setCurrentVideoPath(result.path); await window.electronAPI.switchToEditor() } }
  return <main className={styles.home}>
    <Toaster />
    <header className={styles.titlebar}>
      <div className={styles.account}><TopooUserPill /></div>
    </header>
    <div className={styles.workspace}>
      <div className={styles.content}>
      <div className={styles.pageHeader}>
        <section className={styles.hero}><h1>Your projects</h1></section>
        <div className={styles.pageActions}>
          <button
            onMouseEnter={() => setHoveredButton('video')}
            onMouseLeave={() => setHoveredButton(null)}
            onClick={() => void importVideo()}
          >
            <ImportVideoMorphIcon isHovered={hoveredButton === 'video'} />Import video
          </button>
          <button
            onMouseEnter={() => setHoveredButton('package')}
            onMouseLeave={() => setHoveredButton(null)}
            onClick={() => void importPackage()}
          >
            <ImportPackageMorphIcon isHovered={hoveredButton === 'package'} />Import package
          </button>
          <button
            className={styles.primaryAction}
            onMouseEnter={() => setHoveredButton('record')}
            onMouseLeave={() => setHoveredButton(null)}
            onClick={async () => { await window.electronAPI.newProject(); await window.electronAPI.showRecorder() }}
          >
            <NewRecordingMorphIcon isHovered={hoveredButton === 'record'} />New recording
          </button>
        </div>
      </div>
      <div className={styles.tools}>
        <label><Search size={16}/><input aria-label="Search projects" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search projects"/></label>
        <Select value={sort} onValueChange={(val) => setSort(val as typeof sort)}>
          <SelectTrigger aria-label="Sort projects" className="h-[36px] w-[135px] shrink-0 rounded-[9px] border border-[#d8d8d5] bg-white px-3 text-[12.5px] font-medium text-neutral-800 shadow-none hover:bg-neutral-50 focus:ring-0 focus:ring-offset-0 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
            <SelectValue placeholder="Sort projects" />
          </SelectTrigger>
          <SelectContent className="toscreen-dropdown-menu z-[220] min-w-[135px] rounded-[8px] border-0 p-[3px] shadow-xl">
            <SelectItem indicatorPosition="right" className="h-[26px] rounded-[5px] pl-2 pr-6 text-[12px] font-medium" value="updated">Last updated</SelectItem>
            <SelectItem indicatorPosition="right" className="h-[26px] rounded-[5px] pl-2 pr-6 text-[12px] font-medium" value="name">Name</SelectItem>
            <SelectItem indicatorPosition="right" className="h-[26px] rounded-[5px] pl-2 pr-6 text-[12px] font-medium" value="duration">Duration</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {visible.length === 0 ? <div className={styles.empty}><FolderOpen/><h2>No projects yet</h2><p>Record your screen or import a portable ToScreen package.</p></div> : <div className={styles.grid}>{visible.map(project => <article key={project.projectPath} className={styles.card} data-status={project.assetStatus} data-has-cover={project.thumbnailPath ? 'true' : 'false'} data-camera={getCameraDirection(project.id)}>
        <button className={styles.preview} onClick={() => void open(project.projectPath)}>
          {project.thumbnailPath
            ? <div className={styles.coverStage} style={getProjectCoverStyle(project, coverFocus[project.id])}>
                <span className={styles.coverScene}>
                  <span className={`${styles.coverPlane} ${styles.coverLensFocus}`}><img src={toFileUrl(project.thumbnailPath)} alt="" onLoad={event => {
                    if (!project.thumbnailSourceWidth || !project.thumbnailSourceHeight) return
                    const focus = locateProjectCoverImage(event.currentTarget, getFallbackCoverFocus(project.id))
                    if (focus) setCoverFocus(previous => ({ ...previous, [project.id]: focus }))
                  }} /></span>
                </span>
                <span className={styles.coverDepthBlur} aria-hidden="true" />
              </div>
            : <div className={styles.coverFallback} style={{ background: getMorandiGradient(project.name) }}><Video size={31} /></div>}
          <span className={styles.duration}>{formatDuration(project.durationMs)}</span>
        </button>
        <div className={styles.meta}><h2>{project.name}</h2><p>{new Date(project.updatedAt).toLocaleString()}</p>{project.assetStatus !== 'ready' && <em>{project.assetStatus === 'recovered' ? 'Recovered from backup' : project.assetStatus === 'missing' ? `${project.missingAssets.length} missing asset${project.missingAssets.length === 1 ? '' : 's'}` : project.assetStatus === 'missing-project' ? 'Project file moved or missing' : 'Project file is damaged'}</em>}</div>
        {project.assetStatus === 'missing' && <button className={styles.relink} onClick={async () => { const result = await window.electronAPI.relinkProjectAsset(project.projectPath, project.missingAssets[0]); if (result.success) { toast.success('Media relinked'); void refresh() } }}>Relink</button>}
        <DropdownMenu>
          <DropdownMenuTrigger asChild><button aria-label={`More actions for ${project.name}`} className={styles.more}><MoreHorizontal size={15}/></button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="toscreen-dropdown-menu z-[220] min-w-[160px] rounded-[8px] border-0 p-[3px] shadow-xl">
            <DropdownMenuItem className="h-[26px] rounded-[5px] pl-2 pr-2 text-[12px] font-medium" onSelect={async () => { await window.electronAPI.removeRecentProject(project.projectPath); void refresh() }}>
              <X size={13} strokeWidth={1.5} className="mr-[5.5px] text-neutral-500 shrink-0" />Remove from recent
            </DropdownMenuItem>
            <DropdownMenuItem className="h-[26px] rounded-[5px] pl-2 pr-2 text-[12px] font-medium text-red-500 focus:text-red-500" onSelect={async () => { const result = await window.electronAPI.deleteProject(project.projectPath, false); if (result.success) { toast.success('Project deleted; source media kept'); void refresh() } }}>
              <Trash2 size={13} strokeWidth={1.5} className="mr-[5.5px] text-red-500 shrink-0" />Delete project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </article>)}</div>}
      </div>
    </div>
  </main>
}
function formatDuration(ms: number) { const total = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}` }
function toFileUrl(filePath: string) { return encodeURI(`file://${filePath}`) }
function getCameraDirection(id: string) { let hash = 0; for (const character of id) hash = ((hash << 5) - hash) + character.charCodeAt(0); return String(Math.abs(hash) % 3) }
function getFallbackCoverFocus(id: string): ProjectCoverFocus { const direction = getCameraDirection(id); return direction === '1' ? { x: 52, y: 42 } : direction === '2' ? { x: 63, y: 50 } : { x: 50, y: 44 } }
function getProjectCoverStyle(project: RecentProject, detectedFocus?: ProjectCoverFocus): CSSProperties {
  const focus = detectedFocus || getFallbackCoverFocus(project.id)
  const scale = getProjectCoverDetailScale(project.thumbnailSourceWidth)
  const placement = getProjectCoverImagePlacement(scale, focus)
  return {
    '--focus-x': `${focus.x}%`,
    '--focus-y': `${focus.y}%`,
    '--cover-image-size': `${placement.sizePercent}%`,
    '--cover-image-left': `${placement.leftPercent}%`,
    '--cover-image-top': `${placement.topPercent}%`,
  } as CSSProperties
}

const morandiPalettes = [
  { from: '#e0c3fc', to: '#8ec5fc' }, // 粉紫-冰蓝
  { from: '#fbc2eb', to: '#a6c1ee' }, // 柔粉-淡蓝
  { from: '#fdcbf1', to: '#e6dee9' }, // 藕粉-暖灰
  { from: '#a1c4fd', to: '#c2e9fb' }, // 天蓝-浅蓝
  { from: '#d4fc79', to: '#96e6a1' }, // 浅绿-薄荷绿
  { from: '#f5f7fa', to: '#c3cfe2' }, // 银灰-雾霾蓝
  { from: '#e0f7fa', to: '#80deea' }, // 碧蓝-水绿
  { from: '#f3e5f5', to: '#e1bee7' }, // 极浅紫-淡紫
];

function getMorandiGradient(name: string | undefined | null) {
  const safeName = name || 'Untitled Project';
  let hash = 0;
  for (let i = 0; i < safeName.length; i++) {
    hash = safeName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % morandiPalettes.length;
  const palette = morandiPalettes[index];
  return `linear-gradient(135deg, ${palette.from} 0%, ${palette.to} 100%)`;
}
