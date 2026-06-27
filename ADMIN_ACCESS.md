# Waslerr Fields — Admin access

The admin dashboard is reachable **only via a secret path** you choose, plus the
normal Supabase admin login. `/admin` no longer opens it.

## Set the secret path (Railway → Variables)

```
ADMIN_PATH=/control-7xk2q
```

Pick any hard-to-guess value (letters/numbers/dashes). It's normalized to start
with `/` and lowercased. Examples: `/wf-control-9q2x`, `/backstage-7kd`.

- Visiting `https://waslerrfields.com/control-7xk2q` opens the admin login gate.
- Visiting `/admin` (or any other path) just shows the home page — the panel is
  not revealed.
- You can **rotate** the path anytime by changing `ADMIN_PATH` and redeploying —
  no code change needed.

## Why this is safe

Three independent layers now protect the dashboard:

1. **Secret entrance** — the panel only deep-links from your private `ADMIN_PATH`.
2. **Login gate** — even at the secret path, the panel renders only after a
   Supabase login whose email matches `ADMIN_EMAIL` (or role `admin`).
3. **Server-side authorization** — every admin API call independently verifies
   the Supabase token *and* the admin email before any read/write. Forcing the
   UI open in devtools changes nothing without valid admin credentials.

The public "Sign in" link still exists for normal customers; signing in as the
admin email automatically lands you on the dashboard, so you don't strictly need
the secret URL day-to-day — it's the private direct entrance.

## If ADMIN_PATH is not set

No URL opens the panel directly. You can still reach it by clicking **Sign in**
and logging in with the admin account (it auto-routes admins to the dashboard).
