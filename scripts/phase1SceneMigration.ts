export function summarizeSceneMigration(projectModel: {
  clips?: unknown[];
  scenes?: unknown[];
}) {
  const currentScenes = Array.isArray(projectModel.scenes) ? projectModel.scenes.length : 0;
  const clips = Array.isArray(projectModel.clips) ? projectModel.clips.length : 0;
  const needsDefaultScene = clips > 0 && currentScenes === 0;
  return {
    currentScenes,
    needsDefaultScene,
    expectedAfterNextSave: needsDefaultScene ? 1 : currentScenes,
    evidence: "npm run audit:project-model-default-scene",
    note: needsDefaultScene
      ? "Latest sidecar predates default Scene generation; restoring it in Electron and saving again should add one full-duration demo Scene."
      : "Latest sidecar already has Scene structure or has no clips requiring a default Scene.",
  };
}
