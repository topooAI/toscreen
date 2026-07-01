import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface ProjectAssetFileAudit {
  checked: Array<{
    assetId: string;
    type: string;
    path: string;
  }>;
  skipped: Array<{
    assetId: string;
    type: string;
    source: string;
    reason: string;
  }>;
  missing: Array<{
    assetId: string;
    type: string;
    path: string;
  }>;
}

export async function auditProjectAssetFiles(project: {
  assets?: Array<{
    id?: string;
    type?: string;
    sourceUrl?: string;
    filePath?: string;
  }>;
}): Promise<ProjectAssetFileAudit> {
  const checked: ProjectAssetFileAudit["checked"] = [];
  const skipped: ProjectAssetFileAudit["skipped"] = [];
  const missing: ProjectAssetFileAudit["missing"] = [];

  for (const asset of project.assets ?? []) {
    const assetId = asset.id || "(missing id)";
    const type = asset.type || "(missing type)";
    const source = asset.filePath || asset.sourceUrl || "";
    const localPath = localFilePathFromAssetSource(source);

    if (!source) {
      skipped.push({ assetId, type, source, reason: "no source path" });
      continue;
    }

    if (!localPath) {
      skipped.push({ assetId, type, source, reason: "non-local source" });
      continue;
    }

    if (await pathExists(localPath)) {
      checked.push({ assetId, type, path: localPath });
    } else {
      missing.push({ assetId, type, path: localPath });
    }
  }

  return { checked, skipped, missing };
}

export function summarizeMissingAssetFiles(assetFiles: ProjectAssetFileAudit) {
  return assetFiles.missing.map((asset) => `${asset.assetId} -> ${asset.path}`).join(", ");
}

function localFilePathFromAssetSource(source: string) {
  if (!source) return null;
  if (source.startsWith("file://")) {
    try {
      return fileURLToPath(source);
    } catch {
      return source.replace(/^file:\/\//, "");
    }
  }
  if (path.isAbsolute(source)) {
    return source;
  }
  return null;
}

function pathExists(filePath: string) {
  return fs.access(filePath).then(() => true).catch(() => false);
}
