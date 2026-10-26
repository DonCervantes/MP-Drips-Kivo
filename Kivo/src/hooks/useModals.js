import { useState, useCallback } from 'react'

export function useModals() {
  const [showEscrow, setShowEscrow] = useState(false)
  const [showDrawer, setShowDrawer] = useState(false)
  const [showRamp,   setShowRamp]   = useState(false)
  const [showOffer,  setShowOffer]  = useState(false)

  const openEscrow  = useCallback(() => setShowEscrow(true), [])
  const closeEscrow = useCallback(() => setShowEscrow(false), [])

  const openDrawer  = useCallback(() => setShowDrawer(true), [])
  const closeDrawer = useCallback(() => setShowDrawer(false), [])

  const openRamp    = useCallback(() => setShowRamp(true), [])
  const closeRamp   = useCallback(() => setShowRamp(false), [])

  const openOffer   = useCallback(() => setShowOffer(true), [])
  const closeOffer  = useCallback(() => setShowOffer(false), [])

  return {
    showEscrow,
    showDrawer,
    showRamp,
    showOffer,
    setShowEscrow,
    setShowDrawer,
    setShowRamp,
    setShowOffer,
    openEscrow,
    closeEscrow,
    openDrawer,
    closeDrawer,
    openRamp,
    closeRamp,
    openOffer,
    closeOffer,
  }
}
