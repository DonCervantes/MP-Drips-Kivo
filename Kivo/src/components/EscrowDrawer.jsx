import { useEffect, useState } from 'react'
import { useMyEscrows } from '../hooks/useMyEscrows'
import { EscrowDetailModal } from './EscrowDetailModal'
import { useLanguage } from '../context/LanguageContext'

// Shortens Stellar public keys (G + 55 chars)
export const shorten = (address, start = 6, end = 4) => {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
};

export function formatDate(d, locale) {
  if (!d?._seconds) return '—'
  return new Date(d._seconds * 1000).toLocaleDateString(locale, {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

/** Devuelve la clave del estado a partir de los flags del escrow */
export function getStatusKey(escrow) {
  const f = escrow?.flags ?? {}
  if (f.released) return 'released'
  if (f.resolved) return 'resolved'
  if (f.disputed) return 'disputed'
  if (f.approved) return 'approved'
  return 'active'
}

/** Devuelve la clave del rol del usuario en el escrow */
export function getRoleKey(escrow, walletAddress) {
  if (!escrow?.roles || !walletAddress) return null
  const r = escrow.roles
  const addr = walletAddress.toLowerCase()
  if (r.approver?.toLowerCase()        === addr) return 'approver'
  if (r.serviceProvider?.toLowerCase() === addr) return 'serviceProvider'
  if (r.disputeResolver?.toLowerCase() === addr) return 'disputeResolver'
  if (r.releaseSigner?.toLowerCase()   === addr) return 'releaseSigner'
  if (r.receiver?.toLowerCase()        === addr) return 'receiver'
  if (r.platformAddress?.toLowerCase() === addr) return 'platformAddress'
  return null
}

/**
 * Panel lateral que lista los escrows del usuario.
 *
 * Props:
 *   walletAddress  string
 *   onClose        () => void
 */
export function EscrowDrawer({ walletAddress, onClose }) {
  const { escrows, loading, error, fetchEscrows } = useMyEscrows()
  const [selected, setSelected] = useState(null)
  const { t } = useLanguage()
  const d = t.drawer

  useEffect(() => {
    fetchEscrows(walletAddress)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress])

  return (
    <>
      {/* Overlay */}
      <div className="drawer-backdrop" onClick={onClose} />

      {/* Panel */}
      <aside className="drawer">
        {/* Header */}
        <div className="drawer-header">
          <div>
            <span className="drawer-tag">{d.tag}</span>
            <h2 className="drawer-title">{d.title}</h2>
          </div>
          <div className="drawer-header-right">
            <button
              className="drawer-refresh"
              onClick={() => fetchEscrows(walletAddress)}
              disabled={loading}
              title={d.refresh}
            >
              <RefreshIcon spinning={loading} />
            </button>
            <button className="drawer-close" onClick={onClose} aria-label={d.close}>×</button>
          </div>
        </div>

        {/* Wallet row */}
        <div className="drawer-wallet">
          <span className="status-dot" />
          <span className="drawer-wallet-addr">{shorten(walletAddress, 8, 6)}</span>
        </div>

        {/* Contenido */}
        <div className="drawer-body">
          {loading && (
            <div className="drawer-loading">
              <span className="spinner" style={{ width: 18, height: 18 }} />
              <span>{d.loading}</span>
            </div>
          )}

          {!loading && error && (
            <div className="drawer-error">{error}</div>
          )}

          {!loading && !error && escrows.length === 0 && (
            <div className="drawer-empty">
              <span className="drawer-empty-icon">⬡</span>
              <p>{d.empty}</p>
              <p className="drawer-empty-sub">{d.emptySub}</p>
            </div>
          )}

          {!loading && escrows.map((escrow, i) => (
            <EscrowCard
              key={escrow.engagementId || escrow.contractId || i}
              escrow={escrow}
              walletAddress={walletAddress}
              onClick={() => setSelected(escrow)}
              t={t}
            />
          ))}
        </div>
      </aside>

      {/* ── Modal de detalle ── */}
      {selected && (
        <EscrowDetailModal
          escrow={selected}
          walletAddress={walletAddress}
          onClose={() => setSelected(null)}
          onActionDone={() => fetchEscrows(walletAddress)}
        />
      )}
    </>
  )
}

/* ── Tarjeta individual ─────────────────────────────────────────────── */
function EscrowCard({ escrow, walletAddress, onClick, t }) {
  const d = t.drawer
  const dt = t.detail

  const statusKey = getStatusKey(escrow)
  const statusEntry = dt.statusLabels?.[statusKey] ?? { label: statusKey, color: 'status-active' }

  const roleKey = getRoleKey(escrow, walletAddress)
  const roleLabel = roleKey ? (dt.roles?.[roleKey]?.label ?? roleKey) : '—'

  const milestoneCount = escrow.milestones?.length ?? 0
  const milestoneWord = milestoneCount === 1 ? d.milestoneSingular : d.milestonePlural

  return (
    <div className="escrow-card escrow-card-clickable" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick?.()}
    >
      {/* Fila superior */}
      <div className="ec-top">
        <span className="ec-title">{escrow.title || d.noTitle}</span>
        <span className={`ec-status ${statusEntry.color}`}>{statusEntry.label}</span>
      </div>

      {/* Monto */}
      <div className="ec-amount">
        <span className="ec-amount-val">{escrow.amount ?? '—'}</span>
        <span className="ec-amount-sym">{escrow.trustline?.symbol ?? 'USDC'}</span>
      </div>

      {/* Metadata */}
      <div className="ec-meta">
        <MetaItem label={d.roleLabel}       value={roleLabel}                                  highlight />
        <MetaItem label={d.typeLabel}       value={escrow.type === 'multi-release' ? d.multiRelease : d.singleRelease} />
        <MetaItem label={d.createdLabel}    value={formatDate(escrow.createdAt, d.dateLocale)} />
        <MetaItem label={d.milestonesLabel} value={`${milestoneCount} ${milestoneWord}`}        />
      </div>

      {/* Contract ID */}
      {escrow.contractId && (
        <div className="ec-contract">
          <span className="ec-contract-label">Contract ID</span>
          <code className="ec-contract-val">{shorten(escrow.contractId, 10, 8)}</code>
          <button
            className="ec-copy"
            title={d.copyContractId}
            onClick={() => navigator.clipboard.writeText(escrow.contractId)}
          >
            <CopyIcon />
          </button>
        </div>
      )}

      {/* Descripción */}
      {escrow.description && (
        <p className="ec-desc">{escrow.description}</p>
      )}
    </div>
  )
}

function MetaItem({ label, value, highlight }) {
  return (
    <div className="ec-meta-item">
      <span className="ec-meta-label">{label}</span>
      <span className={`ec-meta-value ${highlight ? 'ec-meta-highlight' : ''}`}>{value ?? '—'}</span>
    </div>
  )
}

/* ── Iconos SVG inline ──────────────────────────────────────────────── */
function RefreshIcon({ spinning }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={spinning ? { animation: 'spin 0.8s linear infinite' } : {}}
    >
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <polyline points="16 8 21 8 21 3" />
      <polyline points="8 16 3 16 3 21" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}
