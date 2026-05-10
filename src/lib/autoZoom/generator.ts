import { v4 as uuidv4 } from 'uuid';
import { ZoomRegion, ZoomDepth, DEFAULT_ZOOM_DEPTH, ZoomFocus } from '../../components/video-editor/types';

export interface RawClickEvent {
    timestamp: number;
    x: number;
    y: number;
    cx: number;
    cy: number;
    type: 'click' | 'keydown' | 'wheel' | 'move';
    data?: any;
}

export interface AutoZoomOptions {
    depth: ZoomDepth;
    zoomDurationMs: number;  // How long the zoom holds
    preRollMs: number;       // How early zoom starts before click
    debounceMs: number;      // Ignore clicks closer than this
    mergeWindowMs: number;   // Extend region if another click happens within this window
}

export const DEFAULT_AUTO_ZOOM_OPTIONS: AutoZoomOptions = {
    depth: 3, 
    zoomDurationMs: 3500, // hold much longer
    preRollMs: 800,       
    debounceMs: 500,      
    mergeWindowMs: 2000,  // aggressively merge
};

function getDistance(p1: {cx: number, cy: number}, p2: {cx: number, cy: number}) {
    return Math.sqrt(Math.pow(p1.cx - p2.cx, 2) + Math.pow(p1.cy - p2.cy, 2));
}

export function generateAutoZooms(
    clicks: RawClickEvent[],
    options: Partial<AutoZoomOptions> = {}
): ZoomRegion[] {
    const opts = { ...DEFAULT_AUTO_ZOOM_OPTIONS, ...options };
    const regions: ZoomRegion[] = [];

    if (!clicks || clicks.length === 0) return [];

    const sortedClicks = [...clicks].sort((a, b) => a.timestamp - b.timestamp);
    let lastProcessedTime = -Infinity;

    for (const click of sortedClicks) {
        // COLD START: Don't zoom in the first 1.5s unless it's a real click/keypress
        if (click.timestamp < 1500 && click.type === 'move') continue;
        
        // DEBOUNCE
        if (click.timestamp - lastProcessedTime < opts.debounceMs) continue;

        // ONLY TRIGGER on meaningful actions
        if (click.type === 'move') {
             const lastRegion = regions[regions.length - 1];
             if (!lastRegion || getDistance(lastRegion.focus, { cx: click.cx, cy: click.cy }) < 0.35) {
                 continue; 
             }
        }

        const startMs = Math.max(0, click.timestamp - opts.preRollMs);
        const endMs = click.timestamp + opts.zoomDurationMs;
        
        const prevRegion = regions[regions.length - 1];

        if (prevRegion) {
            const dist = getDistance(prevRegion.focus, { cx: click.cx, cy: click.cy });
            // If clicking same area, just extend and ZOOM IN DEEPER
            const isNear = dist < 0.15;
            const isSoon = startMs < prevRegion.endMs + 1000;

            if (isNear && isSoon) {
                prevRegion.endMs = Math.max(prevRegion.endMs, endMs);
                if (prevRegion.depth < 6) {
                    prevRegion.depth = (prevRegion.depth + 1) as ZoomDepth;
                }
                lastProcessedTime = click.timestamp;
                continue;
            }
        }

        const region: ZoomRegion = {
            id: `zoom-${Math.random().toString(36).substr(2, 9)}`,
            startMs,
            endMs,
            depth: opts.depth,
            focus: { cx: click.cx, cy: click.cy },
            // Attach real-time path data for this window
            clicks: sortedClicks.filter(c => c.timestamp >= startMs && c.timestamp <= endMs)
        };

        // HARD CUT: Physics engine at 0.25 will snap the camera to position
        if (prevRegion && region.startMs < prevRegion.endMs) {
            prevRegion.endMs = region.startMs;
        }

        regions.push(region);
        lastProcessedTime = click.timestamp;
    }

    return regions;
}
