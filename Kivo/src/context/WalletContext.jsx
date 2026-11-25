import { createContext, useContext, useState, useCallback } from 'react'
import { useAccesly } from 'accesly'
import {
  isConnected as freighterIsConnected,
  getAddress as freighterGetAddress,
  requestAccess as freighterRequestAccess,
  signMessage as freighterSignMessage,
  signTransaction as freighterSignTransaction,
} from '@stellar/freighter-api'
import { Networks } from '@stellar/stellar-sdk'
import { useNetwork } from './NetworkContext'

const WalletContext = createContext(null)

/**
 * WalletProvider — debe estar dentro de <AcceslyProvider>
 * Expone un wallet unificado: Accesly tiene prioridad si ambos están conectados.
 */
export function WalletProvider({ children }) {
  const { network } = useNetwork()

  const {
    wallet,
    connect: connectAccesly,
    loading: acceslyLoading,
    error: acceslyError,
    signTransaction: acceslySign,
  } = useAccesly()

  const [freighterAddr, setFreighterAddr]       = useState(null)
  const [freighterLoading, setFreighterLoading] = useState(false)
  const [freighterError, setFreighterError]     = useState(null)

  const acceslyAddress = wallet?.stellarAddress ?? null

  // Accesly tiene prioridad; si no está conectado, usa Freighter
  const walletAddress = acceslyAddress || freighterAddr
  const walletType    = acceslyAddress ? 'accesly' : freighterAddr ? 'freighter' : null

  /* ── Freighter: conectar ── */
  const connectFreighter = useCallback(async () => {
    setFreighterLoading(true)
    setFreighterError(null)
    try {
      const { isConnected } = await freighterIsConnected()
      if (!isConnected) {
        setFreighterError('Freighter no está instalado. Agrega la extensión al navegador.')
        return
      }
      await freighterRequestAccess()
      const { address } = await freighterGetAddress()
      setFreighterAddr(address)
    } catch (err) {
      setFreighterError(err?.message || 'Error al conectar Freighter')
    } finally {
      setFreighterLoading(false)
    }
  }, [])

  /* ── Freighter: desconectar ── */
  const disconnectFreighter = useCallback(() => {
    setFreighterAddr(null)
    setFreighterError(null)
  }, [])

  /* ── Firma unificada: ambas vías devuelven { signedXdr } ── */
  const signTransaction = useCallback(async (unsignedXdr) => {
    if (walletType === 'accesly') {
      return acceslySign(unsignedXdr)
    }
    if (walletType === 'freighter') {
      const result = await freighterSignTransaction(unsignedXdr, {
        networkPassphrase: network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET,
        address: freighterAddr,
      })
      // Freighter v6 devuelve { signedTxXdr }
      return { signedXdr: result.signedTxXdr ?? result }
    }
    throw new Error('No hay wallet conectada')
  }, [walletType, acceslySign, freighterAddr, network])

  const signOfferMessage = useCallback(async (message, address) => {
    const result = await freighterSignMessage(message, { address })
    if (result.error) {
      throw new Error(typeof result.error === 'string' ? result.error : result.error.message)
    }
    if (!result.signedMessage || result.signerAddress !== address) {
      throw new Error('La wallet no firmó la oferta con la dirección del vendedor.')
    }

    return typeof result.signedMessage === 'string'
      ? result.signedMessage
      : result.signedMessage.toString('base64')
  }, [])

  return (
    <WalletContext.Provider value={{
      walletAddress,
      walletType,
      signTransaction,
      signOfferMessage,
      // Freighter
      freighterAddr,
      freighterLoading,
      freighterError,
      connectFreighter,
      disconnectFreighter,
      // Accesly passthrough
      connectAccesly,
      acceslyLoading,
      acceslyError,
    }}>
      {children}
    </WalletContext.Provider>
  )
}

export const useWallet = () => useContext(WalletContext)
