import fs from "node:fs";
import path from "node:path";
import { parsePhase1AcceptanceState } from "./phase1AcceptanceState";

const docPath = path.join(
  process.cwd(),
  "docs",
  "product",
  "Phase1-User-Acceptance-Record.md",
);

const currentContent = fs.readFileSync(docPath, "utf8");
const currentState = parsePhase1AcceptanceState(currentContent);
const releasedFixture = currentContent
  .replace(/\| (UA-\d\d) \|([^\n]+?)\| \[ \] Pending \|/g, "| $1 |$2| [x] Accepted |")
  .replace("Current phase status: **Not released / 未放行**", "Current phase status: **Released / 已放行**")
  .replace("当前阶段状态 / Current phase status: **Not released / 未放行**", "当前阶段状态 / Current phase status: **Released / 已放行**");
const releasedState = parsePhase1AcceptanceState(releasedFixture);

if (currentState.phaseReleased) {
  fail("Current Phase 1 acceptance record should not be released before user validation.", currentState);
}

if (currentState.userAcceptedItems !== 0 || currentState.pendingIds.length !== 8) {
  fail("Current Phase 1 acceptance record should start with all user checkpoints pending.", currentState);
}

if (!releasedState.phaseReleased || releasedState.userAcceptedItems !== 8 || releasedState.pendingIds.length !== 0) {
  fail("Released acceptance fixture should parse as complete.", releasedState);
}

console.log(JSON.stringify({
  status: "ok",
  current: {
    userAcceptedItems: currentState.userAcceptedItems,
    pendingIds: currentState.pendingIds,
    phaseReleased: currentState.phaseReleased,
  },
  releasedFixture: {
    userAcceptedItems: releasedState.userAcceptedItems,
    pendingIds: releasedState.pendingIds,
    phaseReleased: releasedState.phaseReleased,
  },
}, null, 2));

function fail(message: string, details: unknown): never {
  console.error(JSON.stringify({
    status: "failed",
    message,
    details,
  }, null, 2));
  process.exit(1);
}
