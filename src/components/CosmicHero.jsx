import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/*
  CosmicHero — cinematic Three.js hero backdrop.

  Composition: a large golden-amber sun (procedural fbm noise + golden fresnel
  rim + double halo) centred at ~35% viewport height on desktop (~28% on
  portrait), with an elliptical debris belt (1.6–3.2× sun radius, tilted ~20°,
  density falling outward) of small gold-lit rocks on Keplerian orbits. The DOM
  headline sits below, inside the corona's fading glow but never overlapped by
  the solid disc.

  Robustness: WebGL try/catch + static CSS fallback, context-loss recovery,
  reduced-motion static frame, ResizeObserver + orientationchange refit, DPR
  caps (1.5 mobile / 2 desktop), reduced counts on coarse pointers,
  IntersectionObserver/visibility pause, frame-delta motion, ref-only loop
  (no React state), full disposal on unmount.
*/

const SUN_RADIUS = 6.1 // world units — belt + layout derive from this

// ------- procedural sun: Ashima 3D simplex noise + fbm ---------------------
const SUN_VERT = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vPos = position;
    vNormal = normalize(normalMatrix * normal);
    vec4 wp = modelViewMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * wp;
  }
`
const SUN_FRAG = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  uniform float uTime;

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
    float t = uTime * 0.12; // slow continuous churn
    float n = fbm(p * 2.1 + vec3(t, t * 0.7, -t));
    float veins = fbm(p * 5.0 - vec3(t * 1.3));
    // raised threshold → hot golden areas cover most of the surface
    float heat = clamp(0.62 + 0.45 * n + 0.25 * veins, 0.0, 1.0);

    // golden-amber palette (site gold #d4af37 family — never tomato red):
    // deep ember → warm orange → pale gold highlights
    vec3 ember  = vec3(0.20, 0.07, 0.02);
    vec3 orange = vec3(0.80, 0.38, 0.07);
    vec3 gold   = vec3(1.00, 0.86, 0.52);
    vec3 col = mix(ember, orange, smoothstep(0.10, 0.48, heat));
    col = mix(col, gold, pow(smoothstep(0.40, 0.95, heat), 1.25));
    col += pow(heat, 7.0) * vec3(0.35, 0.30, 0.18);

    // golden fresnel rim so the limb glows into the halo
    vec3 V = normalize(-vWorldPos);
    float fres = pow(1.0 - max(dot(normalize(vNormal), V), 0.0), 3.0);
    col += fres * vec3(1.0, 0.72, 0.38) * 0.85;

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
    const N_ASTEROIDS = coarse ? 60 : 130
    const N_STARS = coarse ? 300 : 800
    const SEG = coarse ? 48 : 96

    const showFallback = () => { if (fallbackRef.current) fallbackRef.current.style.opacity = '1' }
    if (!hasWebGL()) { showFallback(); return undefined }

    // ---- mutable world (no React state in the loop) ----
    const disposables = []
    const track = (o) => { if (o) disposables.push(o); return o }
    const clock = new THREE.Clock()
    const layout = { portrait: false, radiusScale: 1, groupY: 0, sunScale: 1 }
    const pointer = { x: 0, y: 0 }
    const cam = { x: 0, y: 0 }
    const flags = { onScreen: true, visible: true, built: false, running: false }
    const belt = [] // per-instance orbital params

    let bgR = null
    let scene = null
    let camera = null
    let sunGroup = null
    let beltGroup = null
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

    // elliptical debris disc: 1.6–3.2× sun radius, density falling outward
    function makeBelt(mesh, list, count) {
      const rMin = SUN_RADIUS * 1.6
      const rMax = SUN_RADIUS * 3.2
      for (let i = 0; i < count; i++) {
        const r = rMin + (rMax - rMin) * Math.pow(Math.random(), 1.6) // denser inward
        const big = Math.random() > 0.86
        const size = big ? 1.0 + Math.random() * 0.5 : 0.25 + Math.random() * 0.5
        list.push({
          r,
          a: Math.random() * Math.PI * 2,
          speed: 9 / Math.pow(r, 1.5),            // Keplerian: inner visibly faster
          yOff: (Math.random() - 0.5) * r * 0.16, // thin disc, not a sphere
          size,
          tumble: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(1.3),
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
        tmpP.set(Math.cos(o.a) * r, o.yOff * rScale, Math.sin(o.a) * r)
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

      // Warm PointLight at the sun's core, SAME scene as the rocks.
      // three r155+ physical lighting: with decay 1.6 the belt sits 10–20 units
      // out, so intensity is scaled (≈ i/r^1.6) to land ~1.0 at the belt — the
      // "2.5 at 1 unit" classic-units intent. Rocks get a lit golden rim and
      // dim naturally with distance.
      const pl = new THREE.PointLight(0xffa550, 60, 0, 1.6)
      world.add(pl)
      // faint warm ambient: shadow sides read dark brown, never pure black
      scene.add(new THREE.AmbientLight(0x1a120a, 0.7))

      // ---- sun (golden-amber, fresnel rim) ----
      sunGroup = new THREE.Group()
      const sunGeo = track(new THREE.SphereGeometry(SUN_RADIUS, SEG, SEG))
      sunMat = track(new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: SUN_VERT,
        fragmentShader: SUN_FRAG,
      }))
      sunGroup.add(new THREE.Mesh(sunGeo, sunMat))

      // halo: tight bright corona + huge dim outer glow (golden, not red)
      const coronaTex = track(radialTexture([[0, 'rgba(255,200,120,0.9)'], [0.35, 'rgba(224,150,60,0.4)'], [1, 'rgba(0,0,0,0)']]))
      const coronaMat = track(new THREE.SpriteMaterial({ map: coronaTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.95 }))
      const corona = new THREE.Sprite(coronaMat)
      corona.scale.setScalar(SUN_RADIUS * 3.9)
      sunGroup.add(corona)
      const glowTex = track(radialTexture([[0, 'rgba(255,190,110,0.45)'], [0.45, 'rgba(212,150,60,0.14)'], [1, 'rgba(0,0,0,0)']]))
      const glowMat = track(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.8 }))
      const glow = new THREE.Sprite(glowMat)
      glow.scale.setScalar(SUN_RADIUS * 8.5)
      sunGroup.add(glow)
      world.add(sunGroup)

      // ---- debris belt: elliptical disc tilted ~20°, gold-lit rocks ----
      beltGroup = new THREE.Group()
      beltGroup.rotation.x = THREE.MathUtils.degToRad(20)
      const rockGeo = track(new THREE.DodecahedronGeometry(0.3, 0))
      const rockMat = track(new THREE.MeshStandardMaterial({ color: 0x8a7a66, roughness: 0.95, metalness: 0.1, flatShading: true }))
      asteroids = new THREE.InstancedMesh(rockGeo, rockMat, N_ASTEROIDS)
      makeBelt(asteroids, belt, N_ASTEROIDS)
      beltGroup.add(asteroids)
      world.add(beltGroup)

      // ---- gold starfield (the far tiny specks live here, not in the belt) ----
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

      const halfH = Math.tan((fov * Math.PI) / 360) * dist
      const halfW = halfH * aspect

      if (portrait) {
        // sun ≈ 45% of viewport width, centre at ~28% height; belt pulled tight
        layout.sunScale = (0.45 * halfW) / SUN_RADIUS
        layout.radiusScale = layout.sunScale * 0.92
        layout.groupY = 0.44 * halfH // 0.5 - 0.28 = 0.22 → ×2 = 0.44
      } else {
        // sun centre at ~35% height; solid disc ends ~55%, headline starts
        // ~62% → min 60px breathing room between disc edge and cap-height
        layout.sunScale = 0.95
        layout.radiusScale = 1
        layout.groupY = 0.3 * halfH // 0.5 - 0.35 = 0.15 → ×2 = 0.30
      }
      if (sunGroup) sunGroup.scale.setScalar(layout.sunScale)
      if (scene) scene.position.y = layout.groupY

      bgR.setSize(w, h, false)
      bgR.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP))
    }

    function renderFrame(dt) {
      const t = clock.elapsedTime
      if (sunMat) sunMat.uniforms.uTime.value = t
      if (sunGroup) {
        sunGroup.rotation.y += dt * 0.03
        // subtle breathing: ±1.2% scale
        sunGroup.scale.setScalar(layout.sunScale * (1 + 0.012 * Math.sin(t * 0.8)))
      }
      if (scene?.userData.stars) scene.userData.stars.rotation.y += dt * 0.005
      if (asteroids) updateBelt(asteroids, belt, dt, layout.radiusScale)

      // camera: slow autonomous drift everywhere + mouse parallax (desktop only)
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
      const dt = Math.min(0.05, clock.getDelta()) // delta-based: stable on 120Hz + low-end
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
      beltGroup = null
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
