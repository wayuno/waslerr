// Shared "Reviews Wall" store. A single list of community stories lives in
// localStorage['wf_wall']; both the Reviews page and each field's detail-page
// summary read from it (filtered by field). Admin-posted entries set
// featured:true and float to the top. Swap localStorage for a backend in prod.
export const WALL_KEY = 'wf_wall'

// Seeded stories — field ids match the SEED catalogue in content.js.
export const WALL_SEED = [
  {
    id: 'w-seed-1',
    field: 'valentine',
    name: 'Marcus T.',
    rating: 5,
    text: 'Three weeks in and people treat me differently. I walk slower, talk lower, and somehow the room turns. This is the one I keep coming back to.',
    ts: Date.parse('2026-06-20T10:00:00Z'),
    featured: true,
  },
  {
    id: 'w-seed-2',
    field: 'limitless-wealth',
    name: 'Lena R.',
    rating: 5,
    text: 'My relationship with money completely changed. I stopped flinching at big numbers and started asking for what I am worth.',
    ts: Date.parse('2026-06-12T10:00:00Z'),
    featured: true,
  },
  {
    id: 'w-seed-3',
    field: 'deep-akashic-healing',
    name: 'Sofia A.',
    rating: 5,
    text: 'The calmest I have felt in years. Old tension I had carried since childhood just… loosened. I sleep through the night now.',
    ts: Date.parse('2026-06-08T10:00:00Z'),
    featured: false,
  },
  {
    id: 'w-seed-4',
    field: 'porn-freedom',
    name: 'Devon K.',
    rating: 5,
    text: 'Forty days clean after years of trying. It never felt like willpower — the urge just quietly lost its grip.',
    ts: Date.parse('2026-06-04T10:00:00Z'),
    featured: false,
  },
  {
    id: 'w-seed-5',
    field: 'morning-ignition',
    name: 'Priya M.',
    rating: 4,
    text: 'Two minutes before my day and I am decisive instead of foggy. Free, and better than apps I have paid for.',
    ts: Date.parse('2026-05-30T10:00:00Z'),
    featured: false,
  },
  {
    id: 'w-seed-6',
    field: 'valentine',
    name: 'James O.',
    rating: 5,
    text: 'I pitched to a room of investors and felt composed the entire time. The version of me that used to shake is gone.',
    ts: Date.parse('2026-05-24T10:00:00Z'),
    featured: false,
  },
]

export function loadWall() {
  try {
    const raw = JSON.parse(localStorage.getItem(WALL_KEY) || 'null')
    if (Array.isArray(raw) && raw.length) return raw
  } catch {
    /* ignore */
  }
  return WALL_SEED
}

export function saveWall(list) {
  try {
    localStorage.setItem(WALL_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

export const averageOf = (list) =>
  list.length ? Math.round((list.reduce((s, r) => s + (Number(r.rating) || 0), 0) / list.length) * 10) / 10 : 0

export const relTime = (ts) => {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return m + 'm ago'
  const h = Math.floor(m / 60)
  if (h < 24) return h + 'h ago'
  const d = Math.floor(h / 24)
  if (d < 30) return d + 'd ago'
  return Math.floor(d / 30) + 'mo ago'
}
