import { screen } from 'electron';
import * as fs from 'fs/promises';
import { uIOhook, UiohookMouseEvent } from 'uiohook-napi';
import { NativeInputClock } from '../shared/cursorClock';

export type EventType = 'click' | 'mousedown' | 'mouseup' | 'drag' | 'keydown' | 'wheel' | 'move';

export interface MouseClickEvent {
    timestamp: number;  // milliseconds from recording start
    absoluteTime: number; // absolute UTC timestamp (ms)
    nativeTimeMs?: number; // native monotonic event timestamp (ms)
    x: number;          // absolute screen coordinates
    y: number;
    cx: number;         // normalized coordinates (0-1)
    cy: number;
    type: EventType;
    data?: any;         // optional metadata (e.g., keycode)
}

export interface RecordingBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

class MouseTracker {
    private isTracking = false;
    private startTime = 0;
    private events: MouseClickEvent[] = [];
    private recordingBounds: RecordingBounds | null = null;
    private lastX = 0;
    private lastY = 0;
    private lastMoveTime = 0;
    private lastRecordedX = -1;
    private lastRecordedY = -1;
    private primaryButtonDown = false;
    private nativeClock = new NativeInputClock();

    constructor() {
        this.handleInputCheck();
    }

    // Proactively check if we have input monitoring permissions?
    // Doing this by just initializing the hook and seeing if it works is one way,
    // but typically we just start it when needed.
    private handleInputCheck() {
        // Optional: Could verify permissions here on macOS
    }

    /**
     * Start tracking mouse clicks for a recording session
     * @param bounds The screen area being recorded (for coordinate normalization)
     */
    start(bounds?: RecordingBounds): void {
        if (this.isTracking) {
            console.warn('[MouseTracker] Already tracking, stopping previous session');
            this.stop();
        }

        this.isTracking = true;
        this.startTime = Date.now();
        this.events = [];
        this.nativeClock.reset();

        // If no bounds provided, use primary display dimensions
        if (bounds) {
            this.recordingBounds = bounds;
        } else {
            const primaryDisplay = screen.getPrimaryDisplay();
            this.recordingBounds = {
                x: primaryDisplay.bounds.x,
                y: primaryDisplay.bounds.y,
                width: primaryDisplay.bounds.width,
                height: primaryDisplay.bounds.height,
            };
        }

        const initialPosition = screen.getCursorScreenPoint();
        this.lastX = initialPosition.x;
        this.lastY = initialPosition.y;
        this.lastRecordedX = initialPosition.x;
        this.lastRecordedY = initialPosition.y;
        this.primaryButtonDown = false;

        // Initialize uiohook
        this.startGlobalTracking();

        console.log('[MouseTracker] Started tracking', {
            bounds: this.recordingBounds,
            startTime: this.startTime,
        });
    }

    /**
     * Stop tracking and return collected events
     */
    stop(): { events: MouseClickEvent[], bounds: RecordingBounds | null } {
        if (!this.isTracking) {
            uIOhook.stop();
            return { events: [], bounds: null };
        }

        this.isTracking = false;
        this.primaryButtonDown = false;
        this.stopGlobalTracking();

        const capturedEvents = [...this.events];
        const capturedBounds = this.recordingBounds;

        console.log('[MouseTracker] Stopped tracking', {
            eventsCount: capturedEvents.length,
            duration: Date.now() - this.startTime,
        });

        // DO NOT clear yet, let the handler decide when to clear or just rely on next start()
        return { events: capturedEvents, bounds: capturedBounds };
    }

    /**
     * Export click events to JSON file with absolute start time alignment
     */
    async exportToFile(outputPath: string, events: MouseClickEvent[], bounds: RecordingBounds | null, videoStartTime?: number): Promise<void> {
        // If absolute start time of the video is provided, align all event timestamps to perfectly eliminate IPC/negotiation delays!
        const timelineStartTime = videoStartTime || this.startTime;
        const processedEvents = events
            .map(e => {
                const absoluteTime = e.nativeTimeMs !== undefined
                    ? (this.nativeClock.toEpoch(e.nativeTimeMs) ?? e.absoluteTime)
                    : e.absoluteTime;
                return {
                    ...e,
                    absoluteTime,
                    timestamp: absoluteTime - timelineStartTime,
                };
            })
            // Input monitoring starts before ScreenCaptureKit so no input is
            // missed. Events before the first encoded frame do not belong to
            // the media timeline and must not leak into playback.
            .filter(e => !videoStartTime || e.timestamp >= 0);

        const data = {
            recordingBounds: bounds,
            startTime: this.startTime,
            videoStartTime: videoStartTime || this.startTime,
            events: processedEvents,
        };

        await fs.writeFile(
            outputPath,
            JSON.stringify(data, null, 2),
            'utf-8'
        );

        // NOW clear the state after successful export
        this.events = [];
        this.recordingBounds = null;

        console.log('[MouseTracker] Exported to', outputPath, videoStartTime ? `with alignment relative to ${videoStartTime}` : '');
    }

    /**
     * Get current tracking status
     */
    getStatus(): { isTracking: boolean; eventCount: number } {
        return {
            isTracking: this.isTracking,
            eventCount: this.events.length,
        };
    }

    private startGlobalTracking(): void {
        // Register native listener
        // Pre-initialize recorded position to current mouse pos to avoid t=0 jumps
        this.lastRecordedX = this.lastX;
        this.lastRecordedY = this.lastY;
        this.lastMoveTime = 0;

        uIOhook.on('mousedown', (e: UiohookMouseEvent) => {
            if (!this.isTracking) return;
            if (e.button === 1) {
                this.primaryButtonDown = true;
                this.addEvent(e.x, e.y, 'mousedown', undefined, this.captureNativeEventTime(e.time));
            }
        });

        uIOhook.on('mouseup', (e: UiohookMouseEvent) => {
            if (!this.isTracking) return;
            if (e.button === 1) {
                this.primaryButtonDown = false;
                this.addEvent(e.x, e.y, 'mouseup', undefined, this.captureNativeEventTime(e.time));
            }
        });

        const handleMoveOrDrag = (x: number, y: number, rawEventTime: number) => {
            this.lastX = x;
            this.lastY = y;

            if (!this.isTracking) return;

            const nativeTimeMs = this.captureNativeEventTime(rawEventTime);
            const now = nativeTimeMs ?? Date.now();
            const timeElapsed = now - this.lastMoveTime;

            // Target 60fps sampling rate (minimum 16ms between consecutive logs)
            // only recording actual coordinate updates to avoid file bloat when stationary
            if (timeElapsed >= 16) {
                if (x !== this.lastRecordedX || y !== this.lastRecordedY) {
                    this.addEvent(x, y, this.primaryButtonDown ? 'drag' : 'move', undefined, nativeTimeMs);
                    this.lastRecordedX = x;
                    this.lastRecordedY = y;
                    this.lastMoveTime = now;
                }
            }
        };

        uIOhook.on('mousemove', (e: UiohookMouseEvent) => {
            handleMoveOrDrag(e.x, e.y, e.time);
        });

        uIOhook.on('keydown', (e) => {
            if (!this.isTracking) return;
            // Record typing at the current cursor position
            this.addEvent(
                this.lastX,
                this.lastY,
                'keydown',
                { keycode: e.keycode },
                this.captureNativeEventTime(e.time),
            );
        });

        uIOhook.on('wheel', (e) => {
            if (!this.isTracking) return;
            this.addEvent(
                this.lastX,
                this.lastY,
                'wheel',
                { amount: e.amount, rotation: e.rotation },
                this.captureNativeEventTime(e.time),
            );
        });

        uIOhook.start();
        console.log('[MouseTracker] uIOhook started with extended action tracking');
    }

    private stopGlobalTracking(): void {
        uIOhook.stop();
        uIOhook.removeAllListeners();
        console.log('[MouseTracker] uIOhook stopped');
    }

    private captureNativeEventTime(rawEventTime: number): number | undefined {
        if (!Number.isFinite(rawEventTime) || rawEventTime <= 0) return undefined;

        return this.nativeClock.observe(rawEventTime, Date.now(), process.platform) ?? undefined;
    }

    addEvent(x: number, y: number, type: EventType, data?: any, nativeTimeMs?: number): void {
        if (!this.isTracking || !this.recordingBounds) {
            return;
        }

        const absoluteTime = nativeTimeMs !== undefined
            ? (this.nativeClock.toEpoch(nativeTimeMs) ?? Date.now())
            : Date.now();
        const timestamp = absoluteTime - this.startTime;

        // Normalize coordinates
        const cx = (x - this.recordingBounds.x) / this.recordingBounds.width;
        const cy = (y - this.recordingBounds.y) / this.recordingBounds.height;

        const event: MouseClickEvent = {
            timestamp,
            absoluteTime,
            nativeTimeMs,
            x,
            y,
            cx,
            cy,
            type,
            data
        };

        // Debouncing logic for keydown to prevent flooding
        if (type === 'keydown') {
            const lastEvent = this.events[this.events.length - 1];
            if (lastEvent && lastEvent.type === 'keydown' && (timestamp - lastEvent.timestamp < 100)) {
                // Too fast, maybe update last event data instead of pushing new one
                return;
            }
        }

        this.events.push(event);
    }
}

// Singleton instance
export const mouseTracker = new MouseTracker();
