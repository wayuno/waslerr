// Offer state-machine + idempotency tests.  Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canCheckout, canDeliver, applyPaid, applyDelivered } from './offer-state.js'

test('canCheckout: only while sent', () => {
  assert.equal(canCheckout({ status: 'sent' }), true)
  assert.equal(canCheckout({ status: 'paid' }), false)
  assert.equal(canCheckout({ status: 'delivered' }), false)
  assert.equal(canCheckout({ status: 'cancelled' }), false)
  assert.equal(canCheckout(null), false)
})

test('canDeliver: only once payment cleared', () => {
  assert.equal(canDeliver({ status: 'sent' }), false)
  assert.equal(canDeliver({ status: 'paid' }), true)
  assert.equal(canDeliver({ status: 'delivered' }), true) // idempotent re-deliver allowed
  assert.equal(canDeliver(null), false)
})

test('applyPaid: sent → paid sets status + paidAt', () => {
  const r = applyPaid({ id: 'o1', status: 'sent' }, 't0')
  assert.equal(r.changed, true)
  assert.equal(r.offer.status, 'paid')
  assert.equal(r.offer.paidAt, 't0')
})

test('applyPaid is idempotent (webhook/poll retries do not double-apply)', () => {
  const once = applyPaid({ id: 'o1', status: 'sent' }, 't0')
  const twice = applyPaid(once.offer, 't1')
  assert.equal(twice.changed, false)
  assert.equal(twice.offer.status, 'paid')
  assert.equal(twice.offer.paidAt, 't0') // unchanged from first apply
  // a delivered offer is never knocked back to paid
  const onDelivered = applyPaid({ status: 'delivered' })
  assert.equal(onDelivered.changed, false)
  assert.equal(onDelivered.offer.status, 'delivered')
})

test('applyDelivered: rejects deliver-before-paid', () => {
  const r = applyDelivered({ status: 'sent' })
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'not_paid')
})

test('applyDelivered: paid → delivered', () => {
  const r = applyDelivered({ id: 'o1', status: 'paid' }, 't2')
  assert.equal(r.ok, true)
  assert.equal(r.changed, true)
  assert.equal(r.offer.status, 'delivered')
  assert.equal(r.offer.deliveredAt, 't2')
})

test('applyDelivered is idempotent once delivered', () => {
  const r = applyDelivered({ status: 'delivered' })
  assert.equal(r.ok, true)
  assert.equal(r.changed, false)
  assert.equal(r.offer.status, 'delivered')
})

test('illegal transitions are rejected', () => {
  assert.equal(applyDelivered({ status: 'cancelled' }).ok, false)
  assert.equal(applyDelivered(null).ok, false)
})
