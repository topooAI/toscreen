import { useEffect, useMemo, useState } from 'react'
import { FileVideo, FolderOpen, PackageOpen, Search, Trash2, Video, X } from 'lucide-react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import styles from './ProjectHome.module.css'

interface RecentProject {
  id: string; name: string; projectPath: string; thumbnailPath?: string; updatedAt: string
  durationMs: number; assetStatus: 'ready' | 'missing' | 'missing-project' | 'corrupt' | 'recovered'; missingAssets: string[]
}

export function ProjectHome() {
  const [projects, setProjects] = useState<RecentProject[]>([])
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'updated' | 'name' | 'duration'>('updated')
  const refresh = async () => { const result = await window.electronAPI.listRecentProjects(); if (result.success) setProjects(result.projects) }
  useEffect(() => { void refresh() }, [])
  const visible = useMemo(() => [...projects].filter(item => item.name.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'duration' ? b.durationMs - a.durationMs : +new Date(b.updatedAt) - +new Date(a.updatedAt)), [projects, query, sort])
  const open = async (projectPath: string) => { try { const result = await window.electronAPI.openProject(projectPath); if (!result.success) throw new Error(result.error); await window.electronAPI.switchToEditor() } catch (error) { toast.error('Unable to open project', { description: String(error) }); void refresh() } }
  const importPackage = async () => { try { const result = await window.electronAPI.importProjectPackage(); if (result.success) { toast.success('Portable project imported'); await window.electronAPI.switchToEditor() } } catch (error) { toast.error('Package validation failed', { description: String(error) }) } }
  const importVideo = async () => { const result = await window.electronAPI.openVideoFilePicker(); if (result.success && result.path) { await window.electronAPI.newProject(); await window.electronAPI.setCurrentVideoPath(result.path); await window.electronAPI.switchToEditor() } }
  return <main className={styles.home}>
    <Toaster />
    <header><div><b>ToScreen</b><span>Projects</span></div><button onClick={async () => { await window.electronAPI.newProject(); await window.electronAPI.showRecorder() }}><Video size={17}/>New recording</button><button onClick={() => void importVideo()}><FileVideo size={17}/>Import video</button><button onClick={() => void importPackage()}><PackageOpen size={17}/>Import package</button></header>
    <section className={styles.hero}><h1>Your projects</h1><p>Continue editing, relink missing media, or start something new.</p></section>
    <div className={styles.tools}><label><Search size={16}/><input aria-label="Search projects" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search projects"/></label><select aria-label="Sort projects" value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="updated">Last updated</option><option value="name">Name</option><option value="duration">Duration</option></select></div>
    {visible.length === 0 ? <div className={styles.empty}><FolderOpen/><h2>No projects yet</h2><p>Record your screen or import a portable ToScreen package.</p></div> : <div className={styles.grid}>{visible.map(project => <article key={project.projectPath} className={styles.card} data-status={project.assetStatus}>
      <button className={styles.preview} onClick={() => void open(project.projectPath)}>{project.thumbnailPath ? <img src={`file://${project.thumbnailPath}`} /> : <Video/>}<span>{formatDuration(project.durationMs)}</span></button>
      <div className={styles.meta}><h2>{project.name}</h2><p>{new Date(project.updatedAt).toLocaleString()}</p><em>{project.assetStatus === 'ready' ? 'All media ready' : project.assetStatus === 'recovered' ? 'Recovered from backup' : project.assetStatus === 'missing' ? `${project.missingAssets.length} missing asset${project.missingAssets.length === 1 ? '' : 's'}` : project.assetStatus === 'missing-project' ? 'Project file moved or missing' : 'Project file is damaged'}</em></div>
      {project.assetStatus === 'missing' && <button className={styles.relink} onClick={async () => { const result = await window.electronAPI.relinkProjectAsset(project.projectPath, project.missingAssets[0]); if (result.success) { toast.success('Media relinked'); void refresh() } }}>Relink</button>}
      <button aria-label={`Remove ${project.name} from recent`} className={styles.icon} onClick={async () => { await window.electronAPI.removeRecentProject(project.projectPath); void refresh() }}><X size={15}/></button>
      <button aria-label={`Delete ${project.name}`} className={styles.icon} onClick={async () => { const result = await window.electronAPI.deleteProject(project.projectPath, false); if (result.success) { toast.success('Project deleted; source media kept'); void refresh() } }}><Trash2 size={15}/></button>
    </article>)}</div>}
  </main>
}
function formatDuration(ms: number) { const total = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}` }
