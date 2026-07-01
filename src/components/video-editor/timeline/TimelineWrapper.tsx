import { useCallback, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { TimelineContext } from "dnd-timeline";
import type { DragEndEvent, Range, ResizeEndEvent, ResizeMoveEvent, ResizeStartEvent, Span } from "dnd-timeline";
import { normalizeTimelineInteractionSpan } from "./timelineSpanSafety";

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
  onItemResizePreview?: (id: string, span: Span | null) => void;
  onItemRowChange?: (id: string, newRowId: string) => void;
  onResizeInteractionStart?: () => void;
  onResizeInteractionEnd?: () => void;
  isMagneticSnapEnabled?: boolean;
  getMagneticSnapSpan?: (id: string, span: Span) => Span;
}

const clampRange = (candidate: Range, minVisibleRangeMs: number, totalMs: number): Range => {
  let { start, end } = candidate;

  // 1. 防止向左无限平移
  if (start < 0) {
    const span = end - start;
    start = 0;
    end = span;
  }

  // 2. 限制最大可视范围（最大缩放级别），防止缩放到几千小时导致比例尺崩溃
  const maxSpan = Math.max(totalMs * 3, 60000); // 至少允许 60 秒，或者视频长度的 3 倍
  if (end - start > maxSpan) {
    end = start + maxSpan;
  }

  // 3. 给通用多轨时间轴足够的右侧工作空间。实现上仍保留性能护栏，但不再被主视频长度锁死。
  const absoluteMaxEnd = Math.max(totalMs + 60 * 60 * 1000, maxSpan);
  if (end > absoluteMaxEnd) {
    const span = end - start;
    end = absoluteMaxEnd;
    start = Math.max(0, end - span);
  }

  // 4. 保证最小可视范围
  end = Math.max(start + minVisibleRangeMs, end);

  return { start, end };
};

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
  onItemResizePreview,
  onItemRowChange,
  onResizeInteractionStart,
  onResizeInteractionEnd,
  isMagneticSnapEnabled = true,
  getMagneticSnapSpan,
}: TimelineWrapperProps) {
  const [forceUpdateKey, setForceUpdateKey] = useState(0);
  const resizeStartSpansRef = useRef(new Map<string, Span>());
  const totalMs = Math.max(0, Math.round(videoDuration * 1000));

  const clampSpanToBounds = useCallback(
    (span: Span): Span => normalizeTimelineInteractionSpan(span, { minItemDurationMs }),
    [minItemDurationMs],
  );



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

  const onResizeStart = useCallback((event: ResizeStartEvent) => {
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
        onResizeInteractionEnd?.();
      };

      const updatedSpan = getSpanFromResizeEvent(event);
      if (!updatedSpan) {
        finishResize();
        return;
      }
      
      let clampedSpan = clampSpanToBounds(updatedSpan);

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
    [clampSpanToBounds, getSpanFromResizeEvent, hasOverlap, minItemDurationMs, onItemResizePreview, onItemSpanChange, onResizeInteractionEnd, totalMs, isMagneticSnapEnabled, getMagneticSnapSpan, getNonOverlappingSpan]
  );

  const onResizeMove = useCallback(
    (event: ResizeMoveEvent) => {
      const updatedSpan = getSpanFromResizeEvent(event);
      if (!updatedSpan) return;

      const liveSpan = clampSpanToBounds(updatedSpan);

      if (liveSpan.end - liveSpan.start < Math.min(minItemDurationMs, totalMs || minItemDurationMs)) {
        return;
      }
    },
    [clampSpanToBounds, getSpanFromResizeEvent, minItemDurationMs, totalMs]
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const originalRowId = event.active.data.current?.rowId as string;
      const activeRowId = (event.over?.id as string) || originalRowId;
      const updatedSpan = event.active.data.current.getSpanFromDragEvent?.(event);
      if (!updatedSpan || !activeRowId) return;
      
      const activeItemId = event.active.id as string;
      let clampedSpan = clampSpanToBounds(updatedSpan);
      
      if (isMagneticSnapEnabled && getMagneticSnapSpan) {
        clampedSpan = getMagneticSnapSpan(activeItemId, clampedSpan);
      }
      
      if (getNonOverlappingSpan) {
        clampedSpan = getNonOverlappingSpan(clampedSpan, activeItemId, activeRowId);
      }
      
      if (hasOverlap(clampedSpan, activeItemId, activeRowId)) {
        setForceUpdateKey(prev => prev + 1);
        return;
      }

      onItemSpanChange(activeItemId, clampedSpan);
      if (activeRowId) {
        onItemRowChange?.(activeItemId, activeRowId);
      }
    },
    [clampSpanToBounds, hasOverlap, onItemSpanChange, onItemRowChange, isMagneticSnapEnabled, getMagneticSnapSpan, getNonOverlappingSpan]
  );

  const handleRangeChange = useCallback(
    (updater: (previous: Range) => Range) => {
      onRangeChange((prev) => {
        const normalized = clampRange(prev, minVisibleRangeMs, totalMs);
        let desired = updater(normalized);
        
        const prevSpan = normalized.end - normalized.start;
        const desiredSpan = desired.end - desired.start;
        const isZoom = Math.abs(prevSpan - desiredSpan) > 1;
        
        // Force left-aligned zoom: keep the left edge fixed during zoom
        if (isZoom) {
          desired = {
            start: normalized.start,
            end: normalized.start + desiredSpan,
          };
        }
        
        return clampRange(desired, minVisibleRangeMs, totalMs);
      });
    },
    [onRangeChange, minVisibleRangeMs, totalMs],
  );

  return (
    <TimelineContext
      key={forceUpdateKey}
      range={range}
      onRangeChanged={handleRangeChange}
      onResizeStart={onResizeStart}
      onResizeEnd={onResizeEnd}
      onResizeMove={onResizeMove}
      onDragEnd={onDragEnd}
      resizeHandleWidth={4}
      rangeGridSizeDefinition={1}
      autoScroll={{ enabled: false }}
    >
      {children}
    </TimelineContext>
  );
}
