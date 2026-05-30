import json

log_file = '/Users/viosson/.gemini/antigravity/brain/acc9a07b-8440-4a53-8204-2fc50a45b5aa/.system_generated/logs/transcript.jsonl'
target = "TimelineEditor.tsx"

base_code = open("src/components/video-editor/timeline/TimelineEditor.tsx").read().split('\n')

# Actually, applying line replacements programmatically is hard because line numbers shift.
# However, I can just extract the "ReplacementContent" from the agent's tool calls and manually patch it.
with open(log_file, 'r') as f:
    for line in f:
        try:
            data = json.loads(line)
            if data.get("source") == "MODEL" and "tool_calls" in data:
                for call in data["tool_calls"]:
                    args = call.get("arguments", {})
                    if "TargetFile" in args and "TimelineEditor.tsx" in args["TargetFile"]:
                        print("==== TOOL CALL:", call["name"], "====")
                        if "ReplacementContent" in args:
                            print(args["ReplacementContent"])
                        if "ReplacementChunks" in args:
                            for chunk in args["ReplacementChunks"]:
                                print(chunk.get("ReplacementContent"))
        except Exception as e:
            pass
