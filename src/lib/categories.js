// Custom category management (client-side). Stored in localStorage so the
// admin-defined categories persist across reloads and sync across tabs.
export const CATEGORIES_KEY = 'wf_custom_categories'
const BASE = ['DESIRE', 'AKASHIC', 'WEALTH']

const safe = () => {
  try {
    return JSON.parse(localStorage.getItem(CATEGORIES_KEY) || '[]')
  } catch {
    return []
  }
}

const persist = (list) => {
  try {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

export function loadCategories() {
  return Array.from(new Set(safe().filter((c) => typeof c === 'string').map((c) => c.toUpperCase().trim())))
}

export function saveCategories(categories) {
  const list = Array.from(new Set((categories || []).filter((c) => typeof c === 'string').map((c) => c.toUpperCase().trim())))
  persist(list)
  return list
}

export function addCategory(name) {
  if (!name || typeof name !== 'string') return loadCategories()
  const cleaned = name.toUpperCase().trim()
  if (!cleaned) return loadCategories()
  const current = loadCategories()
  if (current.includes(cleaned)) return current
  const next = saveCategories([...current, cleaned])
  return next
}

export function removeCategory(name) {
  if (!name || typeof name !== 'string') return loadCategories()
  const cleaned = name.toUpperCase().trim()
  const current = loadCategories()
  const next = current.filter((c) => c !== cleaned)
  return next.length === current.length ? current : saveCategories(next)
}

export function categoryOptions(products, freeFields, customCategories) {
  const fromData = [
    ...(products || []).map((p) => (p.line || '').toUpperCase()),
    ...(freeFields || []).map((f) => (f.line || '').toUpperCase()),
  ]
  const custom = Array.isArray(customCategories) ? customCategories : loadCategories()
  const all = [...BASE, ...fromData, ...custom]
  return Array.from(new Set(all.filter(Boolean))).sort((a, b) => a.localeCompare(b))
}
