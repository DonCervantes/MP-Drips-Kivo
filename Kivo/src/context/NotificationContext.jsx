import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { useWallet } from './WalletContext'

const NotificationContext = createContext(null)

const STORAGE_PREFIX = 'kivo_notifications_v1'
const SNAPSHOT_PREFIX = 'kivo_escrow_snapshots_v1'
const MAX_NOTIFICATIONS = 50
const TOAST_DURATION_MS = 5000

function storageKey(walletAddress) {
  return `${STORAGE_PREFIX}_${(walletAddress || 'guest').toLowerCase()}`
}

function snapshotKey(walletAddress) {
  return `${SNAPSHOT_PREFIX}_${(walletAddress || 'guest').toLowerCase()}`
}

function loadNotifications(walletAddress) {
  try {
    const raw = localStorage.getItem(storageKey(walletAddress))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveNotifications(walletAddress, items) {
  try {
    localStorage.setItem(storageKey(walletAddress), JSON.stringify(items.slice(0, MAX_NOTIFICATIONS)))
  } catch {
    // Ignore storage quota / private mode errors
  }
}

function loadSnapshots(walletAddress) {
  try {
    const raw = localStorage.getItem(snapshotKey(walletAddress))
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveSnapshots(walletAddress, snapshots) {
  try {
    localStorage.setItem(snapshotKey(walletAddress), JSON.stringify(snapshots))
  } catch {
    // Ignore storage quota / private mode errors
  }
}

function newNotificationId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function NotificationProvider({ children }) {
  const { walletAddress } = useWallet()
  const [notifications, setNotifications] = useState(() => loadNotifications(walletAddress))
  const [toasts, setToasts] = useState([])
  const toastTimers = useRef(new Map())

  useEffect(() => {
    setNotifications(loadNotifications(walletAddress))
  }, [walletAddress])

  useEffect(() => {
    const timers = toastTimers.current
    return () => {
      timers.forEach(timer => clearTimeout(timer))
      timers.clear()
    }
  }, [])

  const dismissToast = useCallback((id) => {
    const timer = toastTimers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      toastTimers.current.delete(id)
    }
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const notify = useCallback(({ type, title, message, dedupeKey = null, meta = null }) => {
    const entry = {
      id: newNotificationId(),
      type,
      title,
      message,
      dedupeKey,
      meta,
      timestamp: Date.now(),
      read: false,
    }

    let inserted = false
    setNotifications(prev => {
      if (dedupeKey && prev.some(n => n.dedupeKey === dedupeKey)) {
        return prev
      }
      inserted = true
      const next = [entry, ...prev].slice(0, MAX_NOTIFICATIONS)
      saveNotifications(walletAddress, next)
      return next
    })

    // Show toast only if not deduplicated
    if (!dedupeKey || inserted) {
      setToasts(prev => [entry, ...prev].slice(0, 4))
      const timer = setTimeout(() => {
        toastTimers.current.delete(entry.id)
        setToasts(prev => prev.filter(t => t.id !== entry.id))
      }, TOAST_DURATION_MS)
      toastTimers.current.set(entry.id, timer)
    }
  }, [walletAddress])

  const markAsRead = useCallback((id) => {
    setNotifications(prev => {
      const next = prev.map(n => (n.id === id ? { ...n, read: true } : n))
      saveNotifications(walletAddress, next)
      return next
    })
  }, [walletAddress])

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => {
      const next = prev.map(n => ({ ...n, read: true }))
      saveNotifications(walletAddress, next)
      return next
    })
  }, [walletAddress])

  const clearAll = useCallback(() => {
    setNotifications([])
    saveNotifications(walletAddress, [])
  }, [walletAddress])

  /**
   * Compares freshly fetched escrows against the last known local snapshot
   * and emits in-app notifications for any state transitions (funded, approved,
   * released, disputed).
   */
  const syncEscrowStates = useCallback((escrows, targetWallet, labels) => {
    if (!targetWallet || !Array.isArray(escrows)) return

    const prevMap = loadSnapshots(targetWallet)
    const hasBaseline = Object.keys(prevMap).length > 0
    const nextMap = { ...prevMap }

    for (const escrow of escrows) {
      const id = escrow.contractId || escrow.engagementId
      if (!id) continue

      const flags = escrow.flags ?? {}
      const balance = Number(escrow.balance ?? 0)
      const milestones = escrow.milestones ?? []
      const allApproved = Boolean(flags.approved) || (milestones.length > 0 && milestones.every(m => m.approved))

      const current = {
        balance,
        approved: allApproved,
        released: Boolean(flags.released),
        disputed: Boolean(flags.disputed),
      }

      const prev = prevMap[id]
      if (hasBaseline && prev) {
        const titleLabel = escrow.title || id.slice(0, 10)
        const symbol = escrow.trustline?.symbol ?? 'USDC'

        if (current.balance > prev.balance) {
          notify({
            type: 'escrow_funded',
            title: labels.escrowFundedTitle,
            message: `${titleLabel} · ${current.balance} ${symbol}`,
            dedupeKey: `escrow_funded:${id}:${current.balance}`,
            meta: { contractId: id },
          })
        }

        if (current.approved && !prev.approved) {
          notify({
            type: 'escrow_approved',
            title: labels.escrowApprovedTitle,
            message: titleLabel,
            dedupeKey: `escrow_approved:${id}`,
            meta: { contractId: id },
          })
        }

        if (current.released && !prev.released) {
          notify({
            type: 'escrow_released',
            title: labels.escrowReleasedTitle,
            message: titleLabel,
            dedupeKey: `escrow_released:${id}`,
            meta: { contractId: id },
          })
        }

        if (current.disputed && !prev.disputed) {
          notify({
            type: 'escrow_disputed',
            title: labels.escrowDisputedTitle,
            message: titleLabel,
            dedupeKey: `escrow_disputed:${id}`,
            meta: { contractId: id },
          })
        }
      }

      nextMap[id] = current
    }

    saveSnapshots(targetWallet, nextMap)
  }, [notify])

  const unreadCount = notifications.reduce((acc, n) => acc + (n.read ? 0 : 1), 0)

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        toasts,
        unreadCount,
        notify,
        markAsRead,
        markAllAsRead,
        clearAll,
        dismissToast,
        syncEscrowStates,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider')
  return ctx
}
