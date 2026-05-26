# 渲染引擎与坐标系避坑指南 (Rendering Engine & Coordinates)

> **最后更新时间**: 2026-05-17
> **关联模块**: `src/components/video-editor/videoPlayback/` & `src/lib/exporter/`

## 1. 坐标系法则：绝对屏幕坐标 (Absolute Stage Coordinates)
这是 ToScreen 引擎中最核心的数学法则，违背此法则将导致画面被严重偏移、裁切。

- **法则内容**：所有的镜头焦点计算（`focusX`, `focusY`）以及缩放限制，必须且只能基于 **Stage（整个全局画布）的归一化坐标（0.0 ~ 1.0）**。
- **历史血坑**：在早期代码中，`zoomTransform.ts` 错误地将全局坐标乘以了局部蒙版宽度（`baseMask.width`），导致发生“双重偏移”。这使得镜头在平移时，会将画面直接推出屏幕物理边缘之外。
- **代码红线**：禁止在 `zoomTransform.ts` 中使用 `baseMask` 参与 `focusStagePx` 的计算。只能使用 `stageSize.width / height`。

## 2. “所见即所得”与固定机位 (WYSIWYG & Fixed Shots)
- **概念定义**：时间轴（Timeline）上的每一个 Zoom Region 片段，在物理意义上代表一个**不可移动的固定机位**（由绿色的可编辑框定义）。
- **禁止事项**：绝对禁止在自动缩放逻辑中加入任何“动态跟随鼠标（Lazy Follow）”的逻辑。一旦开启动态跟随，镜头的实际画面将与时间轴上定义的绿色框框产生偏差，彻底破坏所见即所得的设计哲学。

## 3. 内存管理：React 严格模式崩溃 (React StrictMode Crash)
- **场景**：当编辑器被挂载/卸载时，特别是 Vite HMR 热更新或 React StrictMode 的双重卸载。
- **历史血坑**：直接调用 `sprite.destroy({ textureSource: true })` 会引发 `Cannot read properties of null (reading 'destroy')` 的致命崩溃，导致全屏白屏。
- **解决规范**：在 `useVideoTexture.ts` 的 `useEffect` 清理函数中：
  1. 必须使用 `!sprite.destroyed` 进行状态前置检查。
  2. 必须包裹在 `try-catch` 块中。
  3. 必须使用温和销毁 `destroy(true)`，将底层共享纹理（VideoResource）的释放交给浏览器 GC 处理。
