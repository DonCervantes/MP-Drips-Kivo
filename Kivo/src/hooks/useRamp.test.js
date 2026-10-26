import { describe, it, expect } from 'vitest'
import { normalizeOrder, statusFromOrder } from './useRamp'

describe('normalizeOrder', () => {
  it('unwraps onramp order response from createOrder', () => {
    const raw = {
      onramp: {
        orderId: 'ord-onramp-1',
        status: 'created',
        depositClabe: '646180157000000001',
      },
    }
    expect(normalizeOrder(raw)).toEqual(raw.onramp)
  })

  it('unwraps offramp order response from createOrder', () => {
    const raw = {
      offramp: {
        orderId: 'ord-offramp-1',
        status: 'created',
        burnTransaction: 'AAAA...',
      },
    }
    expect(normalizeOrder(raw)).toEqual(raw.offramp)
  })

  it('returns flat order object from getOrder directly', () => {
    const flat = {
      orderId: 'ord-flat-1',
      status: 'completed',
      sourceAmount: '500',
    }
    expect(normalizeOrder(flat)).toEqual(flat)
  })

  it('returns empty object for null or undefined input', () => {
    expect(normalizeOrder(null)).toEqual({})
    expect(normalizeOrder(undefined)).toEqual({})
  })
})

describe('statusFromOrder', () => {
  it('maps completed status to completed (case-insensitive)', () => {
    expect(statusFromOrder({ status: 'completed' })).toBe('completed')
    expect(statusFromOrder({ status: 'COMPLETED' })).toBe('completed')
  })

  it('maps failed and cancelled statuses to error', () => {
    expect(statusFromOrder({ status: 'failed' })).toBe('error')
    expect(statusFromOrder({ status: 'cancelled' })).toBe('error')
    expect(statusFromOrder({ status: 'FAILED' })).toBe('error')
  })

  it('maps funded and processing statuses to processing', () => {
    expect(statusFromOrder({ status: 'funded' })).toBe('processing')
    expect(statusFromOrder({ status: 'processing' })).toBe('processing')
  })

  it('maps created with depositClabe to awaiting_payment (onramp SPEI)', () => {
    expect(
      statusFromOrder({
        status: 'created',
        depositClabe: '646180157000000001',
      })
    ).toBe('awaiting_payment')
  })

  it('maps created without depositClabe to processing (offramp)', () => {
    expect(statusFromOrder({ status: 'created' })).toBe('processing')
  })

  it('defaults unknown or missing status to processing', () => {
    expect(statusFromOrder({})).toBe('processing')
    expect(statusFromOrder(null)).toBe('processing')
    expect(statusFromOrder({ status: 'pending_review' })).toBe('processing')
  })
})
