import { phase1AcceptanceItems } from "./phase1AcceptanceState";

export type HandsOnStep = {
  id: string;
  label: string;
  step: string;
  failureNote: string;
};

export type AcceptancePlanItem = HandsOnStep & {
  status: "accepted" | "pending";
  machineEvidence: string[];
};

export const machineEvidenceByAcceptanceId: Record<string, string[]> = {
  "UA-01": [
    "npm run audit:project-model-review-doc",
    "npm run audit:project-model-review-packet",
  ],
  "UA-02": [
    "npm run audit:recordings",
    "npm run audit:project-model-restore",
    "npm run audit:project-model-sidecar-parity",
  ],
  "UA-03": [
    "npm run audit:timeline-acceptance-doc",
    "npm run audit:timeline-lane-wrapping",
    "npm run audit:timeline-drag-safety",
    "npm run audit:electron-editor-runtime",
  ],
  "UA-04": [
    "npm run audit:screenstudio-core-contract",
    "npm run audit:electron-editor-runtime",
  ],
  "UA-05": [
    "npm run audit:preview-export-contract",
    "npm run audit:export-duration-render-settings",
    "npm run audit:export-black-tail-rendering",
  ],
  "UA-06": [
    "npm run audit:project-model-camera",
    "npm run audit:project-model-camera-migration",
  ],
  "UA-07": [
    "npm run audit:project-model-ai-plan",
    "npm run audit:project-model-ai-plan-lifecycle",
  ],
  "UA-08": [
    "npm run audit:phase1-readiness",
    "npm run audit:phase1-acceptance-state",
  ],
};

export function parseHandsOnSteps(content: string): HandsOnStep[] {
  const itemById = new Map(phase1AcceptanceItems.map((item) => [item.id, item]));
  const sectionStart = content.indexOf("### 3.1 实机验收步骤 / Hands-On Acceptance Steps");
  if (sectionStart < 0) return [];
  const nextSectionStart = content.indexOf("\n## 4.", sectionStart);
  const section = nextSectionStart >= 0
    ? content.slice(sectionStart, nextSectionStart)
    : content.slice(sectionStart);
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("| UA-"))
    .map((line) => line.split("|").map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 4)
    .map((cells) => ({
      id: cells[1],
      step: cells[2],
      failureNote: cells[3],
    }))
    .filter(({ id, step, failureNote }) => (
      itemById.has(id) &&
      step.length > 0 &&
      failureNote.length > 0 &&
      step !== "实机步骤 / Hands-On Step" &&
      failureNote !== "失败记录 / Failure Note"
    ))
    .map(({ id, step, failureNote }) => ({
      id,
      label: itemById.get(id)?.label ?? id,
      step,
      failureNote,
    }));
}

export function buildAcceptancePlan(
  checkedIds: string[],
  handsOnSteps: HandsOnStep[],
): AcceptancePlanItem[] {
  const stepById = new Map(handsOnSteps.map((step) => [step.id, step]));
  return phase1AcceptanceItems.map((item) => {
    const step = stepById.get(item.id);
    return {
      id: item.id,
      label: item.label,
      status: checkedIds.includes(item.id) ? "accepted" : "pending",
      step: step?.step ?? "",
      failureNote: step?.failureNote ?? "",
      machineEvidence: machineEvidenceByAcceptanceId[item.id] ?? [],
    };
  });
}

export function validateAcceptancePlanEvidence(
  acceptancePlan: AcceptancePlanItem[],
  scripts: Record<string, string>,
) {
  const errors: string[] = [];
  const expectedIds = phase1AcceptanceItems.map((item) => item.id);
  const planIds = acceptancePlan.map((item) => item.id);
  const missingPlanIds = expectedIds.filter((id) => !planIds.includes(id));
  if (missingPlanIds.length > 0) {
    errors.push(`Acceptance plan is missing items for: ${missingPlanIds.join(", ")}`);
  }

  for (const item of acceptancePlan) {
    if (item.step.length === 0 || item.failureNote.length === 0) {
      errors.push(`Acceptance plan item ${item.id} is missing a hands-on step or failure note.`);
    }
    if (item.machineEvidence.length === 0) {
      errors.push(`Acceptance plan item ${item.id} has no machine evidence commands.`);
    }
    for (const command of item.machineEvidence) {
      const match = /^npm run ([\w:-]+)$/.exec(command);
      if (!match) {
        errors.push(`Acceptance plan item ${item.id} has unsupported evidence command: ${command}`);
        continue;
      }
      const scriptName = match[1];
      if (!scripts[scriptName]) {
        errors.push(`Acceptance plan item ${item.id} references missing npm script: ${scriptName}`);
      }
    }
  }

  return errors;
}
