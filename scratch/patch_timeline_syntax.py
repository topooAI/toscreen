import re

file_path = 'src/components/video-editor/timeline/TimelineEditor.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the closing bracket
content = content.replace(
    "    </div>\n  );\n});\n\nexport default function TimelineEditor({",
    "    </div>\n  );\n}\n\nexport default function TimelineEditor({"
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Syntax fixed!")
