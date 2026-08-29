import { useState, useEffect, useRef } from 'react'
import { useEscrowFlow } from '../hooks/useEscrowFlow'
import { useLanguage } from '../context/LanguageContext'

function shorten(addr, s = 8, e = 6) {
  if (!addr) return '—'
  return `${addr.slice(0, s)}...${addr.slice(-e)}`
}

function isMe(addr, walletAddress) {
  return addr && walletAddress && addr.toLowerCase() === walletAddress.toLowerCase()
}

/**
 * Registro de eventos de la disputa en memoria (por contractId).
 * En producción esto vendría de un índice on-chain o base de datos.
 */
const disputeEvents = new Map()

function getEvents(contractId) {
  return disputeEvents.get(contractId) || []
}

function addEvent(contractId, event) {
  const events = disputeEvents.get(contractId) || []
  events.push({
    ...event,
    timestamp: new Date().toISOString(),
  })
  disputeEvents.set(contractId, events)
}

/**
 * Modal de gestión de disputas para escrows.
 *
 * Props:
 *   escrow         - objeto del escrow
 *   walletAddress  - dirección de la wallet conectada
 *   onClose        - () => void
 *   onActionDone   - () => void (callback tras resolver)
 */
export function DisputeModal({ escrow, walletAddress, onClose, onActionDone }) {
  const { initiateDispute, resolveDispute, loading, error, result } = useEscrowFlow()
  const { t } = useLanguage()
  const d = t.dispute

  const roles = escrow?.roles ?? {}
  const flags = escrow?.flags ?? {}
  const isDisputed = flags.disputed
  const isResolved = flags.resolved || flags.released

  const isResolver = isMe(roles.disputeResolver, walletAddress)

  // Quién inició la disputa (por defecto la contraparte del resolver)
  const disputeInitiator = roles.approver
  const disputeCounterpart = roles.serviceProvider

  const events = getEvents(escrow.contractId)

  // Estado del formulario de iniciación
  const [reason, setReason] = useState('')
  const [showInitiateForm, setShowInitiateForm] = useState(false)

  // Estado del formulario de resolución
  const [senderPercent, setSenderPercent] = useState(50)
  const [resolutionNote, setResolutionNote] = useState('')
  const [showResolverPanel, setShowResolverPanel] = useState(false)

  const [localDisputed, setLocalDisputed] = useState(isDisputed)
  const [localResolved, setLocalResolved] = useState(false)
  const [actionSuccess, setActionSuccess] = useState(null)

  // Refs para capturar valores al momento de la llamada (evita closures obsoletos)
  const pendingRef = useRef({ reason: '', senderPercent: 50, note: '' })

  // Efecto para manejar el resultado de initiateDispute
  useEffect(() => {
    if (result?.disputed) {
      const { reason: r } = pendingRef.current
      setLocalDisputed(true)
      addEvent(escrow.contractId, {
        type: 'initiated',
        by: walletAddress,
        reason: r,
      })
      setActionSuccess('initiated')
      setShowInitiateForm(false)
    }
  }, [result, escrow.contractId, walletAddress])

  // Efecto para manejar el resultado de resolveDispute
  useEffect(() => {
    if (result?.resolved) {
      const { senderPercent: sp, note: n } = pendingRef.current
      setLocalResolved(true)
      addEvent(escrow.contractId, {
        type: 'resolved',
        by: walletAddress,
        senderPercent: sp,
        note: n,
      })
      setActionSuccess('resolved')
      onActionDone?.()
    }
  }, [result, escrow.contractId, walletAddress, onActionDone])

  async function handleInitiate() {
    pendingRef.current.reason = reason
    await initiateDispute(escrow.contractId, walletAddress, reason)
  }

  async function handleResolve() {
    pendingRef.current.senderPercent = senderPercent
    pendingRef.current.note = resolutionNote
    await resolveDispute({
      contractId: escrow.contractId,
      resolverAddress: walletAddress,
      senderPercent,
      senderAddress: disputeInitiator,
      receiverAddress: disputeCounterpart,
      resolutionNote,
    })
  }

  const hasOngoingDispute = localDisputed && !localResolved

  return (
    <div className="detail-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="detail-box dispute-modal">

        {/* ── Header ── */}
        <div className="dispute-header">
          <div className="dispute-header-left">
            <span className="dispute-tag">
              {hasOngoingDispute ? d.tag : d.initiateTitle}
            </span>
            <h2 className="dispute-title">
              {hasOngoingDispute ? d.title : escrow.title}
            </h2>
          </div>
          <button className="modal-x" onClick={onClose}>×</button>
        </div>

        {/* ── Escrow info ── */}
        <div className="dispute-escrow-info">
          <div className="dispute-amount">
            <span className="dispute-amount-val">{escrow.amount ?? '—'}</span>
            <span className="dispute-amount-sym">{escrow.trustline?.symbol ?? 'USDC'}</span>
          </div>
          {hasOngoingDispute && (
            <span className="ec-status status-disputed">En Disputa</span>
          )}
        </div>

        {/* ── Succcess message ── */}
        {actionSuccess === 'initiated' && (
          <div className="action-success">
            <span className="action-success-icon">✓</span>
            {d.success}
          </div>
        )}
        {actionSuccess === 'resolved' && (
          <div className="action-success">
            <span className="action-success-icon">✓</span>
            {d.resolvedSuccess}
          </div>
        )}

        {/* ── Si no hay disputa activa y el usuario puede iniciar ── */}
        {!hasOngoingDispute && !localResolved && !actionSuccess && (
          <>
            {!showInitiateForm ? (
              <div className="dispute-initiate-prompt">
                <p className="dispute-initiate-desc">{d.initiateDesc}</p>
                <button
                  className="btn-dispute-initiate"
                  onClick={() => setShowInitiateForm(true)}
                  disabled={loading}
                >
                  ⚠ {d.initiateBtn}
                </button>
              </div>
            ) : (
              <div className="dispute-initiate-form">
                <div className="form-field">
                  <label className="form-label">{d.initiateReason}</label>
                  <textarea
                    className="dispute-reason-input"
                    rows={3}
                    placeholder={d.initiateReasonPlaceholder}
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                  />
                </div>

                {error && <div className="modal-error">{error}</div>}

                <div className="dispute-initiate-actions">
                  <button
                    className="btn-modal-ghost"
                    onClick={() => setShowInitiateForm(false)}
                    disabled={loading}
                  >
                    {d.cancel}
                  </button>
                  <button
                    className="btn-dispute-confirm"
                    onClick={handleInitiate}
                    disabled={loading}
                  >
                    {loading ? <><span className="spinner" /> {d.signed}</> : d.confirmInitiate}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Panel del Resolvedor (solo visible para el árbitro) ── */}
        {hasOngoingDispute && isResolver && !localResolved && (
          <>
            <div className="dispute-section">
              <span className="detail-section-label">{d.resolverPanel}</span>
              <p className="dispute-section-desc">{d.resolverDesc}</p>
            </div>

            {/* Partes del conflicto */}
            <div className="dispute-section">
              <span className="detail-section-label">{d.resolverParties}</span>
              <div className="dispute-parties">
                <div className="dispute-party-card">
                  <span className="dispute-party-role">{d.sender}</span>
                  <code className="dispute-party-addr">
                    {shorten(disputeInitiator)}
                    {isMe(disputeInitiator, walletAddress) && (
                      <span className="role-you-badge dispute-you-badge">{t.detail.you}</span>
                    )}
                  </code>
                </div>
                <div className="dispute-party-vs">⚖️</div>
                <div className="dispute-party-card">
                  <span className="dispute-party-role">{d.receiver}</span>
                  <code className="dispute-party-addr">
                    {shorten(disputeCounterpart)}
                    {isMe(disputeCounterpart, walletAddress) && (
                      <span className="role-you-badge dispute-you-badge">{t.detail.you}</span>
                    )}
                  </code>
                </div>
              </div>
            </div>

            {/* Formulario de distribución */}
            {!showResolverPanel ? (
              <button
                className="btn-action-release"
                onClick={() => setShowResolverPanel(true)}
                style={{ alignSelf: 'stretch', justifyContent: 'center' }}
              >
                {d.resolutionTitle} →
              </button>
            ) : (
              <div className="dispute-resolution-form">
                <div className="dispute-section">
                  <span className="detail-section-label">{d.resolutionTitle}</span>
                  <p className="dispute-section-desc">{d.resolutionDesc}</p>
                </div>

                <div className="dispute-sliders">
                  <div className="dispute-slider-group">
                    <label className="dispute-slider-label">
                      {d.senderLabel}
                      <strong>{senderPercent}%</strong>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={senderPercent}
                      onChange={e => setSenderPercent(Number(e.target.value))}
                      className="dispute-slider"
                    />
                  </div>
                  <div className="dispute-slider-group">
                    <label className="dispute-slider-label">
                      {d.receiverLabel}
                      <strong>{100 - senderPercent}%</strong>
                    </label>
                    <div className="dispute-slider-bar">
                      <div
                        className="dispute-slider-fill"
                        style={{ width: `${100 - senderPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="dispute-distribution-summary">
                  <div className="dispute-dist-row">
                    <span className="dispute-dist-label">{d.sender}</span>
                    <span className="dispute-dist-value">
                      {senderPercent}% ·{' '}
                      {((Number(escrow.amount || 0) * senderPercent) / 100).toFixed(2)}{' '}
                      {escrow.trustline?.symbol ?? 'USDC'}
                    </span>
                  </div>
                  <div className="dispute-dist-row">
                    <span className="dispute-dist-label">{d.receiver}</span>
                    <span className="dispute-dist-value">
                      {100 - senderPercent}% ·{' '}
                      {((Number(escrow.amount || 0) * (100 - senderPercent)) / 100).toFixed(2)}{' '}
                      {escrow.trustline?.symbol ?? 'USDC'}
                    </span>
                  </div>
                  <div className="dispute-dist-row dispute-dist-total">
                    <span className="dispute-dist-label">{d.total}</span>
                    <span className="dispute-dist-value">
                      {senderPercent + (100 - senderPercent)}% ·{' '}
                      {escrow.amount} {escrow.trustline?.symbol ?? 'USDC'}
                    </span>
                  </div>
                </div>

                <div className="form-field">
                  <label className="form-label">{d.distributionNote}</label>
                  <textarea
                    className="dispute-reason-input"
                    rows={2}
                    placeholder={d.distributionNotePlaceholder}
                    value={resolutionNote}
                    onChange={e => setResolutionNote(e.target.value)}
                  />
                </div>

                {error && <div className="modal-error">{error}</div>}

                <button
                  className="btn-dispute-resolve"
                  onClick={handleResolve}
                  disabled={loading}
                >
                  {loading ? <><span className="spinner" /> {d.signed}</> : d.resolveBtn}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Mensaje si hay disputa pero el usuario no es el resolver ── */}
        {hasOngoingDispute && !isResolver && (
          <div className="dispute-waiting">
            <div className="dispute-waiting-icon">⏳</div>
            <p className="dispute-waiting-text">
              {d.waitingText}
            </p>
          </div>
        )}

        {/* ── Historial de eventos ── */}
        {events.length > 0 && !localResolved && (
          <div className="dispute-section">
            <span className="detail-section-label">{d.historyTitle}</span>
            <div className="dispute-timeline">
              {events.map((ev, i) => (
                <div key={i} className="dispute-event">
                  <div className={`dispute-event-dot ${
                    ev.type === 'initiated' ? 'dispute-event-dot-warn' : 'dispute-event-dot-done'
                  }`} />
                  <div className="dispute-event-body">
                    {ev.type === 'initiated' && (
                      <>
                        <p className="dispute-event-text">
                          {d.eventInitiated} <strong>{shorten(ev.by)}</strong>
                        </p>
                        {ev.reason && (
                          <p className="dispute-event-detail">
                            {d.eventReason} {ev.reason}
                          </p>
                        )}
                      </>
                    )}
                    {ev.type === 'resolved' && (
                      <>
                        <p className="dispute-event-text">
                          {d.eventResolved} <strong>{shorten(ev.by)}</strong>
                        </p>
                        <p className="dispute-event-detail">
                          {d.eventDistribution
                            .replace('{senderPercent}', ev.senderPercent)
                            .replace('{receiverPercent}', 100 - ev.senderPercent)
                          }
                        </p>
                        {ev.note && (
                          <p className="dispute-event-detail">
                            {d.eventNote} {ev.note}
                          </p>
                        )}
                      </>
                    )}
                    <span className="dispute-event-time">
                      {new Date(ev.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Disputa resuelta ── */}
        {localResolved && (
          <div className="dispute-resolved-banner">
            <span className="dispute-resolved-icon">✓</span>
            <div>
              <strong>{d.resolvedSuccess}</strong>
              {events.filter(e => e.type === 'resolved').map((ev, i) => (
                <p key={i} className="dispute-event-detail">
                  {d.eventDistribution
                    .replace('{senderPercent}', ev.senderPercent)
                    .replace('{receiverPercent}', 100 - ev.senderPercent)
                  }
                </p>
              ))}
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {error && !actionSuccess && <div className="modal-error">{error}</div>}

      </div>
    </div>
  )
}
