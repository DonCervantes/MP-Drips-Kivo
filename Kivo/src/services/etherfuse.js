/**
 * Cliente HTTP para la API de Etherfuse FX.
 * Authorization usa la API key directamente, sin prefijo "Bearer".
 *
 * Datos reales del sandbox (obtenidos via MCP):
 *  - customerId  : e6d34608-26b5-4246-89d4-658a227b16ae
 *  - walletId    : 5ca25f69-0fc3-4099-8d44-4575b27d15a9  (plataforma Kivo)
 *  - USDC id     : USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
 */

import { NETWORKS, usdcAssetId } from '../config/networks'

const API_KEY  = import.meta.env.VITE_ETHERFUSE_API_KEY
const BASE_URL = import.meta.env.VITE_ETHERFUSE_BASE_URL || 'https://api.sand.etherfuse.com'

/** Etherfuse sandbox opera solo con USDC de testnet; el ramp está deshabilitado en otras redes. */
export const USDC_STELLAR_ID = usdcAssetId(NETWORKS.testnet)

/** UUID del wallet de la plataforma Kivo registrado en Etherfuse sandbox */
export const KIVO_WALLET_ID = '5ca25f69-0fc3-4099-8d44-4575b27d15a9'

/** UUID de la organización Kivo en Etherfuse sandbox */
export const KIVO_CUSTOMER_ID = 'e6d34608-26b5-4246-89d4-658a227b16ae'

/** @returns {Promise<any>} */
async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: API_KEY,
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
 * Crea una cotización.
 *
 * Shape real del request (descubierto via sandbox):
 * {
 *   quoteId        : string (UUID — idempotency key, generado por el cliente)
 *   customerId     : string (UUID de la organización)
 *   blockchain     : 'stellar'
 *   cryptoWalletId : string (UUID del wallet registrado)
 *   sourceAmount   : string (monto como string, ej. "500")
 *   quoteAssets    : { type: 'onramp'|'offramp', sourceAsset, targetAsset }
 * }
 *
 * Shape real de la respuesta:
 * {
 *   quoteId, blockchain, quoteAssets,
 *   sourceAmount, destinationAmount,   ← (no targetAmount)
 *   exchangeRate, feeBps, feeAmount,
 *   expiresAt, requiresSwap
 * }
 */
export function createQuote({ quoteId, customerId, blockchain, cryptoWalletId, sourceAmount, quoteAssets }) {
  return request('/ramp/quote', {
    method: 'POST',
    body: JSON.stringify({ quoteId, customerId, blockchain, cryptoWalletId, sourceAmount, quoteAssets }),
  })
}

// ── Orders ────────────────────────────────────────────────────────────────────

/**
 * Crea una orden a partir de un quoteId.
 *
 * Request shape real:
 * {
 *   orderId        : string (UUID — idempotency key, generado por el cliente)
 *   quoteId        : string
 *   bankAccountId  : string
 *   cryptoWalletId : string
 * }
 *
 * Response shape real:
 *   Onramp:  { onramp:  { orderId, depositClabe, depositAmount, depositBankName, depositAccountHolder } }
 *   Offramp: { offramp: { orderId, burnTransaction, ... } }
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
