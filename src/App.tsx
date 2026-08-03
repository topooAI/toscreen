import { useEffect, useState } from "react";
import { LaunchWindow } from "./components/launch/LaunchWindow";
import { SourceSelector } from "./components/launch/SourceSelector";
import VideoEditor from "./components/video-editor/VideoEditor";
import EditingRuntimeAudit from "./components/video-editor/timeline/EditingRuntimeAudit";
import { SettingsWindow } from "./components/settings/SettingsWindow";
import { ProjectHome } from './components/projects/ProjectHome'
import {
  loadEditorPreferences,
  sanitizeEditorPreferences,
  type EditorPreferences,
} from "./lib/editorPreferences";

export default function App() {
  const [windowType, setWindowType] = useState(
    () => new URLSearchParams(window.location.search).get('windowType') || '',
  );
  const [theme, setTheme] = useState<EditorPreferences['theme']>(
    () => loadEditorPreferences().theme,
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('windowType') || '';
    setWindowType(type);
    document.body.style.background = 'transparent';
    document.documentElement.style.background = 'transparent';
    document.getElementById('root')?.style.setProperty('background', 'transparent');
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    return window.electronAPI?.onEditorPreferencesUpdated?.((value) => {
      setTheme(sanitizeEditorPreferences(value).theme);
    });
  }, [theme]);

  let content;
  switch (windowType) {
    case 'hud-overlay':
      content = <LaunchWindow />;
      break;
    case 'source-selector':
      content = <SourceSelector />;
      break;
    case 'editor':
      content = <VideoEditor theme={theme} />;
      break;
    case 'home':
      content = <ProjectHome />;
      break;
    case 'editing-audit':
      content = <EditingRuntimeAudit />;
      break;
    case 'settings':
      content = <SettingsWindow />;
      break;
    default:
      content = (
        <div className="w-full h-full bg-background text-foreground">
          <h1>ToScreen</h1>
        </div>
      );
  }

  return (
    <div className="toscreen-theme h-full w-full" data-theme={theme}>
      {content}
    </div>
  );
}
