import fs from "node:fs";
import path from "node:path";

const auditPath = path.join(process.cwd(), "docs/product/Screen-Studio-Full-Feature-Audit.md");
const source = fs.readFileSync(auditPath, "utf8");
const rows = [...source.matchAll(/^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*(Completed|Not completed)\s*\|/gm)].map((match) => ({
  id: Number(match[1]),
  feature: match[2].trim(),
  status: match[3] as "Completed" | "Not completed",
}));

const expectedIds = Array.from({ length: 73 }, (_, index) => index + 1);
const actualIds = rows.map((row) => row.id);
const missingIds = expectedIds.filter((id) => !actualIds.includes(id));
const duplicateIds = actualIds.filter((id, index) => actualIds.indexOf(id) !== index);
const incomplete = rows.filter((row) => row.status === "Not completed");

console.log(JSON.stringify({
  auditPath,
  total: rows.length,
  completed: rows.length - incomplete.length,
  notCompleted: incomplete.length,
  missingIds,
  duplicateIds: [...new Set(duplicateIds)],
  incomplete,
}, null, 2));

if (rows.length !== 73 || missingIds.length || duplicateIds.length || incomplete.length) {
  process.exitCode = 1;
}
