import { createContext, useContext } from "react";

export interface TimelineVisualSnapState {
  activeItemId: string | null;
  offsetPx: number;
}

export const EMPTY_TIMELINE_VISUAL_SNAP: TimelineVisualSnapState = {
  activeItemId: null,
  offsetPx: 0,
};

export const TimelineVisualSnapContext = createContext<TimelineVisualSnapState>(EMPTY_TIMELINE_VISUAL_SNAP);

export function useTimelineVisualSnap(): TimelineVisualSnapState {
  return useContext(TimelineVisualSnapContext);
}
