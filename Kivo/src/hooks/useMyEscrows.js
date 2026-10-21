import { useState, useCallback, useRef } from 'react'
import {
  useGetEscrowsFromIndexerBySigner,
  useGetEscrowsFromIndexerByRole,
} from '@trustless-work/escrow/hooks'

/**
 * Devuelve todos los escrows relacionados con walletAddress,
 * sin importar el rol (creador, vendedor, receptor, árbitro, etc.).
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
      // Fetch en paralelo: firmante, vendedor, receptor, árbitro y comprador
      const results = await Promise.allSettled([
        signerRef.current({ signer: walletAddress }),
        roleRef.current({ role: 'serviceProvider', roleAddress: walletAddress }),
        roleRef.current({ role: 'receiver', roleAddress: walletAddress }),
        roleRef.current({ role: 'disputeResolver', roleAddress: walletAddress }),
        roleRef.current({ role: 'approver', roleAddress: walletAddress }),
      ])

      const merge = []

      results.forEach(result => {
        if (result.status === 'fulfilled' && Array.isArray(result.value)) {
          merge.push(...result.value)
        }
      })

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
