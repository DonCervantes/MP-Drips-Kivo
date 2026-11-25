import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useWallet } from '../context/WalletContext'
import { useLanguage } from '../context/LanguageContext'
import {
  EXPIRATION_OPTIONS,
  computeExpirationTimestamp,
  deleteOfferTemplate,
  loadOfferTemplates,
  saveOfferTemplate,
} from '../services/offerTemplates'

function shortenAddress(addr) {
  if (!addr) return ''
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`
}

const EMPTY_FORM = {
  title:     '',
  desc:      '',
  amount:    '',
  milestone: '',
  receiver:  '',
  resolver:  '',
  expiresIn: 'none',
}

export function CreateOfferModal({ onClose }) {
  const { walletAddress } = useWallet()
  const { t, lang } = useLanguage()
  const o = t.offer

  const [form, setForm] = useState(EMPTY_FORM)
  const [templates, setTemplates] = useState(() => loadOfferTemplates(walletAddress))
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templateSaved, setTemplateSaved] = useState(false)

  const [offerUrl, setOfferUrl] = useState(null)
  const [offerExpiresAt, setOfferExpiresAt] = useState(null)
  const [copied,   setCopied]   = useState(false)

  function handleChange(ev) {
    setForm(prev => ({ ...prev, [ev.target.name]: ev.target.value }))
    setTemplateSaved(false)
  }

  function handleApplyTemplate(template) {
    setSelectedTemplateId(template.id)
    setForm({
      title:     template.title || '',
      desc:      template.desc || '',
      amount:    template.amount || '',
      milestone: template.milestone || '',
      receiver:  template.receiver || '',
      resolver:  template.resolver || '',
      expiresIn: template.expiresIn || 'none',
    })
    setTemplateSaved(false)
  }

  function handleSaveTemplate() {
    if (!form.title.trim() || !form.amount) return
    const updated = saveOfferTemplate(walletAddress, {
      ...form,
      id: selectedTemplateId || undefined,
    })
    setTemplates(updated)
    setTemplateSaved(true)
    setTimeout(() => setTemplateSaved(false), 2000)
  }

  function handleDeleteTemplate(ev, templateId) {
    ev.stopPropagation()
    const updated = deleteOfferTemplate(walletAddress, templateId)
    setTemplates(updated)
    if (selectedTemplateId === templateId) {
      setSelectedTemplateId('')
    }
  }

  function handleGenerate(ev) {
    ev.preventDefault()
    const base = import.meta.env.VITE_APP_URL || window.location.origin
    const url = new URL('/buy', base)
    url.searchParams.set('seller', walletAddress)
    url.searchParams.set('amount', form.amount)
    url.searchParams.set('title',  form.title)
    url.searchParams.set('lang',   lang)
    if (form.desc)      url.searchParams.set('desc',      form.desc)
    if (form.milestone) url.searchParams.set('milestone', form.milestone)
    if (form.receiver)  url.searchParams.set('receiver',  form.receiver)
    if (form.resolver)  url.searchParams.set('resolver',  form.resolver)

    const expiresAt = computeExpirationTimestamp(form.expiresIn)
    if (expiresAt) {
      url.searchParams.set('exp', String(expiresAt))
    }

    setOfferExpiresAt(expiresAt)
    setOfferUrl(url.toString())
    setCopied(false)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(offerUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const canSaveTemplate = Boolean(form.title.trim() && Number(form.amount) > 0)

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
              {form.milestone && (
                <div className="buy-detail-row">
                  <span className="buy-detail-label">{o.qrMilestone}</span>
                  <span style={{ color: 'var(--text)', textAlign: 'right' }}>{form.milestone}</span>
                </div>
              )}
              <div className="buy-detail-row">
                <span className="buy-detail-label">{o.qrSeller}</span>
                <code className="modal-wallet-addr">{shortenAddress(walletAddress)}</code>
              </div>
              {offerExpiresAt && (
                <div className="buy-detail-row">
                  <span className="buy-detail-label">{o.qrExpires}</span>
                  <span style={{ color: 'var(--gold-light)', fontSize: '0.85rem' }}>
                    {new Date(offerExpiresAt).toLocaleString()}
                  </span>
                </div>
              )}
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

        {templates.length > 0 && (
          <div className="offer-templates-box">
            <span className="offer-templates-label">{o.templatesTitle}</span>
            <div className="offer-templates-list">
              {templates.map(tpl => (
                <div
                  key={tpl.id}
                  role="button"
                  tabIndex={0}
                  className={`offer-template-chip${selectedTemplateId === tpl.id ? ' offer-template-chip--active' : ''}`}
                  onClick={() => handleApplyTemplate(tpl)}
                  onKeyDown={ev => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault()
                      handleApplyTemplate(tpl)
                    }
                  }}
                >
                  <span className="offer-template-chip-title">{tpl.title}</span>
                  <span className="offer-template-chip-amount">{tpl.amount} USDC</span>
                  <button
                    type="button"
                    className="offer-template-chip-del"
                    onClick={ev => handleDeleteTemplate(ev, tpl.id)}
                    aria-label={o.deleteTemplate}
                    title={o.deleteTemplate}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

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
              {o.fieldMilestone} <span className="form-hint"> {o.fieldMilestoneHint}</span>
            </label>
            <input
              name="milestone"
              placeholder={o.fieldMilestonePlaceholder}
              value={form.milestone}
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
              {o.fieldReceiver} <span className="form-hint"> {o.fieldReceiverHint}</span>
            </label>
            <input
              name="receiver"
              placeholder={o.fieldReceiverPlaceholder}
              value={form.receiver}
              onChange={handleChange}
            />
          </div>

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
            <label className="form-label">
              {o.fieldExpiration}
            </label>
            <select
              name="expiresIn"
              className="offer-select"
              value={form.expiresIn}
              onChange={handleChange}
            >
              {EXPIRATION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {o.expirationOptions?.[opt.value] || opt.value}
                </option>
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
          <button
            type="button"
            className="btn-modal-ghost"
            onClick={handleSaveTemplate}
            disabled={!canSaveTemplate}
          >
            {templateSaved ? o.templateSaved : o.saveTemplate}
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
