import re

file_path = 'src/components/video-editor/hooks/useWaveformCache.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the variant check
content = content.replace(
    "const firstAudio = audioItems.find(item => item.variant === 'audio' && item.sourceUrl);",
    "const firstAudio = audioItems.find(item => item.sourceUrl);"
)
# Fix type signature
content = content.replace(
    "export function useWaveformCache(audioItems: { id: string; sourceUrl?: string; variant: string }[]) {",
    "export function useWaveformCache(audioItems: { id: string; sourceUrl?: string; }[]) {"
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("useWaveformCache fixed!")
