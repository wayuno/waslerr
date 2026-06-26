import { useRef } from 'react'
import Background from '../components/Background'
import { useReveal } from '../hooks/useReveal'
import { useMagnetic } from '../hooks/useMagnetic'
import { useStore } from '../store/StoreProvider'
import { resolveCommunityLink } from '../lib/communityLinks'
import { ChatIcon, ArrowRight } from '../components/icons'

// Official brand marks — kept accurate; the only place non-gold accent appears.
const YouTubeLogo = () => (
  <svg className="wf-cmt-mark" width="62" height="44" viewBox="0 0 62 44" aria-hidden="true">
    <rect width="62" height="44" rx="12" fill="#FF0000" />
    <path d="M25 13.2 44 22 25 30.8z" fill="#fff" />
  </svg>
)
const DiscordLogo = () => (
  <svg className="wf-cmt-mark" width="62" height="62" viewBox="0 0 62 62" aria-hidden="true">
    <rect width="62" height="62" rx="16" fill="#5865F2" />
    <g transform="translate(13 13) scale(1.5)" fill="#fff">
      <path d="M19.3 5.3A17 17 0 0 0 15 4l-.2.4a12.6 12.6 0 0 1 3.7 1.8 13.5 13.5 0 0 0-11.6 0A12.6 12.6 0 0 1 10.6 4.4L9.4 4A17 17 0 0 0 5 5.3C2.5 9 1.8 12.6 2.1 16.2A17 17 0 0 0 7.3 19l.7-1c-.6-.2-1.1-.5-1.6-.8l.4-.3a9.7 9.7 0 0 0 8.4 0l.4.3c-.5.3-1 .6-1.6.8l.7 1a17 17 0 0 0 5.2-2.8c.4-4.2-.6-7.8-2.6-10.9zM9.5 14.3c-.8 0-1.5-.8-1.5-1.7s.7-1.7 1.5-1.7 1.5.8 1.5 1.7-.7 1.7-1.5 1.7zm5 0c-.8 0-1.5-.8-1.5-1.7s.7-1.7 1.5-1.7 1.5.8 1.5 1.7-.7 1.7-1.5 1.7z" />
    </g>
  </svg>
)

const CARDS = [
  {
    key: 'youtube',
    id: 'wf-cl-youtube',
    cls: 'wf-cmt-card--yt',
    Logo: YouTubeLogo,
    title: 'YouTube',
    body: 'New fields, breakdowns and free guided sessions every week. Subscribe so you never miss a drop.',
    cta: 'Subscribe',
  },
  {
    key: 'discord',
    id: 'wf-cl-discord',
    cls: 'wf-cmt-card--dc',
    Logo: DiscordLogo,
    title: 'Discord',
    body: 'Join the community — share results, get support and unlock early access to new fields.',
    cta: 'Join Discord',
  },
  {
    key: 'creator',
    id: 'wf-cl-creator',
    cls: 'wf-cmt-card--gold',
    creator: true,
    title: '1:1 with the creator',
    body: 'Book a private call to design your transformation, one to one — your goals, your custom field.',
    cta: 'Book a session',
  },
]

export default function Community({ onNavigate }) {
  const ref = useRef(null)
  useReveal(ref)
  useMagnetic(ref)
  const { communityLinks } = useStore()

  return (
    <div className="wf-app" ref={ref}>
      <Background resonanceTop="48%" />

      <section className="wf-subhead wf-cmt-head" style={{ maxWidth: 720, padding: '94px 28px 14px' }}>
        <div className="wf-eyebrow" data-reveal>
          Join the party
        </div>
        <h1 className="wf-page-h1" data-reveal>
          Step inside the Waslerr circle.
        </h1>
        <p className="wf-page-lead" data-reveal>
          Weekly drops, free fields, and direct access to the creator. Come build with us.
        </p>
      </section>

      <section className="wf-section" style={{ maxWidth: 1080, margin: '0 auto', padding: '42px 28px 30px' }}>
        <div className="wf-cmt-grid">
          {CARDS.map(({ key, id, cls, Logo, creator, title, body, cta }) => {
            const { href, external } = resolveCommunityLink(key, communityLinks[key])
            return (
              <a
                key={key}
                id={id}
                className={`wf-cmt-card ${cls}`}
                data-reveal
                href={href}
                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                <span className="wf-cmt-bloom" aria-hidden="true" />
                <span className="wf-cmt-ic">
                  {creator ? (
                    <span className="wf-cmt-mark wf-cmt-mark--gold">
                      <ChatIcon size={26} />
                      <span className="wf-cmt-dot" aria-hidden="true" />
                    </span>
                  ) : (
                    <Logo />
                  )}
                </span>
                <h3 className="wf-cmt-title">{title}</h3>
                <p className="wf-cmt-body">{body}</p>
                <span className="wf-cmt-cta">
                  {cta} <ArrowRight size={14} />
                </span>
              </a>
            )
          })}
        </div>

        <div className="wf-cmt-secondary" data-reveal>
          <button className="wf-btn wf-btn-gold wf-mag" onClick={() => onNavigate({ page: 'fields' })}>
            Explore the fields <ArrowRight />
          </button>
        </div>
      </section>

      <footer className="wf-subfoot">
        <div className="wf-subfoot-row">
          <button className="wf-back" onClick={() => onNavigate({ page: 'home' })}>
            ← Back to home
          </button>
          <span className="wf-subfoot-note">
            Audio supports mindset &amp; self-improvement. Not medical treatment. Individual results vary.
          </span>
        </div>
      </footer>
    </div>
  )
}
