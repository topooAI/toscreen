export function parseProductAuditTotals(content: string) {
  const match = /\| \*\*合计\*\* \| \*\*(\d+)\*\* \| \*\*(\d+)\*\*/.exec(content)
  if (!match) throw new Error('Screen Studio audit total row is missing.')
  return { completed: Number(match[1]), notCompleted: Number(match[2]) }
}
