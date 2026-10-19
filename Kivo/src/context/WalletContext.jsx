import { createContext, useContext, useState, useCallback } from 'react'
import { useAccesly } from 'accesly'
import {
  isConnected as freighterIsConnected,
  getAddress as freighterGetAddress,
  requestAccess as freighterRequestAccess,
  signTransaction as freighterSignTransaction,
  getNetwork as freighterGetNetwork,
} from '@stellar/freighter-api'
import { useNetwork } from './networkState'
import { walletNetworkMismatch } from '../config/networks'

const WalletContext = createContext(null)

/**
 * WalletProvider — debe estar dentro de <AcceslyProvider>
 * Expone un wallet unificado: Accesly tiene prioridad si ambos están conectados.
 */
export function WalletProvider({ children }) {
  const { config } = useNetwork()

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
      // Avisar de entrada si Freighter está en otra red que Kivo
      const net = await freighterGetNetwork().catch(() => null)
      const mismatch = walletNetworkMismatch(config, net?.networkPassphrase)
      if (mismatch) setFreighterError(mismatch)
    } catch (err) {
      setFreighterError(err?.message || 'Error al conectar Freighter')
    } finally {
      setFreighterLoading(false)
    }
  }, [config])

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
      // Nunca firmar si Freighter está en otra red que la activa en Kivo
      const net = await freighterGetNetwork().catch(() => null)
      const mismatch = walletNetworkMismatch(config, net?.networkPassphrase)
      if (mismatch) throw new Error(mismatch)
      const result = await freighterSignTransaction(unsignedXdr, {
        networkPassphrase: config.passphrase,
        address: freighterAddr,
      })
      // Freighter v6 devuelve { signedTxXdr }
      return { signedXdr: result.signedTxXdr ?? result }
    }
    throw new Error('No hay wallet conectada')
  }, [walletType, acceslySign, freighterAddr, config])

  return (
    <WalletContext.Provider value={{
      walletAddress,
      walletType,
      signTransaction,
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
