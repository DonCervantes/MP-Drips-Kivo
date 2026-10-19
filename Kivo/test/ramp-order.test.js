import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { normalizeOrder, statusFromOrder } from '../src/lib/ramp-order.js'

describe('Etherfuse response normalization', () => {
  it('accepts wrapped onramp/offramp and flat polling responses without losing fields', () => {
    const order = { orderId: 'order-1', status: 'created', depositClabe: '012345' }
    assert.equal(normalizeOrder({ onramp: order }), order)
    assert.equal(normalizeOrder({ offramp: order }), order)
    assert.equal(normalizeOrder(order), order)
    assert.deepEqual(order, { orderId: 'order-1', status: 'created', depositClabe: '012345' })
  })

  it('uses the onramp wrapper first and falls back only for nullish wrappers', () => {
    const onramp = { orderId: 'onramp' }
    const offramp = { orderId: 'offramp' }
    assert.equal(normalizeOrder({ onramp, offramp }), onramp)
    assert.equal(normalizeOrder({ onramp: null, offramp }), offramp)
    assert.deepEqual(normalizeOrder(null), {})
    assert.deepEqual(normalizeOrder(undefined), {})
  })
})

describe('ramp UI status', () => {
  for (const [label, order, expected] of [
    ['completed', { status: 'completed' }, 'completed'],
    ['uppercase status', { status: 'COMPLETED' }, 'completed'],
    ['failed', { status: 'failed' }, 'error'],
    ['cancelled', { status: 'cancelled' }, 'error'],
    ['funded', { status: 'funded' }, 'processing'],
    ['processing', { status: 'processing' }, 'processing'],
    ['created onramp with payment details', { status: 'created', depositClabe: '012345' }, 'awaiting_payment'],
    ['created without payment details', { status: 'created' }, 'processing'],
    ['created with empty payment details', { status: 'created', depositClabe: '' }, 'processing'],
    ['unknown status', { status: 'queued' }, 'processing'],
    ['missing status', {}, 'processing'],
    ['null order', null, 'processing'],
  ]) {
    it(label, () => assert.equal(statusFromOrder(order), expected))
  }

  it('maps the same order consistently from creation and subsequent polling', () => {
    const order = { status: 'created', depositClabe: '012345' }
    assert.equal(statusFromOrder(normalizeOrder({ onramp: order })), 'awaiting_payment')
    assert.equal(statusFromOrder(normalizeOrder(order)), 'awaiting_payment')
    assert.equal(statusFromOrder(normalizeOrder({ ...order, status: 'completed' })), 'completed')
  })
})
