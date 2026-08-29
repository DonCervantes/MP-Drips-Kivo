import { useState } from 'react'
import { useLanguage } from '../context/LanguageContext'

export function SeedPhraseModal({ secretKey, recoveryKey, onConfirm }) {
  const { t } = useLanguage()
  const r = t.recovery
  const [confirmed, setConfirmed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedRecovery, setCopiedRecovery] = useState(false)

  function copyToClipboard(text, setCopiedFn) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedFn(true)
      setTimeout(() => setCopiedFn(false), 2000)
    })
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 480 }}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <span className="modal-tag" style={{ background: 'var(--error, #e53e3e)', color: '#fff' }}>
              {r.tag}
            </span>
            <h2 className="modal-title">{r.title}</h2>
          </div>
        </div>

        {/* Warning */}
        <div className="modal-error" style={{ marginBottom: '1rem' }}>
          ⚠️ {r.warning}
        </div>

        {/* Secret Key */}
        <div className="form-field">
          <label className="form-label">{r.secretKeyLabel}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <code style={{
              flex: 1,
              wordBreak: 'break-all',
              background: 'var(--surface-variant, #1e1e2e)',
              padding: '0.5rem',
              borderRadius: '0.5rem',
              fontSize: '0.75rem',
            }}>
              {secretKey}
            </code>
            <button
              type="button"
              className="btn-modal-ghost"
              style={{ whiteSpace: 'nowrap' }}
              onClick={() => copyToClipboard(secretKey, setCopied)}
            >
              {copied ? r.copied : r.copy}
            </button>
          </div>
          <span className="form-hint">{r.secretKeyHint}</span>
        </div>

        {/* Recovery Key */}
        <div className="form-field" style={{ marginTop: '1rem' }}>
          <label className="form-label">{r.recoveryKeyLabel}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <code style={{
              flex: 1,
              wordBreak: 'break-all',
              background: 'var(--surface-variant, #1e1e2e)',
              padding: '0.5rem',
              borderRadius: '0.5rem',
              fontSize: '0.75rem',
            }}>
              {recoveryKey}
            </code>
            <button
              type="button"
              className="btn-modal-ghost"
              style={{ whiteSpace: 'nowrap' }}
              onClick={() => copyToClipboard(recoveryKey, setCopiedRecovery)}
            >
              {copiedRecovery ? r.copied : r.copy}
            </button>
          </div>
          <span className="form-hint">{r.recoveryKeyHint}</span>
        </div>

        {/* Confirmation checkbox */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.25rem 0', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={e => setConfirmed(e.target.checked)}
            style={{ width: 18, height: 18, cursor: 'pointer' }}
          />
          <span className="form-label" style={{ margin: 0 }}>{r.confirmCheck}</span>
        </label>

        {/* Continue button */}
        <button
          type="button"
          className="btn-modal-primary"
          style={{ width: '100%' }}
          disabled={!confirmed}
          onClick={onConfirm}
        >
          {r.continueBtn}
        </button>
      </div>
    </div>
  )
}
