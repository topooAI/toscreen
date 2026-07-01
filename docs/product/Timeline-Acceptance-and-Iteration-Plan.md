# 时间轴验收与迭代计划 / Timeline Acceptance and Iteration Plan

本文档是视频编辑器时间轴迭代的核心验收文档。  
This document is the source of truth for the video editor timeline acceptance work.

使用方式：每次选择少量清单 ID，完成实现，在 Electron 中核验，然后更新本文档状态和日志。  
How to use it: pick a small set of checklist IDs, implement them, verify in Electron, then update the status and iteration log here.

Last updated / 最后更新：2026-07-01

## 与 Phase 1 验收的关系 / Relationship To Phase 1 Acceptance

本文档是 `Phase1-User-Acceptance-Record.md` 的时间轴细分清单，不单独决定 Phase 1 是否放行。  
This document is the timeline-specific breakdown under `Phase1-User-Acceptance-Record.md`; it does not release Phase 1 by itself.

| Phase 1 UA | 本文档覆盖 / Covered Here | 放行关系 / Release Relationship |
|---|---|---|
| UA-02 Electron 重启恢复验收 / Electron restart recovery review | DEV-01, VIDEO-01, AUDIO-05 | 本文档只能提供时间轴和运行时证据；最终仍需 Electron 实机确认。 / This document provides timeline/runtime evidence only; final confirmation still needs hands-on Electron review. |
| UA-03 Timeline 手感验收 / Timeline feel review | TL-01 至 TL-07，DRAG-01 至 DRAG-06 / TL-01 through TL-07, DRAG-01 through DRAG-06 | 这些项目必须在真实时间轴上测试后才能标记 Accepted。 / These items require real timeline testing before they can be marked Accepted. |
| UA-04 Screen Studio 核心体验验收 / Screen Studio-grade UX review | CLIP-01 至 CLIP-06，VIDEO-01 至 VIDEO-06 / CLIP-01 through CLIP-06, VIDEO-01 through VIDEO-06 | 视觉和手感必须由 Electron 体验判断。 / Visual polish and interaction feel must be judged in Electron. |
| UA-05 Preview/Export 成片验收 / Preview/export video review | TL-06, TL-07, VIDEO-05, VIDEO-06 | 机器门禁能证明工程时长合同；成片是否一致仍需导出对比。 / Machine gates prove duration contracts; final parity still needs exported-video review. |

## 机器证据映射 / Machine Evidence Map

机器门禁只能证明关键连接点没有断，不能替代实机体验。  
Machine gates prove that key wiring is intact, but they do not replace hands-on review.

| 范围 / Scope | 机器证据 / Machine Evidence | 证明什么 / What It Proves |
|---|---|---|
| DEV-01 热更新入口 / Hot-update entry | `npm run audit:electron-editor-runtime` | `dev:editor`、localhost HMR 和 Electron editor 直达入口仍存在。 / `dev:editor`, localhost HMR, and the direct Electron editor entry still exist. |
| RULE-01 同轨不重叠 / No same-track overlap | `npm run audit:project-model-clip-overlap-policy`, `npm run audit:project-model-lane-wrapping` | ProjectModel 拒绝同轨重叠，并允许通过同类型子轨换行。 / ProjectModel rejects same-track overlap and supports same-type child-lane wrapping. |
| RULE-02 工程总长 / Project duration | `npm run audit:project-duration`, `npm run audit:timeline-duration-domains`, `npm run audit:preview-project-time`, `npm run audit:export-duration-render-settings` | 时间轴、预览、导出都以工程总长合同为基础。 / Timeline, preview, and export are based on the project-duration contract. |
| RULE-03 拉伸把手 / Resize handles | `npm run audit:electron-editor-runtime` | Focus resize preview 和片段端点结构仍被保护。 / Focus resize preview and clip endpoint structure are guarded. |
| RULE-04 / CLIP-04 / CLIP-05 片段选中视觉 / Clip selected visual style | `npm run audit:electron-editor-runtime` | 所有 clip 基类保持 6px 圆角，selected 状态使用 inset box-shadow 且不通过 background 改变尺寸感。 / All clip base classes keep a 6px radius, and selected states use inset box-shadow without background-based size perception changes. |
| TL-01A 轨道起点坐标合同 / Track origin contract | `npm run audit:timeline-track-origin` | Sidebar 宽度、16px 呼吸留白、fallback trackStartPx、真实 track area 测量，以及 Axis/Cursor/Seek 共用 trackStartPx 的连接点被保护。 / Sidebar width, the 16px breathing gap, fallback trackStartPx, real track-area measurement, and Axis/Cursor/Seek shared trackStartPx wiring are guarded. |
| TL-02A / TL-03A / TL-05A 点击映射合同 / Seek mapping contract | `npm run audit:timeline-seek-mapping` | 点击坐标统一从 trackStartPx 后开始计算，左侧呼吸区归零，range offset、工程时长 clamp 和 Trim 折叠 effective->source 映射被保护。 / Click coordinates are measured from trackStartPx, the left breathing area resets to zero, and range offset, project-duration clamp, and Trim-folded effective-to-source mapping are guarded. |
| DRAG-01A / DRAG-03 / DRAG-04 可视分轨 / Visual lane wrapping | `npm run audit:timeline-lane-wrapping`, `npm run audit:project-model-lane-wrapping` | Timeline 可视层会把重叠 Audio、Zoom/Focus、Annotation 分到不同同类型 lane，并检查 Audio 跨轨 wiring；ProjectModel 层也保护同类型 lane wrapping。 / Timeline visual layout wraps overlapping Audio, Zoom/Focus, and annotation clips onto separate same-type lanes and checks Audio cross-lane wiring; ProjectModel also guards same-type lane wrapping. |
| DRAG-05A 磁吸算法合同 / Magnetic snap algorithm contract | `npm run audit:timeline-magnetic-snap` | 磁吸目标排除 active item 和同 base id 分段，只吸附播放头、同行 peer 和主视频轨边缘，且只在阈值内生效。 / Snap targets exclude the active item and same-base split parts, snap only to the playhead, same-row peers, and main-video edges, and apply only within threshold. |
| DRAG-06A 拖拽数值安全 / Drag numeric safety | `npm run audit:timeline-drag-safety` | Drag/resize 事件产生的 NaN、Infinity、负起点、反向区间和极短区间会先归一成有限 span，再进入碰撞、磁吸和落点更新。 / Drag/resize spans with NaN, Infinity, negative starts, reversed ranges, or tiny durations normalize into finite spans before collision, snap, and placement updates. |
| VIDEO-04A 时间轴缩放左对齐合同 / Timeline range zoom left-alignment contract | `npm run audit:timeline-range-zoom` | 缩放 range 时固定左边缘，平移时保留请求起点，并保留最小可视范围、最大可视范围和右侧工作区护栏。 / Range zoom keeps the left edge fixed, pan preserves requested start, and min visible range, max visible span, and right-workspace guardrails remain active. |
| TL-04A 播放指针时间源合同 / Playhead time-source contract | `npm run audit:timeline-playhead-time` | 播放时可以跟随 video.currentTime；暂停、拖拽、冻结外部时间或外部时间无效时必须信任 React currentTime；Trim 折叠时 source time 映射到 effective time。 / During playback the playhead may follow video.currentTime; while paused, dragging, external time is frozen, or external time is invalid, it must trust React currentTime; folded Trim maps source time to effective time. |
| AUDIO-02A / AUDIO-03A / AUDIO-04A 音频源边界合同 / Audio source-bound resize contract | `npm run audit:audio-resize-bounds` | 波形偏移、左侧源起点物理墙、右侧源结尾物理墙，以及松手后的 audio span clamp 共用同一套 helper。 / Waveform offset, left source-start wall, right source-end wall, and committed audio span clamp share the same helper. |
| AUDIO-05A 原声音频手风琴挂载合同 / Original audio accordion wiring contract | `npm run audit:original-audio-accordion` | 未分离原声挂载在主视频片段上，分离原声和非原声音频保留在独立音轨，Trim 折叠后的主片段同步写入原声 source range。 / Non-detached original audio attaches to the main video clip, detached original and non-original audio remain standalone, and folded Main Clip segments carry matching original-audio source ranges. |
| VIDEO-01A 主视频缩略图分段合同 / Main video thumbnail segmentation contract | `npm run audit:main-video-thumbnails` | 主视频缩略图按默认区间和 Zoom/Focus 区间分段，分割虚线百分比与同一组 Zoom/Focus 边界同步，并支持 resize preview 边界。 / Main video thumbnails split into default and Zoom/Focus ranges, separator percentages come from the same Zoom/Focus boundaries, and resize-preview boundaries are supported. |
| VIDEO-03A 主片段分段合同 / Main clip segmentation contract | `npm run audit:main-clip-segmentation` | Trim 折叠后主视频轨只显示保留的源片段，source/effective 时间映射由同一 helper 生成。 / After Trim is folded, the main video track renders only kept source ranges, with source/effective timing generated by one helper. |
| UA-04 核心体验连接点 / Core UX wiring | `npm run audit:screenstudio-core-contract`, `npm run audit:electron-editor-runtime` | 背景、Zoom/Camera、Annotation、系统光标、fallback 预览和主轨样式连接点仍存在。 / Background, Zoom/Camera, annotation, system cursor, fallback preview, and main-track styling wiring still exist. |

## 状态说明 / Status Legend

| Status | 中文含义 | English Meaning |
|---|---|---|
| ✅ Accepted | 已验收通过，无已知后续问题。 | Verified in code and/or Electron. No known follow-up for this item. |
| 🟡 Needs Verification | 代码看起来支持，但仍需要在 Electron 中实测。 | Code appears to support it, but it still needs hands-on Electron testing. |
| 🔒 Machine-Guarded | 有机器门禁保护，但仍可能需要实机体验。 | Covered by machine gates, but may still require hands-on review. |
| 🟠 Partial | 已实现一部分，但未完全达到验收标准。 | Part of the requirement is implemented, but the acceptance standard is not fully met. |
| ❌ Not Complete | 当前实现缺失，或与需求冲突。 | Current implementation conflicts with the requirement or is missing. |
| ⛔ Blocked | 产品规则未明确前无法继续。 | Cannot be completed until the product rule is clarified. |

## 需要先明确的产品规则 / Product Rules To Clarify

这些规则会影响多个实现点，应在大规模重构前先确认。  
These rules affect several implementation choices. Confirm them before broad refactors.

| ID | 规则 / Rule | 建议决策 / Recommended Decision | Status | Notes / 备注 |
|---|---|---|---|---|
| RULE-01 | 片段重叠规则 / Clip overlap behavior | 所有片段都不允许在同一轨道内重叠，包括 Annotation；如果时间重叠，应自动新增轨道或换行显示。 / No clip type may overlap within the same track, including Annotation; if time ranges overlap, the editor should add or use another track row. | ✅ Accepted | 产品规则已确认。当前代码需要按此规则统一实现，尤其是 Annotation。 / Product rule confirmed. Current code needs to be aligned with this rule, especially Annotation. |
| RULE-02 | 通用多轨时间轴 / Universal multi-track timeline | 时间轴长度不以录屏主视频为唯一上限；只要任意轨道仍有片段内容，工程播放范围就应延伸到最后一个片段结束。 / Timeline length is not capped by the recorded main video alone; as long as any track contains content, project playback should extend to the latest clip end. | ✅ Accepted | 产品规则已确认。Main Track 可短于工程总时长；时间刻度和播放控制应使用 project duration，而不是只使用 video duration。 / Product rule confirmed. Main Track may be shorter than project duration; ticks and playback controls should use project duration, not only video duration. |
| RULE-03 | 拉伸把手样式 / Resize handle style | 所有片段统一使用竖向白色圆角小把手，以音频轨道样式为准。 / All clip types should use the same vertical white rounded handle, matching the audio track style. | ✅ Accepted | 已在 Electron 中确认，Zoom/Trim/Annotation 不再显示 SVG 端帽或横线。 / Verified in Electron. Zoom/Trim/Annotation no longer show SVG end caps or horizontal dashes. |
| RULE-04 | 片段选中样式 / Clip selected style | 选中态使用不改变尺寸的内发光样式。 / Selected clips should use inset glow without changing layout dimensions. | 🔒 Machine-Guarded | CSS 已改为 inset box-shadow；仍需 Electron 视觉体验确认。 / CSS now uses inset box-shadow; Electron visual review is still required. |

## 优先级路线图 / Priority Roadmap

### P0：先保证编辑器可稳定测试 / Make The Editor Reliably Testable

| ID | 验收项 / Acceptance Item | 验收方法 / Acceptance Method | 预期结果 / Expected Result | Current Status | Code Area |
|---|---|---|---|---|---|
| DEV-01 | Electron renderer 热更新 / Electron renderer hot update | 修改 renderer 文件后，刷新或观察当前 Electron 编辑器窗口的 HMR。 / Change a renderer file, then refresh or observe HMR in the current Electron editor window. | 不需要重新录制，即可看到最新 renderer 代码。 / Latest renderer code is visible without recording again. | 🔒 Machine-Guarded | `vite.config.ts`, `electron/windows.ts`, `audit:electron-editor-runtime` |
| DEV-02 | 当前时间轴代码调试信号 / Debug signal for current timeline code | 刷新 Electron，点击时间轴，查看 DevTools Console。 / Refresh Electron, click timeline, inspect DevTools Console. | 调试阶段点击时间轴时输出 `[TimelineSeek] ...`。 / Console logs `[TimelineSeek] ...` on timeline clicks during debugging. | 🟡 Needs Verification | `src/components/video-editor/timeline/TimelineEditor.tsx` |

### P1：修复时间轴点击与播放指针精度 / Fix Timeline Click And Playhead Accuracy

| ID | 验收项 / Acceptance Item | 验收方法 / Acceptance Method | 预期结果 / Expected Result | Current Status | Code Area |
|---|---|---|---|---|---|
| TL-01A | 轨道起点坐标合同 / Unified track origin coordinate contract | 模拟 timeline rect、track area rect、缺失测量和负值测量，并静态检查 Row、Axis、Cursor、Seek 共享 trackStartPx。 / Simulate timeline rect, track-area rect, missing measurements, and negative measurements, and statically check Row, Axis, Cursor, and Seek share trackStartPx. | Sidebar 宽度、16px 呼吸留白和 fallback origin 统一；真实轨道起点通过 track area 测量；Axis/Cursor/Seek 不再各自硬编码起点。 / Sidebar width, the 16px breathing gap, and fallback origin are unified; the real track origin is measured from the track area; Axis/Cursor/Seek no longer hardcode separate origins. | 🔒 Machine-Guarded | `Row.tsx`, `TimelineEditor.tsx`, `timelineTrackOrigin.ts`, `audit:timeline-track-origin` |
| TL-01B | 轨道起点视觉对齐 / Unified track origin visual alignment | 对比 0:00 刻度、视频轨、Zoom 轨、Annotation 轨、Audio 轨左边缘。 / Compare 0:00 tick, video track, zoom track, annotation track, and audio track left edges. | 所有时间轴内容从侧边栏后的同一 X 坐标开始，并保留 16px 呼吸留白。 / All timeline content starts from the same x-coordinate after the sidebar, with a 16px breathing gap. | 🟡 Needs Verification | `Row.tsx`, `TimelineEditor.tsx` |
| TL-02A | 时间轴点击坐标映射 / Timeline click coordinate mapping | 用固定 timeline left、trackStartPx、range start 和 pixelsToValue 模拟点击。 / Simulate clicks with fixed timeline left, trackStartPx, range start, and pixelsToValue. | 点击位置按统一坐标系映射到 effective time，并 clamp 到工程时长。 / Click positions map to effective time through one coordinate system and clamp to project duration. | 🔒 Machine-Guarded | `TimelineEditor.tsx`, `timelineSeekMapping.ts`, `audit:timeline-seek-mapping` |
| TL-02B | 时间轴点击定位手感 / Timeline click seek feel | 在 Electron 中点击多个可见时间点，尤其是 0s、3s、6s、10s 附近。 / In Electron, click several visible timeline positions, especially around 0s, 3s, 6s, and 10s. | 播放指针落在点击位置，无明显偏移。 / Playhead lands where clicked. No large offset. | 🟡 Needs Verification | `TimelineEditor.tsx`, `VideoEditor.tsx` |
| TL-03A | 左侧呼吸区坐标合同 / Left breathing-area coordinate contract | 模拟点击 trackStartPx 左侧区域。 / Simulate clicks left of trackStartPx. | 左侧呼吸区直接解析为 0:00，不走常规偏移算法。 / The left breathing area resolves directly to 0:00 and bypasses normal offset mapping. | 🔒 Machine-Guarded | `TimelineEditor.tsx`, `timelineSeekMapping.ts`, `audit:timeline-seek-mapping` |
| TL-03B | 左侧呼吸区实机归零 / Left breathing area resets to 0 in Electron | 点击侧边栏和 0:00 刻度之间的留白区。 / Click the area between sidebar and 0:00 tick. | 播放指针精确回到 0:00。 / Playhead seeks to exactly 0:00. | 🟡 Needs Verification | `TimelineEditor.tsx` |
| TL-04A | 播放指针时间源合同 / Playhead time-source contract | 用播放、暂停、拖拽、冻结外部时间、Trim 折叠和无效 external time 模拟播放指针时间源。 / Simulate playhead time sources for playback, pause, drag, frozen external time, folded Trim, and invalid external time. | 拖拽或暂停时播放指针不会被 video.currentTime 拉回；播放时才允许跟随 video.currentTime；Trim 折叠时显示 effective time。 / While dragging or paused, the playhead cannot be pulled back by video.currentTime; only playback may follow video.currentTime; folded Trim displays effective time. | 🔒 Machine-Guarded | `TimelineEditor.tsx`, `timelinePlayheadTime.ts`, `audit:timeline-playhead-time` |
| TL-04B | 播放指针拖拽手感 / Playhead drag feel | 将粉色播放指针从头拖到尾，再从尾拖回头。 / Drag the pink playhead from beginning to end and back. | 指针跟手，不被 video 引擎 timeupdate 拉回。 / Playhead tracks the pointer and does not snap back due to video engine updates. | 🟡 Needs Verification | `TimelineEditor.tsx`, `VideoEditor.tsx` |
| TL-05A | Trim 折叠点击映射合同 / Trim-folded seek mapping contract | 模拟 effective time 到 source time 的映射。 / Simulate effective-time to source-time mapping. | Trim 折叠时点击 effective time 会通过 mapEffectiveToSource 还原到源视频时间；Trim 可见时保持 effective time。 / When Trim is folded, clicked effective time maps back to source video time through mapEffectiveToSource; when Trim is visible, effective time is preserved. | 🔒 Machine-Guarded | `useTimeMap.ts`, `timelineSeekMapping.ts`, `audit:timeline-seek-mapping` |
| TL-05B | Trim 折叠后的实机点击映射 / Trim-folded seek mapping in Electron | 隐藏/折叠 Trim 后，在被裁切区段之后点击主时间轴。 / With one or more Trim regions hidden/folded, click the main timeline after a trimmed segment. | UI 有效时间能正确映射回源视频时间。 / UI effective time maps correctly to source video time. | 🟡 Needs Verification | `useTimeMap.ts`, `TimelineEditor.tsx` |
| TL-06 | 工程总时长来自所有轨道 / Project duration comes from all tracks | 放置一个超过 Main Track 结尾的音频或标注片段。 / Place an audio or annotation clip that extends beyond the Main Track end. | 时间轴、播放控件、导出范围使用所有片段的最晚结束时间。 / Timeline, playback controls, and export range use the latest end time across all clips. | 🔒 Machine-Guarded | `VideoEditor.tsx`, `TimelineEditor.tsx`, exporter, `audit:project-duration` |
| TL-07 | Main Track 到头后继续播放其他轨道 / Continue after Main Track ends | Main Track 到 0:20 结束，但 Audio 到 0:30 结束，然后点击播放。 / Let Main Track end at 0:20 while Audio ends at 0:30, then play. | 播放不会在 Main Track 结尾停止；0:20 之后画面为黑屏尾部，音频继续播放到工程结束。 / Playback does not stop at Main Track end; after 0:20 the canvas shows a black tail while audio continues until project end. | 🔒 Machine-Guarded | `VideoEditor.tsx`, `VideoPlayback`, audio mixer, `audit:preview-project-time` |

### P2：统一片段视觉样式 / Normalize Clip Visual Style

| ID | 验收项 / Acceptance Item | 验收方法 / Acceptance Method | 预期结果 / Expected Result | Current Status | Code Area |
|---|---|---|---|---|---|
| CLIP-01 | 3px 片段缝隙 / 3px clip gap | 将两个片段紧贴摆放。 / Place two clips adjacent to each other. | 片段之间保留精致微缝，不会视觉粘连。 / A precise small gap is visible; clips do not visually merge. | ✅ Accepted | `Item.tsx` |
| CLIP-02 | 片段标题左上角对齐 / Clip title alignment | 检查 Video、Zoom、Audio、Annotation、Trim 标签。 / Inspect Video, Zoom, Audio, Annotation, and Trim labels. | 文本左上角对齐，顶部和左侧约 6px 内边距。 / Text is top-left aligned with 6px top and left padding. | ✅ Accepted | `Item.tsx` |
| CLIP-03 | 片段内部无 Lucide 图标 / No inner Lucide icons inside clips | 检查所有片段类型。 / Inspect all clip types. | 片段主体只显示文本，不显示 Lucide 图标。 / Clip body shows text only, no Lucide icon inside the clip. | ✅ Accepted | `Item.tsx` |
| CLIP-04 | 统一 6px 圆角 / Consistent 6px clip radius | 视觉检查并核对 CSS。 / Inspect all clip types visually and in CSS. | 所有片段卡片使用 6px 圆角。 / All clip cards use 6px radius. | 🔒 Machine-Guarded | `ItemGlass.module.css`, `audit:electron-editor-runtime` |
| CLIP-05 | 选中态内发光 / Selected clip inset glow | 逐个选中各类片段。 / Select each clip type. | 选中态使用内发光/内描边，不改变片段尺寸。 / Selection uses inset glow/outline and does not change the clip size. | 🔒 Machine-Guarded | `ItemGlass.module.css`, `audit:electron-editor-runtime` |
| CLIP-06 | 统一竖向拉伸把手 / Unified vertical resize handles | 悬浮或选中各类片段。 / Hover/select each clip type. | 左右两侧均显示与音频轨道一致的竖向白色圆角把手，不出现横线、括号状 SVG 端帽或额外装饰。 / Both edges show the same vertical white rounded handles as audio clips. No horizontal dash, bracket-like SVG cap, or extra decoration. | ✅ Accepted | `Item.tsx`, `ItemGlass.module.css` |

### P3：拖拽、拉伸、碰撞与磁吸 / Drag, Resize, Collision, And Magnetic Snap

| ID | 验收项 / Acceptance Item | 验收方法 / Acceptance Method | 预期结果 / Expected Result | Current Status | Code Area |
|---|---|---|---|---|---|
| DRAG-01A | 音频可视分轨 / Audio visual lane wrapping | 制造两个时间重叠的音频片段。 / Create two audio clips with overlapping time ranges. | 重叠音频不会显示在同一可视 Audio lane；贴边音频可以复用同一 lane。 / Overlapping audio clips do not render in the same visual Audio lane; edge-touching clips can reuse the same lane. | 🔒 Machine-Guarded | `TimelineEditor.tsx`, `lanePartition.ts`, `audit:timeline-lane-wrapping`, `audit:project-model-lane-wrapping` |
| DRAG-01B | 音频拖拽碰撞手感 / Audio drag collision feel | 将一个音频片段拖到同一音轨的另一个音频片段上。 / Drag one audio clip onto another in the same audio row. | 不允许同轨重叠；应贴边避让或换到新的空闲音轨，且没有突兀跳动。 / Same-track overlap is not allowed; the clip should snap to an available edge or move to another available audio row without visual jump surprises. | 🟡 Needs Verification | `TimelineWrapper.tsx`, `TimelineEditor.tsx` |
| DRAG-02 | 音频跨轨拖拽 / Audio cross-track drag | 将音频片段拖到不同音频轨道。 / Drag audio between audio rows. | trackIndex 正确更新，不能误落到非音频轨。 / Track index updates correctly; audio cannot drop into invalid non-audio rows. | 🔒 Machine-Guarded | `TimelineWrapper.tsx`, `TimelineEditor.tsx`, `audit:timeline-lane-wrapping` |
| DRAG-03 | Zoom 碰撞处理 / Zoom collision handling | 将 Zoom 区域拖拽或拉伸到另一个 Zoom 区域上。 / Drag or resize Zoom regions into each other. | 不允许同轨重叠；应贴边避让或换到新的空闲 Focus/Zoom 子轨。 / Same-track overlap is not allowed; the region should snap to an available edge or move to another available Focus/Zoom sub-track. | 🔒 Machine-Guarded | `TimelineEditor.tsx`, `lanePartition.ts`, `audit:timeline-lane-wrapping`, `audit:project-model-camera-migration` |
| DRAG-04 | Annotation 自动分轨 / Annotation automatic lane wrapping | 创建多个时间重叠的 Annotation，或将 Annotation 拖到同轨已有 Annotation 上。 / Create overlapping annotations, or drag one annotation onto another annotation in the same row. | 不允许同轨重叠；重叠时自动新增 Annotation 轨道/换行显示。 / Same-track overlap is not allowed; overlapping annotations should automatically use another annotation row. | 🔒 Machine-Guarded | `TimelineEditor.tsx`, `lanePartition.ts`, `audit:timeline-lane-wrapping`, `audit:project-model-lane-wrapping` |
| DRAG-05A | 磁吸算法合同 / Magnetic snap algorithm contract | 用播放头、同行 peer、主视频轨边缘、自身原始边缘和同 base id 分段模拟磁吸。 / Simulate snap against playhead, same-row peers, main-video edges, original self edges, and same-base split parts. | 只在阈值内吸附；排除自身原始位置和同 base id 分段；拉伸时只移动被拉伸边缘。 / Snap only within threshold; original self position and same-base split parts are excluded; resize moves only the resized edge. | 🔒 Machine-Guarded | `TimelineEditor.tsx`, `timelineMagneticSnap.ts`, `audit:timeline-magnetic-snap` |
| DRAG-05B | 磁吸手感 / Magnetic snap feel | 在 Electron 中将片段拖拽/拉伸到相邻片段边缘或播放指针附近。 / In Electron, drag/resize clips near adjacent clip edges or the playhead. | 仅在阈值内吸附，不因自身原始位置产生粘连拉扯。 / Clip edge snaps only within threshold; no sticky pull from its own original position. | 🟡 Needs Verification | `TimelineEditor.tsx` |
| DRAG-06A | 拖拽 span 数值安全 / Drag span numeric safety | 用 NaN、Infinity、负起点、反向区间和极短区间模拟 drag/resize span。 / Simulate drag/resize spans with NaN, Infinity, negative starts, reversed ranges, and tiny durations. | 所有异常 span 都归一成有限、非负、满足最小时长的 span。 / Every invalid span normalizes into a finite, non-negative span that satisfies the minimum duration. | 🔒 Machine-Guarded | `TimelineWrapper.tsx`, `timelineSpanSafety.ts`, `audit:timeline-drag-safety` |
| DRAG-06B | 无 NaN 拖拽死锁手感 / No NaN drag-lock feel | 在 Electron 中激进拖拽和拉伸很短的片段。 / Aggressively drag and resize small clips in Electron. | 不出现一格一卡、NaN 跳动或拖拽冻结。 / No one-grid stutter, NaN jump, or frozen drag state. | 🟡 Needs Verification | `TimelineWrapper.tsx`, `Item.tsx` |

### P4：主视频轨道与 Trim 折叠 / Main Video Track And Trim Folding

| ID | 验收项 / Acceptance Item | 验收方法 / Acceptance Method | 预期结果 / Expected Result | Current Status | Code Area |
|---|---|---|---|---|---|
| VIDEO-01A | 主视频缩略图分段合同 / Main video thumbnail segmentation contract | 模拟默认区间、Zoom/Focus 区间、裁剪区间和边界百分比，并静态检查组件 wiring。 / Simulate default ranges, Zoom/Focus ranges, clipped ranges, and boundary percentages, then statically check component wiring. | 缩略图按默认区间和 Zoom/Focus 区间分段；分割虚线和缩略图分段使用同一组边界；resize preview 边界可驱动主轨缩略图。 / Thumbnails split by default and Zoom/Focus ranges; separators and thumbnail segments use the same boundaries; resize-preview boundaries can drive main-track thumbnails. | 🔒 Machine-Guarded | `VideoThumbnails.tsx`, `timelineThumbnailSegments.ts`, `audit:main-video-thumbnails` |
| VIDEO-01B | 主视频缩略图实机渲染 / Main video thumbnails hands-on render | 加载一段已录制视频。 / Load a recorded video. | 主视频片段显示缩略图，而不是空色块。 / Main video clips show thumbnails, not empty blocks. | 🟡 Needs Verification | `VideoThumbnails.tsx`, `Item.tsx` |
| VIDEO-02 | 物理 Trim 轨隐藏 / Physical Trim track hidden | 添加 Trim 区段后检查时间轴行。 / Add Trim regions and inspect timeline rows. | Trim 被折叠进主视频表现中，不显示独立 Trim 轨道。 / Trim is folded into main video representation; no separate visible Trim row. | ✅ Accepted | `TimelineEditor.tsx` |
| VIDEO-03A | Trim 后主片段分段合同 / Main clip segmentation contract after Trim | 模拟单个、多段、重叠、嵌套和越界 Trim。 / Simulate single, multiple, overlapping, nested, and out-of-range Trim regions. | 主轨只生成保留源片段；相交 Trim 不会让 source cursor 倒退；片段按有效成片时间排列。 / The main track generates only kept source segments; intersecting trims cannot move the source cursor backwards; segments are arranged in effective output time. | 🔒 Machine-Guarded | `TimelineEditor.tsx`, `timelineMainClipSegments.ts`, `audit:main-clip-segmentation` |
| VIDEO-03B | Trim 后主片段视觉验收 / Main clip segmentation visual review after Trim | 添加一个或多个 Trim 区段并查看主轨。 / Add one or more Trim regions and inspect the main track. | 主轨只显示保留的源视频片段，并按有效成片时间排列。 / Main track displays only kept source segments in effective/output time. | 🟡 Needs Verification | `TimelineEditor.tsx`, `useTimeMap.ts` |
| VIDEO-04A | 时间轴缩放左对齐合同 / Track range left-alignment contract | 模拟 zoom、pan、负起点、最小可视范围、最大 span 和右侧工作区护栏。 / Simulate zoom, pan, negative start, minimum visible range, maximum span, and right-workspace guardrails. | 缩放时左边缘保持稳定；平移不被误判为缩放；0 点不会漂进侧边栏；右侧仍有通用时间轴工作空间。 / Zoom keeps the left edge stable; pan is not mistaken for zoom; 0 does not drift into the sidebar; the right side still has universal-timeline workspace. | 🔒 Machine-Guarded | `TimelineWrapper.tsx`, `timelineRangeZoom.ts`, `audit:timeline-range-zoom` |
| VIDEO-04B | 时间轴缩放左对齐实机验收 / Track range left-alignment hands-on review | 使用滚轮或手势缩放时间轴。 / Zoom the timeline with wheel/gesture. | 左边缘保持稳定，0 点不漂进侧边栏。 / Left edge remains stable; 0 does not drift into sidebar. | 🟡 Needs Verification | `TimelineWrapper.tsx` |
| VIDEO-05 | 时间轴可无限向右工作 / Timeline can work indefinitely to the right | 向右平移并在主视频结尾之后放置音频/标注/其他片段。 / Pan right and place audio, annotation, or other clips after the main video end. | 时间轴可继续承载内容，不被主视频长度锁死；实现上可有性能保护上限，但用户感知上应像剪映一样可持续向右扩展。 / Timeline can continue carrying content and is not locked to main video length; implementation may have performance guardrails, but user experience should feel continuously extendable like CapCut/Jianying. | 🔒 Machine-Guarded | `TimelineWrapper.tsx`, `TimelineEditor.tsx`, `audit:timeline-duration-domains` |
| VIDEO-06 | Main Track 与时间刻度解耦 / Main Track decoupled from timeline ticks | Main Track 比其他轨道短时观察刻度和播放头。 / Observe ticks and playhead when Main Track is shorter than other tracks. | 时间刻度继续显示到工程总时长；Main Track 片段只是其中一个片段，不定义全局结尾。 / Timeline ticks continue to project duration; Main Track is only one clip and does not define the global end. | 🔒 Machine-Guarded | `TimelineEditor.tsx`, `PlaybackControls`, `audit:timeline-duration-domains` |

### P5：音频波形与边界 / Audio Waveform And Audio Boundaries

| ID | 验收项 / Acceptance Item | 验收方法 / Acceptance Method | 预期结果 / Expected Result | Current Status | Code Area |
|---|---|---|---|---|---|
| AUDIO-01 | 波形底部显示 / Waveform bottom placement | 检查音频片段。 / Inspect audio clips. | 波形限制在卡片底部 45%，不遮挡标题。 / Waveform is confined to the bottom 45% and does not cover the title. | ✅ Accepted | `Item.tsx` |
| AUDIO-02A | 左拉伸波形对齐合同 / Waveform alignment contract while left-resizing | 模拟 sourceStartMs、pxPerMs 和左拉伸物理位移。 / Simulate sourceStartMs, pxPerMs, and left-resize physical displacement. | 波形左偏移等于 `-sourceStartMs * pxPerMs`，拖动过程的反向 translate 继续抵消左边缘移动。 / Waveform left offset equals `-sourceStartMs * pxPerMs`, and the live reverse translate continues to counteract left-edge movement. | 🔒 Machine-Guarded | `Item.tsx`, `timelineAudioResizeBounds.ts`, `audit:audio-resize-bounds` |
| AUDIO-02B | 左拉伸波形手感 / Waveform feel while left-resizing | 放大后左拉音频片段。 / Left-resize an audio clip while zoomed in. | 波形仍对齐源时间，松手无半像素跳动。 / Waveform remains aligned to source time; no half-pixel jump on release. | 🟡 Needs Verification | `Item.tsx` |
| AUDIO-03A | 左侧源边界合同 / Left source boundary contract | 模拟带 sourceStartMs 的音频片段向左拉过源起点。 / Simulate dragging an audio clip with sourceStartMs beyond the source start. | DOM 物理墙和提交后的 span 都 clamp 到 `span.start - sourceStartMs`，不允许前置静音区。 / Both the DOM wall and committed span clamp to `span.start - sourceStartMs`, preventing leading silence. | 🔒 Machine-Guarded | `Item.tsx`, `TimelineEditor.tsx`, `timelineAudioResizeBounds.ts`, `audit:audio-resize-bounds` |
| AUDIO-03B | 左侧源边界手感 / Left source boundary feel | 将左拉伸把手拖过音频源起点。 / Drag the left resize handle beyond source start. | 拉伸停止在音频源起点，不出现前置静音区。 / Resize stops at the audio source start; no silent leading area appears. | 🟡 Needs Verification | `Item.tsx`, `TimelineEditor.tsx` |
| AUDIO-04A | 右侧源边界合同 / Right source boundary contract | 模拟音频片段向右拉过源结尾。 / Simulate dragging an audio clip beyond the source end. | DOM 物理墙和提交后的 span 都 clamp 到 `span.start + sourceTotalMs - sourceStartMs`，不允许后置静音区。 / Both the DOM wall and committed span clamp to `span.start + sourceTotalMs - sourceStartMs`, preventing trailing silence. | 🔒 Machine-Guarded | `Item.tsx`, `TimelineEditor.tsx`, `timelineAudioResizeBounds.ts`, `audit:audio-resize-bounds` |
| AUDIO-04B | 右侧源边界手感 / Right source boundary feel | 将右拉伸把手拖过音频源结尾。 / Drag the right resize handle beyond source end. | 拉伸停止在音频源结尾，不出现后置静音区。 / Resize stops at the audio source end; no silent trailing area appears. | 🟡 Needs Verification | `Item.tsx`, `TimelineEditor.tsx` |
| AUDIO-05A | 原声音频手风琴挂载合同 / Original audio accordion wiring contract | 模拟原声、分离原声和普通音频，并静态检查主轨手风琴连接点。 / Simulate original, detached-original, and normal audio, then statically check main-track accordion wiring. | 未分离原声只挂载到视频片段；分离原声进入独立音轨；Trim 折叠后的 Main Clip 分段同步原声 source range。 / Non-detached original audio only attaches to video clips; detached original audio becomes standalone; Trim-folded Main Clip segments mirror original-audio source ranges. | 🔒 Machine-Guarded | `timelineOriginalAudio.ts`, `TimelineEditor.tsx`, `Item.tsx`, `audit:original-audio-accordion` |
| AUDIO-05B | 原声音频手风琴实机验收 / Original audio accordion hands-on review | 选中主视频片段附带的原声音频。 / Select original audio attached to the main video clip. | 原声音频在主视频片段下方展开/折叠正常。 / Associated audio expands/collapses cleanly under the main video clip. | 🟡 Needs Verification | `Item.tsx`, `TimelineEditor.tsx` |

## 旧清单中的过时或错误说法 / Deprecated Or Incorrect Claims From Previous Checklist

以下是旧清单里的高风险结论；`Resolved` 项只能按当前机器证据和实机体验重新验收。  
These are high-risk claims from the old checklist; `Resolved` items must be re-accepted through current machine evidence and hands-on review.

| 旧说法 / Claim | 当前判断 / Current Assessment | 原因 / Reason |
|---|---|---|
| 侧边栏宽度固定 140px 才正确。 / Sidebar width is hardcoded to 140px for correctness. | Deprecated / 已过时 | 当前应使用 `getTrackStartPx` 测量真实轨道起点。 / Current implementation should measure the real track start with `getTrackStartPx`. |
| 时间轴必须以 Main Track/录屏视频长度为上限。 / Timeline must be capped by Main Track or recorded video duration. | Incorrect / 不准确 | 已确认新规则：这是通用多轨时间轴，工程总时长由所有轨道内容的最晚结束时间决定。 / Confirmed new rule: this is a universal multi-track timeline, and project duration is determined by the latest clip end across all tracks. |
| 所有片段已经是 6px 圆角。 / All clips already use 6px radius. | Resolved / 已修正 | `ItemGlass.module.css` 已统一为 6px，并由 `audit:electron-editor-runtime` 守住。 / `ItemGlass.module.css` now uses 6px consistently and is guarded by `audit:electron-editor-runtime`. |
| 所有选中卡片都是纯内发光。 / All selected cards use pure inset glow. | Resolved / 已修正 | Selected 状态已改为 inset box-shadow，不再改 background；仍需 Electron 视觉体验确认。 / Selected states now use inset box-shadow and no background changes; Electron visual review is still required. |
| 所有拉伸把手都是纯白竖条。 / All resize handles are pure vertical white handles. | Incorrect / 不准确 | 只有 Video/Audio 是竖向把手，其他类型仍使用 SVG 端帽。 / Only Video/Audio use vertical handles; other clip types still use SVG caps. |
| Annotation 可以在同一轨道自由重叠。 / Annotation may freely overlap within the same track. | Resolved / 已修正 | Timeline 可视层和 ProjectModel 层都已增加分轨门禁；仍需 Electron 拖拽手感验收。 / Timeline visual layout and ProjectModel now have lane-wrapping gates; Electron drag feel still needs hands-on review. |
| 所有片段都可以自由重叠。 / All clips may overlap freely. | Incorrect / 不准确 | 已确认新规则：所有片段都不允许同轨重叠。 / Confirmed new rule: no clip type may overlap within the same track. |

## 工作协议 / Working Protocol

1. 每次选择一小组 ID，建议 2-4 个。  
   Pick a small batch of IDs, ideally 2-4 items.
2. 只实现这些 ID，不扩散到无关重构。  
   Implement only those IDs.
3. 使用已有录制文件在 Electron 中核验。  
   Verify in Electron using an existing recording.
4. 更新 `Current Status`，并在下方写一条简短日期日志。  
   Update `Current Status`, and add a short dated note below.
5. 标记 Accepted 前，删除临时调试日志。  
   Remove temporary debug logs before marking the item accepted.

## 迭代日志 / Iteration Log

### 2026-06-07

- 从旧的非正式验收清单整理出本文档。  
  Created this acceptance plan from the previous informal checklist.
- 当前最高优先级：`DEV-01`, `DEV-02`, `TL-02`, `TL-03`, `TL-04`, `TL-05`。  
  Current highest priority: `DEV-01`, `DEV-02`, `TL-02`, `TL-03`, `TL-04`, `TL-05`.
- 已知风险：Vite/Electron dev URL 对齐后，当前 Electron 窗口可能需要重启一次开发进程，才能确保加载最新 renderer。  
  Known risk: current Electron window may need one dev-process restart after Vite/Electron dev URL alignment before it reliably loads the latest renderer.
- 产品规则更新：所有片段都不允许同轨重叠，包括 Annotation；发生重叠时应新增轨道或换行显示。  
  Product rule updated: no clip type may overlap within the same track, including Annotation; overlapping clips should add or use another row.
- 产品规则更新：时间轴是通用多轨时间轴，不以 Main Track/录屏视频长度为唯一上限；只要任意轨道还有内容，就应继续播放到工程结束。  
  Product rule updated: the timeline is a universal multi-track timeline, not capped by Main Track or recorded video duration; playback should continue until the project end while any track still has content.
- 实现更新：新增工程级 `projectDuration` 和播放时钟；拆分源视频长度与工程时间轴长度；移除音频超出主视频时被强制拉回的旧 healer。  
  Implementation update: added project-level `projectDuration` and playback clock; split source video duration from project timeline duration; removed the old healer that forced audio back inside the main video duration.
- 实现更新：统一所有片段的左右拉伸把手为音频轨道样式，移除 Zoom/Trim/Annotation 的 SVG 端帽。  
  Implementation update: unified all clip resize handles to match the audio track style and removed SVG end caps from Zoom/Trim/Annotation clips.
- 验收通过：`RULE-03` / `CLIP-06`，所有片段把手已按音频轨道样式统一。  
  Accepted: `RULE-03` / `CLIP-06`, all clip resize handles now match the audio track style.

### 2026-07-01

- 本文档正式纳入 Phase 1 文档体系，作为 `Phase1-User-Acceptance-Record.md` 的时间轴细分清单。  
  This document is now part of the Phase 1 document set as the timeline breakdown under `Phase1-User-Acceptance-Record.md`.
- 增加机器证据映射，把热更新、工程总长、同轨不重叠、核心体验连接点对应到现有 audit 命令。  
  Added the machine evidence map, linking hot update, project duration, no same-track overlap, and core UX wiring to existing audit commands.
- `TL-07` 明确采用已决策的黑屏尾部规则：Main Track 结束后工程继续播放到所有片段最晚结束。  
  `TL-07` now uses the resolved black-tail rule: after Main Track ends, project playback continues until the latest clip end.
- 扩展 `audit:timeline-lane-wrapping`，将 Zoom/Focus、Annotation、Audio 的可视分轨统一到共享 helper，并验证重叠片段不会落在同一可视 lane。  
  Expanded `audit:timeline-lane-wrapping`, using the shared helper for Zoom/Focus, annotation, and audio visual lane wrapping and verifying overlapping clips do not share the same visual lane.
- 新增 `audit:timeline-drag-safety`，验证 drag/resize span 在进入碰撞、磁吸和落点更新前会处理 NaN、Infinity、负起点、反向区间和极短区间。  
  Added `audit:timeline-drag-safety`, verifying drag/resize spans handle NaN, Infinity, negative starts, reversed ranges, and tiny ranges before collision, snap, and placement updates.
- 新增 `audit:timeline-magnetic-snap`，把磁吸目标收集和吸附计算抽成 helper，验证阈值、自身排除、同 base id 分段排除、播放头/同行 peer/主视频边缘吸附和左右拉伸边缘规则。  
  Added `audit:timeline-magnetic-snap`, extracting snap target collection and snap calculation into a helper and verifying thresholding, self exclusion, same-base split exclusion, playhead/same-row/main-video snapping, and left/right resize edge rules.
- 新增 `audit:timeline-seek-mapping`，把时间轴点击/游标拖拽坐标映射抽成 helper，验证左侧呼吸区归零、trackStartPx 起点、range offset、工程时长 clamp 和 Trim 折叠 source/effective 时间转换。
  Added `audit:timeline-seek-mapping`, extracting timeline click/playhead-drag coordinate mapping into a helper and verifying left breathing-area reset, trackStartPx origin, range offset, project-duration clamp, and Trim-folded source/effective time conversion.
- 新增 `audit:timeline-playhead-time`，把播放指针时间源选择抽成 helper，验证拖拽/暂停时不会信任 HTML video timeupdate，播放时才允许跟随 video.currentTime，并保护 Trim 折叠 source/effective 映射。
  Added `audit:timeline-playhead-time`, extracting playhead time-source selection into a helper and verifying that dragging/paused states do not trust HTML video timeupdate, playback may follow video.currentTime, and folded Trim source/effective mapping stays guarded.
- 新增 `audit:timeline-track-origin`，把时间轴侧边栏宽度、16px 呼吸留白、fallback 起点和真实 track area 测量集中到 `timelineTrackOrigin.ts`，并验证 Axis/Cursor/Seek 共用同一个 trackStartPx。
  Added `audit:timeline-track-origin`, centralizing timeline sidebar width, the 16px breathing gap, fallback origin, and real track-area measurement in `timelineTrackOrigin.ts`, and verifying Axis/Cursor/Seek share one trackStartPx.
