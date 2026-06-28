// Shared bits for the Listening Method: icon set, defaults, and normalizer —
// used by both the product-page modal (ListeningMethod) and the admin editor
// (MethodEditor).

export const ICONS = {
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  volume: (
    <>
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />
    </>
  ),
  sunrise: (
    <>
      <path d="M12 2v4M4.9 8.9 6.3 10.3M2 15h2M20 15h2M17.7 10.3l1.4-1.4" />
      <path d="M8 15a4 4 0 0 1 8 0" />
      <path d="M2 19h20" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  headphones: (
    <>
      <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
      <rect x="3" y="14" width="4" height="6" rx="1.5" />
      <rect x="17" y="14" width="4" height="6" rx="1.5" />
    </>
  ),
  sparkle: <path d="M12 3l1.8 5.2L19 11l-5.2 1.8L12 18l-1.8-5.2L5 11l5.2-1.8z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  heart: <path d="M12 20s-7-4.6-9.2-9A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 9.2 5C19 15.4 12 20 12 20z" />,
  flame: <path d="M12 3c1 3-2 4-2 7a2 2 0 0 0 4 0c0-1 .5-1.5 1-2 1 2 2 3 2 5a5 5 0 0 1-10 0c0-3 3-4 3-7z" />,
}
export const ICON_KEYS = Object.keys(ICONS)

export const Glyph = ({ k, size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {ICONS[k] || ICONS.sparkle}
  </svg>
)

export const uid = () => 'b-' + Math.random().toString(36).slice(2, 9)

export const defaultMethod = (title) => ({
  headline: 'Listen low. Let it land.',
  intro: `${title || 'This field'} is slightly audible by design — the code sits beneath the music. You don't strain to hear it. You let it work.`,
  steps: [
    { id: uid(), icon: 'moon', title: 'Settle', body: 'Headphones on, lights low. No scrolling, no multitasking — just be received.' },
    { id: uid(), icon: 'volume', title: 'Play it low', body: 'Slightly audible is enough. The code lives under the music — you don’t need to hear words.' },
    { id: uid(), icon: 'sunrise', title: 'Twice a day', body: 'Once in the morning, once as you fall asleep. Consistency is the whole method.' },
    { id: uid(), icon: 'calendar', title: 'Stay 21 days', body: 'The field rewrites slowly. Give it three weeks before you judge what moved.' },
  ],
  pills: ['Headphones recommended', '2× daily', '21-day field', 'Lifetime access'],
})

// Accept a stored method object, fall back to defaults when missing/invalid.
export const normalizeMethod = (raw, title) => {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.steps) || !raw.steps.length) return defaultMethod(title)
  return {
    headline: raw.headline || 'Listen low. Let it land.',
    intro: raw.intro || '',
    steps: raw.steps.map((s) => ({
      id: s.id || uid(),
      icon: ICON_KEYS.includes(s.icon) ? s.icon : 'sparkle',
      title: s.title || '',
      body: s.body || '',
    })),
    pills: Array.isArray(raw.pills) ? raw.pills.filter(Boolean) : [],
  }
}
