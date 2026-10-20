import { useState, useEffect } from 'react'
import { useRamp }       from '../../hooks/useRamp'
import { useWallet }     from '../../context/WalletContext'
import { useLanguage }   from '../../context/LanguageContext'
import { listBankAccounts } from '../../services/etherfuse'
import { OnrampForm }    from './OnrampForm'
import { OfframpForm }   from './OfframpForm'
import { OrderStatus }   from './OrderStatus'
import './Ramp.css'

export function RampPage({ onClose }) {
  const [tab, setTab]             = useState('onramp')
  const [onrampBankAccountId, setOnrampBankAccountId] = useState(null)

  const { walletAddress } = useWallet()
  const { t } = useLanguage()
  const r = t.ramp

  const { status, order, quote, error, startOnramp, startOfframp, reset } = useRamp()

  useEffect(() => {
    listBankAccounts()
      .then(data => {
        const accounts = data?.bankAccounts ?? data?.items ?? (Array.isArray(data) ? data : [])
        if (accounts.length > 0) setOnrampBankAccountId(accounts[0].id ?? accounts[0].bankAccountId)
      })
      .catch(() => {})
  }, [])

  const showStatus = ['awaiting_payment', 'processing', 'completed'].includes(status)
    || (status === 'error' && order)

  useEffect(() => {
    if (status !== 'completed') return
    const timer = setTimeout(() => reset(), 2500)
    return () => clearTimeout(timer)
  }, [status, reset])

  function handleOnramp(mxnAmount) { startOnramp(mxnAmount, onrampBankAccountId) }
  function handleOfframp(usdcAmount, bankAccountId) { startOfframp(usdcAmount, bankAccountId) }

  return (
    <div className="ramp-overlay" onClick={ev => { if (ev.target === ev.currentTarget) onClose() }}>
      <div className="ramp-modal" role="dialog" aria-label="On/Off Ramp">

        {/* ── Header ── */}
        <div className="ramp-header">
          <div className="ramp-title">
            <div className="ramp-title-icon">⟳</div>
            On/Off Ramp
          </div>
          <button className="ramp-close" onClick={onClose} aria-label={r.close}>✕</button>
        </div>

        {showStatus ? (
          <OrderStatus
            status={status}
            order={order}
            quote={quote}
            onReset={reset}
          />
        ) : (
          <>
            {/* ── Tabs ── */}
            <div className="ramp-tabs">
              <button
                className={`ramp-tab ${tab === 'onramp' ? 'active' : ''}`}
                onClick={() => { setTab('onramp'); reset() }}
              >
                {r.tabBuy}
              </button>
              <button
                className={`ramp-tab ${tab === 'offramp' ? 'active' : ''}`}
                onClick={() => { setTab('offramp'); reset() }}
              >
                {r.tabWithdraw}
              </button>
            </div>

            {!walletAddress ? (
              <div className="ramp-body">
                <div className="ramp-note" style={{ textAlign: 'center' }}>
                  {r.connectWallet}
                </div>
              </div>
            ) : tab === 'onramp' ? (
              <OnrampForm
                onSubmit={handleOnramp}
                loading={status === 'creating'}
                error={status === 'error' ? error : null}
              />
            ) : (
              <OfframpForm
                onSubmit={handleOfframp}
                loading={status === 'creating'}
                error={status === 'error' ? error : null}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
