import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/*
  CosmicHero — cinematic Three.js hero backdrop (matches the approved artifact):
  a large glowing lava sun in the upper-centre with a wide soft gold halo, and
  a field of SMALL gold-lit asteroids scattered around it on slow Keplerian
  orbits (inner faster, 1/r^1.5) with per-axis tumbling. The DOM headline sits
  BELOW the sun (hero content is bottom-anchored in CSS), so nothing ever
  overlaps the type.

  Robustness: WebGL try/catch + static CSS fallback, context-loss recovery,
  reduced motion (single static frame), ResizeObserver + orientationchange
  reshape, DPR caps (1.5 mobile / 2 desktop), reduced counts on coarse
  pointers, IntersectionObserver/visibility pause, ref-only frame loop (no
  React state), full disposal on unmount.
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
  uniform vec3 uDark;

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
    float t = uTime * 0.10;
    float n = fbm(p * 2.1 + vec3(t, t * 0.7, -t));
    float veins = fbm(p * 5.0 - vec3(t * 1.3));
    float heat = clamp(0.52 + 0.5 * n + 0.3 * veins, 0.0, 1.0);
    // dark sunspot patches carved into a lava-orange surface with hot rims
    vec3 col = mix(uDark, uCold, smoothstep(0.18, 0.5, heat));
    col = mix(col, uHot, pow(smoothstep(0.45, 1.0, heat), 1.4));
    col += pow(heat, 7.0) * 0.55;
    gl_FragColor = vec4(col, 1.0);
  }
`

const mql = (q) => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q) : { matches: false })
const hasWebGL = () => {
  try {
    const c = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')))
  } catch { return false }
}

// radial gradient sprite texture (halo/star) — CORS-free canvas texture
function radialTexture(stops) {
  const s = 256
  const c = document.createElement('canvas')
  c.width = c.height = s
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  stops.forEach(([at, col]) => g.addColorStop(at, col))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export default function CosmicHero() {
  const mountRef = useRef(null)
  const bgRef = useRef(null)
  const fallbackRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    const bgCanvas = bgRef.current
    if (!mount || !bgCanvas) return undefined

    const coarse = mql('(pointer: coarse)').matches
    const reduce = mql('(prefers-reduced-motion: reduce)').matches
    const DPR_CAP = coarse ? 1.5 : 2
    const N_ASTEROIDS = coarse ? 70 : 150
    const N_STARS = coarse ? 300 : 800
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

    let bgR = null
    let scene = null
    let camera = null
    let sunGroup = null
    let asteroids = null
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
        // mostly tiny specks, a few larger rocks (matches the reference look)
        const big = Math.random() > 0.85
        const size = big ? sizeMax * (0.7 + Math.random() * 0.3) : sizeMin + Math.random() * (sizeMax * 0.55 - sizeMin)
        list.push({
          r,
          a: Math.random() * Math.PI * 2,
          speed: 0.55 / Math.pow(r, 1.5),          // Keplerian: inner faster
          yAmp: (Math.random() - 0.5) * r * 0.55,  // wide vertical scatter, not a flat band
          yPhase: Math.random() * Math.PI * 2,
          size,
          tumble: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(1.2),
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
        tmpP.set(Math.cos(o.a) * r, o.yAmp * rScale * Math.sin(o.a * 0.7 + o.yPhase), Math.sin(o.a) * r)
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
      if (w < 2 || h < 2) return // wait for a real size (never setSize 0×0)

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

      // lighting: bright gold core (decay 0 → far rocks stay visible but are
      // still lit only sun-side) + faint ambient so the dark side isn't void
      const pl = new THREE.PointLight(0xffc46a, 3.2, 0, 0)
      world.add(pl)
      scene.add(new THREE.AmbientLight(0x2a2318, 0.55))

      // ---- sun (large, lava-orange, dark sunspot patches) ----
      sunGroup = new THREE.Group()
      const sunGeo = track(new THREE.SphereGeometry(6.1, SEG, SEG))
      sunMat = track(new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uHot: { value: new THREE.Color(0xffd08a) },
          uCold: { value: new THREE.Color(0xe0621e) },
          uDark: { value: new THREE.Color(0x2a1006) },
        },
        vertexShader: SUN_VERT,
        fragmentShader: SUN_FRAG,
      }))
      sunGroup.add(new THREE.Mesh(sunGeo, sunMat))

      // wide soft halo: a tight bright corona + a huge dim outer glow
      const coronaTex = track(radialTexture([[0, 'rgba(255,196,110,0.9)'], [0.35, 'rgba(230,120,40,0.42)'], [1, 'rgba(0,0,0,0)']]))
      const coronaMat = track(new THREE.SpriteMaterial({ map: coronaTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.95 }))
      const corona = new THREE.Sprite(coronaMat)
      corona.scale.setScalar(24)
      sunGroup.add(corona)
      const glowTex = track(radialTexture([[0, 'rgba(255,180,90,0.5)'], [0.45, 'rgba(200,120,50,0.16)'], [1, 'rgba(0,0,0,0)']]))
      const glowMat = track(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.8 }))
      const glow = new THREE.Sprite(glowMat)
      glow.scale.setScalar(52)
      sunGroup.add(glow)
      world.add(sunGroup)

      // ---- asteroid field: small gold-lit rocks scattered around the sun ----
      const rockGeo = track(new THREE.DodecahedronGeometry(0.3, 0))
      const rockMat = track(new THREE.MeshStandardMaterial({ color: 0x8a7a62, roughness: 0.95, metalness: 0.15, flatShading: true }))
      asteroids = new THREE.InstancedMesh(rockGeo, rockMat, N_ASTEROIDS)
      makeBelt(asteroids, belt, N_ASTEROIDS, 8.5, 20, 0.28, 1.5)
      world.add(asteroids)

      // ---- gold starfield ----
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
      const starTex = track(radialTexture([[0, 'rgba(255,240,200,1)'], [0.4, 'rgba(212,175,55,0.5)'], [1, 'rgba(0,0,0,0)']]))
      const starMat = track(new THREE.PointsMaterial({ size: 1.4, map: starTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xf0dca0, sizeAttenuation: true }))
      const stars = new THREE.Points(starGeo, starMat)
      scene.add(stars)
      scene.userData.stars = stars

      flags.built = true
      applyLayout()

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
      const dist = portrait ? 52 : 34
      camera.fov = fov
      camera.aspect = aspect
      camera.position.z = dist
      camera.updateProjectionMatrix()

      // sun in the upper-centre; the DOM headline is bottom-anchored in CSS so
      // the composition reads sun-above / type-below exactly like the artifact
      const sunScale = portrait ? 0.62 : 1
      layout.radiusScale = portrait ? 0.66 : 1
      if (sunGroup) sunGroup.scale.setScalar(sunScale)
      const halfH = Math.tan((fov * Math.PI) / 360) * dist
      layout.groupY = (portrait ? 0.42 : 0.24) * halfH
      if (scene) scene.position.y = layout.groupY

      bgR.setSize(w, h, false)
      bgR.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP))
    }

    function renderFrame(dt) {
      const t = clock.elapsedTime
      if (sunMat) sunMat.uniforms.uTime.value = t
      if (sunGroup) sunGroup.rotation.y += dt * 0.03
      if (scene?.userData.stars) scene.userData.stars.rotation.y += dt * 0.005
      if (asteroids) updateBelt(asteroids, belt, dt, layout.radiusScale)

      // parallax: pointer on desktop + gentle autonomous drift everywhere
      const driftX = Math.sin(t * 0.12) * (layout.portrait ? 0.12 : 0.35)
      const driftY = Math.cos(t * 0.1) * (layout.portrait ? 0.08 : 0.22)
      cam.x += (pointer.x * 1.6 + driftX - cam.x) * Math.min(1, dt * 2.4)
      cam.y += (pointer.y * 1.0 + driftY - cam.y) * Math.min(1, dt * 2.4)
      if (camera) {
        camera.position.x = cam.x
        camera.position.y = cam.y
        camera.lookAt(0, 0, 0)
      }

      bgR.render(scene, camera)
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
    // listen on window: the mount is pointer-events:none (CTAs stay clickable)
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
      if (reduce) renderFrame(0) // reduced-motion: repaint the static frame
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
      asteroids?.dispose?.()
      disposables.forEach((o) => o.dispose?.())
      disposables.length = 0
      bgR?.dispose?.(); bgR = null
      asteroids = null
      build()
    }
    bgCanvas.addEventListener('webglcontextlost', onLost, false)
    bgCanvas.addEventListener('webglcontextrestored', onRestored, false)

    // kick off (build waits internally for a non-zero size)
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
      disposables.forEach((o) => o.dispose?.())
      bgR?.dispose?.()
      bgR?.forceContextLoss?.()
    }
  }, [])

  return (
    <div className="wf-cosmic" ref={mountRef} aria-hidden="true">
      {/* static radial-gradient fallback (WebGL unavailable) */}
      <div className="wf-cosmic-fallback" ref={fallbackRef} />
      <canvas className="wf-cosmic-bg" ref={bgRef} />
      {/* soft bottom fade so the headline stays legible over the glow */}
      <div className="wf-cosmic-scrim" />
    </div>
  )
}
