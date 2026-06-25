# Waslerr Fields

Premium subliminal-audio store — animated React (Vite) frontend with a tiny
zero-dependency Node backend that handles **real, server-side admin auth**.

## Develop locally

```bash
npm install
cp .env.example .env      # then edit the admin values
npm run server            # backend on :8787 (admin auth API)
npm run dev               # frontend on :5173 (proxies /api → :8787)
```

Open http://localhost:5173. The Vite dev server proxies `/api/*` to the backend.

## Admin access

Admin is gated **server-side**. Logging in with the admin email **and** the
secret `ADMIN_PASSWORD` returns a signed token; the dashboard only unlocks when
that token verifies on the server. Any other login is a regular (demo) customer
session with no admin access. The password is never shipped in the client
bundle — without it, no one can become admin.

Required env vars (see `.env.example`):

| Var | Purpose |
|---|---|
| `ADMIN_EMAIL` | The one email allowed to be admin |
| `ADMIN_PASSWORD` | Secret admin password (required to unlock the dashboard) |
| `JWT_SECRET` | Long random string used to sign admin session tokens |
| `PORT` | Server port (Railway sets this automatically) |

## Deploy on Railway

1. Set `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `JWT_SECRET` in **Variables**.
2. Railway builds with `npm run build` and starts with `npm start`
   (`node server/index.js`), which serves the built frontend **and** the auth API
   from one service. `PORT` is provided automatically.

> Catalogue and support chat are still demo/in-memory (reset on restart). Only
> admin **authentication** is real; persisting products/orders/chat would need a
> database.
