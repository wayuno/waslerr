import { useStore } from '../store/StoreProvider'
import { resolveCommunityLink } from '../lib/communityLinks'
import { YouTubeIcon, DiscordIcon, ChatIcon } from './icons'

const COMMUNITY_FOOTER = [
  { key: 'youtube', label: 'YouTube', icon: YouTubeIcon },
  { key: 'discord', label: 'Discord', icon: DiscordIcon },
  { key: 'creator', label: '1:1 with the creator', icon: ChatIcon },
]

export default function Footer({ onNavigate }) {
  const { communityLinks, openChat } = useStore()
  const goHome = () => onNavigate({ page: 'home' })

  return (
    <footer className="wf-footer">
      <div className="wf-footer-grid">
        <div>
          <button className="wf-brand" onClick={goHome} style={{ marginBottom: 18 }}>
            <img className="wf-brandmark" src="/logo-w.png" alt="Waslerr Fields" width="34" height="34" />
            <span className="wf-wordmark" style={{ fontSize: 13.5, letterSpacing: '0.26em' }}>
              WASLERR&nbsp;FIELDS
            </span>
          </button>
        </div>

        <div>
          <div className="wf-foot-col-h">Community</div>
          <div className="wf-foot-links">
            {COMMUNITY_FOOTER.map(({ key, label, icon: Icon }) => {
              if (key === 'creator') {
                return (
                  <button key={key} className="wf-flink" onClick={() => openChat()}>
                    <Icon size={16} /> {label}
                  </button>
                )
              }
              const { href, external } = resolveCommunityLink(key, communityLinks[key])
              return (
                <a
                  key={key}
                  className="wf-flink"
                  href={href}
                  {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  <Icon size={16} /> {label}
                </a>
              )
            })}
          </div>
        </div>

        <div>
          <div className="wf-foot-col-h">Support</div>
          <div className="wf-foot-links">
            <button className="wf-flink" onClick={() => openChat()}>
              <ChatIcon size={16} /> Chat with support
            </button>
            <a className="wf-flink" href="mailto:hello@waslerrfields.com?subject=Support">
              Email us
            </a>
            <button className="wf-flink" onClick={() => onNavigate({ page: 'method' })}>
              How to listen
            </button>
          </div>
        </div>

      </div>

      <div className="wf-footer-base">
        <span>© 2026 Waslerr Fields. All rights reserved.</span>
      </div>
    </footer>
  )
}
