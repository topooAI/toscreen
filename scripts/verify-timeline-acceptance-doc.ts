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
  "npm run audit:timeline-track-origin",
  "npm run audit:timeline-lane-wrapping",
  "npm run audit:timeline-drag-safety",
  "npm run audit:timeline-magnetic-snap",
  "npm run audit:timeline-range-zoom",
  "npm run audit:timeline-seek-mapping",
  "npm run audit:timeline-debug-signal",
  "npm run audit:timeline-resize-handles",
  "npm run audit:timeline-clip-style",
  "npm run audit:timeline-playhead-time",
  "npm run audit:audio-resize-bounds",
  "npm run audit:original-audio-accordion",
  "npm run audit:main-video-thumbnails",
  "npm run audit:main-clip-segmentation",
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
  "DEV-02A | 当前时间轴调试信号接线合同",
  "DEV-02B | 当前时间轴调试信号实机确认",
  "CLIP-06 | 统一竖向拉伸把手",
  "CLIP-01 | 3px 片段缝隙",
  "CLIP-02 | 片段标题左上角对齐",
  "CLIP-03 | 片段内部无 Lucide 图标",
  "CLIP-04 | 统一 6px 圆角",
  "CLIP-05 | 选中态内发光",
  "TL-01A | 轨道起点坐标合同",
  "TL-01B | 轨道起点视觉对齐",
  "TL-07 | Main Track 到头后继续播放其他轨道",
  "TL-02A | 时间轴点击坐标映射",
  "TL-02B | 时间轴点击定位手感",
  "TL-03A | 左侧呼吸区坐标合同",
  "TL-03B | 左侧呼吸区实机归零",
  "TL-04A | 播放指针时间源合同",
  "TL-04B | 播放指针拖拽手感",
  "TL-05A | Trim 折叠点击映射合同",
  "TL-05B | Trim 折叠后的实机点击映射",
  "DRAG-01A | 音频可视分轨",
  "DRAG-01B | 音频拖拽碰撞手感",
  "DRAG-03 | Zoom 碰撞处理",
  "DRAG-04 | Annotation 自动分轨",
  "DRAG-05A | 磁吸算法合同",
  "DRAG-05B | 磁吸手感",
  "DRAG-06A | 拖拽 span 数值安全",
  "DRAG-06B | 无 NaN 拖拽死锁手感",
  "VIDEO-04A | 时间轴缩放左对齐合同",
  "VIDEO-04B | 时间轴缩放左对齐实机验收",
  "AUDIO-02A | 左拉伸波形对齐合同",
  "AUDIO-02B | 左拉伸波形手感",
  "AUDIO-03A | 左侧源边界合同",
  "AUDIO-03B | 左侧源边界手感",
  "AUDIO-04A | 右侧源边界合同",
  "AUDIO-04B | 右侧源边界手感",
  "AUDIO-05A | 原声音频手风琴挂载合同",
  "AUDIO-05B | 原声音频手风琴实机验收",
  "Audio source-bound resize contract",
  "Audio 跨轨 wiring",
  "0:20 之后画面为黑屏尾部",
  "VIDEO-01A | 主视频缩略图分段合同",
  "VIDEO-01B | 主视频缩略图实机渲染",
  "VIDEO-03A | Trim 后主片段分段合同",
  "VIDEO-03B | Trim 后主片段视觉验收",
  "VIDEO-06 | Main Track 与时间刻度解耦",
  "2026-07-01",
];

const forbiddenPhrases = [
  "Last updated / 最后更新：2026-06-07",
  "0:20 之后画面可保持最后帧/空画面",
  "只有 Video/Audio 是竖向把手",
  "Only Video/Audio use vertical handles",
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
