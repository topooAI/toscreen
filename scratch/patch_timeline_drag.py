import re

file_path = 'src/components/video-editor/timeline/TimelineEditor.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the buggy max duration limit in TimelineEditor.tsx
buggy_code = """      const audioRegion = audioRegions?.find(r => r.id === id);
      if (audioRegion) {
        const maxDuration = audioRegion.totalDurationMs || 0;
        if (maxDuration > 0) {
          const sourceStart = audioRegion.sourceStartMs || 0;
          const maxAllowed = maxDuration - sourceStart;
          const currentDuration = targetSpan.end - targetSpan.start;
          if (currentDuration > maxAllowed) {
            targetSpan.end = targetSpan.start + maxAllowed;
          }
          if (targetSpan.start < (audioRegion.startMs - sourceStart)) {
            targetSpan.start = audioRegion.startMs - sourceStart;
          }
        }
      }"""

fixed_code = """      const audioRegion = audioRegions?.find(r => r.id === id);
      if (audioRegion) {
        const maxDuration = audioRegion.totalDurationMs || 0;
        const oldDuration = audioRegion.endMs - audioRegion.startMs;
        const currentDuration = targetSpan.end - targetSpan.start;
        const isTrimming = Math.abs(currentDuration - oldDuration) > 1; // 1ms tolerance
        
        if (maxDuration > 0 && isTrimming) {
          const sourceStart = audioRegion.sourceStartMs || 0;
          const maxAllowed = maxDuration - sourceStart;
          
          if (currentDuration > maxAllowed) {
            targetSpan.end = targetSpan.start + maxAllowed;
          }
          
          // Only restrict targetSpan.start if we are actually expanding the start to the left
          const isExpandingLeft = targetSpan.start < audioRegion.startMs && targetSpan.end === audioRegion.endMs;
          if (isExpandingLeft && targetSpan.start < (audioRegion.startMs - sourceStart)) {
            targetSpan.start = audioRegion.startMs - sourceStart;
          }
        }
      }"""

content = content.replace(buggy_code, fixed_code)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Timeline drag logic patched!")
