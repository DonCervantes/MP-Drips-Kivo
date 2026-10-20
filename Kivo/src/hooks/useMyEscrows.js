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
      // Fetch en paralelo: como firmante Y como vendedor
      const [asSigner, asServiceProvider] = await Promise.allSettled([
        signerRef.current({ signer: walletAddress }),
        roleRef.current({ role: 'serviceProvider', roleAddress: walletAddress }),
      ])

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

/**
 * Calcula métricas de reputación básica a partir de escrows finalizados.
 * Solo considera escrows liberados o resueltos (finalizados).
 * No introduce KYC: únicamente métricas derivadas de escrows.
 *
 * @param {Array} escrows - Lista de escrows del usuario.
 * @param {string} walletAddress - Dirección de la wallet del usuario.
 * @returns {{
 *   completedOperations: number,
 *   historicalVolume: number,
 *   disputeRate: number,
 *   averageReleaseTimeMs: number|null,
 *   verificationSignals: { hasCompletedOperations: boolean, hasCleanDisputeRecord: boolean }
 * }}
 */
export function getReputationMetrics(escrows, walletAddress) {
  const list = Array.isArray(escrows) ? escrows : []
  const addr = walletAddress?.toLowerCase()

  const isFinalized = (e) => Boolean(e?.flags?.released || e?.flags?.resolved)
  const isDisputed   = (e) => Boolean(e?.flags?.disputed || e?.flags?.resolved)

  // Solo escrows finalizados cuentan para reputación
  const finalized = list.filter(isFinalized)

  const completedOperations = finalized.length

  // Volumen histórico: suma de montos de escrows finalizados
  const historicalVolume = finalized.reduce((sum, e) => {
    const amount = Number(e?.amount ?? e?.balance ?? 0)
    return sum + (Number.isFinite(amount) ? amount : 0)
  }, 0)

  // Tasa de disputas: disputas sobre operaciones finalizadas
  const disputedCount = finalized.filter(isDisputed).length
  const disputeRate = completedOperations > 0 ? disputedCount / completedOperations : 0

  // Tiempo promedio de liberación (ms) entre creación y liberación
  const releaseTimes = finalized
    .filter(e => e?.flags?.released)
    .map(e => {
      const created = e?.createdAt?._seconds ?? e?.createdAt?.seconds
      const released = e?.releasedAt?._seconds ?? e?.releasedAt?.seconds ?? e?.updatedAt?._seconds ?? e?.updatedAt?.seconds
      if (typeof created !== 'number' || typeof released !== 'number') return null
      const diff = (released - created) * 1000
      return diff >= 0 ? diff : null
    })
    .filter(t => t !== null)

  const averageReleaseTimeMs = releaseTimes.length > 0
    ? releaseTimes.reduce((a, b) => a + b, 0) / releaseTimes.length
    : null

  // Señales de verificación opcionales (derivadas, sin KYC)
  const verificationSignals = {
    hasCompletedOperations: completedOperations > 0,
    hasCleanDisputeRecord: completedOperations > 0 && disputeRate === 0,
  }

  // addr se mantiene para futuras métricas por rol; evita lint de variable sin uso
  void addr

  return {
    completedOperations,
    historicalVolume,
    disputeRate,
    averageReleaseTimeMs,
    verificationSignals,
  }
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
