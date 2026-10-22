import { useState } from 'react'
import { useEscrowFlow } from '../hooks/useEscrowFlow'
import { useLanguage } from '../context/LanguageContext'

const ROLES_KEYS = ['approver', 'serviceProvider', 'releaseSigner', 'disputeResolver', 'receiver', 'platformAddress']

function shorten(addr, s = 8, e = 6) {
  if (!addr) return '—'
  return `${addr.slice(0, s)}...${addr.slice(-e)}`
}

function isMe(addr, walletAddress) {
  return addr && walletAddress && addr.toLowerCase() === walletAddress.toLowerCase()
}

/** Devuelve la clave del estado a partir de los flags del escrow */
function getStatusKey(escrow) {
  const f = escrow?.flags ?? {}
  if (f.released) return 'released'
  if (f.resolved) return 'resolved'
  if (f.disputed) return 'disputed'
  if (f.approved) return 'approved'
  return 'active'
}

/**
 * Flujo single-release:
 *   1. Fondear   (approver,      balance === 0)
 *   2. Aprobar   (approver,      balance > 0 y hito sin aprobar)
 *   3. Liberar   (releaseSigner, balance > 0 y todos los hitos aprobados)
 */
function getActions(escrow, walletAddress) {
  const flags        = escrow?.flags ?? {}
  const roles        = escrow?.roles ?? {}
  const balance      = Number(escrow?.balance ?? 0)
  const totalAmount  = Number(escrow?.amount ?? 0)
  const addr         = walletAddress?.toLowerCase() ?? ''
  const milestones   = escrow?.milestones ?? []
  const allApproved  = milestones.length > 0 && milestones.every(m => m.approved)
  const fullyFunded  = totalAmount > 0 && balance >= totalAmount

  if (flags.released || flags.resolved) return []

  const actions = []

  if (!fullyFunded && roles.approver?.toLowerCase() === addr)
    actions.push('fund')

  if (fullyFunded && !allApproved && roles.approver?.toLowerCase() === addr)
    actions.push('approve')

  if (fullyFunded && allApproved && roles.releaseSigner?.toLowerCase() === addr)
    actions.push('release')

  return actions
}

/* ── Componente principal ───────────────────────────────────────────── */
export function EscrowDetailModal({ escrow, walletAddress, onClose, onActionDone }) {
  const { fundEscrow, approveMilestone, releaseFunds, loading, error } = useEscrowFlow()
  const { t } = useLanguage()
  const d = t.detail

  const totalAmount    = Number(escrow?.amount ?? 0)
  const currentBalance = Number(escrow?.balance ?? 0)
  const remaining      = Math.max(0, totalAmount - currentBalance)
  const [fundAmount, setFundAmount] = useState(String(remaining || totalAmount || ''))
  const [actionDone, setActionDone] = useState(null)

  const statusKey   = getStatusKey(escrow)
  const statusEntry = d.statusLabels?.[statusKey] ?? { label: statusKey, color: 'status-active' }
  const actions     = getActions(escrow, walletAddress)

  const actionLabels = {
    funded:   d.successFunded,
    approved: d.successApproved,
    released: d.successReleased,
  }

  async function handleFund() {
    try {
      await fundEscrow(escrow.contractId, fundAmount, walletAddress)
      setActionDone('funded')
      onActionDone?.()
    } catch {
      /* error already set by hook */
    }
  }

  async function handleApprove() {
    try {
      await approveMilestone(escrow.contractId, 0, walletAddress)
      setActionDone('approved')
      onActionDone?.()
    } catch {
      /* error already set by hook */
    }
  }

  async function handleRelease() {
    try {
      await releaseFunds(escrow.contractId, walletAddress)
      setActionDone('released')
      onActionDone?.()
    } catch {
      /* error already set by hook */
    }
  }

  return (
    <div className="detail-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="detail-box">

        {/* ── Header ── */}
        <div className="detail-header">
          <div className="detail-header-left">
            <span className={`ec-status ${statusEntry.color}`}>{statusEntry.label}</span>
            <h2 className="detail-title">{escrow.title || d.noTitle}</h2>
            <p className="detail-type">
              {escrow.type === 'multi-release' ? 'Multi-Release' : 'Single-Release'} ·{' '}
              {escrow.trustline?.symbol ?? 'USDC'}
            </p>
          </div>
          <button className="modal-x" onClick={onClose}>×</button>
        </div>

        {/* ── Monto ── */}
        <div className="detail-amount-row">
          <div className="detail-amount">
            <span className="detail-amount-val">{escrow.amount ?? '—'}</span>
            <span className="detail-amount-sym">{escrow.trustline?.symbol ?? 'USDC'}</span>
          </div>
          {escrow.balance !== undefined && (
            <div className="detail-balance">
              <span className="detail-balance-label">{d.inCustody}</span>
              <span className="detail-balance-val">
                {escrow.balance} {escrow.trustline?.symbol ?? 'USDC'}
              </span>
            </div>
          )}
        </div>

        {/* ── Descripción ── */}
        {escrow.description && (
          <p className="detail-desc">{escrow.description}</p>
        )}

        {/* ── Roles ── */}
        <div className="detail-section">
          <span className="detail-section-label">{d.rolesSection}</span>
          <div className="roles-grid">
            {ROLES_KEYS.map(key => {
              const roleEntry = d.roles?.[key] ?? { label: key, desc: '' }
              const addr = escrow.roles?.[key]
              const mine = isMe(addr, walletAddress)
              return (
                <div key={key} className={`role-card ${mine ? 'role-card-mine' : ''}`}>
                  <div className="role-top">
                    <span className="role-label">{roleEntry.label}</span>
                    {mine && <span className="role-you-badge">{d.you}</span>}
                  </div>
                  <code className="role-addr">{shorten(addr)}</code>
                  <span className="role-desc">{roleEntry.desc}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Hitos ── */}
        {escrow.milestones?.length > 0 && (
          <div className="detail-section">
            <span className="detail-section-label">{d.milestonesSection}</span>
            <div className="milestones-list">
              {escrow.milestones.map((m, i) => (
                <div key={i} className="milestone-item">
                  <span className={`milestone-dot ${m.approved ? 'milestone-done' : ''}`} />
                  <span className="milestone-desc">{m.description || `${d.milestone} ${i + 1}`}</span>
                  {m.approved && <span className="milestone-check">✓</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Contract ID ── */}
        {escrow.contractId && (
          <div className="detail-section">
            <span className="detail-section-label">{d.contractIdLabel}</span>
            <div className="detail-contract-row">
              <code className="detail-contract-id">{escrow.contractId}</code>
              <button
                className="ec-copy"
                title={d.copy}
                onClick={() => navigator.clipboard.writeText(escrow.contractId)}
              >
                <CopyIcon />
              </button>
            </div>
          </div>
        )}

        {/* ── Acciones ── */}
        {actions.length > 0 && !actionDone && (
          <div className="detail-actions">

            {/* Paso 1: Fondear */}
            {actions.includes('fund') && (
              <div className="action-block">
                <div className="action-step-header">
                  <span className="action-step-num">1</span>
                  <span className="detail-section-label">{d.fundTitle}</span>
                </div>

                {totalAmount > 0 && (
                  <div className="fund-progress">
                    <div className="fund-progress-labels">
                      <span>{d.funded} <strong>{currentBalance} {escrow.trustline?.symbol ?? 'USDC'}</strong></span>
                      <span>{d.required} <strong>{totalAmount} {escrow.trustline?.symbol ?? 'USDC'}</strong></span>
                    </div>
                    <div className="fund-progress-bar">
                      <div
                        className="fund-progress-fill"
                        style={{ width: `${Math.min(100, (currentBalance / totalAmount) * 100)}%` }}
                      />
                    </div>
                    {currentBalance > 0 && remaining > 0 && (
                      <p className="fund-remaining-hint">
                        {d.remaining} <strong>{remaining} {escrow.trustline?.symbol ?? 'USDC'}</strong> {d.remainingFor}
                      </p>
                    )}
                  </div>
                )}

                <div className="fund-row">
                  <div className="fund-input-wrap">
                    <input
                      type="number"
                      className="fund-input"
                      value={fundAmount}
                      onChange={e => setFundAmount(e.target.value)}
                      min="0.01"
                      max={remaining || undefined}
                      step="0.01"
                      placeholder={d.amountPlaceholder}
                    />
                    <span className="fund-sym">{escrow.trustline?.symbol ?? 'USDC'}</span>
                  </div>
                  <button
                    className="btn-action-fund"
                    onClick={handleFund}
                    disabled={loading || !fundAmount || Number(fundAmount) <= 0}
                  >
                    {loading ? <><span className="spinner" /> {d.signing}</> : d.fundBtn}
                  </button>
                </div>

                {Number(fundAmount) > 0 && Number(fundAmount) < remaining && (
                  <p className="fund-partial-warn">
                    {d.partialWarnPre} <strong>{totalAmount} {escrow.trustline?.symbol ?? 'USDC'}</strong> {d.partialWarnPost}
                  </p>
                )}
              </div>
            )}

            {/* Paso 2: Aprobar hito */}
            {actions.includes('approve') && (
              <div className="action-block">
                <div className="action-step-header">
                  <span className="action-step-num">2</span>
                  <span className="detail-section-label">{d.approveTitle}</span>
                </div>
                <p className="action-warn">{d.approveWarn}</p>
                <button
                  className="btn-action-approve"
                  onClick={handleApprove}
                  disabled={loading}
                >
                  {loading ? <><span className="spinner" /> {d.signing}</> : d.approveBtn}
                </button>
              </div>
            )}

            {/* Paso 3: Liberar fondos */}
            {actions.includes('release') && (
              <div className="action-block">
                <div className="action-step-header">
                  <span className="action-step-num">3</span>
                  <span className="detail-section-label">{d.releaseTitle}</span>
                </div>
                <p className="action-warn">{d.releaseWarn}</p>
                <button
                  className="btn-action-release"
                  onClick={handleRelease}
                  disabled={loading}
                >
                  {loading ? <><span className="spinner" /> {d.signing}</> : d.releaseBtn}
                </button>
              </div>
            )}

          </div>
        )}

        {/* ── Confirmación ── */}
        {actionDone && (
          <div className="action-success">
            <span className="action-success-icon">✓</span>
            {actionLabels[actionDone]}
          </div>
        )}

        {/* ── Error ── */}
        {error && <div className="modal-error">{error}</div>}

      </div>
    </div>
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
