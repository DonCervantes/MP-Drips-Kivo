import { useEffect, useState } from 'react'
import { useReputation } from '../hooks/useReputation'
import { useLanguage } from '../context/LanguageContext'
import { formatDuration, formatVolume } from '../utils/reputation'

function shorten(addr, s = 8, e = 6) {
  if (!addr || addr.length < 14) return addr || '—'
  return `${addr.slice(0, s)}...${addr.slice(-e)}`
}

/**
 * Modal displaying basic buyer & seller reputation based solely on finalized escrows.
 */
export function ReputationModal({ walletAddress, initialRole = 'all', onClose }) {
  const { loading, error, fetchReputation, getStats } = useReputation()
  const { t } = useLanguage()
  const r = t.reputation

  const [roleTab, setRoleTab] = useState(initialRole)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setRoleTab(initialRole)
  }, [initialRole])

  useEffect(() => {
    fetchReputation(walletAddress)
  }, [walletAddress, fetchReputation])

  const statsByRole = getStats(walletAddress)
  const current = statsByRole[roleTab] || statsByRole.all

  function handleCopy() {
    if (!walletAddress) return
    navigator.clipboard.writeText(walletAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const tabs = [
    { key: 'all', label: r.tabs.all, count: statsByRole.all.completedCount },
    { key: 'buyer', label: r.tabs.buyer, count: statsByRole.buyer.completedCount },
    { key: 'seller', label: r.tabs.seller, count: statsByRole.seller.completedCount },
  ]

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box reputation-modal">
        {/* Header */}
        <div className="modal-header">
          <div>
            <span className="modal-tag">{r.tag}</span>
            <h2 className="modal-title">{r.title}</h2>
          </div>
          <button className="modal-x" onClick={onClose} aria-label={r.close}>×</button>
        </div>

        {/* Wallet row */}
        <div className="modal-wallet-row reputation-wallet-row">
          <span className="status-dot" />
          <code className="modal-wallet-addr">{shorten(walletAddress, 10, 8)}</code>
          <button className="ec-copy" onClick={handleCopy} title={r.copyAddress}>
            {copied ? '✓' : r.copy}
          </button>
        </div>

        {/* Role Tabs */}
        <div className="reputation-tabs" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={roleTab === tab.key}
              className={`reputation-tab ${roleTab === tab.key ? 'reputation-tab--active' : ''}`}
              onClick={() => setRoleTab(tab.key)}
            >
              <span>{tab.label}</span>
              <span className="reputation-tab-count">{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Body */}
        {loading ? (
          <div className="drawer-loading">
            <span className="spinner" style={{ width: 18, height: 18 }} />
            <span>{r.loading}</span>
          </div>
        ) : error ? (
          <div className="modal-error">{error}</div>
        ) : (
          <>
            {/* 4 Metrics Grid */}
            <div className="reputation-grid">
              <div className="reputation-stat-card">
                <span className="reputation-stat-label">{r.metrics.completed}</span>
                <strong className="reputation-stat-val">{current.completedCount}</strong>
              </div>

              <div className="reputation-stat-card">
                <span className="reputation-stat-label">{r.metrics.volume}</span>
                <strong className="reputation-stat-val reputation-stat-gold">
                  {formatVolume(current.totalVolume)} <span className="reputation-unit">USDC</span>
                </strong>
              </div>

              <div className="reputation-stat-card">
                <span className="reputation-stat-label">{r.metrics.disputeRate}</span>
                <strong className={`reputation-stat-val ${current.disputeRate > 0 ? 'reputation-stat-warn' : 'reputation-stat-teal'}`}>
                  {current.completedCount > 0 ? `${current.disputeRate.toFixed(1).replace(/\.0$/, '')}%` : '—'}
                </strong>
              </div>

              <div className="reputation-stat-card">
                <span className="reputation-stat-label">{r.metrics.avgReleaseTime}</span>
                <strong className="reputation-stat-val">
                  {formatDuration(current.avgReleaseTimeMs, r.units)}
                </strong>
              </div>
            </div>

            <p className="reputation-note">{r.finalizedOnlyNote}</p>

            {/* Recent finalized escrows */}
            {current.completedCount === 0 ? (
              <div className="reputation-empty">
                <p>{r.empty}</p>
              </div>
            ) : (
              <div className="reputation-history">
                <span className="detail-section-label">{r.recentTitle}</span>
                <div className="reputation-history-list">
                  {current.finalizedEscrows.slice(0, 5).map((escrow, idx) => {
                    const isBuyer = escrow.roles?.approver?.toLowerCase() === walletAddress?.toLowerCase()
                    const roleLabel = isBuyer ? r.roleBuyer : r.roleSeller
                    const statusKey = escrow.flags?.released ? 'released' : 'resolved'
                    const statusEntry = t.detail.statusLabels?.[statusKey] ?? { label: statusKey, color: 'status-released' }
                    return (
                      <div key={escrow.engagementId || escrow.contractId || idx} className="reputation-history-item">
                        <div className="reputation-history-main">
                          <span className="reputation-history-title">{escrow.title || t.drawer.noTitle}</span>
                          <span className="reputation-history-role">{roleLabel}</span>
                        </div>
                        <div className="reputation-history-right">
                          <span className="reputation-history-amt">
                            {formatVolume(escrow.amount)} {escrow.trustline?.symbol ?? 'USDC'}
                          </span>
                          <span className={`ec-status ${statusEntry.color}`}>{statusEntry.label}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
