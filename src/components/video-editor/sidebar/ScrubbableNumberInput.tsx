import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface ScrubbableNumberInputProps {
    value: number;
    onValueChange?: (value: number) => void;
    min: number;
    max: number;
    step?: number;
    unit?: string;
    disabled?: boolean;
    className?: string;
    dragPixelsPerStep?: number;
}

function decimalPlaces(step: number) {
    const value = String(step);
    return value.includes('.') ? value.split('.')[1].length : 0;
}

export function ScrubbableNumberInput({
    value,
    onValueChange,
    min,
    max,
    step = 1,
    unit,
    disabled = false,
    className,
    dragPixelsPerStep = 4,
}: ScrubbableNumberInputProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const cleanupDragRef = useRef<(() => void) | null>(null);
    const dragRef = useRef<{
        pointerId: number;
        startX: number;
        startValue: number;
        dragging: boolean;
    } | null>(null);
    const precision = decimalPlaces(step);
    const formatValue = (nextValue: number) => precision > 0
        ? nextValue.toFixed(precision)
        : String(Math.round(nextValue));
    const [draft, setDraft] = useState(() => formatValue(value));

    useEffect(() => {
        if (document.activeElement !== inputRef.current || dragRef.current?.dragging) {
            setDraft(formatValue(value));
        }
    }, [value, precision]);

    useEffect(() => () => {
        cleanupDragRef.current?.();
        document.body.style.removeProperty('cursor');
        document.body.style.removeProperty('user-select');
    }, []);

    const normalize = (nextValue: number) => {
        const clamped = Math.min(max, Math.max(min, nextValue));
        return Number(clamped.toFixed(precision));
    };

    const commitDraft = () => {
        const parsed = Number(draft.trim().replace(',', '.'));
        const nextValue = Number.isFinite(parsed) ? normalize(parsed) : normalize(value);
        setDraft(formatValue(nextValue));
        onValueChange?.(nextValue);
    };

    const restoreDocumentInteraction = () => {
        document.body.style.removeProperty('cursor');
        document.body.style.removeProperty('user-select');
    };

    return (
        <div
            className={cn(
                "flex h-7 min-w-0 items-center rounded-[5px] border border-transparent bg-[var(--ui-control)] px-2 transition-colors",
                "hover:border-[var(--ui-border)] focus-within:border-[#0D99FF] focus-within:bg-[var(--ui-segment-selected)]",
                disabled && "pointer-events-none opacity-45",
                className,
            )}
            title="Drag horizontally to adjust, or click to type"
        >
            <input
                ref={inputRef}
                value={draft}
                inputMode="decimal"
                disabled={disabled}
                aria-label="Numeric value"
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commitDraft}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        commitDraft();
                        event.currentTarget.blur();
                    } else if (event.key === 'Escape') {
                        setDraft(formatValue(value));
                        event.currentTarget.blur();
                    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                        event.preventDefault();
                        const direction = event.key === 'ArrowUp' ? 1 : -1;
                        const nextValue = normalize(value + direction * step);
                        setDraft(formatValue(nextValue));
                        onValueChange?.(nextValue);
                    }
                }}
                onMouseDown={(event) => {
                    if (disabled || event.button !== 0) return;
                    event.preventDefault();
                    event.currentTarget.focus({ preventScroll: true });
                    cleanupDragRef.current?.();
                    dragRef.current = {
                        pointerId: 0,
                        startX: event.clientX,
                        startValue: value,
                        dragging: false,
                    };

                    const handleMouseMove = (moveEvent: MouseEvent) => {
                        const drag = dragRef.current;
                        if (!drag) return;

                        const deltaX = moveEvent.clientX - drag.startX;
                        if (!drag.dragging && Math.abs(deltaX) >= 3) {
                            drag.dragging = true;
                            document.body.style.cursor = 'ew-resize';
                            document.body.style.userSelect = 'none';
                        }
                        if (!drag.dragging) return;

                        moveEvent.preventDefault();
                        const stepDelta = Math.round(deltaX / dragPixelsPerStep);
                        const nextValue = normalize(drag.startValue + stepDelta * step);
                        setDraft(formatValue(nextValue));
                        onValueChange?.(nextValue);
                    };

                    const handleMouseUp = () => {
                        const wasDragging = dragRef.current?.dragging ?? false;
                        cleanupDragRef.current?.();
                        if (!wasDragging) {
                            requestAnimationFrame(() => inputRef.current?.select());
                        }
                    };

                    const cleanup = () => {
                        window.removeEventListener('mousemove', handleMouseMove);
                        window.removeEventListener('mouseup', handleMouseUp);
                        cleanupDragRef.current = null;
                        dragRef.current = null;
                        restoreDocumentInteraction();
                    };

                    cleanupDragRef.current = cleanup;
                    window.addEventListener('mousemove', handleMouseMove);
                    window.addEventListener('mouseup', handleMouseUp, { once: true });
                }}
                className="min-w-0 flex-1 cursor-ew-resize bg-transparent text-right text-[12px] font-medium tabular-nums text-[var(--ui-text-secondary)] outline-none selection:bg-[#0D99FF]/25"
            />
            {unit && (
                <span className="ml-1 shrink-0 text-[11px] text-[var(--ui-text-tertiary)]">{unit}</span>
            )}
        </div>
    );
}
