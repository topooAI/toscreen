import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { Application, Container } from "pixi.js";

export function usePixiApp(containerRef: React.RefObject<HTMLDivElement>) {
  const [pixiReady, setPixiReady] = useState(false);
  const appRef = useRef<Application | null>(null);
  const cameraContainerRef = useRef<Container | null>(null);
  const videoContainerRef = useRef<Container | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let mounted = true;
    let app: Application | null = null;
    let handleContextLost: ((event: Event) => void) | null = null;

    (async () => {
      try {
        app = new Application();
        
        await app.init({
          preference: 'webgl',
          width: container.clientWidth,
          height: container.clientHeight,
          backgroundAlpha: 0,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        });
      } catch (error) {
        console.warn('[usePixiApp] PIXI renderer unavailable; advanced preview disabled.', error);
        app = null;
        return;
      }

      app.ticker.maxFPS = 60;

      if (!mounted) {
        app.destroy(true, { children: true, texture: true, textureSource: true });
        return;
      }

      appRef.current = app;
      
      // Enforce absolute top-left alignment on canvas to eliminate layout margin offsets
      app.canvas.style.position = 'absolute';
      app.canvas.style.left = '0';
      app.canvas.style.top = '0';
      app.canvas.style.width = '100%';
      app.canvas.style.height = '100%';

      handleContextLost = (event: Event) => {
        event.preventDefault();
        console.warn('[usePixiApp] WebGL context lost; falling back to native video preview.');
        app!.canvas.style.display = 'none';
        setPixiReady(false);
      };

      app.canvas.addEventListener('webglcontextlost', handleContextLost);

      container.appendChild(app.canvas);

      // Camera container - this will be scaled/positioned for zoom
      const cameraContainer = new Container();
      cameraContainerRef.current = cameraContainer;
      app.stage.addChild(cameraContainer);

      // Video container - holds the masked video sprite
      const videoContainer = new Container();
      videoContainerRef.current = videoContainer;
      cameraContainer.addChild(videoContainer);
      
      setPixiReady(true);
    })();

    return () => {
      mounted = false;
      setPixiReady(false);
      
      const app = appRef.current;
      if (app) {
        if (handleContextLost) {
          app.canvas.removeEventListener('webglcontextlost', handleContextLost);
        }
        // Destroy the app only if it's still healthy
        if (app.renderer) {
          app.destroy(true, { children: true, texture: true, textureSource: true });
        }
      }
      
      appRef.current = null;
      cameraContainerRef.current = null;
      videoContainerRef.current = null;
    };
  }, [containerRef]);

  return {
    pixiReady,
    appRef,
    cameraContainerRef,
    videoContainerRef,
  };
}
