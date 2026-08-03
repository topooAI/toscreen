export type ExportQueueStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export interface ExportQueueItem { id: string; projectPath?: string; projectId: string; format: 'mp4' | 'gif'; width: number; height: number; quality: string; status: ExportQueueStatus; progress: number; outputDirectory?: string; error?: string; attempts: number }
export interface QueueSnapshot { version: 1; items: ExportQueueItem[] }

export class SerialExportQueue {
  private items: ExportQueueItem[]; private active: AbortController | null = null; private stopped = false;
  constructor(items: ExportQueueItem[] = [], private persist: (snapshot: QueueSnapshot) => void = () => {}) { this.items = items.map(item => item.status === 'running' ? { ...item, status: 'queued', progress: 0 } : item); }
  snapshot(): QueueSnapshot { return { version: 1, items: this.items.map(item => ({ ...item })) }; }
  add(items: Omit<ExportQueueItem, 'status' | 'progress' | 'attempts'>[]) { this.items.push(...items.map(item => ({ ...item, status: 'queued' as const, progress: 0, attempts: 0 }))); this.save(); }
  cancelCurrent() { this.active?.abort(); }
  cancelRemaining() { this.items = this.items.map(item => item.status === 'queued' ? { ...item, status: 'cancelled' } : item); this.save(); }
  retry(id: string) { this.items = this.items.map(item => item.id === id && item.status === 'failed' ? { ...item, status: 'queued', progress: 0, error: undefined } : item); this.save(); }
  async run(worker: (item: ExportQueueItem, signal: AbortSignal, progress: (value: number) => void) => Promise<void>) {
    this.stopped = false;
    while (!this.stopped) {
      const index = this.items.findIndex(item => item.status === 'queued'); if (index < 0) break;
      this.active = new AbortController(); this.items[index] = { ...this.items[index], status: 'running', attempts: this.items[index].attempts + 1 }; this.save();
      try { await worker({ ...this.items[index] }, this.active.signal, value => { this.items[index] = { ...this.items[index], progress: Math.max(0, Math.min(100, value)) }; this.save(); }); this.items[index] = { ...this.items[index], status: 'completed', progress: 100 }; }
      catch (error) { this.items[index] = { ...this.items[index], status: this.active.signal.aborted ? 'cancelled' : 'failed', error: String(error) }; }
      finally { this.active = null; this.save(); }
    }
  }
  stop() { this.stopped = true; this.cancelCurrent(); }
  private save() { this.persist(this.snapshot()); }
}

export function restoreQueue(raw: string | null): ExportQueueItem[] { try { const parsed = JSON.parse(raw ?? '') as QueueSnapshot; return parsed.version === 1 && Array.isArray(parsed.items) ? parsed.items : []; } catch { return []; } }
