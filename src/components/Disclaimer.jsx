// "Sign-type" disclaimer notice — a bordered glass card with a gold alert
// badge, the entertainment / not-medical statement, and a highlighted
// no-refund line. Used on the field detail page and in the global footer.
export default function Disclaimer() {
  return (
    <div className="wf-disclaimer" role="note" aria-label="Disclaimer">
      <div className="wf-disclaimer-head">
        <span className="wf-disclaimer-badge" aria-hidden="true">!</span>
        <span className="wf-disclaimer-title">Disclaimer</span>
      </div>
      <p className="wf-disclaimer-text">
        Please note that none of my audios should be considered a substitute for professional care,
        they are only for entertainment purpose. If you have any personal health or well-being
        concern, it is important to seek appropriate assistance from qualified professionals. I do
        not claim that my audios replace or replicate the benefits of professional care and I do not
        guarantee or promise anything else.
      </p>
      <p className="wf-disclaimer-refund">Refund is not available on any product.</p>
    </div>
  )
}
