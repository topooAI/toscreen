import * as React from "react";
import { useCallback } from "react";
import { type Span } from "dnd-timeline";
import { 
  type ZoomRegion, 
  type TrimRegion, 
  DEFAULT_ZOOM_DEPTH,
  type ZoomFocus,
  type ZoomDepth,
  clampFocusToDepth
} from "../types";

interface UseTimelineHandlersProps {
  setZoomRegions: (regions: ZoomRegion[] | ((prev: ZoomRegion[]) => ZoomRegion[])) => void;
  setTrimRegions: (regions: TrimRegion[] | ((prev: TrimRegion[]) => TrimRegion[])) => void;
  setSelectedZoomId: (id: string | null) => void;
  setSelectedTrimId: (id: string | null) => void;
  setSelectedAnnotationId: (id: string | null) => void;
  nextZoomIdRef: React.MutableRefObject<number>;
  nextTrimIdRef: React.MutableRefObject<number>;
  selectedZoomId: string | null;
  selectedTrimId: string | null;
}

export function useTimelineHandlers({
  setZoomRegions,
  setTrimRegions,
  setSelectedZoomId,
  setSelectedTrimId,
  setSelectedAnnotationId,
  nextZoomIdRef,
  nextTrimIdRef,
  selectedZoomId,
  selectedTrimId,
}: UseTimelineHandlersProps) {

  const handleZoomAdded = useCallback((span: Span) => {
    const id = `zoom-${nextZoomIdRef.current++}`;
    const newRegion: ZoomRegion = {
      id,
      startMs: Math.round(span.start),
      endMs: Math.round(span.end),
      depth: DEFAULT_ZOOM_DEPTH,
      focus: { cx: 0.5, cy: 0.5 },
    };
    setZoomRegions((prev) => [...prev, newRegion]);
    setSelectedZoomId(id);
    setSelectedTrimId(null);
    setSelectedAnnotationId(null);
  }, [nextZoomIdRef, setZoomRegions, setSelectedZoomId, setSelectedTrimId, setSelectedAnnotationId]);

  const handleTrimAdded = useCallback((span: Span) => {
    const id = `trim-${nextTrimIdRef.current++}`;
    const newRegion: TrimRegion = {
      id,
      startMs: Math.round(span.start),
      endMs: Math.round(span.end),
    };
    setTrimRegions((prev) => [...prev, newRegion]);
    setSelectedTrimId(id);
    setSelectedZoomId(null);
    setSelectedAnnotationId(null);
  }, [nextTrimIdRef, setTrimRegions, setSelectedTrimId, setSelectedZoomId, setSelectedAnnotationId]);

  const handleZoomSpanChange = useCallback((id: string, span: Span) => {
    setZoomRegions((prev) =>
      prev.map((region) =>
        region.id === id ? { ...region, startMs: Math.round(span.start), endMs: Math.round(span.end) } : region
      )
    );
  }, [setZoomRegions]);

  const handleTrimSpanChange = useCallback((id: string, span: Span) => {
    setTrimRegions((prev) =>
      prev.map((region) =>
        region.id === id ? { ...region, startMs: Math.round(span.start), endMs: Math.round(span.end) } : region
      )
    );
  }, [setTrimRegions]);

  const handleZoomFocusChange = useCallback((id: string, focus: ZoomFocus) => {
    setZoomRegions((prev) =>
      prev.map((region) =>
        region.id === id ? { ...region, focus: clampFocusToDepth(focus, region.depth) } : region
      )
    );
  }, [setZoomRegions]);

  const handleZoomDepthChange = useCallback((depth: ZoomDepth) => {
    if (!selectedZoomId) return;
    setZoomRegions((prev) =>
      prev.map((region) =>
        region.id === selectedZoomId ? { ...region, depth, focus: clampFocusToDepth(region.focus, depth) } : region
      )
    );
  }, [selectedZoomId, setZoomRegions]);

  const handleZoomDelete = useCallback((id: string) => {
    setZoomRegions((prev) => prev.filter((region) => region.id !== id));
    if (selectedZoomId === id) setSelectedZoomId(null);
  }, [selectedZoomId, setZoomRegions, setSelectedZoomId]);

  const handleTrimDelete = useCallback((id: string) => {
    setTrimRegions((prev) => prev.filter((region) => region.id !== id));
    if (selectedTrimId === id) setSelectedTrimId(null);
  }, [selectedTrimId, setTrimRegions, setSelectedTrimId]);

  return {
    handleZoomAdded,
    handleTrimAdded,
    handleZoomSpanChange,
    handleTrimSpanChange,
    handleZoomFocusChange,
    handleZoomDepthChange,
    handleZoomDelete,
    handleTrimDelete,
  };
}
