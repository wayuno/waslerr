// Shared inline SVG icons for Waslerr Fields.
export const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
)

export const PauseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
)

export const ArrowRight = ({ size = 15 }) => (
  <svg className="wf-arrow" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

export const ChevronRight = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m9 18 6-6-6-6" />
  </svg>
)

export const ArrowDown = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12l7 7 7-7" />
  </svg>
)

export const CheckIcon = ({ size = 16, stroke = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

export const YouTubeIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.5 7.2a2.7 2.7 0 0 0-1.9-1.9C18.9 4.8 12 4.8 12 4.8s-6.9 0-8.6.5A2.7 2.7 0 0 0 1.5 7.2 28 28 0 0 0 1 12a28 28 0 0 0 .5 4.8 2.7 2.7 0 0 0 1.9 1.9c1.7.5 8.6.5 8.6.5s6.9 0 8.6-.5a2.7 2.7 0 0 0 1.9-1.9A28 28 0 0 0 23 12a28 28 0 0 0-.5-4.8zM9.8 15.3V8.7l5.7 3.3-5.7 3.3z" />
  </svg>
)

export const DiscordIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.3 5.3A17 17 0 0 0 15 4l-.2.4a12.6 12.6 0 0 1 3.7 1.8 13.5 13.5 0 0 0-11.6 0A12.6 12.6 0 0 1 10.6 4.4L9.4 4A17 17 0 0 0 5 5.3C2.5 9 1.8 12.6 2.1 16.2A17 17 0 0 0 7.3 19l.7-1c-.6-.2-1.1-.5-1.6-.8l.4-.3a9.7 9.7 0 0 0 8.4 0l.4.3c-.5.3-1 .6-1.6.8l.7 1a17 17 0 0 0 5.2-2.8c.4-4.2-.6-7.8-2.6-10.9zM9.5 14.3c-.8 0-1.5-.8-1.5-1.7s.7-1.7 1.5-1.7 1.5.8 1.5 1.7-.7 1.7-1.5 1.7zm5 0c-.8 0-1.5-.8-1.5-1.7s.7-1.7 1.5-1.7 1.5.8 1.5 1.7-.7 1.7-1.5 1.7z" />
  </svg>
)

export const ChatIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M21 11.5a8.4 8.4 0 0 1-11.7 7.7L3 21l1.8-6.3A8.4 8.4 0 1 1 21 11.5z" />
  </svg>
)

export const XIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.9 2H22l-7.5 8.6L23 22h-6.8l-5.3-7-6.1 7H1.7l8-9.2L1 2h6.9l4.8 6.4L18.9 2zm-2.4 18h1.9L7.6 4H5.6l10.9 16z" />
  </svg>
)

export const InstagramIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="3.6" />
    <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
  </svg>
)

export const TikTokIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M16.5 2c.3 2.2 1.5 3.6 3.7 3.8v2.6c-1.3.1-2.5-.3-3.7-1v6.6c0 4-2.9 6.4-6.3 5.7-3-.6-4.6-3.6-3.7-6.5.8-2.5 3.2-3.8 5.7-3.4v2.8c-.4-.1-.8-.2-1.3-.1-1.2.1-2 1-1.9 2.2.1 1.2 1.1 2 2.4 1.8 1.1-.2 1.8-1.1 1.8-2.4V2h3.6z" />
  </svg>
)

export const ChatIconBubble = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path d="M21 11.5a8.4 8.4 0 0 1-11.7 7.7L3 21l1.8-6.3A8.4 8.4 0 1 1 21 11.5z" />
    <circle cx="8.5" cy="11.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="11.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="11.5" r="1" fill="currentColor" stroke="none" />
  </svg>
)

export const CloseIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
)

export const SendIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
    <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
  </svg>
)

export const PlusIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const TrashIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
  </svg>
)

export const StarRow = ({ count = 5 }) => <span aria-hidden="true">{'★'.repeat(count)}</span>

export const CartIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="20" r="1.4" />
    <circle cx="18" cy="20" r="1.4" />
    <path d="M2.5 3h2.2l2 12.2a1.5 1.5 0 0 0 1.5 1.3h8.4a1.5 1.5 0 0 0 1.5-1.2L21 7H6" />
  </svg>
)

export const StarIcon = ({ size = 16, filled = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
    <path d="M12 3.2l2.6 5.5 6 .7-4.4 4.1 1.2 5.9L12 16.9 6.6 19.4l1.2-5.9L3.4 9.4l6-.7z" />
  </svg>
)

export const BellIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
)

export const MegaphoneIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 11 15-5v12L3 13zM3 11v4M11.6 16.5l1 3.5" />
  </svg>
)

export const TagIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 12.5 12.5 20l-8-8V4h8z" />
    <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
  </svg>
)

export const DiscIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="2.4" />
  </svg>
)

export const BookmarkIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
    <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
  </svg>
)

export const DownloadIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
  </svg>
)

export const ShareIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
  </svg>
)

export const LinkIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
  </svg>
)

export const WhatsAppIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2zm5.8 14.2c-.2.7-1.2 1.3-1.7 1.3-.5.1-1 .2-3.2-.7-2.7-1.1-4.4-3.9-4.5-4-.1-.2-1.1-1.4-1.1-2.7s.7-1.9 1-2.2c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.1.1.3 0 .5l-.4.5-.3.4c-.1.1-.3.3-.1.6.1.3.7 1.1 1.4 1.8 1 .8 1.7 1.1 2 1.2.2.1.4.1.5-.1l.7-.8c.2-.2.4-.2.6-.1l1.9.9c.2.1.4.2.4.3.1.2.1.7-.1 1.4z" />
  </svg>
)

export const TelegramIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M21.9 4.3 18.6 20c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6 13.7l-4.9-1.5c-1.1-.3-1.1-1 .2-1.5l19.2-7.4c.9-.3 1.7.2 1.4 1z" />
  </svg>
)
// PayPal: two overlapping P glyphs — back #003087 (dark), front #0099de (light), offset right
// Renders on a white tile; counters drawn in white to create the P's inner bowl
export const PayPalMark = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
    {/* Back P — dark blue */}
    <path d="M4 5h3v18H4zm3 0h7c3 0 5 2 5 5s-2 5-5 5H7V5z" fill="#003087" />
    <path d="M7.5 8h6c1.1 0 2 .9 2 2s-.9 2-2 2H7.5V8z" fill="white" />
    {/* Front P — light blue, shifted right 4px */}
    <path d="M8 5h3v18H8zm3 0h7c3 0 5 2 5 5s-2 5-5 5h-7V5z" fill="#0099de" />
    <path d="M11.5 8h6c1.1 0 2 .9 2 2s-.9 2-2 2H11.5V8z" fill="white" />
  </svg>
)

// Binance: #F0B90B gold circle with authentic mark path knocked out in white
export const BinanceMark = ({ size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="12" fill="#F0B90B" />
    <g transform="translate(12,12) scale(0.64) translate(-11,-12)">
      <path
        fill="white"
        d="M16.624 13.9202l2.7175 2.7174L12 23.9776l-7.3387-7.34 2.7176-2.7174L12 18.5425l4.624-4.6223zM12 .0224l7.34 7.3398-2.7177 2.7176L12 5.4576 7.0975 10.08 4.3799 7.3622 12 .0224zM2.7176 9.2599L5.435 11.9774l-2.7174 2.7176L0 11.9774l2.7176-2.7175zm16.5648 0l2.7176 2.7174-2.7176 2.7177-2.7175-2.7176 2.7175-2.7175zM14.6976 11.9775L12 9.28l-1.9945 1.9945-.2293.2295-.4726.4734-.0027.0024.0027.003L12 14.6776l2.6976-2.7z"
      />
    </g>
  </svg>
)
