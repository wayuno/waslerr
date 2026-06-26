import { createClient } from '@supabase/supabase-js'

// The public Supabase config is served by our backend (/api/config) so we can
// reuse the NEXT_PUBLIC_* env vars set on Railway without a VITE_ prefix.
let configPromise
let clientPromise

export function loadConfig() {
  if (!configPromise) {
    configPromise = fetch('/api/config')
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
  }
  return configPromise
}

// Returns a memoized Supabase client, or null if Supabase isn't configured.
export function getSupabase() {
  if (!clientPromise) {
    clientPromise = loadConfig().then((cfg) => {
      if (!cfg || !cfg.supabaseUrl || !cfg.supabaseAnonKey) return null
      return createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          storageKey: 'wf-auth',
        },
      })
    })
  }
  return clientPromise
}

// Normalize a reviews row to the shape the wall + detail summary use.
export function normalizeReview(row) {
  return {
    id: row.id,
    field: row.field,
    name: row.name,
    rating: Number(row.rating) || 5,
    text: row.text || '',
    featured: !!row.featured,
    ts: Date.parse(row.created_at) || Date.now(),
  }
}

// Normalize a DB row to the shape the UI components already use.
export function normalizeProduct(row) {
  const price = Number(row.price) || 0
  return {
    id: row.id,
    title: row.title,
    line: row.line || 'desire',
    price: price > 0 ? `$${price}` : undefined,
    priceNum: price,
    desc: row.description || '',
    image_url: row.image_url || null,
    freq: 200,
  }
}
