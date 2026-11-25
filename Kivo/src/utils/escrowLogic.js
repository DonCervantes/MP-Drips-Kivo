export function shorten(addr, s = 8, e = 6) {
  if (!addr) return '—'
  return `${addr.slice(0, s)}...${addr.slice(-e)}`
}

export function isMe(addr, walletAddress) {
  return Boolean(addr && walletAddress && addr.toLowerCase() === walletAddress.toLowerCase())
}

/** Devuelve la clave del estado a partir de los flags del escrow */
export function getStatusKey(escrow) {
  const f = escrow?.flags ?? {}
  if (f.released) return 'released'
  if (f.resolved) return 'resolved'
  if (f.disputed) return 'disputed'
  if (f.approved) return 'approved'
  return 'active'
}

/**
 * Flujo single-release:
 *   1. Fondear   (approver,      balance === 0)
 *   2. Aprobar   (approver,      balance > 0 y hito sin aprobar)
 *   3. Liberar   (releaseSigner, balance > 0 y todos los hitos aprobados)
 */
export function getActions(escrow, walletAddress) {
  const flags        = escrow?.flags ?? {}
  const roles        = escrow?.roles ?? {}
  const balance      = Number(escrow?.balance ?? 0)
  const totalAmount  = Number(escrow?.amount ?? 0)
  const addr         = walletAddress?.toLowerCase() ?? ''
  const milestones   = escrow?.milestones ?? []
  const allApproved  = milestones.length > 0 && milestones.every(m => m.approved)
  const fullyFunded  = totalAmount > 0 && balance >= totalAmount

  if (flags.released || flags.resolved) return []

  const actions = []

  if (!fullyFunded && roles.approver?.toLowerCase() === addr)
    actions.push('fund')

  if (fullyFunded && !allApproved && roles.approver?.toLowerCase() === addr)
    actions.push('approve')

  if (fullyFunded && allApproved && roles.releaseSigner?.toLowerCase() === addr)
    actions.push('release')

  return actions
}
