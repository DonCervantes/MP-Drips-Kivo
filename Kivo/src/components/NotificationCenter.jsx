import { useState, useRef, useEffect } from 'react'
import { useNotifications } from '../context/NotificationContext'
import { useLanguage } from '../context/LanguageContext'
import './NotificationCenter.css'

const TYPE_META = {
  escrow_created:  { icon: '+', tone: 'info' },
  escrow_funded:   { icon: '$', tone: 'teal' },
  escrow_approved: { icon: '✓', tone: 'gold' },
  escrow_released: { icon: '★', tone: 'success' },
  escrow_disputed: { icon: '!', tone: 'danger' },
  ramp_completed:  { icon: '✓', tone: 'success' },
  ramp_failed:     { icon: '✕', tone: 'danger' },
}

function formatTimeAgo(timestamp, labels) {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  if (diffSec < 60) return labels.justNow
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d`
}

export function NotificationCenter() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
  } = useNotifications()
  const { t } = useLanguage()
  const n = t.notifications

  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleOutsideClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [open])

  return (
    <div className="notif-center" ref={containerRef}>
      <button
        type="button"
        className={`notif-bell-btn${unreadCount > 0 ? ' notif-bell-btn--unread' : ''}`}
        onClick={() => setOpen(prev => !prev)}
        aria-label={n.title}
        title={n.title}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown" role="dialog" aria-label={n.title}>
          <div className="notif-dropdown-header">
            <span className="notif-dropdown-title">{n.title}</span>
            <div className="notif-dropdown-actions">
              {unreadCount > 0 && (
                <button type="button" className="notif-action-link" onClick={markAllAsRead}>
                  {n.markAllRead}
                </button>
              )}
              {notifications.length > 0 && (
                <button type="button" className="notif-action-link" onClick={clearAll}>
                  {n.clear}
                </button>
              )}
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="notif-empty">{n.empty}</div>
          ) : (
            <ul className="notif-list">
              {notifications.map(item => {
                const meta = TYPE_META[item.type] || { icon: '•', tone: 'info' }
                return (
                  <li
                    key={item.id}
                    className={`notif-item${item.read ? '' : ' notif-item--unread'}`}
                    onClick={() => markAsRead(item.id)}
                  >
                    <span className={`notif-icon notif-icon--${meta.tone}`}>{meta.icon}</span>
                    <div className="notif-content">
                      <div className="notif-row-top">
                        <span className="notif-item-title">{item.title}</span>
                        <span className="notif-item-time">{formatTimeAgo(item.timestamp, n)}</span>
                      </div>
                      {item.message && (
                        <p className="notif-item-msg">{item.message}</p>
                      )}
                    </div>
                    {!item.read && <span className="notif-unread-dot" />}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export function NotificationToasts() {
  const { toasts, dismissToast } = useNotifications()
  if (toasts.length === 0) return null

  return (
    <div className="notif-toast-stack" aria-live="polite">
      {toasts.map(item => {
        const meta = TYPE_META[item.type] || { icon: '•', tone: 'info' }
        return (
          <div key={item.id} className={`notif-toast notif-toast--${meta.tone}`}>
            <span className={`notif-icon notif-icon--${meta.tone}`}>{meta.icon}</span>
            <div className="notif-toast-body">
              <div className="notif-toast-title">{item.title}</div>
              {item.message && <div className="notif-toast-msg">{item.message}</div>}
            </div>
            <button
              type="button"
              className="notif-toast-close"
              onClick={() => dismissToast(item.id)}
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
