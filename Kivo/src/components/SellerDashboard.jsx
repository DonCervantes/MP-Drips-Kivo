import { useEffect, useMemo, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useMyEscrows } from '../hooks/useMyEscrows'
import { useSellerOffers } from '../hooks/useSellerOffers'
import { EscrowDetailModal } from './EscrowDetailModal'
import { CreateOfferModal } from './CreateOfferModal'
import { useLanguage } from '../context/LanguageContext'

const shorten = (address, start = 6, end = 4) => {
  if (!address || address.length < 10) return address || ''
  return `${address.slice(0, start)}...${address.slice(-end)}`
}

function getStatusKey(escrow) {
  const f = escrow?.flags ?? {}
  if (f.released) return 'released'
  if (f.resolved) return 'resolved'
  if (f.disputed) return 'disputed'
  if (f.approved) return 'approved'
  return 'active'
}

function isSellerEscrow(escrow, walletAddress) {
  if (!escrow?.roles || !walletAddress) return false
  const addr = walletAddress.toLowerCase()
  const r = escrow.roles
  return (
    r.serviceProvider?.toLowerCase() === addr ||
    r.receiver?.toLowerCase() === addr
  )
}

function formatDate(ts, locale) {
  if (!ts) return '—'
  const ms = typeof ts === 'number' ? ts : (ts?._seconds ? ts._seconds * 1000 : null)
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatUsdc(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '0.00'
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Convierte un elemento SVG de QR a PNG en el portapapeles.
 * Si el navegador no soporta ClipboardItem de imágenes, copia el enlace como fallback.
 */
async function copyQrSvgToClipboard(svgElement, fallbackUrl) {
  if (svgElement && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      const serializer = new XMLSerializer()
      const svgString = serializer.serializeToString(svgElement)
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
      const blobUrl = URL.createObjectURL(svgBlob)

      const img = await new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = reject
        image.src = blobUrl
      })

      const size = 320
      const padding = 24
      const canvas = document.createElement('canvas')
      canvas.width = size + padding * 2
      canvas.height = size + padding * 2
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, padding, padding, size, size)
      URL.revokeObjectURL(blobUrl)

      const pngBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
      if (pngBlob) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })])
        return 'image'
      }
    } catch {
      // Fallback to copying URL text below
    }
  }

  await navigator.clipboard.writeText(fallbackUrl)
  return 'text'
}

const STATUS_FILTERS = ['all', 'active', 'approved', 'disputed', 'released', 'resolved']

export function SellerDashboard({ walletAddress, onClose }) {
  const { escrows, loading, error, fetchEscrows } = useMyEscrows()
  const { offers, reloadOffers, toggleOfferActive } = useSellerOffers(walletAddress)
  const { t } = useLanguage()

  const sd = t.sellerDashboard
  const d = t.drawer
  const dt = t.detail

  const [activeTab, setActiveTab] = useState('offers') // 'offers' | 'escrows'
  const [offerFilter, setOfferFilter] = useState('all') // 'all' | 'active' | 'inactive'
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedEscrow, setSelectedEscrow] = useState(null)
  const [showCreateOffer, setShowCreateOffer] = useState(false)
  const [expandedQrId, setExpandedQrId] = useState(null)
  const [feedbackMap, setFeedbackMap] = useState({})

  const qrSvgRefs = useRef({})

  useEffect(() => {
    fetchEscrows(walletAddress)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress])

  const sellerEscrows = useMemo(
    () => escrows.filter(e => isSellerEscrow(e, walletAddress)),
    [escrows, walletAddress]
  )

  const metrics = useMemo(() => {
    let pendingUsdc = 0
    let releasedUsdc = 0
    const statusCounts = {
      all: sellerEscrows.length,
      active: 0,
      approved: 0,
      disputed: 0,
      released: 0,
      resolved: 0,
    }

    for (const e of sellerEscrows) {
      const key = getStatusKey(e)
      statusCounts[key] = (statusCounts[key] || 0) + 1
      const amt = Number(e.amount) || 0
      if (key === 'released' || key === 'resolved') {
        releasedUsdc += amt
      } else {
        pendingUsdc += amt
      }
    }

    const activeOffersCount = offers.filter(o => o.active).length

    return {
      pendingUsdc,
      releasedUsdc,
      statusCounts,
      activeOffersCount,
      totalOffersCount: offers.length,
    }
  }, [sellerEscrows, offers])

  const filteredOffers = useMemo(() => {
    if (offerFilter === 'active') return offers.filter(o => o.active)
    if (offerFilter === 'inactive') return offers.filter(o => !o.active)
    return offers
  }, [offers, offerFilter])

  const filteredEscrows = useMemo(() => {
    if (statusFilter === 'all') return sellerEscrows
    return sellerEscrows.filter(e => getStatusKey(e) === statusFilter)
  }, [sellerEscrows, statusFilter])

  function setTempFeedback(key, label) {
    setFeedbackMap(prev => ({ ...prev, [key]: label }))
    setTimeout(() => {
      setFeedbackMap(prev => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }, 2000)
  }

  async function handleCopyLink(offer) {
    try {
      await navigator.clipboard.writeText(offer.url)
      setTempFeedback(`link-${offer.id}`, sd.linkCopied)
    } catch {
      // Ignore clipboard errors
    }
  }

  async function handleCopyQr(offer) {
    const svgEl = qrSvgRefs.current[offer.id]
    try {
      const mode = await copyQrSvgToClipboard(svgEl, offer.url)
      setTempFeedback(
        `qr-${offer.id}`,
        mode === 'image' ? sd.qrCopied : sd.linkCopied
      )
    } catch {
      // Ignore clipboard errors
    }
  }

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />

      <aside className="drawer seller-dashboard">
        {/* Header */}
        <div className="drawer-header">
          <div>
            <span className="drawer-tag">{sd.tag}</span>
            <h2 className="drawer-title">{sd.title}</h2>
          </div>
          <div className="drawer-header-right">
            <button
              className="btn-sd-new"
              onClick={() => setShowCreateOffer(true)}
            >
              + {sd.newOffer}
            </button>
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

        {/* KPI Volume Strip */}
        <div className="sd-kpi-grid">
          <div className="sd-kpi-card sd-kpi-pending">
            <span className="sd-kpi-label">{sd.pendingVolume}</span>
            <strong className="sd-kpi-value">{formatUsdc(metrics.pendingUsdc)} <span>USDC</span></strong>
          </div>
          <div className="sd-kpi-card sd-kpi-released">
            <span className="sd-kpi-label">{sd.releasedVolume}</span>
            <strong className="sd-kpi-value">{formatUsdc(metrics.releasedUsdc)} <span>USDC</span></strong>
          </div>
          <div className="sd-kpi-card">
            <span className="sd-kpi-label">{sd.activeOffers}</span>
            <strong className="sd-kpi-value">
              {metrics.activeOffersCount}
              <span> / {metrics.totalOffersCount}</span>
            </strong>
          </div>
        </div>

        {/* Main Tabs */}
        <div className="sd-tabs">
          <button
            className={`sd-tab ${activeTab === 'offers' ? 'sd-tab--active' : ''}`}
            onClick={() => setActiveTab('offers')}
          >
            {sd.tabOffers} ({offers.length})
          </button>
          <button
            className={`sd-tab ${activeTab === 'escrows' ? 'sd-tab--active' : ''}`}
            onClick={() => setActiveTab('escrows')}
          >
            {sd.tabEscrows} ({sellerEscrows.length})
          </button>
        </div>

        {/* Body */}
        <div className="drawer-body">
          {activeTab === 'offers' ? (
            <>
              {/* Offer filter pills */}
              <div className="sd-filter-row">
                {['all', 'active', 'inactive'].map(f => (
                  <button
                    key={f}
                    className={`sd-pill ${offerFilter === f ? 'sd-pill--active' : ''}`}
                    onClick={() => setOfferFilter(f)}
                  >
                    {sd.offerFilters[f]}
                  </button>
                ))}
              </div>

              {filteredOffers.length === 0 ? (
                <div className="drawer-empty">
                  <span className="drawer-empty-icon">⬡</span>
                  <p>{sd.noOffers}</p>
                  <p className="drawer-empty-sub">{sd.noOffersSub}</p>
                  <button
                    className="btn-modal-primary"
                    style={{ marginTop: '12px' }}
                    onClick={() => setShowCreateOffer(true)}
                  >
                    + {sd.newOffer}
                  </button>
                </div>
              ) : (
                filteredOffers.map(offer => {
                  const isExpanded = expandedQrId === offer.id
                  return (
                    <div
                      key={offer.id}
                      className={`sd-offer-card ${!offer.active ? 'sd-offer-card--inactive' : ''}`}
                    >
                      <div className="ec-top">
                        <span className="ec-title">{offer.title || d.noTitle}</span>
                        <span className={`ec-status ${offer.active ? 'status-active' : 'status-resolved'}`}>
                          {offer.active ? sd.offerActive : sd.offerInactive}
                        </span>
                      </div>

                      <div className="ec-amount">
                        <span className="ec-amount-val">{offer.amount}</span>
                        <span className="ec-amount-sym">USDC</span>
                        <span className="sd-offer-date">{formatDate(offer.createdAt, d.dateLocale)}</span>
                      </div>

                      {offer.desc && <p className="ec-desc">{offer.desc}</p>}

                      <div className="sd-offer-url">
                        <code>{offer.url}</code>
                      </div>

                      {/* Hidden SVG for instant QR copy even when preview is collapsed */}
                      <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
                        <QRCodeSVG
                          value={offer.url}
                          size={200}
                          ref={el => { qrSvgRefs.current[offer.id] = el }}
                        />
                      </div>

                      {isExpanded && (
                        <div className="sd-qr-preview">
                          <div className="sd-qr-box">
                            <QRCodeSVG value={offer.url} size={160} />
                          </div>
                        </div>
                      )}

                      <div className="sd-offer-actions">
                        <button
                          className="sd-action-btn"
                          onClick={() => handleCopyLink(offer)}
                          disabled={!offer.active}
                        >
                          {feedbackMap[`link-${offer.id}`] || sd.copyLink}
                        </button>
                        <button
                          className="sd-action-btn"
                          onClick={() => handleCopyQr(offer)}
                          disabled={!offer.active}
                        >
                          {feedbackMap[`qr-${offer.id}`] || sd.copyQr}
                        </button>
                        <button
                          className="sd-action-btn"
                          onClick={() => setExpandedQrId(isExpanded ? null : offer.id)}
                        >
                          {isExpanded ? sd.hideQr : sd.showQr}
                        </button>
                        <button
                          className={`sd-action-btn ${offer.active ? 'sd-action-btn--danger' : 'sd-action-btn--enable'}`}
                          onClick={() => toggleOfferActive(offer.id)}
                        >
                          {offer.active ? sd.deactivate : sd.reactivate}
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </>
          ) : (
            <>
              {/* Escrow status filter pills */}
              <div className="sd-filter-row">
                {STATUS_FILTERS.map(key => {
                  const label = key === 'all'
                    ? sd.statusAll
                    : (dt.statusLabels?.[key]?.label ?? key)
                  return (
                    <button
                      key={key}
                      className={`sd-pill ${statusFilter === key ? 'sd-pill--active' : ''}`}
                      onClick={() => setStatusFilter(key)}
                    >
                      {label} ({metrics.statusCounts[key] || 0})
                    </button>
                  )
                })}
              </div>

              {loading && (
                <div className="drawer-loading">
                  <span className="spinner" style={{ width: 18, height: 18 }} />
                  <span>{d.loading}</span>
                </div>
              )}

              {!loading && error && (
                <div className="drawer-error">{error}</div>
              )}

              {!loading && !error && filteredEscrows.length === 0 && (
                <div className="drawer-empty">
                  <span className="drawer-empty-icon">⬡</span>
                  <p>{sd.noEscrows}</p>
                  <p className="drawer-empty-sub">{sd.noEscrowsSub}</p>
                </div>
              )}

              {!loading && filteredEscrows.map((escrow, i) => {
                const statusKey = getStatusKey(escrow)
                const statusEntry = dt.statusLabels?.[statusKey] ?? { label: statusKey, color: 'status-active' }
                return (
                  <div
                    key={escrow.engagementId || escrow.contractId || i}
                    className="escrow-card escrow-card-clickable"
                    onClick={() => setSelectedEscrow(escrow)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && setSelectedEscrow(escrow)}
                  >
                    <div className="ec-top">
                      <span className="ec-title">{escrow.title || d.noTitle}</span>
                      <span className={`ec-status ${statusEntry.color}`}>{statusEntry.label}</span>
                    </div>
                    <div className="ec-amount">
                      <span className="ec-amount-val">{escrow.amount ?? '—'}</span>
                      <span className="ec-amount-sym">{escrow.trustline?.symbol ?? 'USDC'}</span>
                      <span className="sd-offer-date">{formatDate(escrow.createdAt, d.dateLocale)}</span>
                    </div>
                    {escrow.roles?.approver && (
                      <div className="ec-meta-item" style={{ marginTop: '6px' }}>
                        <span className="ec-meta-label">{sd.buyerLabel}</span>
                        <code className="ec-contract-val">{shorten(escrow.roles.approver, 8, 6)}</code>
                      </div>
                    )}
                    {escrow.description && (
                      <p className="ec-desc">{escrow.description}</p>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>
      </aside>

      {selectedEscrow && (
        <EscrowDetailModal
          escrow={selectedEscrow}
          walletAddress={walletAddress}
          onClose={() => setSelectedEscrow(null)}
          onActionDone={() => fetchEscrows(walletAddress)}
        />
      )}

      {showCreateOffer && (
        <CreateOfferModal
          onClose={() => setShowCreateOffer(false)}
          onOfferCreated={() => reloadOffers()}
        />
      )}
    </>
  )
}

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
