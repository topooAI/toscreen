import { useCallback } from "react";
import { toast } from "sonner";
import { generateAutoZooms } from "../../../lib/autoZoom/generator";
import { type ZoomRegion } from "../types";

interface UseAutoZoomProps {
  videoPath: string | null;
  setZoomRegions: (regions: ZoomRegion[]) => void;
  setLoading: (loading: boolean) => void;
}

export function useAutoZoom({ videoPath, setZoomRegions, setLoading }: UseAutoZoomProps) {
  const handleAutoZoom = useCallback(async () => {
    if (!videoPath) {
      toast.error("No video currently loaded.");
      return;
    }

    try {
      setLoading(true);
      const result = await window.electronAPI.readClicksJson(videoPath);
      console.log("[AutoZoom] Read clicks result:", result);

      if (!result.success || !result.clicks || result.clicks.length === 0) {
        toast.warning("No mouse tracking data found.", {
          description: "Check if the clicks.json exists next to your video.",
          duration: 6000,
        });
        setLoading(false);
        return;
      }

      const newRegions = generateAutoZooms(result.clicks);

      if (newRegions.length === 0) {
        toast.info("No zoom regions generated.", {
          description: "Try adjusting the debounce settings or recording more distinct clicks.",
        });
      } else {
        setZoomRegions(newRegions);
        toast.success(`Generated ${newRegions.length} auto-zoom regions!`, {
          description: "You can adjust or delete them in the timeline."
        });
      }
    } catch (err) {
      console.error("Auto-zoom generation failed:", err);
      toast.error("Failed to generate auto-zooms.", {
        description: "Check the console for details."
      });
    } finally {
      setLoading(false);
    }
  }, [videoPath, setZoomRegions, setLoading]);

  return { handleAutoZoom };
}
