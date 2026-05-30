import re

file_path = 'src/components/video-editor/hooks/useAudioMixer.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the sort inside the loops
content = re.sub(
    r'const kfs = \[\.\.\.region\.volumeKeyframes\]\.sort\(\(a, b\) => a\.timeRatio - b\.timeRatio\);',
    'const kfs = region.volumeKeyframes;',
    content
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

file_path2 = 'src/components/video-editor/VideoEditor.tsx'
with open(file_path2, 'r', encoding='utf-8') as f:
    content2 = f.read()

content2 = content2.replace(
    '''  // useAudioMixer({ 
  //   audioRegions, 
  //   isPlaying, 
  //   currentTime 
  // });''',
    '''  useAudioMixer({ 
    audioRegions, 
    isPlaying, 
    currentTime 
  });'''
)

with open(file_path2, 'w', encoding='utf-8') as f:
    f.write(content2)

print("AudioMixer fixed and restored!")
