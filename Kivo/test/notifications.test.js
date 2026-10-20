import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  snapshotEscrow,
  diffEscrowSnapshot,
  diffEscrows,
  escrowRole,
  rampEvent,
  appendNotifications,
  formatMessage,
  MAX_NOTIFICATIONS,
} from '../src/lib/notifications.js'

const BUYER  = 'GBUYERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const SELLER = 'GSELLERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

function escrow(overrides = {}) {
  return {
    contractId: 'C1',
    engagementId: 'E1',
    title: 'Café 1 kg',
    amount: 15,
    balance: 0,
    trustline: { symbol: 'USDC' },
    roles: { approver: BUYER, serviceProvider: SELLER, receiver: SELLER },
    milestones: [{ description: 'Entrega', approved: false }],
    flags: {},
    ...overrides,
  }
}

const EMPTY = { funded: false, approved: false, released: false, disputed: false, resolved: false }

describe('snapshotEscrow', () => {
  it('reduce un escrow nuevo a flags en falso', () => {
    assert.deepEqual(snapshotEscrow(escrow()), EMPTY)
  })

  it('detecta saldo, hito aprobado y flags del escrow', () => {
    const snap = snapshotEscrow(escrow({
      balance: 15,
      milestones: [{ approved: true }],
      flags: { disputed: true, resolved: true, released: true },
    }))
    assert.deepEqual(snap, { funded: true, approved: true, released: true, disputed: true, resolved: true })
  })

  it('lee los flags por hito de escrows multi-release', () => {
    const snap = snapshotEscrow(escrow({ milestones: [{ flags: { approved: true, released: true } }] }))
    assert.equal(snap.approved, true)
    assert.equal(snap.released, true)
  })

  it('tolera escrows incompletos', () => {
    assert.deepEqual(snapshotEscrow({}), EMPTY)
    assert.deepEqual(snapshotEscrow(null), EMPTY)
  })
})

describe('diffEscrowSnapshot', () => {
  it('escrow nuevo sin fondos → listo para fondear', () => {
    assert.deepEqual(diffEscrowSnapshot(undefined, EMPTY), ['escrowCreated'])
  })

  it('escrow nuevo ya avanzado → sólo el estado más reciente', () => {
    assert.deepEqual(diffEscrowSnapshot(undefined, { ...EMPTY, funded: true }), ['fundsReceived'])
    assert.deepEqual(diffEscrowSnapshot(undefined, { ...EMPTY, funded: true, released: true }), ['fundsReleased'])
  })

  it('emite cada transición una sola vez y en orden de flujo', () => {
    assert.deepEqual(diffEscrowSnapshot(EMPTY, { ...EMPTY, funded: true, approved: true, released: true }),
      ['fundsReceived', 'milestoneApproved', 'fundsReleased'])
    const funded = { ...EMPTY, funded: true }
    assert.deepEqual(diffEscrowSnapshot(funded, funded), [])
  })

  it('disputa abierta y resuelta', () => {
    const disputed = { ...EMPTY, funded: true, disputed: true }
    assert.deepEqual(diffEscrowSnapshot({ ...EMPTY, funded: true }, disputed), ['disputeOpened'])
    assert.deepEqual(diffEscrowSnapshot(disputed, { ...disputed, resolved: true }), ['disputeResolved'])
  })

  it('no emite nada si el saldo vuelve a cero (liberación ya notificada)', () => {
    const released = { ...EMPTY, funded: true, approved: true, released: true }
    assert.deepEqual(diffEscrowSnapshot(released, { ...released, funded: false }), [])
  })
})

describe('diffEscrows', () => {
  it('la primera carga (baseline) guarda fotos sin notificar historial', () => {
    const { snapshots, events } = diffEscrows({}, [escrow({ balance: 15 })], BUYER, { baseline: true })
    assert.deepEqual(events, [])
    assert.equal(snapshots.C1.funded, true)
  })

  it('genera eventos con datos del escrow y rol del usuario', () => {
    const first = diffEscrows({}, [escrow()], SELLER, { baseline: true })
    const { events } = diffEscrows(first.snapshots, [escrow({ balance: 15 })], SELLER)
    assert.deepEqual(events, [{
      type: 'fundsReceived', key: 'C1', title: 'Café 1 kg', amount: 15, symbol: 'USDC', role: 'seller',
    }])
  })

  it('conserva las fotos de escrows que no vinieron en la respuesta', () => {
    const { snapshots } = diffEscrows({ OLD: EMPTY }, [escrow()], BUYER)
    assert.ok(snapshots.OLD)
    assert.ok(snapshots.C1)
  })

  it('ignora escrows sin contractId ni engagementId', () => {
    const { snapshots, events } = diffEscrows({}, [{ title: 'x' }], BUYER)
    assert.deepEqual(snapshots, {})
    assert.deepEqual(events, [])
  })
})

describe('escrowRole', () => {
  it('distingue comprador, vendedor y otros sin importar mayúsculas', () => {
    assert.equal(escrowRole(escrow(), BUYER.toLowerCase()), 'buyer')
    assert.equal(escrowRole(escrow(), SELLER), 'seller')
    assert.equal(escrowRole(escrow(), 'GOTHER'), 'other')
    assert.equal(escrowRole(escrow(), null), 'other')
  })
})

describe('rampEvent', () => {
  it('sólo para órdenes terminadas', () => {
    assert.equal(rampEvent('processing', { orderId: 'o1' }), null)
    assert.equal(rampEvent('completed', { orderId: 'o1' }).type, 'rampCompleted')
    assert.equal(rampEvent('error', { orderId: 'o1' }).type, 'rampFailed')
    assert.equal(rampEvent('error', { orderId: 'o1' }).key, 'ramp:o1')
  })
})

describe('appendNotifications', () => {
  const ev = (type, key) => ({ type, key, title: '', amount: null, symbol: null, role: 'other' })

  it('agrega como no leídas y la más reciente primero', () => {
    const list = appendNotifications([], [ev('fundsReceived', 'C1'), ev('fundsReleased', 'C1')], 1000)
    assert.deepEqual(list.map(n => n.type), ['fundsReleased', 'fundsReceived'])
    assert.ok(list.every(n => n.read === false && n.createdAt === 1000))
  })

  it('no duplica el mismo evento del mismo escrow/orden', () => {
    const once = appendNotifications([], [ev('rampCompleted', 'ramp:o1')])
    const twice = appendNotifications(once, [ev('rampCompleted', 'ramp:o1')])
    assert.equal(twice, once)
    assert.equal(twice.length, 1)
  })

  it('recorta al máximo configurado', () => {
    const many = Array.from({ length: MAX_NOTIFICATIONS + 5 }, (_, i) => ev('escrowCreated', `C${i}`))
    assert.equal(appendNotifications([], many).length, MAX_NOTIFICATIONS)
  })
})

describe('formatMessage', () => {
  it('sustituye placeholders y deja vacíos los faltantes', () => {
    assert.equal(formatMessage('Escrow "{title}" {x}', { title: 'A' }), 'Escrow "A" ')
  })
})
