import re

file_path = 'src/components/video-editor/VideoEditor.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

debug_ui = """
        {/* DEBUG INFO */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[9999] bg-black/80 text-white p-4 text-xs font-mono rounded pointer-events-none">
          <div>AudioRegions: {audioRegions?.length || 0}</div>
          {audioRegions?.map(r => (
            <div key={r.id}>
              {r.id.slice(0,4)} | start: {Math.round(r.startMs)} | end: {Math.round(r.endMs)} | srcStart: {r.sourceStartMs}
            </div>
          ))}
          <div>isTrimVisible: {isTrimTrackVisible ? 'true' : 'false'}</div>
        </div>
"""

# Insert into the return JSX of VideoEditor
content = content.replace(
    '<div className="h-screen w-full bg-black text-white flex flex-col overflow-hidden">',
    '<div className="h-screen w-full bg-black text-white flex flex-col overflow-hidden">\n' + debug_ui
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Debug UI injected!")
