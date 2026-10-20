import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Asset,
  Account,
  TransactionBuilder,
  Networks,
  Operation,
  BASE_FEE,
} from '@stellar/stellar-sdk'
import {
  registerWallet,
  createQuote,
  createOrder,
  getOrder,
  simulateFiatReceived,
  USDC_STELLAR_ID,
} from '../services/etherfuse'
import { useWallet } from '../context/WalletContext'

const POLLING_INTERVAL_MS = 3_000
const QUOTE_TTL_MS = 120_000
const ORDER_STALE_MS = 10 * 60 * 1_000   // 10 min → descartar orden atascada
const HORIZON_TESTNET = 'https://horizon-testnet.stellar.org'
const IS_DEV = import.meta.env.DEV
const LS_KEY = 'kivo_ramp_active_order'

// USDC en Stellar testnet (mismo que USDC_STELLAR_ID)
const [USDC_CODE, USDC_ISSUER] = USDC_STELLAR_ID.split(':')
const USDC_ASSET = new Asset(USDC_CODE, USDC_ISSUER)

/**
 * Verifica que el wallet tenga trustline de USDC.
 * Si no la tiene, construye una tx changeTrust, la firma y la envía a Horizon.
 */
async function ensureUsdcTrustline(walletAddress, signTransaction) {
  const accountRes = await fetch(`${HORIZON_TESTNET}/accounts/${walletAddress}`)
  if (!accountRes.ok) throw new Error('No se pudo obtener la cuenta Stellar.')
  const accountData = await accountRes.json()

  const hasTrustline = accountData.balances?.some(
    b => b.asset_type !== 'native' &&
         b.asset_code === USDC_CODE &&
         b.asset_issuer === USDC_ISSUER
  )
  if (hasTrustline) return

  const stellarAccount = new Account(walletAddress, accountData.sequence)
  const tx = new TransactionBuilder(stellarAccount, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.changeTrust({ asset: USDC_ASSET }))
    .setTimeout(180)
    .build()

  const { signedXdr } = await signTransaction(tx.toXDR())

  const formData = new URLSearchParams({ tx: signedXdr })
  const submitRes = await fetch(`${HORIZON_TESTNET}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  })
  if (!submitRes.ok) {
    const errBody = await submitRes.json().catch(() => ({}))
    const codes = errBody?.extras?.result_codes
    throw new Error(
      codes
        ? `Trustline Stellar: ${codes.transaction} / ops: ${codes.operations?.join(', ')}`
        : `Trustline HTTP ${submitRes.status}`
    )
  }
}

function newUUID() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * Normaliza la respuesta de createOrder.
 * POST /ramp/order devuelve  { onramp: {...} } o { offramp: {...} }
 * GET  /ramp/order/:id devuelve el objeto plano directamente.
 */
function normalizeOrder(raw) {
  return raw?.onramp ?? raw?.offramp ?? raw ?? {}
}

function statusFromOrder(order) {
  const s = (order?.status ?? '').toLowerCase()
  if (s === 'completed') return 'completed'
  if (s === 'failed' || s === 'cancelled') return 'error'
  if (s === 'funded' || s === 'processing') return 'processing'
  if (s === 'created') {
    return order?.depositClabe ? 'awaiting_payment' : 'processing'
  }
  return 'processing'
}

/**
 * Estados del módulo:
 *  idle             → nada activo
 *  creating         → obteniendo quote + creando orden
 *  awaiting_payment → onramp: esperando transferencia SPEI
 *  processing       → en proceso en Etherfuse
 *  completed        → orden completada
 *  error            → algo salió mal
 */
export function useRamp() {
  const [status, setStatus] = useState('idle')
  const [order, setOrder]   = useState(null)
  const [quote, setQuote]   = useState(null)
  const [error, setError]   = useState(null)

  const walletIdCache = useRef({})
  const { walletAddress, signTransaction } = useWallet()
  const pollingRef    = useRef(null)
  const quoteTimerRef = useRef(null)

  // ── helpers ────────────────────────────────────────────────────────────────

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  function startPolling(orderId) {
    stopPolling()
    pollingRef.current = setInterval(async () => {
      try {
        const data = await getOrder(orderId)
        const o = normalizeOrder(data)
        setOrder(o)
        const next = statusFromOrder(o)
        if (next === 'completed') {
          setStatus('completed')
          stopPolling()
          localStorage.removeItem(LS_KEY)
        } else if (next === 'error') {
          setStatus('error')
          setError('La orden falló o fue cancelada.')
          stopPolling()
          localStorage.removeItem(LS_KEY)
        } else {
          setStatus(next)
        }
      } catch (err) {
        console.warn('[useRamp] polling error:', err.message)
      }
    }, POLLING_INTERVAL_MS)
  }

  // ── Retomar orden activa al montar (sobrevive cierres de modal) ────────────
  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY)
    if (!stored) return
    let saved
    try { saved = JSON.parse(stored) } catch { return }

    // Descartar órdenes atascadas más viejas que ORDER_STALE_MS
    if (saved.savedAt && Date.now() - saved.savedAt > ORDER_STALE_MS) {
      localStorage.removeItem(LS_KEY)
      return
    }

    // Fetch status inmediato, luego retomar polling
    getOrder(saved.orderId)
      .then(data => {
        const o = normalizeOrder(data)
        setOrder(o)
        if (saved.quote) setQuote(saved.quote)
        const next = statusFromOrder(o)
        if (next === 'completed' || next === 'error') {
          setStatus(next)
          if (next === 'error') setError('La orden falló o fue cancelada.')
          localStorage.removeItem(LS_KEY)
        } else {
          setStatus(next)
          startPolling(saved.orderId)
        }
      })
      .catch(() => localStorage.removeItem(LS_KEY))

    return stopPolling
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Limpiar polling al desmontar
  useEffect(() => stopPolling, [])

  async function ensureWalletId(address) {
    if (walletIdCache.current[address]) return walletIdCache.current[address]
    const { walletId } = await registerWallet('stellar', address)
    walletIdCache.current[address] = walletId
    return walletId
  }

  function reset() {
    stopPolling()
    if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current)
    localStorage.removeItem(LS_KEY)
    setStatus('idle')
    setOrder(null)
    setQuote(null)
    setError(null)
  }

  // ── ONRAMP  MXN → USDC ────────────────────────────────────────────────────

  const startOnramp = useCallback(async (mxnAmount, bankAccountId) => {
    if (!walletAddress) { setError('Conecta tu wallet primero.'); return }

    reset()
    setStatus('creating')

    try {
      // Garantizar trustline de USDC antes de crear la orden
      await ensureUsdcTrustline(walletAddress, signTransaction)

      const cryptoWalletId = await ensureWalletId(walletAddress)
      const quoteId = newUUID()

      const q = await createQuote({
        quoteId,
        blockchain:    'stellar',
        cryptoWalletId,
        sourceAmount:  String(mxnAmount),
        quoteAssets: {
          type:        'onramp',
          sourceAsset: 'MXN',
          targetAsset: USDC_STELLAR_ID,
        },
      })
      setQuote(q)

      quoteTimerRef.current = setTimeout(() => {
        setError('La cotización expiró. Inicia el proceso de nuevo.')
        stopPolling()
        setStatus('error')
      }, QUOTE_TTL_MS)

      const orderId = newUUID()
      const raw = await createOrder({
        orderId,
        quoteId:       q.quoteId,
        bankAccountId,
        cryptoWalletId,
      })
      const o = normalizeOrder(raw)
      setOrder(o)
      setStatus('awaiting_payment')

      // Persistir para sobrevivir cierres de modal
      localStorage.setItem(LS_KEY, JSON.stringify({ orderId: o.orderId, quote: q, savedAt: Date.now() }))

      if (IS_DEV) {
        await simulateFiatReceived(o.orderId)
        setStatus('processing')
      }

      startPolling(o.orderId)

    } catch (err) {
      setError(err?.message || 'Error desconocido al iniciar el onramp.')
      setStatus('error')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, signTransaction])

  // ── OFFRAMP  USDC → MXN ────────────────────────────────────────────────────

  const startOfframp = useCallback(async (usdcAmount, bankAccountId) => {
    if (!walletAddress) { setError('Conecta tu wallet primero.'); return }

    reset()
    setStatus('creating')

    try {
      const cryptoWalletId = await ensureWalletId(walletAddress)
      const quoteId = newUUID()

      const q = await createQuote({
        quoteId,
        blockchain:    'stellar',
        cryptoWalletId,
        sourceAmount:  String(usdcAmount),
        quoteAssets: {
          type:        'offramp',
          sourceAsset: USDC_STELLAR_ID,
          targetAsset: 'MXN',
        },
      })
      setQuote(q)

      quoteTimerRef.current = setTimeout(() => {
        setError('La cotización expiró. Inicia el proceso de nuevo.')
        stopPolling()
        setStatus('error')
      }, QUOTE_TTL_MS)

      const orderId = newUUID()
      const raw = await createOrder({
        orderId,
        quoteId:       q.quoteId,
        bankAccountId,
        cryptoWalletId,
      })
      const o = normalizeOrder(raw)
      setOrder(o)

      // Persistir antes de firmar (por si la firma tarda)
      localStorage.setItem(LS_KEY, JSON.stringify({ orderId: o.orderId, quote: q, savedAt: Date.now() }))

      const xdr = o.burnTransaction
      if (xdr) {
        const { signedXdr } = await signTransaction(xdr)
        const formData = new URLSearchParams({ tx: signedXdr })
        const horizonRes = await fetch(`${HORIZON_TESTNET}/transactions`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body:    formData.toString(),
        })
        if (!horizonRes.ok) {
          const errBody = await horizonRes.json().catch(() => ({}))
          const codes = errBody?.extras?.result_codes
          throw new Error(
            codes
              ? `Stellar: ${codes.transaction} / ops: ${codes.operations?.join(', ')}`
              : `Stellar HTTP ${horizonRes.status}`
          )
        }

        // En dev: la quema quedó confirmada en Stellar → completar de inmediato
        if (IS_DEV) {
          localStorage.removeItem(LS_KEY)
          setStatus('completed')
          return
        }
      }

      setStatus('processing')
      startPolling(o.orderId)

    } catch (err) {
      setError(err?.message || 'Error desconocido al iniciar el offramp.')
      setStatus('error')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, signTransaction])

  return { status, order, quote, error, startOnramp, startOfframp, reset }
}
