import { useCallback, useEffect, useRef, useState } from 'react'
import {
  useGetEscrowsFromIndexerBySigner,
  useGetEscrowsFromIndexerByRole,
} from '@trustless-work/escrow/hooks'
import { useWallet } from './WalletContext'
import { useNetwork } from './NetworkContext'
import { fetchEscrowsForWallet } from '../hooks/useMyEscrows'
import { appendNotifications, diffEscrows } from '../lib/notifications'
import { NotificationsContext } from '../hooks/useNotifications'

const POLL_INTERVAL_MS = 30_000
const LS_PREFIX = 'kivo_notifications'

const EMPTY_STORE = { snapshots: {}, items: [], baselined: false }

function storageKey(network, walletAddress) {
  return `${LS_PREFIX}:${network}:${walletAddress}`
}

function loadStore(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return EMPTY_STORE
    const parsed = JSON.parse(raw)
    return {
      snapshots: parsed?.snapshots ?? {},
      items:     Array.isArray(parsed?.items) ? parsed.items : [],
      baselined: Boolean(parsed?.baselined),
    }
  } catch {
    return EMPTY_STORE
  }
}

function saveStore(key, store) {
  try {
    localStorage.setItem(key, JSON.stringify(store))
  } catch {
    // Almacenamiento lleno o bloqueado: las notificaciones siguen en memoria
  }
}

/**
 * Notificaciones in-app de cambios de estado.
 *
 * - Escrows: consulta periódicamente el indexer de Trustless Work (el mismo
 *   que usa "Mis Escrows") y compara contra la última foto guardada por
 *   wallet + red. No se agregan API keys nuevas al navegador.
 * - Ramp: useRamp llama a `notify()` cuando una orden termina o falla.
 *
 * La primera carga de una wallet sólo guarda la foto (sin notificar el
 * historial). Todo vive en localStorage; el envío por email/WhatsApp
 * requerirá un backend propio.
 */
export function NotificationsProvider({ children }) {
  const { walletAddress } = useWallet()
  const { network } = useNetwork()

  const key = walletAddress ? storageKey(network, walletAddress) : null
  const [state, setState] = useState(() => ({ key, store: key ? loadStore(key) : EMPTY_STORE }))

  // Al cambiar de wallet o de red se carga lo guardado para esa combinación
  // (ajuste de estado durante el render, sin efecto intermedio)
  if (state.key !== key) {
    setState({ key, store: key ? loadStore(key) : EMPTY_STORE })
  }
  const store = state.key === key ? state.store : EMPTY_STORE

  // Refs para los callbacks asíncronos (polling / notify)
  const storeRef = useRef(store)
  const keyRef   = useRef(key)
  useEffect(() => {
    storeRef.current = state.store
    keyRef.current   = state.key
  }, [state])

  const { getEscrowsBySigner } = useGetEscrowsFromIndexerBySigner()
  const { getEscrowsByRole }   = useGetEscrowsFromIndexerByRole()
  // Mismas refs que useMyEscrows: el SDK devuelve funciones nuevas cada render
  const signerRef = useRef(getEscrowsBySigner)
  const roleRef   = useRef(getEscrowsByRole)
  useEffect(() => {
    signerRef.current = getEscrowsBySigner
    roleRef.current   = getEscrowsByRole
  })

  const commit = useCallback((next) => {
    const k = keyRef.current
    if (!k) return
    storeRef.current = next
    setState(prev => (prev.key === k ? { key: k, store: next } : prev))
    saveStore(k, next)
  }, [])

  const refresh = useCallback(async () => {
    if (!walletAddress) return
    const requestKey = key
    let escrows
    try {
      escrows = await fetchEscrowsForWallet(
        signerRef.current, roleRef.current, walletAddress, { strict: true },
      )
    } catch (err) {
      console.warn('[notifications] indexer:', err?.message)
      return
    }
    // La wallet o la red cambiaron mientras esperábamos
    if (keyRef.current !== requestKey) return

    const current = storeRef.current
    const { snapshots, events } = diffEscrows(
      current.snapshots, escrows, walletAddress, { baseline: !current.baselined },
    )
    commit({
      snapshots,
      items: appendNotifications(current.items, events),
      baselined: true,
    })
  }, [walletAddress, key, commit])

  // Polling mientras la pestaña está visible
  useEffect(() => {
    if (!walletAddress) return
    refresh()
    const id = setInterval(() => {
      if (!document.hidden) refresh()
    }, POLL_INTERVAL_MS)
    const onVisible = () => { if (!document.hidden) refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [walletAddress, refresh])

  /** Agrega eventos externos (p. ej. órdenes ramp) */
  const notify = useCallback((events) => {
    if (!keyRef.current) return
    const list = Array.isArray(events) ? events : [events]
    const current = storeRef.current
    commit({ ...current, items: appendNotifications(current.items, list.filter(Boolean)) })
  }, [commit])

  const markAllRead = useCallback(() => {
    const current = storeRef.current
    if (!current.items.some(n => !n.read)) return
    commit({ ...current, items: current.items.map(n => ({ ...n, read: true })) })
  }, [commit])

  const clear = useCallback(() => {
    commit({ ...storeRef.current, items: [] })
  }, [commit])

  const unreadCount = store.items.filter(n => !n.read).length

  return (
    <NotificationsContext.Provider
      value={{ items: store.items, unreadCount, notify, markAllRead, clear, refresh }}
    >
      {children}
    </NotificationsContext.Provider>
  )
}
