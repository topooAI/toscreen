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

## 4. 用户确认问题 / User Review Questions

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

## 5. 当前结论 / Current Conclusion

当前 `ProjectModel` 方向可以继续作为 Phase 1 架构底座，但用户仍需确认两类产品判断：
The current `ProjectModel` direction can continue as the Phase 1 architecture foundation, but the user still needs to confirm two product decisions:

1. 多源画面、数字人、Lottie、UI-aware motion 是否只保留模型入口，还是进入 Phase 1 真实 UI。
   Whether multi-source composition, digital human, Lottie, and UI-aware motion remain model hooks or enter real Phase 1 UI.
2. Focus/Zoom 是否正式升级为 Camera Clip，以及这个升级是否符合未来 3D 运镜方向。
   Whether Focus/Zoom formally becomes Camera Clip, and whether that supports the future 3D camera direction.

## 6. 关联门禁 / Related Audit Gates

- `npm run audit:project-model-review-packet`
- `npm run audit:project-model-review-doc`
- `npm run audit:phase1`
