// Admin-controlled community links (YouTube / Discord / 1:1 with the creator).
// Stored in localStorage so the Admin page, Community page and footer stay in
// sync (same-browser + cross-tab via the `storage` event). In production this
// would come from a backend settings table instead.
export const COMMUNITY_LINKS_KEY = 'wf_community_links'

export const COMMUNITY_DEFAULTS = {
  youtube: 'https://youtube.com/@waslerrfields',
  discord: 'https://discord.gg/waslerrfields',
  creator: 'hello@waslerrfields.com',
}

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
const withScheme = (v) => (/^https?:\/\//i.test(v) ? v : 'https://' + v.replace(/^\/+/, ''))

// Resolve a stored value into a usable anchor target.
//  - creator: email → mailto: with a prefilled subject; otherwise a URL (new tab)
//  - youtube / discord: always external URLs (new tab)
export function resolveCommunityLink(type, value) {
  const v = (value || '').trim()
  if (!v) return { href: '#', external: false }
  if (type === 'creator' && isEmail(v)) {
    return { href: `mailto:${v}?subject=${encodeURIComponent('1:1 with the creator')}`, external: false }
  }
  return { href: withScheme(v), external: true }
}

export function loadCommunityLinks() {
  try {
    const raw = JSON.parse(localStorage.getItem(COMMUNITY_LINKS_KEY) || '{}')
    return { ...COMMUNITY_DEFAULTS, ...raw }
  } catch {
    return { ...COMMUNITY_DEFAULTS }
  }
}

export function saveCommunityLinks(links) {
  try {
    localStorage.setItem(COMMUNITY_LINKS_KEY, JSON.stringify(links))
  } catch {
    /* ignore */
  }
}
