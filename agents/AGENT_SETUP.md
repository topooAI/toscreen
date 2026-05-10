# toScreen Agent Setup (Cursor)

This is the practical multi-agent setup for a solo founder/operator.

## Roles

- Planner: scope, priority, acceptance criteria
- Builder: implementation and bug fixing
- Reviewer: code/UX/risk review and release gate
- Shipper: packaging, release checklist, rollback readiness

## Operating Rules

1. Weekly max 3 goals (P0 only)
2. Daily max 3 decisions required from human
3. No new feature starts if P0 stability is failing
4. Release decision: Go / No-Go every Friday

## Handoff Contract

Every agent must output:

- Context: what this task is and why now
- Inputs: files/PRD/constraints
- Changes: what was done
- Risks: unresolved issues
- Next Owner: who takes over next
- Definition of Done: pass/fail checklist

## Cadence

- Morning: Planner brief (5-10 min)
- Build window: Builder execution
- Pre-merge: Reviewer gate
- End of day: Shipper status + release readiness

## Folder Map

- `agents/prompts/*.md`: system prompts for each agent
- `agents/templates/*.md`: handoff + standup templates
- `agents/runbook.md`: day-to-day execution steps
