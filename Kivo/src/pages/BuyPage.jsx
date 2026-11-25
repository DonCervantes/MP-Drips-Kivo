import { useEffect, useState } from 'react'
import { ConnectButton } from 'accesly'
import { useWallet } from '../context/WalletContext'
import { useLanguage } from '../context/LanguageContext'
import { useEscrowFlow } from '../hooks/useEscrowFlow'
import { useNetwork } from '../context/NetworkContext'
import { verifySignedOffer } from '../utils/signedOffer'

function shortenAddress(addr) {
  if (!addr) return ''
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function BuyPage() {
  const params   = new URLSearchParams(window.location.search)
  const payload = params.get('offer') || ''
  const signature = params.get('signature') || ''
  const langParam = params.get('lang')

  const { t, setLang } = useLanguage()
  const { network, setNetwork } = useNetwork()
  const b = t.buy
  const [offer, setOffer] = useState(null)
  const [offerStatus, setOfferStatus] = useState('verifying')
  const [offerError, setOfferError] = useState('')

  useEffect(() => {
    if (langParam && ['es', 'en', 'pt'].includes(langParam)) {
      setLang(langParam)
    }
  }, [langParam, setLang])

  useEffect(() => {
    let active = true
    verifySignedOffer(payload, signature)
      .then(verifiedOffer => {
        if (!active) return
        setOffer(verifiedOffer)
        setNetwork(verifiedOffer.network)
        setOfferStatus('valid')
      })
      .catch(() => {
        if (!active) return
        setOfferStatus('invalid')
      })

    return () => { active = false }
  }, [payload, signature, setNetwork])

  const {
    walletAddress,
    connectFreighter,
    freighterLoading,
    freighterAddr,
    disconnectFreighter,
  } = useWallet()

  const { createEscrow, loading, error, result } = useEscrowFlow()

  async function handleBuy() {
    if (!walletAddress || !offer || network !== offer.network || offerError) return

    let verifiedOffer
    try {
      verifiedOffer = await verifySignedOffer(payload, signature)
    } catch {
      setOfferError(b.offerInvalid)
      return
    }

    if (verifiedOffer.network !== network) {
      setOfferError(b.offerNetworkMismatch)
      return
    }

    await createEscrow(
      {
        title: verifiedOffer.title,
        description: verifiedOffer.description,
        milestoneDesc: verifiedOffer.description,
        serviceProvider: verifiedOffer.seller,
        receiver: verifiedOffer.receiver,
        disputeResolver: verifiedOffer.disputeResolver,
        amount: verifiedOffer.amount,
        platformFee: verifiedOffer.platformFee,
      },
      walletAddress,
      () => verifySignedOffer(payload, signature),
    )
  }

  const amount = offer?.amount || ''
  const title = offer?.title || ''
  const desc = offer?.description || ''

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
          {offerStatus === 'verifying' ? (
            <p>{b.offerVerifying}</p>
          ) : offerStatus === 'invalid' || !offer ? (
            <>
              <span className="modal-tag">{b.tag}</span>
              <h2 className="buy-title">{b.offerInvalidTitle}</h2>
              <p className="buy-desc">{b.offerInvalid}</p>
            </>
          ) : (
            <>
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
                  <code className="modal-wallet-addr">{shortenAddress(offer.seller)}</code>
                </div>
                <div className="buy-detail-row">
                  <span className="buy-detail-label">{b.offerFeeLabel}</span>
                  <span>{offer.platformFee}%</span>
                </div>
                <div className="buy-detail-row">
                  <span className="buy-detail-label">{b.offerRecipientLabel}</span>
                  <code className="modal-wallet-addr">{shortenAddress(offer.receiver)}</code>
                </div>
                <div className="buy-detail-row">
                  <span className="buy-detail-label">{b.offerExpiresLabel}</span>
                  <span>{new Date(offer.expiresAt * 1000).toLocaleString()}</span>
                </div>
              </div>

              <div className="buy-flow-info">
                <div className="flow-step"><span className="flow-n">1</span> {b.step1}</div>
                <div className="flow-step"><span className="flow-n">2</span> {b.step2}</div>
                <div className="flow-step"><span className="flow-n">3</span> {b.step3}</div>
              </div>

              {offerError && <div className="modal-error">{offerError}</div>}
              {error && <div className="modal-error">{error}</div>}

              {walletAddress ? (
                <>
                  <div className="modal-wallet-row" style={{ marginBottom: '1rem' }}>
                    <span className="status-dot" />
                    <span className="modal-wallet-label">{b.yourWallet}</span>
                    <code className="modal-wallet-addr">{shortenAddress(walletAddress)}</code>
                  </div>
                  <button
                    className="btn-primary buy-btn"
                    onClick={handleBuy}
                    disabled={loading || network !== offer.network || Boolean(offerError)}
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
            </>
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
