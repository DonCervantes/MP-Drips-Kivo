import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { StrKey } from '@stellar/stellar-sdk'
import { useWallet } from '../context/WalletContext'
import { useLanguage } from '../context/LanguageContext'
import { useNetwork } from '../context/NetworkContext'
import { OFFER_TTL_SECONDS, serializeOffer, verifySignedOffer } from '../utils/signedOffer'

function shortenAddress(addr) {
  if (!addr) return ''
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`
}

export function CreateOfferModal({ onClose }) {
  const { walletAddress, signOfferMessage } = useWallet()
  const { t, lang } = useLanguage()
  const { network } = useNetwork()
  const o = t.offer

  const [form, setForm] = useState({
    title:    '',
    desc:     '',
    amount:   '',
    resolver: '',
  })

  const [offerUrl, setOfferUrl] = useState(null)
  const [copied,   setCopied]   = useState(false)
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState('')

  function handleChange(ev) {
    setForm(prev => ({ ...prev, [ev.target.name]: ev.target.value }))
  }

  async function handleGenerate(ev) {
    ev.preventDefault()
    setSigning(true)
    setError('')
    try {
      const amount = Number(form.amount)
      const disputeResolver = form.resolver.trim() || walletAddress
      if (
        !/^\d+(?:\.\d{1,2})?$/.test(form.amount.trim()) ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        !Number.isSafeInteger(Number(form.amount.replace('.', ''))) ||
        !StrKey.isValidEd25519PublicKey(walletAddress) ||
        !StrKey.isValidEd25519PublicKey(disputeResolver) ||
        !form.title.trim() ||
        form.title.trim().length > 120 ||
        form.desc.trim().length > 1000
      ) {
        throw new Error(o.invalidAmount)
      }

      const issuedAt = Math.floor(Date.now() / 1000)
      const offer = {
        version: 1,
        network,
        asset: 'USDC',
        seller: walletAddress,
        receiver: walletAddress,
        amount: amount.toFixed(2),
        platformFee: '1',
        title: form.title.trim(),
        description: form.desc.trim() || form.title.trim(),
        disputeResolver,
        issuedAt,
        expiresAt: issuedAt + OFFER_TTL_SECONDS,
      }
      const payload = serializeOffer(offer)
      const signature = await signOfferMessage(payload, walletAddress)
      await verifySignedOffer(payload, signature)

      const base = import.meta.env.VITE_APP_URL || window.location.origin
      const url = new URL('/buy', base)
      url.searchParams.set('offer', payload)
      url.searchParams.set('signature', signature)
      url.searchParams.set('lang', lang)
      setOfferUrl(url.toString())
      setCopied(false)
    } catch (err) {
      setError(err?.message || o.signError)
    } finally {
      setSigning(false)
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(offerUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  /* ── Vista QR ── */
  if (offerUrl) {
    return (
      <ModalOverlay onClose={onClose}>
        <div className="modal-form">
          <div className="modal-header">
            <div>
              <span className="modal-tag">{o.qrTag}</span>
              <h2 className="modal-title">{o.qrTitle}</h2>
            </div>
            <button type="button" className="modal-x" onClick={onClose} aria-label="Cerrar">×</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ background: '#fff', padding: '1rem', borderRadius: '12px' }}>
              <QRCodeSVG value={offerUrl} size={200} />
            </div>

            <div className="buy-details" style={{ width: '100%' }}>
              <div className="buy-detail-row">
                <span className="buy-detail-label">{o.qrProduct}</span>
                <span style={{ color: 'var(--text)' }}>{form.title}</span>
              </div>
              <div className="buy-detail-row">
                <span className="buy-detail-label">{o.qrPrice}</span>
                <span className="buy-amount">{form.amount} USDC</span>
              </div>
              <div className="buy-detail-row">
                <span className="buy-detail-label">{o.qrSeller}</span>
                <code className="modal-wallet-addr">{shortenAddress(walletAddress)}</code>
              </div>
              <div className="buy-detail-row">
                <span className="buy-detail-label">{o.expirationLabel}</span>
                <span style={{ color: 'var(--text)' }}>{o.expirationValue}</span>
              </div>
            </div>

            <div className="contract-id-box" style={{ width: '100%' }}>
              <span className="contract-label">{o.qrUrlLabel}</span>
              <code className="contract-value" style={{ fontSize: '0.63rem', wordBreak: 'break-all' }}>
                {offerUrl}
              </code>
            </div>

            <div className="modal-actions" style={{ width: '100%' }}>
              <button className="btn-modal-ghost" onClick={() => setOfferUrl(null)} style={{ flex: 1 }}>
                {o.newOffer}
              </button>
              <button type="button" className="btn-modal-primary" onClick={handleCopy} style={{ flex: 1 }}>
                {copied ? o.copied : o.copyLink}
              </button>
            </div>
          </div>
        </div>
      </ModalOverlay>
    )
  }

  /* ── Formulario ── */
  return (
    <ModalOverlay onClose={onClose}>
      <form className="modal-form" onSubmit={handleGenerate}>
        <div className="modal-header">
          <div>
            <span className="modal-tag">{o.modalTag}</span>
            <h2 className="modal-title">{o.modalTitle}</h2>
          </div>
          <button type="button" className="modal-x" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        <div className="modal-wallet-row">
          <span className="status-dot" />
          <span className="modal-wallet-label">{o.sellerLabel}</span>
          <code className="modal-wallet-addr">{shortenAddress(walletAddress)}</code>
        </div>

        <div className="form-grid">
          <div className="form-field">
            <label className="form-label">
              {o.fieldProduct} <span className="form-required">*</span>
            </label>
            <input
              name="title"
              placeholder={o.fieldProductPlaceholder}
              value={form.title}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label">
              {o.fieldDesc} <span className="form-hint"> {o.fieldDescOptional}</span>
            </label>
            <textarea
              name="desc"
              rows={2}
              placeholder={o.fieldDescPlaceholder}
              value={form.desc}
              onChange={handleChange}
            />
          </div>

          <div className="form-field">
            <label className="form-label">
              {o.fieldAmount} <span className="form-required">*</span>
            </label>
            <input
              type="number"
              name="amount"
              placeholder="15.00"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={handleChange}
              required
            />
          </div>

          {/* Desglose de comisión */}
          {form.amount > 0 && (
            <div className="fee-breakdown">
              <div className="fee-breakdown-row">
                <span>{o.feeLabel}</span>
                <span>{Number(form.amount).toFixed(2)} USDC</span>
              </div>
              <div className="fee-breakdown-row fee-breakdown-deduction">
                <span>{o.feeKivo}</span>
                <span>− {(Number(form.amount) * 0.01).toFixed(2)} USDC</span>
              </div>
              <div className="fee-breakdown-row fee-breakdown-total">
                <span>{o.feeYou}</span>
                <span>{(Number(form.amount) * 0.99).toFixed(2)} USDC</span>
              </div>
            </div>
          )}

          <div className="form-field">
            <label className="form-label">
              {o.fieldResolver} <span className="form-hint"> {o.fieldResolverHint}</span>
            </label>
            <input
              name="resolver"
              placeholder={o.fieldResolverPlaceholder}
              value={form.resolver}
              onChange={handleChange}
            />
          </div>
        </div>

        {error && <div className="modal-error">{error}</div>}

        <div className="modal-flow-info">
          <div className="flow-step"><span className="flow-n">1</span> {o.step1}</div>
          <div className="flow-step"><span className="flow-n">2</span> {o.step2}</div>
          <div className="flow-step"><span className="flow-n">3</span> {o.step3}</div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-modal-ghost" onClick={onClose}>
            {o.cancel}
          </button>
          <button type="submit" className="btn-modal-primary" disabled={signing}>
            {signing ? o.signing : o.generate}
          </button>
        </div>
      </form>
    </ModalOverlay>
  )
}

/* ── Overlay ── */
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
