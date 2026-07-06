import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/*
  CosmicHero — a cinematic, production-ready Three.js hero backdrop.

  • Procedural sun (fbm simplex-noise shader) + additive corona sprite
  • Instanced asteroid belt with Keplerian speeds (inner faster, 1/r^1.5) and
    per-axis tumbling, lit only sun-side by a PointLight at the core
  • Gold starfield
  • Optional desktop-only foreground canvas so a few asteroids pass IN FRONT of
    the DOM headline (dropped on mobile — everything renders in one canvas)

  Robustness: WebGL try/catch + CSS fallback, context-loss recovery, reduced
  motion (single static frame), ResizeObserver + orientationchange reshape,
  DPR caps, coarse-pointer count reduction, IntersectionObserver/visibility
  pause, ref-only frame loop (no React state), full disposal on unmount.
*/

// ------- procedural sun: Ashima 3D simplex noise + fbm ---------------------
const SUN_VERT = /* glsl */ `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const SUN_FRAG = /* glsl */ `
  varying vec3 vPos;
  uniform float uTime;
  uniform vec3 uHot;
  uniform vec3 uCold;

  vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
  vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0/7.0;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
  float fbm(vec3 p){
    float f = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++){ f += a * snoise(p); p *= 2.02; a *= 0.5; }
    return f;
  }
  void main(){
    vec3 p = normalize(vPos);
    float t = uTime * 0.12;
    float n = fbm(p * 2.4 + vec3(t, t * 0.7, -t));
    float veins = fbm(p * 5.5 - vec3(t * 1.4));
    float heat = clamp(0.5 + 0.5 * n + 0.28 * veins, 0.0, 1.0);
    vec3 col = mix(uCold, uHot, pow(heat, 1.5));
    col += pow(heat, 6.0) * 0.6;               // bright flare cores
    gl_FragColor = vec4(col, 1.0);
  }
`

const mql = (q) => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q) : { matches: false, addEventListener() {}, removeEventListener() {} })
const hasWebGL = () => {
  try {
    const c = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')))
  } catch { return false }
}

// radial gradient sprite texture (corona) — CORS-free, generated on a canvas
function radialTexture(inner, outer) {
  const s = 256
  const c = document.createElement('canvas')
  c.width = c.height = s
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, inner)
  g.addColorStop(0.4, outer)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export default function CosmicHero() {
  const mountRef = useRef(null)
  const bgRef = useRef(null)
  const fgRef = useRef(null)
  const fallbackRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    const bgCanvas = bgRef.current
    if (!mount || !bgCanvas) return undefined

    const coarse = mql('(pointer: coarse)').matches
    const reduce = mql('(prefers-reduced-motion: reduce)').matches
    const wantFg = !coarse && !!fgRef.current
    const DPR_CAP = coarse ? 1.5 : 2
    const N_ASTEROIDS = coarse ? 60 : 150
    const N_FG = 12
    const N_STARS = coarse ? 300 : 900
    const SEG = coarse ? 48 : 96

    const showFallback = () => { if (fallbackRef.current) fallbackRef.current.style.opacity = '1' }
    if (!hasWebGL()) { showFallback(); return undefined }

    // ---- mutable world (no React state in the loop) ----
    const disposables = []
    const track = (o) => { if (o) disposables.push(o); return o }
    const clock = new THREE.Clock()
    const layout = { portrait: false, radiusScale: 1, groupY: 0 }
    const pointer = { x: 0, y: 0 }
    const cam = { x: 0, y: 0 }
    const flags = { onScreen: true, visible: true, built: false, running: false }
    const belt = [] // per-instance orbital params
    const fgBelt = []

    let bgR = null
    let fgR = null
    let scene = null
    let fgScene = null
    let camera = null
    let sunGroup = null
    let asteroids = null
    let fgAsteroids = null
    let sunMat = null
    let rafId = 0
    let ro = null
    let io = null

    const dims = () => {
      const r = mount.getBoundingClientRect()
      return { w: Math.max(1, Math.floor(r.width)), h: Math.max(1, Math.floor(r.height)) }
    }

    const tmpM = new THREE.Matrix4()
    const tmpQ = new THREE.Quaternion()
    const tmpE = new THREE.Euler()
    const tmpP = new THREE.Vector3()
    const tmpS = new THREE.Vector3()

    function makeBelt(mesh, list, count, rMin, rMax, sizeMin, sizeMax) {
      for (let i = 0; i < count; i++) {
        const r = rMin + Math.random() * (rMax - rMin)
        list.push({
          r,
          a: Math.random() * Math.PI * 2,
          speed: 0.9 / Math.pow(r, 1.5),           // Keplerian: inner faster
          inc: (Math.random() - 0.5) * 0.5,        // orbital inclination
          phase: Math.random() * Math.PI * 2,
          size: sizeMin + Math.random() * (sizeMax - sizeMin),
          tumble: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(1.4),
          rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        })
      }
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    }

    function updateBelt(mesh, list, dt, rScale) {
      for (let i = 0; i < list.length; i++) {
        const o = list[i]
        o.a += o.speed * dt
        o.rot.x += o.tumble.x * dt
        o.rot.y += o.tumble.y * dt
        o.rot.z += o.tumble.z * dt
        const r = o.r * rScale
        tmpP.set(Math.cos(o.a) * r, Math.sin(o.a * 0.9 + o.phase) * o.inc * r * 0.5, Math.sin(o.a) * r)
        tmpE.copy(o.rot)
        tmpQ.setFromEuler(tmpE)
        tmpS.setScalar(o.size)
        tmpM.compose(tmpP, tmpQ, tmpS)
        mesh.setMatrixAt(i, tmpM)
      }
      mesh.instanceMatrix.needsUpdate = true
    }

    function build() {
      if (flags.built) return
      const { w, h } = dims()
      if (w < 2 || h < 2) return // wait for a real size (avoids 0×0 setSize)

      try {
        bgR = new THREE.WebGLRenderer({ canvas: bgCanvas, antialias: !coarse, alpha: true, powerPreference: 'high-performance' })
      } catch {
        showFallback()
        return
      }
      bgR.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP))
      bgR.setSize(w, h, false)
      bgR.setClearColor(0x000000, 0)

      scene = new THREE.Scene()
      camera = new THREE.PerspectiveCamera(46, w / h, 0.1, 2000)
      camera.position.set(0, 0, 34)

      const world = new THREE.Group()
      scene.add(world)

      // lighting: bright core (decay 0 → no distance dimming, so far rocks stay
      // visible but each is still lit only on its sun-facing side) + low ambient
      const pl = new THREE.PointLight(0xffd27a, 2.6, 0, 0)
      world.add(pl)
      scene.add(new THREE.AmbientLight(0x33406a, 0.28))

      // ---- sun ----
      sunGroup = new THREE.Group()
      const sunGeo = track(new THREE.SphereGeometry(3.4, SEG, SEG))
      sunMat = track(new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uHot: { value: new THREE.Color(0xffe6a3) },
          uCold: { value: new THREE.Color(0xc8541b) },
        },
        vertexShader: SUN_VERT,
        fragmentShader: SUN_FRAG,
      }))
      sunGroup.add(new THREE.Mesh(sunGeo, sunMat))

      const coronaTex = track(radialTexture('rgba(255,214,140,0.95)', 'rgba(210,120,40,0.35)'))
      const coronaMat = track(new THREE.SpriteMaterial({ map: coronaTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.9 }))
      const corona = new THREE.Sprite(coronaMat)
      corona.scale.setScalar(13)
      sunGroup.add(corona)
      world.add(sunGroup)

      // ---- asteroid belt ----
      const rockGeo = track(new THREE.DodecahedronGeometry(0.34, 0))
      const rockMat = track(new THREE.MeshStandardMaterial({ color: 0x9a8f80, roughness: 1, metalness: 0.05, flatShading: true }))
      asteroids = new THREE.InstancedMesh(rockGeo, rockMat, N_ASTEROIDS)
      makeBelt(asteroids, belt, N_ASTEROIDS, 6.5, 13, 0.5, 1.5)
      world.add(asteroids)

      // ---- starfield (gold points) ----
      const starGeo = track(new THREE.BufferGeometry())
      const starPos = new Float32Array(N_STARS * 3)
      for (let i = 0; i < N_STARS; i++) {
        const rr = 120 + Math.random() * 260
        const th = Math.random() * Math.PI * 2
        const ph = Math.acos(2 * Math.random() - 1)
        starPos[i * 3] = rr * Math.sin(ph) * Math.cos(th)
        starPos[i * 3 + 1] = rr * Math.sin(ph) * Math.sin(th)
        starPos[i * 3 + 2] = rr * Math.cos(ph)
      }
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
      const starTex = track(radialTexture('rgba(255,240,200,1)', 'rgba(212,175,55,0.5)'))
      const starMat = track(new THREE.PointsMaterial({ size: 1.5, map: starTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xf0dca0, sizeAttenuation: true }))
      const stars = new THREE.Points(starGeo, starMat)
      scene.add(stars)
      scene.userData.stars = stars

      // ---- foreground scene (desktop only) ----
      if (wantFg) {
        try {
          fgR = new THREE.WebGLRenderer({ canvas: fgRef.current, antialias: true, alpha: true, powerPreference: 'high-performance' })
          fgR.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP))
          fgR.setSize(w, h, false)
          fgR.setClearColor(0x000000, 0)
          fgScene = new THREE.Scene()
          fgScene.add(new THREE.AmbientLight(0x33406a, 0.45))
          const fpl = new THREE.PointLight(0xffd27a, 2.4, 0, 0)
          fgScene.add(fpl)
          const fgMat = track(new THREE.MeshStandardMaterial({ color: 0xb0a595, roughness: 1, metalness: 0.05, flatShading: true, transparent: true, opacity: 0.96, depthWrite: false }))
          fgAsteroids = new THREE.InstancedMesh(rockGeo, fgMat, N_FG)
          makeBelt(fgAsteroids, fgBelt, N_FG, 7, 12, 1.4, 2.8)
          fgScene.add(fgAsteroids)
        } catch {
          fgR = null
          fgScene = null
        }
      }

      flags.built = true
      applyLayout()

      // render one frame now; start the loop unless reduced-motion
      renderFrame(0)
      if (!reduce) start()
    }

    function applyLayout() {
      if (!flags.built || !camera) return
      const { w, h } = dims()
      const aspect = w / h
      const portrait = aspect < 0.9
      layout.portrait = portrait
      const fov = portrait ? 64 : 46
      const dist = portrait ? 50 : 34
      camera.fov = fov
      camera.aspect = aspect
      camera.position.z = dist
      camera.updateProjectionMatrix()

      // shrink sun + tighten belt in portrait; lift the composition so the sun
      // sits in the upper third and the DOM headline owns the lower half
      const sunScale = portrait ? 0.72 : 1
      layout.radiusScale = portrait ? 0.72 : 1
      if (sunGroup) sunGroup.scale.setScalar(sunScale)
      // lift the whole composition so the sun sits in the upper third and the
      // DOM headline (centred) owns clear space below it
      const halfH = Math.tan((fov * Math.PI) / 360) * dist
      layout.groupY = (portrait ? 0.4 : 0.32) * halfH
      if (scene) scene.position.y = layout.groupY

      bgR.setSize(w, h, false)
      bgR.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP))
      if (fgR) {
        fgR.setSize(w, h, false)
        fgR.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP))
      }
    }

    function renderFrame(dt) {
      const t = clock.elapsedTime
      if (sunMat) sunMat.uniforms.uTime.value = t
      if (sunGroup) sunGroup.rotation.y += dt * 0.04
      if (scene?.userData.stars) scene.userData.stars.rotation.y += dt * 0.006
      if (asteroids) updateBelt(asteroids, belt, dt, layout.radiusScale)
      if (fgAsteroids) updateBelt(fgAsteroids, fgBelt, dt, layout.radiusScale)

      // parallax: pointer on desktop, gentle autonomous drift always
      const driftX = Math.sin(t * 0.13) * (layout.portrait ? 0.15 : 0.4)
      const driftY = Math.cos(t * 0.11) * (layout.portrait ? 0.1 : 0.28)
      cam.x += (pointer.x * 2.2 + driftX - cam.x) * Math.min(1, dt * 2.4)
      cam.y += (pointer.y * 1.4 + driftY - cam.y) * Math.min(1, dt * 2.4)
      if (camera) {
        camera.position.x = cam.x
        camera.position.y = cam.y
        // look at world origin — the scene is shifted up by groupY, so the sun
        // renders in the upper third while screen-centre stays clear for type
        camera.lookAt(0, 0, 0)
      }

      bgR.render(scene, camera)
      if (fgR && fgScene) {
        fgScene.position.y = layout.groupY
        fgR.render(fgScene, camera)
      }
    }

    function frame() {
      if (!flags.running) return
      const dt = Math.min(0.05, clock.getDelta())
      renderFrame(dt)
      rafId = requestAnimationFrame(frame)
    }

    function start() {
      if (flags.running || !flags.built) return
      if (!flags.onScreen || !flags.visible) return
      flags.running = true
      clock.getDelta() // reset delta so we don't jump after a pause
      rafId = requestAnimationFrame(frame)
    }
    function stop() {
      flags.running = false
      if (rafId) cancelAnimationFrame(rafId)
      rafId = 0
    }

    // ---- inputs ----
    // listen on window: the mount is pointer-events:none (so CTAs stay clickable)
    // and would never receive pointer events itself
    const onPointerMove = (e) => {
      const r = mount.getBoundingClientRect()
      if (!r.width || !r.height) return
      pointer.x = ((e.clientX - r.left) / r.width - 0.5) * 2
      pointer.y = -((e.clientY - r.top) / r.height - 0.5) * 2
    }
    if (!coarse) window.addEventListener('pointermove', onPointerMove)

    // ---- resize / orientation ----
    const onResize = () => {
      if (!flags.built) { build(); return }
      applyLayout()
      if (reduce) renderFrame(0) // reduced-motion: repaint the single static frame
    }
    ro = new ResizeObserver(onResize)
    ro.observe(mount)
    window.addEventListener('orientationchange', onResize)

    // ---- visibility / offscreen pause ----
    io = new IntersectionObserver((entries) => {
      flags.onScreen = entries.some((e) => e.isIntersecting)
      if (flags.onScreen && flags.visible && !reduce) start()
      else stop()
    }, { threshold: 0.01 })
    io.observe(mount)
    const onVisibility = () => {
      flags.visible = document.visibilityState !== 'hidden'
      if (flags.visible && flags.onScreen && !reduce) start()
      else stop()
    }
    document.addEventListener('visibilitychange', onVisibility)

    // ---- context loss / restore ----
    const onLost = (e) => { e.preventDefault(); stop() }
    const onRestored = () => {
      // tear down GL objects and rebuild cleanly on the restored context
      flags.built = false
      belt.length = 0
      fgBelt.length = 0
      asteroids?.dispose?.()
      fgAsteroids?.dispose?.()
      disposables.forEach((o) => o.dispose?.())
      disposables.length = 0
      bgR?.dispose?.(); bgR = null
      fgR?.dispose?.(); fgR = null
      asteroids = fgAsteroids = null
      build()
    }
    bgCanvas.addEventListener('webglcontextlost', onLost, false)
    bgCanvas.addEventListener('webglcontextrestored', onRestored, false)

    // kick off (build waits for a non-zero size internally)
    build()

    return () => {
      stop()
      ro?.disconnect()
      io?.disconnect()
      window.removeEventListener('orientationchange', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
      if (!coarse) window.removeEventListener('pointermove', onPointerMove)
      bgCanvas.removeEventListener('webglcontextlost', onLost)
      bgCanvas.removeEventListener('webglcontextrestored', onRestored)
      asteroids?.dispose?.()
      fgAsteroids?.dispose?.()
      disposables.forEach((o) => o.dispose?.())
      bgR?.dispose?.()
      fgR?.dispose?.()
      bgR?.forceContextLoss?.()
      fgR?.forceContextLoss?.()
    }
  }, [])

  return (
    <div className="wf-cosmic" ref={mountRef} aria-hidden="true">
      {/* static radial-gradient fallback (WebGL unavailable / not yet built) */}
      <div className="wf-cosmic-fallback" ref={fallbackRef} />
      <canvas className="wf-cosmic-bg" ref={bgRef} />
      {/* legibility scrim: darkens screen-centre behind the headline */}
      <div className="wf-cosmic-scrim" />
      <canvas className="wf-cosmic-fg" ref={fgRef} />
    </div>
  )
}
