import { TrustlessWorkConfig, development, mainNet } from '@trustless-work/escrow'
import { useNetwork } from '../context/networkState'

const BASE_URLS = { development, mainNet }

/**
 * Envuelve la app con el proveedor del SDK de Trustless Work.
 * Endpoint y API key salen de la configuración de red activa (src/config/networks.js).
 */
export function TrustlessWorkProvider({ children }) {
  const { config } = useNetwork()

  const apiKey = import.meta.env[config.trustlessApiKeyEnv] || ''
  const baseURL = BASE_URLS[config.trustless]

  return (
    <TrustlessWorkConfig baseURL={baseURL} apiKey={apiKey}>
      {children}
    </TrustlessWorkConfig>
  )
}
