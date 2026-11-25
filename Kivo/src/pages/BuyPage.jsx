import { useEffect, useState } from 'react'
import { ConnectButton } from 'accesly'
import { useWallet } from '../context/WalletContext'
import { useLanguage } from '../context/LanguageContext'
import { useEscrowFlow } from '../hooks/useEscrowFlow'
import { parseExp, secondsRemaining, formatRemaining } from '../lib/offerExpiry'

function shortenAddress(addr) {
  if (!addr) return ''
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function isExpiredNow(exp) {
  return exp !== null && secondsRemaining(exp, Date.now()) === 0
}

export function BuyPage() {
  const params   = new URLSearchParams(window.location.search)
  const seller   = params.get('seller')   || ''
  const amount   = params.get('amount')   || '0'
  const title    = params.get('title')    || 'Oferta'
  const desc     = params.get('desc')     || title
  const resolver = params.get('resolver') || seller
  const langParam = params.get('lang')
  // Legacy offers (no or invalid `exp`) stay purchasable without a countdown.
  const exp       = parseExp(params.get('exp'))

  const { t, setLang } = useLanguage()
  const b = t.buy

  // Aplica el idioma del vendedor al abrir la página
  useEffect(() => {
    if (langParam && ['es', 'en', 'pt'].includes(langParam)) {
      setLang(langParam)
    }
  }, [langParam, setLang])

  const {
    walletAddress,
    connectFreighter,
    freighterLoading,
    freighterAddr,
    disconnectFreighter,
  } = useWallet()

  const { createEscrow, loading, error, result } = useEscrowFlow()

  const [now, setNow] = useState(() => Date.now())
  const remaining = exp === null ? null : secondsRemaining(exp, now)
  const expired   = remaining === 0

  // Ticks once per second only while an offer with `exp` is still open.
  useEffect(() => {
    if (exp === null || expired) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [exp, expired])

  async function handleBuy() {
    if (!walletAddress) return
    // Re-check at click time so a tab open right at the boundary cannot buy.
    if (isExpiredNow(exp)) {
      setNow(exp * 1000)
      return
    }
    await createEscrow(
      {
        title,
        description:     desc,
        milestoneDesc:   desc,
        serviceProvider: seller,
        receiver:        seller,
        disputeResolver: resolver,
        amount,
        platformFee:     '1',
      },
      walletAddress,
    )
  }

  /* ── Éxito ── */
  if (result?.contractId !== undefined) {
    return (
      <div className="app">
        <BuyNav freighterAddr={freighterAddr} freighterLoading={freighterLoading} connectFreighter={connectFreighter} disconnectFreighter={disconnectFreighter} />
        <div className="buy-container">
          <div className="buy-card">
            <div className="modal-success-icon">✓</div>
            <h2 style={{ marginBottom: '0.5rem' }}>{b.successTitle}</h2>
            <p style={{ color: 'var(--muted)', marginBottom: '1rem' }}>{b.successSub}</p>
            {result.contractId && (
              <div className="contract-id-box">
                <span className="contract-label">Contract ID</span>
                <code className="contract-value">{result.contractId}</code>
              </div>
            )}
            <div className="buy-flow-info" style={{ marginTop: '1.25rem' }}>
              <div className="flow-step"><span className="flow-n">1</span> {b.successStep1}</div>
              <div className="flow-step"><span className="flow-n">2</span> {b.successStep2} {amount} USDC</div>
              <div className="flow-step"><span className="flow-n">3</span> {b.successStep3}</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ── Formulario de compra ── */
  return (
    <div className="app">
      <BuyNav
        freighterAddr={freighterAddr}
        freighterLoading={freighterLoading}
        connectFreighter={connectFreighter}
        disconnectFreighter={disconnectFreighter}
      />

      <div className="buy-container">
        <div className="buy-card">
          <span className="modal-tag">{b.tag}</span>
          <h2 className="buy-title">{title}</h2>
          {desc !== title && <p className="buy-desc">{desc}</p>}

          <div className="buy-details">
            <div className="buy-detail-row">
              <span className="buy-detail-label">USDC</span>
              <span className="buy-amount">{amount} USDC</span>
            </div>
            <div className="buy-detail-row">
              <span className="buy-detail-label">{t.offer?.qrSeller || 'Vendedor'}</span>
              <code className="modal-wallet-addr">{shortenAddress(seller)}</code>
            </div>
            {remaining !== null && !expired && (
              <div className="buy-detail-row">
                <span className="buy-detail-label">{b.expiresIn}</span>
                <code className="modal-wallet-addr">{formatRemaining(remaining)}</code>
              </div>
            )}
          </div>

          <div className="buy-flow-info">
            <div className="flow-step"><span className="flow-n">1</span> {b.step1}</div>
            <div className="flow-step"><span className="flow-n">2</span> {b.step2}</div>
            <div className="flow-step"><span className="flow-n">3</span> {b.step3}</div>
          </div>

          {error && <div className="modal-error">{error}</div>}

          {expired ? (
            <div className="modal-error" role="alert">
              <strong>{b.expiredTitle}</strong> {b.expiredHint}
            </div>
          ) : walletAddress ? (
            <>
              <div className="modal-wallet-row" style={{ marginBottom: '1rem' }}>
                <span className="status-dot" />
                <span className="modal-wallet-label">{b.yourWallet}</span>
                <code className="modal-wallet-addr">{shortenAddress(walletAddress)}</code>
              </div>
              <button
                className="btn-primary buy-btn"
                onClick={handleBuy}
                disabled={loading}
              >
                {loading
                  ? <><span className="spinner" /> {b.buying}</>
                  : `${b.buyBtn} ${amount} USDC`
                }
              </button>
            </>
          ) : (
            <div className="buy-connect-section">
              <p style={{ color: 'var(--muted)', marginBottom: '1rem' }}>{b.connectHint}</p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="btn-connect-freighter" onClick={connectFreighter} disabled={freighterLoading}>
                  {freighterLoading ? <span className="spinner" /> : 'Freighter'}
                </button>
                <ConnectButton />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Navbar ── */
function BuyNav({ freighterAddr, freighterLoading, connectFreighter, disconnectFreighter }) {
  return (
    <nav className="navbar">
      <div className="nav-brand">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <polygon points="10,1 18,5.5 18,14.5 10,19 2,14.5 2,5.5" stroke="var(--gold)" strokeWidth="1.5" fill="none"/>
        </svg>
        <span>Kivo</span>
      </div>
      <div className="nav-wallet">
        {freighterAddr ? (
          <div className="wallet-chip">
            <span className="status-dot" />
            <span className="wallet-addr">{freighterAddr.slice(0, 6)}...{freighterAddr.slice(-4)}</span>
            <button className="btn-disconnect" onClick={disconnectFreighter}>✕</button>
          </div>
        ) : (
          <button className="btn-connect-freighter" onClick={connectFreighter} disabled={freighterLoading}>
            {freighterLoading ? <span className="spinner" /> : 'Freighter'}
          </button>
        )}
        <ConnectButton />
      </div>
    </nav>
  )
}
