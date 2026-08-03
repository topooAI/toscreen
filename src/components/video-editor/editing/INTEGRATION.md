# Editing Session integration contract

The editing engine is intentionally independent of `VideoEditor`, the Project
Model, and the exporter. Integrators should create one `useEditingSession` at
the editor/project boundary and persist its `document` as the Main Track edit
decision list.

## Timeline

- Render `document.clips` in array order. A clip's position is project time;
  its `sourceStartMs/sourceEndMs` remain source time.
- Dispatch `split`, `delete`, `reorder`, `set-speed`, and
  `replace-typing-speed` commands. Bind Cmd/Ctrl-Z and Cmd/Ctrl-Shift-Z to
  `undo` and `redo`.
- Typing automation consumes recorded `keydown` points with source timestamps.
  Before dispatch, translate each timestamp through
  `timeMap.mapSourceToProject` and omit deleted source points.

## Preview, Export, and Audio

- Create one `createEditingRenderPlan(document, sourceDurationMs)` snapshot per
  edit revision.
- Drive all three consumers with effective time. Use `previewSample`,
  `exportSample`, or `audioSample` to obtain the same source seek and playback
  rate. Do not independently reapply legacy trim math.
- The render/export duration is `plan.durationMs`; project overlays use
  project time and source-bound telemetry uses source time.

## Project persistence

- Add `EditingDocument` to the Project Model through its owning session.
- On legacy projects, initialize one full-duration clip and translate normalized
  trim intervals into surviving clips. Until that migration lands, the existing
  two-argument `useTimeMap(trimRegions, sourceDurationMs)` path stays unchanged.
