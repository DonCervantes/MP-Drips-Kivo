import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeOrder, statusFromOrder } from '../src/utils/orderState.js'

test('normalizeOrder unwraps onramp responses', () => {
  const order = { orderId: 'onramp-1' }
  assert.equal(normalizeOrder({ onramp: order }), order)
})

test('normalizeOrder unwraps offramp responses', () => {
  const order = { orderId: 'offramp-1' }
  assert.equal(normalizeOrder({ offramp: order }), order)
})

test('normalizeOrder preserves flat responses and handles missing data', () => {
  const order = { orderId: 'flat-1' }
  assert.equal(normalizeOrder(order), order)
  assert.deepEqual(normalizeOrder(null), {})
})

test('statusFromOrder recognizes terminal and processing statuses', () => {
  assert.equal(statusFromOrder({ status: 'completed' }), 'completed')
  assert.equal(statusFromOrder({ status: 'FAILED' }), 'error')
  assert.equal(statusFromOrder({ status: 'cancelled' }), 'error')
  assert.equal(statusFromOrder({ status: 'funded' }), 'processing')
  assert.equal(statusFromOrder({ status: 'processing' }), 'processing')
})

test('created onramp orders wait for payment when they include a CLABE', () => {
  assert.equal(statusFromOrder({ status: 'created', depositClabe: '123' }), 'awaiting_payment')
  assert.equal(statusFromOrder({ status: 'created' }), 'processing')
})

test('unknown or absent order statuses remain processing', () => {
  assert.equal(statusFromOrder({ status: 'unknown' }), 'processing')
  assert.equal(statusFromOrder(null), 'processing')
})