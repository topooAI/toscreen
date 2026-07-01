import fs from "node:fs";
import path from "node:path";

const docPath = path.join(
  process.cwd(),
  "docs",
  "product",
  "Timeline-Acceptance-and-Iteration-Plan.md",
);

const content = fs.readFileSync(docPath, "utf8");

const requiredPhrases = [
  "时间轴验收与迭代计划 / Timeline Acceptance and Iteration Plan",
  "与 Phase 1 验收的关系 / Relationship To Phase 1 Acceptance",
  "Phase1-User-Acceptance-Record.md",
  "机器证据映射 / Machine Evidence Map",
  "npm run audit:electron-editor-runtime",
  "npm run audit:timeline-lane-wrapping",
  "npm run audit:project-model-clip-overlap-policy",
  "npm run audit:project-model-lane-wrapping",
  "npm run audit:project-duration",
  "npm run audit:timeline-duration-domains",
  "npm run audit:preview-project-time",
  "npm run audit:export-duration-render-settings",
  "npm run audit:screenstudio-core-contract",
  "🔒 Machine-Guarded",
  "RULE-01 | 片段重叠规则",
  "RULE-02 | 通用多轨时间轴",
  "RULE-03 | 拉伸把手样式",
  "RULE-04 | 片段选中样式",
  "TL-07 | Main Track 到头后继续播放其他轨道",
  "DRAG-01A | 音频可视分轨",
  "DRAG-01B | 音频拖拽碰撞手感",
  "DRAG-03 | Zoom 碰撞处理",
  "DRAG-04 | Annotation 自动分轨",
  "Audio 跨轨 wiring",
  "0:20 之后画面为黑屏尾部",
  "VIDEO-06 | Main Track 与时间刻度解耦",
  "2026-07-01",
];

const forbiddenPhrases = [
  "Last updated / 最后更新：2026-06-07",
  "0:20 之后画面可保持最后帧/空画面",
];

const missing = requiredPhrases.filter((phrase) => !content.includes(phrase));
const forbidden = forbiddenPhrases.filter((phrase) => content.includes(phrase));

if (missing.length > 0 || forbidden.length > 0) {
  console.error(JSON.stringify({
    status: "failed",
    docPath,
    missing,
    forbidden,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "ok",
  docPath,
  checked: requiredPhrases.length,
}, null, 2));
