export interface Phase1AcceptanceItem {
  id: string;
  label: string;
}

export interface Phase1AcceptanceState {
  requiredItems: Phase1AcceptanceItem[];
  checkedIds: string[];
  pendingIds: string[];
  unknownCheckedIds: string[];
  currentPhaseStatus: "released" | "not-released" | "unknown";
  userAcceptedItems: number;
  userAcceptanceComplete: boolean;
  phaseReleased: boolean;
}

export const phase1AcceptanceItems: Phase1AcceptanceItem[] = [
  { id: "UA-01", label: "ProjectModel 方向确认" },
  { id: "UA-02", label: "Electron 重启恢复验收" },
  { id: "UA-03", label: "Timeline 手感验收" },
  { id: "UA-04", label: "Screen Studio 核心体验验收" },
  { id: "UA-05", label: "Preview/Export 成片验收" },
  { id: "UA-06", label: "Camera/Focus 操作语言确认" },
  { id: "UA-07", label: "AI 自动剪辑真实用例确认" },
  { id: "UA-08", label: "阶段放行" },
];

export function parsePhase1AcceptanceState(content: string): Phase1AcceptanceState {
  const requiredIds = phase1AcceptanceItems.map((item) => item.id);
  const checkedIds = Array.from(content.matchAll(/\| (UA-\d\d) \|[^\n]+\| \[x\] /g))
    .map((match) => match[1])
    .filter((id, index, ids) => ids.indexOf(id) === index);
  const pendingIds = requiredIds.filter((id) => !checkedIds.includes(id));
  const unknownCheckedIds = checkedIds.filter((id) => !requiredIds.includes(id));
  const currentPhaseStatus = parseCurrentPhaseStatus(content);
  const userAcceptanceComplete = pendingIds.length === 0 && unknownCheckedIds.length === 0;

  return {
    requiredItems: phase1AcceptanceItems,
    checkedIds,
    pendingIds,
    unknownCheckedIds,
    currentPhaseStatus,
    userAcceptedItems: checkedIds.filter((id) => requiredIds.includes(id)).length,
    userAcceptanceComplete,
    phaseReleased: userAcceptanceComplete && currentPhaseStatus === "released",
  };
}

function parseCurrentPhaseStatus(content: string): Phase1AcceptanceState["currentPhaseStatus"] {
  const statusLine = content
    .split("\n")
    .find((line) => line.includes("Current phase status") || line.includes("当前阶段状态"));

  if (!statusLine) return "unknown";
  if (statusLine.includes("Released / 已放行")) return "released";
  if (statusLine.includes("Not released / 未放行")) return "not-released";
  return "unknown";
}
