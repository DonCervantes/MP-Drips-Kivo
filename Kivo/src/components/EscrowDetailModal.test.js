import { describe, it, expect } from 'vitest'
import { shorten, isMe, getStatusKey, getActions } from './EscrowDetailModal'

const BUYER_ADDR   = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
const SELLER_ADDR  = 'GCFXHS4GXL6BVUCXBWXGTITROWLVYXQKQLF4YH5O5JT3YZXCYPAFBJZB'
const SIGNER_ADDR  = 'GD6WU64OEP5C4LRBH6NK3MHYIA2ADN6K6II6EXPNVUR3ERBXT4AN4ACD'

describe('shorten (EscrowDetailModal)', () => {
  it('shortens a 56-char Stellar address using default 8..6 lengths', () => {
    expect(shorten(BUYER_ADDR)).toBe('GBBD47IF...LLFLA5')
  })

  it('supports custom start and end slice lengths', () => {
    expect(shorten(BUYER_ADDR, 6, 4)).toBe('GBBD47...FLA5')
  })

  it('returns em-dash when address is empty or null', () => {
    expect(shorten('')).toBe('—')
    expect(shorten(null)).toBe('—')
    expect(shorten(undefined)).toBe('—')
  })
})

describe('isMe', () => {
  it('matches identical addresses case-insensitively', () => {
    expect(isMe(BUYER_ADDR, BUYER_ADDR.toLowerCase())).toBe(true)
  })

  it('returns false for different or missing addresses', () => {
    expect(isMe(BUYER_ADDR, SELLER_ADDR)).toBe(false)
    expect(isMe(null, BUYER_ADDR)).toBe(false)
    expect(isMe(BUYER_ADDR, '')).toBe(false)
  })
})

describe('getStatusKey', () => {
  it('prioritizes flags in order: released > resolved > disputed > approved > active', () => {
    expect(getStatusKey({ flags: { released: true, approved: true } })).toBe('released')
    expect(getStatusKey({ flags: { resolved: true, disputed: true } })).toBe('resolved')
    expect(getStatusKey({ flags: { disputed: true, approved: true } })).toBe('disputed')
    expect(getStatusKey({ flags: { approved: true } })).toBe('approved')
    expect(getStatusKey({ flags: {} })).toBe('active')
    expect(getStatusKey(null)).toBe('active')
  })
})

describe('getActions', () => {
  const baseEscrow = {
    amount: 100,
    balance: 0,
    flags: {},
    roles: {
      approver: BUYER_ADDR,
      serviceProvider: SELLER_ADDR,
      releaseSigner: SIGNER_ADDR,
    },
    milestones: [{ description: 'Entrega inicial', approved: false }],
  }

  it('returns ["fund"] for approver when escrow is unfunded or partially funded', () => {
    expect(getActions(baseEscrow, BUYER_ADDR)).toEqual(['fund'])
    expect(getActions({ ...baseEscrow, balance: 40 }, BUYER_ADDR.toLowerCase())).toEqual(['fund'])
  })

  it('returns [] when unfunded and user is not the approver', () => {
    expect(getActions(baseEscrow, SELLER_ADDR)).toEqual([])
    expect(getActions(baseEscrow, SIGNER_ADDR)).toEqual([])
  })

  it('returns ["approve"] for approver when fully funded and milestone is not approved', () => {
    const fundedEscrow = { ...baseEscrow, balance: 100 }
    expect(getActions(fundedEscrow, BUYER_ADDR)).toEqual(['approve'])
    expect(getActions(fundedEscrow, SIGNER_ADDR)).toEqual([])
  })

  it('returns ["release"] for releaseSigner when fully funded and all milestones are approved', () => {
    const readyToRelease = {
      ...baseEscrow,
      balance: 100,
      milestones: [{ description: 'Entrega inicial', approved: true }],
    }
    expect(getActions(readyToRelease, SIGNER_ADDR)).toEqual(['release'])
    expect(getActions(readyToRelease, BUYER_ADDR)).toEqual([])
  })

  it('returns [] when escrow is already released or resolved', () => {
    const releasedEscrow = {
      ...baseEscrow,
      balance: 100,
      flags: { released: true },
      milestones: [{ description: 'Entrega inicial', approved: true }],
    }
    const resolvedEscrow = {
      ...baseEscrow,
      balance: 0,
      flags: { resolved: true },
    }
    expect(getActions(releasedEscrow, SIGNER_ADDR)).toEqual([])
    expect(getActions(resolvedEscrow, BUYER_ADDR)).toEqual([])
  })
})
