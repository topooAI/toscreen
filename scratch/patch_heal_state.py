import re

file_path = 'src/components/video-editor/VideoEditor.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

healer = """
  // HEALER: Automatically fix corrupted audio regions trapped in memory
  useEffect(() => {
    if (audioRegions && audioRegions.length > 0) {
      let needsFix = false;
      const fixedRegions = audioRegions.map(r => {
        let newR = { ...r };
        if (newR.startMs < 0 || newR.startMs > 10000000 || isNaN(newR.startMs)) {
          newR.startMs = 0;
          newR.endMs = 5000;
          needsFix = true;
        }
        if (newR.endMs < newR.startMs || isNaN(newR.endMs)) {
          newR.endMs = newR.startMs + 5000;
          needsFix = true;
        }
        return newR;
      });
      if (needsFix) {
        setAudioRegions(fixedRegions);
      }
    }
  }, [audioRegions]);
"""

# Insert healer after useStates
if "const [audioRegions, setAudioRegions] = useState<AudioRegion[]>([]);" in content:
    content = content.replace(
        "const [audioRegions, setAudioRegions] = useState<AudioRegion[]>([]);",
        "const [audioRegions, setAudioRegions] = useState<AudioRegion[]>([]);\n" + healer
    )
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("State healer injected!")
else:
    print("Could not find insertion point")
