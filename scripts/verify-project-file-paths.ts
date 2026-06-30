import path from "node:path";
import {
  normalizeMediaPath,
  projectPathCandidatesForMediaPath,
  projectPathForMediaPath,
} from "../electron/ipc/projectFiles";

const cases = [
  {
    label: "raw recording path",
    input: "/Users/viosson/Library/Application Support/toscreen/recordings/recording-1782710530746.mov",
    expected: "/Users/viosson/Library/Application Support/toscreen/recordings/recording-1782710530746.project.json",
  },
  {
    label: "preview proxy path",
    input: "/Users/viosson/Library/Application Support/toscreen/recordings/recording-1782710530746-proxy.mp4",
    expected: "/Users/viosson/Library/Application Support/toscreen/recordings/recording-1782710530746.project.json",
  },
  {
    label: "encoded file URL",
    input: "file:///Users/viosson/Library/Application%20Support/toscreen/recordings/recording-1782710530746.mov",
    expected: "/Users/viosson/Library/Application Support/toscreen/recordings/recording-1782710530746.project.json",
  },
  {
    label: "encoded unicode file URL",
    input: "file:///Users/viosson/Desktop/%E6%B5%8B%E8%AF%95/recording-123.mov",
    expected: "/Users/viosson/Desktop/测试/recording-123.project.json",
  },
];

let failed = false;

for (const testCase of cases) {
  const actual = projectPathForMediaPath(testCase.input);
  if (actual !== testCase.expected) {
    failed = true;
    console.error(`[ProjectFiles] ${testCase.label} failed`);
    console.error(`  expected: ${testCase.expected}`);
    console.error(`  actual:   ${actual}`);
  }
}

const proxyCandidates = projectPathCandidatesForMediaPath(cases[1].input);
const expectedProxyFallback = path.join(
  "/Users/viosson/Library/Application Support/toscreen/recordings",
  "recording-1782710530746-proxy.project.json",
);
if (
  proxyCandidates[0] !== cases[1].expected ||
  proxyCandidates[1] !== expectedProxyFallback
) {
  failed = true;
  console.error("[ProjectFiles] proxy candidate order failed");
  console.error(proxyCandidates);
}

const normalized = normalizeMediaPath(cases[3].input);
if (normalized !== "/Users/viosson/Desktop/测试/recording-123.mov") {
  failed = true;
  console.error("[ProjectFiles] unicode normalization failed");
  console.error(normalized);
}

if (failed) {
  process.exit(1);
}

console.log("[ProjectFiles] Project file path checks passed.");
