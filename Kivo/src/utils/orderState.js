/**
 * Normalizes createOrder's wrapped response and getOrder's flat response.
 */
export function normalizeOrder(raw) {
  return raw?.onramp ?? raw?.offramp ?? raw ?? {}
}

export function statusFromOrder(order) {
  const status = (order?.status ?? '').toLowerCase()
  if (status === 'completed') return 'completed'
  if (status === 'failed' || status === 'cancelled') return 'error'
  if (status === 'funded' || status === 'processing') return 'processing'
  if (status === 'created') {
    return order?.depositClabe ? 'awaiting_payment' : 'processing'
  }
  return 'processing'
}