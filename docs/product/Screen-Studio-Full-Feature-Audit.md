# TOSCREEN × Screen Studio 全功能审计

审计日期：2026-08-03
审计对象：当前工作区 `/Users/viosson/AITD/1_PROJECTS/P28_TOSCREEN`
对标范围：Screen Studio 官方 Guide 与 Changelog 中公开的录制、编辑、视觉包装、音频、字幕、项目和导出能力。

## 状态口径

| 状态 | 判断标准 |
|---|---|
| Completed | 当前产品已经存在用户可使用的功能闭环，且源码或现有验证能证明核心数据能够进入预览、保存或导出。 |
| Not completed | 完全缺失，或只有按钮、模型字段、底层尝试、局部代码，尚未形成可靠的用户闭环。 |

注意：`Not completed` 不等于“什么都没有”。表格会同时写出当前已经具备的基础和仍缺少的闭环。

## 总览

| 功能域 | Completed | Not completed | 当前判断 |
|---|---:|---:|---|
| 录制系统 | 3 | 9 | 全屏录制主链存在，录制来源和媒体控制仍不完整 |
| 基础剪辑 | 5 | 5 | 可以完成基础剪除与画布裁剪，不是完整多片段剪辑器 |
| Focus 与光标 | 7 | 6 | 已经是当前最完整、最有产品价值的模块 |
| 视觉包装 | 4 | 4 | 常用画布包装已完成，演示增强能力缺失 |
| 音频与字幕 | 4 | 4 | 基础音频轨道可用，字幕和音频生产工具缺失 |
| 项目与预设 | 3 | 4 | 自动保存和恢复已具备，项目管理尚未成型 |
| 导出与分享 | 5 | 4 | 本地 MP4 导出主链存在，发布分享能力缺失 |
| 稳定性与验收 | 2 | 4 | 多项核心契约通过，但当前完整审计仍为红色 |
| **合计** | **33** | **40** | **已有明确编辑器基础，但还不能称为完整 Screen Studio** |

功能数量只是审计索引，不代表每项工作量相等。例如“字幕系统”明显比“增加一个导出选项”更大。

## 1. 录制系统

| # | 功能 | 状态 | 当前已经具备 | 未完成说明 / 验收缺口 |
|---:|---|---|---|---|
| 1 | 整个显示器录制 | Completed | 使用 macOS ScreenCaptureKit 原生录制并生成 MOV | 仍需纳入最终整机回归，但主链已存在 |
| 2 | 原生 60 FPS 录制 | Completed | 录制器默认以 60 FPS 启动 | 后续需要补长时间录制性能基准 |
| 3 | 鼠标、点击与输入事件采集 | Completed | 独立 sidecar 记录鼠标位置、点击和键盘输入事件 | 已能供光标渲染和 Auto Focus 使用 |
| 4 | 单窗口录制 | Not completed | 启动栏可以选择 Window，并能打开来源选择器 | 当前原生录制没有可靠地限制到所选窗口，不能按产品能力验收 |
| 5 | 自定义区域录制 | Not completed | 启动栏已有 Area 入口 | 点击仍是 `Area selection coming soon`，没有区域框选和录制范围传递 |
| 6 | iPhone / iPad 录制 | Not completed | 启动栏已有 Device 入口 | 点击仍是占位逻辑，没有设备发现、预览或录制 |
| 7 | 摄像头录制 | Not completed | 启动栏展示 Camera 状态位置 | 当前固定显示 `No camera`，没有设备选择、画面采集和录制轨 |
| 8 | 麦克风选择、开关和电平 | Not completed | 底层录制器固定尝试包含麦克风 | 用户无法选择设备、开关、查看电平或处理权限失败 |
| 9 | 系统音频选择与开关 | Not completed | 底层录制器固定尝试包含系统音频，录制后可发现伴随音频 | 启动栏无法控制，失败时也没有明确反馈 |
| 10 | 录制倒计时 | Not completed | 有开始录制按钮 | 没有倒计时、准备状态和倒计时取消 |
| 11 | 暂停、继续、重录和取消 | Not completed | 支持开始与停止 | 缺少录制中的完整控制和异常退出恢复 |
| 12 | 录制权限引导 | Not completed | 系统调用会触发相关权限需求 | 没有屏幕、麦克风、摄像头权限状态页和修复路径 |

## 2. 基础剪辑

| # | 功能 | 状态 | 当前已经具备 | 未完成说明 / 验收缺口 |
|---:|---|---|---|---|
| 13 | 导入已有视频 | Completed | 可以从本地视频建立编辑项目 | 仍缺最近项目入口，但单次导入可用 |
| 14 | 播放、暂停、跳转与时间轴缩放 | Completed | 有播放控制、Playhead、滚动缩放和时间映射 | 已有对应时间域与 Seek 验证 |
| 15 | Trim 剪除区间 | Completed | 可以增加、移动、调整和删除 Trim 区间 | 预览和导出共享时间映射 |
| 16 | 画面 Crop | Completed | 有可视化裁剪控件和归一化 Crop 数据 | Crop 能进入项目设置和导出参数 |
| 17 | 输出画幅比例 | Completed | 支持 16:9、9:16、1:1、4:3、4:5 | 已进入项目保存和导出尺寸计算 |
| 18 | 主视频任意 Split | Not completed | Focus 区间可以 Split，Main Track 也能按剪除结果显示片段 | 尚不是用户可在任意位置切开主视频的正式 Split 工具 |
| 19 | 主视频片段重新排序 | Not completed | 项目模型具备多 Clip 扩展基础 | 当前 Main Track 不能自由拖动重排多个视频片段 |
| 20 | 区间变速 | Not completed | 导出器内部存在正常速率播放控制 | 没有 Speed Region、速度控制 UI、时间映射和音频同步闭环 |
| 21 | 自动加速输入过程 | Not completed | 已采集 typing 事件，Auto Focus 会使用输入意图 | typing 事件尚未转换为自动变速区间 |
| 22 | Undo / Redo 编辑历史 | Not completed | 各模块能独立修改状态 | 没有统一命令栈、撤销/重做入口和跨模块历史 |

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
| 30 | Focus 深度完整控制 | Not completed | 已有多档 Zoom 深度和属性面板 | 当前 `screenstudio-control-wiring` 审计认为深度控制契约不完整，修复并实机验收前不能算完成 |
| 31 | Instant Zoom | Not completed | 已有普通 Focus 过渡 | 没有无入场动画的 Instant 模式和切换入口 |
| 32 | Auto Focus 总开关 | Not completed | 可以生成、删除 Focus | 没有清晰的项目级“启用/关闭自动 Focus”设置 |
| 33 | Focus 复制与粘贴 | Not completed | Focus 数据结构可复制 | 没有复制、粘贴、跨项目粘贴交互 |
| 34 | 分段隐藏光标 | Not completed | 光标全局渲染可控 | 没有 Cursor Visibility Region 或区间编辑 |
| 35 | 点击 Ripple、Shockwave 与点击音效 | Not completed | 已采集点击按下状态 | 尚未形成可配置的点击视觉效果和声音效果 |

## 4. 视觉包装

| # | 功能 | 状态 | 当前已经具备 | 未完成说明 / 验收缺口 |
|---:|---|---|---|---|
| 36 | 图片、纯色和渐变背景 | Completed | 三种背景类型均有 UI，预览和导出共享背景数据 | 背景一致性审计通过 |
| 37 | Padding、圆角和阴影 | Completed | Layout 控件和渲染器均有对应参数 | 当前控制契约测试需更新或修复，但核心渲染能力存在 |
| 38 | 背景模糊与运动模糊 | Completed | Preview 和 Export 均有对应效果参数 | 仍需做不同画幅下的视觉回归 |
| 39 | 文字、图片、图形和箭头标注 | Completed | 有 Annotation Track、属性面板、预览与导出渲染 | 已进入项目模型 roundtrip |
| 40 | Mask 敏感信息 | Not completed | 可使用普通图形覆盖内容 | 没有真正的 Blur/Mask 类型、跟随区域和正式导出语义 |
| 41 | Highlight 区域 | Not completed | 项目扩展模型出现了 `highlight` 动作字段 | 没有用户可用的 Highlight 工具、时间线和正式渲染闭环 |
| 42 | 显示键盘快捷键 | Not completed | 录制器已经采集 keydown 事件 | 没有快捷键卡片生成、样式、区间编辑与导出 |
| 43 | 摄像头布局与动态切换 | Not completed | 项目模型有 Camera/Presenter 扩展字段 | 没有摄像头素材、圆形/矩形布局和动态切换闭环 |

## 5. 音频与字幕

| # | 功能 | 状态 | 当前已经具备 | 未完成说明 / 验收缺口 |
|---:|---|---|---|---|
| 44 | 原始录制音频恢复与播放 | Completed | 录制后会发现伴随音频并恢复到项目 | 最新实际录制素材检查通过 |
| 45 | 导入外部音频 | Completed | 可增加独立 Audio Region 并参与时间线 | 支持文件引用和 Blob 恢复 |
| 46 | 音频波形 | Completed | 有波形解析、缓存与时间线展示 | 波形布局已有验证脚本 |
| 47 | 音量与音量包络 | Completed | 音频区域具有音量数据和包络编辑 | Preview/Export 音频设置验证通过 |
| 48 | 麦克风与系统音频独立分轨 | Not completed | 录制器会尝试同时采集两种音频 | 用户无法在录制前分别选择，录制后也没有稳定、明确的双轨产品语义 |
| 49 | 内置背景音乐库 | Not completed | 可以导入自己的音频文件 | 没有内置音乐、试听、分类和授权信息 |
| 50 | 自动语音转录 | Not completed | 项目模型预留了 transcriptId 等字段 | 没有 Whisper 执行、语言选择、进度和错误处理 |
| 51 | 字幕编辑、样式与动画 | Not completed | 项目模型允许 subtitle/caption 扩展类型 | 没有字幕轨、文本编辑器、样式、断句和导出渲染 |

## 6. 项目、设置与预设

| # | 功能 | 状态 | 当前已经具备 | 未完成说明 / 验收缺口 |
|---:|---|---|---|---|
| 52 | 项目自动保存 | Completed | 编辑状态变化后 1 秒 debounce 保存 sidecar | 保存失败会写日志，但缺少用户恢复提示 |
| 53 | 项目模型保存与恢复 | Completed | Focus、Trim、Annotation、Audio、Canvas、Cursor 等可以 roundtrip | 模型 smoke、restore 和 roundtrip 检查通过 |
| 54 | 项目数据校验与兼容结构 | Completed | 有独立 validator、资产、轨道、Clip 与 Scene 模型 | 一部分第二阶段字段仅属于结构预留，不代表功能完成 |
| 55 | Save As 和项目命名 | Not completed | 会在原视频附近保存 sidecar | 没有完整另存为、项目命名和目标文件夹流程 |
| 56 | Recent Projects 项目首页 | Not completed | 启动后可以进入最近录制结果 | 没有成熟的最近项目列表、搜索、删除和丢失素材状态 |
| 57 | 可移植项目包 | Not completed | 项目会记录素材路径 | 仍依赖本机路径，不能可靠打包给另一台设备或另一个用户 |
| 58 | 创建、应用和分享 Preset | Not completed | Settings 可以保存部分新项目默认值 | 默认值不等于完整 Preset；缺少项目级样式快照、应用和分享 |

## 7. 导出与分享

| # | 功能 | 状态 | 当前已经具备 | 未完成说明 / 验收缺口 |
|---:|---|---|---|---|
| 59 | 本地 MP4 导出 | Completed | 使用独立 VideoExporter 编码并保存视频 | 主导出入口验证通过 |
| 60 | 720p、1080p 与 Source 质量 | Completed | Export Dialog 提供 Medium、Good、High 三档 | 还没有完整 FPS、码率和文件大小预估 |
| 61 | 预览与导出核心渲染设置一致 | Completed | 共用 Render Settings，背景、Focus、Cursor、Annotation 等传入导出 | `screenstudio-core-contract` 通过 |
| 62 | 导出音频混合 | Completed | Audio Regions 会进入 Audio Mixer Exporter | Preview/Export 音频设置检查通过 |
| 63 | 导出进度、取消和成功反馈 | Completed | 有进度条、取消按钮、错误和成功状态 | 仍需做大文件实际取消的破坏性回归 |
| 64 | GIF 导出 | Not completed | Annotation 图片允许导入 GIF | 这不等于导出 GIF；当前导出器只提供视频成片 |
| 65 | 批量导出 | Not completed | 单项目可以重复执行导出 | 没有队列、多尺寸、多项目批量导出 |
| 66 | Quick Share、在线链接、私密链接和评论 | Not completed | 本地文件导出完成 | 没有上传服务、链接权限、观看页和评论系统 |
| 67 | 提取原始录制文件 | Not completed | 原始 MOV、代理、音频和 sidecar 存在磁盘上 | 没有面向用户的一键提取或打开资源包入口 |

## 8. 稳定性、运行时与验收

| # | 功能 | 状态 | 当前已经具备 | 未完成说明 / 验收缺口 |
|---:|---|---|---|---|
| 68 | TypeScript 静态检查 | Completed | 当前 `tsc --noEmit` 通过 | 不代表 GUI 和真实媒体路径全部通过 |
| 69 | 项目、时间域、渲染和音频核心契约 | Completed | 多个 Project Model、Duration、Preview/Export、Audio 验证通过 | 这些主要是机器契约验证，不等于用户验收 |
| 70 | 完整 Phase 1 审计 | Not completed | 审计可以运行并通过前面多项检查 | 当前在 `timeline-lane-wrapping` 失败，Camera 与 Focus 轨道结构发生冲突 |
| 71 | Screen Studio 控件 Wiring 审计 | Not completed | 控件组件和底层参数存在 | Zoom、Cursor、Layout 当前未满足既有控制契约 |
| 72 | Electron Editor 直接启动契约 | Not completed | Editor 与 HUD 的返回生命周期检查通过 | 直接 Editor Window 契约检查失败，需先定位当前入口设计是否变更 |
| 73 | 完整真实用户验收 | Not completed | 已有录制素材、项目 sidecar 和机器审计记录 | 尚未完成从录制、编辑、保存、重开到最终导出的整链路用户签字验收 |

## 当前产品边界

当前已经可以完成：

> 全屏录制或导入视频 → 自动/手动 Focus → Trim → Crop/画幅 → 背景与圆角阴影 → 光标美化 → 标注 → 基础音频 → 本地 MP4 导出。

当前还不能稳定完成：

> 自由选择所有录制来源 → 摄像头与音频设备控制 → 完整多片段剪辑与变速 → 字幕 → Mask/Highlight/按键演示 → Preset → 在线分享。

因此，TOSCREEN 不是“所有功能都没完成”。当前已有 **33 项明确完成能力**，尤其是 Focus、光标、画布包装、项目恢复和本地导出已经形成了有价值的编辑器核心；下一步应该补齐 Screen Studio 主线闭环，而不是推翻现有实现。

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
