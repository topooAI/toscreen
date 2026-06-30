import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const srcRoot = path.join(repoRoot, "src");
const allowedFiles = new Set([
  path.join(srcRoot, "components", "video-editor", "VideoEditor.tsx"),
]);

const matches: Array<{ file: string; line: number; text: string }> = [];

scanDirectory(srcRoot);

const unexpected = matches.filter((match) => !allowedFiles.has(match.file));

if (unexpected.length > 0) {
  console.error(JSON.stringify({
    status: "failed",
    message: "Unexpected VideoExporter entrypoints found. Route exports through VideoEditor render settings or update this audit intentionally.",
    unexpected: unexpected.map((match) => ({
      file: path.relative(repoRoot, match.file),
      line: match.line,
      text: match.text,
    })),
  }, null, 2));
  process.exit(1);
}

if (matches.length === 0) {
  console.error(JSON.stringify({
    status: "failed",
    message: "No VideoExporter entrypoint found.",
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "ok",
  entrypoints: matches.map((match) => ({
    file: path.relative(repoRoot, match.file),
    line: match.line,
    text: match.text,
  })),
}, null, 2));

function scanDirectory(directory: string) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      scanDirectory(fullPath);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;

    const content = fs.readFileSync(fullPath, "utf8");
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (line.includes("new VideoExporter(")) {
        matches.push({
          file: fullPath,
          line: index + 1,
          text: line.trim(),
        });
      }
    });
  }
}
