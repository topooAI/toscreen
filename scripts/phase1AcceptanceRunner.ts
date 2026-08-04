import fs from 'node:fs'
import path from 'node:path'
import { buildAcceptancePlan, parseHandsOnSteps } from './phase1AcceptancePlan'
import { parsePhase1AcceptanceState } from './phase1AcceptanceState'
import { applyExplicitUserAcceptance, requiredConfirmation } from './phase1AcceptanceRecord'
import { parseProductAuditTotals } from './phase1ProductAuditState'

const root = process.cwd()
const recordPath = path.join(root, 'docs/product/Phase1-User-Acceptance-Record.md')
const auditPath = path.join(root, 'docs/product/Screen-Studio-Full-Feature-Audit.md')
const args = process.argv.slice(2)
const record = fs.readFileSync(recordPath, 'utf8')

if (!args.includes('--accept')) {
  printSummary(record)
  process.exit(0)
}

const id = value('--accept')
const confirmedBy = value('--confirmed-by')
const confirmation = value('--confirmation')
const note = optionalValue('--note')
if (!id || !confirmedBy || !confirmation) {
  throw new Error('Updating requires --accept UA-XX --confirmed-by NAME --confirmation "I ACCEPT UA-XX". UA-08 requires "I RELEASE PHASE 1".')
}
const updated = applyExplicitUserAcceptance(record, { id, confirmedBy, confirmation, note })
const temporary = `${recordPath}.${process.pid}.tmp`
fs.writeFileSync(temporary, updated, 'utf8')
fs.renameSync(temporary, recordPath)
printSummary(updated)

function printSummary(content: string) {
  const state = parsePhase1AcceptanceState(content)
  const plan = buildAcceptancePlan(state.checkedIds, parseHandsOnSteps(content))
  const audit = fs.readFileSync(auditPath, 'utf8')
  const totals = parseProductAuditTotals(audit)
  console.log(JSON.stringify({
    mode: args.includes('--accept') ? 'explicit-user-update' : 'read-only',
    productAudit: { ...totals, source: 'docs/product/Screen-Studio-Full-Feature-Audit.md' },
    phase: { accepted: state.checkedIds, pending: state.pendingIds, status: state.currentPhaseStatus, released: state.phaseReleased },
    userSignatureBoundary: 'Machine evidence never changes Accepted. Each update requires one UA id, a human signer, and the exact confirmation phrase.',
    releaseBoundary: 'UA-08 requires UA-01..UA-07 Accepted and exact confirmation: I RELEASE PHASE 1.',
    items: plan.map(item => ({ ...item, requiredConfirmation: requiredConfirmation(item.id) })),
  }, null, 2))
}

function value(flag: string) { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : undefined }
function optionalValue(flag: string) { return value(flag) }
