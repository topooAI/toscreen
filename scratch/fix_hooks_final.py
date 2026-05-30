import re

file_path = 'src/components/video-editor/VideoEditor.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Extract the memoizedSidebar block again
memo_pattern = r'  const memoizedSidebar = useMemo\(\(\) => \(\s*<Sidebar.*?\s*\/>\s*\),\s*\[.*?\]\);'
match = re.search(memo_pattern, content, flags=re.DOTALL)

if match:
    memo_block = match.group(0)
    # Remove it from its current position
    content = content.replace(memo_block, "")
    
    # Insert it right before "if (loading) {"
    loading_pattern = r'\n  if \(loading\) \{'
    loading_match = re.search(loading_pattern, content)
    
    if loading_match:
        insertion = f"\n{memo_block}\n"
        content = content[:loading_match.start()] + insertion + content[loading_match.start():]
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Successfully hoisted memoizedSidebar ABOVE the early return!")
    else:
        print("Could not find early return.")
else:
    print("Could not find the memoizedSidebar block.")
