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
    depth: 3, // 2.0x
    zoomDurationMs: 1800, // hold slightly longer
    preRollMs: 600,       // start zooming 0.6s before
    debounceMs: 500,      // ignore rapid noise
    mergeWindowMs: 800,   // tighter merge window
};

/**
 * Generates cinematic zoom regions from raw mouse click data.
 * 
 * Algorithm:
 * 1. Filter out rapid-fire clicks (debounce)
 * 2. Group clicks that happen in close succession (same area)
 * 3. Create ZoomRegion objects with proper pre-roll and hold duration
 * 4. Ensure regions don't overlap in invalid ways (merge them)
 */
export function generateAutoZooms(
    clicks: RawClickEvent[],
    options: Partial<AutoZoomOptions> = {}
): ZoomRegion[] {
    const opts = { ...DEFAULT_AUTO_ZOOM_OPTIONS, ...options };
    const regions: ZoomRegion[] = [];

    if (!clicks || clicks.length === 0) return [];

    // 1. Sort by timestamp (just in case)
    const sortedClicks = [...clicks].sort((a, b) => a.timestamp - b.timestamp);

    // 2. Process clicks
    let lastClickTime = -Infinity;

    for (const click of sortedClicks) {
        // Skip early move events to ensure wide shot start
        if (click.type === 'move' && click.timestamp < 1000) {
            continue;
        }

        // Debounce: Skip if too close to last processed click (e.g., double click)
        if (click.timestamp - lastClickTime < opts.debounceMs) {
            continue;
        }

        // Logic adjustment: Different actions might have different hold durations
        let duration = opts.zoomDurationMs;
        if (click.type === 'keydown') {
            duration = 2000; // Hold longer for typing
        } else if (click.type === 'wheel') {
            duration = 1000; // Shorter for scroll
        } else if (click.type === 'move') {
            duration = 1500; // Normal hold for mouse move focus
        }

        const startMs = Math.max(0, click.timestamp - opts.preRollMs);
        const endMs = click.timestamp + duration;

        // Check for overlap with the previous region
        const prevRegion = regions[regions.length - 1];

        if (prevRegion) {
            // If the new zoom starts before the previous one ends (or within merge window)
            // we need to make a decision: merge or separate?

            // Case A: Click is essentially part of the same action sequence (within merge window of previous end)
            // and relatively close in location?
            // For MVP, we stick to time-based merging to prevent "strobe" zooming.

            if (startMs < prevRegion.endMs + opts.mergeWindowMs) {
                // Extend the previous region to cover this new click action
                // However, if the focus point is VERY different, we might want a cut or swift pan?
                // For standard "Tutorial" feel, holding the zoom is better than zooming out and in.

                // Let's extend the previous region
                prevRegion.endMs = Math.max(prevRegion.endMs, endMs);

                // Option: Smoothly shift focus? 
                // Currently ZoomRegion is static focus. To support moving focus, we'd need Keyframes.
                // Since our data model is static Regions, we have two choices:
                // 1. Keep focus on the first click (stable camera)
                // 2. Create a new adjacent region (cut/slide to new focus)

                // Decision: If we are extending, we create a CHAINGED region structure?
                // No, openscreen supports overlapping/adjacent regions.
                // If we simply create a new region starting where the last ended, the renderer interpolates.

                // REVISION: To allow the camera to "Move" from click A to click B without zooming out:
                // We should start the new region exactly when the previous one ends (or slightly before for crossfade).
                // But our current logic says `startMs` is `timestamp - preRoll`.

                // If `startMs` < `prevRegion.endMs`, we have an overlap.
                // Openscreen renderer likely handles overlap by blending or taking the latest.
                // Let's just clamp the start to ensure clean sequence?
                // actually, let's allow the logic to create distinct target regions, 
                // and let the user/renderer handle the transition.

                // But for "Auto" generation, we want it clean. 
                // Let's effectively "Cut" the previous region short if a new attention point arrives?
                // Or delay the new one?

                // Better UX: If a new click happens while zoomed in, we likely want to PAN to it.
                // This implies a new Region starting immediately.

                if (startMs < prevRegion.endMs) {
                    // The new click wants attention NOW.
                    // Shorten previous region to end exactly at new start?
                    // Or just let them overlap (renderer handles it?)
                    // Let's adjust strict non-overlapping for clarity.

                    // If the overlap is massive (e.g. click 2 is 1s after click 1, but duration is 2s),
                    // we just want to shift focus.

                    // STRATEGY: Create a new region, but ensure its start time respects the timeline flow.
                    // We'll set the start to be at least `prevRegion.startMs + 500ms` (minimum shot length).
                }
            }
        }

        // Create the new region
        // For MVP, we simply push it. Overlaps handled by renderer (closest/latest wins usually).
        const region: ZoomRegion = {
            id: uuidv4(),
            startMs,
            endMs,
            depth: opts.depth,
            focus: { cx: click.cx, cy: click.cy }
        };

        // Simplification: logic to prevent total chaos
        // If this region starts BEFORE previous ends, adjust previous end to match this start
        // This creates a "Cut" or "Pan" effect at `startMs`.
        if (prevRegion && region.startMs < prevRegion.endMs) {
            prevRegion.endMs = region.startMs;

            // If this results in a tiny previous region (< 300ms), maybe ignore the new one 
            // or merge? Let's keep it simple for v1.
        }

        regions.push(region);
        lastClickTime = click.timestamp;
    }

    return regions;
}
