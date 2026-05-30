import re

file_path = 'src/components/video-editor/VideoEditor.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the misplaced memoizedSidebar
misplaced_pattern = r'\n\s*const memoizedSidebar = useMemo.*?;\n'
content = re.sub(misplaced_pattern, '', content, flags=re.DOTALL)

# Re-extract the memoizedSidebar
use_memo_call = """useMemo(() => (
          <Sidebar
            selected={wallpaper}
            onWallpaperChange={setWallpaper}
            selectedZoomDepth={selectedZoomId ? zoomRegions.find(z => z.id === selectedZoomId)?.depth : null}
            onZoomDepthChange={(depth) => selectedZoomId && handleZoomDepthChange(depth)}
            selectedZoomId={selectedZoomId}
            onZoomDelete={handleZoomDelete}
            selectedTrimId={selectedTrimId}
            onTrimDelete={handleTrimDelete}
            shadowIntensity={shadowIntensity}
            onShadowChange={setShadowIntensity}
            showBlur={showBlur}
            onBlurChange={setShowBlur}
            motionBlurEnabled={motionBlurEnabled}
            onMotionBlurChange={setMotionBlurEnabled}
            borderRadius={borderRadius}
            onBorderRadiusChange={setBorderRadius}
            padding={padding}
            onPaddingChange={setPadding}
            cropRegion={cropRegion}
            onCropChange={setCropRegion}
            aspectRatio={aspectRatio}
            videoElement={videoPlaybackRef.current?.video || null}
            exportQuality={exportQuality}
            onExportQualityChange={setExportQuality}
            onExport={handleExport}
            selectedAnnotationId={selectedAnnotationId}
            annotationRegions={annotationRegions}
            onAnnotationContentChange={handleAnnotationContentChange}
            onAnnotationTypeChange={handleAnnotationTypeChange}
            onAnnotationStyleChange={handleAnnotationStyleChange}
            onAnnotationFigureDataChange={handleAnnotationFigureDataChange}
            onAnnotationDelete={handleAnnotationDelete}
            onAutoZoom={handleAutoZoom}
            cursorSize={cursorSize}
            onCursorSizeChange={setCursorSize}
            cursorSmoothing={cursorSmoothing}
            onCursorSmoothingChange={setCursorSmoothing}
            showVectorCursor={showVectorCursor}
            onShowVectorCursorChange={setShowVectorCursor}
            cursorOffset={cursorOffset}
            onCursorOffsetChange={setCursorOffset}
          />
        ), [
          wallpaper, zoomRegions, selectedZoomId, selectedTrimId, shadowIntensity,
          showBlur, motionBlurEnabled, borderRadius, padding, cropRegion, aspectRatio,
          exportQuality, selectedAnnotationId, annotationRegions, cursorSize,
          cursorSmoothing, showVectorCursor, cursorOffset,
          handleZoomDepthChange, handleZoomDelete, handleTrimDelete,
          handleExport, handleAnnotationContentChange, handleAnnotationTypeChange,
          handleAnnotationStyleChange, handleAnnotationFigureDataChange, handleAnnotationDelete,
          handleAutoZoom, videoPlaybackRef.current?.video
        ])"""

# Find the main return (
# We know it's right before <div className="h-screen w-full flex flex-col bg-[#09090b] text-white overflow-hidden">
main_return_pattern = r'(\s*return \(\s*<div className="h-screen w-full flex flex-col bg-\[\#09090b\])'
main_return_match = re.search(main_return_pattern, content)

if main_return_match:
    insertion = f"\n  const memoizedSidebar = {use_memo_call};\n"
    content = content[:main_return_match.start()] + insertion + content[main_return_match.start():]
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed VideoEditor.tsx return statement successfully.")
else:
    print("Could not find main return statement.")
