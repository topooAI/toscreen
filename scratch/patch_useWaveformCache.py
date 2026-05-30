import re

file_path = 'src/components/video-editor/hooks/useWaveformCache.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Change !!audioUrl to false to prevent real decode and CPU freeze
content = content.replace(
    "const { peaks, durationMs } = useAudioWaveform(audioUrl, !!audioUrl, 1000);",
    "const { peaks, durationMs } = useAudioWaveform(audioUrl, false, 1000);"
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("useWaveformCache patched!")
