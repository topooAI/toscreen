# Phase 1 用户验收记录 / Phase 1 User Acceptance Record

本文档用于记录 Phase 1 的用户实机验收。机器门禁只能证明工程合同没有断；Phase 1 是否可以关闭，必须以这里的用户验收记录为准。
This document records hands-on user acceptance for Phase 1. Machine gates only prove engineering contracts; closing Phase 1 depends on the user acceptance record here.

## 1. 使用方式 / How To Use

1. 先运行机器门禁：`npm run audit:phase1`。
   Run the machine gate first: `npm run audit:phase1`.
2. 再启动真实 Electron 编辑器并打开最新真实录制项目。
   Then start the real Electron editor and open the latest real recording project.
3. 按下面 8 个用户验收项逐项测试，并把 `[ ]` 改成 `[x]`。
   Test the 8 user checkpoints below and change `[ ]` to `[x]`.
4. 只有全部通过后，Phase 1 才能进入阶段放行。
   Phase 1 can move to release only after every item passes.
5. UA-01 到 UA-08 全部改为 `[x]` 后，将阶段结论改为 `Released / 已放行`；此时 `npm run audit:phase1-readiness` 才应输出 `phaseComplete: true`。
   After UA-01 through UA-08 are all changed to `[x]`, change the phase conclusion to `Released / 已放行`; only then should `npm run audit:phase1-readiness` output `phaseComplete: true`.

## 2. 开发对照列表 / Development Ownership Checklist

这个列表用于一边开发一边对照：默认 Codex 可以继续推进确定性的工程工作；只有进入“必须用户判断”的节点时才停下来。
Use this list while iterating: by default, Codex can keep moving on deterministic engineering work; it stops only when a user judgment is required.

这就是“Codex 能否独立完成、哪些节点需要用户介入”的主对照表；日常迭代时优先看本节，阶段放行时再看第 3 节 UA-01 到 UA-08。
This is the main checklist for what Codex can complete independently and where the user must step in; use this section during daily iteration, then use UA-01 through UA-08 in Section 3 for phase release.

### 2.1 快速对照清单 / Quick Reference Checklist

这张清单是工作时放在旁边看的最短版本：左边是 Codex 可以直接推进的工程闭环，右边是必须由用户验收或拍板的节点。
Use this as the shortest working checklist: the left side is engineering work Codex can continue directly; the right side is where the user must review or decide.

| 对照项 / Checkpoint | Codex 独立推进 / Codex Owns | 用户介入节点 / User Steps In |
|---|---|---|
| 1. 产品方向 / Product direction | 整理定位、非目标、路线和文档。 / Maintain positioning, non-goals, roadmap, and docs. | 当 ToScreen 可能偏离 AI product-demo editor 时确认。 / Confirm if ToScreen may drift away from AI product-demo editor. |
| 2. Phase 1 范围 / Phase 1 scope | 先把 AI、3D、Lottie、多源、数字人放进模型入口。 / Keep AI, 3D, Lottie, multi-source, and digital-human hooks in the model first. | 某个大能力要进入真实 UI 前拍板。 / Decide before a major capability enters real UI. |
| 3. ProjectModel 底座 / ProjectModel foundation | 类型、adapter、validator、autosave、sidecar、兼容恢复。 / Types, adapters, validators, autosave, sidecar, and compatibility restore. | 模型语义或未来结构边界改变时确认。 / Confirm when model semantics or future structure boundaries change. |
| 4. 保存与重启恢复 / Save and restart restore | 修复路径、视频、音频、Zoom、背景、光标、导出设置恢复。 / Fix restore for paths, video, audio, Zoom, background, cursor, and export settings. | Electron 重启后用真实录制验收。 / Review with a real recording after Electron restart. |
| 5. Timeline 手感 / Timeline feel | 修复拖拽、拉伸、磁吸、滚轮、游标、换轨和不重叠。 / Fix drag, resize, snap, wheel, playhead, lane wrapping, and no-overlap behavior. | 每次手感变化后在 Electron 里实际试。 / Test hands-on in Electron after every feel change. |
| 6. Screen Studio 底座 / Screen Studio-grade foundation | 恢复录屏预览、系统光标、Zoom/Focus、背景虚化、播放、基础导出。 / Restore recording preview, system cursor, Zoom/Focus, background blur, playback, and basic export. | 每个体验模块完成后验收是否达标。 / Review each UX module after it is implemented. |
| 7. Preview/Export 一致 / Preview/export parity | 统一预览和导出的画面、时长、Zoom/Camera、光标、背景和音频来源。 / Unify preview/export picture, duration, Zoom/Camera, cursor, background, and audio sources. | 导出完整成片后做最终观感判断。 / Judge the final exported video after an end-to-end export. |
| 8. Camera/Focus/3D 运镜 / Camera, Focus, and 3D camera | 先做模型迁移、兼容层和 Camera Clip 数据结构。 / Build model migration, compatibility, and Camera Clip data structure first. | 改名、改操作语言、3D 运镜进入 UI 前确认。 / Confirm before renaming, interaction changes, or 3D camera UI work. |
| 9. 多源画面 / Multi-source video | 保留摄像头、数字人、B-roll、画中画、分屏模型入口。 / Preserve hooks for camera, digital human, B-roll, PiP, and split screen. | 是否进入 Phase 1 可操作 UI 需要用户拍板。 / User decides whether it enters interactive Phase 1 UI. |
| 10. Lottie/UI-aware motion | 定义素材、Motion Clip、UI Source 和导入边界。 / Define assets, Motion Clips, UI Source, and import boundaries. | 接 Figma/DOM/UI 源或做动画编辑 UI 前确认。 / Confirm before Figma/DOM/UI-source integration or animation editing UI. |
| 11. AI 自动剪辑 / AI auto-editing | 设计可审阅、可撤销、可解释的 AI Edit Plan。 / Design reviewable, undoable, explainable AI Edit Plan. | AI 自动做哪些剪辑决策必须用真实用例确认。 / Real examples are required to decide what AI automates. |
| 12. 阶段放行 / Phase gate | 跑门禁、列风险、整理下一阶段建议并同步 GitHub。 / Run gates, list risks, summarize next-phase suggestions, and sync GitHub. | 是否关闭 Phase 1 并进入下一阶段必须由用户确认。 / User must confirm closing Phase 1 and moving to the next phase. |

| ID | 工作域 / Area | Codex 可以独立推进 / Codex Can Continue | 用户需要介入 / User Must Step In | 对照标准 / What To Check |
|---|---|---|---|---|
| DEV-01 | 产品定位 / Product positioning | 整理定位、范围、非目标、阶段路线和决策日志。 / Organize positioning, scope, non-goals, roadmap, and decision log. | 当 ToScreen 可能偏离 AI product-demo editor 时。 / When ToScreen may drift away from AI product-demo editor. | 是否仍然不是普通剪辑器、不是单纯录屏工具、不是完整 Jitter 替代品。 / It remains not a generic editor, recorder-only tool, or full Jitter replacement. |
| DEV-02 | Phase 1 范围 / Phase 1 scope | 把数字人、多源画面、Lottie、UI-aware motion、3D 运镜、AI 自动剪辑先放进模型和文档。 / Keep digital human, multi-source video, Lottie, UI-aware motion, 3D camera, and AI editing in model/docs first. | 当某个大能力要从模型入口进入真实 UI 时。 / When a major capability moves from model hook into real UI. | 当前阶段是否仍以 Screen Studio 级稳定底座为第一目标。 / Phase 1 still prioritizes a Screen Studio-grade stable foundation. |
| DEV-03 | ProjectModel 与兼容层 / ProjectModel and compatibility layer | 类型、adapter、validator、autosave、sidecar、旧项目 fallback、恢复路径。 / Types, adapters, validators, autosave, sidecar, legacy fallback, and restore path. | 模型语义改变，或会影响未来 AI/3D/Lottie/多源结构时。 / When model semantics change or affect future AI/3D/Lottie/multi-source structure. | Project / Asset / Track / Clip / Scene / UI Source / AI Edit Plan 是否合理。 / Project / Asset / Track / Clip / Scene / UI Source / AI Edit Plan remain coherent. |
| DEV-04 | 保存与恢复 / Save and restore | 修复真实录制路径、画面、音频、Zoom、背景、光标和导出质量恢复。 / Fix restore for recording path, picture, audio, Zoom, background, cursor, and export quality. | Electron 重启后，用真实录制项目验收。 / After Electron restart, review with a real recording. | 不丢画面、不丢音频、不丢 Zoom/Focus、不丢背景/光标设置。 / No missing picture, audio, Zoom/Focus, background, or cursor settings. |
| DEV-05 | Timeline 手感 / Timeline feel | 定位并修复拖拽、拉伸、磁吸、滚轮缩放、游标、片段换行 bug。 / Trace and fix drag, resize, snap, wheel zoom, playhead, and lane wrapping bugs. | 每次改变时间轴交互后都需要用户实机体验。 / User must test hands-on after every timeline interaction change. | 跟手、不闪、不跳、不错误定位游标、不破坏片段位置。 / It follows the pointer, does not flicker or jump, does not move the playhead incorrectly, and does not misplace clips. |
| DEV-06 | Screen Studio 核心体验 / Screen Studio-grade UX | 分模块实现录屏预览、系统光标模拟、Zoom/Focus、背景虚化、播放、基础导出。 / Implement recording preview, system cursor simulation, Zoom/Focus, background blur, playback, and basic export module by module. | 每个体验模块完成后，用 Electron 对照验收。 / After each UX module, review it in Electron. | 能完成一条真实软件宣传视频的基础预览和编辑。 / A real software product-demo video can be previewed and edited at the basic level. |
| DEV-07 | Preview/Export 一致性 / Preview/export parity | 收敛预览和导出的数据源、工程时长、画面、Zoom/Camera、光标、背景、音频。 / Converge preview/export data sources, project duration, picture, Zoom/Camera, cursor, background, and audio. | 完整导出真实项目后，用户看成片。 / After a real project exports end to end, user reviews the final video. | 预览和导出同画面、同节奏、同缩放、同光标、同背景效果。 / Preview and export match in picture, timing, zoom, cursor, and background effects. |
| DEV-08 | Camera/Focus/3D 运镜 / Camera, Focus, and 3D camera | 先做模型迁移、兼容层和不破坏旧 Focus 的内部收口。 / Build model migration and compatibility without breaking existing Focus behavior. | 改命名、改操作方式、或 3D 运镜进入当前 UI 前。 / Before naming changes, interaction changes, or adding 3D camera to current UI. | Focus 是否升级为 Camera Clip，以及镜头语言是否符合产品方向。 / Whether Focus becomes Camera Clip and the camera language fits the product direction. |
| DEV-09 | 多源画面 / Multi-source video | 保留摄像头、数字人、画中画、分屏、B-roll 的模型入口。 / Preserve model hooks for camera, digital human, PiP, split screen, and B-roll. | 是否做真实剪辑 UI 和第一阶段可操作能力，需要用户拍板。 / User decides whether real editing UI and Phase 1 interaction are needed. | 模型支持多源画面，但不膨胀成影视导播系统。 / Model supports multi-source video without becoming a film/broadcast switcher. |
| DEV-10 | Lottie 与 UI-aware motion / Lottie and UI-aware motion | 定义数据结构、导入边界和未来 motion clip 模型。 / Define data structures, import boundaries, and future motion clip model. | 接 Figma/DOM/UI 源文件或做动画编辑 UI 前。 / Before Figma/DOM/UI-source integration or animation editing UI. | 做 Jitter-like product motion，不做 full Jitter。 / Build Jitter-like product motion, not full Jitter. |
| DEV-11 | AI 自动剪辑 / AI auto-editing | 设计可审阅、可撤销、可解释的 AI Edit Plan。 / Design reviewable, undoable, explainable AI Edit Plan. | AI 要替用户自动做哪些剪辑决策时，需要真实用例确认。 / Real use cases are needed before deciding which edit decisions AI automates. | AI 先生成可审阅计划，再应用到时间轴。 / AI generates a reviewable plan before applying changes to the timeline. |
| DEV-12 | 阶段放行 / Phase gate | 跑门禁、列风险、整理下一阶段建议、同步 GitHub。 / Run gates, list risks, summarize next-phase suggestions, and sync GitHub. | 是否关闭当前阶段并进入下一阶段，必须由用户确认。 / User must confirm whether to close the current phase and enter the next one. | UA-01 到 UA-08 全部通过，且阶段结论改为 `Released / 已放行`。 / UA-01 through UA-08 all pass and the phase conclusion changes to `Released / 已放行`. |

## 3. 用户验收清单 / User Acceptance Checklist

| ID | 验收项 / Acceptance Item | 用户需要验证 / What User Must Verify | 通过标准 / Pass Criteria | 状态 / Status | 备注 / Notes |
|---|---|---|---|---|---|
| UA-01 | ProjectModel 方向确认 / ProjectModel direction review | Project / Asset / Track / Clip / Scene / UI Source / AI Edit Plan 是否符合未来 AI product-demo editor。 / Whether Project / Asset / Track / Clip / Scene / UI Source / AI Edit Plan fit the future AI product-demo editor. | 模型方向能承接 Screen Studio 底座、AI 剪辑、3D 运镜、Lottie、UI-aware motion 和多源画面。 / The model can support the Screen Studio-grade foundation, AI editing, 3D camera, Lottie, UI-aware motion, and multi-source composition. | [ ] Pending | 参考 `ProjectModel-Review-Packet.md`。 / See `ProjectModel-Review-Packet.md`. |
| UA-02 | Electron 重启恢复验收 / Electron restart recovery review | 重启 Electron 后，真实录制项目的画面、音频、Zoom、背景、光标、项目状态是否都恢复。 / After restarting Electron, a real recorded project restores picture, audio, Zoom, background, cursor, and project state. | 不丢画面、不丢音频、不丢 Zoom/Focus、不丢背景/光标设置。 / No missing picture, audio, Zoom/Focus, background, or cursor settings. | [ ] Pending | 机器证据：`npm run audit:recordings`。 / Machine evidence: `npm run audit:recordings`. |
| UA-03 | Timeline 手感验收 / Timeline feel review | 拖拽、拉伸、磁吸、滚轮缩放、游标、片段换行是否跟手稳定。 / Drag, resize, snap, wheel zoom, playhead, and lane wrapping feel stable. | 不闪、不跳、不错误定位游标、不破坏片段位置。 / No flicker, jump, incorrect playhead movement, or clip misplacement. | [ ] Pending | 必须实机体验。 / Hands-on only. |
| UA-04 | Screen Studio 核心体验验收 / Screen Studio-grade UX review | 录屏预览、系统光标模拟、Zoom/Focus、背景虚化、播放和基础导出是否达到 Phase 1 标准。 / Recording preview, system cursor simulation, Zoom/Focus, background blur, playback, and basic export reach Phase 1 standard. | 能完成一条真实软件宣传视频的基础预览和编辑。 / A real product-demo video can be previewed and edited at the basic level. | [ ] Pending | 机器证据：`npm run audit:screenstudio-core-contract`。 / Machine evidence: `npm run audit:screenstudio-core-contract`. |
| UA-05 | Preview/Export 成片验收 / Preview/export video review | 导出视频是否与预览在画面、节奏、缩放、光标和背景效果上保持一致。 / Export matches preview in picture, timing, zoom, cursor, and background effects. | 成片没有明显预览/导出分叉，没有主视频尾部截断音频或镜头。 / Final video has no obvious preview/export drift and does not cut audio or camera motion at main-video end. | [ ] Pending | 机器证据：`npm run audit:preview-export-contract`。 / Machine evidence: `npm run audit:preview-export-contract`. |
| UA-06 | Camera/Focus 操作语言确认 / Camera/Focus interaction review | Focus 是否升级为 Camera Clip，以及 3D 运镜如何影响当前操作方式。 / Whether Focus becomes Camera Clip and how 3D camera work affects current interactions. | 用户确认命名和操作语言没有偏离产品方向。 / User confirms naming and interaction language fit the product direction. | [ ] Pending | 先模型迁移，UI 命名待确认。 / Model migration first; UI naming still needs confirmation. |
| UA-07 | AI 自动剪辑真实用例确认 / AI auto-editing use-case review | AI 应该自动做哪些剪辑决策，哪些必须生成计划后由用户确认。 / Which edit decisions AI should automate, and which must stay as reviewable plans. | AI 先生成可审阅计划，再应用到时间轴的原则被确认。 / The reviewable-plan-before-apply principle is confirmed. | [ ] Pending | 参考 AI Edit Plan 结构。 / See AI Edit Plan structure. |
| UA-08 | 阶段放行 / Phase gate | 当前阶段是否可以关闭，并进入下一阶段。 / Whether the current phase can close and the next phase can start. | UA-01 到 UA-07 全部通过，且用户明确同意进入下一阶段。 / UA-01 through UA-07 all pass, and the user explicitly approves moving forward. | [ ] Pending | `audit:phase1-readiness` 在放行前仍应输出 `phaseComplete: false`。 / `audit:phase1-readiness` should still report `phaseComplete: false` before release. |

### 3.1 实机验收步骤 / Hands-On Acceptance Steps

先运行 `npm run audit:phase1-handoff`，确认它输出 `status: "ready"`、最新录制路径、ProjectModel 恢复摘要、UA-01 到 UA-08 的待验收列表，以及 `acceptancePlan` 里的逐项状态、机器证据、实机步骤和失败记录。然后启动 `npm run dev:editor`，用同一个真实录制项目逐项验证。
Run `npm run audit:phase1-handoff` first and confirm it reports `status: "ready"`, the latest recording path, ProjectModel restore summary, pending UA-01 through UA-08, and per-item status, machine evidence, hands-on steps, and failure notes in `acceptancePlan`. Then start `npm run dev:editor` and use the same real recording for the checks below.

| ID | 实机步骤 / Hands-On Step | 失败记录 / Failure Note |
|---|---|---|
| UA-01 | 打开 `ProjectModel-Review-Packet.md`，确认 Project / Asset / Track / Clip / Scene / UI Source / AI Edit Plan 能承接 Screen Studio 底座、AI 剪辑、3D 运镜、Lottie、UI-aware motion 和多源画面。 / Open `ProjectModel-Review-Packet.md` and confirm Project / Asset / Track / Clip / Scene / UI Source / AI Edit Plan can support the Screen Studio-grade foundation, AI editing, 3D camera, Lottie, UI-aware motion, and multi-source composition. | 如果模型方向不对，写明缺少的实体或错误边界。 / If the model direction is wrong, note the missing entity or incorrect boundary. |
| UA-02 | 完全退出并重启 Electron，检查预览画面、音频、Zoom/Focus、背景、光标设置、导出质量和时间轴片段是否恢复。 / Fully quit and restart Electron, then check preview picture, audio, Zoom/Focus, background, cursor settings, export quality, and timeline clips. | 记录丢失的是画面、音频、Zoom、背景、光标还是项目状态。 / Note whether picture, audio, Zoom, background, cursor, or project state is missing. |
| UA-03 | 在真实时间轴上拖拽、拉伸、磁吸、滚轮缩放、移动游标，并测试重叠片段是否换到同类型子轨。 / On the real timeline, drag, resize, snap, wheel-zoom, move the playhead, and test whether overlapping clips wrap onto same-type child lanes. | 记录是否不跟手、闪烁、跳动、误改游标或片段错位。 / Note any non-following, flicker, jump, incorrect playhead movement, or clip misplacement. |
| UA-04 | 播放真实录制，检查系统光标模拟、Zoom/Focus、背景虚化、黑屏尾部、基础播放和基础剪辑是否能组成一条软件宣传视频。 / Play the real recording and check system cursor simulation, Zoom/Focus, background blur, black tail, basic playback, and basic editing as one product-demo video. | 记录不达标的模块和具体时间点。 / Note the failing module and timestamp. |
| UA-05 | 导出同一个项目，和预览对比画面、节奏、缩放、光标、背景、音频和主视频结束后的尾部。 / Export the same project and compare picture, timing, zoom, cursor, background, audio, and the tail after main-video end against preview. | 记录预览和导出分叉的位置。 / Note where preview and export diverge. |
| UA-06 | 在当前 UI 中确认 Focus/Zoom 的操作语言是否仍然清楚，并判断未来是否应该命名为 Camera Clip。 / In the current UI, confirm whether Focus/Zoom interactions remain clear and decide whether the future name should become Camera Clip. | 记录需要改名、保留旧名或拆分概念的理由。 / Note whether to rename, keep the old name, or split the concept. |
| UA-07 | 用一个真实宣传视频场景描述 AI 应该自动做的剪辑决策，并确认这些决策是否必须先进入可审阅计划。 / Describe one real product-demo scenario and identify which edit decisions AI should make, then confirm whether they must enter a reviewable plan first. | 记录 AI 可以自动执行和必须用户确认的边界。 / Note what AI may apply automatically and what requires user confirmation. |
| UA-08 | 只有 UA-01 到 UA-07 全部通过后，才把对应状态改为 `[x] Accepted`，并将阶段结论改为 `Released / 已放行`。 / Only after UA-01 through UA-07 pass, change their states to `[x] Accepted` and change the phase conclusion to `Released / 已放行`. | 如果任一项失败，保持 `Not released / 未放行`。 / If any item fails, keep `Not released / 未放行`. |

## 4. 机器门禁记录 / Machine Gate Record

| 命令 / Command | 目的 / Purpose | 当前要求 / Current Requirement |
|---|---|---|
| `npm run audit:phase1` | Phase 1 聚合机器门禁。 / Aggregate Phase 1 machine gate. | 必须通过。 / Must pass. |
| `npm run audit:phase1-readiness` | 输出机器已验证项、剩余用户验收项和 `acceptancePlan`。 / Reports machine-verified items, remaining user checkpoints, and `acceptancePlan`. | 放行前必须输出 `phaseComplete: false`；全部验收并改为 `Released / 已放行` 后才允许输出 `phaseComplete: true`；`acceptancePlan.machineEvidence` 必须引用真实 npm scripts。 / Must output `phaseComplete: false` before release; it may output `phaseComplete: true` only after every item is accepted and the status is changed to `Released / 已放行`; `acceptancePlan.machineEvidence` must reference real npm scripts. |
| `npm run audit:recordings` | 检查真实最新录制项目恢复证据。 / Checks restore evidence for the latest real recording. | 必须通过，并输出 `coreRestore`。 / Must pass and output `coreRestore`. |
| `npm run audit:project-model-default-scene` | 检查真实保存路径的默认 Scene 结构。 / Checks the default Scene structure on the real save path. | 非空 ProjectModel 必须生成覆盖工程总长、引用所有 clip 的默认 `demo` Scene；旧无 Scene sidecar 恢复后再次保存也必须补上。 / A non-empty ProjectModel must generate a full-duration default `demo` Scene that references every clip; old scene-less sidecars must gain it after restore and save. |
| `npm run audit:phase1-handoff` | 输出实机验收前预检包。 / Outputs the hands-on acceptance handoff packet. | 必须能找到最新真实录制、合法 ProjectModel sidecar、待验收 UA 列表、`handsOnSteps` 和 `acceptancePlan`；`acceptancePlan.machineEvidence` 必须引用真实 npm scripts。 / Must find the latest real recording, valid ProjectModel sidecar, pending UA list, `handsOnSteps`, and `acceptancePlan`; `acceptancePlan.machineEvidence` must reference real npm scripts. |
| `npm run audit:phase1-user-review-packet` | 输出用户评审入口包。 / Outputs the user review entry packet. | 必须合并模型能力、开放问题、最新真实录制、ProjectModel 恢复摘要、旧无 Scene sidecar 的 `sceneMigration` 预览和 UA 验收计划；它不能替代用户勾选验收。 / Must combine model capabilities, open questions, latest real recording, ProjectModel restore summary, `sceneMigration` preview for old scene-less sidecars, and UA acceptance plan; it cannot replace user check-off acceptance. |

## 5. 阶段结论 / Phase Conclusion

- 当前阶段状态 / Current phase status: **Not released / 未放行**
- 放行条件 / Release condition: UA-01 至 UA-08 全部改为 `[x]`，并由用户明确确认。
  UA-01 through UA-08 are all changed to `[x]`, with explicit user confirmation.
