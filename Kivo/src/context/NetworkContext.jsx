import { useCallback, useMemo, useState } from 'react'
import { NetworkContext } from './networkState'
import { DEFAULT_NETWORK, getNetworkConfig, mainnetBlockers } from '../config/networks'

/**
 * Holds the active network. Switching to Mainnet is refused while any
 * dependency lacks a mainnet configuration (see `mainnetBlockers`).
 */
export function NetworkProvider({ children, env = import.meta.env }) {
  const [network, setNetworkState] = useState(DEFAULT_NETWORK)
  const [networkError, setNetworkError] = useState(null)
  const blockers = useMemo(() => mainnetBlockers(env), [env])

  const setNetwork = useCallback((next) => {
    getNetworkConfig(next)
    if (next === 'mainnet' && blockers.length > 0) {
      setNetworkError(`No se puede activar Mainnet: ${blockers.join('; ')}`)
      return false
    }
    setNetworkError(null)
    setNetworkState(next)
    return true
  }, [blockers])

  const toggleNetwork = useCallback(
    () => setNetwork(network === 'testnet' ? 'mainnet' : 'testnet'),
    [network, setNetwork],
  )

  const value = useMemo(() => ({
    network,
    config: getNetworkConfig(network),
    setNetwork,
    toggleNetwork,
    canUseMainnet: blockers.length === 0,
    mainnetBlockers: blockers,
    networkError,
  }), [network, setNetwork, toggleNetwork, blockers, networkError])

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
}
