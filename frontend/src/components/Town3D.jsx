import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { BUILDINGS, COLS, ROWS, T, TS } from '../game/layout.js'
import { buildTown3D, X, Z, toPx } from '../town3d/scene.js'
import { batchAnimated } from '../town3d/batching.js'
import { townMapDistance } from '../town3d/camera.js'
import { createFrameProfiler } from '../town3d/frameProfiler.js'
import { createQuality } from '../town3d/quality.js'
import { makeChibi } from '../town3d/chibi.js'
import { glowMats } from '../town3d/buildings.js'
import { SHOW, buildBirthday, isBirthday } from '../town3d/birthday.js'
import BirthdayShow from './BirthdayShow.jsx'
import { createBirthdayMusic } from '../town3d/birthdayMusic.js'
import TownPreparing from './TownPreparing.jsx'
import PlaceModal from './PlaceModal.jsx'
import Arcade from './Arcade.jsx'

const Museum = lazy(() => import('./Museum.jsx'))

const SPEED = 62 // layout px per second (16 px = 1 m)
const RUN = 108
const NEAR = 56
const CYCLE = 300
const GAMES_KEY = 'love-town-games'
const loadGames = () => { try { return JSON.parse(localStorage.getItem(GAMES_KEY)) || [] } catch { return [] } }
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const lerp = (a, b, t) => a + (b - a) * t
const angleTo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a))
const KEYMAP = { w: 'f', arrowup: 'f', s: 'b', arrowdown: 'b', a: 'l', arrowleft: 'l', d: 'r', arrowright: 'r' }
const C = (hex) => new THREE.Color(hex)
const SKY = {
  hemiSky: [C('#e3f2ff'), C('#ffd2b0'), C('#3a4a8a')],
  hemiGround: [C('#9bbf86'), C('#b0907a'), C('#1d2a2a')],
  fog: [C('#cfe6f2'), C('#f4c2a6'), C('#141a36')],
}
const mix3 = (arr, dusk, night, out) => out.copy(arr[0]).lerp(arr[1], dusk * (1 - night)).lerp(arr[2], night)

function baseMinimap(layout) {
  const c = document.createElement('canvas')
  c.width = COLS * 4; c.height = ROWS * 4
  const g = c.getContext('2d')
  const col = { [T.GRASS]: '#a9d58f', [T.PATH]: '#ecd8ba', [T.PLAZA]: '#efd2c8', [T.WATER]: '#7ec0dc', [T.BRIDGE]: '#c9a074' }
  for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) { g.fillStyle = col[layout.grid[r][q]]; g.fillRect(q * 4, r * 4, 4, 4) }
  for (const t of layout.trees) { g.fillStyle = t.pink ? '#f0a6bd' : '#5f9e62'; g.beginPath(); g.arc(t.c * 4 + 2, t.r * 4 + 2, 2.2, 0, 7); g.fill() }
  const roof = { home: '#d9715f', college: '#a34a3c', pg: '#7d87b0', cafe: '#e0954f', museum: '#8e9bb0', stage: '#b088d0', cinema: '#6d5a9c', arcade: '#5fb3a0', post: '#df5a58' }
  for (const b of BUILDINGS) { g.fillStyle = roof[b.kind]; g.fillRect(b.col * 4 + 1, b.row * 4 + 2, b.w * 4 - 2, b.h * 4 - 4); g.strokeStyle = '#4a3340'; g.lineWidth = 1; g.strokeRect(b.col * 4 + 1, b.row * 4 + 2, b.w * 4 - 2, b.h * 4 - 4) }
  return c
}

export default function Town3D({ look, name, story, world: layout, onEditAvatar }) {
  const host = useRef(null)
  const miniRef = useRef(null)
  const [near, setNear] = useState(null)
  const [open, setOpen] = useState(null)
  const [count, setCount] = useState(0)
  const [toast, setToast] = useState('')
  const [ready, setReady] = useState(false)
  const [night, setNight] = useState(false)
  const [mapMode, setMapMode] = useState(false)
  const [hasPartner, setHasPartner] = useState(false)
  const [games, setGames] = useState(loadGames)
  const [coarse] = useState(() => window.matchMedia?.('(pointer: coarse)').matches ?? false)
  const [bday] = useState(() => isBirthday(story))
  const [show, setShow] = useState(0) // >0 while the birthday show is playing (its id)
  const g = useRef({})
  const total = layout.hearts.length
  const need = story.heartsNeeded ?? 6
  const partner = story.partner
  const placeById = Object.fromEntries(story.places.map((p) => [p.id, p]))

  const flash = useCallback((msg, ms = 3400) => {
    setToast(msg)
    clearTimeout(g.current.toastT)
    g.current.toastT = setTimeout(() => setToast(''), ms)
  }, [])

  const interact = useCallback(() => {
    const s = g.current
    if (!s.near || s.open) return
    if (s.near === 'cake') { s.startShow?.(); return }
    if (s.near === 'post' && s.got.size < need) { flash(`Collect ${need} hearts to open the letter box (${s.got.size}/${need})`); return }
    s.open = s.near
    s.keys.clear(); s.path = null
    setOpen(s.near)
  }, [flash, need])
  const interactRef = useRef(interact)
  interactRef.current = interact

  const close = useCallback(() => {
    const s = g.current
    const was = s.open
    s.open = null
    setOpen(null)
    if (!s.partner && partner && was && s.spawnPartner) {
      const pl = layout.places.find((p) => p.id === was)
      s.spawnPartner(pl.x + 22, pl.y + 18)
      setHasPartner(true)
      flash(`Look who's here! ${partner.name} will follow you everywhere now ♥`, 4200)
    }
  }, [flash, partner, layout])

  const winGame = useCallback((id) => {
    setGames((gs) => {
      const next = gs.includes(id) ? gs : [...gs, id]
      try { localStorage.setItem(GAMES_KEY, JSON.stringify(next)) } catch { /* fine */ }
      return next
    })
  }, [])

  const endShow = useCallback(() => {
    const s = g.current
    s.open = null; s.show = null
    s.party?.reset()
    s.music?.stop(); s.music = null
    setShow(0)
  }, [])
  const goParty = useCallback(() => {
    const s = g.current
    if (!s.party || s.open) return
    const a = s.party.approach
    const path = layout.findPath(s.p.x, s.p.y, a.x, a.y)
    s.path = path?.length ? path : null
    s.stuck = 0; s.map = false; setMapMode(false)
    s.setRoute?.(s.path)
  }, [layout])

  const toggleMap = useCallback(() => { const s = g.current; s.map = !s.map; setMapMode(s.map) }, [])
  const zoomBy = (f) => { const s = g.current; s.map = false; setMapMode(false); s.cam.tDist = clamp(s.cam.tDist * f, 4.5, 60) }
  const toggleNight = () => { const s = g.current; s.clock = s.night > 0.5 ? 0.38 : 0.92 }

  useEffect(() => {
    const el = host.current
    let presented = false, preparationStart = performance.now()
    const s = g.current
    const mobile = window.matchMedia?.('(pointer: coarse)').matches ?? false
    const sceneParams = new URLSearchParams(window.location.search)
    const initialClock = sceneParams.has('fps') ? ({ day: .36, sunset: .74, night: .92 }[sceneParams.get('time')] ?? .36) : .36
    const checkpoint = sceneParams.has('fps') ? layout.places.find(p => p.id === sceneParams.get('at')) : null
    const spawn = checkpoint ? { x: checkpoint.x, y: checkpoint.y + 18 } : layout.spawn
    Object.assign(s, {
      keys: new Set(), pad: { f: false, b: false, l: false, r: false }, got: new Set(), open: null, near: null, path: null, target: null,
      partner: null, trail: Array.from({ length: 400 }, () => ({ x: 0, y: 0 })), trailHead: 0, trailCount: 0, loveT: 0, clock: initialClock, night: 0, map: false, ptrs: new Map(), stuck: 0,
      p: { x: spawn.x, y: spawn.y, face: Math.PI, moving: 0, yy: 0 },
      cam: { yaw: 0, pitch: 0.5, dist: 13, tYaw: 0, tPitch: 0.5, tDist: 13, target: new THREE.Vector3() },
    })

    // ---- renderer + world ----
    const renderer = new THREE.WebGLRenderer({ antialias: !mobile, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.3 : 1.6))
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.62
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    el.appendChild(renderer.domElement)
    const names = Object.fromEntries(story.places.map((p) => [p.id, p.name.replace('Sri Ramakrishna College of Arts and Science', 'Sri Ramakrishna College')]))
    const W3 = buildTown3D(layout, { mobile, names })
    const scene = W3.scene
    // soft studio-style reflections and bounce light so materials look more real
    const pmrem = new THREE.PMREMGenerator(renderer)
    const room = new RoomEnvironment()
    const envTarget = pmrem.fromScene(room, 0.04)
    const envTex = envTarget.texture
    room.dispose()
    pmrem.dispose()
    scene.environment = envTex
    const party = bday ? buildBirthday(scene, layout, { mobile, name: story.name }) : null
    s.party = party
    if (party && sceneParams.has('fps') && sceneParams.get('at') === 'party') { s.p.x = party.approach.x; s.p.y = party.approach.y }
    if (party) W3.pool[3].visible = false // the candle is the fourth dynamic point light
    const free = (x, y) => layout.free(x, y) && !(party && party.blocks(x, y))
    const camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 0.3, 2000)
    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    const bloom = new UnrealBloomPass(new THREE.Vector2(el.clientWidth / (mobile ? 2 : 1), el.clientHeight / (mobile ? 2 : 1)), 0.38, 0.5, 0.88)
    composer.addPass(bloom)
    const output = new OutputPass()
    composer.addPass(output)
    let pendingTier = null, pendingResolution = 1
    const configureQuality = (tier, resolution) => {
      const dpr = Math.min(window.devicePixelRatio || 1, (mobile ? tier.mobileDpr : tier.dpr) * resolution)
      renderer.setPixelRatio(dpr)
      composer.setPixelRatio(dpr)
      composer.setSize(el.clientWidth, el.clientHeight)
      bloom.enabled = tier.bloom
      bloom.setSize(Math.ceil(el.clientWidth * dpr / 2), Math.ceil(el.clientHeight * dpr / 2))
      const size = mobile ? Math.min(1024, tier.shadow) : tier.shadow
      if (W3.sun.shadow.mapSize.x !== size) {
        W3.sun.shadow.mapSize.set(size, size)
        W3.sun.shadow.map?.dispose(); W3.sun.shadow.map = null
      }
    }
    const quality = createQuality(mobile, (tier, resolution) => { pendingTier = tier; pendingResolution = resolution })
    const profiler = createFrameProfiler(renderer)
    const fpsEnabled = sceneParams.has('fps')
    const fpsEl = fpsEnabled ? document.createElement('pre') : null
    if (fpsEl) {
      fpsEl.dataset.testid = 'town-fps'
      fpsEl.style.cssText = 'position:absolute;bottom:80px;left:8px;z-index:30;margin:0;padding:8px;background:#15261ee8;color:#e0ffd3;font:11px monospace;pointer-events:none;border-radius:6px'
      el.appendChild(fpsEl)
    }
    // Two reusable contact shadows follow the avatars, including bridge height.
    const blobCanvas = document.createElement('canvas'); blobCanvas.width = blobCanvas.height = 64
    const blobCtx = blobCanvas.getContext('2d'), blobGradient = blobCtx.createRadialGradient(32,32,2,32,32,32)
    blobGradient.addColorStop(0, 'rgba(30,24,36,.3)'); blobGradient.addColorStop(1, 'rgba(30,24,36,0)')
    blobCtx.fillStyle = blobGradient; blobCtx.fillRect(0,0,64,64)
    const blobMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blobCanvas), transparent: true, depthWrite: false })
    const blobGeo = new THREE.PlaneGeometry(1.3, 1.3)
    const herBlob = new THREE.Mesh(blobGeo, blobMat), hisBlob = new THREE.Mesh(blobGeo, blobMat)
    herBlob.rotation.x = hisBlob.rotation.x = -Math.PI / 2; hisBlob.visible = false
    scene.add(herBlob, hisBlob)

    // ---- the two of us ----
    const her = makeChibi(look)
    const him = partner ? makeChibi(partner.look) : null
    if (him) him.group.visible = false
    const players = batchAnimated(scene, him ? [her.group, him.group] : [her.group], { coalesce: true })
    const proxyGeo = new THREE.CapsuleGeometry(.24, .6, 2, 5)
    const herMap = new THREE.Mesh(proxyGeo, new THREE.MeshBasicMaterial({ color: look.top }))
    const hisMap = new THREE.Mesh(proxyGeo, new THREE.MeshBasicMaterial({ color: partner?.look?.top ?? '#5a6690' }))
    herMap.visible = hisMap.visible = false; scene.add(herMap, hisMap)
    let avatarShadowTier = ''
    s.spawnPartner = (px, py) => {
      if (!him) return
      him.group.visible = true
      s.partner = { x: px, y: py, face: Math.PI, moving: 0 }
      s.trail[0].x = px; s.trail[0].y = py
      s.trail[1].x = s.p.x; s.trail[1].y = s.p.y
      s.trailHead = 1; s.trailCount = 2
    }

    // walking route drawn on the ground + a target ring
    const routeMat = new THREE.LineDashedMaterial({ color: '#ff6f8f', dashSize: 0.5, gapSize: 0.45, transparent: true, opacity: 0.9 })
    const route = new THREE.Line(new THREE.BufferGeometry(), routeMat)
    route.frustumCulled = false
    scene.add(route)
    const targetRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 8, 32), new THREE.MeshBasicMaterial({ color: '#ff6f8f' }))
    targetRing.rotation.x = -Math.PI / 2; targetRing.visible = false
    scene.add(targetRing)
    const setRoute = (path) => {
      if (!path?.length) { route.visible = false; targetRing.visible = false; return }
      const pts = [new THREE.Vector3(X(s.p.x), 0.1, Z(s.p.y)), ...path.map((p) => new THREE.Vector3(X(p.x), 0.1, Z(p.y)))]
      route.geometry.dispose()
      route.geometry = new THREE.BufferGeometry().setFromPoints(pts)
      route.computeLineDistances()
      route.visible = true
      const last = pts[pts.length - 1]
      targetRing.position.set(last.x, 0.08, last.z); targetRing.visible = true
    }
    s.setRoute = setRoute
    s.startShow = () => {
      if (!party || s.open) return
      s.open = 'party'; s.keys.clear(); s.path = null; setRoute(null)
      const c = party.cakePx
      s.p.face = Math.atan2(c.x - s.p.x, c.y - s.p.y)
      s.show = { t0: performance.now() / 1000, yaw: s.cam.yaw }
      party.start(s.show.t0)
      // the song (started inside the tap / key press, so browsers allow sound)
      s.music?.stop()
      try { s.music = createBirthdayMusic(); s.music.play(); s.music.blow(SHOW.blow) } catch { s.music = null }
      setShow(Date.now())
    }

    // ---- input ----
    const onDown = (e) => {
      if (!presented) return
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const k = e.key.toLowerCase()
      if (KEYMAP[k]) { e.preventDefault(); if (!s.open) { s.keys.add(KEYMAP[k]); s.path = null; setRoute(null) } }
      else if (k === 'shift') s.run = true
      else if ((k === 'e' || k === 'enter' || k === ' ') && !s.open) { if (k === ' ') e.preventDefault(); if (!e.repeat) interactRef.current() }
      else if (k === 'm' && !s.open) { s.map = !s.map; setMapMode(s.map) }
      else if (k === 'q') s.cam.tYaw += 0.5
      else if (k === 'r') s.cam.tYaw -= 0.5
    }
    const onUp = (e) => { const k = e.key.toLowerCase(); if (KEYMAP[k]) s.keys.delete(KEYMAP[k]); else if (k === 'shift') s.run = false }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)

    const cv = renderer.domElement
    const ray = new THREE.Raycaster()
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const hit = new THREE.Vector3()
    let drag = null
    const pDown = (e) => {
      s.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY })
      cv.setPointerCapture(e.pointerId)
      if (s.ptrs.size === 2) { const [a, b] = [...s.ptrs.values()]; s.pinch = Math.hypot(a.x - b.x, a.y - b.y); drag = null; return }
      drag = { x: e.clientX, y: e.clientY, moved: 0 }
    }
    const pMove = (e) => {
      if (!s.ptrs.has(e.pointerId)) return
      s.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (s.ptrs.size === 2 && s.pinch) {
        const [a, b] = [...s.ptrs.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        s.cam.tDist = clamp(s.cam.tDist * (s.pinch / d), 4.5, 60); s.pinch = d
        return
      }
      if (!drag) return
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y
      drag.moved += Math.abs(dx) + Math.abs(dy)
      drag.x = e.clientX; drag.y = e.clientY
      if (drag.moved > 8) { s.cam.tYaw -= dx * 0.0055; s.cam.tPitch = clamp(s.cam.tPitch + dy * 0.004, 0.12, 1.35) }
    }
    const pUp = (e) => {
      s.ptrs.delete(e.pointerId)
      if (s.ptrs.size < 2) s.pinch = 0
      if (drag && drag.moved < 8 && !s.open) {
        const r = cv.getBoundingClientRect()
        ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera)
        if (ray.ray.intersectPlane(groundPlane, hit)) {
          const t = toPx(hit.x, hit.z)
          const path = layout.findPath(s.p.x, s.p.y, t.x, t.y)
          s.path = path?.length ? path : null
          s.stuck = 0
          setRoute(s.path)
          if (s.map) { s.map = false; setMapMode(false) }
        }
      }
      drag = null
    }
    const onWheel = (e) => { e.preventDefault(); if (s.map && e.deltaY < 0) { s.map = false; setMapMode(false) } s.cam.tDist = clamp(s.cam.tDist * Math.exp(e.deltaY * 0.0012), 4.5, 60); if (s.cam.tDist >= 59 && e.deltaY > 0) { s.map = true; setMapMode(true) } }
    cv.addEventListener('pointerdown', pDown)
    cv.addEventListener('pointermove', pMove)
    cv.addEventListener('pointerup', pUp)
    cv.addEventListener('pointercancel', pUp)
    cv.addEventListener('wheel', onWheel, { passive: false })
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight
      renderer.setSize(w, h); composer.setSize(w, h); bloom.setSize(Math.ceil(w * renderer.getPixelRatio() / 2), Math.ceil(h * renderer.getPixelRatio() / 2)); camera.aspect = w / h; camera.updateProjectionMatrix()
    })
    ro.observe(el)

    // ---- mini-map ----
    const miniBase = baseMinimap(layout)

    // ---- simulation ----
    const tileAt = (px, py) => layout.grid[clamp(Math.floor(py / TS), 0, ROWS - 1)][clamp(Math.floor(px / TS), 0, COLS - 1)]
    const sunDir = new THREE.Vector3()
    const moonDir = new THREE.Vector3()
    let lastPool = 0
    const here = new THREE.Vector3(), cameraTarget = new THREE.Vector3(), showTarget = new THREE.Vector3()
    const warmSun = C('#ffb27a'), nearest = W3.lightSpots.slice()
    const sortLights = (A, B) => A.distanceToSquared(here) - B.distanceToSquared(here)
    const update = (dt, t) => {
      const p = s.p
      quality.setMode(s.map ? 'map' : 'walk')
      if (avatarShadowTier !== quality.tier.name) {
        players.setShadows(quality.tier.name !== 'low')
        avatarShadowTier = quality.tier.name
      }
      s.clock = (s.clock + dt / CYCLE) % 1
      const a = (s.clock - 0.25) * Math.PI * 2
      sunDir.set(Math.cos(a), Math.sin(a), -0.45).normalize()
      const elev = sunDir.y
      s.night = clamp((0.1 - elev) / 0.28, 0, 1)
      s.dusk = clamp(1 - Math.abs(elev - 0.1) / 0.18, 0, 1)
      if ((s.night > 0.5) !== s.wasNight) { s.wasNight = s.night > 0.5; setNight(s.wasNight) }

      // movement (in layout pixels, relative to the camera)
      let vx = 0, vy = 0
      if (!s.open) {
        const k = s.keys, pd = s.pad
        const inF = (k.has('f') || pd.f ? 1 : 0) - (k.has('b') || pd.b ? 1 : 0)
        const inR = (k.has('r') || pd.r ? 1 : 0) - (k.has('l') || pd.l ? 1 : 0)
        if (inF || inR) {
          const yaw = s.cam.yaw
          vx = -Math.sin(yaw) * inF + Math.cos(yaw) * inR
          vy = -Math.cos(yaw) * inF - Math.sin(yaw) * inR
        } else if (s.path?.length) {
          const wp = s.path[0]
          const dx = wp.x - p.x, dy = wp.y - p.y, d = Math.hypot(dx, dy)
          if (s.stuck > 0.6) { s.path = null; setRoute(null) }
          else if (d < 5) { s.path.shift(); if (!s.path.length) { s.path = null; setRoute(null) } }
          else { vx = dx / d; vy = dy / d }
        }
      }
      const sp = s.run ? RUN : SPEED
      const len = Math.hypot(vx, vy)
      if (len > 0) {
        const mx = (vx / len) * sp * dt, my = (vy / len) * sp * dt
        const bx = p.x, by = p.y
        if (free(p.x + mx, p.y)) p.x += mx
        if (free(p.x, p.y + my)) p.y += my
        s.stuck = s.path && Math.hypot(p.x - bx, p.y - by) < 0.2 * sp * dt ? s.stuck + dt : 0
        p.face += angleTo(p.face, Math.atan2(vx, vy)) * Math.min(1, dt * 12)
      }
      p.moving = lerp(p.moving, len > 0 ? sp / SPEED : 0, Math.min(1, dt * 10))
      p.yy = lerp(p.yy, tileAt(p.x, p.y) === T.BRIDGE ? 0.14 : 0, Math.min(1, dt * 10))
      her.group.position.set(X(p.x), p.yy, Z(p.y))
      her.group.rotation.y = p.face
      her.animate(dt, p.moving, t)
      if (p.moving > 0.8 && len > 0) W3.puff(her.group.position.x, her.group.position.z, t)

      // he follows her footsteps
      const q = s.partner
      if (q && him) {
        const last = s.trail[s.trailHead]
        if (!s.trailCount || Math.hypot(p.x - last.x, p.y - last.y) > 3) {
          s.trailHead = (s.trailHead + 1) % 400
          const next = s.trail[s.trailHead]; next.x = p.x; next.y = p.y
          s.trailCount = Math.min(400, s.trailCount + 1)
        }
        let rest = 30, tx = p.x, ty = p.y
        for (let i = 0; i < s.trailCount - 1; i++) {
          const A = s.trail[(s.trailHead - i + 400) % 400], B = s.trail[(s.trailHead - i - 1 + 400) % 400], d = Math.hypot(A.x - B.x, A.y - B.y)
          if (rest <= d) { const k = rest / d; tx = A.x + (B.x - A.x) * k; ty = A.y + (B.y - A.y) * k; rest = 0; break }
          rest -= d; tx = B.x; ty = B.y
        }
        const dx = tx - q.x, dy = ty - q.y, d = Math.hypot(dx, dy)
        let qs = 0
        if (d > 420) { q.x = tx; q.y = ty }
        else if (d > 2) { const st = Math.min(d, Math.max(sp * 1.15, d * 4) * dt); q.x += (dx / d) * st; q.y += (dy / d) * st; qs = st / dt / SPEED; q.face += angleTo(q.face, Math.atan2(dx, dy)) * Math.min(1, dt * 10) }
        else if (!len) q.face += angleTo(q.face, Math.atan2(p.x - q.x, p.y - q.y)) * Math.min(1, dt * 4)
        q.moving = lerp(q.moving, qs, Math.min(1, dt * 10))
        him.group.position.set(X(q.x), tileAt(q.x, q.y) === T.BRIDGE ? 0.14 : 0, Z(q.y))
        him.group.rotation.y = q.face
        him.animate(dt, q.moving, t + 1)
        if (!len && q.moving < 0.1 && d < 60) {
          s.loveT += dt
          if (s.loveT > 1.5) p.face += angleTo(p.face, Math.atan2(q.x - p.x, q.y - p.y)) * Math.min(1, dt * 3)
        } else s.loveT = 0
      }

      // places + hearts
      let best = null, bd = NEAR
      for (const pl of layout.places) { const d = Math.hypot(p.x - pl.x, p.y - pl.y); if (d < bd) { bd = d; best = pl.id } }
      if (party && Math.hypot(p.x - party.cakePx.x, p.y - party.cakePx.y) < 72) best = 'cake'
      if (best !== s.near) { s.near = best; setNear(best) }
      for (const h of W3.hearts) {
        if (h.gone || s.got.has(h.id)) continue
        const hp = layout.hearts[h.id]
        if (Math.hypot(p.x - hp.x, p.y - hp.y) < 26) {
          s.got.add(h.id); h.gone = 0.001
          setCount(s.got.size)
          if (s.got.size === total) flash('You found every heart! ♥')
          else if (s.got.size === need) flash('The Love Letters box is open now ♥')
          else flash(`+1 ♥  (${s.got.size}/${total})`, 1400)
        }
      }

      // sky + lights
      const day = 1 - s.night
      W3.sky.material.uniforms.sunPosition.value.copy(sunDir)
      const lightDir = elev > -0.05 ? sunDir : moonDir.set(-sunDir.x, -sunDir.y, sunDir.z).normalize()
      const center = her.group.position
      W3.sun.position.copy(center).addScaledVector(lightDir, 90)
      W3.sun.target.position.copy(center)
      W3.sun.color.set(elev > -0.05 ? '#fff1dc' : '#a9b8ff').lerp(warmSun, s.dusk * day)
      W3.sun.intensity = elev > -0.05 ? 2.3 * clamp(elev * 4, 0.15, 1) : 0.45
      mix3(SKY.hemiSky, s.dusk, s.night, W3.hemi.color)
      mix3(SKY.hemiGround, s.dusk, s.night, W3.hemi.groundColor)
      W3.hemi.intensity = lerp(0.88, 0.33, s.night)
      scene.environmentIntensity = lerp(0.16, 0.04, s.night)
      mix3(SKY.fog, s.dusk, s.night, scene.fog.color)
      scene.fog.near = s.map ? 400 : 70; scene.fog.far = s.map ? 900 : 260
      W3.stars.material.opacity = s.night
      renderer.toneMappingExposure = lerp(0.74, 0.8, s.night)
      glowMats.window.emissiveIntensity = s.night * 1.1 + s.dusk * 0.2
      glowMats.bulb.emissiveIntensity = 0.4 + s.night * 2.2
      if (t - lastPool > 0.3) {
        lastPool = t
        here.set(X(p.x), 0, Z(p.y))
        nearest.sort(sortLights)
        for (let i = 0; i < W3.pool.length; i++) if (nearest[i]) W3.pool[i].position.copy(nearest[i])
      }
      for (const light of W3.pool) light.intensity = s.night * 9

      for (const L of W3.labels) {
        const pos = L.sprite.position
        const d = Math.hypot(pos.x - X(p.x), pos.z - Z(p.y))
        const labelScale = s.map ? Math.min(1, el.clientWidth / 900) : 1
        L.sprite.scale.set(.4 * labelScale, .05 * labelScale, 1)
        L.sprite.material.opacity = s.map ? 1 : clamp(1 - (d - 26) / 12, 0, 1)
        L.sprite.visible = L.sprite.material.opacity > 0.02
      }
      W3.update(t, dt, her.group.position, s.night, s.dusk, s.map)
      if (party) party.update(t, dt, her.group.position)

      // camera: smooth orbit around her, or a bird's-eye view of the whole town
      const cam = s.cam
      const intro = t - s.t0 < 4.5
      const rate = intro ? 0.9 : 4
      if (s.show && party) {
        // birthday show: a slow cinematic circle around the cake
        const e = t - s.show.t0
        // after the candles go out, lift the view so the fireworks fill the sky
        const after = e > SHOW.blow
        cam.target.lerp(after ? showTarget.copy(party.cakeTop).setY(party.cakeTop.y + 3.5) : party.cakeTop, Math.min(1, dt * 1.5))
        // swing slowly across the front of the party (never behind the banner)
        cam.yaw = 0.75 + Math.sin(e * 0.22 - 0.6) * 0.75
        cam.pitch = lerp(cam.pitch, after ? 0.14 : 0.3, Math.min(1, dt * 1.2))
        cam.dist = lerp(cam.dist, after ? 15 : 7.5, Math.min(1, dt * 1.2))
      } else {
      const tgt = s.map ? cameraTarget.set(0, 0, 4) : cameraTarget.set(X(p.x), 1.1 + p.yy, Z(p.y))
      cam.target.lerp(tgt, Math.min(1, dt * (s.map ? 3 : 6)))
      cam.yaw += angleTo(cam.yaw, s.map ? 0 : cam.tYaw) * Math.min(1, dt * (intro ? 0.9 : 6))
      cam.pitch = lerp(cam.pitch, s.map ? 1.25 : cam.tPitch, Math.min(1, dt * rate))
      cam.dist = lerp(cam.dist, s.map ? townMapDistance(camera.aspect) : cam.tDist, Math.min(1, dt * rate))
      }
      camera.position.set(
        cam.target.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist,
        cam.target.y + Math.sin(cam.pitch) * cam.dist,
        cam.target.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist,
      )
      camera.lookAt(cam.target)
      party?.render(camera, s.map)
      W3.vegetation.update(camera, her.group.position, quality.tier, s.map)
      W3.updateFlora(W3.vegetation.frustum, camera, s.map)
      const distantAvatar = s.map && cam.dist > 80
      her.group.visible = !distantAvatar; herMap.visible = distantAvatar
      herMap.position.copy(her.group.position); herMap.position.y += .65
      if (him) {
        him.group.visible = !!s.partner && !distantAvatar; hisMap.visible = !!s.partner && distantAvatar
        hisMap.position.copy(him.group.position); hisMap.position.y += .65
      }
      herBlob.position.copy(her.group.position); herBlob.position.y += .025
      players()
      hisBlob.visible = !!s.partner
      if (him) { hisBlob.position.copy(him.group.position); hisBlob.position.y += .025 }
      bloom.strength = 0.22 + s.night * 0.42

      // mini-map
      const m = miniRef.current
      if (m) {
        const dpr = Math.min(2, window.devicePixelRatio || 1)
        const mw = m.clientWidth, mh = m.clientHeight
        if (m.width !== Math.round(mw * dpr)) { m.width = Math.round(mw * dpr); m.height = Math.round(mh * dpr) }
        const mc = m.getContext('2d')
        mc.setTransform(dpr, 0, 0, dpr, 0, 0)
        mc.drawImage(miniBase, 0, 0, mw, mh)
        if (s.night > 0) { mc.fillStyle = `rgba(18,22,60,${0.4 * s.night})`; mc.fillRect(0, 0, mw, mh) }
        const sc = mw / (COLS * TS)
        mc.fillStyle = '#e0486c'
        for (const h of layout.hearts) if (!s.got.has(h.id)) { mc.beginPath(); mc.arc(h.x * sc, h.y * sc, 1.8, 0, 7); mc.fill() }
        if (party) { mc.font = '11px serif'; mc.textAlign = 'center'; mc.textBaseline = 'middle'; mc.fillText('🎂', party.cakePx.x * sc, party.cakePx.y * sc) }
        if (s.partner) { mc.fillStyle = '#5a6690'; mc.beginPath(); mc.arc(s.partner.x * sc, s.partner.y * sc, 2.8, 0, 7); mc.fill() }
        const px = p.x * sc, py = p.y * sc
        mc.fillStyle = 'rgba(255,111,143,.25)'
        mc.beginPath(); mc.moveTo(px, py); mc.arc(px, py, 22, -Math.PI / 2 - cam.yaw - 0.55, -Math.PI / 2 - cam.yaw + 0.55); mc.closePath(); mc.fill()
        mc.fillStyle = '#c4574a'; mc.strokeStyle = '#fff'; mc.lineWidth = 1.5
        mc.beginPath(); mc.arc(px, py, 3.6, 0, 7); mc.fill(); mc.stroke()
      }
    }

    s.t0 = performance.now() / 1000
    s.cam.target.set(X(s.p.x), 1.1, Z(s.p.y))
    // opening shot: start high above the town and swoop down to her
    s.cam.dist = 120; s.cam.pitch = 1.2; s.cam.yaw = 0.6
    let raf, last = performance.now(), alive = true
    renderer.info.autoReset = false
    const samples = fpsEnabled ? [] : null
    const frameIntervals = fpsEnabled ? new Float32Array(512) : null
    let intervalCount = 0, worstFrame = 0, maxCalls = 0, maxTriangles = 0, modalPaused = false, compilationStarted = false, shadersReady = false
    if (fpsEnabled) window.__townPerformance = samples
    const frame = (now) => {
      if (!alive || document.hidden) return
      // The museum owns a second WebGL renderer. Keep the town as a still
      // background while a place/puzzle/gallery is open instead of rendering it twice.
      if (s.open && !s.show) {
        if (!modalPaused) { modalPaused = true; quality.reset(); intervalCount = 0; worstFrame = 0; maxCalls = 0; maxTriangles = 0 }
        last = now; raf = requestAnimationFrame(frame); return
      }
      if (modalPaused) { modalPaused = false; quality.reset(); last = now }
      if (!compilationStarted) {
        compilationStarted = true
        renderer.compileAsync(scene, camera).then(() => { if (alive) shadersReady = true }).catch(() => { if (alive) shadersReady = true })
      }
      const elapsed = now - last, dt = Math.min(0.05, elapsed / 1000)
      last = now
      const cpuStart = performance.now()
      update(dt, now / 1000)
      // Resizing after drawing clears the canvas. Apply queued settings before
      // the next draw so adapting quality cannot present an empty frame.
      if (pendingTier) { configureQuality(pendingTier, pendingResolution); pendingTier = null }
      renderer.info.reset()
      profiler.begin()
      composer.render()
      profiler.end(performance.now() - cpuStart)
      const info = renderer.info.render
      if (fpsEnabled) {
        frameIntervals[intervalCount++ % 512] = elapsed
        worstFrame = Math.max(worstFrame, elapsed); maxCalls = Math.max(maxCalls, info.calls); maxTriangles = Math.max(maxTriangles, info.triangles)
      }
      if (quality.sample(elapsed, info.calls, info.triangles, Math.max(profiler.stats.cpuMs, profiler.stats.gpuMs || elapsed * .85)) && fpsEl) {
        fpsEl.textContent = `${quality.stats.fps.toFixed(1)} fps | ${quality.stats.ms.toFixed(1)} ms\n${info.calls} calls | ${Math.round(info.triangles / 1000)}k triangles\n${quality.stats.tier} | DPR ${renderer.getPixelRatio().toFixed(2)}`
        fpsEl.textContent += `\nCPU ${profiler.stats.cpuMs.toFixed(1)} / GPU ${profiler.stats.gpuMs.toFixed(1)} ms`
        const sorted = Array.from(frameIntervals.subarray(0, Math.min(intervalCount, 512))).sort((a, b) => a - b)
        const p95FrameMs = sorted[Math.max(0, Math.ceil(sorted.length * .95) - 1)]
        samples.push({ presented, p95FrameMs, worstFrameMs: worstFrame, maxCalls, maxTriangles, time: now, fps: quality.stats.fps, cpuMs: profiler.stats.cpuMs, gpuMs: profiler.stats.gpuMs, calls: info.calls, triangles: info.triangles, tier: quality.stats.tier, dpr: renderer.getPixelRatio(), x: s.p.x, y: s.p.y, map: s.map })
        intervalCount = 0; worstFrame = 0; maxCalls = 0; maxTriangles = 0
        if (samples.length > 300) samples.shift()
        fpsEl.dataset.fps = quality.stats.fps.toFixed(1)
        fpsEl.dataset.calls = info.calls
        fpsEl.dataset.triangles = info.triangles
        fpsEl.dataset.tier = quality.stats.tier
      }
      if (!presented && ((shadersReady && quality.stats.ms > 0 && quality.stats.ms <= 18.2 && now - preparationStart > 4500) || now - preparationStart > 20000)) {
        presented = true; setReady(true); quality.reset(); s.clock = initialClock
        if (party) s.toastT0 = setTimeout(() => flash(`🎂 Happy Birthday, ${story.name}! Everyone is waiting for you in the park`, 6500), 4800)
        s.t0 = now / 1000; s.cam.dist = 120; s.cam.pitch = 1.2; s.cam.yaw = .6
      }
      raf = requestAnimationFrame(frame)
    }
    const visibility = () => {
      cancelAnimationFrame(raf)
      s.keys.clear(); s.run = false
      if (!document.hidden && alive) { last = performance.now(); if (!presented) preparationStart = last; quality.reset(); raf = requestAnimationFrame(frame) }
    }
    document.addEventListener('visibilitychange', visibility)
    raf = requestAnimationFrame(frame)

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', visibility)
      fpsEl?.remove()
      if (window.__townPerformance === samples) delete window.__townPerformance
      profiler.dispose()
      cv.removeEventListener('pointerdown', pDown)
      cv.removeEventListener('pointermove', pMove)
      cv.removeEventListener('pointerup', pUp)
      cv.removeEventListener('pointercancel', pUp)
      cv.removeEventListener('wheel', onWheel)
      party?.dispose()
      players.dispose(); her.dispose(); him?.dispose()
      W3.dispose()
      W3.sun.shadow.dispose()
      ro.disconnect()
      clearTimeout(s.toastT)
      clearTimeout(s.toastT0)
      s.music?.stop(); s.music = null
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      scene.traverse((o) => {
        if (o.isInstancedMesh) o.dispose()
        if (o.geometry) o.geometry.dispose()
        const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []
        ms.forEach((mm) => { Object.values(mm).forEach((v) => v?.isTexture && v.dispose()); if (mm !== glowMats.window && mm !== glowMats.bulb) mm.dispose() })
      })
      bloom.dispose()
      output.dispose()
      composer.dispose()
      envTarget.dispose()
      renderer.dispose()
      el.removeChild(renderer.domElement)
    }
    // the layout, avatar and story are fixed for the lifetime of this component
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pad = (dir, on) => (e) => { e.preventDefault(); g.current.pad[dir] = on; if (on) g.current.path = null }
  const place = near && placeById[near]
  const openPlace = open && placeById[open]

  return (
    <div className="town town3d">
      <div className="t3-host" ref={host} />
      <div className="t3-vignette" />
      {!ready && <TownPreparing layout={layout} name={story.name}/>}
      {ready && <div className="welcome"><span className="script">Welcome to our little town</span></div>}

      {ready && !show && (
        <>
          <div className="hud-top">
            <div className="hud-left">
              <div className="pill"><b>♥</b> {count} / {total}</div>
              <div className="pill" title="Puzzles solved"><b>✦</b> {games.length} / 2 puzzles</div>
            </div>
            <button className="pill ghost" onClick={onEditAvatar}>✎ {name}</button>
          </div>

          <div className="hud-tools">
            {bday && <button className="tool" onClick={goParty} title="Go to the birthday party">🎂</button>}
            <button className="tool" onClick={toggleNight} title="Day / night">{night ? '☾' : '☀'}</button>
            <button className="tool" onClick={() => zoomBy(0.75)} title="Zoom in">+</button>
            <button className="tool" onClick={() => zoomBy(1.33)} title="Zoom out">−</button>
            <button className={`tool ${mapMode ? 'on' : ''}`} onClick={toggleMap} title="Full map (M)">⤢</button>
          </div>

          <button className="minimap" onClick={toggleMap} aria-label="Toggle full map">
            <canvas ref={miniRef} />
            <span>{mapMode ? 'back to her' : 'map'}</span>
          </button>

          <AnimatePresence>
            {near === 'cake' && !open && !mapMode && (
              <motion.button key="cake" className="enter cake" onClick={interact} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }}>
                <small>{coarse ? 'tap here' : 'press E'}</small>
                <span>🎂 Make a wish</span>
                <em>everyone is here for you</em>
              </motion.button>
            )}
            {place && !open && !mapMode && (
              <motion.button key={near} className="enter" onClick={interact} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }}>
                <small>{coarse ? 'tap to enter' : 'press E to enter'}</small>
                <span>{place.name}</span>
                <em>{place.caption}</em>
              </motion.button>
            )}
            {toast && <motion.div className="toast" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{toast}</motion.div>}
          </AnimatePresence>

          <p className="help">{coarse ? 'pad or tap to walk · drag to look · pinch to zoom' : 'WASD to walk · drag to look around · scroll to zoom · tap the ground to walk there · M map'}</p>

          {coarse && (
            <div className="dpad">
              {[['f', 'up', '▲'], ['l', 'left', '◀'], ['r', 'right', '▶'], ['b', 'down', '▼']].map(([d, cls, ch]) => (
                <button key={d} className={cls} onPointerDown={pad(d, true)} onPointerUp={pad(d, false)} onPointerLeave={pad(d, false)} onPointerCancel={pad(d, false)} aria-label={cls}>{ch}</button>
              ))}
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {show > 0 && <BirthdayShow key={show} name={story.name} message={story.birthdayMessage} from={story.from} onClose={endShow} onMute={(m) => g.current.music?.setMuted(m)} />}
      </AnimatePresence>

      <AnimatePresence>
        {open === 'museum' && (
          <Suspense key="museum" fallback={<div className="m-intro"><h2>Our Museum</h2><p>opening the doors…</p></div>}>
            <Museum photos={story.gallery} herLook={look} hisLook={hasPartner ? partner.look : null} onClose={close} />
          </Suspense>
        )}
        {open === 'arcade' && <Arcade key="arcade" photos={story.gallery} gift={story.gift} done={games} onWin={winGame} onClose={close} />}
        {openPlace && open !== 'museum' && open !== 'arcade' && <PlaceModal key={open} place={openPlace} story={story} onClose={close} />}
      </AnimatePresence>
    </div>
  )
}
