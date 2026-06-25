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
