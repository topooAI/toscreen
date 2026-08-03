export type CursorClockPlatform = 'darwin' | 'win32' | 'linux' | string;

export function nativeInputTimeToMs(
  rawEventTime: number,
  platform: CursorClockPlatform,
): number | null {
  if (!Number.isFinite(rawEventTime) || rawEventTime <= 0) return null;
  return platform === 'darwin' ? rawEventTime / 1_000_000 : rawEventTime;
}

export class NativeInputClock {
  private nativeToEpochOffsetMs: number | null = null;

  reset(): void {
    this.nativeToEpochOffsetMs = null;
  }

  observe(
    rawEventTime: number,
    callbackEpochMs: number,
    platform: CursorClockPlatform,
  ): number | null {
    const nativeTimeMs = nativeInputTimeToMs(rawEventTime, platform);
    if (nativeTimeMs === null || !Number.isFinite(callbackEpochMs)) return null;

    // Callback delivery can only make this candidate later. Retaining the
    // smallest observed offset removes main-thread scheduling delay.
    const offsetCandidate = callbackEpochMs - nativeTimeMs;
    if (
      this.nativeToEpochOffsetMs === null
      || offsetCandidate < this.nativeToEpochOffsetMs
    ) {
      this.nativeToEpochOffsetMs = offsetCandidate;
    }
    return nativeTimeMs;
  }

  toEpoch(nativeTimeMs: number): number | null {
    if (!Number.isFinite(nativeTimeMs) || this.nativeToEpochOffsetMs === null) return null;
    return nativeTimeMs + this.nativeToEpochOffsetMs;
  }
}
