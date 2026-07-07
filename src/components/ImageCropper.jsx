import { useCallback, useEffect, useRef, useState } from 'react'

// Profile-photo style crop/reposition modal.
// Admin picks a file → drags to reposition + slider/wheel to zoom inside a
// fixed-aspect frame → we export exactly what's framed as a JPEG File, so the
// image never gets cut from the top wherever it's later shown (object-fit:cover
// on a centered, pre-framed image is a no-op).
export default function ImageCropper({ file, aspect = 1, outW = 1200, title = 'Adjust image', onCancel, onDone }) {
  const [url, setUrl] = useState('')
  const [nat, setNat] = useState(null) // { w, h } natural pixels
  const [frame, setFrame] = useState({ w: 0, h: 0 }) // displayed frame pixels
  const [zoom, setZoom] = useState(1)
  const [off, setOff] = useState({ x: 0, y: 0 }) // image translation from centered, px
  const [busy, setBusy] = useState(false)
  const frameRef = useRef(null)
  const imgRef = useRef(null)
  const drag = useRef(null)

  // object URL for the picked file
  useEffect(() => {
    if (!file) return undefined
    const u = URL.createObjectURL(file)
    setUrl(u)
    setZoom(1)
    setOff({ x: 0, y: 0 })
    return () => URL.revokeObjectURL(u)
  }, [file])

  // keep the frame's measured pixel size in state (for crop math + responsive)
  useEffect(() => {
    const el = frameRef.current
    if (!el) return undefined
    const measure = () => setFrame({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [url])

  // esc to cancel
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  // cover scale: image fills the frame at zoom 1 (min zoom)
  const baseScale = nat && frame.w ? Math.max(frame.w / nat.w, frame.h / nat.h) : 1

  const clamp = useCallback(
    (o, z) => {
      if (!nat || !frame.w) return o
      const k = baseScale * z
      const maxX = Math.max(0, (nat.w * k - frame.w) / 2)
      const maxY = Math.max(0, (nat.h * k - frame.h) / 2)
      return { x: Math.max(-maxX, Math.min(maxX, o.x)), y: Math.max(-maxY, Math.min(maxY, o.y)) }
    },
    [nat, frame, baseScale],
  )

  const onImgLoad = (e) => setNat({ w: e.target.naturalWidth, h: e.target.naturalHeight })

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drag.current = { px: e.clientX, py: e.clientY, ox: off.x, oy: off.y }
  }
  const onPointerMove = (e) => {
    if (!drag.current) return
    const nx = drag.current.ox + (e.clientX - drag.current.px)
    const ny = drag.current.oy + (e.clientY - drag.current.py)
    setOff(clamp({ x: nx, y: ny }, zoom))
  }
  const onPointerUp = () => { drag.current = null }

  const onWheel = (e) => {
    const z = Math.max(1, Math.min(5, zoom + (e.deltaY < 0 ? 0.12 : -0.12)))
    setZoom(z)
    setOff((o) => clamp(o, z))
  }
  const onZoomInput = (e) => {
    const z = Number(e.target.value)
    setZoom(z)
    setOff((o) => clamp(o, z))
  }

  // displayed image box (px) for absolute positioning inside the frame
  const dispW = nat ? nat.w * baseScale * zoom : 0
  const dispH = nat ? nat.h * baseScale * zoom : 0
  const left = (frame.w - dispW) / 2 + off.x
  const top = (frame.h - dispH) / 2 + off.y

  const exportCanvas = (canvas) => {
    canvas.toBlob(
      (blob) => {
        setBusy(false)
        if (!blob) { onDone(file); return } // fall back to the original on failure
        const name = (file.name || 'image').replace(/\.[^.]+$/, '') + '.jpg'
        onDone(new File([blob], name, { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.85,
    )
  }

  const confirm = () => {
    const img = imgRef.current
    if (!img || !nat || !frame.w) return
    setBusy(true)
    const k = baseScale * zoom
    const cropW = frame.w / k
    const cropH = frame.h / k
    const sx = nat.w / 2 - off.x / k - cropW / 2
    const sy = nat.h / 2 - off.y / k - cropH / 2
    const outH = Math.round(outW / aspect)
    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, outW, outH)
    exportCanvas(canvas)
  }

  // keep the WHOLE photo at its own aspect ratio — downscale only, no crop
  const confirmFull = () => {
    const img = imgRef.current
    if (!img || !nat) return
    setBusy(true)
    const scale = Math.min(1, outW / Math.max(nat.w, nat.h))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(nat.w * scale))
    canvas.height = Math.max(1, Math.round(nat.h * scale))
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    exportCanvas(canvas)
  }

  return (
    <div className="wf-crop-overlay" role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel?.() }}>
      <div className="wf-crop-panel">
        <div className="wf-crop-head">
          <span className="wf-eyebrow">{title}</span>
          <button className="wf-crop-x" aria-label="Cancel" onClick={onCancel}>✕</button>
        </div>

        <div
          ref={frameRef}
          className="wf-crop-frame"
          style={{ aspectRatio: String(aspect) }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onWheel={onWheel}
        >
          {url && (
            <img
              ref={imgRef}
              src={url}
              alt=""
              draggable="false"
              onLoad={onImgLoad}
              style={{ position: 'absolute', left, top, width: dispW || undefined, height: dispH || undefined, maxWidth: 'none' }}
            />
          )}
          <span className="wf-crop-grid" aria-hidden="true" />
        </div>

        <div className="wf-crop-zoom">
          <span aria-hidden="true">−</span>
          <input type="range" min="1" max="5" step="0.01" value={zoom} onChange={onZoomInput} aria-label="Zoom" />
          <span aria-hidden="true">+</span>
        </div>
        <p className="wf-crop-hint">Drag to reposition · scroll or slide to zoom · or keep the whole photo uncropped</p>

        <div className="wf-crop-actions">
          <button type="button" className="wf-btn wf-btn-glass" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="wf-btn wf-btn-glass" onClick={confirmFull} disabled={busy || !nat}>
            Use full photo
          </button>
          <button type="button" className="wf-form-submit wf-mag" onClick={confirm} disabled={busy || !nat}>
            {busy ? 'Saving…' : 'Use this photo'}
          </button>
        </div>
      </div>
    </div>
  )
}
