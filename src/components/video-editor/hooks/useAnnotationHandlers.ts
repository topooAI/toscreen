import * as React from "react";
import { useCallback } from "react";
import { type Span } from "dnd-timeline";
import { 
  type AnnotationRegion, 
  DEFAULT_ANNOTATION_POSITION, 
  DEFAULT_ANNOTATION_SIZE, 
  DEFAULT_ANNOTATION_STYLE,
  DEFAULT_FIGURE_DATA,
  type FigureData
} from "../types";

interface UseAnnotationHandlersProps {
  setAnnotationRegions: (regions: AnnotationRegion[] | ((prev: AnnotationRegion[]) => AnnotationRegion[])) => void;
  setSelectedAnnotationId: (id: string | null) => void;
  setSelectedZoomId: (id: string | null) => void;
  setSelectedTrimId: (id: string | null) => void;
  nextAnnotationIdRef: React.MutableRefObject<number>;
  nextAnnotationZIndexRef: React.MutableRefObject<number>;
}

export function useAnnotationHandlers({
  setAnnotationRegions,
  setSelectedAnnotationId,
  setSelectedZoomId,
  setSelectedTrimId,
  nextAnnotationIdRef,
  nextAnnotationZIndexRef,
}: UseAnnotationHandlersProps) {
  
  const handleAnnotationAdded = useCallback((span: Span) => {
    const id = `annotation-${nextAnnotationIdRef.current++}`;
    const zIndex = nextAnnotationZIndexRef.current++;
    const newRegion: AnnotationRegion = {
      id,
      startMs: Math.round(span.start),
      endMs: Math.round(span.end),
      type: 'text',
      content: 'Enter text...',
      position: { ...DEFAULT_ANNOTATION_POSITION },
      size: { ...DEFAULT_ANNOTATION_SIZE },
      style: { ...DEFAULT_ANNOTATION_STYLE },
      zIndex,
    };
    setAnnotationRegions((prev) => [...prev, newRegion]);
    setSelectedAnnotationId(id);
    setSelectedZoomId(null);
    setSelectedTrimId(null);
  }, [nextAnnotationIdRef, nextAnnotationZIndexRef, setAnnotationRegions, setSelectedAnnotationId, setSelectedZoomId, setSelectedTrimId]);

  const handleAnnotationSpanChange = useCallback((id: string, span: Span) => {
    setAnnotationRegions((prev) =>
      prev.map((region) =>
        region.id === id
          ? { ...region, startMs: Math.round(span.start), endMs: Math.round(span.end) }
          : region
      )
    );
  }, [setAnnotationRegions]);

  const handleAnnotationDelete = useCallback((id: string) => {
    setAnnotationRegions((prev) => prev.filter((region) => region.id !== id));
    setSelectedAnnotationId(null);
  }, [setAnnotationRegions, setSelectedAnnotationId]);

  const handleAnnotationContentChange = useCallback((id: string, content: string) => {
    setAnnotationRegions((prev) =>
      prev.map((region) => {
        if (region.id !== id) return region;
        if (region.type === 'text') return { ...region, content, textContent: content };
        if (region.type === 'image') return { ...region, content, imageContent: content };
        return { ...region, content };
      })
    );
  }, [setAnnotationRegions]);

  const handleAnnotationTypeChange = useCallback((id: string, type: AnnotationRegion['type']) => {
    setAnnotationRegions((prev) =>
      prev.map((region) => {
        if (region.id !== id) return region;
        const updatedRegion = { ...region, type };
        if (type === 'text') updatedRegion.content = region.textContent || 'Enter text...';
        else if (type === 'image') updatedRegion.content = region.imageContent || '';
        else if (type === 'figure' && !region.figureData) updatedRegion.figureData = { ...DEFAULT_FIGURE_DATA };
        return updatedRegion;
      })
    );
  }, [setAnnotationRegions]);

  const handleAnnotationStyleChange = useCallback((id: string, style: Partial<AnnotationRegion['style']>) => {
    setAnnotationRegions((prev) =>
      prev.map((region) =>
        region.id === id ? { ...region, style: { ...region.style, ...style } } : region
      )
    );
  }, [setAnnotationRegions]);

  const handleAnnotationFigureDataChange = useCallback((id: string, figureData: FigureData) => {
    setAnnotationRegions((prev) =>
      prev.map((region) => region.id === id ? { ...region, figureData } : region)
    );
  }, [setAnnotationRegions]);

  const handleAnnotationPositionChange = useCallback((id: string, position: { x: number; y: number }) => {
    setAnnotationRegions((prev) =>
      prev.map((region) => region.id === id ? { ...region, position } : region)
    );
  }, [setAnnotationRegions]);

  const handleAnnotationSizeChange = useCallback((id: string, size: { width: number; height: number }) => {
    setAnnotationRegions((prev) =>
      prev.map((region) => region.id === id ? { ...region, size } : region)
    );
  }, [setAnnotationRegions]);

  return {
    handleAnnotationAdded,
    handleAnnotationSpanChange,
    handleAnnotationDelete,
    handleAnnotationContentChange,
    handleAnnotationTypeChange,
    handleAnnotationStyleChange,
    handleAnnotationFigureDataChange,
    handleAnnotationPositionChange,
    handleAnnotationSizeChange,
  };
}
