import re

file_path = 'src/components/video-editor/VideoEditor.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

use_memo_call = """const memoizedSidebar = useMemo(() => (
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
        ]);"""

# Replace "return (" at line 933
main_return_pattern = r'\n  return \(\n    <div \n      className="flex flex-col h-screen'
match = re.search(main_return_pattern, content)
if match:
    insertion = f"\n  {use_memo_call}\n\n"
    content = content[:match.start()] + insertion + content[match.start():]
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Inserted memoizedSidebar!")
else:
    print("Could not match the return statement exactly.")
