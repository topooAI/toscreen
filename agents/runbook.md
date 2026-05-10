# toScreen Runbook

## Operating Model
- Human = final decision maker
- Planner = scope and priority
- Builder = implementation
- Reviewer = quality gate
- Shipper = release gate

## Daily Flow
1. Planner posts 3 priorities max
2. Builder executes one scoped task
3. Reviewer checks output
4. Shipper decides release readiness
5. Human approves final decisions

## Weekly Flow
- Monday: set 3 weekly goals
- Tuesday-Thursday: build and review
- Friday: release review and demo

## Rules
- Do not exceed 3 active goals per week
- Do not start new work when a P0 issue is open
- Do not merge without review
- Do not ship without release checklist

## Escalation
Escalate to human when:
- requirements are ambiguous
- tradeoffs affect scope or timeline
- a release blocker is found
- a product decision must be made
