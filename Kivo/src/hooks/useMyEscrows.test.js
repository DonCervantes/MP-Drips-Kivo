import { describe, it, expect } from 'vitest'
import { getMyRole, getEscrowStatus } from './useMyEscrows'
import { shorten, getRoleKey, getStatusKey } from '../components/EscrowDrawer'

const ADDR_APPROVER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
const ADDR_PROVIDER = 'GCFXHS4GXL6BVUCXBWXGTITROWLVYXQKQLF4YH5O5JT3YZXCYPAFBJZB'
const ADDR_RESOLVER = 'GD6WU64OEP5C4LRBH6NK3MHYIA2ADN6K6II6EXPNVUR3ERBXT4AN4ACD'
const ADDR_SIGNER   = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
const ADDR_RECEIVER = 'GBDEVU63Y6NTHJQQZIKVTC23NWLQVP3WJ2RI2OTSJTNYOIGICST6DUXR'
const ADDR_PLATFORM = 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ'
const ADDR_OTHER    = 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37'

describe('useMyEscrows helpers', () => {
  const escrow = {
    roles: {
      approver: ADDR_APPROVER,
      serviceProvider: ADDR_PROVIDER,
      disputeResolver: ADDR_RESOLVER,
      releaseSigner: ADDR_SIGNER,
      receiver: ADDR_RECEIVER,
      platformAddress: ADDR_PLATFORM,
    },
  }

  it('getMyRole maps each role address to its Spanish label', () => {
    expect(getMyRole(escrow, ADDR_APPROVER)).toBe('Comprador')
    expect(getMyRole(escrow, ADDR_PROVIDER)).toBe('Vendedor')
    expect(getMyRole(escrow, ADDR_RESOLVER)).toBe('Árbitro')
    expect(getMyRole(escrow, ADDR_SIGNER)).toBe('Firmante')
    expect(getMyRole(escrow, ADDR_RECEIVER)).toBe('Receptor')
    expect(getMyRole(escrow, ADDR_PLATFORM)).toBe('Plataforma')
    expect(getMyRole(escrow, ADDR_OTHER)).toBe('Participante')
    expect(getMyRole(null, ADDR_APPROVER)).toBeNull()
  })

  it('getEscrowStatus resolves status label and CSS class from flags', () => {
    expect(getEscrowStatus({ flags: { released: true } })).toEqual({
      label: 'Liberado',
      color: 'status-released',
    })
    expect(getEscrowStatus({ flags: { resolved: true } })).toEqual({
      label: 'Resuelto',
      color: 'status-resolved',
    })
    expect(getEscrowStatus({ flags: { disputed: true } })).toEqual({
      label: 'En Disputa',
      color: 'status-disputed',
    })
    expect(getEscrowStatus({ flags: { approved: true } })).toEqual({
      label: 'Aprobado',
      color: 'status-approved',
    })
    expect(getEscrowStatus({ flags: {} })).toEqual({
      label: 'Activo',
      color: 'status-active',
    })
  })
})

describe('EscrowDrawer helpers', () => {
  it('shorten truncates Stellar G... public keys and C... contract IDs', () => {
    expect(shorten(ADDR_APPROVER)).toBe('GBBD47...FLA5')
    expect(shorten(ADDR_APPROVER, 8, 6)).toBe('GBBD47IF...LLFLA5')
    expect(shorten('SHORT')).toBe('SHORT')
    expect(shorten('')).toBe('')
  })

  it('getRoleKey and getStatusKey resolve role keys and status keys', () => {
    const escrow = {
      flags: { disputed: true },
      roles: { approver: ADDR_APPROVER, serviceProvider: ADDR_PROVIDER },
    }
    expect(getRoleKey(escrow, ADDR_APPROVER)).toBe('approver')
    expect(getRoleKey(escrow, ADDR_PROVIDER)).toBe('serviceProvider')
    expect(getRoleKey(escrow, ADDR_OTHER)).toBeNull()
    expect(getStatusKey(escrow)).toBe('disputed')
  })
})
