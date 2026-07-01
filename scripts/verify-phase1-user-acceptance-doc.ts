import fs from "node:fs";
import path from "node:path";
import { parsePhase1AcceptanceState } from "./phase1AcceptanceState";

const docPath = path.join(
  process.cwd(),
  "docs",
  "product",
  "Phase1-User-Acceptance-Record.md",
);

const content = fs.readFileSync(docPath, "utf8");

const requiredPhrases = [
  "Phase 1 用户验收记录 / Phase 1 User Acceptance Record",
  "npm run audit:phase1",
  "npm run audit:phase1-readiness",
  "npm run audit:recordings",
  "npm run audit:recording-asset-files",
  "npm run audit:timeline-track-origin",
  "npm run audit:timeline-lane-wrapping",
  "npm run audit:timeline-drag-safety",
  "npm run audit:timeline-magnetic-snap",
  "npm run audit:timeline-seek-mapping",
  "npm run audit:timeline-playhead-time",
  "npm run audit:timeline-waveform-layout",
  "npm run audit:timeline-trim-row-hidden",
  "npm run audit:phase1-handoff",
  "npm run audit:screenstudio-control-wiring",
  "npm run audit:export-background-parity",
  "phaseComplete: false",
  "phaseComplete: true",
  "coreRestore",
  "scenes",
  "当前对照入口 / Current Checklist Entry",
  "实际迭代时按这个顺序看",
  "看哪一节 / Section To Use",
  "Codex 可以直接推进哪些工程闭环",
  "开发对照列表 / Development Ownership Checklist",
  "快速对照清单 / Quick Reference Checklist",
  "Codex 独立推进 / Codex Owns",
  "用户介入节点 / User Steps In",
  "Screen Studio 底座 / Screen Studio-grade foundation",
  "是否关闭 Phase 1 并进入下一阶段必须由用户确认",
  "DEV-01 | 产品定位",
  "DEV-05 | Timeline 手感",
  "DEV-07 | Preview/Export 一致性",
  "DEV-09 | 多源画面",
  "DEV-12 | 阶段放行",
  "UA-01 | ProjectModel 方向确认",
  "UA-02 | Electron 重启恢复验收",
  "UA-03 | Timeline 手感验收",
  "UA-04 | Screen Studio 核心体验验收",
  "UA-05 | Preview/Export 成片验收",
  "UA-06 | Camera/Focus 操作语言确认",
  "UA-07 | AI 自动剪辑真实用例确认",
  "UA-08 | 阶段放行",
  "实机验收步骤 / Hands-On Acceptance Steps",
  "status: \"ready\"",
  "handsOnSteps",
  "editorRuntime",
  "acceptancePlan",
  "machine evidence",
  "acceptancePlan.machineEvidence",
  "真实 npm scripts",
  "sceneMigration",
  "assetFiles",
  "完全退出并重启 Electron",
  "拖拽、拉伸、磁吸、滚轮缩放、移动游标",
  "系统光标模拟、Zoom/Focus、背景虚化、黑屏尾部",
  "导出同一个项目，和预览对比",
  "未来是否应该命名为 Camera Clip",
  "真实宣传视频场景",
  "[x] Accepted",
  "Current phase status: **Not released / 未放行**",
];

const missing = requiredPhrases.filter((phrase) => !content.includes(phrase));
const acceptance = parsePhase1AcceptanceState(content);

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
  userAcceptedItems: acceptance.userAcceptedItems,
  pendingIds: acceptance.pendingIds,
  currentPhaseStatus: acceptance.currentPhaseStatus,
  phaseReleased: acceptance.phaseReleased,
}, null, 2));
