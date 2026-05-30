import React, { useCallback, useEffect, useRef, useState } from 'react';
import { VolumeKeyframe } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface VolumeEnvelopeProps {
  keyframes?: VolumeKeyframe[];
  baseVolume: number;
  onChange: (keyframes: VolumeKeyframe[]) => void;
}

export default function VolumeEnvelope({ keyframes, baseVolume, onChange }: VolumeEnvelopeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Ensure we always have at least a start and end keyframe
  const effectiveKeyframes = React.useMemo(() => {
    if (keyframes && keyframes.length > 0) {
      // Sort by timeRatio
      return [...keyframes].sort((a, b) => a.timeRatio - b.timeRatio);
    }
    return [
      { id: 'start', timeRatio: 0, volume: baseVolume },
      { id: 'end', timeRatio: 1, volume: baseVolume }
    ];
  }, [keyframes, baseVolume]);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingLine, setDraggingLine] = useState(false);
  const startVolRef = useRef<{ id: string, startVol: number }[]>([]);
  const startYRef = useRef<number>(0);

  // Convert volume (0-2) to Y coordinate (percent). 
  // 0% volume = 100% Y (bottom)
  // 100% volume = 50% Y (middle)
  // 200% volume = 0% Y (top)
  const volToY = (vol: number) => 100 - (vol / 2) * 100;
  
  // Convert Y pixel to volume (0-2)
  const yToVol = (y: number, height: number) => {
    const ratio = 1 - (y / height);
    return Math.max(0, Math.min(2, ratio * 2));
  };

  // Convert X pixel to timeRatio (0-1)
  const xToRatio = (x: number, width: number) => {
    return Math.max(0, Math.min(1, x / width));
  };

  // Render SVG Path
  const pathD = effectiveKeyframes.map((kf, i) => {
    const x = kf.timeRatio * 100;
    const y = volToY(kf.volume);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    
    if (draggingLine) {
      // Dragging the entire line
      const deltaY = e.clientY - startYRef.current;
      const deltaVol = -(deltaY / rect.height) * 2; // pixel to volume delta
      
      const newKeyframes = effectiveKeyframes.map(kf => {
        const startState = startVolRef.current.find(s => s.id === kf.id);
        const baseVol = startState ? startState.startVol : kf.volume;
        return {
          ...kf,
          volume: Math.max(0, Math.min(2, baseVol + deltaVol))
        };
      });
      onChange(newKeyframes);
      return;
    }

    if (!draggingId) return;
    
    const newVol = yToVol(e.clientY - rect.top, rect.height);
    const newRatio = xToRatio(e.clientX - rect.left, rect.width);

    const newKeyframes = effectiveKeyframes.map(kf => {
      if (kf.id === draggingId) {
        const isEndpoint = kf.timeRatio === 0 || kf.timeRatio === 1 || kf.id === 'start' || kf.id === 'end';
        return {
          ...kf,
          volume: newVol,
          timeRatio: isEndpoint ? kf.timeRatio : newRatio
        };
      }
      return kf;
    });

    newKeyframes.sort((a, b) => a.timeRatio - b.timeRatio);
    if (newKeyframes[0].timeRatio !== 0) newKeyframes[0].timeRatio = 0;
    if (newKeyframes[newKeyframes.length - 1].timeRatio !== 1) newKeyframes[newKeyframes.length - 1].timeRatio = 1;

    onChange(newKeyframes);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingLine) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      setDraggingLine(false);
    }
    if (draggingId) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      setDraggingId(null);
    }
  };

  const handleLinePointerDown = (e: React.PointerEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x <= 12 || x >= rect.width - 12) {
        return; // Let it bubble for resize handles
      }
    }
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggingLine(true);
    startYRef.current = e.clientY;
    startVolRef.current = effectiveKeyframes.map(kf => ({ id: kf.id, startVol: kf.volume }));
  };

  const handleLineDoubleClick = (e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x <= 12 || x >= rect.width - 12) {
        return; 
      }
    }
    e.stopPropagation();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const ratio = xToRatio(e.clientX - rect.left, rect.width);
    const vol = yToVol(e.clientY - rect.top, rect.height);
    
    const newKf: VolumeKeyframe = { id: uuidv4(), timeRatio: ratio, volume: vol };
    const newKeyframes = [...effectiveKeyframes, newKf].sort((a, b) => a.timeRatio - b.timeRatio);
    onChange(newKeyframes);
  };

  const handlePointDoubleClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    // Don't delete if only 2 points left
    if (effectiveKeyframes.length <= 2) return;
    
    // Prevent deleting strictly endpoint
    const kf = effectiveKeyframes.find(k => k.id === id);
    if (kf && (kf.timeRatio === 0 || kf.timeRatio === 1 || kf.id === 'start' || kf.id === 'end')) return;

    onChange(effectiveKeyframes.filter(k => k.id !== id));
  };

  const handlePointPointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggingId(id);
  };

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
    >
      <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
        {/* Invisible thick path for easy interaction (dragging line & double click to add point) */}
        <path 
          d={pathD} 
          fill="none" 
          stroke="transparent" 
          strokeWidth="15" 
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: 'auto', cursor: 'row-resize' }}
          onPointerDown={handleLinePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={handleLineDoubleClick}
        />
        {/* Visible thin path */}
        <path 
          d={pathD} 
          fill="none" 
          stroke="rgba(255, 255, 255, 0.8)" 
          strokeWidth="1.5" 
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: 'none' }}
        />
      </svg>
      {effectiveKeyframes.map((kf) => (
        <div
          key={kf.id}
          className="absolute w-3 h-3 bg-white rounded-full shadow-md -ml-1.5 -mt-1.5 cursor-move"
          style={{ 
            left: `${kf.timeRatio * 100}%`, 
            top: `${volToY(kf.volume)}%`,
            pointerEvents: 'auto',
            transform: draggingId === kf.id ? 'scale(1.5)' : 'scale(1)',
            transition: draggingId ? 'none' : 'transform 0.1s'
          }}
          onPointerDown={(e) => handlePointPointerDown(e, kf.id)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={(e) => handlePointDoubleClick(e, kf.id)}
        />
      ))}
    </div>
  );
}
