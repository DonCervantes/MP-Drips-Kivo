import { useCallback, useMemo, useState } from 'react'
import {
  parseTemplates,
  serializeTemplates,
  upsertTemplate,
  removeTemplate,
} from '../lib/escrowTemplates'

const LS_PREFIX = 'kivo_escrow_templates'

function load(key) {
  if (!key) return []
  try {
    return parseTemplates(localStorage.getItem(key))
  } catch {
    return []
  }
}

function persist(key, list) {
  try {
    localStorage.setItem(key, serializeTemplates(list))
    return true
  } catch {
    return false
  }
}

/**
 * Plantillas guardadas en este navegador para la wallet conectada.
 *
 * save() devuelve false si no se pudo guardar (sin wallet, límite de
 * plantillas alcanzado o almacenamiento bloqueado).
 */
export function useEscrowTemplates(walletAddress) {
  const key = walletAddress ? `${LS_PREFIX}:${walletAddress}` : null
  const [state, setState] = useState(() => ({ key, templates: load(key) }))

  // Cambio de wallet: recargar (ajuste de estado durante el render)
  if (state.key !== key) {
    setState({ key, templates: load(key) })
  }
  const templates = useMemo(
    () => (state.key === key ? state.templates : []),
    [state, key],
  )

  const save = useCallback((template) => {
    if (!key) return false
    const next = upsertTemplate(templates, template)
    if (!next || !persist(key, next)) return false
    setState({ key, templates: next })
    return true
  }, [key, templates])

  const remove = useCallback((id) => {
    if (!key) return
    const next = removeTemplate(templates, id)
    persist(key, next)
    setState({ key, templates: next })
  }, [key, templates])

  return { templates, save, remove }
}
