import { useEffect } from "react";

interface useKeyboardShortcutsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onDelete: () => void;
  onAddZoom: () => void;
  onAddAnnotation: () => void;
  onAddKeyframe: () => void;
  onAddTrim: () => void;
}

export function useKeyboardShortcuts({
  isPlaying: _isPlaying,
  onTogglePlay,
  onDelete,
  onAddZoom,
  onAddAnnotation,
  onAddKeyframe,
  onAddTrim,
}: useKeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      const isMod = e.metaKey || e.ctrlKey;

      // Space: Play/Pause
      if (e.code === "Space") {
        e.preventDefault();
        onTogglePlay();
      }

      // Delete/Backspace: Delete selected
      if (e.code === "Delete" || (isMod && e.code === "KeyD")) {
        e.preventDefault();
        onDelete();
      }

      // Z: Add Zoom
      if (e.code === "KeyZ" && !isMod) {
        e.preventDefault();
        onAddZoom();
      }

      // A: Add Annotation
      if (e.code === "KeyA" && !isMod) {
        e.preventDefault();
        onAddAnnotation();
      }

      // F: Add Keyframe
      if (e.code === "KeyF" && !isMod) {
        e.preventDefault();
        onAddKeyframe();
      }

      // T: Add Trim
      if (e.code === "KeyT" && !isMod) {
        e.preventDefault();
        onAddTrim();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onTogglePlay, onDelete, onAddZoom, onAddAnnotation, onAddKeyframe, onAddTrim]);
}
