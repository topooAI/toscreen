# Project Protocol: P28_TOSCREEN (toScreen)

> **Mission**: Build a Screen Studio style recording and software demo editor with AI-assisted post-production.
> **Core Objective**: To create a leading screen recording and software promo video editing tool.
> **Scope**: Screen recording, AI auto-editing, automatic zooming, and software showcase video production.

## 1. Architecture
* **Base Entity**: [OpenScreen](https://github.com/siddharthvaddem/openscreen) (Electron + React + PixiJS)
* **Agent Source**: `0_SYSTEM/4_AGENTS`
* **Agent Instance**: `1_PROJECTS/P28_TOSCREEN/agents/`

## 2. Product Definition
* **Category**: Screen recording and software demo video editor
* **Benchmark**: Screen Studio
* **Core Value**: Turn raw screen recordings into polished software promo videos with minimal manual editing
* **Key Capabilities**:
  * AI-assisted automatic clipping after recording
  * Automatic zoom and focus based on cursor and action context
  * Software product demo composition and polishing
  * Fast export for product marketing, walkthroughs, and onboarding videos

## 3. Roadmap
* [x] Phase 1: Product architecture and MVP definition (Base: OpenScreen migrated)
* [ ] Phase 2: Recording and timeline editing workflow (Refinement of OpenScreen core)
* [ ] Phase 3: AI auto-editing and smart zoom (Developing cursor-aware logic)
* [ ] Phase 4: Export, presets, and launch
