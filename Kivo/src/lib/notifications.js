/**
 * Lógica pura de notificaciones de estado (sin React ni navegador).
 *
 * Compara la "foto" anterior de cada escrow con la que devuelve el indexer
 * de Trustless Work y genera un evento por cada cambio relevante para
 * comprador y vendedor.
 */

export const ESCROW_EVENTS = [
  'escrowCreated',      // escrow nuevo, listo para fondear
  'fundsReceived',      // el escrow ya tiene saldo
  'milestoneApproved',  // el comprador aprobó el hito
  'fundsReleased',      // fondos liberados al vendedor
  'disputeOpened',
  'disputeResolved',
]

export const RAMP_EVENTS = ['rampCompleted', 'rampFailed']

export const MAX_NOTIFICATIONS = 50

/** Clave estable de un escrow (igual que la deduplicación de useMyEscrows) */
export function escrowKey(escrow) {
  return escrow?.contractId || escrow?.engagementId || null
}

/** Reduce un escrow del indexer a los flags que nos interesan */
export function snapshotEscrow(escrow) {
  const f = escrow?.flags ?? {}
  const milestones = Array.isArray(escrow?.milestones) ? escrow.milestones : []
  return {
    funded:   Number(escrow?.balance ?? 0) > 0,
    approved: Boolean(f.approved) || milestones.some(m => m?.approved || m?.flags?.approved),
    released: Boolean(f.released) || milestones.some(m => m?.flags?.released),
    disputed: Boolean(f.disputed) || milestones.some(m => m?.flags?.disputed),
    resolved: Boolean(f.resolved) || milestones.some(m => m?.flags?.resolved),
  }
}

/**
 * Eventos producidos al pasar de `prev` a `next`.
 * `prev` undefined → el escrow es nuevo para este usuario.
 */
export function diffEscrowSnapshot(prev, next) {
  if (!next) return []
  if (!prev) {
    // Escrow nuevo: avisar que está listo para fondear sólo si aún no tiene saldo
    // y no está cerrado; si ya avanzó, avisamos el estado más reciente.
    if (next.released) return ['fundsReleased']
    if (next.resolved) return ['disputeResolved']
    if (next.disputed) return ['disputeOpened']
    if (next.approved) return ['milestoneApproved']
    if (next.funded)   return ['fundsReceived']
    return ['escrowCreated']
  }

  const events = []
  if (!prev.funded   && next.funded)   events.push('fundsReceived')
  if (!prev.approved && next.approved) events.push('milestoneApproved')
  if (!prev.disputed && next.disputed) events.push('disputeOpened')
  if (!prev.resolved && next.resolved) events.push('disputeResolved')
  if (!prev.released && next.released) events.push('fundsReleased')
  return events
}

/**
 * Compara la lista completa de escrows contra las fotos guardadas.
 *
 * Si `baseline` es true (primera carga para esta wallet/red) sólo se
 * guardan las fotos y no se generan eventos, para no inundar al usuario
 * con el historial completo.
 *
 * @returns {{ snapshots: Object, events: Array<{type, key, title, amount, symbol, role}> }}
 */
export function diffEscrows(prevSnapshots, escrows, walletAddress, { baseline = false } = {}) {
  const snapshots = { ...(prevSnapshots ?? {}) }
  const events = []

  for (const escrow of escrows ?? []) {
    const key = escrowKey(escrow)
    if (!key) continue
    const next = snapshotEscrow(escrow)
    if (!baseline) {
      for (const type of diffEscrowSnapshot(snapshots[key], next)) {
        events.push({
          type,
          key,
          title:  escrow.title || '',
          amount: escrow.amount ?? null,
          symbol: escrow.trustline?.symbol ?? 'USDC',
          role:   escrowRole(escrow, walletAddress),
        })
      }
    }
    snapshots[key] = next
  }

  return { snapshots, events }
}

/** 'buyer' | 'seller' | 'other' — sólo para elegir el texto adecuado */
export function escrowRole(escrow, walletAddress) {
  const addr = walletAddress?.toLowerCase()
  const r = escrow?.roles ?? {}
  if (!addr) return 'other'
  if (r.approver?.toLowerCase() === addr) return 'buyer'
  if (r.serviceProvider?.toLowerCase() === addr || r.receiver?.toLowerCase() === addr) return 'seller'
  return 'other'
}

/** Evento de rampa a partir del estado de useRamp; null si no aplica */
export function rampEvent(status, order) {
  if (status !== 'completed' && status !== 'error') return null
  const id = order?.orderId
  return {
    type:   status === 'completed' ? 'rampCompleted' : 'rampFailed',
    key:    id ? `ramp:${id}` : `ramp:${Date.now()}`,
    title:  '',
    amount: order?.amount ?? order?.sourceAmount ?? null,
    symbol: null,
    role:   'other',
  }
}

/**
 * Agrega eventos a la lista de notificaciones (más reciente primero),
 * ignorando duplicados (mismo tipo + clave) y recortando a MAX_NOTIFICATIONS.
 */
export function appendNotifications(list, events, now = Date.now()) {
  const current = Array.isArray(list) ? list : []
  const seen = new Set(current.map(n => `${n.type}:${n.key}`))
  const fresh = []
  for (const ev of events ?? []) {
    const id = `${ev.type}:${ev.key}`
    if (seen.has(id)) continue
    seen.add(id)
    fresh.push({ ...ev, id, createdAt: now, read: false })
  }
  if (fresh.length === 0) return current
  return [...fresh.reverse(), ...current].slice(0, MAX_NOTIFICATIONS)
}

/** Sustituye {placeholders} en un texto traducido */
export function formatMessage(template, vars) {
  return String(template ?? '').replace(/\{(\w+)\}/g, (_, k) => (vars?.[k] ?? ''))
}
