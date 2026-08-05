import { ZOOM_DEPTH_SCALES, ZoomRegion, ZoomDepth } from '../../components/video-editor/types';

export interface RawClickEvent {
    timestamp: number;
    x: number;
    y: number;
    cx: number;
    cy: number;
    type: 'click' | 'mousedown' | 'mouseup' | 'drag' | 'keydown' | 'wheel' | 'move';
    data?: any;
}

export interface AutoZoomOptions {
    depth: ZoomDepth;
    zoomDurationMs: number;
    preRollMs: number;
    mergeWindowMs: number;
    maxRegionMs: number;
    spatialSplitDistance: number;
    maxFocusSpan: number;
    connectedGapMs: number;
    focusPadding: number;
    minRegionMs: number;
    tailBaseViewMs: number;
    totalDurationMs?: number;
}

export const DEFAULT_AUTO_ZOOM_OPTIONS: AutoZoomOptions = {
    depth: 3,
    zoomDurationMs: 1700,
    preRollMs: 400,
    mergeWindowMs: 1200,
    maxRegionMs: 4800,
    spatialSplitDistance: 0.22,
    maxFocusSpan: 0.34,
    // Keep medium pauses in one camera sentence. The renderer uses the same
    // boundary for a continuous pan, so generated timeline clips do not show
    // a misleading empty Focus gap.
    connectedGapMs: 2800,
    focusPadding: 0.1,
    minRegionMs: 900,
    tailBaseViewMs: 0,
};

const CURSOR_DEPARTURE_BURST_GAP_MS = 120;

export function clampZoomRegionsToRecordingDuration(
    regions: ZoomRegion[],
    recordingDurationMs: number,
): ZoomRegion[] {
    if (!Number.isFinite(recordingDurationMs) || recordingDurationMs <= 0) {
        return regions;
    }

    let changed = false;
    const bounded: ZoomRegion[] = [];

    for (const region of regions) {
        if (region.endMs <= 0 || region.startMs >= recordingDurationMs) {
            changed = true;
            continue;
        }

        const startMs = Math.max(0, region.startMs);
        const endMs = Math.min(recordingDurationMs, region.endMs);
        if (endMs - startMs < 1) {
            changed = true;
            continue;
        }

        if (startMs !== region.startMs || endMs !== region.endMs) {
            changed = true;
            bounded.push({ ...region, startMs, endMs });
        } else {
            bounded.push(region);
        }
    }

    return changed ? bounded : regions;
}

interface CameraIntent {
    timestamp: number;
    endTimestamp: number;
    cx: number;
    cy: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    kind: 'point' | 'typing' | 'drag';
}

function buildCameraIntents(events: RawClickEvent[]): CameraIntent[] {
    const intents: CameraIntent[] = [];

    for (let index = 0; index < events.length; index += 1) {
        const event = events[index];
        if (!Number.isFinite(event.timestamp) || !Number.isFinite(event.cx) || !Number.isFinite(event.cy)) {
            continue;
        }

        if (event.type === 'mousedown') {
            const gesture = [event];
            let gestureEndIndex = index;
            for (let cursor = index + 1; cursor < events.length; cursor += 1) {
                const next = events[cursor];
                if (next.type !== 'drag' && next.type !== 'mouseup') break;
                gesture.push(next);
                gestureEndIndex = cursor;
                if (next.type === 'mouseup') break;
            }

            const xs = gesture.map((point) => point.cx).filter(Number.isFinite);
            const ys = gesture.map((point) => point.cy).filter(Number.isFinite);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            intents.push({
                timestamp: event.timestamp,
                endTimestamp: gesture[gesture.length - 1].timestamp,
                cx: (minX + maxX) / 2,
                cy: (minY + maxY) / 2,
                minX,
                maxX,
                minY,
                maxY,
                kind: gesture.length > 1 ? 'drag' : 'point',
            });
            index = gestureEndIndex;
            continue;
        }

        // Movement and wheel events describe activity inside a shot, but do not
        // create a camera shot by themselves. Every generated Focus remains a
        // single fixed composition.
        if (event.type === 'click' || event.type === 'keydown') {
            intents.push({
                timestamp: event.timestamp,
                endTimestamp: event.timestamp,
                cx: event.cx,
                cy: event.cy,
                minX: event.cx,
                maxX: event.cx,
                minY: event.cy,
                maxY: event.cy,
                kind: event.type === 'keydown' ? 'typing' : 'point',
            });
        }
    }

    return intents.sort((a, b) => a.timestamp - b.timestamp);
}

function getIntentBounds(intents: CameraIntent[]) {
    return {
        minX: Math.min(...intents.map((intent) => intent.minX)),
        maxX: Math.max(...intents.map((intent) => intent.maxX)),
        minY: Math.min(...intents.map((intent) => intent.minY)),
        maxY: Math.max(...intents.map((intent) => intent.maxY)),
    };
}

function getIntentDistance(left: CameraIntent, right: CameraIntent): number {
    return Math.hypot(right.cx - left.cx, right.cy - left.cy);
}

function shouldStartNewShot(
    currentGroup: CameraIntent[],
    intent: CameraIntent,
    options: AutoZoomOptions,
): boolean {
    if (currentGroup.length === 0) return false;

    const first = currentGroup[0];
    const previous = currentGroup[currentGroup.length - 1];
    if (intent.timestamp - previous.endTimestamp > options.mergeWindowMs) return true;
    const maximumActionSpanMs = Math.max(
        options.minRegionMs,
        options.maxRegionMs - options.zoomDurationMs,
    );
    if (intent.endTimestamp - first.timestamp > maximumActionSpanMs) return true;
    if (getIntentDistance(previous, intent) > options.spatialSplitDistance) return true;

    const bounds = getIntentBounds([...currentGroup, intent]);
    return bounds.maxX - bounds.minX > options.maxFocusSpan
        || bounds.maxY - bounds.minY > options.maxFocusSpan;
}

function resolveFixedFocus(intents: CameraIntent[]) {
    let totalWeight = 0;
    let weightedX = 0;
    let weightedY = 0;

    for (const intent of intents) {
        const weight = intent.kind === 'point' ? 3 : intent.kind === 'drag' ? 2 : 1;
        totalWeight += weight;
        weightedX += intent.cx * weight;
        weightedY += intent.cy * weight;
    }

    return {
        cx: Math.min(1, Math.max(0, weightedX / Math.max(1, totalWeight))),
        cy: Math.min(1, Math.max(0, weightedY / Math.max(1, totalWeight))),
    };
}

function resolveAdaptiveDepth(
    intents: CameraIntent[],
    options: AutoZoomOptions,
    supportingEvents: RawClickEvent[],
): ZoomDepth {
    const intentBounds = getIntentBounds(intents);
    const boundedEvents = supportingEvents.filter((event) =>
        Number.isFinite(event.cx) && Number.isFinite(event.cy)
    );
    const bounds = boundedEvents.length > 0
        ? {
            minX: Math.min(intentBounds.minX, ...boundedEvents.map((event) => event.cx)),
            maxX: Math.max(intentBounds.maxX, ...boundedEvents.map((event) => event.cx)),
            minY: Math.min(intentBounds.minY, ...boundedEvents.map((event) => event.cy)),
            maxY: Math.max(intentBounds.maxY, ...boundedEvents.map((event) => event.cy)),
        }
        : intentBounds;
    const spanX = bounds.maxX - bounds.minX;
    const spanY = bounds.maxY - bounds.minY;
    const typingCount = intents.filter((intent) => intent.kind === 'typing').length;
    const pointCount = intents.filter((intent) => intent.kind === 'point').length;
    const hasDrag = intents.some((intent) => intent.kind === 'drag');
    const wheelBursts = boundedEvents.reduce((count, event, index) => {
        if (event.type !== 'wheel') return count;
        const previous = boundedEvents[index - 1];
        return count + (!previous || previous.type !== 'wheel' || event.timestamp - previous.timestamp > 250 ? 1 : 0);
    }, 0);
    let motionDistance = 0;
    for (let index = 1; index < boundedEvents.length; index += 1) {
        const previous = boundedEvents[index - 1];
        const current = boundedEvents[index];
        if (!['move', 'drag'].includes(current.type)) continue;
        motionDistance += Math.min(0.1, Math.hypot(current.cx - previous.cx, current.cy - previous.cy));
    }
    const localMotionDetail = spanX <= options.maxFocusSpan && spanY <= options.maxFocusSpan
        ? Math.min(4, Math.floor(motionDistance / 0.08))
        : 0;
    const detailScore = pointCount * 2
        + typingCount
        + (hasDrag ? 2 : 0)
        + Math.min(3, wheelBursts)
        + localMotionDetail;

    let requestedDepth = Number(options.depth) as number;
    if (detailScore >= 5) requestedDepth += 1;
    if (detailScore >= 10) requestedDepth += 1;
    if (detailScore >= 18) requestedDepth += 1;

    // A deeper fixed camera is only valid when every meaningful position in
    // the shot still fits inside the viewport with a predictable safe margin.
    const requiredWidth = Math.min(1, spanX + options.focusPadding * 2);
    const requiredHeight = Math.min(1, spanY + options.focusPadding * 2);
    const maximumScale = Math.min(
        requiredWidth > 0 ? 1 / requiredWidth : Infinity,
        requiredHeight > 0 ? 1 / requiredHeight : Infinity,
    );

    let fittingDepth = 1;
    for (let depth = 1; depth <= 6; depth += 1) {
        if (ZOOM_DEPTH_SCALES[depth as ZoomDepth] <= maximumScale) {
            fittingDepth = depth;
        }
    }

    return Math.max(1, Math.min(6, requestedDepth, fittingDepth)) as ZoomDepth;
}

function isInsideFixedShot(
    event: RawClickEvent,
    focus: { cx: number; cy: number },
    depth: ZoomDepth,
    focusPadding: number,
): boolean {
    const halfViewport = 1 / (ZOOM_DEPTH_SCALES[depth] * 2);
    const safeHalfViewport = Math.max(0.02, halfViewport - focusPadding);
    return Math.abs(event.cx - focus.cx) <= safeHalfViewport
        && Math.abs(event.cy - focus.cy) <= safeHalfViewport;
}

function constrainFocusToActionPath(
    preferredFocus: { cx: number; cy: number },
    depth: ZoomDepth,
    events: RawClickEvent[],
    focusPadding: number,
) {
    const boundedEvents = events.filter((event) =>
        Number.isFinite(event.cx) && Number.isFinite(event.cy)
    );
    if (boundedEvents.length === 0) return preferredFocus;

    const halfViewport = 1 / (ZOOM_DEPTH_SCALES[depth] * 2);
    const safeHalfViewport = Math.max(0.02, halfViewport - focusPadding);
    const minX = Math.min(...boundedEvents.map((event) => event.cx));
    const maxX = Math.max(...boundedEvents.map((event) => event.cx));
    const minY = Math.min(...boundedEvents.map((event) => event.cy));
    const maxY = Math.max(...boundedEvents.map((event) => event.cy));

    const focusMinX = maxX - safeHalfViewport;
    const focusMaxX = minX + safeHalfViewport;
    const focusMinY = maxY - safeHalfViewport;
    const focusMaxY = minY + safeHalfViewport;

    return {
        cx: Math.min(focusMaxX, Math.max(focusMinX, preferredFocus.cx)),
        cy: Math.min(focusMaxY, Math.max(focusMinY, preferredFocus.cy)),
    };
}

function trimShotToVisibleCursor(
    startMs: number,
    endMs: number,
    firstIntentMs: number,
    lastIntentMs: number,
    focus: { cx: number; cy: number },
    depth: ZoomDepth,
    events: RawClickEvent[],
    focusPadding: number,
) {
    let visibleStartMs = startMs;
    let visibleEndMs = endMs;

    const preRollEvents = events.filter((event) =>
        event.timestamp >= startMs && event.timestamp < firstIntentMs
    );
    const lastOutsideBeforeAction = [...preRollEvents]
        .reverse()
        .find((event) => !isInsideFixedShot(event, focus, depth, focusPadding));
    if (lastOutsideBeforeAction) {
        visibleStartMs = Math.max(visibleStartMs, Math.ceil(lastOutsideBeforeAction.timestamp));
    }

    const postRollEvents = events.filter((event) =>
        event.timestamp > lastIntentMs && event.timestamp <= endMs
    );
    const firstOutsideIndex = postRollEvents
        .findIndex((event) => !isInsideFixedShot(event, focus, depth, focusPadding));
    if (firstOutsideIndex >= 0) {
        let departureIndex = firstOutsideIndex;
        while (departureIndex > 0) {
            const current = postRollEvents[departureIndex];
            const previous = postRollEvents[departureIndex - 1];
            const isContinuousPointerMotion = ['move', 'drag'].includes(current.type)
                && ['move', 'drag'].includes(previous.type)
                && current.timestamp - previous.timestamp <= CURSOR_DEPARTURE_BURST_GAP_MS;
            if (!isContinuousPointerMotion) break;
            departureIndex -= 1;
        }
        visibleEndMs = Math.min(
            visibleEndMs,
            Math.floor(postRollEvents[departureIndex].timestamp),
        );
    }

    return { startMs: visibleStartMs, endMs: visibleEndMs };
}

export function generateAutoZooms(
    clicks: RawClickEvent[],
    options: Partial<AutoZoomOptions> = {}
): ZoomRegion[] {
    const opts = { ...DEFAULT_AUTO_ZOOM_OPTIONS, ...options };
    const regions: ZoomRegion[] = [];

    if (!clicks || clicks.length === 0) return [];

    const sortedEvents = [...clicks]
        .filter((event) => Number.isFinite(event.timestamp))
        .sort((a, b) => a.timestamp - b.timestamp);
    const maxFocusEndMs = opts.totalDurationMs && opts.totalDurationMs > 0
        ? Math.max(0, opts.totalDurationMs - opts.tailBaseViewMs)
        : Infinity;
    const intents = buildCameraIntents(sortedEvents)
        .filter((intent) => intent.timestamp < maxFocusEndMs);
    const intentGroups: CameraIntent[][] = [];

    for (const intent of intents) {
        const currentGroup = intentGroups[intentGroups.length - 1];
        if (currentGroup && !shouldStartNewShot(currentGroup, intent, opts)) {
            currentGroup.push(intent);
            continue;
        }
        intentGroups.push([intent]);
    }

    for (const group of intentGroups) {
        const firstIntent = group[0];
        const lastIntent = group[group.length - 1];
        let startMs = Math.max(0, Math.round(firstIntent.timestamp - opts.preRollMs));
        let endMs = Math.round(lastIntent.endTimestamp + opts.zoomDurationMs - opts.preRollMs);
        if (Number.isFinite(maxFocusEndMs)) {
            startMs = Math.min(startMs, maxFocusEndMs);
            endMs = Math.min(endMs, maxFocusEndMs);
        }
        if (endMs - startMs < opts.minRegionMs) {
            startMs = Math.max(0, endMs - opts.minRegionMs);
        }
        endMs = Math.min(endMs, startMs + opts.maxRegionMs);

        const supportingEvents = sortedEvents.filter((event) =>
            event.timestamp >= firstIntent.timestamp && event.timestamp <= lastIntent.endTimestamp
        );
        const depth = resolveAdaptiveDepth(group, opts, supportingEvents);
        const focus = constrainFocusToActionPath(
            resolveFixedFocus(group),
            depth,
            supportingEvents,
            opts.focusPadding,
        );
        const visibleSpan = trimShotToVisibleCursor(
            startMs,
            endMs,
            firstIntent.timestamp,
            lastIntent.endTimestamp,
            focus,
            depth,
            sortedEvents,
            opts.focusPadding,
        );
        startMs = visibleSpan.startMs;
        endMs = visibleSpan.endMs;

        const previous = regions[regions.length - 1];
        if (previous) {
            const gapMs = startMs - previous.endMs;
            if (gapMs >= 0 && gapMs <= opts.connectedGapMs) {
                // A short cursor journey is a camera transition, not an empty
                // base-view hole. The renderer interpolates between these two
                // fixed shot targets across their shared boundary.
                startMs = previous.endMs;
            } else if (gapMs < 0) {
                const boundaryMs = Math.max(previous.startMs + opts.minRegionMs, startMs);
                previous.endMs = boundaryMs;
                startMs = boundaryMs;
            }
        }
        if (endMs - startMs < opts.minRegionMs) continue;

        regions.push({
            id: `zoom-${Math.random().toString(36).slice(2, 11)}`,
            startMs,
            endMs,
            depth,
            focus,
            focusMode: 'manual',
            source: 'auto',
        });
    }

    return regions;
}
