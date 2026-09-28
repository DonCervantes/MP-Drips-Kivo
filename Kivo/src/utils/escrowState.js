const STATUS_BY_KEY = {
  released: { label: 'Liberado', color: 'status-released' },
  resolved: { label: 'Resuelto', color: 'status-resolved' },
  disputed: { label: 'En Disputa', color: 'status-disputed' },
  approved: { label: 'Aprobado', color: 'status-approved' },
  active: { label: 'Activo', color: 'status-active' },
}

export function statusKeyFromEscrow(escrow) {
  const flags = escrow?.flags ?? {}
  if (flags.released) return 'released'
  if (flags.resolved) return 'resolved'
  if (flags.disputed) return 'disputed'
  if (flags.approved) return 'approved'
  return 'active'
}

export function getEscrowStatus(escrow) {
  return STATUS_BY_KEY[statusKeyFromEscrow(escrow)]
}

/**
 * Flujo single-release:
 *   1. Fondear   (approver,      balance === 0)
 *   2. Aprobar   (approver,      balance > 0 y hito sin aprobar)
 *   3. Liberar   (releaseSigner, balance > 0 y todos los hitos aprobados)
 */
export function getActions(escrow, walletAddress) {
  const flags = escrow?.flags ?? {}
  const roles = escrow?.roles ?? {}
  const balance = Number(escrow?.balance ?? 0)
  const totalAmount = Number(escrow?.amount ?? 0)
  const address = walletAddress?.toLowerCase() ?? ''
  const milestones = escrow?.milestones ?? []
  const allApproved = milestones.length > 0 && milestones.every(milestone => milestone.approved)
  const fullyFunded = totalAmount > 0 && balance >= totalAmount

  if (flags.released || flags.resolved) return []

  const actions = []

  if (!fullyFunded && roles.approver?.toLowerCase() === address)
    actions.push('fund')

  if (fullyFunded && !allApproved && roles.approver?.toLowerCase() === address)
    actions.push('approve')

  if (fullyFunded && allApproved && roles.releaseSigner?.toLowerCase() === address)
    actions.push('release')

  return actions
}