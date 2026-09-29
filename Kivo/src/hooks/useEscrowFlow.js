import { useState } from 'react'
import {
  useInitializeEscrow,
  useFundEscrow,
  useReleaseFunds,
  useApproveMilestone,
  useStartDispute,
  useResolveDispute,
  useSendTransaction,
} from '@trustless-work/escrow/hooks'
import { useWallet } from '../context/WalletContext'
import { useNetwork } from '../context/NetworkContext'

const USDC_TESTNET = {
  symbol: 'USDC',
  address: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
}

const USDC_MAINNET = {
  symbol: 'USDC',
  address: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
}

const KIVO_PLATFORM_ADDRESS = import.meta.env.VITE_KIVO_PLATFORM_ADDRESS || ''

/**
 * Extrae el mensaje de error real de una respuesta Axios 4xx/5xx.
 * La API de TrustlessWork devuelve el detalle en err.response.data.message
 */
function extractError(err, fallback) {
  const apiMsg =
    err?.response?.data?.message ||
    err?.response?.data?.error  ||
    (typeof err?.response?.data === 'string' ? err.response.data : null)
  return apiMsg || err?.message || fallback
}

export function useEscrowFlow() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [result, setResult]   = useState(null)

  const { signTransaction } = useWallet()
  const { network } = useNetwork()
  const USDC = network === 'mainnet' ? USDC_MAINNET : USDC_TESTNET

  const { deployEscrow }            = useInitializeEscrow()
  const { fundEscrow: fund }        = useFundEscrow()
  const { releaseFunds: release }   = useReleaseFunds()
  const { approveMilestone: approv }= useApproveMilestone()
  const { startDispute }            = useStartDispute()
  const { resolveDispute }          = useResolveDispute()
  const { sendTransaction }         = useSendTransaction()

  async function createEscrow(formData, walletAddress) {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const engagementId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `kivo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

      const payload = {
        signer: walletAddress,
        engagementId,
        title: formData.title,
        description: formData.description,
        amount: Number(formData.amount),
        platformFee: Number(formData.platformFee),
        roles: {
          approver:        walletAddress,
          serviceProvider: formData.serviceProvider,
          platformAddress: KIVO_PLATFORM_ADDRESS || walletAddress,
          releaseSigner:   walletAddress,
          disputeResolver: formData.disputeResolver,
          receiver:        formData.receiver || formData.serviceProvider,
        },
        milestones: [
          { description: formData.milestoneDesc || formData.description },
        ],
        trustline: USDC,
      }

      const { unsignedTransaction, status } = await deployEscrow(payload, 'single-release')
      if (status === 'FAILED' || !unsignedTransaction)
        throw new Error('El despliegue del escrow falló. Revisa tu API Key y conexión.')

      const { signedXdr } = await signTransaction(unsignedTransaction)
      const txResult      = await sendTransaction(signedXdr)

      const contractId = txResult?.contractId || txResult?.data?.contractId || null
      const outcome = { contractId, status: txResult?.status }
      setResult(outcome)
      return outcome
    } catch (err) {
      const msg = extractError(err, 'Error desconocido al crear el escrow.')
      setError(msg)
      throw new Error(msg)
    } finally {
      setLoading(false)
    }
  }

  async function fundEscrow(contractId, amount, walletAddress) {
    setLoading(true)
    setError(null)
    try {
      const { unsignedTransaction, status } = await fund(
        { contractId, amount: Number(amount), signer: walletAddress },
        'single-release'
      )
      if (status === 'FAILED' || !unsignedTransaction)
        throw new Error('No se pudo financiar el escrow.')

      const { signedXdr } = await signTransaction(unsignedTransaction)
      const txResult      = await sendTransaction(signedXdr)
      setResult({ funded: true, status: txResult?.status })
    } catch (err) {
      const msg = extractError(err, 'Error al financiar el escrow.')
      setError(msg)
      throw new Error(msg)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Flujo single-release: el approver debe aprobar el hito
   * ANTES de poder llamar a releaseFunds.
   *
   * ApproveMilestonePayload = { contractId, milestoneIndex, approver }
   */
  async function approveMilestone(contractId, milestoneIndex, walletAddress) {
    setLoading(true)
    setError(null)
    try {
      const { unsignedTransaction, status } = await approv(
        {
          contractId,
          milestoneIndex: String(milestoneIndex),
          approver: walletAddress,
        },
        'single-release'
      )
      if (status === 'FAILED' || !unsignedTransaction)
        throw new Error('No se pudo aprobar el hito.')

      const { signedXdr } = await signTransaction(unsignedTransaction)
      const txResult      = await sendTransaction(signedXdr)
      setResult({ approved: true, status: txResult?.status })
    } catch (err) {
      const msg = extractError(err, 'Error al aprobar el hito.')
      setError(msg)
      throw new Error(msg)
    } finally {
      setLoading(false)
    }
  }

  async function releaseFunds(contractId, releaseSigner) {
    setLoading(true)
    setError(null)
    try {
      const { unsignedTransaction, status } = await release(
        { contractId, releaseSigner },
        'single-release'
      )
      if (status === 'FAILED' || !unsignedTransaction)
        throw new Error('No se pudo liberar los fondos.')

      const { signedXdr } = await signTransaction(unsignedTransaction)
      const txResult      = await sendTransaction(signedXdr)
      setResult({ released: true, status: txResult?.status })
    } catch (err) {
      const msg = extractError(err, 'Error al liberar los fondos.')
      setError(msg)
      throw new Error(msg)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Flujo single-release: approver o serviceProvider abren la disputa.
   * SingleReleaseStartDisputePayload = { contractId, signer }
   */
  async function openDispute(contractId, walletAddress) {
    setLoading(true)
    setError(null)
    try {
      const { unsignedTransaction, status } = await startDispute(
        { contractId, signer: walletAddress },
        'single-release'
      )
      if (status === 'FAILED' || !unsignedTransaction)
        throw new Error('No se pudo abrir la disputa.')

      const { signedXdr } = await signTransaction(unsignedTransaction)
      const txResult      = await sendTransaction(signedXdr)
      setResult({ disputed: true, status: txResult?.status })
    } catch (err) {
      const msg = extractError(err, 'Error al abrir la disputa.')
      setError(msg)
      throw new Error(msg)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Flujo single-release: sólo el disputeResolver puede resolver la disputa.
   * SingleReleaseResolveDisputePayload = {
   *   contractId, disputeResolver,
   *   distributions: [{ address, amount }]
   * }
   * La suma de distributions.amount debe ser igual al monto total del escrow.
   */
  async function resolveEscrowDispute(contractId, disputeResolver, distributions) {
    setLoading(true)
    setError(null)
    try {
      const { unsignedTransaction, status } = await resolveDispute(
        { contractId, disputeResolver, distributions },
        'single-release'
      )
      if (status === 'FAILED' || !unsignedTransaction)
        throw new Error('No se pudo resolver la disputa.')

      const { signedXdr } = await signTransaction(unsignedTransaction)
      const txResult      = await sendTransaction(signedXdr)
      setResult({ resolved: true, status: txResult?.status })
    } catch (err) {
      const msg = extractError(err, 'Error al resolver la disputa.')
      setError(msg)
      throw new Error(msg)
    } finally {
      setLoading(false)
    }
  }

  return { createEscrow, fundEscrow, approveMilestone, releaseFunds, openDispute, resolveEscrowDispute, loading, error, result }
}
