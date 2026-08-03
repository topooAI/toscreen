# ToScreen v0.0.0.34 Baseline

Baseline date: 2026-08-04
Purpose: establish the shared Git baseline for subsequent multi-session and multi-agent development.

## Included scope

- Screen recording restore and proxy generation improvements.
- Native cursor clock, cursor-state capture, smoothing, style packs, and custom cursor assets.
- Auto Focus behavior segmentation and interaction-engine constraints.
- Infinite timeline pan/zoom, magnetic snap, resize safety, playhead mapping, and visual snap feedback.
- Focus and Camera Motion separated into independent timeline lanes and interaction semantics.
- Project-model persistence for cursor, canvas, audio, Focus, Camera Motion, scenes, and future editor entities.
- Editor settings window and persistent defaults.
- Preview/export render-setting alignment, black-tail rendering, and audio-region parity.
- Screen Studio full-feature audit document.

## Baseline verification

| Check | Result |
|---|---|
| TypeScript `tsc --noEmit` | Passed |
| Production Vite build | Passed |
| `npm run audit:phase1` | Passed |
| Interaction engine audit | Passed |
| Cursor clock audit | Passed |
| Cursor variants audit | Passed: 22 states across 6 styles |
| Electron window lifecycle audit | Passed |
| Camera Motion isolation audit | Passed |
| `git diff --check` | Passed |

## Known limitations

- This is a development baseline, not a declaration that Phase 1 user acceptance is released. The acceptance record remains `Not released`; completed user checkpoints are preserved.
- Full-project ESLint is not green. The current run reports 484 existing findings across active source, declarations, legacy backups, and scratch files. This debt is intentionally recorded instead of being hidden or broadly rewritten during baseline integration.
- The Screen Studio feature audit remains the product gap source of truth: 33 capabilities are marked `Completed` and 40 are marked `Not completed`.

## Multi-agent integration rule

All subsequent sessions and agents should branch from tag `v0.0.0.34`. Feature work must use an isolated `codex/*` branch or worktree, include scoped verification evidence, and return a commit SHA for centralized integration. Direct concurrent edits to `main` are not an accepted workflow after this baseline.
