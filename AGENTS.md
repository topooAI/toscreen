# P28 Coordination Rules

- For multi-agent coordination, acceptance fixes, integration, audits, packaging, or release work, always use `$low-token-coordinator`.
- Keep handoffs under 20 lines and inspect only the target commit, target files, and current branch state.
- Batch 3–5 low-risk narrow fixes before broad audits or packaging. Do not batch crashes, data-loss risks, export correctness, or recovery work.
- Run targeted checks per fix; run the broad suite once per batch. Build `ToScreen.app` once per batch and DMG only at a release checkpoint.
- For UI acceptance, inspect only relevant controls and state changes. Do not emit full accessibility trees unless targeted evidence is unavailable.
- Verify high-risk behavior in a fresh packaged Electron process. Restore user data and generated `dist-electron` files after tests.
- Keep one chat per coherent outcome. Automatic compaction stays in the same chat; start a new chat only at a release baseline, phase boundary, or materially different outcome, after a handoff of at most 12 lines.
- Preserve the project audit vocabulary and status: `Completed` / `Not completed`. Do not change audit or UA totals without evidence and explicit scope.
