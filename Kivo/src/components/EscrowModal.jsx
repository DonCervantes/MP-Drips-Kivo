import { useState } from 'react'
import { useEscrowFlow } from '../hooks/useEscrowFlow'
import { useLanguage } from '../context/LanguageContext'

function shortenAddress(addr) {
  if (!addr) return ''
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`
}

export function EscrowModal({ walletAddress, onClose }) {
  const { createEscrow, loading, error, result } = useEscrowFlow()
  const { t } = useLanguage()
  const e = t.escrow

  const [form, setForm] = useState({
    title:           '',
    description:     '',
    milestoneDesc:   '',
    serviceProvider: '',
    receiver:        '',
    disputeResolver: '',
    amount:          '',
    platformFee:     '1',
  })

  function handleChange(ev) {
    setForm(prev => ({ ...prev, [ev.target.name]: ev.target.value }))
  }

  async function handleSubmit(ev) {
    ev.preventDefault()
    try {
      await createEscrow(form, walletAddress)
    } catch {
      /* error already set by hook */
    }
  }

  // ── Estado: éxito ────────────────────────────────────────────────────────
  if (result?.contractId !== undefined) {
    return (
      <ModalOverlay onClose={onClose}>
        <div className="modal-success">
          <div className="modal-success-icon">✓</div>
          <h3>{e.successTitle}</h3>
          <p className="modal-success-sub">{e.successSub}</p>
          {result.contractId ? (
            <div className="contract-id-box">
              <span className="contract-label">Contract ID</span>
              <code className="contract-value">{result.contractId}</code>
            </div>
          ) : (
            <p className="modal-success-sub" style={{ color: 'var(--teal)' }}>
              {e.successPending}
            </p>
          )}
          <button className="btn-modal-close" onClick={onClose}>
            {e.close}
          </button>
        </div>
      </ModalOverlay>
    )
  }

  // ── Formulario ───────────────────────────────────────────────────────────
  return (
    <ModalOverlay onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <span className="modal-tag">{e.tag}</span>
            <h2 className="modal-title">{e.title}</h2>
          </div>
          <button type="button" className="modal-x" onClick={onClose} aria-label={e.close}>×</button>
        </div>

        {/* Wallet del cliente */}
        <div className="modal-wallet-row">
          <span className="status-dot" />
          <span className="modal-wallet-label">{e.clientLabel}</span>
          <code className="modal-wallet-addr">{shortenAddress(walletAddress)}</code>
        </div>

        {/* Campos del escrow */}
        <div className="form-grid">
          <Field label={e.fieldTitle} required>
            <input
              name="title"
              placeholder={e.fieldTitlePlaceholder}
              value={form.title}
              onChange={handleChange}
              required
            />
          </Field>

          <Field label={e.fieldDesc} required>
            <textarea
              name="description"
              rows={2}
              placeholder={e.fieldDescPlaceholder}
              value={form.description}
              onChange={handleChange}
              required
            />
          </Field>

          <Field label={e.fieldMilestone} hint={e.fieldMilestoneHint}>
            <input
              name="milestoneDesc"
              placeholder={e.fieldMilestonePlaceholder}
              value={form.milestoneDesc}
              onChange={handleChange}
            />
          </Field>

          <div className="form-two-col">
            <Field label={e.fieldAmount} required>
              <input
                type="number"
                name="amount"
                placeholder="0.00"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={handleChange}
                required
              />
            </Field>

            <div className="form-field">
              <label className="form-label">{e.fieldFee}</label>
              <div className="platform-fee-badge">1%</div>
            </div>
          </div>

          <Field label={e.fieldProvider} required>
            <input
              name="serviceProvider"
              placeholder="G..."
              value={form.serviceProvider}
              onChange={handleChange}
              required
            />
          </Field>

          <Field label={e.fieldReceiver} hint={e.fieldReceiverHint}>
            <input
              name="receiver"
              placeholder={e.fieldReceiverPlaceholder}
              value={form.receiver}
              onChange={handleChange}
            />
          </Field>

          <Field label={e.fieldDispute} hint={e.fieldDisputeHint} required>
            <input
              name="disputeResolver"
              placeholder="G..."
              value={form.disputeResolver}
              onChange={handleChange}
              required
            />
          </Field>
        </div>

        {/* Info del flujo */}
        <div className="modal-flow-info">
          <div className="flow-step"><span className="flow-n">1</span> {e.step1}</div>
          <div className="flow-step"><span className="flow-n">2</span> {e.step2}</div>
          <div className="flow-step"><span className="flow-n">3</span> {e.step3}</div>
        </div>

        {/* Error */}
        {error && (
          <div className="modal-error">{error}</div>
        )}

        {/* Actions */}
        <div className="modal-actions">
          <button type="button" className="btn-modal-ghost" onClick={onClose} disabled={loading}>
            {e.cancel}
          </button>
          <button type="submit" className="btn-modal-primary" disabled={loading}>
            {loading ? (
              <><span className="spinner" /> {e.processing}</>
            ) : (
              e.create
            )}
          </button>
        </div>
      </form>
    </ModalOverlay>
  )
}

/* ── Overlay ──────────────────────────────────────────────────────────── */
function ModalOverlay({ children, onClose }) {
  return (
    <div
      className="modal-overlay"
      onClick={ev => { if (ev.target === ev.currentTarget) onClose() }}
    >
      <div className="modal-box">
        {children}
      </div>
    </div>
  )
}

/* ── Field helper ─────────────────────────────────────────────────────── */
function Field({ label, hint, required, children }) {
  return (
    <div className="form-field">
      <label className="form-label">
        {label}
        {required && <span className="form-required">*</span>}
        {hint && <span className="form-hint"> — {hint}</span>}
      </label>
      {children}
    </div>
  )
}
