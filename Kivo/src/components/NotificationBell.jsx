import { useEffect, useRef, useState } from 'react'
import { useNotifications } from '../hooks/useNotifications'
import { useLanguage } from '../context/LanguageContext'
import { formatMessage } from '../lib/notifications'

function formatTime(ms, locale) {
  return new Date(ms).toLocaleString(locale, {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

/**
 * Campana del navbar con el listado de notificaciones de estado.
 */
export function NotificationBell() {
  const notifications = useNotifications()
  const { t } = useLanguage()
  const n = t.notifications
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (!open) return
    function onDown(ev) {
      if (rootRef.current && !rootRef.current.contains(ev.target)) setOpen(false)
    }
    function onKey(ev) {
      if (ev.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!notifications) return null
  const { items, unreadCount, markAllRead, clear } = notifications

  function toggle() {
    // Al cerrar el panel se dan por leídas
    if (open) markAllRead()
    setOpen(o => !o)
  }

  function messageFor(item) {
    const entry = n.events?.[item.type]
    const template = typeof entry === 'string'
      ? entry
      : (entry?.[item.role] ?? entry?.other ?? item.type)
    return formatMessage(template, { title: item.title || n.untitled })
  }

  return (
    <div className="notif" ref={rootRef}>
      <button
        type="button"
        className="notif-btn"
        onClick={toggle}
        aria-label={n.open}
        aria-expanded={open}
        title={n.open}
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label={n.title}>
          <div className="notif-header">
            <span className="notif-title">{n.title}</span>
            {items.length > 0 && (
              <div className="notif-actions">
                <button type="button" onClick={markAllRead} disabled={unreadCount === 0}>
                  {n.markAllRead}
                </button>
                <button type="button" onClick={clear}>{n.clear}</button>
              </div>
            )}
          </div>

          {items.length === 0 ? (
            <div className="notif-empty">
              <p>{n.empty}</p>
              <p className="notif-empty-sub">{n.emptySub}</p>
            </div>
          ) : (
            <ul className="notif-list">
              {items.map(item => (
                <li key={item.id} className={`notif-item notif-${item.type}${item.read ? '' : ' notif-unread'}`}>
                  <span className="notif-dot" />
                  <div>
                    <p className="notif-msg">{messageFor(item)}</p>
                    <span className="notif-time">{formatTime(item.createdAt, t.drawer.dateLocale)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function BellIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}
