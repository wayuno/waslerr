import { community } from '../data/content'
import { YouTubeIcon, DiscordIcon, ChatIcon, ArrowRight } from './icons'

const CARDS = [
  {
    href: community.youtube,
    Icon: YouTubeIcon,
    title: 'YouTube',
    body: 'New fields, breakdowns and free guided sessions every week.',
    cta: 'Subscribe',
    external: true,
  },
  {
    href: community.discord,
    Icon: DiscordIcon,
    title: 'Discord',
    body: 'Join the community — share results, get support and unlock early access.',
    cta: 'Join Discord',
    external: true,
  },
  {
    href: community.email,
    Icon: ChatIcon,
    title: '1:1 with the creator',
    body: 'Book a private call to design your transformation, one to one.',
    cta: 'Book a session',
    external: false,
  },
]

export default function JoinCards() {
  return (
    <div className="wf-join-grid" data-reveal>
      {CARDS.map(({ href, Icon, title, body, cta, external }) => (
        <a
          key={title}
          className="wf-join-card"
          href={href}
          {...(external ? { target: '_blank', rel: 'noopener' } : {})}
        >
          <span className="wf-join-ic">
            <Icon />
          </span>
          <h3 className="wf-join-title">{title}</h3>
          <p className="wf-join-body">{body}</p>
          <span className="wf-join-cta">
            {cta} <ArrowRight size={14} />
          </span>
        </a>
      ))}
    </div>
  )
}
