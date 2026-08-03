import { useCallback, useEffect, useRef, useState } from "react";
import { fixWebmDuration } from "@fix-webm-duration/fix";

export type RecordingConfiguration = RecordingOptions & { countdownSeconds?: number };
export type RecordingPhase = "idle" | "countdown" | "recording" | "paused" | "processing" | "error";

type UseScreenRecorderReturn = {
  recording: boolean;
  phase: RecordingPhase;
  countdown: number | null;
  error: string | null;
  startRecording: (configuration?: RecordingConfiguration) => Promise<void>;
  stopRecording: () => Promise<void>;
  pauseRecording: () => Promise<void>;
  resumeRecording: () => Promise<void>;
  cancelRecording: () => Promise<void>;
  retakeRecording: () => Promise<void>;
  toggleRecording: () => void;
  isProcessing: boolean;
  processProgress: number;
};

const TARGET_FRAME_RATE = 60;
const TARGET_WIDTH = 3840;
const TARGET_HEIGHT = 2160;

export function useScreenRecorder(): UseScreenRecorderReturn {
  const [phase, setPhase] = useState<RecordingPhase>("idle");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processProgress, setProcessProgress] = useState(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startTime = useRef(0);
  const isNativeRef = useRef(false);
  const cancelledRef = useRef(false);
  const lastConfiguration = useRef<RecordingConfiguration>({ countdownSeconds: 3 });

  const finishRecording = useCallback(async (outputPath: string, audioPath?: string) => {
    setPhase("processing");
    setProcessProgress(0);
    const unsubscribe = window.electronAPI.onProxyGenerationProgress(setProcessProgress);
    try {
      const proxyResult = await window.electronAPI.generateProxyVideo(outputPath);
      await window.electronAPI.setCurrentVideoPath(outputPath, proxyResult.success ? proxyResult.proxyPath : undefined, audioPath);
      await window.electronAPI.switchToEditor();
    } finally {
      unsubscribe();
      setPhase("idle");
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (isNativeRef.current) {
      const result = await window.electronAPI.stopNativeRecording();
      isNativeRef.current = false;
      if (!result.success || !result.outputPath) {
        setError(result.error || "Unable to stop recording");
        setPhase("error");
        return;
      }
      if (!cancelledRef.current) await finishRecording(result.outputPath, result.audioOutputPath);
      else {
        await window.electronAPI.discardRecordingArtifacts([result.outputPath, result.audioOutputPath]);
        setPhase("idle");
      }
      return;
    }
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      stream.current?.getTracks().forEach(track => track.stop());
      mediaRecorder.current.stop();
      await window.electronAPI.setRecordingState(false, startTime.current);
    }
  }, [finishRecording]);

  useEffect(() => {
    const cleanup = window.electronAPI.onStopRecordingFromTray(() => void stopRecording());
    return () => {
      cleanup();
      stream.current?.getTracks().forEach(track => track.stop());
    };
  }, [stopRecording]);

  const startWebRecording = useCallback(async () => {
    const selectedSource = await window.electronAPI.getSelectedSource();
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: "desktop",
          chromeMediaSourceId: selectedSource.id,
          maxWidth: TARGET_WIDTH,
          maxHeight: TARGET_HEIGHT,
          maxFrameRate: TARGET_FRAME_RATE,
        },
      } as MediaTrackConstraints,
    } as MediaStreamConstraints);
    stream.current = mediaStream;
    const settings = mediaStream.getVideoTracks()[0].getSettings();
    const pixels = (settings.width || 1920) * (settings.height || 1080);
    const bitrate = pixels >= TARGET_WIDTH * TARGET_HEIGHT ? 76_500_000 : pixels >= 2560 * 1440 ? 47_600_000 : 30_600_000;
    const preferred = ["video/webm;codecs=av1", "video/webm;codecs=h264", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    const mimeType = preferred.find(type => MediaRecorder.isTypeSupported(type)) || "video/webm";
    const recorder = new MediaRecorder(mediaStream, { mimeType, videoBitsPerSecond: bitrate });
    mediaRecorder.current = recorder;
    chunks.current = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.current.push(event.data); };
    recorder.onerror = () => { setError("MediaRecorder failed"); setPhase("error"); };
    recorder.onstop = async () => {
      stream.current = null;
      if (cancelledRef.current || chunks.current.length === 0) { chunks.current = []; setPhase("idle"); return; }
      const blob = await fixWebmDuration(new Blob(chunks.current, { type: mimeType }), Date.now() - startTime.current);
      chunks.current = [];
      const result = await window.electronAPI.storeRecordedVideo(await blob.arrayBuffer(), `recording-${Date.now()}.webm`);
      if (result.success && result.path) await finishRecording(result.path);
      else { setError(result.message || "Unable to store recording"); setPhase("error"); }
    };
    recorder.start(1000);
    startTime.current = Date.now();
    await window.electronAPI.setRecordingState(true);
    setPhase("recording");
  }, [finishRecording]);

  const startRecording = useCallback(async (configuration: RecordingConfiguration = lastConfiguration.current) => {
    try {
      const selectedSource = await window.electronAPI.getSelectedSource();
      if (!selectedSource) throw new Error("Select a display, window, or area before recording");
      lastConfiguration.current = configuration;
      cancelledRef.current = false;
      setError(null);
      const seconds = Math.max(0, configuration.countdownSeconds ?? 3);
      for (let value = seconds; value > 0; value -= 1) {
        setPhase("countdown");
        setCountdown(value);
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (cancelledRef.current) { setCountdown(null); setPhase("idle"); return; }
      }
      setCountdown(null);
      const nativeAvailable = await window.electronAPI.isNativeRecordingAvailable();
      if (nativeAvailable) {
        const result = await window.electronAPI.startNativeRecording(configuration);
        if (result.success) {
          isNativeRef.current = true;
          startTime.current = Date.now();
          setPhase("recording");
          return;
        }
        console.warn("Native recording failed; using desktop MediaRecorder", result.error);
      }
      await startWebRecording();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setPhase("error");
    }
  }, [startWebRecording]);

  const pauseRecording = useCallback(async () => {
    if (isNativeRef.current) {
      const result = await window.electronAPI.pauseNativeRecording();
      if (!result.success) { setError(result.error || "Pause failed"); return; }
    } else if (mediaRecorder.current?.state === "recording") mediaRecorder.current.pause();
    setPhase("paused");
  }, []);

  const resumeRecording = useCallback(async () => {
    if (isNativeRef.current) {
      const result = await window.electronAPI.resumeNativeRecording();
      if (!result.success) { setError(result.error || "Resume failed"); return; }
    } else if (mediaRecorder.current?.state === "paused") mediaRecorder.current.resume();
    setPhase("recording");
  }, []);

  const cancelRecording = useCallback(async () => {
    cancelledRef.current = true;
    if (phase === "countdown") { setCountdown(null); setPhase("idle"); return; }
    await stopRecording();
  }, [phase, stopRecording]);

  const retakeRecording = useCallback(async () => {
    cancelledRef.current = true;
    await stopRecording();
    await startRecording(lastConfiguration.current);
  }, [startRecording, stopRecording]);

  return {
    recording: phase === "recording" || phase === "paused",
    phase,
    countdown,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    retakeRecording,
    toggleRecording: () => void (phase === "recording" || phase === "paused" ? stopRecording() : startRecording()),
    isProcessing: phase === "processing",
    processProgress,
  };
}
