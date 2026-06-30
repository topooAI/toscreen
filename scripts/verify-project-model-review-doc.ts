import fs from "node:fs";
import path from "node:path";

const docPath = path.join(
  process.cwd(),
  "docs",
  "product",
  "ProjectModel-Review-Packet.md",
);

const content = fs.readFileSync(docPath, "utf8");

const requiredPhrases = [
  "AI product-demo editor, not a generic NLE or recorder",
  "Screen recording",
  "Camera / Zoom / Focus",
  "Presenter / Digital human",
  "B-roll / Cutaway",
  "Lottie",
  "UI-aware motion",
  "AI Edit Plan",
  "Main Screen",
  "Camera",
  "Presenter",
  "UI Motion",
  "Does this model support the Phase 1 Screen Studio-grade foundation?",
  "Does Camera Clip leave enough room for future 3D camera work?",
  "Should multi-source composition stay model-only in Phase 1 or enter real UI/editing capability?",
  "npm run audit:project-model-review-packet",
  "npm run audit:phase1",
];

const missing = requiredPhrases.filter((phrase) => !content.includes(phrase));

if (missing.length > 0) {
  console.error(JSON.stringify({
    status: "failed",
    docPath,
    missing,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "ok",
  docPath,
  checked: requiredPhrases.length,
}, null, 2));
