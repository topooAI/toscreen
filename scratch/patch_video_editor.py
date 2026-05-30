import re

file_path = 'src/components/video-editor/VideoEditor.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# We want to memoize the rendering of the Sidebar in VideoEditor.tsx
# The sidebar starts with `<Sidebar\n` and ends with `        />\n      </div>`
# Let's find it.
sidebar_pattern = r'(\s*{\/\* Right section: Sidebar \*\/\s*<Sidebar.*?\s*\/\>)'
match = re.search(sidebar_pattern, content, flags=re.DOTALL)
if match:
    original_sidebar = match.group(1)
    
    # Create useMemo block
    memoized_sidebar_block = """
        {/* Right section: Sidebar */}
        {useMemo(() => (
""" + original_sidebar.replace("        {/* Right section: Sidebar */}\n", "") + """
        ), [
          wallpaper, zoomRegions, selectedZoomId, selectedTrimId, shadowIntensity,
          showBlur, motionBlurEnabled, borderRadius, padding, cropRegion, aspectRatio,
          exportQuality, selectedAnnotationId, annotationRegions, cursorSize,
          cursorSmoothing, showVectorCursor, cursorOffset,
          handleZoomDepthChange, handleZoomDelete, handleZoomSplit, handleTrimDelete,
          handleExport, handleAnnotationContentChange, handleAnnotationTypeChange,
          handleAnnotationStyleChange, handleAnnotationFigureDataChange, handleAnnotationDelete,
          handleAutoZoom, videoPlaybackRef.current?.video
        ])}
"""
    content = content.replace(original_sidebar, memoized_sidebar_block)
    
    # Make sure useMemo is imported
    if "useMemo" not in content[:300]:
        content = content.replace("useCallback, useEffect", "useCallback, useEffect, useMemo")
        
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Sidebar memoized in VideoEditor!")
else:
    print("Could not find Sidebar block.")
