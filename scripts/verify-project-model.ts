import fs from "node:fs";
import path from "node:path";
import { validateVideoEditorProject } from "../src/components/video-editor/project/validateProject.ts";

const projectPath = process.argv[2];

if (!projectPath) {
  console.error("Usage: tsx scripts/verify-project-model.ts <path-to-project.json>");
  process.exit(2);
}

const absolutePath = path.resolve(projectPath);
const raw = fs.readFileSync(absolutePath, "utf8");
const savedProject = JSON.parse(raw);
const projectModel = savedProject.projectModel;

if (!projectModel) {
  console.error(`[ProjectModel] Missing projectModel sidecar in ${absolutePath}`);
  process.exit(1);
}

const result = validateVideoEditorProject(projectModel);

if (!result.valid) {
  console.error(`[ProjectModel] Invalid sidecar in ${absolutePath}`);
  result.errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`[ProjectModel] Valid sidecar in ${absolutePath}`);
console.log(`- assets: ${projectModel.assets.length}`);
console.log(`- tracks: ${projectModel.tracks.length}`);
console.log(`- clips: ${projectModel.clips.length}`);
console.log(`- durationMs: ${projectModel.durationMs}`);

if (result.warnings.length > 0) {
  console.warn("[ProjectModel] Warnings:");
  result.warnings.forEach((warning) => console.warn(`- ${warning}`));
}
