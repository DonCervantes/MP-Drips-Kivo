import assert from 'node:assert/strict'
import test from 'node:test'
import { getActions, getEscrowStatus, statusKeyFromEscrow } from '../src/utils/escrowState.js'

test('visible escrow status follows terminal flag priority', () => {
  assert.deepEqual(getEscrowStatus({ flags: { released: true, disputed: true } }), {
    label: 'Liberado', color: 'status-released',
  })
  assert.deepEqual(getEscrowStatus({ flags: { resolved: true } }), {
    label: 'Resuelto', color: 'status-resolved',
  })
  assert.deepEqual(getEscrowStatus({ flags: { disputed: true } }), {
    label: 'En Disputa', color: 'status-disputed',
  })
  assert.deepEqual(getEscrowStatus({ flags: { approved: true } }), {
    label: 'Aprobado', color: 'status-approved',
  })
  assert.deepEqual(getEscrowStatus(null), { label: 'Activo', color: 'status-active' })
})

test('statusKeyFromEscrow provides the detail modal key', () => {
  assert.equal(statusKeyFromEscrow({ flags: { resolved: true } }), 'resolved')
  assert.equal(statusKeyFromEscrow({}), 'active')
})

test('approver can fund until the escrow is fully funded', () => {
  const escrow = { amount: '100', balance: '40', roles: { approver: 'Gbuyer' } }
  assert.deepEqual(getActions(escrow, 'gbuyer'), ['fund'])
})

test('fully funded approver can approve an unapproved milestone', () => {
  const escrow = {
    amount: 100,
    balance: 100,
    roles: { approver: 'Gbuyer' },
    milestones: [{ approved: false }],
  }
  assert.deepEqual(getActions(escrow, 'Gbuyer'), ['approve'])
})

test('release signer can release when every milestone is approved', () => {
  const escrow = {
    amount: 100,
    balance: 100,
    roles: { releaseSigner: 'Gsigner' },
    milestones: [{ approved: true }, { approved: true }],
  }
  assert.deepEqual(getActions(escrow, 'Gsigner'), ['release'])
})

test('no eligible action is offered for insufficient role or empty milestones', () => {
  assert.deepEqual(getActions({ amount: 10, balance: 10, milestones: [] }, 'Gbuyer'), [])
  assert.deepEqual(getActions({ amount: 10, balance: 10 }, 'Gother'), [])
})

test('released and resolved escrows expose no actions', () => {
  for (const flags of [{ released: true }, { resolved: true }]) {
    assert.deepEqual(getActions({ flags, roles: { approver: 'Gbuyer' } }, 'Gbuyer'), [])
  }
})