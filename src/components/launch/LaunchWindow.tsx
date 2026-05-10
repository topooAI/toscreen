import { useState, useEffect } from "react";
import styles from "./LaunchWindow.module.css";
import { useScreenRecorder } from "../../hooks/useScreenRecorder";
import { 
  Monitor, 
  Layout, 
  Focus, 
  Smartphone, 
  Video, 
  Mic, 
  Volume2, 
  Settings, 
  X,
  Circle
} from "lucide-react";
import { cn } from "../../lib/utils";

export function LaunchWindow() {
  const { recording, toggleRecording } = useScreenRecorder();
  const [selectedType, setSelectedType] = useState<"Display" | "Window" | "Area" | "Device">("Display");
  const [selectedSource, setSelectedSource] = useState<string>("Screen");

  useEffect(() => {
    const checkSelectedSource = async () => {
      if (window.electronAPI) {
        const source = await window.electronAPI.getSelectedSource();
        if (source) {
          setSelectedSource(source.name);
          setSelectedType(source.id.startsWith('screen:') ? "Display" : "Window");
        }
      }
    };
    checkSelectedSource();
    const interval = setInterval(checkSelectedSource, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSourceSelect = async (type: typeof selectedType) => {
    if (recording) return;
    setSelectedType(type);
    if (type === "Display") {
      const sources = await window.electronAPI.getSources({ types: ['screen'] });
      if (sources.length > 0) {
        await window.electronAPI.selectSource(sources[0]);
      }
    } else if (type === "Window") {
      window.electronAPI.openSourceSelector();
    }
  };

  const sendHudOverlayClose = () => {
    if (window.electronAPI && window.electronAPI.hudOverlayClose) {
      window.electronAPI.hudOverlayClose();
    }
  };

  return (
    <div className="w-full h-screen flex items-center justify-center bg-transparent">
      <div className={cn(styles.launchBar, styles.electronDrag)}>
        {/* Close Button */}
        <button 
          className={cn(styles.hudOverlayButton, styles.electronNoDrag)}
          onClick={sendHudOverlayClose}
        >
          <X size={16} />
        </button>

        <div className={styles.divider} />

        {/* Source Selection */}
        <div className={styles.section}>
          <SourceButton 
            active={selectedType === "Display"} 
            icon={<Monitor size={18} />} 
            label="Display" 
            onClick={() => handleSourceSelect("Display")}
            disabled={recording}
          />
          <SourceButton 
            active={selectedType === "Window"} 
            icon={<Layout size={18} />} 
            label="Window" 
            onClick={() => handleSourceSelect("Window")}
            disabled={recording}
          />
          <SourceButton 
            active={selectedType === "Area"} 
            icon={<Focus size={18} />} 
            label="Area" 
            onClick={() => console.log("Area selection coming soon")} 
          />
          <SourceButton 
            active={selectedType === "Device"} 
            icon={<Smartphone size={18} />} 
            label="Device" 
            onClick={() => console.log("Device selection coming soon")} 
          />
        </div>

        <div className={styles.divider} />

        {/* Media Settings */}
        <div className={styles.section}>
          <MediaButton icon={<Video size={18} />} label="No camera" />
          <MediaButton icon={<Mic size={18} />} label="No microphone" />
          <MediaButton icon={<Volume2 size={18} />} label="No system audio" />
        </div>

        <div className={styles.divider} />

        {/* Settings & Record */}
        <div className={styles.section}>
          <button className={cn(styles.actionButton, styles.electronNoDrag, "px-3 min-w-0")}>
            <Settings size={20} />
          </button>
          
          <div className="pl-1">
            <button 
              className={cn(styles.recordBtn, styles.electronNoDrag, recording && styles.recording)}
              onClick={toggleRecording}
            >
              {!recording && <Circle size={10} fill="white" stroke="none" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SourceButton({ active, icon, label, onClick, disabled }: { 
  active: boolean, icon: React.ReactNode, label: string, onClick: () => void, disabled?: boolean 
}) {
  return (
    <button 
      className={cn(styles.actionButton, styles.electronNoDrag, active && styles.active)}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
      <span className={styles.label}>{label}</span>
    </button>
  );
}

function MediaButton({ icon, label }: { icon: React.ReactNode, label: string }) {
  return (
    <button className={cn(styles.mediaButton, styles.electronNoDrag)}>
      {icon}
      <span className={styles.mediaLabel}>{label}</span>
    </button>
  );
}
