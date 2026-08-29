import { createContext, useContext, useState } from 'react'

const UIContext = createContext(null)

export function UIProvider({ children }) {
  const [activeModal, setActiveModal] = useState(null)

  return (
    <UIContext.Provider value={{ activeModal, setActiveModal }}>
      {children}
    </UIContext.Provider>
  )
}

export function useUI() {
  return useContext(UIContext)
}
