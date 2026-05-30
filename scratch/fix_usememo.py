import re

file_path = 'src/components/video-editor/VideoEditor.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Find the useMemo block inside the JSX
pattern = r'\{\s*\/\*\s*Right section: Sidebar\s*\*\/\s*\}\s*\{useMemo\(\(\) => \(\s*<Sidebar.*?\s*\/\>\s*\),\s*\[.*?\]\)\}'
match = re.search(pattern, content, flags=re.DOTALL)

if match:
    memo_block = match.group(0)
    # Extract the useMemo call
    use_memo_call = re.search(r'useMemo\(\(\) => \(\s*<Sidebar.*?\s*\/\>\s*\),\s*\[.*?\]\)', memo_block, flags=re.DOTALL).group(0)
    
    # Remove the useMemo block from JSX and replace with {memoizedSidebar}
    new_jsx = "{/* Right section: Sidebar */}\n        {memoizedSidebar}"
    content = content.replace(memo_block, new_jsx)
    
    # 2. Insert const memoizedSidebar = useMemo(...) before the main return statement
    return_pattern = r'(\n\s*return \()'
    return_match = re.search(return_pattern, content)
    if return_match:
        insertion = f"\n  const memoizedSidebar = {use_memo_call};\n"
        content = content[:return_match.start()] + insertion + content[return_match.start():]
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Fixed useMemo placement in VideoEditor.tsx!")
    else:
        print("Could not find return statement.")
else:
    print("Could not find the useMemo block in JSX.")
