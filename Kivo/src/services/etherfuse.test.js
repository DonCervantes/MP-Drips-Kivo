import { vi, describe, it, expect, beforeEach } from 'vitest'

const TEST_WALLET_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
const TEST_CUSTOMER_ID = '550e8400-e29b-41d4-a716-446655440000'

describe('etherfuse', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  describe('KIVO_WALLET_ID', () => {
    it('reads from VITE_KIVO_WALLET_ID env var', async () => {
      vi.stubEnv('VITE_KIVO_WALLET_ID', TEST_WALLET_ID)
      vi.stubEnv('VITE_KIVO_CUSTOMER_ID', TEST_CUSTOMER_ID)
      vi.resetModules()
      const mod = await import('./etherfuse.js')
      expect(mod.KIVO_WALLET_ID).toBe(TEST_WALLET_ID)
    })
  })

  describe('KIVO_CUSTOMER_ID', () => {
    it('reads from VITE_KIVO_CUSTOMER_ID env var', async () => {
      vi.stubEnv('VITE_KIVO_WALLET_ID', TEST_WALLET_ID)
      vi.stubEnv('VITE_KIVO_CUSTOMER_ID', TEST_CUSTOMER_ID)
      vi.resetModules()
      const mod = await import('./etherfuse.js')
      expect(mod.KIVO_CUSTOMER_ID).toBe(TEST_CUSTOMER_ID)
    })
  })

  describe('when env vars are not set', () => {
    it('returns undefined for missing VITE_KIVO_WALLET_ID', async () => {
      vi.resetModules()
      const mod = await import('./etherfuse.js')
      expect(mod.KIVO_WALLET_ID).toBeUndefined()
    })

    it('returns undefined for missing VITE_KIVO_CUSTOMER_ID', async () => {
      vi.resetModules()
      const mod = await import('./etherfuse.js')
      expect(mod.KIVO_CUSTOMER_ID).toBeUndefined()
    })
  })
})
