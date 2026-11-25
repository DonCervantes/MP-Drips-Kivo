/**
 * Pure reputation calculation helpers for Kivo.
 * Only finalized escrows (released or resolved) are included.
 */

/** Returns true when an escrow has reached a finalized terminal state. */
export function isFinalizedEscrow(escrow) {
  const f = escrow?.flags ?? {}
  return Boolean(f.released || f.resolved)
}

/** Returns true when a finalized escrow involved a dispute. */
export function isDisputedEscrow(escrow) {
  const f = escrow?.flags ?? {}
  return Boolean(f.disputed || f.resolved)
}

/** Converts Firestore timestamps, epoch numbers, or ISO strings to ms. */
export function toMillis(ts) {
  if (ts == null) return null
  if (typeof ts === 'number') {
    if (!Number.isFinite(ts) || ts <= 0) return null
    return ts < 1e12 ? ts * 1000 : ts
  }
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts)
    return Number.isNaN(parsed) ? null : parsed
  }
  if (typeof ts === 'object') {
    const sec = ts._seconds ?? ts.seconds
    if (typeof sec === 'number' && Number.isFinite(sec)) {
      const nano = ts._nanoseconds ?? ts.nanoseconds ?? 0
      return sec * 1000 + Math.floor(nano / 1e6)
    }
  }
  return null
}

/** Checks whether walletAddress matches the given roleFilter in an escrow. */
function matchesRole(escrow, walletAddress, roleFilter) {
  if (!walletAddress) return true
  const addr = walletAddress.toLowerCase()
  const r = escrow?.roles ?? {}
  const isBuyer = r.approver?.toLowerCase() === addr
  const isSeller = r.serviceProvider?.toLowerCase() === addr

  if (roleFilter === 'buyer') return isBuyer
  if (roleFilter === 'seller') return isSeller
  return isBuyer || isSeller
}

/**
 * Computes basic reputation metrics for a walletAddress from finalized escrows.
 * @param {Array} escrows
 * @param {string} walletAddress
 * @param {'all'|'buyer'|'seller'} roleFilter
 */
export function computeReputation(escrows = [], walletAddress = '', roleFilter = 'all') {
  const finalizedEscrows = (Array.isArray(escrows) ? escrows : []).filter(
    e => isFinalizedEscrow(e) && matchesRole(e, walletAddress, roleFilter),
  )

  const completedCount = finalizedEscrows.length
  let totalVolume = 0
  let disputedCount = 0
  let releasedCount = 0
  let resolvedCount = 0
  let releaseDurationSum = 0
  let releaseDurationCount = 0

  for (const e of finalizedEscrows) {
    const amount = Number(e?.amount ?? 0)
    if (Number.isFinite(amount) && amount > 0) {
      totalVolume += amount
    }

    if (e?.flags?.released) releasedCount += 1
    if (e?.flags?.resolved) resolvedCount += 1
    if (isDisputedEscrow(e)) disputedCount += 1

    if (e?.flags?.released) {
      const startMs = toMillis(e.createdAt)
      const endMs = toMillis(e.releasedAt ?? e.updatedAt)
      if (startMs != null && endMs != null && endMs >= startMs) {
        releaseDurationSum += endMs - startMs
        releaseDurationCount += 1
      }
    }
  }

  const disputeRate = completedCount > 0 ? (disputedCount / completedCount) * 100 : 0
  const avgReleaseTimeMs =
    releaseDurationCount > 0 ? releaseDurationSum / releaseDurationCount : null

  return {
    completedCount,
    releasedCount,
    resolvedCount,
    disputedCount,
    disputeRate,
    totalVolume,
    avgReleaseTimeMs,
    finalizedEscrows,
  }
}

/** Formats a USDC volume amount cleanly. */
export function formatVolume(volume) {
  const num = Number(volume ?? 0)
  if (!Number.isFinite(num) || num <= 0) return '0'
  return num.toLocaleString(undefined, {
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

/** Formats a duration in milliseconds into a concise human-readable string. */
export function formatDuration(ms, units = { min: 'min', hour: 'h', day: 'd' }) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '—'
  const minutes = ms / 60000
  if (minutes < 1) return `< 1 ${units.min}`
  if (minutes < 60) return `${Math.round(minutes)} ${units.min}`
  const hours = minutes / 60
  if (hours < 24) return `${hours.toFixed(1).replace(/\.0$/, '')} ${units.hour}`
  const days = hours / 24
  return `${days.toFixed(1).replace(/\.0$/, '')} ${units.day}`
}
