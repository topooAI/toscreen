import re

file_path = 'src/components/video-editor/hooks/useAudioMixer.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace decoding logic to cache by sourceUrl
new_decoding_logic = """
    audioRegions.forEach(region => {
      const cacheKey = region.sourceUrl || region.id;
      if (!decodedBuffersRef.current.has(cacheKey)) {
        // Optimistically mark as loading
        decodedBuffersRef.current.set(cacheKey, null as any);
        
        const dataPromise = region.file 
          ? region.file.arrayBuffer() 
          : fetch(region.sourceUrl).then(res => res.arrayBuffer());
          
        dataPromise
          .then(data => ctx.decodeAudioData(data))
          .then(buffer => {
            decodedBuffersRef.current.set(cacheKey, buffer);
          })
          .catch(err => {
            console.error("Failed to decode audio", region.sourceUrl, err);
            decodedBuffersRef.current.delete(cacheKey);
          });
      }
    });
"""

content = re.sub(
    r'audioRegions\.forEach\(region => \{\s*if \(\!decodedBuffersRef\.current\.has\(region\.id\)\) \{.*?\n\s*\}\n\s*\}\);',
    new_decoding_logic.strip(),
    content,
    flags=re.DOTALL
)

# Replace playback logic to get from cache by sourceUrl
content = content.replace(
    "const buffer = decodedBuffersRef.current.get(region.id);",
    "const buffer = decodedBuffersRef.current.get(region.sourceUrl || region.id);"
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched useAudioMixer caching!")
