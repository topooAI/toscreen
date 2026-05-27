import { Button } from "../ui/button";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";

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
    <div className="flex items-center gap-10 bg-transparent select-none">
      {/* Current Time */}
      <span className="text-xs font-medium text-slate-500 tabular-nums min-w-[40px] text-right">
        {formatTime(currentTime)}
      </span>
      
      {/* Controls Button Group */}
      <div className="flex items-center gap-6">
        {/* Previous Frame / Skip Back */}
        <Button
          onClick={handlePrevFrame}
          variant="ghost"
          size="icon"
          className="w-5 h-5 text-slate-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
          aria-label="Previous frame"
        >
          <SkipBack className="w-2.5 h-2.5 text-slate-400" />
        </Button>

        {/* Play/Pause Trigger */}
        <Button
          onClick={onTogglePlayPause}
          variant="ghost"
          size="icon"
          className="w-8 h-8 text-white hover:text-white hover:bg-white/5 active:scale-95 transition-all"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-4.5 h-4.5 fill-current text-white" />
          ) : (
            <Play className="w-4.5 h-4.5 fill-current text-white ml-0.5" />
          )}
        </Button>

        {/* Next Frame / Skip Forward */}
        <Button
          onClick={handleNextFrame}
          variant="ghost"
          size="icon"
          className="w-5 h-5 text-slate-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
          aria-label="Next frame"
        >
          <SkipForward className="w-2.5 h-2.5 text-slate-400" />
        </Button>
      </div>
      
      {/* Total Duration */}
      <span className="text-xs font-medium text-slate-500 tabular-nums min-w-[40px] text-left">
        {formatTime(duration)}
      </span>
    </div>
  );
}
