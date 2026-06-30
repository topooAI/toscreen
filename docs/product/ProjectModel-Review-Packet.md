# ProjectModel 评审包 / ProjectModel Review Packet

本文档用于 Phase 1 用户模型确认。它不是最终产品说明书，而是把当前 `ProjectModel` 是否能支撑 ToScreen 的第一阶段方向变成可对照清单。
This document supports the Phase 1 user model review. It is not the final product spec; it turns the current `ProjectModel` direction into a checklist that can be reviewed directly.

## 1. 产品定位 / Product Positioning

ToScreen 当前模型定位为：
ToScreen is currently modeled as:

> AI product-demo editor, not a generic NLE or recorder.

中文解释：ToScreen 不是普通录屏工具，也不是通用剪辑软件；它的第一阶段目标是先稳定达到 Screen Studio 级别的软件宣传视频编辑底座，再承接 AI 剪辑、3D 运镜、UI-aware motion、Lottie 和多源画面。
Chinese explanation: ToScreen is neither a generic recorder nor a general-purpose video editor. Phase 1 should first stabilize a Screen Studio-grade product-demo editing foundation, then support AI editing, 3D camera work, UI-aware motion, Lottie, and multi-source composition.

## 2. 当前 ProjectModel 必须覆盖的能力 / Required Model Capabilities

| 能力 / Capability | 当前模型表达 / Current Model Expression | Phase 1 判断 / Phase 1 Judgment |
|---|---|---|
| Screen recording | `screen-recording` asset + `screen-recording` clip | 必须作为主素材。 / Required as the primary base asset. |
| Camera / Zoom / Focus | `camera` track + `camera` clip | Focus/Zoom 应逐步收口为 Camera Clip。 / Focus/Zoom should converge into Camera Clip. |
| Presenter / Digital human | `presenter` track + `presenter` clip + `digital-human` asset | 模型必须支持；UI 是否进入 Phase 1 需要用户确认。 / Model support is required; UI scope needs user confirmation. |
| B-roll / Cutaway | secondary `video` clip, optionally child track of main video | 模型必须支持产品演示中的多源画面，不做影视导播系统。 / Model must support product-demo multi-source composition, not a film/broadcast switcher. |
| Lottie | `lottie` asset + `lottie` clip | 先作为宣传动效入口，不做完整 Jitter 替代。 / Entry point for product motion, not a full Jitter replacement. |
| UI-aware motion | `uiSources` + `ui-element-motion` clip | 支撑 UI 源文件和录屏行为衔接动画。 / Connects UI source files and recorded behavior into editable motion. |
| AI Edit Plan | `aiEditPlans` + reviewable steps | AI 先生成可审阅计划，再应用到时间轴。 / AI generates reviewable plans before timeline mutation. |

## 3. 推荐轨道结构 / Recommended Track Structure

| Track | 类型 / Type | 用途 / Purpose | 用户需要确认 / User Review |
|---|---|---|---|
| Main Screen | `video` | 主录屏、主产品画面。 / Main screen recording and product view. | 主画面是否仍是第一优先级。 / Whether the main screen remains the first-priority visual. |
| Camera | `camera` | Zoom、Focus、Pan、未来 3D 运镜。 / Zoom, Focus, Pan, future 3D camera work. | Focus 是否升级为 Camera Clip。 / Whether Focus becomes Camera Clip. |
| Presenter | `presenter` | 摄像头、数字人、画中画、分屏讲解。 / Camera, digital human, picture-in-picture, split-screen presentation. | 数字人是否进入 Phase 1 UI。 / Whether digital-human UI enters Phase 1. |
| B-roll | `video` child lane | 产品 cutaway、补充镜头、宣传素材。 / Product cutaway, supplementary footage, marketing material. | 是否 Phase 1 就要真实可剪。 / Whether real editing enters Phase 1. |
| Lottie | `lottie` | CTA、Logo、状态变化、强调动效。 / CTA, logo, state change, emphasis motion. | 先模型入口还是做导入 UI。 / Model-only first or import UI. |
| UI Motion | `ui-motion` | 基于 UI 元素的 highlight、move、scale、click、scroll。 / UI-element highlight, move, scale, click, scroll. | 是否接 Figma/DOM/UI 源。 / Whether to connect Figma, DOM, or UI sources. |
| Audio / Voice / Music | `audio` / `voice` / `music` | 原声、配音、音乐、音效。 / Original audio, voiceover, music, SFX. | 是否需要更完整音频工作流。 / Whether a broader audio workflow is needed. |

## 4. 独立推进与用户介入对照列表 / Execution Ownership Checklist

这张表用于工作时逐项对照：Codex 默认可以继续独立推进工程收口；只有进入“需要用户介入”的条件时才停下来确认。
Use this table during execution: Codex can continue engineering consolidation by default; it stops only when a user decision is required.

| 编号 / ID | 工作域 / Area | Codex 可以独立完成 / Codex Can Own | 需要用户介入的节点 / User Checkpoint | 当前判断 / Current Judgment |
|---|---|---|---|---|
| OWN-01 | Product positioning | 整理定位、边界、非目标和阶段路线。 / Document positioning, boundaries, non-goals, and phase roadmap. | 只在 ToScreen 要偏离 AI product-demo editor 时确认。 / Confirm only if ToScreen drifts away from AI product-demo editor. | 方向已定，继续按当前定位推进。 / Direction is set; continue with current positioning. |
| OWN-02 | ProjectModel foundation | 类型、adapter、validator、autosave、sidecar、兼容恢复。 / Types, adapters, validators, autosave, sidecar, compatibility restore. | 模型语义要改变时确认。 / Confirm if model semantics change. | Codex 可继续独立收口。 / Codex can continue independently. |
| OWN-03 | Timeline feel | 拖拽、拉伸、磁吸、游标、滚轮缩放、片段换行的 bug 修复。 / Fix drag, resize, snap, playhead, wheel zoom, and lane wrapping bugs. | 每次影响手感后，用户在 Electron 里体验验收。 / User tests in Electron after feel changes. | 代码可独立修，体验必须用户验收。 / Code can be fixed independently; feel must be user-reviewed. |
| OWN-04 | Preview/export parity | 统一预览和导出的时长、画面、Zoom/Camera、光标、背景、音频。 / Unify preview/export duration, picture, Zoom/Camera, cursor, background, and audio. | 完整导出后，用户看成片。 / User reviews the exported video after full export. | Codex 负责工程一致性，用户负责成片判断。 / Codex owns engineering parity; user owns output judgment. |
| OWN-05 | Black tail after Main Clip | 主录屏结束后工程继续到所有片段最晚结束，画面为黑屏尾部。 / After the source screen recording ends, project time continues to the latest clip end and displays black tail. | 不再需要重新决策，除非产品规则要改。 / No re-decision needed unless the product rule changes. | 已锁定，预览和导出均应遵守。 / Locked; preview and export must follow it. |
| OWN-06 | Screen Studio-grade foundation | 录屏预览、系统光标模拟、Zoom/Focus、背景虚化、基础剪辑、播放、导出。 / Recording preview, system cursor simulation, Zoom/Focus, background blur, basic editing, playback, export. | 每个体验模块完成后用户验收。 / User reviews each UX module after completion. | 分模块推进。 / Proceed module by module. |
| OWN-07 | Camera/Focus/3D camera | 模型迁移、兼容层、Camera Clip 数据结构。 / Model migration, compatibility layer, Camera Clip data structure. | 命名、镜头语言、3D 运镜进入 UI 前确认。 / Confirm naming, camera language, and 3D camera UI before implementation. | 先模型收口，UI 待确认。 / Model first; UI needs confirmation. |
| OWN-08 | Multi-source composition | 保留摄像头、数字人、B-roll、画中画、分屏模型入口。 / Preserve model hooks for camera, digital human, B-roll, PiP, and split screen. | 是否进入 Phase 1 真实 UI 需要用户拍板。 / User decides whether real Phase 1 UI is needed. | 模型必须支持，UI 范围待定。 / Model support required; UI scope TBD. |
| OWN-09 | Lottie and UI-aware motion | 数据结构、导入边界、未来 motion clip 模型。 / Data structures, import boundary, future motion clip model. | 接 Figma/DOM/UI 源或动画编辑 UI 前确认。 / Confirm before Figma/DOM/UI-source integration or animation UI. | 先做宣传动效入口，不做 full Jitter。 / Product-motion entry first, not full Jitter. |
| OWN-10 | AI auto-editing | AI Edit Plan、可审阅步骤、可回滚应用路径。 / AI Edit Plan, reviewable steps, reversible apply path. | AI 替用户做哪些决策，需要真实用例确认。 / Real use cases decide what AI automates. | 先计划层，后自动应用。 / Plan layer first, automation later. |
| OWN-11 | Phase gate | 跑门禁、列风险、整理下一阶段建议。 / Run gates, list risks, summarize next-phase suggestions. | 是否进入下一阶段由用户放行。 / User approves moving to the next phase. | 阶段结束必须用户确认。 / User confirmation required at phase end. |

## 5. 用户确认问题 / User Review Questions

- [ ] 这个模型是否能支撑 Phase 1 的 Screen Studio-grade foundation？
  Does this model support the Phase 1 Screen Studio-grade foundation?
- [ ] `Camera Clip` 是否给未来 3D 运镜留下足够空间？
  Does Camera Clip leave enough room for future 3D camera work?
- [ ] 多源画面在 Phase 1 是只保留模型入口，还是进入真实 UI 和剪辑能力？
  Should multi-source composition stay model-only in Phase 1 or enter real UI/editing capability?
- [ ] `AI Edit Plan` 是否应该坚持“先生成可审阅计划，再应用到时间轴”？
  Should AI Edit Plan remain reviewable before applying changes to the timeline?
- [ ] Lottie 和 UI-aware motion 是 Phase 1 只做模型，还是开始做导入和编辑 UI？
  Should Lottie and UI-aware motion remain model-only in Phase 1, or start import/editing UI?
- [ ] 当前 Track / Clip / Asset / Scene 结构是否足够支撑后续 AI 自动剪辑？
  Is the current Track / Clip / Asset / Scene structure enough for future AI auto-editing?

## 6. 当前结论 / Current Conclusion

当前 `ProjectModel` 方向可以继续作为 Phase 1 架构底座，但用户仍需确认两类产品判断：
The current `ProjectModel` direction can continue as the Phase 1 architecture foundation, but the user still needs to confirm two product decisions:

1. 多源画面、数字人、Lottie、UI-aware motion 是否只保留模型入口，还是进入 Phase 1 真实 UI。
   Whether multi-source composition, digital human, Lottie, and UI-aware motion remain model hooks or enter real Phase 1 UI.
2. Focus/Zoom 是否正式升级为 Camera Clip，以及这个升级是否符合未来 3D 运镜方向。
   Whether Focus/Zoom formally becomes Camera Clip, and whether that supports the future 3D camera direction.

## 7. 关联门禁 / Related Audit Gates

- `npm run audit:project-model-review-packet`
- `npm run audit:project-model-review-doc`
- `npm run audit:phase1-user-review-packet`
- `npm run audit:phase1-ownership-list`
- `npm run audit:phase1`
