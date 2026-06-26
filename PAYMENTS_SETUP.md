# Waslerr Fields — Real Payment Verification Setup

The checkout now **never delivers a field until the backend confirms the payment**.
There is no client-side simulation anymore — the React app only polls
`/api/checkout/status` and shows the Delivered page when the server returns
`delivered`.

## 1. Run the database migration (once)

In the Supabase SQL editor, run:

```
supabase/orders.sql
```

This creates the server-authoritative `orders` table (RLS on, no client policies —
only the backend writes to it with the service-role key).

## 2. Environment variables (Railway → Variables)

Already set by you:

| Variable | Purpose |
|---|---|
| `PAYPAL_CLIENT_ID` | PayPal REST app client id |
| `PAYPAL_CLIENT_SECRET` | PayPal REST app secret |
| `BINANCE_PAY_API_KEY` | Binance Pay merchant API key (Certificate-SN) |
| `BINANCE_PAY_SECRET_KEY` | Binance Pay merchant secret (HMAC-SHA512 signing) |

Add / confirm these too:

| Variable | Default | Purpose |
|---|---|---|
| `PAYPAL_MODE` | `live` | `live` or `sandbox` |
| `PAYPAL_EMAIL` | `ck806180@gmail.com` | Payee shown to the buyer |
| `BINANCE_PAY_ID` | `767314103` | Payee UID shown to the buyer |

The boot log prints:
`[waslerr] payments — PayPal: configured · Binance Pay: configured`
If it says `MISSING keys`, the env vars aren't loaded.

## 3. How verification works

### Endpoints
- `POST /api/checkout/create` — server reads the price from the catalog (never
  the client), applies the coupon, generates the `WF-XXX-XXXXX` reference, writes
  a `pending` order, and (for Binance) creates a real merchant order.
- `GET /api/checkout/status?reference=…` — hits the provider API, matches by
  reference, and flips the order to `delivered` when confirmed. Idempotent.
- `POST /api/checkout/verify-txid` — fallback: buyer pastes a transaction id; the
  server verifies it against the order (amount + provider status).

### Binance Pay — IMPORTANT
Two ways a buyer can pay:

1. **"Pay instantly in Binance" button** (recommended, instant) — this opens the
   merchant order created via the API. `order/query` then returns `PAID` within
   seconds and the field is delivered automatically. **This is the reliable path.**
2. **Manual UID transfer with the reference as a note** — the Binance *merchant*
   API can only see orders it created; it **cannot** look up an arbitrary P2P
   transfer to your UID. So a pure manual UID+note transfer will NOT auto-verify.
   For those, the buyer uses the **TXID fallback**, or you confirm manually.

➡️ Push buyers toward the "Pay instantly in Binance" button for hands-off delivery.

### PayPal
- **Note matching** uses the Transaction Search API
  (`/v1/reporting/transactions`). Enable **"Transaction Search"** on your PayPal
  REST app (PayPal Developer → your app → features). Reporting can lag a few
  minutes (sometimes longer), so auto-detection may not be instant for P2P
  "send money" transfers.
- **TXID fallback** verifies a capture id (Checkout) directly, or falls back to
  Transaction Search by id, checking amount (+ soft note cross-check).

## 4. Security properties
- Price is set server-side from the catalog — the client cannot change the amount.
- Coupons are re-applied server-side.
- Orders are deduped on a unique `reference`; delivery is idempotent
  (`markDelivered` is a no-op if already paid/delivered).
- The field is only unlocked after a confirmed provider response.
