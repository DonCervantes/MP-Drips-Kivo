import { useEffect } from 'react'
import { useReputation } from '../hooks/useReputation'
import { useLanguage } from '../context/LanguageContext'
import { formatDuration, formatVolume } from '../utils/reputation'

/**
 * Compact inline reputation summary for a buyer or seller address (e.g. on BuyPage).
 */
export function ReputationBadge({ walletAddress, role = 'seller', onOpenProfile }) {
  const { loading, fetchReputation, getStats } = useReputation()
  const { t } = useLanguage()
  const r = t.reputation

  useEffect(() => {
    if (walletAddress) fetchReputation(walletAddress)
  }, [walletAddress, fetchReputation])

  if (!walletAddress) return null

  const stats = getStats(walletAddress)[role] ?? getStats(walletAddress).all

  return (
    <div className="reputation-inline">
      <div className="reputation-inline-header">
        <span className="reputation-inline-title">
          {role === 'seller' ? r.sellerRepTitle : r.buyerRepTitle}
        </span>
        {onOpenProfile && (
          <button type="button" className="reputation-inline-link" onClick={onOpenProfile}>
            {r.viewProfile}
          </button>
        )}
      </div>

      {loading ? (
        <div className="reputation-inline-loading">
          <span className="spinner" style={{ width: 14, height: 14 }} />
          <span>{r.loading}</span>
        </div>
      ) : (
        <div className="reputation-inline-grid">
          <div className="reputation-inline-item">
            <span className="reputation-inline-label">{r.metrics.completedShort}</span>
            <strong className="reputation-inline-val">{stats.completedCount}</strong>
          </div>
          <div className="reputation-inline-item">
            <span className="reputation-inline-label">{r.metrics.volume}</span>
            <strong className="reputation-inline-val">{formatVolume(stats.totalVolume)} USDC</strong>
          </div>
          <div className="reputation-inline-item">
            <span className="reputation-inline-label">{r.metrics.disputeRate}</span>
            <strong className="reputation-inline-val">
              {stats.completedCount > 0 ? `${stats.disputeRate.toFixed(1).replace(/\.0$/, '')}%` : '—'}
            </strong>
          </div>
          <div className="reputation-inline-item">
            <span className="reputation-inline-label">{r.metrics.avgReleaseShort}</span>
            <strong className="reputation-inline-val">{formatDuration(stats.avgReleaseTimeMs, r.units)}</strong>
          </div>
        </div>
      )}
    </div>
  )
}
