import re

file_path = 'src/components/video-editor/VideoEditor.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Extract the misplaced memoizedSidebar block
# It starts with "  const memoizedSidebar = useMemo(() => ("
# and ends with "        ]);"
memo_pattern = r'  const memoizedSidebar = useMemo\(\(\) => \(\s*<Sidebar.*?\s*\/>\s*\),\s*\[.*?\]\);'
match = re.search(memo_pattern, content, flags=re.DOTALL)

if match:
    memo_block = match.group(0)
    # Remove it from its current position
    content = content.replace(memo_block, "")
    
    # 2. Insert it RIGHT BEFORE the main return statement
    # The main return statement starts with:
    # return (
    #   <div 
    #     className="flex flex-col h-screen
    main_return_pattern = r'\n  return \(\n    <div \n      className="flex flex-col h-screen'
    main_return_match = re.search(main_return_pattern, content)
    
    if main_return_match:
        insertion = f"\n{memo_block}\n"
        content = content[:main_return_match.start()] + insertion + content[main_return_match.start():]
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Successfully moved memoizedSidebar to the correct place!")
    else:
        print("Could not find the main return statement.")
else:
    print("Could not find the memoizedSidebar block.")
