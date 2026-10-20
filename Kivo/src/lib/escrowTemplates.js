/**
 * Plantillas de escrow para servicios recurrentes (lógica pura).
 *
 * Una plantilla guarda lo que se repite entre ofertas: título, descripción,
 * monto sugerido, roles por defecto, el hito único y la expiración del
 * enlace de oferta. Se usa tanto en "Crear Escrow" como en "Vender" (QR).
 *
 * Multi-milestone queda fuera a propósito: sólo se guarda el hito único de
 * single-release hasta cerrar esa decisión (ver issue #78 / PR #28).
 */

export const TEMPLATES_VERSION = 1
export const MAX_TEMPLATES = 20
export const MAX_NAME_LENGTH = 60

/** Opciones de expiración del enlace de oferta, en horas (0 = sin expiración) */
export const EXPIRY_OPTIONS = [0, 24, 72, 168, 720]

const HOUR_MS = 60 * 60 * 1000

function str(v) {
  return typeof v === 'string' ? v.trim() : ''
}

function amountStr(v) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? String(v).trim() : ''
}

function expiryHours(v) {
  const n = Number(v)
  return EXPIRY_OPTIONS.includes(n) ? n : 0
}

function newId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** Limpia una plantilla leída de almacenamiento; null si no es válida */
export function normalizeTemplate(raw) {
  if (!raw || typeof raw !== 'object') return null
  const name = str(raw.name).slice(0, MAX_NAME_LENGTH)
  if (!name) return null
  const roles = raw.roles && typeof raw.roles === 'object' ? raw.roles : {}
  return {
    id:            str(raw.id) || newId(),
    name,
    title:         str(raw.title),
    description:   str(raw.description),
    milestoneDesc: str(raw.milestoneDesc),
    amount:        amountStr(raw.amount),
    roles: {
      serviceProvider: str(roles.serviceProvider),
      receiver:        str(roles.receiver),
      disputeResolver: str(roles.disputeResolver),
    },
    linkExpiryHours: expiryHours(raw.linkExpiryHours),
    updatedAt:       Number(raw.updatedAt) || 0,
  }
}

/** Lista de plantillas a partir del JSON guardado (tolerante a datos corruptos) */
export function parseTemplates(json) {
  let data
  try { data = JSON.parse(json) } catch { return [] }
  const list = Array.isArray(data?.templates) ? data.templates : []
  return list.map(normalizeTemplate).filter(Boolean).slice(0, MAX_TEMPLATES)
}

export function serializeTemplates(list) {
  return JSON.stringify({ version: TEMPLATES_VERSION, templates: list })
}

/**
 * Inserta o reemplaza (mismo nombre, sin distinguir mayúsculas) y deja la
 * más reciente primero. Devuelve null si se alcanzó el máximo.
 */
export function upsertTemplate(list, template, now = Date.now()) {
  const tpl = normalizeTemplate({ ...template, updatedAt: now })
  if (!tpl) return null
  const current = Array.isArray(list) ? list : []
  const existing = current.find(t => t.name.toLowerCase() === tpl.name.toLowerCase())
  const rest = current.filter(t => t !== existing)
  if (!existing && rest.length >= MAX_TEMPLATES) return null
  return [{ ...tpl, id: existing?.id ?? tpl.id }, ...rest]
}

export function removeTemplate(list, id) {
  return (Array.isArray(list) ? list : []).filter(t => t.id !== id)
}

/* ── Formulario "Crear Escrow" (EscrowModal) ─────────────────────────── */

export function templateFromEscrowForm(name, form) {
  return {
    name,
    title:         form.title,
    description:   form.description,
    milestoneDesc: form.milestoneDesc,
    amount:        form.amount,
    roles: {
      serviceProvider: form.serviceProvider,
      receiver:        form.receiver,
      disputeResolver: form.disputeResolver,
    },
  }
}

/**
 * Rellena el formulario con la plantilla. Los campos que maneja la plantilla
 * se reemplazan por completo (también los vacíos) para que al cambiar de
 * plantilla no queden direcciones de la anterior.
 */
export function applyTemplateToEscrowForm(template, form) {
  const r = template.roles ?? {}
  return {
    ...form,
    title:           template.title         ?? '',
    description:     template.description   ?? '',
    milestoneDesc:   template.milestoneDesc ?? '',
    amount:          template.amount        ?? '',
    serviceProvider: r.serviceProvider      ?? '',
    receiver:        r.receiver             ?? '',
    disputeResolver: r.disputeResolver      ?? '',
  }
}

/* ── Formulario "Vender" con QR (CreateOfferModal) ───────────────────── */

export function templateFromOfferForm(name, form) {
  return {
    name,
    title:           form.title,
    description:     form.desc,
    amount:          form.amount,
    roles:           { disputeResolver: form.resolver },
    linkExpiryHours: form.expiryHours,
  }
}

export function applyTemplateToOfferForm(template, form) {
  return {
    ...form,
    title:       template.title                  ?? '',
    desc:        template.description            ?? '',
    amount:      template.amount                 ?? '',
    resolver:    template.roles?.disputeResolver ?? '',
    expiryHours: template.linkExpiryHours        ?? 0,
  }
}

/* ── Expiración del enlace ───────────────────────────────────────────── */

/** Timestamp (ms) de expiración, o null si no expira */
export function offerExpiresAt(hours, now = Date.now()) {
  const h = expiryHours(hours)
  return h > 0 ? now + h * HOUR_MS : null
}

/**
 * Lee el parámetro `exp` de la URL de oferta.
 * Sin parámetro → no expira. Valor inválido → se trata como vencido
 * (un enlace alterado no debe aceptarse).
 */
export function offerExpiryState(expParam, now = Date.now()) {
  if (expParam === null || expParam === undefined || expParam === '') {
    return { expiresAt: null, expired: false }
  }
  const expiresAt = Number(expParam)
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) return { expiresAt: null, expired: true }
  return { expiresAt, expired: now >= expiresAt }
}
