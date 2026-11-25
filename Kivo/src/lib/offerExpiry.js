/**
 * Offer expiry helpers for QR/URL purchase offers.
 *
 * `exp` is a Unix timestamp in seconds (UTC) carried in the offer URL as
 * `?exp=<seconds>`. An offer is expired once `now >= exp`.
 *
 * When offers are signed (#102), `exp` must be part of the signed payload;
 * until then it is a UX guard, not a security control, because anyone can
 * edit the URL. Keep these helpers pure so the signing code can reuse them.
 */

/** Offer validity choices: `value` in seconds, `key` in `t.offer`. */
export const TTL_OPTIONS = [
  { value: 15 * 60,          key: 'ttl15m' },
  { value: 60 * 60,          key: 'ttl1h' },
  { value: 24 * 60 * 60,     key: 'ttl24h' },
  { value: 7 * 24 * 60 * 60, key: 'ttl7d' },
]

export const DEFAULT_TTL_SECONDS = 86400

/** Expiry timestamp (Unix seconds) for an offer created at `nowMs`. */
export function computeExp(nowMs, ttlSeconds) {
  return Math.floor(nowMs / 1000) + ttlSeconds
}

/**
 * Parses the raw `exp` query value. Returns a positive safe integer, or
 * `null` when it is missing or invalid (the offer is then treated as a
 * legacy offer without expiry).
 */
export function parseExp(raw) {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null
  const exp = Number(raw)
  if (!Number.isSafeInteger(exp) || exp <= 0) return null
  return exp
}

/**
 * Whole seconds left until `exp` at `nowMs`, rounded up and never negative.
 * Returns 0 exactly when the offer is expired (`nowMs >= exp * 1000`).
 */
export function secondsRemaining(exp, nowMs) {
  return Math.max(0, Math.ceil((exp * 1000 - nowMs) / 1000))
}

/** Formats seconds as `HH:MM:SS`, or `Nd HH:MM:SS` from one day upwards. */
export function formatRemaining(seconds) {
  const total = Math.max(0, Math.floor(seconds))
  const days  = Math.floor(total / 86400)
  const pad   = n => String(n).padStart(2, '0')
  const hms   = [
    Math.floor((total % 86400) / 3600),
    Math.floor((total % 3600) / 60),
    total % 60,
  ].map(pad).join(':')
  return days > 0 ? `${days}d ${hms}` : hms
}
