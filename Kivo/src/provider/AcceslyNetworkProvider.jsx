import { AcceslyProvider } from 'accesly'
import { useNetwork } from '../context/networkState'

/**
 * AcceslyProvider bound to the active network. Keyed by network so switching
 * networks remounts the wallet layer instead of keeping a session that signs
 * for the previous network.
 */
export function AcceslyNetworkProvider({ children }) {
  const { config } = useNetwork()
  return (
    <AcceslyProvider
      key={config.id}
      appId={import.meta.env.VITE_ACCESLY_APP_ID}
      network={config.accesly}
      theme="dark"
    >
      {children}
    </AcceslyProvider>
  )
}
