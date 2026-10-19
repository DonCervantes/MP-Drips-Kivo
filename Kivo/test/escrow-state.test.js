import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getActions, getEscrowStatus, getStatusKey } from '../src/lib/escrow-state.js'

describe('visible escrow status', () => {
  for (const [flags, key, label] of [
    [{}, 'active', 'Activo'],
    [{ approved: true }, 'approved', 'Aprobado'],
    [{ disputed: true, approved: true }, 'disputed', 'En Disputa'],
    [{ resolved: true, disputed: true, approved: true }, 'resolved', 'Resuelto'],
    [{ released: true, resolved: true, disputed: true, approved: true }, 'released', 'Liberado'],
  ]) {
    it(`uses ${key} precedence in both the detail and legacy status helper`, () => {
      const escrow = { flags }
      assert.equal(getStatusKey(escrow), key)
      assert.deepEqual(getEscrowStatus(escrow), { label, color: `status-${key}` })
    })
  }

  it('defaults missing flags and missing escrows to active', () => {
    for (const escrow of [undefined, null, {}, { flags: null }]) {
      assert.equal(getStatusKey(escrow), 'active')
    }
  })
})

const buyer = 'G-BUYER'
const signer = 'G-SIGNER'
const makeEscrow = (overrides = {}) => ({
  roles: { approver: buyer, releaseSigner: signer },
  flags: {},
  amount: '100',
  balance: '0',
  milestones: [{ approved: false }, { approved: false }],
  ...overrides,
})

describe('single-release action decisions', () => {
  for (const [label, overrides, wallet, expected] of [
    ['unfunded buyer', {}, buyer, ['fund']],
    ['partially funded buyer', { balance: '99.99' }, buyer, ['fund']],
    ['exactly funded buyer', { balance: '100' }, buyer, ['approve']],
    ['overfunded buyer', { balance: 101 }, buyer, ['approve']],
    ['partial milestone approval', { balance: '100', milestones: [{ approved: true }, { approved: false }] }, buyer, ['approve']],
    ['no milestones does not imply approval', { balance: '100', milestones: [] }, buyer, ['approve']],
    ['signer cannot release with unapproved milestones', { balance: '100' }, signer, []],
    ['signer cannot release an empty milestone list', { balance: '100', milestones: [] }, signer, []],
    ['signer can release when funded and every milestone is approved', { balance: '100', milestones: [{ approved: true }, { approved: true }] }, signer, ['release']],
    ['buyer has nothing left to approve', { balance: '100', milestones: [{ approved: true }] }, buyer, []],
    ['approved milestones without full funding cannot release', { balance: '99', milestones: [{ approved: true }] }, signer, []],
    ['zero amount is not fully funded', { amount: '0', balance: '100' }, buyer, ['fund']],
    ['unrelated wallet', { balance: '100' }, 'G-OTHER', []],
    ['disconnected wallet', {}, undefined, []],
    ['missing roles', { roles: undefined }, buyer, []],
    ['existing case-insensitive role comparison', {}, buyer.toLowerCase(), ['fund']],
    // Dispute action policy is tracked separately; this extraction preserves it.
    ['existing disputed-escrow behavior', { flags: { disputed: true }, balance: '100' }, buyer, ['approve']],
  ]) {
    it(label, () => assert.deepEqual(getActions(makeEscrow(overrides), wallet), expected))
  }

  it('never offers an action for a released or resolved escrow', () => {
    for (const terminalFlag of ['released', 'resolved']) {
      for (const balance of ['0', '50', '100']) {
        for (const approved of [false, true]) {
          for (const wallet of [buyer, signer]) {
            assert.deepEqual(getActions(makeEscrow({
              flags: { [terminalFlag]: true }, balance, milestones: [{ approved }],
            }), wallet), [])
          }
        }
      }
    }
  })

  it('handles one wallet holding both buyer and release-signer roles', () => {
    const roles = { approver: buyer, releaseSigner: buyer }
    assert.deepEqual(getActions(makeEscrow({ roles }), buyer), ['fund'])
    assert.deepEqual(getActions(makeEscrow({ roles, balance: '100' }), buyer), ['approve'])
    assert.deepEqual(getActions(makeEscrow({ roles, balance: '100', milestones: [{ approved: true }] }), buyer), ['release'])
  })

  it('does not mutate the escrow while deriving available actions', () => {
    const escrow = makeEscrow({ balance: '100' })
    const before = structuredClone(escrow)
    getActions(escrow, buyer)
    assert.deepEqual(escrow, before)
    assert.deepEqual(getActions(undefined, undefined), [])
  })
})
