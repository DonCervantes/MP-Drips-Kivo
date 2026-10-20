import { useState, useCallback, useRef } from 'react'
import {
  useGetEscrowsFromIndexerBySigner,
  useGetEscrowsFromIndexerByRole,
} from '@trustless-work/escrow/hooks'

/**
 * Devuelve todos los escrows relacionados con walletAddress,
 * sin importar el rol (creador, vendedor, etc.).
 * Desduplicados por engagementId.
 */
export function useMyEscrows() {
  const [escrows, setEscrows]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  const { getEscrowsBySigner } = useGetEscrowsFromIndexerBySigner()
  const { getEscrowsByRole }   = useGetEscrowsFromIndexerByRole()

  // Guardamos las funciones del SDK en refs para que useCallback no cambie
  // de referencia cada render (los hooks del SDK devuelven funciones nuevas
  // en cada render, lo que causaría un bucle infinito).
  const signerRef = useRef(getEscrowsBySigner)
  const roleRef   = useRef(getEscrowsByRole)
  signerRef.current = getEscrowsBySigner
  roleRef.current   = getEscrowsByRole

  const fetchEscrows = useCallback(async (walletAddress) => {
    if (!walletAddress) return
    setLoading(true)
    setError(null)

    try {
      const unique = await fetchEscrowsForWallet(signerRef.current, roleRef.current, walletAddress)
      setEscrows(unique)
    } catch (err) {
      setError(err?.message || 'Error al cargar los escrows.')
    } finally {
      setLoading(false)
    }
  // deps vacíos: usamos refs para las funciones del SDK,
  // así fetchEscrows tiene referencia estable y no causa bucles.
  }, [])

  return { escrows, loading, error, fetchEscrows }
}

/**
 * Trae del indexer todos los escrows de walletAddress (como firmante y como
 * vendedor), desduplicados y del más reciente al más antiguo.
 * Se comparte con NotificationsContext para no duplicar la consulta.
 *
 * Con `strict: true` lanza error si ambas consultas fallan, en lugar de
 * devolver una lista vacía (las notificaciones no deben confundir un fallo
 * del indexer con "no tienes escrows").
 */
export async function fetchEscrowsForWallet(getEscrowsBySigner, getEscrowsByRole, walletAddress, { strict = false } = {}) {
  // Fetch en paralelo: como firmante Y como vendedor
  const [asSigner, asServiceProvider] = await Promise.allSettled([
    getEscrowsBySigner({ signer: walletAddress }),
    getEscrowsByRole({ role: 'serviceProvider', roleAddress: walletAddress }),
  ])

  if (strict && asSigner.status === 'rejected' && asServiceProvider.status === 'rejected') {
    throw asSigner.reason
  }

  const merge = []

  if (asSigner.status === 'fulfilled' && Array.isArray(asSigner.value)) {
    merge.push(...asSigner.value)
  }
  if (asServiceProvider.status === 'fulfilled' && Array.isArray(asServiceProvider.value)) {
    merge.push(...asServiceProvider.value)
  }

  // Deduplicar por engagementId
  const seen = new Set()
  const unique = merge.filter(e => {
    const key = e.engagementId || e.contractId
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Más reciente primero
  unique.sort((a, b) => {
    const ta = a.createdAt?._seconds ?? 0
    const tb = b.createdAt?._seconds ?? 0
    return tb - ta
  })

  return unique
}

/** Determina el rol principal del usuario en un escrow */
export function getMyRole(escrow, walletAddress) {
  if (!escrow?.roles || !walletAddress) return null
  const r = escrow.roles
  const addr = walletAddress.toLowerCase()
  if (r.approver?.toLowerCase()       === addr) return 'Comprador'
  if (r.serviceProvider?.toLowerCase() === addr) return 'Vendedor'
  if (r.disputeResolver?.toLowerCase() === addr) return 'Árbitro'
  if (r.releaseSigner?.toLowerCase()   === addr) return 'Firmante'
  if (r.receiver?.toLowerCase()        === addr) return 'Receptor'
  if (r.platformAddress?.toLowerCase() === addr) return 'Plataforma'
  return 'Participante'
}

/** Resuelve el estado visible del escrow a partir de sus flags */
export function getEscrowStatus(escrow) {
  const f = escrow?.flags ?? {}
  if (f.released)  return { label: 'Liberado',    color: 'status-released'  }
  if (f.resolved)  return { label: 'Resuelto',    color: 'status-resolved'  }
  if (f.disputed)  return { label: 'En Disputa',  color: 'status-disputed'  }
  if (f.approved)  return { label: 'Aprobado',    color: 'status-approved'  }
  return               { label: 'Activo',       color: 'status-active'    }
}
