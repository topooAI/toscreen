import React, { useEffect, useState } from 'react';
import { ZoomRegion, ZOOM_DEPTH_SCALES } from '../types';
import {
  buildThumbnailSegments,
  getZoomBoundaryPercents,
  type ThumbnailSegment,
} from './timelineThumbnailSegments';

interface VideoThumbnailsProps {
  id: string;
  src?: string;
  sourceStartMs: number;
  effTotalDuration: number;
  svgOffset: number;
  pxPerMs: number;
  zoomRegions?: ZoomRegion[];
  boundaryZoomRegions?: ZoomRegion[];
  clipStartMs?: number;
}

const THUMBNAIL_WIDTH = 64; // px
const THUMBNAIL_HEIGHT = 64; // px, matches compressed main clip height
const MAX_THUMBNAILS = 30; // Limit to prevent crashing

export function VideoThumbnails({ id, src, sourceStartMs, effTotalDuration, svgOffset, pxPerMs, zoomRegions, boundaryZoomRegions, clipStartMs: _clipStartMs }: VideoThumbnailsProps) {
  const [segments, setSegments] = useState<ThumbnailSegment[]>([]);

  const absoluteWidth = Math.max(1, effTotalDuration * pxPerMs);
  const absoluteLeft = 0;
  const thumbnailZoomRegions = boundaryZoomRegions || zoomRegions || [];
  const thumbnailZoomSignature = JSON.stringify(thumbnailZoomRegions);
  const zoomBoundaryPercents = React.useMemo(() => {
    return getZoomBoundaryPercents(sourceStartMs, effTotalDuration, thumbnailZoomRegions);
  }, [effTotalDuration, sourceStartMs, thumbnailZoomSignature]);

  useEffect(() => {
    if (!src || absoluteWidth <= 0 || effTotalDuration <= 0) return;

    const nextSegments = buildThumbnailSegments(sourceStartMs, effTotalDuration, thumbnailZoomRegions);
    const totalRequested = nextSegments.reduce((sum, segment) => {
      const segmentWidth = (segment.endMs - segment.startMs) * pxPerMs;
      return sum + Math.max(1, Math.ceil(segmentWidth / THUMBNAIL_WIDTH));
    }, 0);
    const throttleRatio = totalRequested > MAX_THUMBNAILS ? MAX_THUMBNAILS / totalRequested : 1;
    const captureJobs = nextSegments.flatMap((segment, segmentIndex) => {
      const segmentDuration = Math.max(1, segment.endMs - segment.startMs);
      const segmentWidth = segmentDuration * pxPerMs;
      const requestedCount = Math.max(1, Math.ceil(segmentWidth / THUMBNAIL_WIDTH));
      const count = Math.max(1, Math.floor(requestedCount * throttleRatio));
      const intervalMs = segmentDuration / count;

      return Array.from({ length: count }, (_, imageIndex) => ({
        segmentIndex,
        sourceMs: Math.min(segment.endMs - 1, segment.startMs + imageIndex * intervalMs),
      }));
    });

    let isMounted = true;
    let currentIndex = 0;
    const renderedSegments = nextSegments.map((segment) => ({ ...segment, images: [] as string[] }));

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    if (src.startsWith('http') && !src.startsWith('blob:')) {
      video.crossOrigin = 'anonymous';
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const captureNext = () => {
      if (!isMounted || currentIndex >= captureJobs.length) {
        setSegments(renderedSegments);
        return;
      }
      try {
        video.currentTime = captureJobs[currentIndex].sourceMs / 1000;
      } catch (e) {
        console.error('VideoThumbnails seek error:', e);
        setSegments(renderedSegments);
      }
    };

    const handleSeeked = () => {
      if (!isMounted || !ctx) return;

      const job = captureJobs[currentIndex];
      const segment = renderedSegments[job.segmentIndex];
      if (!job || !segment) return;

      if (currentIndex === 0) {
        const aspect = video.videoWidth / video.videoHeight || 16/9;
        const scale = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        canvas.width = Math.round(THUMBNAIL_HEIGHT * aspect * scale);
        canvas.height = Math.round(THUMBNAIL_HEIGHT * scale);
      }

      try {
        if (segment.zoom) {
          const scale = ZOOM_DEPTH_SCALES[segment.zoom.depth] || 1;
          const sWidth = video.videoWidth / scale;
          const sHeight = video.videoHeight / scale;
          
          let sx = (video.videoWidth * segment.zoom.focus.cx) - (sWidth / 2);
          let sy = (video.videoHeight * segment.zoom.focus.cy) - (sHeight / 2);
          
          // clamp to edges
          sx = Math.max(0, Math.min(sx, video.videoWidth - sWidth));
          sy = Math.max(0, Math.min(sy, video.videoHeight - sHeight));

          ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
        } else {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
        segment.images.push(canvas.toDataURL('image/jpeg', 0.82));
      } catch (e) {
        console.error('VideoThumbnails draw error:', e);
      }
      
      currentIndex++;
      captureNext();
    };

    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('loadedmetadata', () => {
      captureNext();
    });
    video.addEventListener('error', () => {
      console.error('VideoThumbnails load error:', video.error);
    });

    // Attach src after listeners to avoid race conditions
    video.src = src;

    return () => {
      isMounted = false;
      video.removeEventListener('seeked', handleSeeked);
      video.removeAttribute('src');
    };
  }, [src, absoluteWidth, effTotalDuration, pxPerMs, thumbnailZoomSignature, sourceStartMs]);

  if (!src || segments.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-90">
      <div 
        id={`thumbnails-${id}`}
        style={{
          position: 'absolute',
          left: `${absoluteLeft}px`,
          width: `${absoluteWidth}px`,
          height: '100%',
          display: 'flex',
          transformOrigin: 'left',
          transform: `translateX(${svgOffset}px)`,
        }}
      >
        {segments.map((segment) => {
          const segmentPercent = ((segment.endMs - segment.startMs) / Math.max(1, effTotalDuration)) * 100;
          return (
            <div
              key={segment.id}
              className="h-full flex overflow-hidden"
              style={{
                width: `${segmentPercent}%`,
              }}
            >
              {segment.images.map((dataUri, i) => (
                <img
                  key={`${segment.id}-${i}`}
                  src={dataUri}
                  alt=""
                  className="h-full object-cover"
                  style={{ width: `${100 / Math.max(1, segment.images.length)}%` }}
                />
              ))}
            </div>
          );
        })}
      </div>
      {zoomBoundaryPercents.map((percent) => (
        <div
          key={`zoom-boundary-${percent}`}
          className="absolute pointer-events-none"
          style={{
            left: `${percent}%`,
            top: '15%',
            height: '70%',
            borderLeft: '1px dashed rgba(255,255,255,0.86)',
            zIndex: 25,
          }}
        />
      ))}
      {/* Semi-transparent black mask to improve text legibility */}
      <div className="absolute inset-0 bg-black/40 mix-blend-multiply z-10" />
    </div>
  );
}
