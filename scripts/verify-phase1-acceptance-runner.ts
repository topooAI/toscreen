import assert from 'node:assert/strict'
import fs from 'node:fs'
import { applyExplicitUserAcceptance } from './phase1AcceptanceRecord'
import { parsePhase1AcceptanceState } from './phase1AcceptanceState'
import { parseProductAuditTotals } from './phase1ProductAuditState'

const source = fs.readFileSync('docs/product/Phase1-User-Acceptance-Record.md', 'utf8')
assert.deepEqual(parseProductAuditTotals(fs.readFileSync('docs/product/Screen-Studio-Full-Feature-Audit.md', 'utf8')), { completed: 69, notCompleted: 4 })
assert.throws(() => applyExplicitUserAcceptance(source, { id: 'UA-03', confirmedBy: '', confirmation: 'I ACCEPT UA-03' }), /human signer/)
assert.throws(() => applyExplicitUserAcceptance(source, { id: 'UA-03', confirmedBy: 'User', confirmation: 'machine passed' }), /exactly equal/)
assert.throws(() => applyExplicitUserAcceptance(source, { id: 'UA-08', confirmedBy: 'User', confirmation: 'I RELEASE PHASE 1' }), /blocked until/)
let fixture = source
for (const id of ['UA-01', 'UA-03', 'UA-04', 'UA-05', 'UA-06', 'UA-07']) {
  fixture = applyExplicitUserAcceptance(fixture, { id, confirmedBy: 'Fixture User', confirmation: `I ACCEPT ${id}`, acceptedAt: '2026-08-04T00:00:00.000Z' })
}
assert.equal(parsePhase1AcceptanceState(fixture).phaseReleased, false)
fixture = applyExplicitUserAcceptance(fixture, { id: 'UA-08', confirmedBy: 'Fixture User', confirmation: 'I RELEASE PHASE 1', acceptedAt: '2026-08-04T00:00:00.000Z' })
assert.equal(parsePhase1AcceptanceState(fixture).phaseReleased, true)
assert.match(fixture, /Current phase status: \*\*Released \/ 已放行\*\*/)
console.log('Phase 1 acceptance runner contract: PASS')
