/**
 * Cliente HTTP para la API de Etherfuse FX a través del BFF de Kivo.
 * Las credenciales (API Key) y el ID de organización residen en el servidor
 * y nunca se exponen al navegador.
 */

const BASE_URL = (import.meta.env.VITE_BFF_URL || '') + '/api/etherfuse'

export const USDC_STELLAR_ID =
  'USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'

/** @returns {Promise<any>} */
async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const text = await res.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }

  if (!res.ok) {
    const msg =
      body?.error   ||
      body?.message ||
      (typeof body === 'string' ? body : null) ||
      `HTTP ${res.status}`
    throw new Error(msg)
  }
  return body
}

// ── Wallets ──────────────────────────────────────────────────────────────────

/**
 * Registra un wallet en Etherfuse (idempotente).
 * Si ya existe lo devuelve tal cual.
 * @returns {{ walletId, publicKey, blockchain, kycStatus }}
 */
export function registerWallet(blockchain, publicKey) {
  return request('/ramp/wallet', {
    method: 'POST',
    body: JSON.stringify({ blockchain, publicKey }),
  })
}

/**
 * Lista los wallets registrados para la organización.
 * @returns {{ wallets: Array }}
 */
export function listWallets() {
  return request('/ramp/wallet')
}

// ── Bank Accounts ─────────────────────────────────────────────────────────────

/** @returns {{ items: Array, totalItems: number }} */
export function listBankAccounts() {
  return request('/ramp/bank-accounts')
}

// ── Assets ────────────────────────────────────────────────────────────────────

/**
 * Devuelve los activos disponibles para la dirección Stellar dada.
 * El campo `identifier` de cada asset es el que se usa en quotes.
 */
export function getAssets(walletAddress) {
  return request(
    `/ramp/assets?blockchain=stellar&currency=MXN&wallet=${walletAddress}`
  )
}

// ── Quotes ────────────────────────────────────────────────────────────────────

/**
 * Crea una cotización a través del BFF.
 * customerId es opcional; si no se provee, el BFF inyecta el ID de organización de Kivo.
 */
export function createQuote({ quoteId, customerId, blockchain, cryptoWalletId, sourceAmount, quoteAssets }) {
  const payload = { quoteId, blockchain, cryptoWalletId, sourceAmount, quoteAssets }
  if (customerId) payload.customerId = customerId
  return request('/ramp/quote', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// ── Orders ────────────────────────────────────────────────────────────────────

/**
 * Crea una orden a partir de un quoteId.
 */
export function createOrder({ orderId, quoteId, bankAccountId, cryptoWalletId }) {
  return request('/ramp/order', {
    method: 'POST',
    body: JSON.stringify({ orderId, quoteId, bankAccountId, cryptoWalletId }),
  })
}

/**
 * Obtiene el estado actual de una orden.
 * @returns {{ orderId, status, sourceAmount, targetAmount, depositClabe?, burnTransaction?, ... }}
 */
export function getOrder(orderId) {
  return request(`/ramp/order/${orderId}`)
}

// ── Sandbox only ──────────────────────────────────────────────────────────────

/**
 * Simula la recepción del pago fiat (solo sandbox).
 * Debe llamarse después de crear una orden de onramp en estado 'created'.
 */
export function simulateFiatReceived(orderId) {
  return request('/ramp/order/fiat_received', {
    method: 'POST',
    body: JSON.stringify({ orderId }),
  })
}
