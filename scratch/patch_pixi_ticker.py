import re

file_path = 'src/components/video-editor/VideoPlayback.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace findInterpolatedTarget(..., currentTimeRef.current)
# with findInterpolatedTarget(..., (videoRef.current?.currentTime || 0) * 1000)

old_line = r'const { strength, focus, depth } = findInterpolatedTarget\(zoomRegionsRef\.current, currentTimeRef\.current\);'
new_line = r'const { strength, focus, depth } = findInterpolatedTarget(zoomRegionsRef.current, (videoRef.current?.currentTime || 0) * 1000);'

if re.search(old_line, content):
    content = re.sub(old_line, new_line, content)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Successfully patched PIXI ticker to use video.currentTime directly!")
else:
    print("Could not find PIXI ticker line.")
