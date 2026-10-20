import { TrustlessWorkConfig } from '@trustless-work/escrow'
import { useNetwork } from '../context/NetworkContext'

/**
 * Envuelve la app con el proveedor del SDK de Trustless Work.
 * Todas las peticiones van a través del BFF (/api/trustless/:network).
 * Las API keys privadas se inyectan en el servidor y nunca se exponen al cliente.
 */
export function TrustlessWorkProvider({ children }) {
  const { network } = useNetwork()

  const bffBase = import.meta.env.VITE_BFF_URL || ''
  const baseURL = `${bffBase}/api/trustless/${network}`

  return (
    <TrustlessWorkConfig key={network} baseURL={baseURL}>
      {children}
    </TrustlessWorkConfig>
  )
}
