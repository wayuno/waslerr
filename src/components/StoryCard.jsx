import { StarIcon } from './icons'
import { relTime } from '../lib/wall'

export function Stars({ rating = 5, size = 14 }) {
  const r = Math.round(rating)
  return (
    <span className="wf-stars-row" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon key={n} size={size} filled={n <= r} />
      ))}
    </span>
  )
}

// A single community story card, used on the Reviews wall and the field
// detail-page summary. `fresh` triggers the fade-in for new submissions.
export default function StoryCard({ story, fieldName, fieldCls, onField, fresh = false }) {
  return (
    <article className={`wf-story-card${story.featured ? ' featured' : ''}${fresh ? ' wf-card-in' : ''}`}>
      {story.featured && <span className="wf-story-badge">★ Featured</span>}
      <Stars rating={story.rating} />
      <blockquote className="wf-story-quote">{story.text}</blockquote>
      {Array.isArray(story.images) && story.images.length > 0 && (
        <div className="wf-story-photos">
          {story.images.slice(0, 2).map((url) => (
            <a className="wf-story-photo" href={url} target="_blank" rel="noreferrer" key={url}>
              <img src={url} alt="Review" loading="lazy" />
            </a>
          ))}
        </div>
      )}
      <div className="wf-story-foot">
        <span className="wf-story-av">{(story.name || '?').charAt(0).toUpperCase()}</span>
        <span className="wf-story-meta">
          <span className="wf-story-name">{story.name}</span>
          {fieldName && (
            <button className={`wf-story-field ${fieldCls || ''}`} onClick={() => onField?.(story.field)}>
              on {fieldName}
            </button>
          )}
        </span>
        <span className="wf-story-time">{relTime(story.ts)}</span>
      </div>
    </article>
  )
}
