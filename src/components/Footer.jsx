import { XIcon, InstagramIcon, YouTubeIcon, TikTokIcon } from './icons'
import { useStore } from '../store/StoreProvider'
import { resolveCommunityLink } from '../lib/communityLinks'

const COMMUNITY_FOOTER = [
  { key: 'youtube', label: 'YouTube' },
  { key: 'discord', label: 'Discord' },
  { key: 'creator', label: '1:1 with the creator' },
]

export default function Footer({ onNavigate }) {
  const { communityLinks } = useStore()
  const goHome = () => onNavigate({ page: 'home' })
  const goSection = (section) => onNavigate({ page: 'home', section })
  const goFields = (cat) => onNavigate({ page: 'fields', cat })

  return (
    <footer className="wf-footer">
      <div className="wf-footer-grid">
        <div>
          <button className="wf-brand" onClick={goHome} style={{ marginBottom: 18 }}>
            <span className="wf-monogram" style={{ width: 34, height: 34, fontSize: 19 }}>
              W
            </span>
            <span className="wf-wordmark" style={{ fontSize: 13.5, letterSpacing: '0.26em' }}>
              WASLERR&nbsp;FIELDS
            </span>
          </button>
          <p className="wf-footer-tag">
            Cinematic subliminal audio, engineered for the subconscious. Reprogram the mind. Reshape your reality.
          </p>
          <div className="wf-soc-row">
            <a className="wf-soc" href="#" aria-label="X" onClick={(e) => e.preventDefault()}>
              <XIcon />
            </a>
            <a className="wf-soc" href="#" aria-label="Instagram" onClick={(e) => e.preventDefault()}>
              <InstagramIcon />
            </a>
            <a className="wf-soc" href="#" aria-label="YouTube" onClick={(e) => e.preventDefault()}>
              <YouTubeIcon size={17} />
            </a>
            <a className="wf-soc" href="#" aria-label="TikTok" onClick={(e) => e.preventDefault()}>
              <TikTokIcon />
            </a>
          </div>
        </div>

        <div>
          <div className="wf-foot-col-h">Collection</div>
          <div className="wf-foot-links">
            <button className="wf-flink" onClick={() => goSection('wf-collection')}>Wealth</button>
            <button className="wf-flink" onClick={() => goSection('wf-collection')}>Confidence</button>
            <button className="wf-flink" onClick={() => goSection('wf-collection')}>Attraction</button>
            <button className="wf-flink" onClick={() => goSection('wf-collection')}>Sleep</button>
          </div>
        </div>

        <div>
          <div className="wf-foot-col-h">Company</div>
          <div className="wf-foot-links">
            <button className="wf-flink" onClick={() => goFields('desire')}>Desire Code</button>
            <button className="wf-flink" onClick={() => goFields('akashic')}>Akashic Field</button>
            <button className="wf-flink" onClick={() => goSection('wf-free')}>Free fields</button>
            <button className="wf-flink" onClick={() => goSection('wf-custom')}>Custom Code</button>
          </div>
        </div>

        <div>
          <div className="wf-foot-col-h">Community</div>
          <div className="wf-foot-links">
            <button className="wf-flink" onClick={() => onNavigate({ page: 'community' })}>
              Join the circle
            </button>
            {COMMUNITY_FOOTER.map(({ key, label }) => {
              const { href, external } = resolveCommunityLink(key, communityLinks[key])
              return (
                <a
                  key={key}
                  className="wf-flink"
                  href={href}
                  {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  {label}
                </a>
              )
            })}
          </div>
        </div>

        <div>
          <div className="wf-foot-col-h">Legal</div>
          <div className="wf-foot-links">
            <button className="wf-flink" onClick={goHome}>Privacy</button>
            <button className="wf-flink" onClick={goHome}>Terms</button>
            <button className="wf-flink" onClick={goHome}>Guarantee</button>
          </div>
        </div>
      </div>

      <div className="wf-footer-base">
        <span>© 2026 Waslerr Fields. All rights reserved.</span>
        <span className="disclaimer">
          Audio is designed to support mindset and self-improvement. It is not medical treatment. Individual results
          vary.
        </span>
      </div>
    </footer>
  )
}
