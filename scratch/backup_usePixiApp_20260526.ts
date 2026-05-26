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

    (async () => {
      app = new Application();
      
      await app.init({
        width: container.clientWidth,
        height: container.clientHeight,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      app.ticker.maxFPS = 60;

      if (!mounted) {
        app.destroy(true, { children: true, texture: true, textureSource: true });
        return;
      }

      appRef.current = app;
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
