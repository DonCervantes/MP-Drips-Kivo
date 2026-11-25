/**
 * Normaliza la respuesta de createOrder.
 * POST /ramp/order devuelve  { onramp: {...} } o { offramp: {...} }
 * GET  /ramp/order/:id devuelve el objeto plano directamente.
 */
export function normalizeOrder(raw) {
  return raw?.onramp ?? raw?.offramp ?? raw ?? {}
}

export function statusFromOrder(order) {
  const s = (order?.status ?? '').toLowerCase()
  if (s === 'completed') return 'completed'
  if (s === 'failed' || s === 'cancelled') return 'error'
  if (s === 'funded' || s === 'processing') return 'processing'
  if (s === 'created') {
    return order?.depositClabe ? 'awaiting_payment' : 'processing'
  }
  return 'processing'
}
