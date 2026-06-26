// All site content/data for Waslerr Fields.
import valentine from '../assets/products/valentine.jpg'

// --- Home: Top picks ---
export const topPicks = [
  {
    id: 'valentine',
    title: 'Valentine Ultimate Male Aura',
    line: 'desire',
    price: '$151',
    freq: 196,
    img: valentine,
    desc: 'An advanced, slightly-audible subliminal layering Desire Code and Akashic Field to build a magnetic masculine aura and an unshakable presence.',
  },
  {
    id: 'perfect-hairs',
    title: 'Perfect Hairs',
    line: 'desire',
    price: '$320',
    freq: 207,
    desc: 'Two audios in one. Each blends subliminal affirmations, a Desire Code and a dedicated hair field to support thicker, healthier growth.',
  },
  {
    id: 'porn-freedom',
    title: 'Porn-Addiction Freedom',
    line: 'akashic',
    price: '$95',
    freq: 185,
    desc: 'A complex audio with audible affirmations, Akashic Field and Desire Code engineered to dissolve compulsive habits and restore self-control.',
  },
]

// --- Home: Free fields ---
export const freeFields = [
  {
    id: 'morning-ignition',
    title: 'Morning Ignition',
    line: 'desire',
    freq: 210,
    desc: 'A two-minute primer of confidence and clarity to start the day decisive.',
  },
  {
    id: 'calm-current',
    title: 'Calm Current',
    line: 'akashic',
    freq: 180,
    desc: 'Grounding delta tones to release tension and return you to center.',
  },
  {
    id: 'abundance-spark',
    title: 'Abundance Spark',
    line: 'desire',
    freq: 233,
    desc: 'A taster of the wealth field — feel the shift in your money mindset before you commit.',
  },
]

// --- Fields page: full catalogue ---
export const allFields = [
  { ...topPicks[0] },
  { ...topPicks[1] },
  { ...topPicks[2] },
  {
    id: 'harem-paradise',
    title: 'Harem Paradise',
    line: 'desire',
    price: '$795',
    freq: 220,
    desc: 'A premium Desire Code built to manifest a life of abundance, magnetism and devotion — entirely on your own terms.',
  },
  {
    id: 'limitless-wealth',
    title: 'Limitless Wealth',
    line: 'desire',
    price: '$199',
    freq: 233,
    desc: 'Reprogram your money setpoint. Desire Code and Akashic Field align identity, action and opportunity around lasting wealth.',
  },
  {
    id: 'deep-akashic-healing',
    title: 'Deep Akashic Healing',
    line: 'akashic',
    price: '$249',
    freq: 178,
    desc: 'Return to the deeper record of self — release inherited blocks and restore intuition, calm and alignment from the source.',
  },
]

// --- Three lines ---
export const lines = [
  {
    idx: 'Line 01',
    title: 'Desire Code',
    body: 'Outcome engineering — scripts that encode a precise external result: wealth, attraction, success.',
    meta: '48 fields',
  },
  {
    idx: 'Line 02',
    title: 'Akashic Field',
    body: 'Inner alignment — deeper work on identity, intuition and self beneath the goals.',
    meta: '24 fields',
  },
  {
    idx: 'Line 03',
    title: 'Custom Code',
    body: 'A bespoke field, written, voiced and tuned to your exact intention.',
    meta: 'Request below',
    featured: true,
  },
]

export const customBenefits = [
  'Bespoke affirmation script, written for your goal',
  'Frequencies & brainwave band of your choice',
  'Studio-mastered, headphone-optimized',
  'Private revisions until it’s right',
  'Delivered within 7 days',
]

export const focusOptions = [
  { value: 'wealth', label: 'Wealth & abundance' },
  { value: 'confidence', label: 'Confidence & self-worth' },
  { value: 'attraction', label: 'Attraction & magnetism' },
  { value: 'success', label: 'Success & performance' },
  { value: 'focus', label: 'Focus & productivity' },
  { value: 'sleep', label: 'Sleep & healing' },
  { value: 'akashic', label: 'Identity & inner alignment' },
  { value: 'other', label: 'Something else' },
]

// --- Reviews ---
export const reviews = [
  { initial: 'M', name: 'Marcus T.', role: 'Founder', quote: 'Three weeks with Aurum and my relationship with money completely changed. I stopped flinching at big numbers.' },
  { initial: 'L', name: 'Lena R.', role: 'Consultant', quote: 'Sovereign rebuilt my confidence from the floor up. I walk into pitches like the room already belongs to me.' },
  { initial: 'D', name: 'Devon K.', role: 'Engineer', quote: 'Flowstate is unreal. Four-hour deep work blocks now feel effortless. The production quality is in another league.' },
  { initial: 'S', name: 'Sofia A.', role: 'Designer', quote: 'Magnetism is subtle but undeniable. People lean in differently now. I feel composed instead of anxious.' },
]

// --- FAQ ---
export const faqs = [
  {
    q: 'How do subliminals actually work?',
    a: 'Affirmations are mixed beneath the threshold of conscious hearing. Your conscious mind hears ambient sound; your subconscious receives the suggestions directly, bypassing the critical filter that normally rejects new self-beliefs.',
  },
  {
    q: 'Will I be able to hear the affirmations?',
    a: 'No. By design they sit below conscious perception — you’ll hear only the cinematic soundscape and carrier tones. That’s exactly how they slip past resistance.',
  },
  {
    q: 'How often should I listen?',
    a: 'Daily, 30–60 minutes, with headphones. Consistency matters far more than volume or duration — the subconscious responds to repetition over time.',
  },
  {
    q: 'How long until I notice results?',
    a: 'Most listeners report subtle shifts in mood and self-talk within 1–2 weeks, with more noticeable behavioural change across 4–8 weeks. Results vary by individual and consistency.',
  },
  {
    q: 'Are subliminals safe?',
    a: 'Yes. Every affirmation is positive, ethically written, and reviewed. Nothing is coercive. Avoid listening while driving or operating machinery.',
  },
  {
    q: 'Can I listen while sleeping?',
    a: 'Absolutely — the Delta-frequency fields like Lucid and Sovereign are built for it. The sleeping mind is unusually receptive, making overnight one of the most effective windows.',
  },
]

// --- Method steps ---
export const methodSteps = [
  { num: '01', title: 'Choose your field', body: 'Select the outcome you’re engineering — wealth, confidence, magnetism. Each field targets a specific belief system.' },
  { num: '02', title: 'Listen daily', body: 'Headphones, low volume, 30–60 minutes. The masked affirmations sit just beneath conscious hearing.' },
  { num: '03', title: 'The subconscious absorbs', body: 'Bypassing the critical filter, repeated suggestions begin overwriting limiting beliefs at the source.' },
  { num: '04', title: 'Behaviour shifts. Reality follows.', body: 'New defaults take hold — decisions, posture, presence. The external change is the echo of the internal one.' },
]

// --- Ticker items ---
export const tickerItems = [
  'Lossless studio masters',
  'Instant access',
  'Headphone-optimized',
  '50,000+ listeners',
  'New fields monthly',
  '30-day guarantee',
]

// --- Community links ---
export const community = {
  youtube: 'https://youtube.com/@waslerrfields',
  discord: 'https://discord.gg/waslerrfields',
  email: 'mailto:hello@waslerrfields.com?subject=1%3A1%20with%20the%20creator',
}

// --- Detail page: generic per-field benefits ---
export const fieldBenefits = [
  'Silent subliminal layer engineered for nightly looping',
  'Akashic carrier tuned to a calm delta-state',
  'Desire Code affirmations written in present tense',
  'Lifetime access and free field updates',
]

// Paid + free generic benefit lists (fallbacks)
export const genericBenefits = [
  'A magnetic, grounded presence others feel before you speak',
  'Quiet, unshakable confidence in high-stakes rooms',
  'Self-talk that defaults to worth instead of doubt',
  'Calm authority — composed under pressure, never rattled',
  'Decisions made from certainty, not anxiety',
  'Eye contact and posture that hold their ground',
  'A reset of the limiting beliefs running underneath',
  'Lifetime access and every future update, free',
]
export const freeBenefits = [
  'A genuine taste of the Waslerr engine — no card, no catch',
  'A gentle shift in mood and self-talk from the first listen',
  'A calmer baseline you can return to any time',
  'Yours to keep forever, in lossless FLAC and MP3',
]

// Per-field benefit lists keyed by product id. Valentine ships the full 22.
export const benefitsById = {
  valentine: [
    'A magnetic masculine aura people orbit toward',
    'Effortless presence that fills a room before you say a word',
    'Deep, settled confidence that needs no performance',
    'The calm certainty of a man who knows his worth',
    'Natural eye contact that holds, never flinches',
    'A grounded, unhurried way of moving and speaking',
    'Magnetism that reads as warmth, not arrogance',
    'Attraction that feels inevitable rather than forced',
    'A voice that lands lower, slower and more sure',
    'Boundaries held without guilt or explanation',
    'Desire and respect arriving in the same breath',
    'Freedom from the need for approval or validation',
    'A quiet dominance that puts others at ease',
    'Self-image rebuilt around being genuinely wanted',
    'The end of overthinking every interaction',
    'Composure that holds under pressure and scrutiny',
    'A relaxed nervous system in social settings',
    'Leadership energy others instinctively follow',
    'Old rejection wounds dissolved at the root',
    'A masculine identity that feels like home',
    'Layered over a fresh Akashic carrier for deep encoding',
    'Lifetime access and every future revision, free',
  ],
  'perfect-hairs': [
    'A scalp environment primed for thicker, healthier growth',
    'Belief and biology aligned around a full, strong head of hair',
    'Daily stress around hair loss quietly released',
    'Two engineered audios working a dedicated hair field',
    'Desire Code affirmations written in present tense',
    'Lifetime access and every future update, free',
  ],
  'porn-freedom': [
    'Compulsive urges losing their grip, one day at a time',
    'Self-control that feels like freedom, not restriction',
    'Dopamine reward pathways gently re-patterned',
    'Shame replaced with steady, matter-of-fact resolve',
    'Reclaimed time, focus and energy for what matters',
    'Audible affirmations layered over an Akashic carrier',
    'Lifetime access and every future update, free',
  ],
}

// --- "What's new" changelog ---
export const updates = [
  {
    date: 'Jun 24, 2026',
    tag: 'NEW FIELD',
    title: 'Valentine Ultimate Male Aura is live',
    body: 'Our most requested Desire Code yet — a magnetic masculine presence layered over a fresh Akashic carrier.',
  },
  {
    date: 'Jun 18, 2026',
    tag: 'ENGINE',
    title: 'Akashic engine v3',
    body: 'Rebuilt carrier rendering for cleaner sub-bass and longer silent layers. Every existing Akashic field updated free.',
  },
  {
    date: 'Jun 09, 2026',
    tag: 'COMMUNITY',
    title: '50,000 listeners across 60 countries',
    body: 'Custom field requests now open for Inner Circle members.',
  },
  {
    date: 'May 30, 2026',
    tag: 'NEW FIELD',
    title: 'Wealth Magnetism Field',
    body: 'Abundance encoding with a decisiveness sub-layer. Built for daily morning loops.',
  },
]

// --- Admin: stats + revenue chart ---
export const adminMeta = {
  revenue: '$48,920',
  listeners: '50,142',
}
export const revenueBars = [
  { m: 'Jan', v: 28 },
  { m: 'Feb', v: 34 },
  { m: 'Mar', v: 30 },
  { m: 'Apr', v: 39 },
  { m: 'May', v: 44 },
  { m: 'Jun', v: 49 },
]

// --- Admin: extra catalogue fields beyond the original handoff set ---
export const extraFields = [
  {
    id: 'wealth-magnetism',
    title: 'Wealth Magnetism Field',
    line: 'wealth',
    price: '$180',
    freq: 174,
    desc: 'A deep frequency field that encodes abundance, decisiveness and money magnetism directly into the subconscious.',
  },
  {
    id: 'unshakable-confidence',
    title: 'Unshakable Confidence',
    line: 'desire',
    price: '$130',
    freq: 201,
    desc: 'Layered Desire Code affirmations that rebuild self-worth, eye contact and the calm authority of a grounded presence.',
  },
  {
    id: 'deep-sleep-reset',
    title: 'Deep Sleep Reset',
    line: 'akashic',
    price: '$75',
    freq: 172,
    desc: 'A gentle Akashic field tuned for delta-state recovery — fall asleep faster and wake reprogrammed.',
  },
]
