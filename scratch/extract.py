import json

log_file = '/Users/viosson/.gemini/antigravity/brain/acc9a07b-8440-4a53-8204-2fc50a45b5aa/.system_generated/logs/transcript.jsonl'
target_file = "src/components/video-editor/timeline/TimelineEditor.tsx"

results = []

with open(log_file, 'r') as f:
    for line in f:
        try:
            data = json.loads(line)
            if "tool_calls" in data:
                for call in data["tool_calls"]:
                    args = call.get("arguments", {})
                    if "TargetFile" in args and target_file in args["TargetFile"]:
                        if "ReplacementContent" in args:
                            results.append(args["ReplacementContent"])
                        if "ReplacementChunks" in args:
                            for chunk in args["ReplacementChunks"]:
                                results.append(chunk.get("ReplacementContent"))
        except Exception as e:
            pass

with open("scratch/timeline_edits.txt", "w") as out:
    for res in results:
        out.write("--- BLOCK ---\n")
        out.write(str(res) + "\n")
