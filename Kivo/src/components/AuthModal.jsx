import { useState } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { SeedPhraseModal } from './SeedPhraseModal'

/**
 * AuthModal — Web2 email/password login and registration.
 * Props:
 *   onAuth(result): called with { walletAddress, secretKey, loginType } on success
 *   onClose(): called when the modal is dismissed
 *   useAuth: the useAuth hook instance passed from the parent
 */
export function AuthModal({ onAuth, onClose, useAuthHook }) {
  const { t } = useLanguage()
  const a = t.auth ?? {}
  const { register, login, loading, error } = useAuthHook

  const [tab, setTab]         = useState('login')   // 'login' | 'register'
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [seedData, setSeedData] = useState(null)     // { secretKey, recoveryKey }

  async function handleSubmit(ev) {
    ev.preventDefault()
    if (tab === 'register') {
      const result = await register(email, password)
      if (result) {
        setSeedData({ secretKey: result.secretKey, recoveryKey: result.recoveryKey })
      }
    } else {
      await login(email, password)
      onAuth && onAuth({ loginType: 'web2' })
      onClose()
    }
  }

  // Show seed phrase modal after registration
  if (seedData) {
    return (
      <SeedPhraseModal
        secretKey={seedData.secretKey}
        recoveryKey={seedData.recoveryKey}
        onConfirm={() => {
          setSeedData(null)
          onAuth && onAuth({ loginType: 'web2' })
          onClose()
        }}
      />
    )
  }

  return (
    <div
      className="modal-overlay"
      onClick={ev => { if (ev.target === ev.currentTarget) onClose() }}
    >
      <div className="modal-box" style={{ maxWidth: 420 }}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <span className="modal-tag">Kivo</span>
            <h2 className="modal-title">
              {tab === 'login' ? (a.loginTitle ?? 'Sign in') : (a.registerTitle ?? 'Create account')}
            </h2>
          </div>
          <button type="button" className="modal-x" onClick={onClose} aria-label="Close">×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {['login', 'register'].map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={t === tab ? 'btn-modal-primary' : 'btn-modal-ghost'}
              style={{ flex: 1 }}
            >
              {t === 'login' ? (a.tabLogin ?? 'Sign in') : (a.tabRegister ?? 'Create account')}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="modal-form" style={{ gap: '0.75rem' }}>
          <div className="form-field">
            <label className="form-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label">{a.passwordLabel ?? 'Password'}</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={8}
              required
            />
          </div>

          {error && <div className="modal-error">{error}</div>}

          <button
            type="submit"
            className="btn-modal-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={loading}
          >
            {loading ? (
              <><span className="spinner" /> {a.processing ?? 'Processing...'}</>
            ) : tab === 'login' ? (a.loginBtn ?? 'Sign in') : (a.registerBtn ?? 'Create account')}
          </button>
        </form>
      </div>
    </div>
  )
}
