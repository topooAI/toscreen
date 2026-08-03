# TOSCREEN × Screen Studio 全功能审计

审计日期：2026-08-04
审计对象：当前工作区 `/Users/viosson/AITD/1_PROJECTS/P28_TOSCREEN`
对标范围：Screen Studio 官方 Guide 与 Changelog 中公开的录制、编辑、视觉包装、音频、字幕、项目和导出能力。

当前集成基线：`codex/phase1-integration@72e3eda`

当前工作树说明：自动转录仍处于真实语音验收阶段，相关未提交改动不计入 `Completed`；本表的完成数量只按已提交、已合入和已验证能力统计。

实时更新规则：只有功能已合入集成分支，并由统筹 Session 完成独立验证后，才把对应行更新为 `Completed`；仅在执行 Agent 分支中完成、尚未合入或尚未验证的功能继续保持 `Not completed`。

## 状态口径

| 状态 | 判断标准 |
|---|---|
| Completed | 当前产品已经存在用户可使用的功能闭环，且源码或现有验证能证明核心数据能够进入预览、保存或导出。 |
| Not completed | 完全缺失，或只有按钮、模型字段、底层尝试、局部代码，尚未形成可靠的用户闭环。 |

注意：`Not completed` 不等于“什么都没有”。表格会同时写出当前已经具备的基础和仍缺少的闭环。

## 总览

| 功能域 | Completed | Not completed | 当前判断 |
|---|---:|---:|---|
| 录制系统 | 11 | 1 | Display、Window、Area、Camera、音频设备与录制控制已形成闭环；iPhone/iPad 有线屏幕采集已实现但缺少真机验收 |
| 基础剪辑 | 10 | 0 | Split、删除、重排、变速、自动加速和 Undo/Redo 已进入统一时间映射 |
| Focus 与光标 | 13 | 0 | Focus、光标可见性与点击演示效果已形成完整编辑闭环 |
| 视觉包装 | 8 | 0 | Mask、Highlight、快捷键卡片和 Presenter 摄像头已进入预览与导出 |
| 音频与字幕 | 7 | 1 | 双轨、内置音乐与完整字幕编辑已完成；自动转录等待真实语音端到端验收 |
| 项目与预设 | 7 | 0 | Save As、Recent Projects、便携包与 Preset 均已完成并通过实际文件验收 |
| 导出与分享 | 8 | 1 | MP4、GIF、批量队列与原始素材提取已完成；在线分享仍待正式服务部署 |
| 稳定性与验收 | 5 | 1 | 完整机器审计、控件 Wiring 与 Electron 直接启动契约已恢复绿色；真实用户整链验收仍待完成 |
| **合计** | **69** | **4** | **本地产品主链已基本完成；剩余为真机录屏、自动转录端到端、在线分享部署和最终验收** |

功能数量只是审计索引，不代表每项工作量相等。例如“字幕系统”明显比“增加一个导出选项”更大。

## 1. 录制系统

| # | 功能 | 状态 | 当前已经具备 | 未完成说明 / 验收缺口 |
|---:|---|---|---|---|
| 1 | 整个显示器录制 | Completed | 使用 macOS ScreenCaptureKit 原生录制并生成 MOV | 仍需纳入最终整机回归，但主链已存在 |
| 2 | 原生 60 FPS 录制 | Completed | 录制器默认以 60 FPS 启动 | 后续需要补长时间录制性能基准 |
| 3 | 鼠标、点击与输入事件采集 | Completed | 独立 sidecar 记录鼠标位置、点击和键盘输入事件 | 已能供光标渲染和 Auto Focus 使用 |
| 4 | 单窗口录制 | Completed | 所选 Electron DesktopCapturer Window ID 会传给 ScreenCaptureKit 原生录制器并限制到目标窗口 | `audit:recording-session` 与 Recording contract 已通过 |
| 5 | 自定义区域录制 | Completed | Area 入口提供跨显示器可拖动、可缩放的区域选择框，并传递绝对坐标到原生录制 | 已覆盖负坐标显示器与区域边界 |
| 6 | iPhone / iPad 录制 | Not completed | 已实现 AVFoundation `.external` / `.muxed` 有线设备屏幕发现、状态、预览、录制、取消和 Editor 恢复链；Continuity Camera 不会冒充屏幕源 | universal helper 与无设备运行验证通过，但本机未发现有线 iPhone/iPad，尚缺至少 5 秒真机录制、锁屏/断开和恢复验收 |
| 7 | 摄像头录制 | Completed | 可发现、预览和选择 Camera/Continuity Camera，并生成独立 Presenter Camera 素材和轨道 | Recording 与 Presentation 资产契约已联通 |
| 8 | 麦克风选择、开关和电平 | Completed | 录制启动栏支持麦克风设备选择、开关、电平和权限状态 | 选择结果进入原生录制参数并生成独立麦克风素材 |
| 9 | 系统音频选择与开关 | Completed | 录制前可独立开关系统音频，并在失败时返回明确状态 | 录制结果以独立系统音频素材恢复 |
| 10 | 录制倒计时 | Completed | 开始前提供倒计时、准备状态和取消入口 | 状态与实际录制启动时点分离 |
| 11 | 暂停、继续、重录和取消 | Completed | 原生录制支持分段暂停/继续、取消与重录清理 | 媒体、音频、摄像头和 sidecar 临时文件按同一生命周期处理 |
| 12 | 录制权限引导 | Completed | 显示屏幕、麦克风和摄像头权限状态，并提供请求和打开系统设置的修复路径 | 权限 IPC 与录制启动栏已联通 |

## 2. 基础剪辑

| # | 功能 | 状态 | 当前已经具备 | 未完成说明 / 验收缺口 |
|---:|---|---|---|---|
| 13 | 导入已有视频 | Completed | 可以从本地视频建立编辑项目 | 仍缺最近项目入口，但单次导入可用 |
| 14 | 播放、暂停、跳转与时间轴缩放 | Completed | 有播放控制、Playhead、滚动缩放和时间映射 | 已有对应时间域与 Seek 验证 |
| 15 | Trim 剪除区间 | Completed | 可以增加、移动、调整和删除 Trim 区间 | 预览和导出共享时间映射 |
| 16 | 画面 Crop | Completed | 有可视化裁剪控件和归一化 Crop 数据 | Crop 能进入项目设置和导出参数 |
| 17 | 输出画幅比例 | Completed | 支持 16:9、9:16、1:1、4:3、4:5 | 已进入项目保存和导出尺寸计算 |
| 18 | 主视频任意 Split | Completed | Playhead 可在任意有效位置切开 Main Clip，并保留源时间与项目时间映射 | Editing Session 与产品运行时审计通过 |
| 19 | 主视频片段重新排序 | Completed | Main Clip 支持拖动重排、删除，并按项目顺序生成统一 Render Plan | Preview、时间轴和 Export 共用相同片段顺序 |
| 20 | 区间变速 | Completed | Speed Region 支持创建、移动、缩放和倍率设置，音视频使用统一有效时间映射 | 变速后的项目时长与导出尾部契约通过 |
| 21 | 自动加速输入过程 | Completed | typing 事件会映射到项目时间并生成/更新自动 Speed Region | 输入加速与手工区间共用 Editing Session |
| 22 | Undo / Redo 编辑历史 | Completed | Split、删除、重排和 Speed 命令进入统一 Undo/Redo 历史 | 快捷键、按钮与项目保存状态已联通 |

## 3. Focus 与光标

| # | 功能 | 状态 | 当前已经具备 | 未完成说明 / 验收缺口 |
|---:|---|---|---|---|
| 23 | 根据交互自动生成 Focus | Completed | Auto Focus 能分析点击、输入和拖动意图生成区间 | 已有生成器测试和交互引擎验证 |
| 24 | 手动增加 Focus | Completed | 时间线工具栏和快捷键均可增加 Focus | 可在当前播放位置生成区间 |
| 25 | 移动和调整 Focus 时长 | Completed | 使用统一时间线手势引擎拖动和 Resize | 有边界、防 NaN 和防重叠验证 |
| 26 | 删除 Focus | Completed | 时间线和属性面板均有删除入口 | 删除会同步选中状态 |
| 27 | 分割 Focus | Completed | 可在 Playhead 位置将一个 Focus 分成两段 | 具备最小时长与边界检查 |
| 28 | Focus 磁吸和防重叠 | Completed | 使用像素阈值磁吸，Focus 不能互相重叠 | `timeline-magnetic-snap` 验证通过 |
| 29 | 光标平滑与独立渲染 | Completed | 原生事件时钟、插值、静止噪声处理和遮罩裁切已实现 | Preview 与导出均有独立光标渲染路径 |
| 30 | Focus 深度完整控制 | Completed | 六档 Focus 深度可在属性面板编辑，并进入项目保存、预览与导出 | `audit:screenstudio-control-wiring` 和 `audit:focus-30-35` 通过 |
| 31 | Instant Zoom | Completed | Focus 可切换 Instant 模式，跳过普通入场插值 | 预览与导出使用同一动画语义 |
| 32 | Auto Focus 总开关 | Completed | 提供项目级 Auto Focus 开关并持久化 | 关闭后不会自动生成 Focus，已有手工 Focus 保留 |
| 33 | Focus 复制与粘贴 | Completed | Focus 支持复制、粘贴并在目标时间生成新 ID 区间 | 复制内容经过边界和重叠处理 |
| 34 | 分段隐藏光标 | Completed | Cursor Visibility Region 可新增、拖动、缩放和删除 | 项目模型、时间线、预览和导出已联通 |
| 35 | 点击 Ripple、Shockwave 与点击音效 | Completed | 点击效果支持 Ripple、Shockwave、Pulse 和点击音频 | 样式与声音使用录制点击事件并进入 Preview/Export |

## 4. 视觉包装

| # | 功能 | 状态 | 当前已经具备 | 未完成说明 / 验收缺口 |
|---:|---|---|---|---|
| 36 | 图片、纯色和渐变背景 | Completed | 三种背景类型均有 UI，预览和导出共享背景数据 | 背景一致性审计通过 |
| 37 | Padding、圆角和阴影 | Completed | Layout 控件和渲染器均有对应参数 | 当前控制契约测试需更新或修复，但核心渲染能力存在 |
| 38 | 背景模糊与运动模糊 | Completed | Preview 和 Export 均有对应效果参数 | 仍需做不同画幅下的视觉回归 |
| 39 | 文字、图片、图形和箭头标注 | Completed | 有 Annotation Track、属性面板、预览与导出渲染 | 已进入项目模型 roundtrip |
| 40 | Mask 敏感信息 | Completed | Mask 支持 Blur 与 Cover、位置和尺寸编辑，并可用关键帧跟随区域 | 时间线、画布、属性面板、项目保存和 Export 已联通 |
| 41 | Highlight 区域 | Completed | Highlight 可在画布和时间线创建、移动、缩放与删除 | Preview 和 Export 使用相同高亮渲染 |
| 42 | 显示键盘快捷键 | Completed | 录制 keydown/keyup 会合并为带修饰键快照的快捷键卡片 | 卡片支持区间编辑、保存、预览与导出 |
| 43 | 摄像头布局与动态切换 | Completed | Presenter Camera 使用独立素材和轨道，支持圆形/矩形、Fit、Opacity 与区间切换 | Recording 生成的 `presenter-camera` 可直接恢复到 Presentation |

## 5. 音频与字幕

| # | 功能 | 状态 | 当前已经具备 | 未完成说明 / 验收缺口 |
|---:|---|---|---|---|
| 44 | 原始录制音频恢复与播放 | Completed | 录制后会发现伴随音频并恢复到项目 | 最新实际录制素材检查通过 |
| 45 | 导入外部音频 | Completed | 可增加独立 Audio Region 并参与时间线 | 支持文件引用和 Blob 恢复 |
| 46 | 音频波形 | Completed | 有波形解析、缓存与时间线展示 | 波形布局已有验证脚本 |
| 47 | 音量与音量包络 | Completed | 音频区域具有音量数据和包络编辑 | Preview/Export 音频设置验证通过 |
| 48 | 麦克风与系统音频独立分轨 | Completed | 录制前可分别控制系统音频和麦克风，录制后生成具有明确 role 的独立素材与 Audio Region | Preview、Mixer、Project Model 和 Export 保留双轨语义 |
| 49 | 内置背景音乐库 | Completed | 提供两首项目自有 CC0 WAV、授权与 SHA-256 清单、搜索、分类、试听和加入 Audio Track | 开发与打包资源解析、项目保存和音频混合契约已通过 |
| 50 | 自动语音转录 | Not completed | 本地 macOS Speech helper 已是 arm64+x86_64 universal binary；语言/来源选择、进度、取消和错误处理已合入，两个架构均可实际启动 | 真实语音验收已进入正式 Editor，但 macOS 当前返回 Speech Recognition 未授权/拒绝；允许 ToScreen 语音识别后仍需完成“识别 → 生成字幕 → 编辑 → 保存 → 导出”闭环 |
| 51 | 字幕编辑、样式与动画 | Completed | 独立 Subtitle 时间线行支持选择、拖动、左右 Resize 和删除；面板支持文本、时间、字体、字号、颜色、位置、对齐、Split/Merge 和 Fade/Pop | Timeline、Panel、Project Model、Preview、Export 共用字幕状态；三轮保存恢复幂等和 Preview/Export 契约通过 |

## 6. 项目、设置与预设

| # | 功能 | 状态 | 当前已经具备 | 未完成说明 / 验收缺口 |
|---:|---|---|---|---|
| 52 | 项目自动保存 | Completed | 编辑状态变化后 1 秒 debounce 保存 sidecar | 保存失败会写日志，但缺少用户恢复提示 |
| 53 | 项目模型保存与恢复 | Completed | Focus、Trim、Annotation、Audio、Canvas、Cursor 等可以 roundtrip | 模型 smoke、restore 和 roundtrip 检查通过 |
| 54 | 项目数据校验与兼容结构 | Completed | 有独立 validator、资产、轨道、Clip 与 Scene 模型 | 一部分第二阶段字段仅属于结构预留，不代表功能完成 |
| 55 | Save As 和项目命名 | Completed | 使用 macOS 系统保存对话框选择名称与目录，保存后标题、当前项目路径、自动保存和显式保存均切换到新文件 | 已实际验证覆盖确认、取消不切换路径、旧文件不再写入、退出后从 Recent 重开并恢复真实 MOV 与最新设置 |
| 56 | Recent Projects 项目首页 | Completed | Electron 启动进入 Projects 首页，支持搜索、名称/时间/时长排序、打开、移除、确认删除、缺失/损坏/备份恢复状态和 Relink | 实际 Package Import 后关闭并从 Recent 重开成功；打开项目会恢复包内媒体，不沿用旧全局路径 |
| 57 | 可移植项目包 | Completed | `.toscreenpkg` 包含 Project Model、用户素材、相对清单、SHA-256 与版本；导入先校验并通过临时目录原子迁移 | 实际 MOV 包导入后恢复 screen、proxy、系统音频、麦克风与 Presenter；拒绝 POSIX、Windows drive、UNC 和正反斜杠穿越 |
| 58 | 创建、应用和分享 Preset | Completed | 可创建、更新、删除、应用和设为默认，并支持 `.toscreenpreset` 导入/导出 | Preset 只保存 Canvas、Export、Focus、Cursor、Click、Presentation、Caption 与 Layout 样式，不携带媒体和时间线；合入后 `audit:projects-presets` 通过 |

## 7. 导出与分享

| # | 功能 | 状态 | 当前已经具备 | 未完成说明 / 验收缺口 |
|---:|---|---|---|---|
| 59 | 本地 MP4 导出 | Completed | 使用独立 VideoExporter 编码并保存视频 | 主导出入口验证通过 |
| 60 | 720p、1080p 与 Source 质量 | Completed | Export Dialog 提供 Medium、Good、High 三档 | 还没有完整 FPS、码率和文件大小预估 |
| 61 | 预览与导出核心渲染设置一致 | Completed | 共用 Render Settings，背景、Focus、Cursor、Annotation 等传入导出 | `screenstudio-core-contract` 通过 |
| 62 | 导出音频混合 | Completed | Audio Regions 会进入 Audio Mixer Exporter | Preview/Export 音频设置检查通过 |
| 63 | 导出进度、取消和成功反馈 | Completed | 有进度条、取消按钮、错误和成功状态 | 仍需做大文件实际取消的破坏性回归 |
| 64 | GIF 导出 | Completed | Export Dialog 支持范围、尺寸、FPS、循环、进度、取消、错误和保存，并使用真实 GIF 编码路径 | 独立验收生成 `GIF89a`、160×90、10 帧、1 秒的实际文件 |
| 65 | 批量导出 | Completed | 串行队列支持当前项目、已保存项目和多个 Preset，并持久化任务状态 | 已验证串行执行、失败隔离、重试、取消和应用重启恢复 |
| 66 | Quick Share、在线链接、私密链接和评论 | Not completed | 已在 Topoo Cloudflare 账户创建独立 `toscreen-share` D1 与 `toscreen-share-media` R2，部署 Worker、签名 Secret 和 `share.topoo.ai`；公网 health=200、匿名上传=401；Topoo Auth 入口已按现有 `/github/start` 与 `auth_token` 回调协议修正 | 仍需在正式 Electron 中用真实 Topoo 用户完成登录、视频上传/续传、Public/Unlisted/Private、播放、评论、撤销和重启恢复验收，闭环前不标 Completed |
| 67 | 提取原始录制文件 | Completed | 用户可一键提取 screen、系统音频、麦克风、Presenter、cursor/click sidecar 和真实 project sidecar | 受控 role/type 清单会去重并逐项记录分类、状态、大小和 SHA-256；缺失素材显式报告，代理不会冒充原始文件 |

## 8. 稳定性、运行时与验收

| # | 功能 | 状态 | 当前已经具备 | 未完成说明 / 验收缺口 |
|---:|---|---|---|---|
| 68 | TypeScript 静态检查 | Completed | 当前 `tsc --noEmit` 通过 | 不代表 GUI 和真实媒体路径全部通过 |
| 69 | 项目、时间域、渲染和音频核心契约 | Completed | 多个 Project Model、Duration、Preview/Export、Audio 验证通过 | 这些主要是机器契约验证，不等于用户验收 |
| 70 | 完整 Phase 1 审计 | Completed | `npm run audit:phase1` 在当前集成提交完整返回 `status: ok` | 2026-08-04 独立重跑覆盖 TypeScript、Project Model、Timeline、Recording、Preview/Export 和音频契约 |
| 71 | Screen Studio 控件 Wiring 审计 | Completed | Zoom、Cursor、Background、Layout 与 Motion Blur 控件契约全部通过 | `audit:screenstudio-control-wiring` 返回 `status: ok` |
| 72 | Electron Editor 直接启动契约 | Completed | 开发入口可以直接创建 Editor Window，并保留 Vite HMR、录制恢复和时间轴结构 | `audit:electron-editor-runtime` 返回 `status: ok` |
| 73 | 完整真实用户验收 | Not completed | 已有录制素材、项目 sidecar 和机器审计记录 | 尚未完成从录制、编辑、保存、重开到最终导出的整链路用户签字验收 |

## 当前产品边界

当前集成分支已经可以完成：

> Display / Window / Area 录制或导入视频 → 摄像头与双音轨 → Main Clip Split / 删除 / 重排 / Speed / Undo → 自动/手动 Focus → Cursor 与点击演示 → Mask / Highlight / 快捷键 / Presenter → 画布包装与标注 → 本地 MP4 导出。

当前仍未在集成分支完成：

> iPhone/iPad 屏幕录制 → 内置音乐、自动转录和字幕 → Save As / Recent Projects / 便携项目包 / Preset → GIF / 批量导出 / Quick Share / 原始素材提取 → 最终真实用户整链验收。

当前已有 **69 项明确完成能力**，还有 **4 项** 保持 `Not completed`。Save As、GIF、批量导出和原始素材提取已合入并复验；剩余是 iPhone/iPad 真机录屏、自动转录真实语音端到端、Quick Share 正式服务部署，以及最终真实用户整链验收。

## 第一阶段建议顺序

| 优先级 | 工作包 | 完成标准 |
|---|---|---|
| P0 | 隔离第二阶段 Camera Motion | Camera 使用独立 Track/模型/渲染入口，不再破坏 Focus 审计；未完成前从正式入口隐藏 |
| P0 | 恢复绿色基线 | `audit:phase1`、控件 Wiring、Electron Runtime 全部通过 |
| P0 | 完成录制闭环 | Display、Window、Area、麦克风、系统音频、权限和倒计时均可真实使用 |
| P1 | 完成基础剪辑 | 主视频 Split、删除、重排、Speed、Undo/Redo 形成统一时间映射 |
| P1 | 完成演示增强 | 点击效果、区间隐藏光标、Mask、Highlight、快捷键显示 |
| P1 | 完成字幕 | 本地转录、字幕编辑、样式、时间线与导出一致 |
| P2 | 完成项目产品化 | Save As、Recent Projects、恢复提示、便携项目包、Preset |
| P2 | 完成发布能力 | GIF、批量导出、Quick Share、分享链接和原始文件提取 |

## 对标来源

- Screen Studio Guide: <https://screen.studio/guide>
- Screen Studio Changelog: <https://screen.studio/changelog>
- Captions: <https://preview.screen.studio/guide/captions>
- Background Music: <https://screen.studio/guide/background-music>
- Mask and Highlight: <https://preview.screen.studio/guide/adding-a-mask-and-highlight>
- Presets: <https://preview.screen.studio/guide/creating-preset>
- Shareable Links: <https://preview.screen.studio/guide/shareable-links>
