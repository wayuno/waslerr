# Waslerr Fields

Premium subliminal-audio store — animated React (Vite) frontend with a tiny
zero-dependency Node backend, backed by **Supabase** for real auth and the
product catalogue.

## What's real (Phase 1)

- **Auth** via Supabase — users sign up / sign in; sessions persist across
  reloads (no re-login after refresh).
- **Admin** is gated to `ADMIN_EMAIL`. Only that account sees the Admin link and
  dashboard; everyone else is a regular customer. Privileged writes are verified
  **server-side** (the backend checks the Supabase token + admin email, then
  writes with the service-role key — never exposed to the browser).
- **Products** live in Supabase. Admin can publish a field (title, line, price,
  description, **image upload to Supabase Storage**) and delete fields; the
  storefront reflects changes live.

> Phase 2 (next): coupons/discounts + persistent support chat in Supabase.

## Supabase setup (one time)

1. Create a Supabase project. In **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql)
   (creates the `products` table + RLS, the public `product-images` storage
   bucket, and seeds the starter catalogue).
2. **Authentication → Providers → Email:** turn **"Confirm email" OFF** so new
   sign-ups log in instantly (chosen behavior).
3. Copy **Settings → API** values into Railway (below).

## Environment variables (Railway → Variables)

| Var | Purpose |
|---|---|
| `ADMIN_EMAIL` | The one email allowed to be admin |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (secret — server only) |
| `PORT` | Provided automatically by Railway |

## Deploy on Railway

Build: `npm run build` · Start: `npm start` (`node server/index.js`). The server
serves the built frontend **and** the admin API from one service.

## Develop locally

```bash
npm install
cp .env.example .env      # fill in your Supabase + admin values
npm run server            # backend on :8787
npm run dev               # frontend on :5173 (proxies /api → :8787)
```

Without Supabase env set, the site still runs with a built-in demo catalogue and
auth disabled.
