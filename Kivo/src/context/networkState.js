import { createContext, useContext } from 'react'

/** Value: { network, config, toggleNetwork, setNetwork, canUseMainnet, mainnetBlockers, networkError } */
export const NetworkContext = createContext(null)

export const useNetwork = () => useContext(NetworkContext)
