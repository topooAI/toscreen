import { Button } from "../ui/button";
import {
  PiPauseBold,
  PiPlayBold,
  PiSkipBackBold,
  PiSkipForwardBold,
} from "react-icons/pi";

interface PlaybackControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onTogglePlayPause: () => void;
  onSeek: (time: number) => void;
}

export default function PlaybackControls({
  isPlaying,
  currentTime,
  duration,
  onTogglePlayPause,
  onSeek,
}: PlaybackControlsProps) {
  function formatTime(seconds: number) {
    if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  const handlePrevFrame = () => {
    onSeek(Math.max(0, currentTime - 0.1));
  };

  const handleNextFrame = () => {
    onSeek(Math.min(duration, currentTime + 0.1));
  };

  return (
    <div className="flex items-center gap-2 bg-transparent select-none">
      {/* Current Time */}
      <span className="text-xs font-medium text-[var(--ui-text-secondary)] tabular-nums min-w-[40px] text-right">
        {formatTime(currentTime)}
      </span>
      
      {/* Controls Button Group */}
      <div className="flex items-center gap-1">
        {/* Previous Frame / Skip Back */}
        <Button
          onClick={handlePrevFrame}
          variant="ghost"
          size="icon"
          className="w-7 h-7 rounded-[5px] text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-control-hover)] active:bg-[var(--ui-border)] active:scale-[0.96] transition-[color,background-color,transform] duration-150"
          aria-label="Previous frame"
        >
          <PiSkipBackBold className="h-3.5 w-3.5" />
        </Button>

        {/* Play/Pause Trigger */}
        <Button
          onClick={onTogglePlayPause}
          variant="ghost"
          size="icon"
          className="w-7 h-7 rounded-[5px] bg-transparent text-[var(--ui-text-secondary)] hover:bg-[var(--ui-control-hover)] hover:text-[var(--ui-text-primary)] active:bg-[var(--ui-border)] active:scale-[0.96] transition-[color,background-color,transform] duration-150"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <PiPauseBold className="h-3.5 w-3.5" />
          ) : (
            <PiPlayBold className="h-3.5 w-3.5" />
          )}
        </Button>

        {/* Next Frame / Skip Forward */}
        <Button
          onClick={handleNextFrame}
          variant="ghost"
          size="icon"
          className="w-7 h-7 rounded-[5px] text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-control-hover)] active:bg-[var(--ui-border)] active:scale-[0.96] transition-[color,background-color,transform] duration-150"
          aria-label="Next frame"
        >
          <PiSkipForwardBold className="h-3.5 w-3.5" />
        </Button>
      </div>
      
      {/* Total Duration */}
      <span className="text-xs font-medium text-[var(--ui-text-secondary)] tabular-nums min-w-[40px] text-left">
        {formatTime(duration)}
      </span>
    </div>
  );
}
