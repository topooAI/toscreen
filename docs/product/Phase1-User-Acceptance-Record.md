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

## 2. 用户验收清单 / User Acceptance Checklist

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

## 3. 机器门禁记录 / Machine Gate Record

| 命令 / Command | 目的 / Purpose | 当前要求 / Current Requirement |
|---|---|---|
| `npm run audit:phase1` | Phase 1 聚合机器门禁。 / Aggregate Phase 1 machine gate. | 必须通过。 / Must pass. |
| `npm run audit:phase1-readiness` | 输出机器已验证项和剩余用户验收项。 / Reports machine-verified items and remaining user checkpoints. | 必须通过，并明确 `phaseComplete: false`。 / Must pass and explicitly report `phaseComplete: false`. |
| `npm run audit:recordings` | 检查真实最新录制项目恢复证据。 / Checks restore evidence for the latest real recording. | 必须通过，并输出 `coreRestore`。 / Must pass and output `coreRestore`. |

## 4. 阶段结论 / Phase Conclusion

- 当前阶段状态 / Current phase status: **Not released / 未放行**
- 放行条件 / Release condition: UA-01 至 UA-08 全部改为 `[x]`，并由用户明确确认。
  UA-01 through UA-08 are all changed to `[x]`, with explicit user confirmation.
