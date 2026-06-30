# 产品定位与编辑器架构 / Product And Editor Architecture

本文档是 ToScreen 后续产品与编辑器重构的上游决策文档。
This document is the upstream decision record for ToScreen's product direction and editor architecture.

使用方式：先用本文档判断“这个能力是否属于 ToScreen”，再进入具体 UI、Timeline、渲染和导出实现。
How to use it: use this document to decide whether a feature belongs in ToScreen before designing UI, timeline behavior, rendering, or export implementation.

Last updated / 最后更新：2026-06-30

## 1. 产品定位 / Product Positioning

ToScreen 不应被定义为普通录屏工具，也不应被定义为通用剪辑软件。
ToScreen should not be positioned as a generic screen recorder or a generic video editor.

推荐定位：
Recommended positioning:

> 面向 SaaS、AI 工具、软件产品和工作流演示的 AI 智能宣传视频编辑器。
> An AI-powered product demo video editor for SaaS, AI tools, software products, and workflow demonstrations.

更具体地说，ToScreen 的核心组合是：
More specifically, ToScreen combines:

| 能力 / Capability | 中文定义 | English Definition |
|---|---|---|
| 录屏智能剪辑 / Smart screen editing | 以录屏为基础，自动处理光标、缩放、等待、节奏、字幕和音频。 | Screen-recording-first editing with automatic cursor, zoom, pacing, captions, and audio treatment. |
| 多源画面编排 / Multi-source composition | 支持录屏、摄像头、数字人、B-roll 和产品镜头的同步组合。 | Sync and compose screen recordings, camera footage, digital humans, B-roll, and product shots. |
| 软件宣传动效 / Product motion design | 吸收 Jitter 式标题、Logo、Lottie、UI 高亮、CTA 和品牌动效。 | Jitter-like title, logo, Lottie, UI highlight, CTA, and branded motion. |
| UI 感知动效 / UI-aware motion | 结合录屏行为与 UI 源文件，把产品界面元素自动转成可动画对象。 | Combine recorded behavior and UI source files to turn product UI elements into animatable objects. |
| 3D 运镜包装 / 3D camera packaging | 将页面、窗口或设备作为 3D 对象进行推进、旋转、景深和空间转场。 | Treat pages, windows, or devices as 3D objects with push-in, rotation, depth, and spatial transitions. |
| AI 自动剪辑 / AI auto-editing | 让 AI 生成结构化剪辑方案，再落到可编辑时间轴。 | Let AI generate a structured edit plan that becomes an editable timeline. |

一句话判断标准：
One-sentence decision rule:

> 如果一个功能能让软件录屏更快变成高质量宣传视频，就属于 ToScreen；如果它只是传统影视剪辑能力，则默认不做或弱化。
> If a feature helps turn a software recording into a high-quality product video faster, it belongs in ToScreen; if it is only a traditional film-editing feature, it is out of scope by default or should be weakened.

## 2. 不做与只做轻量版 / Non-Goals And Lightweight Scope

为了避免产品变成臃肿的通用剪辑器，必须把“明确不做”和“只做轻量版”分开。
To avoid becoming a bloated generic editor, we must separate "explicit non-goals" from "lightweight-only scope."

### 2.1 明确不做 / Explicit Non-Goals

这些方向不进入 ToScreen 的产品范围，除非未来产品定位发生根本变化。
These are outside ToScreen's product scope unless the product positioning fundamentally changes.

| 不做 / Will Not Build | 原因 / Reason |
|---|---|
| 完整 CapCut/剪映替代品 / Full CapCut/Jianying replacement | ToScreen 不是通用视频剪辑软件；底层可以有剪辑软件结构，但产品体验必须服务软件宣传视频。 / ToScreen is not a generic video editor; the underlying structure can resemble an editor, but the UX must serve software demo videos. |
| 完整 Jitter 替代品 / Full Jitter replacement | ToScreen 只吸收 Jitter 式宣传动效，不做通用 motion design 软件。 / ToScreen adopts Jitter-like product motion, but does not become a general motion design tool. |
| 专业调色系统 / Professional color grading system | 与软件产品录屏宣传的核心价值弱相关。 / Weakly related to software product demo value. |

### 2.2 只做轻量版 / Lightweight-Only Scope

这些能力可以做，但只做服务软件宣传视频的轻量版本，不做专业完整版本。
These capabilities can exist, but only as lightweight versions serving software demo videos, not full professional systems.

| 能力 / Capability | ToScreen 做什么 / What ToScreen Builds | 不做什么 / What It Does Not Build |
|---|---|---|
| 转场 / Transitions | 做页面切换、镜头切换、CTA 结尾等产品演示转场。 / Product-demo transitions for page changes, camera changes, and CTA endings. | 不做大型通用转场库。 / No large generic transition library. |
| 音频 / Audio | 做音量、淡入淡出、配乐、配音、降噪、自动对齐。 / Volume, fades, music, voiceover, denoise, auto alignment. | 不做专业音频混音台。 / No professional audio mixer. |
| 动效 / Motion | 做标题、Logo、Lottie、UI 高亮、CTA 的预设动效。 / Preset motion for titles, logo, Lottie, UI highlights, and CTA. | 不做逐属性曲线编辑和完整图层动画软件。 / No full per-property curve editor or layer animation tool. |
| 视频剪辑 / Video editing | 做分割、裁剪、移动、拉伸、基础素材叠加。 / Split, trim, move, resize, and basic media layering. | 不做完整影视后期工具链。 / No full film post-production toolchain. |
| 多源画面 / Multi-source video | 做录屏、摄像头、数字人、产品画面、B-roll 的同步和编排。 / Sync and compose screen recording, camera, digital human, product footage, and B-roll. | 不做专业影视多机位导播系统。 / No professional film/broadcast multi-camera switching system. |

## 3. 产品能力分层 / Capability Layers

ToScreen 应按以下 6 层演进。
ToScreen should evolve across these six layers.

### 3.1 Layer 1：录屏智能剪辑 / Smart Screen Editing

这是基础盘，对标 Screen Studio 的核心体验。
This is the foundation, comparable to Screen Studio's core experience.

必须具备：
Must have:

- 录屏与音频录制 / screen and audio recording
- 自动 Zoom / Focus / auto zoom and focus
- 光标重绘、点击动效、轨迹平滑 / cursor redraw, click effects, and motion smoothing
- 背景、圆角、阴影、Padding、比例 / background, radius, shadow, padding, aspect ratio
- 裁剪、分割、移动、拉伸 / trim, split, move, resize
- 自动去等待、去停顿、节奏优化 / remove waiting, remove pauses, improve pacing

### 3.2 Layer 2：多源画面编排 / Multi-Source Composition

这是支持数字人、讲解人和产品宣传视频的重要基础。
This is an important foundation for digital humans, presenters, and product marketing videos.

ToScreen 不做专业影视多机位导播系统，但应该支持产品演示场景中的多源画面。
ToScreen does not build a professional film or broadcast multi-camera switching system, but it should support multi-source video for product demo scenarios.

包括：
Includes:

- 录屏主画面 / screen recording as primary footage
- 摄像头画面 / camera footage
- 数字人讲解 / digital human presenter
- 产品 B-roll / product B-roll
- 图片、Logo、App icon / images, logos, app icons
- 画中画、分屏、角标主持人 / picture-in-picture, split view, corner presenter
- 与录屏、语音、字幕、AI 剪辑计划同步 / sync with recording, voice, captions, and AI edit plan

关键原则：
Core principle:

> ToScreen 需要多源画面编排，但不需要传统影视级多机位导播台。
> ToScreen needs multi-source composition, but not a traditional film/broadcast multi-camera control room.

### 3.3 Layer 3：软件宣传动效 / Product Motion Design

这是 ToScreen 区别于普通录屏工具的第一层差异化。
This is the first differentiation layer beyond ordinary screen recording tools.

包括：
Includes:

- Lottie 动画导入与播放 / Lottie import and playback
- 标题、卖点、关键词强调 / title, value prop, keyword emphasis
- Logo、App icon、Badge 动效 / logo, app icon, and badge motion
- UI 高亮框、箭头、标注动画 / UI highlight box, arrow, and annotation animation
- CTA 结尾模板 / CTA ending templates
- Jitter-like motion presets, but not a full Jitter clone / 类 Jitter 动效预设，但不做完整 Jitter 复制品

### 3.4 Layer 4：UI 感知动效 / UI-Aware Motion

这是 ToScreen 区别于 Screen Studio 和 Jitter 的关键方向。
This is a key direction that can differentiate ToScreen from both Screen Studio and Jitter.

如果用户同时拥有录屏操作和 UI 源文件，ToScreen 不应只把录屏当作像素视频处理，而应该理解 UI 结构。
If the user has both recorded interaction and UI source files, ToScreen should not treat the recording only as pixels; it should understand the UI structure.

可能的 UI 源文件包括：
Possible UI sources include:

- Figma 设计稿 / Figma design files
- 网页 DOM / Web DOM
- 产品页面截图 + OCR/视觉识别 / Product screenshots with OCR or visual recognition
- 组件结构或前端代码元数据 / Component structure or frontend metadata
- Logo、Icon、品牌资产 / Logo, icon, and brand assets

UI 感知动效的目标不是让用户从零做动画，而是把真实产品操作自动重构为可动画化的宣传镜头。
The goal of UI-aware motion is not to make users create animation from scratch, but to reconstruct real product interactions into animatable product-video shots.

典型流程：
Typical flow:

1. 用户录制真实产品操作。 / The user records real product usage.
2. 系统读取光标、点击、页面切换、输入、等待和语音。 / The system reads cursor movement, clicks, page changes, typing, waits, and speech.
3. 系统从 UI 源文件中识别按钮、卡片、输入框、表格、弹窗、Logo 和核心区域。 / The system identifies buttons, cards, inputs, tables, modals, logos, and key regions from UI sources.
4. 系统将关键 UI 元素转换成可动画对象。 / The system converts key UI elements into animatable objects.
5. AI 生成镜头、标题、动效、标注和 CTA。 / AI generates camera moves, titles, motion, annotations, and CTA.
6. 结果落到可编辑 Timeline。 / The result becomes an editable timeline.

推荐概念模型：
Recommended conceptual model:

```ts
type UISourceAsset = {
  id: string;
  type: 'figma' | 'dom' | 'screenshot' | 'component-metadata';
  sourceUrl?: string;
  capturedAtMs?: number;
  elements: UIElementRef[];
};

type UIElementRef = {
  id: string;
  sourceAssetId: string;
  role: 'button' | 'input' | 'card' | 'table' | 'modal' | 'nav' | 'logo' | 'text' | 'unknown';
  label?: string;
  bounds: { x: number; y: number; width: number; height: number };
  style?: Record<string, unknown>;
};

type UIElementMotionClipProps = {
  elementRefId: string;
  motion: 'highlight' | 'pop-out' | 'float' | 'zoom' | 'morph' | 'three-d-tilt' | 'callout';
  transform?: RectTransform;
  preset?: MotionPresetId;
};
```

关键原则：
Core principles:

| 原则 / Principle | 说明 / Explanation |
|---|---|
| 录屏提供真实上下文。 / Recording provides real context. | 保留用户真实操作、时间、光标和结果。 / Keep real interaction, timing, cursor, and result. |
| UI 源文件提供结构。 / UI source provides structure. | 让系统知道“这个像素区域是什么组件”。 / Let the system know what component a pixel region represents. |
| Motion 层提供表达。 / Motion layer provides expression. | 将按钮、卡片、弹窗、结果区域转成 highlight、pop-out、3D tilt 等动效。 / Turn buttons, cards, modals, and result areas into highlights, pop-outs, 3D tilts, etc. |
| Timeline 保留控制权。 / Timeline preserves control. | AI 自动生成后，用户仍能手动调整每个片段。 / After AI generation, users can still adjust every clip manually. |

结论：
Conclusion:

> ToScreen 可以衔接动画，但正确方向不是 Full Jitter，而是 UI-aware Motion Compiler：把 UI 源文件、录屏行为和 AI 计划编译成可编辑宣传视频。
> ToScreen can connect directly into animation, but the right direction is not Full Jitter; it is a UI-aware Motion Compiler that compiles UI sources, recorded behavior, and AI plans into editable product videos.

### 3.5 Layer 5：3D 运镜包装 / 3D Camera Packaging

这是视觉上限层。
This is the visual ceiling layer.

包括：
Includes:

- 页面作为 3D 平面 / page as a 3D plane
- 浏览器窗口、App 窗口、设备模型 / browser window, app window, device mockup
- 推进、拉远、旋转、倾斜 / push-in, pull-out, rotate, tilt
- 景深、运动模糊、空间转场 / depth of field, motion blur, spatial transition
- 多页面空间切换 / spatial transitions between pages

原则：
Principle:

> 3D 运镜不应该破坏时间轴模型；它应该是 Camera Clip、UIElementMotionClip 或 Scene Clip 的属性。
> 3D camera movement should not break the timeline model; it should be represented as Camera Clip, UIElementMotionClip, or Scene Clip properties.

### 3.6 Layer 6：AI 自动剪辑 / AI Auto-Editing

AI 不应直接“魔法修改 UI 状态”，而应生成结构化编辑方案。
AI should not magically mutate UI state directly; it should generate a structured edit plan.

AI 输出应该类似：
AI output should look like:

```ts
type AIEditPlan = {
  scenes: AIScenePlan[];
  cuts: AICutPlan[];
  cameraMoves: AICameraMovePlan[];
  captions: AICaptionPlan[];
  highlights: AIHighlightPlan[];
  lottieInserts: AILottieInsertPlan[];
  audioActions: AIAudioActionPlan[];
};
```

然后由确定性转换器转成 Timeline Clips。
Then a deterministic adapter converts it into Timeline Clips.

## 4. 核心产品原则 / Core Product Principles

| ID | 原则 / Principle | 决策 / Decision |
|---|---|---|
| P-01 | 录屏是主素材，不是项目本身。 / Recording is the main asset, not the project itself. | Main Clip 应降级为 Screen Recording Clip。 / Main Clip should become a Screen Recording Clip. |
| P-02 | 时间轴是通用多轨时间轴。 / The timeline is a universal multi-track timeline. | 工程总长由所有片段的最晚结束时间决定。 / Project duration is determined by the latest clip end. |
| P-03 | 编辑器要有通用剪辑骨架，但不要变成通用剪辑软件。 / Keep the editor skeleton, not the full generic editor. | 保留多轨、素材、片段、导出；弱化影视剪辑功能。 / Keep tracks, assets, clips, export; weaken film-editing features. |
| P-04 | 所有可编辑对象都应尽量 Clip 化。 / Editable objects should become clips when possible. | Text、Annotation、Lottie、Camera、Audio 都是 Clip。 / Text, Annotation, Lottie, Camera, and Audio are clips. |
| P-05 | AI 生成计划，用户保留最后控制权。 / AI generates plans; the user keeps final control. | AI 输出必须可编辑、可撤销、可解释。 / AI output must be editable, undoable, and explainable. |
| P-06 | 渲染预览和导出必须吃同一份 Project Model。 / Preview and export must consume the same Project Model. | 不允许 UI 一套逻辑、导出另一套逻辑长期分叉。 / Avoid long-term divergence between UI and export logic. |

## 5. 推荐项目模型 / Recommended Project Model

未来编辑器的核心数据模型应从“录屏文件 + 若干状态”升级为 Project Model。
The editor should evolve from "recording file plus state" into a real Project Model.

```ts
type Project = {
  id: string;
  version: number;
  name: string;
  durationMs: number;
  canvas: CanvasSettings;
  assets: Asset[];
  tracks: Track[];
  clips: Clip[];
  scenes?: Scene[];
  exportSettings: ExportSettings;
};
```

### 5.1 Canvas Settings / 画布设置

```ts
type CanvasSettings = {
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3' | string;
  width?: number;
  height?: number;
  background: BackgroundSettings;
  padding: number;
  borderRadius: number;
  shadow: ShadowSettings;
};
```

### 5.2 Asset / 素材

所有外部资源先进入 Asset Pool，再被 Clip 引用。
All external resources enter the Asset Pool first, then clips reference them.

```ts
type Asset =
  | ScreenRecordingAsset
  | VideoAsset
  | AudioAsset
  | ImageAsset
  | LottieAsset
  | DigitalHumanAsset
  | CursorDataAsset
  | FontAsset;

type BaseAsset = {
  id: string;
  type: string;
  name: string;
  sourceUrl: string;
  filePath?: string;
  metadata?: Record<string, unknown>;
};
```

关键决策：
Key decision:

> 录屏、音频、Lottie、图片都必须是素材；时间轴上只放 Clip，不直接散落文件路径。
> Recordings, audio, Lottie, and images must be assets; the timeline should contain clips, not loose file paths.

### 5.3 Track / 轨道

```ts
type Track = {
  id: string;
  type: TrackType;
  name: string;
  order: number;
  parentId?: string;
  locked?: boolean;
  muted?: boolean;
  hidden?: boolean;
};

type TrackType =
  | 'video'
  | 'camera'
  | 'presenter'
  | 'text'
  | 'annotation'
  | 'lottie'
  | 'image'
  | 'audio'
  | 'voice'
  | 'music'
  | 'cursor';
```

建议轨道结构：
Recommended track structure:

| Track | 用途 / Purpose |
|---|---|
| Video Track | 录屏、B-roll、图片序列等视觉素材。 / Screen recordings, B-roll, image sequences. |
| Camera Track | Zoom、Focus、Pan、3D 运镜。 / Zoom, focus, pan, 3D camera movement. |
| Presenter Track | 摄像头讲解人、数字人、角标主持人。 / Camera presenter, digital human, corner presenter. |
| Annotation Track | 箭头、框选、高亮、标注。 / Arrows, boxes, highlights, callouts. |
| Text Track | 标题、字幕、卖点文案。 / Titles, captions, value props. |
| Lottie Track | Logo 动效、CTA、动态图标、装饰动效。 / Logo motion, CTA, animated icons, decorative motion. |
| Cursor Track | 重绘光标、点击效果、轨迹。 / Redrawn cursor, click effects, cursor path. |
| Audio / Voice / Music Track | 原声、配音、音乐、音效。 / Original audio, voiceover, music, SFX. |

### 5.4 Clip / 片段

所有时间轴片段共享基础字段。
All timeline clips share base fields.

```ts
type Clip = {
  id: string;
  type: ClipType;
  trackId: string;
  assetId?: string;
  startMs: number;
  endMs: number;
  sourceStartMs?: number;
  sourceEndMs?: number;
  name?: string;
  props: ClipProps;
};

type ClipType =
  | 'screen-recording'
  | 'video'
  | 'audio'
  | 'camera'
  | 'presenter'
  | 'text'
  | 'annotation'
  | 'lottie'
  | 'image'
  | 'cursor';
```

关键规则：
Core rules:

- 同一轨道内默认不允许片段重叠。 / Clips should not overlap within the same track by default.
- 发生重叠时，应自动换到同类型的新轨道或子轨。 / If overlap occurs, move or wrap to another same-type lane.
- 片段显示、拖拽、拉伸、选中、锁定、隐藏应共享一套基础行为。 / Clip rendering, drag, resize, selection, lock, and hide should share common behavior.
- 特殊能力放在 `props`，不要破坏基础 Clip 模型。 / Special behavior belongs in `props`, not in the base clip model.

## 6. 关键 Clip 类型 / Key Clip Types

### 6.1 Screen Recording Clip / 录屏片段

当前的 Main Clip 应逐步演进为 `screen-recording` clip。
The current Main Clip should evolve into a `screen-recording` clip.

```ts
type ScreenRecordingClipProps = {
  crop?: CropRegion;
  fitMode: 'contain' | 'cover' | 'fill';
  freezeAfterEnd?: boolean;
  showBlackAfterEnd?: boolean;
};
```

决策：
Decision:

> Main Clip 不再定义工程结束；它只是工程里的一个视觉素材片段。
> Main Clip no longer defines project end; it is only one visual media clip.

### 6.2 Camera Clip / 运镜片段

现在的 Focus/Zoom 轨应升级为 Camera Track。
The current Focus/Zoom track should become a Camera Track.

```ts
type CameraClipProps = {
  mode: 'zoom' | 'pan' | 'focus' | 'three-d';
  depth?: '1.25x' | '1.5x' | '1.8x' | '2.0x' | '2.5x' | '3.5x' | '5x';
  focus?: { cx: number; cy: number };
  easing?: 'linear' | 'smooth' | 'spring' | 'catmull-rom';
  threeD?: {
    rotateX: number;
    rotateY: number;
    rotateZ: number;
    translateZ: number;
    perspective: number;
    depthOfField?: number;
  };
};
```

决策：
Decision:

> Focus/Zoom 是 Camera Clip 的一种，不应该长期作为独立特殊系统存在。
> Focus/Zoom is one kind of Camera Clip, not a separate long-term special system.

### 6.3 Presenter Clip / 主持人与数字人片段

Presenter Clip 用于摄像头讲解人、数字人、虚拟主持人和角标人物。
Presenter Clip is used for camera presenters, digital humans, virtual hosts, and corner presenters.

```ts
type PresenterClipProps = {
  sourceKind: 'camera' | 'digital-human' | 'video-file' | 'generated-avatar';
  layout: 'picture-in-picture' | 'corner' | 'split-screen' | 'full-frame' | 'cutaway';
  transform: {
    x: number;
    y: number;
    width: number;
    height: number;
    opacity: number;
    borderRadius?: number;
  };
  backgroundRemoval?: boolean;
  eyeContactCorrection?: boolean;
  voiceSync?: {
    audioAssetId?: string;
    transcriptId?: string;
  };
};
```

关键原则：
Core principle:

> 数字人和摄像头讲解人是产品演示的多源画面能力，不应被排除；但 ToScreen 不做专业影视导播级多机位系统。
> Digital humans and camera presenters are part of product-demo multi-source composition and should not be excluded; however, ToScreen does not build a professional film/broadcast multi-camera switching system.

### 6.4 Lottie Clip / Lottie 动效片段

Lottie 是宣传视频能力的重要组成部分，但不应该让编辑器变成完整动画软件。
Lottie is important for product motion, but it should not turn the editor into a full animation tool.

```ts
type LottieClipProps = {
  playback: {
    loop: boolean;
    speed: number;
    direction: 1 | -1;
  };
  transform: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    opacity: number;
  };
  colorOverrides?: Record<string, string>;
  enterPreset?: MotionPresetId;
  exitPreset?: MotionPresetId;
};
```

MVP 范围：
MVP scope:

- 导入 `.json` / `.lottie` 文件。 / Import `.json` / `.lottie`.
- 设置开始、结束、位置、大小、透明度、循环、速度。 / Set start, end, position, size, opacity, loop, speed.
- 支持少量品牌色替换。 / Support limited brand color replacement.
- 支持入场/退场 preset。 / Support enter/exit presets.

不做：
Non-goals:

- 不做完整图层树。 / No full layer tree.
- 不做逐属性曲线编辑。 / No full per-property curve editor.
- 不做复杂 shape 编辑。 / No complex shape editing.

### 6.5 Annotation Clip / 标注片段

Annotation 应与 Text、Lottie 一样是 Overlay Clip。
Annotation should be an Overlay Clip like Text and Lottie.

```ts
type AnnotationClipProps = {
  kind: 'box' | 'arrow' | 'spotlight' | 'blur' | 'callout';
  transform: RectTransform;
  style: AnnotationStyle;
  motionPreset?: MotionPresetId;
};
```

### 6.6 Text Clip / 文字片段

Text 不应只服务字幕，也应服务宣传视频结构。
Text should support not only captions, but also product video structure.

类型：
Types:

- Hook title / 开场标题
- Section title / 段落标题
- Feature label / 功能标签
- Caption / 字幕
- CTA / 行动召唤

## 7. Scene 模型 / Scene Model

当产品进入 AI 自动剪辑和 3D 运镜阶段，仅靠扁平时间轴会不够表达“宣传视频结构”。
When AI auto-editing and 3D camera work become important, a flat timeline alone is not enough to describe product video structure.

建议引入 Scene 作为上层结构。
Introduce Scene as an upper-level structure.

```ts
type Scene = {
  id: string;
  name: string;
  startMs: number;
  endMs: number;
  purpose: 'hook' | 'problem' | 'demo' | 'feature' | 'result' | 'cta' | 'custom';
  clipIds: string[];
  aiSummary?: string;
};
```

Scene 的作用：
Scene responsibilities:

- 帮 AI 理解视频结构。 / Help AI understand video structure.
- 帮用户按段落编辑，而不是只盯着细碎片段。 / Let users edit by segment instead of only micro-clips.
- 帮模板系统决定标题、动效、转场。 / Help templates decide titles, motion, and transitions.

## 8. AI 自动剪辑落地方式 / How AI Auto-Editing Should Work

AI 工作流不应该是“直接把项目改乱”，而应该是可审查的计划。
The AI workflow should not directly mutate the project unpredictably; it should create a reviewable plan.

推荐流程：
Recommended flow:

1. 分析素材 / Analyze assets
   读取录屏、光标数据、音频、语音文本、页面切换。
   Read recording, cursor data, audio, transcript, page changes.

2. 生成 Edit Plan / Generate Edit Plan
   输出 cuts、camera moves、captions、highlights、lottie inserts、scenes。
   Output cuts, camera moves, captions, highlights, lottie inserts, scenes.

3. 用户预览 AI 建议 / User reviews AI suggestions
   用户可以接受、拒绝、局部应用。
   User can accept, reject, or partially apply.

4. Plan 转 Timeline / Convert plan to timeline
   通过确定性 adapter 生成 clips。
   A deterministic adapter generates clips.

5. 手动微调 / Manual refinement
   用户继续用 timeline、画布和属性面板调整。
   User refines via timeline, canvas, and property panel.

关键原则：
Core principle:

> AI 负责 0-80% 的结构化粗剪，用户负责最后 20% 的视觉和节奏控制。
> AI owns the first 0-80% structured rough cut; the user owns the final 20% visual and pacing control.

## 9. 编辑器信息架构 / Editor Information Architecture

推荐编辑器布局：
Recommended editor layout:

| 区域 / Area | 责任 / Responsibility |
|---|---|
| Preview Canvas | 所见即所得预览、直接调整 Focus/Annotation/Text/Lottie。 / WYSIWYG preview and direct manipulation. |
| Timeline | 多轨结构、片段时间、分轨、拉伸、吸附。 / Multi-track timing, lanes, resize, snap. |
| Asset Panel | 录屏、音频、图片、Lottie、Logo、模板素材。 / Recordings, audio, images, Lottie, logo, template assets. |
| Inspector | 当前选中对象的参数。 / Properties for selected object. |
| AI Panel | 自动剪辑、生成标题、生成镜头、生成 CTA。 / Auto-edit, generate titles, camera moves, CTA. |
| Template Panel | 宣传视频结构模板、动效 preset、品牌套件。 / Product-video templates, motion presets, brand kit. |

## 10. 当前代码结构判断 / Current Code Assessment

当前代码作为原型可以继续迭代，但不应被视为未来最终架构。
The current code can continue as a prototype, but should not be treated as the final architecture.

### 10.0 历史背景 / Historical Context

当前工程之所以先做成接近 Screen Studio 的形态，是一个阶段性选择，而不是最终产品边界。
The current project moved toward a Screen Studio-like shape as a staged decision, not as the final product boundary.

背景判断：
Context:

- 最初目标已经包含 AI 自动剪辑。 / The original goal already included AI auto-editing.
- 但 AI 自动剪辑需要一个可靠的手动编辑底座。 / But AI auto-editing needs a reliable manual editing foundation.
- 因此第一阶段先追平 Screen Studio 的核心体验：录屏、光标、Zoom、背景、缩放、时间轴、导出。 / Therefore Phase 1 focused on matching Screen Studio's core experience: recording, cursor, zoom, background, scaling, timeline, and export.
- 这个阶段的价值是打地基，不是把 ToScreen 定义成 Screen Studio clone。 / The value of this phase is foundation-building, not defining ToScreen as a Screen Studio clone.

正确理解：
Correct interpretation:

> Screen Studio-like editing is the foundation layer; AI editing, UI-aware motion, Lottie, and 3D camera work are the differentiation layers.
> 类 Screen Studio 编辑体验是地基层；AI 剪辑、UI 感知动效、Lottie 和 3D 运镜才是差异化层。

因此，当前代码中的 Main Clip、Focus Track、Annotation、Audio 等实现可以继续服务短期迭代，但未来应逐步迁移到 Project / Asset / Track / Clip 模型。
Therefore, current implementations such as Main Clip, Focus Track, Annotation, and Audio can continue serving short-term iteration, but should gradually migrate to the Project / Asset / Track / Clip model.

### 10.1 可保留 / Keep

| 模块 / Module | 保留原因 / Why Keep |
|---|---|
| Pixi/WebGL preview engine | 未来 3D、缩放、光标重绘仍需要强渲染层。 / Future 3D, zoom, and cursor redraw need a strong render layer. |
| Timeline foundation | 已有多轨、拖拽、缩放、播放指针基础。 / Existing foundation for multi-track, drag, zoom, playhead. |
| Auto-Zoom logic | 是 AI 自动剪辑和 Camera Track 的基础。 / Foundation for AI editing and Camera Track. |
| Cursor data pipeline | 是差异化体验的重要资产。 / Key differentiator. |
| Export pipeline | 应继续演进为 Project Model 驱动。 / Should evolve to be Project Model-driven. |

### 10.2 需要重构 / Refactor

| 当前问题 / Current Issue | 目标结构 / Target Structure |
|---|---|
| Main Clip 仍像项目中心。 / Main Clip still behaves like project center. | 降级为 Screen Recording Clip。 / Convert to Screen Recording Clip. |
| Focus/Zoom 是特殊轨道。 / Focus/Zoom is special-cased. | 升级为 Camera Track + Camera Clip。 / Convert to Camera Track + Camera Clip. |
| Annotation/Text/Lottie 还没有统一 Overlay Clip 模型。 / No unified Overlay Clip model. | 统一为 clip + props + inspector。 / Unified clip + props + inspector. |
| UI 状态和导出逻辑容易分叉。 / UI and export logic can diverge. | Preview/export 都消费 Project Model。 / Preview/export both consume Project Model. |
| 素材路径散落在 region 里。 / File paths are scattered in regions. | Asset Pool + assetId 引用。 / Asset Pool + assetId reference. |

## 11. 迁移路线 / Migration Plan

不要一次性重写全部代码。
Do not rewrite everything at once.

### Phase 1：模型文档与兼容层 / Model Docs And Compatibility Layer

- 定义 `Project`, `Asset`, `Track`, `Clip` 类型。 / Define `Project`, `Asset`, `Track`, `Clip`.
- 不立即替换 UI，只先写 adapter。 / Do not replace UI immediately; write adapters first.
- 当前 `zoomRegions`, `audioRegions`, `annotationRegions` 继续运行。 / Keep current region state running.
- 新增转换函数：current state -> Project Model。 / Add converter: current state -> Project Model.

### Phase 2：Timeline 统一 Clip 渲染 / Unified Timeline Clip Rendering

- 让 Video、Camera、Presenter、Audio、Annotation、Text 共享基础 Clip 行为。 / Make Video, Camera, Presenter, Audio, Annotation, Text share base clip behavior.
- 统一选中、拉伸、拖拽、磁吸、碰撞。 / Unify selection, resize, drag, snap, collision.
- 同轨不重叠成为底层规则。 / Make no-overlap a base rule.

### Phase 3：Camera Track 替代 Focus Track / Replace Focus Track With Camera Track

- 将 ZoomRegion 迁移为 CameraClip。 / Migrate ZoomRegion to CameraClip.
- 保留现有 UI，但内部使用新模型。 / Keep existing UI while using new model internally.
- 为 3D 运镜预留 props。 / Reserve props for 3D camera.

### Phase 4：Presenter 与多源画面 / Presenter And Multi-Source Composition

- 设计 Presenter Track 与 Presenter Clip。 / Design Presenter Track and Presenter Clip.
- 支持摄像头/数字人/视频文件作为讲解人来源。 / Support camera, digital human, and video files as presenter sources.
- 支持画中画、角标、分屏、cutaway。 / Support picture-in-picture, corner presenter, split-screen, and cutaway.
- 与语音、字幕、AI 剪辑计划对齐。 / Align with voice, captions, and AI edit plans.

### Phase 5：Overlay 与 Lottie / Overlay And Lottie

- Text、Annotation、Lottie 统一为 Overlay Clip。 / Unify Text, Annotation, Lottie as Overlay Clips.
- Lottie 先做导入、时间、位置、大小、循环、速度。 / Start Lottie with import, timing, position, size, loop, speed.
- 不做完整动画编辑器。 / Do not build a full animation editor.

### Phase 6：UI Source 与 UI 感知动效 / UI Source And UI-Aware Motion

- 设计 `UISourceAsset` 与 `UIElementRef`。 / Design `UISourceAsset` and `UIElementRef`.
- 先支持截图/DOM/Figma 中的一种来源，不同时铺开。 / Start with one source among screenshot, DOM, or Figma; do not expand all at once.
- 将关键 UI 元素映射到录屏时间线。 / Map key UI elements to the recording timeline.
- 新增 `UIElementMotionClip`，用于 highlight、pop-out、float、3D tilt。 / Add `UIElementMotionClip` for highlight, pop-out, float, and 3D tilt.

### Phase 7：AI Edit Plan / AI 编辑计划

- AI 只生成计划，不直接改散乱状态。 / AI generates plans, not scattered state mutations.
- Plan adapter 生成 timeline clips。 / Plan adapter generates timeline clips.
- 用户可以接受、撤销、局部应用。 / User can accept, undo, or partially apply.

## 12. 下一步建议 / Recommended Next Steps

| Priority | 工作项 / Work Item | 目的 / Purpose |
|---|---|---|
| P0 | 确认本文档作为产品结构基准。 / Confirm this document as the baseline. | 防止继续在方向上摇摆。 / Prevent direction drift. |
| P0 | 新建 `ProjectModel` 类型草案。 / Create draft `ProjectModel` types. | 给后续代码重构一个稳定目标。 / Provide a stable target for refactoring. |
| P1 | 写 current state -> Project adapter。 / Write current state -> Project adapter. | 让旧代码和新模型并行。 / Let old code and new model coexist. |
| P1 | 将 Focus Track 命名和概念升级为 Camera Track。 / Rename/reframe Focus Track to Camera Track. | 为 3D 运镜打开结构空间。 / Open architectural space for 3D camera work. |
| P1 | 设计 Presenter Track 与 Presenter Clip。 / Design Presenter Track and Presenter Clip. | 支持摄像头、数字人、画中画和分屏讲解。 / Support camera, digital human, picture-in-picture, and split-screen presentation. |
| P1 | 设计 Lottie Clip MVP。 / Design Lottie Clip MVP. | 进入 Jitter-like 宣传动效能力。 / Start Jitter-like product motion. |
| P2 | 设计 UI Source 与 UIElementMotionClip。 / Design UI Source and UIElementMotionClip. | 连接录屏行为、UI 源文件和动画。 / Connect recorded behavior, UI source files, and animation. |
| P2 | 设计 AI Edit Plan 数据结构。 / Design AI Edit Plan schema. | 为 AI 自动剪辑打底。 / Prepare for AI auto-editing. |

## 13. 协作与验收节点 / Collaboration And Review Checkpoints

第一阶段目标是建立 Screen Studio 级别稳定的录屏宣传视频编辑底座。
The Phase 1 goal is to build a Screen Studio-level stable foundation for product demo video editing.

这不是一次性大爆炸重构，而应按阶段推进、按节点验收。
This should not be a one-shot big-bang rewrite; it should be phased and reviewed at checkpoints.

### 13.1 第一阶段执行对照清单 / Phase 1 Execution Checklist

这个清单用于回答两个问题：哪些工作 Codex 可以独立推进，哪些节点必须由用户体验、判断或确认后才能继续。
Use this checklist to answer two questions: what Codex can move forward independently, and where user review or product judgment is required before continuing.

| ID | 工作包 / Work Package | Codex 是否可独立完成 / Can Codex Own It Independently | 需要用户介入吗 / User Input Needed | 触发条件 / Trigger |
|---|---|---|---|---|
| PHASE1-A | 产品与架构基线文档 / Product and architecture baseline | 可以。Codex 负责持续更新文档、决策日志和验收状态。 / Yes. Codex keeps docs, decision log, and acceptance status updated. | 需要确认方向。 / User confirms direction. | 当文档涉及产品定位、范围边界或阶段目标时。 / When docs change positioning, scope, or phase goals. |
| PHASE1-B | ProjectModel 基础模型 / ProjectModel foundation | 可以。Codex 负责类型、adapter、validator、脚本和兼容层。 / Yes. Codex owns types, adapter, validator, scripts, and compatibility layer. | 需要模型验收。 / User reviews model direction. | 当 Project / Asset / Track / Clip / Scene 结构稳定后。 / Once Project / Asset / Track / Clip / Scene structure is stable. |
| PHASE1-C | 保存与恢复稳定性 / Save and restore stability | 可以。Codex 负责排查 autosave、project json、录屏路径、音频路径、proxy 和旧项目兼容。 / Yes. Codex debugs autosave, project JSON, recording paths, audio paths, proxy, and legacy compatibility. | 需要实机验收。 / User verifies hands-on. | Electron 重启后，用真实录制项目检查画面、音频、Zoom、背景、光标是否恢复。 / After restarting Electron, verify a real recording restores picture, audio, zoom, background, and cursor. |
| PHASE1-D | Timeline 基础手感与规则 / Timeline basic behavior and rules | 可以做代码实现。Codex 负责拖拽、拉伸、吸附、工程总长、不重叠规则和边界 bug。 / Codex can implement it. Codex owns drag, resize, snap, project duration, no-overlap rules, and edge bugs. | 必须体验验收。 / User must verify feel. | 每次改动拖拽、拉伸、吸附、游标、滚轮缩放或片段换行后。 / After changes to drag, resize, snap, playhead, wheel zoom, or lane wrapping. |
| PHASE1-E | Screen Studio 级核心体验追平 / Screen Studio-grade core experience | 可以分模块推进。Codex 负责录屏预览、Zoom/Focus、背景、光标、基础剪辑和导出链路修复。 / Codex can progress module by module: preview, Zoom/Focus, background, cursor, basic editing, and export. | 需要视觉和导出验收。 / User verifies visuals and export. | 每个核心体验模块完成后，用当前 Electron 项目和导出视频对照。 / After each core module, compare in Electron and exported video. |
| PHASE1-F | Preview/Export 一致性 / Preview and export consistency | 可以。Codex 负责统一数据来源、时间规则、渲染入口和导出入口。 / Yes. Codex aligns data sources, timing rules, preview renderer, and export renderer. | 需要最终导出验收。 / User verifies final export. | 能完整导出一个真实宣传视频后。 / Once a real product-demo video can be exported end to end. |
| PHASE1-G | Camera/Focus 概念收口 / Camera and Focus model consolidation | 可以提出模型和代码迁移方案。 / Codex can propose and implement model migration. | 需要确认命名和体验。 / User confirms naming and UX. | 从 Focus Track 改成 Camera Track、加入 3D 运镜或改变 Zoom 操作方式前。 / Before renaming Focus Track to Camera Track, adding 3D camera, or changing Zoom interaction. |
| PHASE1-H | 下一阶段能力入口 / Future capability entry points | 可以先保留模型入口。 / Codex can reserve model hooks. | 需要用户明确批准才进入实现。 / User must explicitly approve implementation. | Presenter/数字人、Lottie 导入、UI Source、UI-aware motion、AI 自动剪辑进入真实 UI 或渲染前。 / Before Presenter/digital human, Lottie import, UI Source, UI-aware motion, or AI auto-editing enters real UI/rendering. |

第一阶段的默认执行原则：Codex 可以独立修复工程稳定性和模型兼容问题；凡是影响产品定位、镜头语言、时间轴手感或最终视觉判断的节点，必须由用户验收后再进入下一层。
Default Phase 1 execution rule: Codex can independently fix engineering stability and model compatibility; anything that affects product positioning, camera language, timeline feel, or final visual judgment must be reviewed by the user before moving to the next layer.

### 13.2 我可以独立完成 / Work Codex Can Own Independently

| ID | 工作项 / Work Item | 输出 / Output | 是否需要用户介入 / User Involvement |
|---|---|---|---|
| AUTO-01 | ProjectModel 类型草案 / Draft ProjectModel types | `Project`, `Asset`, `Track`, `Clip`, `Scene` 类型定义。 / Type definitions for `Project`, `Asset`, `Track`, `Clip`, `Scene`. | 不需要。 / Not required. |
| AUTO-02 | current state -> Project adapter | 将当前 `videoPath`, `zoomRegions`, `audioRegions`, `annotationRegions`, `cursorData`, `wallpaper`, `exportSettings` 转成 Project Model。 / Convert current state into Project Model. | 不需要。 / Not required. |
| AUTO-03 | 项目保存/恢复稳定性修复 / Project save and restore hardening | 修复视频、proxy、音频、clicks、project json、路径恢复。 / Harden video, proxy, audio, clicks, project JSON, and path recovery. | 阶段完成后需要体验验收。 / User verifies after completion. |
| AUTO-04 | Timeline 行为稳定 / Timeline behavior stabilization | 拖拽、拉伸、吸附、不重叠、工程总时长稳定。 / Stable drag, resize, snap, no-overlap, project duration. | 阶段完成后需要体验验收。 / User verifies after completion. |
| AUTO-05 | Camera Track 概念收口 / Camera Track model consolidation | 将 Focus/Zoom 在模型层收敛为 Camera Clip。 / Consolidate Focus/Zoom into Camera Clip at the model layer. | 需要确认命名和体验。 / User confirms naming and UX. |
| AUTO-06 | Preview/Export 一致性排查 / Preview/export consistency audit | 排查预览和导出数据来源，逐步统一到 Project Model。 / Audit preview/export data sources and converge them toward Project Model. | 阶段完成后需要导出验收。 / User verifies export. |
| AUTO-07 | 文档同步 / Documentation updates | 更新架构文档、验收清单、变更日志。 / Update architecture docs, acceptance checklist, and changelog. | 不需要，除非涉及产品决策。 / Not required unless product decisions are involved. |

### 13.3 需要用户介入确认 / Decisions Requiring User Input

| ID | 决策点 / Decision Point | 为什么需要用户 / Why User Input Is Needed | 建议介入时机 / Recommended Timing |
|---|---|---|---|
| USER-01 | 产品边界 / Product boundary | 这是定位判断，不是纯代码判断。 / This is positioning, not only engineering. | 每个新大能力进入前。 / Before each major new capability. |
| USER-02 | Presenter / 数字人是否进第一阶段 / Whether Presenter/Digital Human enters Phase 1 | 会明显扩大第一阶段范围。 / It significantly expands Phase 1 scope. | Phase 1 规划确认时。 / During Phase 1 planning confirmation. |
| USER-03 | Lottie 第一阶段范围 / Lottie scope in Phase 1 | 需要决定只做模型，还是做 UI 和导入。 / Need to decide model-only vs UI/import. | ProjectModel 完成后。 / After ProjectModel is done. |
| USER-04 | UI-aware motion 阶段顺序 / UI-aware motion phase order | 关系到是否先接 Figma/DOM/截图。 / Determines whether Figma/DOM/screenshot integration starts early. | Camera Track 稳定后。 / After Camera Track stabilizes. |
| USER-05 | Main Clip 结束后的画面规则 / Visual state after Main Clip ends | 需要产品体验判断：黑屏、最后一帧、背景还是模板。 / Needs UX decision: black, freeze frame, background, or template. | Project duration 规则实现前。 / Before project duration behavior is finalized. |
| USER-06 | 同轨重叠处理 / Same-track overlap behavior | 需要决定换轨、阻挡、贴边或自动排布。 / Need to decide lane wrap, block, snap edge, or auto-layout. | Timeline 稳定阶段。 / During timeline stabilization. |
| USER-07 | Zoom/Camera 手感 / Zoom and Camera feel | 手感只能由实际使用判断。 / Feel requires hands-on testing. | Camera Track 阶段。 / During Camera Track phase. |
| USER-08 | 光标动效体验 / Cursor motion feel | 大小、偏移、点击效果、平滑程度是审美和体验判断。 / Size, offset, click effect, and smoothing are UX/aesthetic choices. | Cursor 稳定阶段。 / During cursor stabilization. |
| USER-09 | 是否进入下一阶段 / Whether to enter the next phase | 防止代码继续推进但产品感受偏离。 / Prevent implementation from moving ahead while UX drifts. | 每个 Phase 完成后。 / After each phase. |

### 13.4 建议阶段验收 / Recommended Phase Reviews

| Phase | Codex 交付 / Codex Delivery | 用户验收 / User Review |
|---|---|---|
| Phase 1：ProjectModel + Adapter | 类型草案、adapter、文档更新，不破坏现有功能。 / Types, adapter, docs, without breaking current behavior. | 确认模型方向是否符合未来产品。 / Confirm model direction. |
| Phase 2：保存/恢复稳定 | 重启后视频、音频、Zoom、背景、光标数据恢复。 / Restore video, audio, zoom, background, cursor data after restart. | 重启 Electron，确认项目不丢画面、不丢状态。 / Restart Electron and verify no missing picture/state. |
| Phase 3：Timeline 稳定 | 拖拽、拉伸、吸附、不重叠、工程总长稳定。 / Stable drag, resize, snap, no-overlap, project duration. | 重点体验时间轴手感和边界情况。 / Test timeline feel and edge cases. |
| Phase 4：Camera Track 收口 | Focus/Zoom 概念收敛为 Camera Clip。 / Focus/Zoom converges into Camera Clip. | 确认是否符合未来 3D 运镜。 / Confirm fit for future 3D camera work. |
| Phase 5：Preview/Export 一致 | 预览和导出尽量使用同一模型和同一时间规则。 / Preview/export converge on same model and timing rules. | 导出一个完整视频，对比预览和成片。 / Export a full video and compare with preview. |

### 13.5 Phase 1 当前进度 / Current Phase 1 Progress

| ID | 状态 / Status | 说明 / Notes |
|---|---|---|
| PH1-01 ProjectModel 类型草案 / ProjectModel type draft | ✅ Done | 已新增 `src/components/video-editor/project/types.ts`，定义 `VideoEditorProject`, `ProjectAsset`, `ProjectTrack`, `ProjectClip`, `ProjectScene`。 / Added `src/components/video-editor/project/types.ts` with `VideoEditorProject`, `ProjectAsset`, `ProjectTrack`, `ProjectClip`, `ProjectScene`. |
| PH1-02 Legacy adapter | ✅ Done | 已新增 `createProjectFromLegacyEditorState`，可把当前分散状态映射为 Project Model。 / Added `createProjectFromLegacyEditorState` to map current scattered state into Project Model. |
| PH1-03 保存 ProjectModel sidecar / Save ProjectModel sidecar | ✅ Done | autosave 现在会在保留旧字段的同时写入 `projectModel`，不破坏现有加载逻辑。 / Autosave now writes `projectModel` alongside legacy fields without breaking the current loader. |
| PH1-04 ProjectModel 轻量校验 / Lightweight ProjectModel validation | ✅ Done | 已新增 `validateVideoEditorProject`，autosave 会校验 sidecar 的 track/clip/asset 引用和时间范围。 / Added `validateVideoEditorProject`; autosave validates sidecar track/clip/asset references and timing. |
| PH1-05 接管加载/恢复 / Load-restore adoption | ✅ Done | 加载逻辑现在会优先验证并读取 `projectModel`，失败或缺失时回退旧字段。旧格式仍保留兼容。 / Loading now validates and reads `projectModel` first, then falls back to legacy fields if missing or invalid. Legacy compatibility remains. |
| PH1-06 ProjectModel 验证脚本 / ProjectModel verifier script | ✅ Done | 已新增 `scripts/verify-project-model.ts`。使用：`./node_modules/.bin/tsx scripts/verify-project-model.ts <path-to-project.json>`。 / Added `scripts/verify-project-model.ts`. Usage: `./node_modules/.bin/tsx scripts/verify-project-model.ts <path-to-project.json>`. |
| PH1-07 ProjectModel smoke fixture / ProjectModel smoke fixture | ✅ Done | 已新增 `scripts/create-project-model-smoke-fixture.ts`，并通过 verifier 检查：5 assets / 5 tracks / 4 clips / 10000ms。 / Added `scripts/create-project-model-smoke-fixture.ts` and verified it: 5 assets / 5 tracks / 4 clips / 10000ms. |
| PH1-08 Electron autosave 实机验收 / Electron autosave hands-on verification | ✅ Done | 已新增 `npm run dev:editor` 直达 Editor，并验证真实 `recording-1782710530746.project.json` 写入合法 `projectModel`：4 assets / 5 tracks / 11 clips / 15340ms。 / Added `npm run dev:editor` to launch Editor directly and verified real `recording-1782710530746.project.json` writes a valid `projectModel`: 4 assets / 5 tracks / 11 clips / 15340ms. |
| PH1-09 Project 文件路径规范化 / Project file path canonicalization | ✅ Done | 已新增 `electron/ipc/projectFiles.ts` 和 `scripts/verify-project-file-paths.ts`，确保原始录屏、`file://` URL、`recording-*-proxy.mp4` 都稳定映射到同一个 `recording-*.project.json`。 / Added `electron/ipc/projectFiles.ts` and `scripts/verify-project-file-paths.ts`, ensuring raw recordings, `file://` URLs, and `recording-*-proxy.mp4` all map to the same `recording-*.project.json`. |
| PH1-10 ProjectModel 恢复验证 / ProjectModel restore verification | ✅ Done | 已新增 `scripts/verify-project-model-restore.ts`，并补齐 `companionAudioPath` 恢复，确保重启后原始伴随音频路径能从 ProjectModel 回到编辑器状态。 / Added `scripts/verify-project-model-restore.ts` and restored `companionAudioPath`, ensuring the original companion audio path returns from ProjectModel into editor state after restart. |
| PH1-11 用户模型确认 / User model review | ⏳ Pending | 需要用户确认 Project / Asset / Track / Clip 方向是否符合未来产品。 / User should confirm whether the Project / Asset / Track / Clip direction matches the product vision. |

## 14. 决策日志 / Decision Log

### 2026-06-30

- 确认 ToScreen 的方向不是通用录屏工具或通用剪辑器，而是面向软件产品的 AI 智能宣传视频编辑器。
  Confirmed ToScreen should be an AI product demo video editor, not a generic recorder or generic editor.
- 确认录屏是核心素材，但不是唯一素材；未来会叠加 Lottie、文字、标注、B-roll、音频、3D 运镜和 AI 生成结构。
  Confirmed recordings are core assets but not the only assets; future videos may include Lottie, text, annotation, B-roll, audio, 3D camera, and AI-generated structure.
- 确认编辑器底层需要保留通用多轨时间轴结构，但产品体验必须保持软件宣传视频的垂直聚焦。
  Confirmed the editor needs a universal multi-track timeline underneath, while the product UX remains vertically focused on software demo videos.
- 确认当前先追平 Screen Studio 核心体验是阶段性打地基，不是最终产品定位；后续差异化来自 AI 剪辑、UI 感知动效、Lottie 和 3D 运镜。
  Confirmed that matching Screen Studio's core experience is a foundation phase, not the final positioning; differentiation comes later from AI editing, UI-aware motion, Lottie, and 3D camera work.
- 确认当录屏行为与 UI 源文件同时存在时，ToScreen 应支持 UI-aware Motion Compiler：把 UI 结构、操作行为和 AI 计划编译成可编辑的宣传视频片段。
  Confirmed that when recorded behavior and UI source files are both available, ToScreen should support a UI-aware Motion Compiler that turns UI structure, user actions, and AI plans into editable product-video clips.
- 修正多机位判断：传统影视级多机位导播系统不做，但产品演示场景中的多源画面编排必须支持，包括摄像头、数字人、画中画、分屏和 B-roll。
  Corrected the multi-camera decision: ToScreen will not build a professional film/broadcast switching system, but must support product-demo multi-source composition, including camera, digital human, picture-in-picture, split-screen, and B-roll.
- Phase 1 实机验证更新：新增 `dev:editor` 启动方式，修复 `get-recorded-video-path` 把 `temp_audio_*.mov` 误识别为主视频的问题，并验证真实 `.project.json` 已写入合法 `projectModel`。
  Phase 1 hands-on verification update: added `dev:editor`, fixed `get-recorded-video-path` incorrectly treating `temp_audio_*.mov` as the main video, and verified that a real `.project.json` now writes a valid `projectModel`.
- Phase 1 保存/恢复路径稳定性更新：项目文件定位改为 canonical path 规则，proxy、原始录屏和 encoded `file://` URL 不再各自生成或读取不同的 `.project.json`。
  Phase 1 save/restore path stability update: project file resolution now uses canonical path rules, so proxy paths, raw recording paths, and encoded `file://` URLs no longer create or read different `.project.json` files.
- Phase 1 ProjectModel 恢复更新：`restoreLegacyEditorStateFromProjectModel` 现在会恢复 `companionAudioPath`，避免重启后原始伴随音频身份丢失。
  Phase 1 ProjectModel restore update: `restoreLegacyEditorStateFromProjectModel` now restores `companionAudioPath`, preventing the original companion audio identity from being lost after restart.
