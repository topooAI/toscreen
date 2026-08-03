import { useEffect, useRef, useState } from "react";
import styles from "./LaunchWindow.module.css";
import { useScreenRecorder } from "../../hooks/useScreenRecorder";
import { Monitor, Layout, Focus, Video, Mic, Volume2, X, Pause, Play, RotateCcw, Square } from "lucide-react";
import { cn } from "../../lib/utils";

type SourceType = "Display" | "Window" | "Area";
type Area = { x: number; y: number; width: number; height: number };
type PermissionKind = "screen" | "microphone" | "camera";

export function LaunchWindow() {
  const recorder = useScreenRecorder();
  const [selectedType, setSelectedType] = useState<SourceType>("Display");
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [microphoneId, setMicrophoneId] = useState("");
  const [microphoneOn, setMicrophoneOn] = useState(false);
  const [systemAudioOn, setSystemAudioOn] = useState(false);
  const [microphoneLevel, setMicrophoneLevel] = useState(0);
  const [area, setArea] = useState<Area>({ x: 0, y: 0, width: 1280, height: 720 });
  const [showArea, setShowArea] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [permissions, setPermissions] = useState<RecordingPermissions>({ screen: "unknown", microphone: "unknown", camera: "unknown" });
  const meterCleanup = useRef<() => void>();

  const refreshPermissions = async () => setPermissions(await window.electronAPI.getRecordingPermissions());

  useEffect(() => {
    void refreshPermissions();
    void navigator.mediaDevices.enumerateDevices().then(devices => {
      const inputs = devices.filter(device => device.kind === "audioinput");
      setMicrophones(inputs);
      setMicrophoneId(inputs.find(device => device.deviceId === "default")?.deviceId || inputs[0]?.deviceId || "");
    });
    return () => meterCleanup.current?.();
  }, []);

  useEffect(() => {
    meterCleanup.current?.();
    setMicrophoneLevel(0);
    if (!microphoneOn) return;
    let active = true;
    void navigator.mediaDevices.getUserMedia({ audio: microphoneId ? { deviceId: { exact: microphoneId } } : true }).then(mediaStream => {
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(mediaStream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const update = () => {
        if (!active) return;
        analyser.getByteFrequencyData(data);
        setMicrophoneLevel(Math.min(100, Math.round(data.reduce((sum, value) => sum + value, 0) / data.length * 1.5)));
        requestAnimationFrame(update);
      };
      update();
      meterCleanup.current = () => { active = false; mediaStream.getTracks().forEach(track => track.stop()); void context.close(); };
    }).catch(() => void refreshPermissions());
    return () => meterCleanup.current?.();
  }, [microphoneId, microphoneOn]);

  const handleSourceSelect = async (type: SourceType) => {
    if (recorder.recording) return;
    setSelectedType(type);
    setShowArea(type === "Area");
    if (type === "Display") {
      const sources = await window.electronAPI.getSources({ types: ["screen"] });
      if (sources[0]) await window.electronAPI.selectSource(sources[0]);
    } else if (type === "Window") {
      await window.electronAPI.openSourceSelector();
    }
  };

  const applyArea = async () => {
    const sources = await window.electronAPI.getSources({ types: ["screen"] });
    if (!sources[0]) return;
    await window.electronAPI.selectSource({ ...sources[0], id: sources[0].id, name: `Area ${area.width}×${area.height}` });
    setShowArea(false);
  };

  const begin = () => recorder.startRecording({
    includeMicrophone: microphoneOn,
    includeSystemAudio: systemAudioOn,
    audioDeviceId: microphoneId || undefined,
    captureArea: selectedType === "Area" ? area : undefined,
    countdownSeconds: 3,
  });

  const repairPermission = async (kind: PermissionKind) => {
    if (kind === "microphone" || kind === "camera") await window.electronAPI.requestRecordingPermission(kind);
    const next = await window.electronAPI.getRecordingPermissions();
    setPermissions(next);
    if (next[kind] !== "granted") await window.electronAPI.openRecordingPermissionSettings(kind);
  };

  return (
    <div className="w-full h-screen flex items-center justify-center bg-transparent relative">
      {recorder.countdown !== null && <div className={styles.countdown}>{recorder.countdown}</div>}
      {recorder.isProcessing && <div className={styles.processing}>Preparing editor… {recorder.processProgress}%</div>}
      <div className={cn(styles.launchBar, styles.electronDrag)}>
        <button aria-label="Close" className={cn(styles.iconButton, styles.electronNoDrag)} onClick={() => window.electronAPI.hudOverlayClose()}><X size={16} /></button>
        <div className={styles.divider} />
        <div className={styles.section}>
          <SourceButton active={selectedType === "Display"} icon={<Monitor size={18} />} label="Display" onClick={() => void handleSourceSelect("Display")} disabled={recorder.recording} />
          <SourceButton active={selectedType === "Window"} icon={<Layout size={18} />} label="Window" onClick={() => void handleSourceSelect("Window")} disabled={recorder.recording} />
          <SourceButton active={selectedType === "Area"} icon={<Focus size={18} />} label="Area" onClick={() => void handleSourceSelect("Area")} disabled={recorder.recording} />
        </div>
        <div className={styles.divider} />
        <div className={styles.section}>
          <button className={cn(styles.mediaButton, styles.electronNoDrag)} onClick={() => setShowPermissions(value => !value)}><Video size={18} /><span>Camera permission</span></button>
          <label className={cn(styles.mediaButton, styles.electronNoDrag, microphoneOn && styles.enabled)}><Mic size={18} />
            <select aria-label="Microphone" value={microphoneId} onChange={event => setMicrophoneId(event.target.value)} disabled={!microphoneOn || recorder.recording}>
              <option value="">Default microphone</option>{microphones.map(device => <option key={device.deviceId} value={device.deviceId}>{device.label || "Microphone"}</option>)}
            </select>
            <input aria-label="Microphone enabled" type="checkbox" checked={microphoneOn} onChange={event => setMicrophoneOn(event.target.checked)} disabled={recorder.recording} />
            <i className={styles.meter}><b style={{ width: `${microphoneLevel}%` }} /></i>
          </label>
          <button className={cn(styles.mediaButton, styles.electronNoDrag, systemAudioOn && styles.enabled)} onClick={() => !recorder.recording && setSystemAudioOn(value => !value)}><Volume2 size={18} /><span>{systemAudioOn ? "System audio" : "No system audio"}</span></button>
        </div>
        <div className={styles.divider} />
        <div className={styles.section}>
          {recorder.recording ? <>
            <button aria-label={recorder.phase === "paused" ? "Resume" : "Pause"} className={cn(styles.iconButton, styles.electronNoDrag)} onClick={() => void (recorder.phase === "paused" ? recorder.resumeRecording() : recorder.pauseRecording())}>{recorder.phase === "paused" ? <Play size={17} /> : <Pause size={17} />}</button>
            <button aria-label="Retake" className={cn(styles.iconButton, styles.electronNoDrag)} onClick={() => void recorder.retakeRecording()}><RotateCcw size={17} /></button>
            <button aria-label="Cancel" className={cn(styles.iconButton, styles.electronNoDrag)} onClick={() => void recorder.cancelRecording()}><X size={17} /></button>
            <button aria-label="Stop" className={cn(styles.recordBtn, styles.stop, styles.electronNoDrag)} onClick={() => void recorder.stopRecording()}><Square size={11} fill="white" /></button>
          </> : <button aria-label="Start recording" className={cn(styles.recordBtn, styles.electronNoDrag)} onClick={() => void begin()} />}
        </div>
        {showArea && <div className={cn(styles.popover, styles.electronNoDrag)}><strong>Custom area</strong><div className={styles.areaGrid}>{(["x", "y", "width", "height"] as const).map(key => <label key={key}>{key.toUpperCase()}<input type="number" min={key === "width" || key === "height" ? 64 : 0} value={area[key]} onChange={event => setArea(current => ({ ...current, [key]: Math.max(0, Number(event.target.value)) }))} /></label>)}</div><button onClick={() => void applyArea()}>Use this area</button></div>}
        {showPermissions && <div className={cn(styles.popover, styles.permissions, styles.electronNoDrag)}><strong>Permissions</strong>{(["screen", "microphone", "camera"] as PermissionKind[]).map(kind => <div key={kind}><span>{kind}</span><em data-status={permissions[kind]}>{permissions[kind]}</em><button onClick={() => void repairPermission(kind)}>Fix</button></div>)}</div>}
      </div>
      {recorder.error && <div className={styles.error}>{recorder.error}</div>}
    </div>
  );
}

function SourceButton({ active, icon, label, onClick, disabled }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return <button className={cn(styles.actionButton, styles.electronNoDrag, active && styles.active)} onClick={onClick} disabled={disabled}>{icon}<span>{label}</span></button>;
}
