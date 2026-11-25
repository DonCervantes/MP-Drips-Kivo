const STORAGE_KEY_PREFIX = 'kivo_offer_templates'

export const EXPIRATION_OPTIONS = [
  { value: 'none', ms: 0 },
  { value: '1h',   ms: 60 * 60 * 1000 },
  { value: '24h',  ms: 24 * 60 * 60 * 1000 },
  { value: '7d',   ms: 7 * 24 * 60 * 60 * 1000 },
  { value: '30d',  ms: 30 * 24 * 60 * 60 * 1000 },
]

function getStorageKey(walletAddress) {
  return walletAddress
    ? `${STORAGE_KEY_PREFIX}_${walletAddress}`
    : STORAGE_KEY_PREFIX
}

export function loadOfferTemplates(walletAddress) {
  try {
    const raw = localStorage.getItem(getStorageKey(walletAddress))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveOfferTemplate(walletAddress, template) {
  const templates = loadOfferTemplates(walletAddress)
  const entry = {
    id:        template.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title:     (template.title || '').trim(),
    desc:      (template.desc || '').trim(),
    amount:    String(template.amount || '').trim(),
    milestone: (template.milestone || '').trim(),
    receiver:  (template.receiver || '').trim(),
    resolver:  (template.resolver || '').trim(),
    expiresIn: template.expiresIn || 'none',
    updatedAt: Date.now(),
  }

  const existingIndex = templates.findIndex(
    t => t.id === entry.id || t.title.toLowerCase() === entry.title.toLowerCase()
  )

  const next = existingIndex >= 0
    ? templates.map((t, idx) => (idx === existingIndex ? { ...entry, id: t.id } : t))
    : [entry, ...templates]

  try {
    localStorage.setItem(getStorageKey(walletAddress), JSON.stringify(next))
  } catch {
    // Ignore storage quota errors
  }

  return next
}

export function deleteOfferTemplate(walletAddress, templateId) {
  const templates = loadOfferTemplates(walletAddress)
  const next = templates.filter(t => t.id !== templateId)
  try {
    localStorage.setItem(getStorageKey(walletAddress), JSON.stringify(next))
  } catch {
    // Ignore storage errors
  }
  return next
}

export function computeExpirationTimestamp(expiresIn, now = Date.now()) {
  const option = EXPIRATION_OPTIONS.find(opt => opt.value === expiresIn)
  if (!option || !option.ms) return null
  return now + option.ms
}
