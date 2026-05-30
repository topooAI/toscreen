# P28_TOSCREEN Session - 2026-05-30 00:57 (acc9a07b)

## 问题
播放卡顿问题回归 —— 之前花了 6 小时修复的性能问题再次出现。

## 根因分析

### 卡顿的真正根源：`useTimelineContext()` 在 Item 组件中的调用

在 `Item.tsx` 中，有两处致命的 `useTimelineContext()` 调用：
1. `WaveformOverlay` 组件内部（第 11 行）—— 用于计算波形 SVG 的像素定位
2. `ItemComponent` 内部（第 121 行）—— 同样用于像素计算

**为什么这会导致卡顿？**

`useTimelineContext()` 是一个 React Context hook。当播放指针移动时，Timeline 的 context 值（`range`、`valueToPixels` 等）每帧都在变化。React 的规则是：**当 context 值变化时，所有订阅了该 context 的组件都会被强制重渲染，完全绕过 `React.memo`！**

所以即使 Item 外层包了 `React.memo` + 自定义比较函数，也完全无效——因为内部的 `useTimelineContext()` 让组件直接绕过了 memo 屏障。

### 次要问题
- `useAudioWaveform` 在 Item 的第 142 行被**重复调用**（仅为获取 `durationMs`）
- 双重 `React.memo` 包装（第 303 行和第 315 行各包了一次）
- `MutationObserver` 的 DOM 操作在拖拽时也会触发额外的渲染

## 修复方案

### 1. Item.tsx — 彻底移除 `useTimelineContext()` 调用
- `WaveformOverlay` 改为纯 CSS 百分比定位（`left: -sourceStartMs/itemDurationMs * 100%`），完全不依赖 `valueToPixels`
- `ItemComponent` 不再调用 `useTimelineContext()`
- 移除重复的 `useAudioWaveform` 调用
- 合并双重 `React.memo` 为单一的 `memo(ItemComponent, arePropsEqual)`

### 2. useWaveformCache.ts — 新增集中式波形缓存 hook
- 在 Timeline 层级统一加载波形数据
- 通过 props 传给 Item（`waveformPeaks` / `waveformDurationMs`）

### 3. TimelineEditor.tsx — 音频拖拽最大时长限制
- 在 `handleItemSpanChange` 中为音频片段添加基于 `totalDurationMs` 的最大时长限制
- 防止拖拽超过音频文件实际长度

## 修改的文件
- `src/components/video-editor/timeline/Item.tsx` — 重写
- `src/components/video-editor/hooks/useWaveformCache.ts` — 新增
- `src/components/video-editor/timeline/TimelineEditor.tsx` — 添加波形缓存和音频限制

## 备份
- `scratch/Item.tsx.bak.20260530_005820`
