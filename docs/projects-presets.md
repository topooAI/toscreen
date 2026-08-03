# Projects and Presets runtime contract

## Document state machine

`New Project` clears the process document target before capture or import. The first automatic save uses the legacy media-adjacent sidecar for compatibility; `Save As` establishes an explicit `.toscreen` document target after the native overwrite-confirming dialog succeeds. Subsequent `Save` and debounced autosaves write only that target. `Open` and portable-package import replace the target. Starting another recording, importing a new video, or clearing the active media resets it, so a new recording cannot overwrite the previously opened project.

Every JSON document write uses a sibling temporary file, preserves the last valid file as `.bak`, then renames atomically. Recovery replaces a corrupt primary without rotating the corrupt bytes into the backup. Recent index loading uses the same backup recovery before rebuilding an unreadable index.

## Portable project package

`.toscreenpkg` is a versioned JSON envelope containing the Project Model and user media as base64 payloads with SHA-256 checksums and relative paths. Import rejects absolute paths and `..` traversal, validates every checksum before writing, stages into a temporary directory, and atomically renames the completed project directory. Built-in `/wallpapers`, `toscreen://`, web, blob, and data resources are references, not copied user files.

## Deletion and relink

Removing from Recent never deletes files. Delete defaults to the `.toscreen` document only and keeps source media. The optional source-delete mode is restricted to files beside the project or inside its `assets` directory; shared imports elsewhere are never deleted. Missing project files, corrupt project JSON, and missing referenced media are separate Recent states. Missing media exposes Relink; moved project files can be removed from Recent and reopened from their new location through package/import flows.

## Presets

`.toscreenpreset` contains Canvas/background, layout, focus defaults, cursor/click/presentation/caption style, and export settings. It excludes assets, clips, EditingDocument, scenes, and timeline regions. Apply merges style into the current Project Model and retains media and timeline objects. A default preset applies once to a genuinely new project and never overrides a restored project.
