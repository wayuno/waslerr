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
          // parse the recovery/confirmation token from the URL so the
          // "forgot password" email link can establish a session. Implicit
          // flow keeps the token in the URL hash, so it works even when the
          // email is opened on a different device/browser.
          detectSessionInUrl: true,
          flowType: 'implicit',
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
    images: Array.isArray(row.images) ? row.images.slice(0, 2) : [],
    ts: Date.parse(row.created_at) || Date.now(),
  }
}

// Normalize a DB row to the shape the UI components already use.
// audio bundle for the client (keeps path so the admin edit form can preserve
// existing files; the bucket is private so paths alone aren't downloadable)
export const cleanAudioList = (a) =>
  Array.isArray(a)
    ? a
        .filter((x) => x && (x.path || x.url))
        .map((x) =>
          x.url
            ? { url: String(x.url), name: String(x.name || 'Delivery link'), isLink: true }
            : { path: String(x.path), name: String(x.name || 'Audio'), size: Number(x.size) || 0 },
        )
    : []

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
    sold: Number(row.sold_count) || 0,
    hasAudio: !!row.audio_url || (Array.isArray(row.audios) && row.audios.length > 0),
    audio_url: row.audio_url || null, // legacy single file — kept so the edit form can preserve it
    audios: cleanAudioList(row.audios),
    benefits: Array.isArray(row.benefits) ? row.benefits.filter(Boolean) : [],
    method: row.method && typeof row.method === 'object' ? row.method : null,
    versions: Array.isArray(row.versions) ? row.versions : [],
    freq: 200,
  }
}
