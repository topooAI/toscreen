import { parsePhase1AcceptanceState, phase1AcceptanceItems } from './phase1AcceptanceState'

export type UserAcceptanceRequest = {
  id: string
  confirmedBy: string
  confirmation: string
  note?: string
  acceptedAt?: string
}

export function requiredConfirmation(id: string) {
  return id === 'UA-08' ? 'I RELEASE PHASE 1' : `I ACCEPT ${id}`
}

export function applyExplicitUserAcceptance(content: string, request: UserAcceptanceRequest): string {
  if (!phase1AcceptanceItems.some(item => item.id === request.id)) throw new Error(`Unknown acceptance id: ${request.id}`)
  if (!request.confirmedBy.trim()) throw new Error('A human signer is required; machine evidence cannot supply confirmedBy.')
  const expected = requiredConfirmation(request.id)
  if (request.confirmation !== expected) throw new Error(`Explicit confirmation must exactly equal: ${expected}`)
  const before = parsePhase1AcceptanceState(content)
  if (before.checkedIds.includes(request.id)) throw new Error(`${request.id} is already Accepted.`)
  if (request.id === 'UA-08') {
    const prerequisites = phase1AcceptanceItems.slice(0, 7).map(item => item.id)
    const pending = prerequisites.filter(id => !before.checkedIds.includes(id))
    if (pending.length) throw new Error(`UA-08 is blocked until UA-01..UA-07 are Accepted. Pending: ${pending.join(', ')}`)
  }

  const safeSigner = oneLine(request.confirmedBy)
  const safeNote = oneLine(request.note || 'Explicit hands-on acceptance recorded by the user.')
  const acceptedAt = request.acceptedAt || new Date().toISOString()
  let found = false
  const lines = content.split('\n').map(line => {
    if (!line.startsWith(`| ${request.id} |`)) return line
    const cells = line.split('|')
    if (cells.length < 8 || cells[5].trim() !== '[ ] Pending') return line
    cells[5] = ' [x] Accepted '
    cells[6] = ` ${acceptedAt} · User: ${safeSigner} · ${safeNote} `
    found = true
    return cells.join('|')
  })
  if (!found) throw new Error(`Pending checklist row not found for ${request.id}.`)
  let updated = lines.join('\n')
  if (request.id === 'UA-08') {
    updated = updated.replace('**Not released / 未放行**', '**Released / 已放行**')
  }
  const after = parsePhase1AcceptanceState(updated)
  if (request.id === 'UA-08' && !after.phaseReleased) throw new Error('Release invariant failed: UA-08 did not produce a fully released record.')
  if (request.id !== 'UA-08' && after.currentPhaseStatus === 'released') throw new Error('A non-gate acceptance cannot release Phase 1.')
  return updated
}

function oneLine(value: string) {
  return value.replace(/[|\r\n]+/g, ' ').trim()
}
