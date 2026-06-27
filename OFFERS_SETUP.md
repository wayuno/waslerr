# Waslerr Fields — Chat Offers (offer → pay → deliver)

An admin can quote a paid "field" inside a support conversation; the customer
pays through the **existing crypto checkout** (PayPal / Binance Pay — no new
provider), and the finished file is delivered back in-chat.

## Run the migration once
`supabase/offers.sql` — creates the `offers` table, adds `kind` + `meta` to
`support_messages`, and a **private** `deliveries` storage bucket.

(Depends on `orders.sql` being applied, since payment reuses the orders flow.)

## How it works (this stack is poll-based, not webhook-based)
1. **Admin → Support tab → ✦ Create field**: name, description, $ amount,
   "Delivery · 6–7 days", and `includes` chips → `POST /api/admin/conversations/:id/offers`.
   An `offer` card is appended to the thread; status pill shows **Awaiting payment**.
2. **Customer chat**: the offer renders as a gold field card with **Pay $X**.
   Tapping it opens the in-widget **Secure checkout** (method select → pay
   instructions + reference → live status). This calls `POST /api/offers/:id/checkout`,
   which **reuses the exact order-creation logic** (price from the offer, server-side).
3. **Confirmation = polling** (there is no webhook in this codebase). The widget
   polls `GET /api/offers/:id/status`, which checks the provider (PayPal Transaction
   Search / Binance merchant query) and, on success, flips the offer to **paid**
   once (idempotent), appends the `systemPaid` pill + the admin auto-reply, and the
   admin sees a **"Payment received · $X"** toast + the **Paid** pill.
   A **TXID fallback** exists at `POST /api/offers/:id/verify-txid`.
4. **Admin → Prepare delivery**: pick a file + note → `POST /api/admin/offers/:id/deliver`
   (stored in the private `deliveries` bucket). A `delivery` card appears in the
   customer chat.
5. **Customer → Download field**: `GET /api/offers/:id/download?conversationId=…`
   — gated by the owning conversation id (chat guests' secret) or an admin token;
   served via a short-lived **signed URL**. Repeatable.

State machine (`server/offer-state.js`, enforced server-side):
`sent → paid → delivered` (+ `cancelled`). Illegal transitions (deliver before
paid, pay an already-paid offer) are rejected. Tested in
`server/offer-state.test.js` (`npm test`) — includes webhook/poll idempotency.

## Notes
- No new env vars. Reuses the existing PayPal/Binance keys + storage.
- Realtime = the existing 4s chat poll on both sides (no socket needed).
- Animations are transform-based and respect `prefers-reduced-motion`.
