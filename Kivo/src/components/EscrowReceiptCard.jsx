import { useState } from 'react'
import { useNetwork } from '../context/NetworkContext'
import { useLanguage } from '../context/LanguageContext'

const DISPLAY_ROLES = ['approver', 'serviceProvider', 'receiver', 'disputeResolver']

function shortenAddress(addr, start = 6, end = 4) {
  if (!addr) return '—'
  if (addr.length <= start + end + 3) return addr
  return `${addr.slice(0, start)}...${addr.slice(-end)}`
}

function getStellarExpertUrl(contractId, network) {
  if (!contractId) return ''
  const netSegment = network === 'mainnet' ? 'public' : 'testnet'
  return `https://stellar.expert/explorer/${netSegment}/contract/${contractId}`
}

function buildReceiptText({
  heading,
  title,
  contractId,
  amount,
  symbol,
  networkLabel,
  roleEntries,
  explorerUrl,
  labels,
}) {
  const lines = [
    `Kivo — ${heading}`,
    title ? `${labels.title}: ${title}` : null,
    `${labels.amount}: ${amount} ${symbol}`,
    `${labels.network}: Stellar ${networkLabel}`,
    `${labels.contractId}: ${contractId}`,
    ...roleEntries.map(({ label, short }) => `${label}: ${short}`),
    explorerUrl ? `${labels.explorer}: ${explorerUrl}` : null,
  ].filter(Boolean)

  return lines.join('\n')
}

export function EscrowReceiptCard({
  type = 'created',
  contractId,
  title,
  amount,
  symbol = 'USDC',
  roles = {},
}) {
  const { network } = useNetwork()
  const { t } = useLanguage()
  const r = t.receipt
  const roleLabels = t.detail?.roles ?? {}

  const [copied, setCopied] = useState(false)
  const [copiedId, setCopiedId] = useState(false)

  if (!contractId) return null

  const networkLabel = network === 'mainnet' ? 'Mainnet' : 'Testnet'
  const explorerUrl = getStellarExpertUrl(contractId, network)
  const heading = type === 'released' ? r.releasedTitle : r.createdTitle

  const roleEntries = DISPLAY_ROLES
    .filter(key => Boolean(roles?.[key]))
    .map(key => ({
      key,
      label: roleLabels[key]?.label ?? key,
      short: shortenAddress(roles[key]),
    }))

  const receiptText = buildReceiptText({
    heading,
    title,
    contractId,
    amount: amount ?? '—',
    symbol,
    networkLabel,
    roleEntries,
    explorerUrl,
    labels: r,
  })

  async function handleCopyReceipt() {
    try {
      await navigator.clipboard.writeText(receiptText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API unavailable
    }
  }

  async function handleCopyContractId() {
    try {
      await navigator.clipboard.writeText(contractId)
      setCopiedId(true)
      setTimeout(() => setCopiedId(false), 2000)
    } catch {
      // Clipboard API unavailable
    }
  }

  async function handleShare() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Kivo — ${heading}`,
          text: receiptText,
          url: explorerUrl,
        })
        return
      } catch (err) {
        if (err?.name === 'AbortError') return
      }
    }
    const waUrl = `https://wa.me/?text=${encodeURIComponent(receiptText)}`
    window.open(waUrl, '_blank', 'noopener,noreferrer')
  }

  const mailtoHref = `mailto:?subject=${encodeURIComponent(`Kivo — ${heading}`)}&body=${encodeURIComponent(receiptText)}`

  return (
    <div className="receipt-card" role="region" aria-label={heading}>
      <div className="receipt-header">
        <span className="receipt-tag">{heading}</span>
        <span className={`receipt-net-badge ${network === 'mainnet' ? 'receipt-net-mainnet' : 'receipt-net-testnet'}`}>
          Stellar {networkLabel}
        </span>
      </div>

      {title && <p className="receipt-deal-title">{title}</p>}

      <div className="receipt-amount-row">
        <span className="receipt-label">{r.amount}</span>
        <span className="receipt-amount-val">
          {amount ?? '—'} <span className="receipt-amount-sym">{symbol}</span>
        </span>
      </div>

      <div className="receipt-contract">
        <span className="receipt-label">{r.contractId}</span>
        <div className="receipt-contract-row">
          <code className="receipt-contract-val">{contractId}</code>
          <button
            type="button"
            className="receipt-copy-id"
            onClick={handleCopyContractId}
            title={r.copyId}
          >
            {copiedId ? '✓' : r.copyId}
          </button>
        </div>
      </div>

      {roleEntries.length > 0 && (
        <div className="receipt-roles">
          <span className="receipt-label">{r.roles}</span>
          <div className="receipt-roles-list">
            {roleEntries.map(({ key, label, short }) => (
              <div key={key} className="receipt-role-row">
                <span className="receipt-role-name">{label}</span>
                <code className="receipt-role-addr">{short}</code>
              </div>
            ))}
          </div>
        </div>
      )}

      <a
        className="receipt-explorer-link"
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        <span>{r.viewOnExplorer}</span>
        <span aria-hidden="true">↗</span>
      </a>

      <div className="receipt-actions">
        <button
          type="button"
          className="receipt-btn receipt-btn-primary"
          onClick={handleCopyReceipt}
        >
          {copied ? r.copied : r.copyReceipt}
        </button>
        <button
          type="button"
          className="receipt-btn receipt-btn-share"
          onClick={handleShare}
        >
          {r.share}
        </button>
        <a
          className="receipt-btn receipt-btn-ghost"
          href={mailtoHref}
        >
          {r.email}
        </a>
      </div>
    </div>
  )
}
