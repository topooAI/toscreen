import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { TimelineContext } from "dnd-timeline";
import type { DragEndEvent, DragMoveEvent, Range, ResizeEndEvent, ResizeMoveEvent, ResizeStartEvent, Span, UsePanStrategy } from "dnd-timeline";
import { resolveLeftAlignedTimelineRangeChange } from "./timelineRangeZoom";
import { normalizeTimelineInteractionSpan } from "./timelineSpanSafety";
import type { TimelineMagneticSnapResult } from "./timelineMagneticSnap";
import { EMPTY_TIMELINE_VISUAL_SNAP, TimelineVisualSnapContext } from "./TimelineVisualSnapContext";

const useInfiniteTimelineWheelStrategy: UsePanStrategy = (timelineBag, onPanEnd) => {
  useLayoutEffect(() => {
    const element = timelineBag.timelineRef.current;
    if (!element) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();

      const isZoomGesture = event.ctrlKey || event.metaKey;
      if (isZoomGesture && !event.shiftKey) {
        onPanEnd({
          clientX: event.clientX,
          clientY: event.clientY,
          deltaX: 0,
          deltaY: event.deltaY,
        });
        return;
      }

      onPanEnd({
        clientX: event.clientX,
        clientY: event.clientY,
        deltaX: event.deltaX || event.deltaY,
        deltaY: 0,
      });
    };

    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, [onPanEnd, timelineBag.timelineRef]);
};

interface TimelineWrapperProps {
  children: ReactNode;
  range: Range;
  videoDuration: number;
  hasOverlap: (newSpan: Span, excludeId?: string, targetRowId?: string) => boolean;
  getNonOverlappingSpan?: (span: Span, id: string, targetRowId?: string) => Span;
  onRangeChange: Dispatch<SetStateAction<Range>>;
  minItemDurationMs: number;
  minVisibleRangeMs: number;
  gridSizeMs: number;
  onItemSpanChange: (id: string, span: Span) => void;
  onItemDragSpanChange?: (id: string, span: Span) => void;
  onItemResizePreview?: (id: string, span: Span | null) => void;
  onItemRowChange?: (id: string, newRowId: string) => void;
  onResizeInteractionStart?: () => void;
  onResizeInteractionEnd?: () => void;
  isMagneticSnapEnabled?: boolean;
  getMagneticSnapSpan?: (id: string, span: Span, snapThresholdMs: number) => Span;
  getMagneticResizeSnapSpan?: (id: string, span: Span, snapThresholdMs: number) => Span;
  getMagneticSnapResult?: (id: string, span: Span, snapThresholdMs: number) => TimelineMagneticSnapResult;
  onSnapGuideChange?: (timeMs: number | null) => void;
}

export default function TimelineWrapper({
  children,
  range,
  videoDuration,
  hasOverlap,
  getNonOverlappingSpan,
  onRangeChange,
  minItemDurationMs,
  minVisibleRangeMs,
  gridSizeMs: _gridSizeMs,
  onItemSpanChange,
  onItemDragSpanChange,
  onItemResizePreview,
  onItemRowChange,
  onResizeInteractionStart,
  onResizeInteractionEnd,
  isMagneticSnapEnabled = true,
  getMagneticSnapSpan,
  getMagneticResizeSnapSpan,
  getMagneticSnapResult,
  onSnapGuideChange,
}: TimelineWrapperProps) {
  const [forceUpdateKey, setForceUpdateKey] = useState(0);
  const resizeStartSpansRef = useRef(new Map<string, Span>());
  const [visualSnap, setVisualSnap] = useState(EMPTY_TIMELINE_VISUAL_SNAP);
  const totalMs = Math.max(0, Math.round(videoDuration * 1000));

  const clampSpanToBounds = useCallback(
    (span: Span): Span => normalizeTimelineInteractionSpan(span, { minItemDurationMs }),
    [minItemDurationMs],
  );

  const isHandledByDirectResize = (event: ResizeStartEvent | ResizeMoveEvent | ResizeEndEvent): boolean => {
    const variant = event.active.data.current?.variant;
    return variant === "trim";
  };


  const getSpanFromResizeEvent = useCallback((event: ResizeMoveEvent | ResizeEndEvent): Span | null => {
    const activeItemId = event.active.id as string;
    const initialSpan = resizeStartSpansRef.current.get(activeItemId);
    const currentData = event.active.data.current;

    if (!initialSpan) {
      return currentData.getSpanFromResizeEvent?.(event) ?? null;
    }

    const currentSpan = currentData.span;
    currentData.span = initialSpan;
    const nextSpan = currentData.getSpanFromResizeEvent?.(event) ?? null;
    currentData.span = currentSpan;
    return nextSpan;
  }, []);

  const getSpanFromDragDeltaEvent = useCallback((event: DragMoveEvent | DragEndEvent): Span | null => {
    const spanFromTimeline = event.active.data.current.getSpanFromDragEvent?.(event) as Span | null | undefined;
    if (
      spanFromTimeline &&
      Number.isFinite(spanFromTimeline.start) &&
      Number.isFinite(spanFromTimeline.end) &&
      spanFromTimeline.end > spanFromTimeline.start
    ) {
      return spanFromTimeline;
    }

    const initialSpan = event.active.data.current?.span as Span | undefined;
    const initialRect = event.active.rect.current.initial;
    if (!initialSpan || !initialRect) {
      return null;
    }

    const durationMs = initialSpan.end - initialSpan.start;
    if (!Number.isFinite(durationMs) || durationMs <= 0 || initialRect.width <= 0) {
      return event.active.data.current.getSpanFromDragEvent?.(event) ?? null;
    }

    const pxPerMs = initialRect.width / durationMs;
    if (!Number.isFinite(pxPerMs) || pxPerMs <= 0) {
      return event.active.data.current.getSpanFromDragEvent?.(event) ?? null;
    }

    const start = Math.max(0, initialSpan.start + (event.delta.x / pxPerMs));
    return { start, end: start + durationMs };
  }, []);

  const getDragSnapThresholdMs = useCallback((event: DragMoveEvent | DragEndEvent): number => {
    const initialSpan = event.active.data.current?.span as Span | undefined;
    const initialRect = event.active.rect.current.initial;
    if (!initialSpan || !initialRect || initialRect.width <= 0) return 0;
    const durationMs = initialSpan.end - initialSpan.start;
    const pxPerMs = initialRect.width / Math.max(durationMs, 0.0001);
    return 8 / Math.max(pxPerMs, 0.0001);
  }, []);

  const getResizeSnapThresholdMs = useCallback((activeItemId: string, span: Span): number => {
    const node = document.querySelector<HTMLElement>(`[data-timeline-item-id="${CSS.escape(activeItemId)}"]`);
    const widthPx = Number.parseFloat(node?.style.width || "");
    const durationMs = span.end - span.start;
    if (!Number.isFinite(widthPx) || widthPx <= 0 || durationMs <= 0) return 0;
    return 8 / Math.max(widthPx / durationMs, 0.0001);
  }, []);

  const applyResizePreviewToNode = useCallback((
    activeItemId: string,
    rawSpan: Span,
    snappedSpan: Span,
    direction: "start" | "end",
  ) => {
    const node = document.querySelector<HTMLElement>(`[data-timeline-item-id="${CSS.escape(activeItemId)}"]`);
    if (!node) return;
    const rawWidthPx = Number.parseFloat(node.style.width || "");
    const rawDurationMs = rawSpan.end - rawSpan.start;
    if (!Number.isFinite(rawWidthPx) || rawWidthPx <= 0 || rawDurationMs <= 0) return;
    const pxPerMs = rawWidthPx / rawDurationMs;

    if (direction === "end") {
      node.style.width = `${Math.max(1, (snappedSpan.end - snappedSpan.start) * pxPerMs)}px`;
      return;
    }

    const startDeltaPx = (snappedSpan.start - rawSpan.start) * pxPerMs;
    const currentLeftPx = Number.parseFloat(node.style.left || "0");
    node.style.left = `${currentLeftPx + startDeltaPx}px`;
    node.style.width = `${Math.max(1, rawWidthPx - startDeltaPx)}px`;
  }, []);

  const onResizeStart = useCallback((event: ResizeStartEvent) => {
    if (isHandledByDirectResize(event)) {
      return;
    }

    const activeItemId = event.active.id as string;
    const span = event.active.data.current?.span;
    if (span) {
      resizeStartSpansRef.current.set(activeItemId, { ...span });
    }
    onResizeInteractionStart?.();
  }, [onResizeInteractionStart]);

  const onResizeEnd = useCallback(
    (event: ResizeEndEvent) => {
      const activeItemId = event.active.id as string;
      const finishResize = () => {
        const blockSyntheticClick = (clickEvent: MouseEvent) => {
          clickEvent.preventDefault();
          clickEvent.stopPropagation();
        };
        window.addEventListener('click', blockSyntheticClick, { capture: true, once: true });
        resizeStartSpansRef.current.delete(activeItemId);
        onItemResizePreview?.(activeItemId, null);
        onSnapGuideChange?.(null);
        onResizeInteractionEnd?.();
      };

      if (isHandledByDirectResize(event)) {
        resizeStartSpansRef.current.delete(activeItemId);
        onItemResizePreview?.(activeItemId, null);
        onSnapGuideChange?.(null);
        return;
      }

      const updatedSpan = getSpanFromResizeEvent(event);
      if (!updatedSpan) {
        finishResize();
        return;
      }
      
      let clampedSpan = clampSpanToBounds(updatedSpan);

      if (isMagneticSnapEnabled && getMagneticResizeSnapSpan) {
        clampedSpan = getMagneticResizeSnapSpan(
          activeItemId,
          clampedSpan,
          getResizeSnapThresholdMs(activeItemId, clampedSpan),
        );
      }

      if (clampedSpan.end - clampedSpan.start < Math.min(minItemDurationMs, totalMs || minItemDurationMs)) {
        finishResize();
        return;
      }
      
      if (getNonOverlappingSpan) {
        clampedSpan = getNonOverlappingSpan(clampedSpan, activeItemId, undefined);
      }

      if (hasOverlap(clampedSpan, activeItemId, undefined)) {
        setForceUpdateKey(prev => prev + 1);
        finishResize();
        return;
      }

      onItemSpanChange(activeItemId, clampedSpan);
      finishResize();
    },
    [clampSpanToBounds, getMagneticResizeSnapSpan, getNonOverlappingSpan, getResizeSnapThresholdMs, getSpanFromResizeEvent, hasOverlap, isMagneticSnapEnabled, minItemDurationMs, onItemResizePreview, onItemSpanChange, onResizeInteractionEnd, onSnapGuideChange, totalMs]
  );

  const onResizeMove = useCallback(
    (event: ResizeMoveEvent) => {
      if (isHandledByDirectResize(event)) {
        return;
      }

      const updatedSpan = getSpanFromResizeEvent(event);
      if (!updatedSpan) return;

      const activeItemId = event.active.id as string;
      const liveSpan = clampSpanToBounds(updatedSpan);

      if (liveSpan.end - liveSpan.start < Math.min(minItemDurationMs, totalMs || minItemDurationMs)) {
        return;
      }

      if (!isMagneticSnapEnabled || !getMagneticResizeSnapSpan) {
        onSnapGuideChange?.(null);
        return;
      }

      const snappedSpan = getMagneticResizeSnapSpan(
        activeItemId,
        liveSpan,
        getResizeSnapThresholdMs(activeItemId, liveSpan),
      );
      const snappedEdge = event.direction === "start" ? snappedSpan.start : snappedSpan.end;
      const rawEdge = event.direction === "start" ? liveSpan.start : liveSpan.end;
      const didSnap = Math.abs(snappedEdge - rawEdge) > 0.5;
      onSnapGuideChange?.(didSnap ? snappedEdge : null);
      if (didSnap) {
        applyResizePreviewToNode(activeItemId, liveSpan, snappedSpan, event.direction);
      }
    },
    [applyResizePreviewToNode, clampSpanToBounds, getMagneticResizeSnapSpan, getResizeSnapThresholdMs, getSpanFromResizeEvent, isMagneticSnapEnabled, minItemDurationMs, onSnapGuideChange, totalMs]
  );

  const onDragMove = useCallback(
    (event: DragMoveEvent) => {
      if (!isMagneticSnapEnabled || !getMagneticSnapResult) {
        setVisualSnap(EMPTY_TIMELINE_VISUAL_SNAP);
        onSnapGuideChange?.(null);
        return;
      }

      const updatedSpan = getSpanFromDragDeltaEvent(event);
      if (!updatedSpan) {
        setVisualSnap(EMPTY_TIMELINE_VISUAL_SNAP);
        onSnapGuideChange?.(null);
        return;
      }

      const activeItemId = event.active.id as string;
      const liveSpan = clampSpanToBounds(updatedSpan);
      const snap = getMagneticSnapResult(activeItemId, liveSpan, getDragSnapThresholdMs(event));
      onSnapGuideChange?.(snap.targetMs);

      const initialSpan = event.active.data.current?.span as Span | undefined;
      const initialRect = event.active.rect.current.initial;
      if (initialSpan && initialRect && initialRect.width > 0) {
        const durationMs = initialSpan.end - initialSpan.start;
        const pxPerMs = initialRect.width / Math.max(durationMs, 0.0001);
        const snapOffsetPx = snap.targetMs === null ? 0 : (snap.span.start - liveSpan.start) * pxPerMs;
        setVisualSnap({
          activeItemId,
          offsetPx: Number.isFinite(snapOffsetPx) ? snapOffsetPx : 0,
        });
      } else {
        setVisualSnap(EMPTY_TIMELINE_VISUAL_SNAP);
      }
    },
    [clampSpanToBounds, getDragSnapThresholdMs, getMagneticSnapResult, getSpanFromDragDeltaEvent, isMagneticSnapEnabled, onSnapGuideChange],
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      setVisualSnap(EMPTY_TIMELINE_VISUAL_SNAP);

      const originalRowId = event.active.data.current?.rowId as string;
      const activeRowId = (event.over?.id as string) || originalRowId;
      const updatedSpan = getSpanFromDragDeltaEvent(event);
      if (!updatedSpan || !activeRowId) {
        onSnapGuideChange?.(null);
        return;
      }
      
      const activeItemId = event.active.id as string;
      let clampedSpan = clampSpanToBounds(updatedSpan);
      
      if (isMagneticSnapEnabled && getMagneticSnapSpan) {
        clampedSpan = getMagneticSnapSpan(activeItemId, clampedSpan, getDragSnapThresholdMs(event));
      }
      
      if (getNonOverlappingSpan) {
        clampedSpan = getNonOverlappingSpan(clampedSpan, activeItemId, activeRowId);
      }
      
      if (hasOverlap(clampedSpan, activeItemId, activeRowId)) {
        setForceUpdateKey(prev => prev + 1);
        onSnapGuideChange?.(null);
        return;
      }

      (onItemDragSpanChange ?? onItemSpanChange)(activeItemId, clampedSpan);
      if (activeRowId) {
        onItemRowChange?.(activeItemId, activeRowId);
      }
      onSnapGuideChange?.(null);
    },
    [clampSpanToBounds, getDragSnapThresholdMs, getSpanFromDragDeltaEvent, hasOverlap, onItemDragSpanChange, onItemSpanChange, onItemRowChange, onSnapGuideChange, isMagneticSnapEnabled, getMagneticSnapSpan, getNonOverlappingSpan]
  );

  const onDragCancel = useCallback(() => {
    setVisualSnap(EMPTY_TIMELINE_VISUAL_SNAP);
    onSnapGuideChange?.(null);
  }, [onSnapGuideChange]);

  const handleRangeChange = useCallback(
    (updater: (previous: Range) => Range) => {
      onRangeChange((prev) => {
        return resolveLeftAlignedTimelineRangeChange(prev, updater, minVisibleRangeMs, totalMs);
      });
    },
    [onRangeChange, minVisibleRangeMs, totalMs],
  );

  return (
    <TimelineVisualSnapContext.Provider value={visualSnap}>
      <TimelineContext
        key={forceUpdateKey}
        range={range}
        onRangeChanged={handleRangeChange}
        onResizeStart={onResizeStart}
        onResizeEnd={onResizeEnd}
        onResizeMove={onResizeMove}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
        resizeHandleWidth={4}
        rangeGridSizeDefinition={1}
        autoScroll={{ enabled: false }}
        usePanStrategy={useInfiniteTimelineWheelStrategy}
      >
        {children}
      </TimelineContext>
    </TimelineVisualSnapContext.Provider>
  );
}
