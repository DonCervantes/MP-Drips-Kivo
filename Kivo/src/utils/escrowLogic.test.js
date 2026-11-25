import { describe, it, expect } from 'vitest'
import { shorten, isMe, getStatusKey, getActions } from './escrowLogic'

const APPROVER = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
const RELEASE_SIGNER = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'
const OTHER = 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC'

describe('shorten', () => {
  it('shortens a Stellar address with default start=8 and end=6', () => {
    const addr = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ'
    expect(shorten(addr)).toBe('GA7QYNF7...UJVSGZ')
  })

  it('supports custom start and end lengths', () => {
    const addr = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ'
    expect(shorten(addr, 6, 4)).toBe('GA7QYN...VSGZ')
  })

  it('returns em-dash for empty, null, or undefined addresses', () => {
    expect(shorten('')).toBe('—')
    expect(shorten(null)).toBe('—')
    expect(shorten(undefined)).toBe('—')
  })
})

describe('isMe', () => {
  it('matches addresses case-insensitively', () => {
    expect(isMe(APPROVER, APPROVER.toLowerCase())).toBe(true)
  })

  it('returns false when addresses differ or are missing', () => {
    expect(isMe(APPROVER, OTHER)).toBe(false)
    expect(isMe(null, APPROVER)).toBe(false)
    expect(isMe(APPROVER, '')).toBe(false)
  })
})

describe('getStatusKey', () => {
  it('prioritizes released > resolved > disputed > approved > active', () => {
    expect(getStatusKey({ flags: { released: true, resolved: true, disputed: true, approved: true } })).toBe('released')
    expect(getStatusKey({ flags: { resolved: true, disputed: true, approved: true } })).toBe('resolved')
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
      approver: APPROVER,
      releaseSigner: RELEASE_SIGNER,
    },
    milestones: [{ description: 'Entrega', approved: false }],
  }

  it('returns ["fund"] for approver when escrow is not fully funded', () => {
    expect(getActions(baseEscrow, APPROVER)).toEqual(['fund'])
    expect(getActions({ ...baseEscrow, balance: 50 }, APPROVER)).toEqual(['fund'])
  })

  it('returns ["approve"] for approver when fully funded and milestones are not all approved', () => {
    const funded = { ...baseEscrow, balance: 100 }
    expect(getActions(funded, APPROVER)).toEqual(['approve'])
  })

  it('returns ["release"] for releaseSigner when fully funded and all milestones are approved', () => {
    const readyToRelease = {
      ...baseEscrow,
      balance: 100,
      milestones: [{ description: 'Entrega', approved: true }],
    }
    expect(getActions(readyToRelease, RELEASE_SIGNER)).toEqual(['release'])
  })

  it('matches wallet address case-insensitively', () => {
    expect(getActions(baseEscrow, APPROVER.toLowerCase())).toEqual(['fund'])
  })

  it('returns [] for users without a matching role for the current step', () => {
    expect(getActions(baseEscrow, RELEASE_SIGNER)).toEqual([])
    expect(getActions(baseEscrow, OTHER)).toEqual([])
  })

  it('returns [] when escrow is already released or resolved', () => {
    expect(getActions({ ...baseEscrow, flags: { released: true } }, APPROVER)).toEqual([])
    expect(getActions({ ...baseEscrow, flags: { resolved: true } }, APPROVER)).toEqual([])
  })

  it('does not offer release when milestones array is empty', () => {
    const noMilestones = { ...baseEscrow, balance: 100, milestones: [] }
    expect(getActions(noMilestones, RELEASE_SIGNER)).toEqual([])
  })
})
