// Pure offer state-machine helpers — shared by the server endpoints and tests.
// State machine: sent → paid → delivered (+ cancelled). All transitions here are
// pure and idempotent so webhook/poll retries can call them repeatedly safely.

export const OFFER_STATUSES = ['sent', 'paid', 'delivered', 'cancelled']

// Customer may start/retry checkout only while the offer is unpaid.
export const canCheckout = (offer) => !!offer && offer.status === 'sent'

// Admin may deliver only after payment cleared (and before/at delivered).
export const canDeliver = (offer) => !!offer && (offer.status === 'paid' || offer.status === 'delivered')

// Apply a confirmed payment. Idempotent: only sent → paid mutates.
// Returns { changed, offer }.
export function applyPaid(offer, at = 'now') {
  if (!offer) return { changed: false, offer }
  if (offer.status === 'sent') {
    return { changed: true, offer: { ...offer, status: 'paid', paidAt: offer.paidAt || at } }
  }
  return { changed: false, offer } // already paid / delivered / cancelled
}

// Apply a delivery. Illegal before payment; idempotent once delivered.
// Returns { ok, changed?, offer?, reason? }.
export function applyDelivered(offer, at = 'now') {
  if (!offer) return { ok: false, reason: 'not_found' }
  if (offer.status === 'sent') return { ok: false, reason: 'not_paid' }
  if (offer.status === 'cancelled') return { ok: false, reason: 'cancelled' }
  if (offer.status === 'delivered') return { ok: true, changed: false, offer } // idempotent
  if (offer.status === 'paid') return { ok: true, changed: true, offer: { ...offer, status: 'delivered', deliveredAt: offer.deliveredAt || at } }
  return { ok: false, reason: 'illegal' }
}
