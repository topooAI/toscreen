import { screen } from 'electron';
import * as fs from 'fs/promises';
import { uIOhook, UiohookMouseEvent } from 'uiohook-napi';

export type EventType = 'click' | 'keydown' | 'wheel' | 'move';

export interface MouseClickEvent {
    timestamp: number;  // milliseconds from recording start
    absoluteTime: number; // absolute UTC timestamp (ms)
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

        // If no bounds provided, use primary display dimensions
        if (bounds) {
            this.recordingBounds = bounds;
        } else {
            const primaryDisplay = screen.getPrimaryDisplay();
            const scale = primaryDisplay.scaleFactor || 1;
            this.recordingBounds = {
                x: primaryDisplay.bounds.x * scale,
                y: primaryDisplay.bounds.y * scale,
                width: primaryDisplay.bounds.width * scale,
                height: primaryDisplay.bounds.height * scale,
            };
        }

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
        const processedEvents = videoStartTime
            ? events.map(e => ({
                ...e,
                timestamp: e.absoluteTime - videoStartTime
            }))
            : events;

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
        this.lastMoveTime = Date.now();

        uIOhook.on('mousedown', (e: UiohookMouseEvent) => {
            if (!this.isTracking) return;
            if (e.button === 1) {
                this.addEvent(e.x, e.y, 'click');
            }
        });

        const handleMoveOrDrag = (x: number, y: number) => {
            this.lastX = x;
            this.lastY = y;

            if (!this.isTracking) return;

            const now = Date.now();
            const timeElapsed = now - this.lastMoveTime;

            // Target 60fps sampling rate (minimum 16ms between consecutive logs)
            // only recording actual coordinate updates to avoid file bloat when stationary
            if (timeElapsed >= 16) {
                if (x !== this.lastRecordedX || y !== this.lastRecordedY) {
                    this.addEvent(x, y, 'move');
                    this.lastRecordedX = x;
                    this.lastRecordedY = y;
                    this.lastMoveTime = now;
                }
            }
        };

        uIOhook.on('mousemove', (e: UiohookMouseEvent) => {
            handleMoveOrDrag(e.x, e.y);
        });

        uIOhook.on('mousedrag' as any, (e: UiohookMouseEvent) => {
            handleMoveOrDrag(e.x, e.y);
        });

        uIOhook.on('keydown', (e) => {
            if (!this.isTracking) return;
            // Record typing at the current cursor position
            this.addEvent(this.lastX, this.lastY, 'keydown', { keycode: e.keycode });
        });

        uIOhook.on('wheel', (e) => {
            if (!this.isTracking) return;
            this.addEvent(this.lastX, this.lastY, 'wheel', { amount: e.amount, rotation: e.rotation });
        });

        uIOhook.start();
        console.log('[MouseTracker] uIOhook started with extended action tracking');
    }

    private stopGlobalTracking(): void {
        uIOhook.stop();
        uIOhook.removeAllListeners();
        console.log('[MouseTracker] uIOhook stopped');
    }

    addEvent(x: number, y: number, type: EventType, data?: any): void {
        if (!this.isTracking || !this.recordingBounds) {
            return;
        }

        const absoluteTime = Date.now();
        const timestamp = absoluteTime - this.startTime;

        // Normalize coordinates
        const cx = (x - this.recordingBounds.x) / this.recordingBounds.width;
        const cy = (y - this.recordingBounds.y) / this.recordingBounds.height;

        const event: MouseClickEvent = {
            timestamp,
            absoluteTime,
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
