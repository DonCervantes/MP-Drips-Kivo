import { describe, it, expect } from 'vitest'
import { normalizeOrder, statusFromOrder } from './rampOrder'

describe('normalizeOrder', () => {
  it('unwraps an onramp response', () => {
    const inner = { orderId: 'ord-1', status: 'created', depositClabe: '123456789012345678' }
    expect(normalizeOrder({ onramp: inner })).toEqual(inner)
  })

  it('unwraps an offramp response', () => {
    const inner = { orderId: 'ord-2', status: 'processing', burnTransaction: 'AAAA...' }
    expect(normalizeOrder({ offramp: inner })).toEqual(inner)
  })

  it('returns flat order objects as-is', () => {
    const flat = { orderId: 'ord-3', status: 'completed' }
    expect(normalizeOrder(flat)).toEqual(flat)
  })

  it('returns an empty object for null or undefined', () => {
    expect(normalizeOrder(null)).toEqual({})
    expect(normalizeOrder(undefined)).toEqual({})
  })
})

describe('statusFromOrder', () => {
  it('returns completed for completed status (case-insensitive)', () => {
    expect(statusFromOrder({ status: 'completed' })).toBe('completed')
    expect(statusFromOrder({ status: 'COMPLETED' })).toBe('completed')
  })

  it('returns error for failed or cancelled status', () => {
    expect(statusFromOrder({ status: 'failed' })).toBe('error')
    expect(statusFromOrder({ status: 'cancelled' })).toBe('error')
    expect(statusFromOrder({ status: 'FAILED' })).toBe('error')
  })

  it('returns processing for funded or processing status', () => {
    expect(statusFromOrder({ status: 'funded' })).toBe('processing')
    expect(statusFromOrder({ status: 'processing' })).toBe('processing')
  })

  it('returns awaiting_payment for created status when depositClabe is present', () => {
    expect(statusFromOrder({ status: 'created', depositClabe: '646180111812345678' })).toBe('awaiting_payment')
  })

  it('returns processing for created status when depositClabe is absent', () => {
    expect(statusFromOrder({ status: 'created' })).toBe('processing')
  })

  it('defaults to processing for unknown or missing status', () => {
    expect(statusFromOrder({ status: 'pending' })).toBe('processing')
    expect(statusFromOrder({})).toBe('processing')
    expect(statusFromOrder(null)).toBe('processing')
  })
})
