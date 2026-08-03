import { useEffect, useState } from 'react';
import { Check, Download, Loader2, X } from 'lucide-react';
import { Button } from "../ui/button";
import type { ExportProgress, ExportQuality } from '../../lib/exporter';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  progress: ExportProgress | null;
  isExporting: boolean;
  error: string | null;
  quality: ExportQuality;
  onQualityChange: (quality: ExportQuality) => void;
  onStart: () => void;
  onCancel?: () => void;
}

const QUALITY_OPTIONS: Array<{ value: ExportQuality; label: string; description: string }> = [
  { value: 'medium', label: 'Medium', description: '720p' },
  { value: 'good', label: 'Good', description: '1080p' },
  { value: 'source', label: 'High', description: 'Source' },
];

export function ExportDialog({
  isOpen,
  onClose,
  progress,
  isExporting,
  error,
  quality,
  onQualityChange,
  onStart,
  onCancel,
}: ExportDialogProps) {
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!isExporting && progress && progress.percentage >= 100 && !error) {
      setShowSuccess(true);
      const timer = setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isExporting, progress, error, onClose]);

  useEffect(() => {
    if (!isOpen) setShowSuccess(false);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={isExporting ? undefined : onClose}
      />
      <div className="ui-glass-surface fixed left-1/2 top-1/2 z-[60] w-[380px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-[var(--ui-border)] bg-[var(--ui-inspector-surface)] shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="flex h-11 items-center justify-between border-b border-[var(--ui-border)] px-4">
          <span className="text-[12px] font-semibold text-[var(--ui-text-primary)]">
            {showSuccess ? 'Export Complete' : isExporting ? 'Exporting Video' : 'Export Video'}
          </span>
          {!isExporting && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-7 w-7 rounded-[5px] text-[var(--ui-text-tertiary)] hover:bg-[var(--ui-control-hover)] hover:text-[var(--ui-text-primary)]"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <div className="p-4">
          {showSuccess ? (
            <div className="flex min-h-[150px] flex-col items-center justify-center text-center">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#34B27B]/12 text-[#34B27B]">
                <Check className="h-4 w-4" />
              </div>
              <div className="text-[12px] font-medium text-[var(--ui-text-primary)]">Video saved successfully</div>
              <div className="mt-1 text-[10px] text-[var(--ui-text-tertiary)]">Your exported file is ready.</div>
            </div>
          ) : isExporting ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-[#0D99FF]" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-[10px] text-[var(--ui-text-secondary)]">
                    <span>Processing</span>
                    <span className="tabular-nums text-[var(--ui-text-primary)]">{(progress?.percentage ?? 0).toFixed(0)}%</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--ui-control)]">
                    <div
                      className="h-full rounded-full bg-[#0D99FF] transition-[width] duration-300"
                      style={{ width: `${Math.min(progress?.percentage ?? 0, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
              {onCancel && (
                <Button
                  onClick={onCancel}
                  variant="outline"
                  className="h-8 w-full rounded-[5px] border-[var(--ui-border)] bg-[var(--ui-control)] text-[10px] text-[var(--ui-text-secondary)] hover:bg-[var(--ui-control-hover)] hover:text-[var(--ui-text-primary)]"
                >
                  Cancel Export
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <section>
                <div className="mb-2 text-[10px] font-medium text-[var(--ui-text-secondary)]">Quality</div>
                <div className="grid grid-cols-3 gap-1 rounded-[6px] bg-[var(--ui-control)] p-0.5">
                  {QUALITY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onQualityChange(option.value)}
                      className={`rounded-[4px] px-2 py-2 text-center transition-colors ${
                        quality === option.value
                          ? 'bg-[var(--ui-segment-selected)] text-[var(--ui-segment-selected-text)] shadow-sm'
                          : 'text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)]'
                      }`}
                    >
                      <span className="block text-[10px] font-medium">{option.label}</span>
                      <span className="mt-0.5 block text-[8px] opacity-60">{option.description}</span>
                    </button>
                  ))}
                </div>
              </section>

              {error && (
                <div className="rounded-[5px] border border-red-500/15 bg-red-500/8 px-3 py-2 text-[10px] text-red-500">
                  {error}
                </div>
              )}

              <Button
                onClick={onStart}
                className="h-8 w-full gap-2 rounded-[5px] bg-[#0D99FF] text-[11px] font-semibold text-white hover:bg-[#0B87E3]"
              >
                <Download className="h-3.5 w-3.5" />
                Export Video
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
