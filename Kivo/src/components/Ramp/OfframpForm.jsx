import { useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { isValidBankAccountId } from '../../services/etherfuse'

export function OfframpForm({ onSubmit, loading, error }) {
  const [amount, setAmount] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  const [accountError, setAccountError] = useState('')
  const { t } = useLanguage()
  const r = t.ramp

  function handleSubmit(e) {
    e.preventDefault()
    if (!isValidBankAccountId(bankAccountId)) {
      setAccountError(r.accountRequired)
      return
    }
    const n = parseFloat(amount)
    if (!n || n <= 0) return
    setAccountError('')
    onSubmit(n, bankAccountId.trim())
  }

  return (
    <form className="ramp-body" onSubmit={handleSubmit}>

      <div className="ramp-field">
        <label className="ramp-label">{r.withdrawLabel}</label>
        <div className="ramp-input-wrap">
          <input
            className="ramp-input"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="10.00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            disabled={loading}
            required
          />
          <span className="ramp-input-badge">USDC</span>
        </div>
      </div>

      <div className="ramp-field">
        <label className="ramp-label" htmlFor="offramp-account">{r.accountLabel}</label>
        <input
          id="offramp-account"
          className="ramp-input"
          type="text"
          autoComplete="off"
          placeholder={r.accountPlaceholder}
          value={bankAccountId}
          onChange={e => {
            setBankAccountId(e.target.value)
            setAccountError('')
          }}
          disabled={loading}
          aria-invalid={Boolean(accountError)}
          aria-describedby="offramp-account-hint"
        />
        <div id="offramp-account-hint" className="ramp-note">{r.accountHint}</div>
        {accountError && <div className="ramp-error" role="alert">{accountError}</div>}
      </div>

      <div className="ramp-note" style={{ borderColor: 'rgba(212,166,71,0.3)', background: 'var(--gold-dim)', color: 'var(--gold-light)' }}>
        <strong>{r.noBankTitle}</strong> {r.noBankNote}
      </div>

      {error && <div className="ramp-error">{error}</div>}

      <button
        type="submit"
        className="ramp-btn-primary"
        disabled={loading || !amount || parseFloat(amount) <= 0}
      >
        {loading
          ? <><span className="ramp-spinner" /> {r.signingBtn}</>
          : r.withdrawBtn
        }
      </button>
    </form>
  )
}
