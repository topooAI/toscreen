import re

file_path = 'src/components/video-editor/VideoEditor.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "                  selectedAudioId={selectedAudioId}\n                  onSelectAudio={setSelectedAudioId}",
    "                  selectedAudioId={selectedAudioId}\n                  onSelectAudio={setSelectedAudioId}\n                  audioRegions={audioRegions}"
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Injected audioRegions prop into VideoEditor!")
