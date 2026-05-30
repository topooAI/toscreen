import re

file_path = 'src/components/video-editor/timeline/Item.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove useAudioWaveform import
content = re.sub(r'import \{ useAudioWaveform \} from "\.\./hooks/useAudioWaveform";\n', '', content)

# 2. Modify WaveformOverlay to use peaks directly
content = re.sub(r'function WaveformOverlay\(\{[^}]+\} : \{[^}]+\}\) \{.*?const \{ peaks \} = useAudioWaveform\(url, isReal, 1000\);\n', 
'''function WaveformOverlay({ id, url, isReal, sourceStartMs, effTotalDuration, svgOffset = 0, peaks }: { id: string; url: string; isReal: boolean; sourceStartMs: number; effTotalDuration: number; svgOffset?: number; peaks?: number[] }) {
''', content, flags=re.DOTALL)

# 3. Modify WaveformOverlay calls to pass audioPeaks
content = content.replace(
    "<WaveformOverlay id={id} url={sourceUrl} isReal={false} sourceStartMs={sourceStartMs} effTotalDuration={effTotalDuration} svgOffset={svgOffset} />",
    "<WaveformOverlay id={id} url={sourceUrl} isReal={false} sourceStartMs={sourceStartMs} effTotalDuration={effTotalDuration} svgOffset={svgOffset} peaks={[]} />" # video mock is unused anyway, or pass audioPeaks
)
content = content.replace(
    "<WaveformOverlay id={id} url={sourceUrl} isReal={true} sourceStartMs={sourceStartMs} effTotalDuration={effTotalDuration} svgOffset={svgOffset} />",
    "<WaveformOverlay id={id} url={sourceUrl} isReal={true} sourceStartMs={sourceStartMs} effTotalDuration={effTotalDuration} svgOffset={svgOffset} peaks={audioPeaks} />"
)

# 4. Remove `const { durationMs: loadedDurationMs } = useAudioWaveform(...)`
content = re.sub(r'const \{ durationMs: loadedDurationMs \} = useAudioWaveform[^;]+;\n', '', content)

# 5. Modify effTotalDuration definition
content = content.replace(
    "const effTotalDuration = totalDurationMs || loadedDurationMs || Math.max(1, sourceEndMs - sourceStartMs);",
    "const effTotalDuration = totalDurationMs || Math.max(1, sourceEndMs - sourceStartMs);"
)

# 6. Uncomment audioPeaks prop
content = content.replace("// audioPeaks,", "audioPeaks,")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Removed internal useAudioWaveform from Item.tsx!")
