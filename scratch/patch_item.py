import re

file_path = 'src/components/video-editor/timeline/Item.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the end of the file starting from "const Item = memo("
pattern = r'const Item = memo\(ItemComponent.*'
new_memo = """export default React.memo(ItemComponent, (prev, next) => {
  return (
    prev.id === next.id &&
    prev.span.start === next.span.start &&
    prev.span.end === next.span.end &&
    prev.isSelected === next.isSelected &&
    prev.zoomDepth === next.zoomDepth &&
    prev.variant === next.variant &&
    prev.children === next.children &&
    prev.sourceStartMs === next.sourceStartMs &&
    prev.sourceEndMs === next.sourceEndMs &&
    prev.totalDurationMs === next.totalDurationMs &&
    prev.sourceUrl === next.sourceUrl &&
    prev.volume === next.volume &&
    prev.volumeKeyframes === next.volumeKeyframes &&
    prev.audioPeaks === next.audioPeaks
  );
});
"""
content = re.sub(pattern, new_memo, content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched Item.tsx memo!")
