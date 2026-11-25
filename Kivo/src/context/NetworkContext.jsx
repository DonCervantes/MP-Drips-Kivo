import { createContext, useContext, useState } from 'react'

const NetworkContext = createContext(null)

export function NetworkProvider({ children }) {
  const [network, setNetwork] = useState('testnet')
  const toggleNetwork = () => setNetwork(n => n === 'testnet' ? 'mainnet' : 'testnet')

  return (
    <NetworkContext.Provider value={{ network, setNetwork, toggleNetwork }}>
      {children}
    </NetworkContext.Provider>
  )
}

export const useNetwork = () => useContext(NetworkContext)
