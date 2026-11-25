import { useState, useCallback, useRef, useMemo } from 'react'
import {
  useGetEscrowsFromIndexerBySigner,
  useGetEscrowsFromIndexerByRole,
} from '@trustless-work/escrow/hooks'
import { computeReputation, toMillis } from '../utils/reputation'

/**
 * Fetches escrows for any Stellar walletAddress and computes
 * buyer, seller, and combined reputation from finalized escrows only.
 */
export function useReputation() {
  const [escrows, setEscrows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const { getEscrowsBySigner } = useGetEscrowsFromIndexerBySigner()
  const { getEscrowsByRole } = useGetEscrowsFromIndexerByRole()

  const signerRef = useRef(getEscrowsBySigner)
  const roleRef = useRef(getEscrowsByRole)
  signerRef.current = getEscrowsBySigner
  roleRef.current = getEscrowsByRole

  const fetchReputation = useCallback(async (walletAddress) => {
    if (!walletAddress) {
      setEscrows([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [asSigner, asBuyer, asSeller] = await Promise.allSettled([
        signerRef.current({ signer: walletAddress }),
        roleRef.current({ role: 'approver', roleAddress: walletAddress }),
        roleRef.current({ role: 'serviceProvider', roleAddress: walletAddress }),
      ])

      const merged = []
      for (const res of [asSigner, asBuyer, asSeller]) {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          merged.push(...res.value)
        }
      }

      const seen = new Set()
      const unique = merged.filter((e) => {
        const key = e.engagementId || e.contractId
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
      })

      unique.sort((a, b) => (toMillis(b.createdAt) ?? 0) - (toMillis(a.createdAt) ?? 0))
      setEscrows(unique)
    } catch (err) {
      setError(err?.message || 'Error al cargar la reputación.')
    } finally {
      setLoading(false)
    }
  }, [])

  const getStats = useCallback(
    (walletAddress) => ({
      all: computeReputation(escrows, walletAddress, 'all'),
      buyer: computeReputation(escrows, walletAddress, 'buyer'),
      seller: computeReputation(escrows, walletAddress, 'seller'),
    }),
    [escrows],
  )

  return useMemo(
    () => ({ escrows, loading, error, fetchReputation, getStats }),
    [escrows, loading, error, fetchReputation, getStats],
  )
}
