import { useState } from 'react';
import TimelineEditor from './TimelineEditor';
import { useEditingSession } from '../hooks/useEditingSession';

export default function EditingRuntimeAudit() {
  const editingSession = useEditingSession(10_000);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(2.5);
  return (
    <div className="h-screen w-screen bg-[var(--ui-timeline-card-surface)] p-4" data-testid="editing-runtime-audit" tabIndex={0}>
      <TimelineEditor
        editingSession={editingSession}
        videoDuration={editingSession.timeMap.effectiveDurationMs / 1000 || 10}
        sourceVideoDuration={10}
        currentTime={currentTime}
        onSeek={setCurrentTime}
        zoomRegions={[]}
        onZoomAdded={() => {}}
        onZoomSpanChange={() => {}}
        onZoomDelete={() => {}}
        selectedZoomId={null}
        onSelectZoom={() => {}}
        selectedVideoId={selectedVideoId}
        onSelectVideo={setSelectedVideoId}
        isFullScreenBinding
        onFullScreenBindingChange={() => {}}
        isPlaying={false}
        onTogglePlayPause={() => {}}
      />
    </div>
  );
}
