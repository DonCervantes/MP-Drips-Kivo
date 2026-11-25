import { useState, useCallback, useEffect } from 'react'

const STORAGE_PREFIX = 'kivo_seller_offers_'

function getStorageKey(walletAddress) {
  return `${STORAGE_PREFIX}${walletAddress.toLowerCase()}`
}

export function loadSellerOffers(walletAddress) {
  if (!walletAddress) return []
  try {
    const raw = localStorage.getItem(getStorageKey(walletAddress))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveSellerOffer(walletAddress, offerData) {
  if (!walletAddress || !offerData?.url) return null
  const existing = loadSellerOffers(walletAddress)
  const newOffer = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: offerData.title || '',
    desc: offerData.desc || '',
    amount: offerData.amount || '0',
    resolver: offerData.resolver || '',
    lang: offerData.lang || 'es',
    url: offerData.url,
    seller: walletAddress,
    active: true,
    createdAt: Date.now(),
  }
  const updated = [newOffer, ...existing]
  try {
    localStorage.setItem(getStorageKey(walletAddress), JSON.stringify(updated))
  } catch {
    // Ignore storage quota errors
  }
  return newOffer
}

/**
 * Hook para gestionar las ofertas/links creados por el vendedor
 * persistidos en localStorage por wallet.
 */
export function useSellerOffers(walletAddress) {
  const [offers, setOffers] = useState(() => loadSellerOffers(walletAddress))

  useEffect(() => {
    setOffers(loadSellerOffers(walletAddress))
  }, [walletAddress])

  const persist = useCallback((nextOffers) => {
    setOffers(nextOffers)
    if (!walletAddress) return
    try {
      localStorage.setItem(getStorageKey(walletAddress), JSON.stringify(nextOffers))
    } catch {
      // Ignore storage quota errors
    }
  }, [walletAddress])

  const reloadOffers = useCallback(() => {
    setOffers(loadSellerOffers(walletAddress))
  }, [walletAddress])

  const addOffer = useCallback((offerData) => {
    const created = saveSellerOffer(walletAddress, offerData)
    if (created) {
      setOffers(loadSellerOffers(walletAddress))
    }
    return created
  }, [walletAddress])

  const toggleOfferActive = useCallback((id) => {
    const current = loadSellerOffers(walletAddress)
    const next = current.map(o =>
      o.id === id ? { ...o, active: !o.active } : o
    )
    persist(next)
  }, [walletAddress, persist])

  const removeOffer = useCallback((id) => {
    const current = loadSellerOffers(walletAddress)
    const next = current.filter(o => o.id !== id)
    persist(next)
  }, [walletAddress, persist])

  return {
    offers,
    reloadOffers,
    addOffer,
    toggleOfferActive,
    removeOffer,
  }
}
