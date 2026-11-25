import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useWallet } from '../context/WalletContext'
import { useLanguage } from '../context/LanguageContext'
import { TTL_OPTIONS, DEFAULT_TTL_SECONDS, computeExp } from '../lib/offerExpiry'

function shortenAddress(addr) {
  if (!addr) return ''
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`
}

export function CreateOfferModal({ onClose }) {
  const { walletAddress } = useWallet()
  const { t, lang } = useLanguage()
  const o = t.offer

  const [form, setForm] = useState({
    title:    '',
    desc:     '',
    amount:   '',
    resolver: '',
    ttl:      String(DEFAULT_TTL_SECONDS),
  })

  const [offerUrl, setOfferUrl] = useState(null)
  const [offerExp, setOfferExp] = useState(null)
  const [copied,   setCopied]   = useState(false)

  function handleChange(ev) {
    setForm(prev => ({ ...prev, [ev.target.name]: ev.target.value }))
  }

  function handleGenerate(ev) {
    ev.preventDefault()
    const base = import.meta.env.VITE_APP_URL || window.location.origin
    const url = new URL('/buy', base)
    url.searchParams.set('seller', walletAddress)
    url.searchParams.set('amount', form.amount)
    url.searchParams.set('title',  form.title)
    url.searchParams.set('lang',   lang)
    if (form.desc)     url.searchParams.set('desc',     form.desc)
    if (form.resolver) url.searchParams.set('resolver', form.resolver)
    // When offer signing exists (#102), `exp` must go inside the signed payload.
    const exp = computeExp(Date.now(), Number(form.ttl))
    url.searchParams.set('exp', String(exp))
    setOfferExp(exp)
    setOfferUrl(url.toString())
    setCopied(false)
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
                <span className="buy-detail-label">{o.qrExpires}</span>
                <span style={{ color: 'var(--text)' }}>{new Date(offerExp * 1000).toLocaleString(lang)}</span>
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
              <button className="btn-modal-primary" onClick={handleCopy} style={{ flex: 1 }}>
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

          <div className="form-field">
            <label className="form-label">{o.fieldTtl}</label>
            <select name="ttl" value={form.ttl} onChange={handleChange}>
              {TTL_OPTIONS.map(opt => (
                <option key={opt.value} value={String(opt.value)}>{o[opt.key]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="modal-flow-info">
          <div className="flow-step"><span className="flow-n">1</span> {o.step1}</div>
          <div className="flow-step"><span className="flow-n">2</span> {o.step2}</div>
          <div className="flow-step"><span className="flow-n">3</span> {o.step3}</div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-modal-ghost" onClick={onClose}>
            {o.cancel}
          </button>
          <button type="submit" className="btn-modal-primary">
            {o.generate}
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
