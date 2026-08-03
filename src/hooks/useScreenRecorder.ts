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
  const microphoneRecorder = useRef<MediaRecorder | null>(null);
  const microphoneStream = useRef<MediaStream | null>(null);
  const microphoneChunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startTime = useRef(0);
  const isNativeRef = useRef(false);
  const cancelledRef = useRef(false);
  const lastConfiguration = useRef<RecordingConfiguration>({ countdownSeconds: 3 });
  const webStopResolve = useRef<(() => void) | null>(null);
  const pendingMicrophonePath = useRef<Promise<string | undefined> | null>(null);
  const microphoneFileName = useRef<string | null>(null);

  const finishRecording = useCallback(async (outputPath: string, audioPath?: string, cameraPath?: string, microphonePath?: string) => {
    setPhase("processing");
    setProcessProgress(0);
    const unsubscribe = window.electronAPI.onProxyGenerationProgress(setProcessProgress);
    try {
      const proxyResult = await window.electronAPI.generateProxyVideo(outputPath);
      await window.electronAPI.setCurrentVideoPath(outputPath, proxyResult.success ? proxyResult.proxyPath : undefined, audioPath, cameraPath, microphonePath);
      await window.electronAPI.switchToEditor();
    } finally {
      unsubscribe();
      setPhase("idle");
    }
  }, []);

  const stopMicrophoneStem = useCallback(async () => {
    const recorder = microphoneRecorder.current
    if (!recorder || recorder.state === 'inactive') return undefined
    return new Promise<string | undefined>(resolve => {
      recorder.onstop = async () => {
        microphoneStream.current?.getTracks().forEach(track => track.stop())
        microphoneStream.current = null
        const blob = new Blob(microphoneChunks.current, { type: recorder.mimeType })
        microphoneChunks.current = []
        if (!blob.size || cancelledRef.current) { resolve(undefined); return }
        const stored = await window.electronAPI.storeRecordedAudio(await blob.arrayBuffer(), microphoneFileName.current || `recording-${startTime.current || Date.now()}-microphone.webm`)
        microphoneFileName.current = null
        resolve(stored.path)
      }
      recorder.stop()
    })
  }, []);

  const startMicrophoneStem = useCallback(async (configuration: RecordingConfiguration) => {
    if (!configuration.includeMicrophone || microphoneRecorder.current?.state === 'recording') return
    microphoneStream.current = await navigator.mediaDevices.getUserMedia({ audio: configuration.audioDeviceId ? { deviceId: { exact: configuration.audioDeviceId } } : true })
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
    microphoneRecorder.current = new MediaRecorder(microphoneStream.current, { mimeType })
    microphoneChunks.current = []
    microphoneRecorder.current.ondataavailable = event => { if (event.data.size) microphoneChunks.current.push(event.data) }
    microphoneRecorder.current.start(500)
  }, []);

  const stopRecording = useCallback(async () => {
    if (isNativeRef.current) {
      const result = await window.electronAPI.stopNativeRecording();
      const microphonePath = await stopMicrophoneStem();
      isNativeRef.current = false;
      if (!result.success || !result.outputPath) {
        setError(result.error || "Unable to stop recording");
        setPhase("error");
        return;
      }
      if (!cancelledRef.current) await finishRecording(result.outputPath, result.audioOutputPath, result.cameraOutputPath, microphonePath || undefined);
      else {
        await window.electronAPI.discardRecordingArtifacts([result.outputPath, result.audioOutputPath, result.cameraOutputPath, microphonePath]);
        setPhase("idle");
      }
      return;
    }
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      stream.current?.getTracks().forEach(track => track.stop());
      pendingMicrophonePath.current = stopMicrophoneStem()
      const stopped = new Promise<void>(resolve => { webStopResolve.current = resolve })
      mediaRecorder.current.stop();
      await window.electronAPI.setRecordingState(false, startTime.current);
      await stopped
    }
  }, [finishRecording, stopMicrophoneStem]);

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
      if (cancelledRef.current || chunks.current.length === 0) { chunks.current = []; await pendingMicrophonePath.current; pendingMicrophonePath.current = null; setPhase("idle"); webStopResolve.current?.(); webStopResolve.current = null; return; }
      const blob = await fixWebmDuration(new Blob(chunks.current, { type: mimeType }), Date.now() - startTime.current);
      chunks.current = [];
      const result = await window.electronAPI.storeRecordedVideo(await blob.arrayBuffer(), `recording-${Date.now()}.webm`);
      const microphonePath = await pendingMicrophonePath.current; pendingMicrophonePath.current = null;
      if (result.success && result.path) await finishRecording(result.path, undefined, undefined, microphonePath || undefined);
      else { setError(result.message || "Unable to store recording"); setPhase("error"); }
      webStopResolve.current?.(); webStopResolve.current = null;
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
        const result = await window.electronAPI.startNativeRecording({ ...configuration, includeMicrophone: false });
        if (result.success) {
          startTime.current = Date.now();
          microphoneFileName.current = result.outputPath ? `${result.outputPath.split(/[/\\]/).pop()?.replace(/\.mov$/i, '')}-microphone.webm` : null
          try { await startMicrophoneStem(configuration) }
          catch (microphoneError) {
            cancelledRef.current = true
            const rolledBack = await window.electronAPI.stopNativeRecording()
            await window.electronAPI.discardRecordingArtifacts([rolledBack.outputPath, rolledBack.audioOutputPath, rolledBack.cameraOutputPath])
            throw microphoneError
          }
          isNativeRef.current = true;
          setPhase("recording");
          return;
        }
        console.warn("Native recording failed; using desktop MediaRecorder", result.error);
      }
      await startWebRecording();
      microphoneFileName.current = `recording-${startTime.current}-microphone.webm`
      await startMicrophoneStem(configuration)
    } catch (cause) {
      if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') mediaRecorder.current.stop()
      if (microphoneRecorder.current && microphoneRecorder.current.state !== 'inactive') microphoneRecorder.current.stop()
      microphoneStream.current?.getTracks().forEach(track => track.stop())
      setError(cause instanceof Error ? cause.message : String(cause));
      setPhase("error");
    }
  }, [startMicrophoneStem, startWebRecording]);

  const pauseRecording = useCallback(async () => {
    if (isNativeRef.current) {
      const result = await window.electronAPI.pauseNativeRecording();
      if (!result.success) { setError(result.error || "Pause failed"); return; }
    } else if (mediaRecorder.current?.state === "recording") mediaRecorder.current.pause();
    if (microphoneRecorder.current?.state === 'recording') microphoneRecorder.current.pause()
    setPhase("paused");
  }, []);

  const resumeRecording = useCallback(async () => {
    if (isNativeRef.current) {
      const result = await window.electronAPI.resumeNativeRecording();
      if (!result.success) { setError(result.error || "Resume failed"); return; }
    } else if (mediaRecorder.current?.state === "paused") mediaRecorder.current.resume();
    if (microphoneRecorder.current?.state === 'paused') microphoneRecorder.current.resume()
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
