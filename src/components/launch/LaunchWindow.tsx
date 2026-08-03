import { useEffect, useRef, useState } from "react";
import styles from "./LaunchWindow.module.css";
import { useScreenRecorder } from "../../hooks/useScreenRecorder";
import { Monitor, Layout, Focus, Smartphone, Video, Mic, Volume2, X, Pause, Play, RotateCcw, Square } from "lucide-react";
import { cn } from "../../lib/utils";
import { AreaSelector } from './AreaSelector'

type SourceType = "Display" | "Window" | "Area" | "Device";
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
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraPreview, setCameraPreview] = useState<MediaStream | null>(null);
  const [iosDevices, setIOSDevices] = useState<IOSScreenDevice[]>([]);
  const [iosDeviceId, setIOSDeviceId] = useState('');
  const [iosStatus, setIOSStatus] = useState('Connect an unlocked iPhone or iPad by USB.');
  const [area, setArea] = useState<Area>({ x: 0, y: 0, width: 1280, height: 720 });
  const [showArea, setShowArea] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [permissions, setPermissions] = useState<RecordingPermissions>({ screen: "unknown", microphone: "unknown", camera: "unknown" });
  const meterCleanup = useRef<() => void>();
  const cameraVideoRef = useRef<HTMLVideoElement>(null);

  const refreshPermissions = async () => setPermissions(await window.electronAPI.getRecordingPermissions());
  const refreshIOSDevices = async () => { const result=await window.electronAPI.discoverIOSScreenDevices(); setIOSDevices(result.devices); setIOSDeviceId(current=>result.devices.some(device=>device.id===current)?current:(result.devices[0]?.id||'')); setIOSStatus(result.success?(result.devices.length?'Wired screen device ready.':'No wired iPhone/iPad screen detected.'):(result.error||'Discovery failed')); };

  useEffect(() => {
    void refreshPermissions();
    void refreshIOSDevices();
    void navigator.mediaDevices.enumerateDevices().then(devices => {
      const inputs = devices.filter(device => device.kind === "audioinput");
      const videoInputs = devices.filter(device => device.kind === "videoinput");
      setMicrophones(inputs);
      setCameras(videoInputs);
      setMicrophoneId(inputs.find(device => device.deviceId === "default")?.deviceId || inputs[0]?.deviceId || "");
    });
    const unsubscribe=window.electronAPI.onIOSDeviceState((event:any)=>setIOSStatus(event?.message||event?.type||'Device state changed'));
    return () => { meterCleanup.current?.(); unsubscribe(); void window.electronAPI.stopIOSDevicePreview(); };
  }, []);

  useEffect(() => {
    cameraPreview?.getTracks().forEach(track => track.stop())
    if (!cameraOn) { setCameraPreview(null); return }
    let localStream: MediaStream | null = null
    let cancelled = false
    void navigator.mediaDevices.getUserMedia({ video: cameraId ? { deviceId: { exact: cameraId } } : true, audio: false }).then(mediaStream => {
      if (cancelled) { mediaStream.getTracks().forEach(track => track.stop()); return }
      localStream = mediaStream
      setCameraPreview(mediaStream)
      if (cameraVideoRef.current) cameraVideoRef.current.srcObject = mediaStream
    }).catch(() => void refreshPermissions())
    return () => { cancelled = true; localStream?.getTracks().forEach(track => track.stop()) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraId, cameraOn]);

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
    } else if (type === 'Device') {
      await refreshIOSDevices(); setCameraOn(false); setSystemAudioOn(false)
    }
  };

  const applyArea = async (source: ProcessedDesktopSource, bounds: Area) => {
    setArea(bounds)
    await window.electronAPI.selectSource({ ...source, name: `Area ${bounds.width}×${bounds.height}` });
    setShowArea(false);
  };

  const begin = () => recorder.startRecording({
    includeMicrophone: microphoneOn,
    includeSystemAudio: systemAudioOn,
    audioDeviceId: microphoneId || undefined,
    captureCamera: cameraOn,
    cameraDeviceId: cameraId || undefined,
    captureArea: selectedType === "Area" ? area : undefined,
    countdownSeconds: 3,
    iosDeviceId: selectedType === 'Device' ? iosDeviceId || undefined : undefined,
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
          <SourceButton active={selectedType === "Device"} icon={<Smartphone size={18} />} label="Device" onClick={() => void handleSourceSelect("Device")} disabled={recorder.recording} />
        </div>
        <div className={styles.divider} />
        <div className={styles.section}>
          <label className={cn(styles.mediaButton, styles.electronNoDrag, cameraOn && styles.enabled)}><Video size={18} />
            <select aria-label="Camera" value={cameraId} onChange={event => setCameraId(event.target.value)} disabled={!cameraOn || recorder.recording}><option value="">Default camera</option>{cameras.map(device => <option key={device.deviceId} value={device.deviceId}>{device.label || 'Camera'}</option>)}</select>
            <input aria-label="Camera enabled" type="checkbox" checked={cameraOn} onChange={event => setCameraOn(event.target.checked)} disabled={recorder.recording} />
          </label>
          <label className={cn(styles.mediaButton, styles.electronNoDrag, microphoneOn && styles.enabled)}><Mic size={18} />
            <select aria-label="Microphone" value={microphoneId} onChange={event => setMicrophoneId(event.target.value)} disabled={!microphoneOn || recorder.recording}>
              <option value="">Default microphone</option>{microphones.map(device => <option key={device.deviceId} value={device.deviceId}>{device.label || "Microphone"}</option>)}
            </select>
            <input aria-label="Microphone enabled" type="checkbox" checked={microphoneOn} onChange={event => setMicrophoneOn(event.target.checked)} disabled={recorder.recording} />
            <i className={styles.meter}><b style={{ width: `${microphoneLevel}%` }} /></i>
          </label>
          <button disabled={selectedType==='Device'} className={cn(styles.mediaButton, styles.electronNoDrag, systemAudioOn && styles.enabled)} onClick={() => !recorder.recording && setSystemAudioOn(value => !value)}><Volume2 size={18} /><span>{selectedType==='Device'?'System audio unavailable':systemAudioOn ? "System audio" : "No system audio"}</span></button>
          <button className={cn(styles.iconButton, styles.electronNoDrag)} aria-label="Permissions" onClick={() => setShowPermissions(value => !value)}>•••</button>
        </div>
        <div className={styles.divider} />
        <div className={styles.section}>
          {recorder.recording ? <>
            <button aria-label={recorder.phase === "paused" ? "Resume" : "Pause"} className={cn(styles.iconButton, styles.electronNoDrag)} onClick={() => void (recorder.phase === "paused" ? recorder.resumeRecording() : recorder.pauseRecording())}>{recorder.phase === "paused" ? <Play size={17} /> : <Pause size={17} />}</button>
            <button aria-label="Retake" className={cn(styles.iconButton, styles.electronNoDrag)} onClick={() => void recorder.retakeRecording()}><RotateCcw size={17} /></button>
            <button aria-label="Cancel" className={cn(styles.iconButton, styles.electronNoDrag)} onClick={() => void recorder.cancelRecording()}><X size={17} /></button>
            <button aria-label="Stop" className={cn(styles.recordBtn, styles.stop, styles.electronNoDrag)} onClick={() => void recorder.stopRecording()}><Square size={11} fill="white" /></button>
          </> : <button aria-label="Start recording" disabled={selectedType==='Device'&&!iosDeviceId} className={cn(styles.recordBtn, styles.electronNoDrag)} onClick={() => void begin()} />}
        </div>
        {showArea && <div className={cn(styles.popover, styles.areaPopover, styles.electronNoDrag)}><strong>Drag and resize the capture area</strong><AreaSelector onApply={(source, bounds) => void applyArea(source, bounds)} /></div>}
        {selectedType==='Device' && <div className={cn(styles.popover,styles.electronNoDrag)}><strong>Wired iPhone / iPad screen</strong><select aria-label="iPhone or iPad screen" value={iosDeviceId} onChange={event=>setIOSDeviceId(event.target.value)} disabled={recorder.recording}><option value="">No device</option>{iosDevices.map(device=><option key={device.id} value={device.id} disabled={!device.connected||device.suspended||device.inUse}>{device.name}{device.inUse?' (in use)':device.suspended?' (locked/suspended)':''}</option>)}</select><p>{iosStatus}</p><p>Device audio: muxed when exposed by iOS. Mac system audio is not available for this source.</p><button onClick={()=>void refreshIOSDevices()}>Refresh</button><button disabled={!iosDeviceId||recorder.recording} onClick={()=>void window.electronAPI.startIOSDevicePreview(iosDeviceId)}>Preview</button><button onClick={()=>void window.electronAPI.stopIOSDevicePreview()}>Close preview</button></div>}
        {showPermissions && <div className={cn(styles.popover, styles.permissions, styles.electronNoDrag)}><strong>Permissions</strong>{(["screen", "microphone", "camera"] as PermissionKind[]).map(kind => <div key={kind}><span>{kind}</span><em data-status={permissions[kind]}>{permissions[kind]}</em><button onClick={() => void repairPermission(kind)}>Fix</button></div>)}</div>}
      </div>
      {cameraOn && cameraPreview && <div className={styles.cameraPreview}><video ref={cameraVideoRef} autoPlay muted playsInline /><span>{cameras.find(device => device.deviceId === cameraId)?.label || 'Camera preview'}</span></div>}
      {recorder.error && <div className={styles.error}>{recorder.error}</div>}
    </div>
  );
}

function SourceButton({ active, icon, label, onClick, disabled }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return <button className={cn(styles.actionButton, styles.electronNoDrag, active && styles.active)} onClick={onClick} disabled={disabled}>{icon}<span>{label}</span></button>;
}
