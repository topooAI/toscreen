import React, { useEffect } from "react";
import { getAssetPath } from "../../../lib/assetPath";

interface VideoLoaderProps {
  setVideoPath: (path: string | null) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  setWallpaper: (wallpaper: string) => void;
}

export function useVideoLoader({ setVideoPath, setError, setLoading, setWallpaper }: VideoLoaderProps) {
  useEffect(() => {
    async function loadVideo() {
      try {
        setLoading(true);
        // 1. Try to get the "active" video path (e.g. just recorded)
        let result = await window.electronAPI.getCurrentVideoPath();

        // 2. Fallback to the latest video in the recordings directory
        if (!result.success || !result.path) {
          result = await window.electronAPI.getRecordedVideoPath();
        }

        if (result.success && result.path) {
          setVideoPath(result.path);
          setError(null);
        } else {
          setError('No recordings found. Please start a new recording to begin editing.');
        }
      } catch (err) {
        setError('Error loading video: ' + String(err));
      } finally {
        setLoading(false);
      }
    }
    loadVideo();
  }, [setVideoPath, setError, setLoading]);

  // Initialize default wallpaper with resolved asset path
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resolvedPath = await getAssetPath('wallpapers/wallpaper1.jpg');
        if (mounted) {
          setWallpaper(resolvedPath);
        }
      } catch (err) {
        console.warn('Failed to resolve default wallpaper path:', err);
      }
    })();

    return () => { mounted = false };
  }, [setWallpaper]);
}
