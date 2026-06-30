import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "product",
  "Product-and-Editor-Architecture.md",
);
const reviewPacketPath = path.join(
  repoRoot,
  "docs",
  "product",
  "ProjectModel-Review-Packet.md",
);
const acceptanceRecordPath = path.join(
  repoRoot,
  "docs",
  "product",
  "Phase1-User-Acceptance-Record.md",
);

const architectureDoc = fs.readFileSync(architectureDocPath, "utf8");
const reviewPacket = fs.readFileSync(reviewPacketPath, "utf8");
const acceptanceRecord = fs.readFileSync(acceptanceRecordPath, "utf8");

const requiredArchitecturePhrases = [
  "独立推进与用户介入一页式列表",
  "USER-05 | Main Clip 结束后的画面规则",
  "已决策：主录屏结束后工程继续到所有片段最晚结束，画面为黑屏尾部",
  "PH1-41 独立推进与用户介入清单",
  "npm run audit:phase1-ownership-list",
];

const requiredReviewPacketPhrases = [
  "Execution Ownership Checklist",
  "OWN-01",
  "OWN-05",
  "Black tail after Main Clip",
  "已锁定，预览和导出均应遵守",
  "OWN-11",
  "npm run audit:phase1-ownership-list",
];

const requiredAcceptanceRecordPhrases = [
  "快速对照清单 / Quick Reference Checklist",
  "Codex 独立推进 / Codex Owns",
  "用户介入节点 / User Steps In",
  "Screen Studio 底座 / Screen Studio-grade foundation",
  "多源画面 / Multi-source video",
  "AI 自动剪辑 / AI auto-editing",
  "是否关闭 Phase 1 并进入下一阶段必须由用户确认",
];

const staleOpenDecisionPhrases = [
  "需要产品体验判断：黑屏、最后一帧、背景还是模板",
  "Needs UX decision: black, freeze frame, background, or template",
];

const missingArchitecturePhrases = requiredArchitecturePhrases.filter(
  (phrase) => !architectureDoc.includes(phrase),
);
const missingReviewPacketPhrases = requiredReviewPacketPhrases.filter(
  (phrase) => !reviewPacket.includes(phrase),
);
const missingAcceptanceRecordPhrases = requiredAcceptanceRecordPhrases.filter(
  (phrase) => !acceptanceRecord.includes(phrase),
);
const staleOpenDecisions = staleOpenDecisionPhrases.filter(
  (phrase) =>
    architectureDoc.includes(phrase) ||
    reviewPacket.includes(phrase) ||
    acceptanceRecord.includes(phrase),
);

if (
  missingArchitecturePhrases.length > 0 ||
  missingReviewPacketPhrases.length > 0 ||
  missingAcceptanceRecordPhrases.length > 0 ||
  staleOpenDecisions.length > 0
) {
  console.error(JSON.stringify({
    status: "failed",
    architectureDocPath,
    reviewPacketPath,
    acceptanceRecordPath,
    missingArchitecturePhrases,
    missingReviewPacketPhrases,
    missingAcceptanceRecordPhrases,
    staleOpenDecisions,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "ok",
  architectureDocPath,
  reviewPacketPath,
  checked: {
    architecture: requiredArchitecturePhrases.length,
    reviewPacket: requiredReviewPacketPhrases.length,
    acceptanceRecord: requiredAcceptanceRecordPhrases.length,
  },
}, null, 2));
