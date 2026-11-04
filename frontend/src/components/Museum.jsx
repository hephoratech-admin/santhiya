import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import * as THREE from 'three'
import { Reflector } from 'three/addons/objects/Reflector.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { drawAvatarInked } from '../game/avatar.js'

// ---- gallery dimensions (metres) ----
const HALL_W = 9
const HALL_H = 5.2
const SPACING = 3.6 // between frames on the same wall
const START = 4.5 // distance from the entrance to the first frame
const EYE = 1.75

// ---------- procedural textures ----------
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat) }
  return t
}

const woodTex = (repeat) => canvasTex(1024, 1024, (g, W, H) => {
  const rows = 8, ph = H / rows
  for (let r = 0; r < rows; r++) {
    let x = -((r * 397) % 420)
    while (x < W) {
      const w = 360 + Math.random() * 300
      const b = [146 + Math.random() * 24, 104 + Math.random() * 18, 70 + Math.random() * 14].map(Math.round)
      g.fillStyle = `rgb(${b})`
      g.fillRect(x, r * ph, w, ph)
      for (let i = 0; i < 30; i++) {
        g.strokeStyle = `rgba(80,48,26,${0.04 + Math.random() * 0.08})`
        g.lineWidth = 0.8 + Math.random() * 1.6
        const y = r * ph + Math.random() * ph
        g.beginPath(); g.moveTo(x, y)
        g.bezierCurveTo(x + w * 0.33, y + (Math.random() - 0.5) * 9, x + w * 0.66, y + (Math.random() - 0.5) * 9, x + w, y + (Math.random() - 0.5) * 6)
        g.stroke()
      }
      g.fillStyle = 'rgba(40,24,14,.55)'; g.fillRect(x, r * ph, 2, ph)
      x += w
    }
    g.fillStyle = 'rgba(40,24,14,.5)'; g.fillRect(0, r * ph, W, 2)
  }
}, repeat)

const plasterTex = (repeat) => canvasTex(512, 512, (g, W, H) => {
  g.fillStyle = '#f4f0e9'; g.fillRect(0, 0, W, H)
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,.35)' : 'rgba(150,130,110,.05)'
    g.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5)
  }
}, repeat)

const glowTex = () => canvasTex(256, 256, (g, W, H) => {
  const gr = g.createRadialGradient(W / 2, H * 0.22, 4, W / 2, H * 0.45, W * 0.55)
  gr.addColorStop(0, 'rgba(255,236,200,.95)'); gr.addColorStop(0.35, 'rgba(255,226,180,.38)'); gr.addColorStop(1, 'rgba(255,220,170,0)')
  g.fillStyle = gr; g.fillRect(0, 0, W, H)
})

function textTex(lines, { w = 1024, h = 256, bg = null, color = '#3b2a30', fonts = [] } = {}) {
  return canvasTex(w, h, (g) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h) }
    g.fillStyle = color
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    lines.forEach((l, i) => { g.font = fonts[i] || '600 60px Inter, sans-serif'; g.fillText(l, w / 2, (h * (i + 1)) / (lines.length + 1)) })
  })
}

// ---------- the scene ----------
function buildMuseum({ photos, renderer, onLoaded }) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#efe9df')
  scene.fog = new THREE.Fog('#efe9df', 22, 62)
  const pm = new THREE.PMREMGenerator(renderer)
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentIntensity = 0.55

  const perWall = Math.ceil(photos.length / 2)
  const L = START + perWall * SPACING + 5
  const endZ = -L
  const midZ = -L / 2

  const manager = new THREE.LoadingManager()
  manager.onLoad = onLoaded
  // Photos go through a canvas first: the browser applies the phone's EXIF rotation when drawing,
  // which WebGL would otherwise ignore (some photos would hang sideways).
  const loadPhoto = (src, onReady) => {
    const tex = new THREE.Texture()
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    manager.itemStart(src)
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight))
      const c = document.createElement('canvas')
      c.width = Math.round(img.naturalWidth * k)
      c.height = Math.round(img.naturalHeight * k)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      tex.image = c
      tex.needsUpdate = true
      onReady(c)
      manager.itemEnd(src)
    }
    img.onerror = () => { manager.itemError(src); manager.itemEnd(src) }
    img.src = src
    return tex
  }

  // floor: wood over a real mirror, so the gallery reflects softly in the polish
  const mirror = new Reflector(new THREE.PlaneGeometry(HALL_W, L + 3), {
    textureWidth: Math.min(1024, window.innerWidth), textureHeight: Math.min(1024, window.innerHeight), color: 0x9a9a9a,
  })
  mirror.rotation.x = -Math.PI / 2
  mirror.position.set(0, -0.001, midZ + 1.5)
  scene.add(mirror)
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(HALL_W, L + 3),
    new THREE.MeshStandardMaterial({ map: woodTex([HALL_W / 3, (L + 3) / 3]), roughness: 0.42, metalness: 0, transparent: true, opacity: 0.9 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.set(0, 0.002, midZ + 1.5)
  floor.receiveShadow = true
  scene.add(floor)

  const wallMat = new THREE.MeshStandardMaterial({ map: plasterTex([L / 4, HALL_H / 4]), roughness: 0.92 })
  const endMat = new THREE.MeshStandardMaterial({ map: plasterTex([HALL_W / 4, HALL_H / 4]), roughness: 0.92 })
  const addWall = (w, h, pos, rotY, mat) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat)
    m.position.set(...pos); m.rotation.y = rotY; m.receiveShadow = true
    scene.add(m)
  }
  addWall(L + 3, HALL_H, [-HALL_W / 2, HALL_H / 2, midZ + 1.5], Math.PI / 2, wallMat)
  addWall(L + 3, HALL_H, [HALL_W / 2, HALL_H / 2, midZ + 1.5], -Math.PI / 2, wallMat)
  addWall(HALL_W, HALL_H, [0, HALL_H / 2, endZ], 0, endMat)
  addWall(HALL_W, HALL_H, [0, HALL_H / 2, 3], Math.PI, endMat)

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(HALL_W, L + 3), new THREE.MeshStandardMaterial({ color: '#fbfaf7', roughness: 1 }))
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.set(0, HALL_H, midZ + 1.5)
  scene.add(ceiling)

  // skylights: bright emissive panels that bloom softly
  const skyMat = new THREE.MeshStandardMaterial({ color: '#fffaf0', emissive: '#fff4dc', emissiveIntensity: 1.5 })
  for (let z = 0; z > endZ + 2; z -= 5) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.2), skyMat)
    p.rotation.x = Math.PI / 2; p.position.set(0, HALL_H - 0.01, z - 2)
    scene.add(p)
  }

  // mouldings: skirting board, cornice and the track-light rails
  const trimMat = new THREE.MeshStandardMaterial({ color: '#e7e0d4', roughness: 0.6 })
  const railMat = new THREE.MeshStandardMaterial({ color: '#2b2526', metalness: 0.6, roughness: 0.4 })
  for (const side of [-1, 1]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, L + 3), trimMat)
    skirt.position.set(side * (HALL_W / 2 - 0.02), 0.09, midZ + 1.5)
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, L + 3), trimMat)
    cornice.position.set(side * (HALL_W / 2 - 0.06), HALL_H - 0.08, midZ + 1.5)
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, L), railMat)
    rail.position.set(side * (HALL_W / 2 - 1.1), HALL_H - 0.25, midZ)
    scene.add(skirt, cornice, rail)
  }

  // lights
  scene.add(new THREE.HemisphereLight('#fff8ee', '#c9b49a', 0.55))
  const sun = new THREE.DirectionalLight('#fff3e0', 1.15)
  sun.position.set(2, 12, midZ + 4)
  sun.target.position.set(0, 0, midZ)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.left = -HALL_W; sun.shadow.camera.right = HALL_W
  sun.shadow.camera.top = L / 2 + 4; sun.shadow.camera.bottom = -L / 2 - 4
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 30
  sun.shadow.radius = 6
  sun.shadow.bias = -0.0005
  scene.add(sun, sun.target)
  for (let z = -2; z > endZ; z -= 8) {
    const pl = new THREE.PointLight('#ffd9a8', 6, 11, 2)
    pl.position.set(0, HALL_H - 0.8, z)
    scene.add(pl)
  }

  // frames
  const goldMat = new THREE.MeshStandardMaterial({ color: '#b48a4a', metalness: 0.85, roughness: 0.32 })
  const matMat = new THREE.MeshStandardMaterial({ color: '#f8f5ef', roughness: 0.95 })
  const brassMat = new THREE.MeshStandardMaterial({ color: '#c8a463', metalness: 0.8, roughness: 0.3 })
  const fixtureMat = new THREE.MeshStandardMaterial({ color: '#221c1d', metalness: 0.5, roughness: 0.5 })
  const lensMat = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#ffe8bf', emissiveIntensity: 3 })
  const glow = glowTex()
  const clickables = []
  const frames = []

  const hang = (src, caption, idx, x, z, rotY, big = false) => {
    const y = big ? 2.1 : 1.78
    const group = new THREE.Group()
    group.position.set(x, y, z)
    group.rotation.y = rotY
    scene.add(group)

    const mat = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), matMat)
    mat.position.z = 0.012
    const tex = loadPhoto(src, (img) => {
      const a = img.width / img.height
      let ph = big ? 2.2 : 1.32
      let pw = ph * a
      const maxW = big ? 3.2 : 1.7
      if (pw > maxW) { pw = maxW; ph = pw / a }
      photo.scale.set(pw, ph, 1)
      const m = big ? 0.22 : 0.14, f = 0.075, d = 0.08
      const ow = pw + 2 * m, oh = ph + 2 * m
      mat.scale.set(ow, oh, 1)
      for (const [w, h, px, py] of [[ow + 2 * f, f, 0, oh / 2 + f / 2], [ow + 2 * f, f, 0, -oh / 2 - f / 2], [f, oh, -ow / 2 - f / 2, 0], [f, oh, ow / 2 + f / 2, 0]]) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), goldMat)
        b.position.set(px, py, d / 2); b.castShadow = true
        group.add(b)
      }
      if (plaque) plaque.position.y = -oh / 2 - f - 0.22
      wash.scale.set(Math.max(2.4, ow + 1.4), oh + 2.4, 1)
    })
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.32, roughness: 0.55 }))
    photo.position.z = 0.03
    photo.userData.index = idx
    clickables.push(photo)

    // a soft pool of spotlight on the wall around the frame
    const wash = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }))
    wash.position.set(0, 0.55, 0.004)
    group.add(mat, photo, wash)

    let plaque = null
    if (!big) {
      plaque = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.012), brassMat)
      const label = new THREE.Mesh(new THREE.PlaneGeometry(0.47, 0.12), new THREE.MeshBasicMaterial({
        map: textTex([`No. ${String(idx + 1).padStart(2, '0')}`, caption], { w: 512, h: 132, bg: '#f3e6c8', color: '#3b2a30', fonts: ['600 26px Inter', '500 30px Inter'] }),
      }))
      label.position.z = 0.008
      plaque.add(label)
      group.add(plaque)
    }

    // the track-light fixture aimed at this frame
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.22, 16), fixtureMat)
    can.position.set(0, HALL_H - y - 0.38, 1.1)
    can.rotation.x = -0.7
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), lensMat)
    lens.position.set(0, -0.112, 0); lens.rotation.x = Math.PI / 2
    can.add(lens)
    group.add(can)
    if (!big) frames.push({ idx, caption, pos: new THREE.Vector3(x, 0, z), rotY })
  }

  photos.forEach((p, i) => {
    const left = i % 2 === 0
    const z = -(START + Math.floor(i / 2) * SPACING + (left ? 0 : SPACING / 2))
    hang(p.src, p.caption, i, left ? -HALL_W / 2 + 0.01 : HALL_W / 2 - 0.01, z, left ? Math.PI / 2 : -Math.PI / 2)
  })
  // the feature piece on the far wall
  hang(photos[0].src, photos[0].caption, 0, 0, endZ + 0.01, 0, true)
  const endTitle = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.9), new THREE.MeshBasicMaterial({ map: textTex(['You are my favourite exhibit ♥'], { w: 1400, h: 250, color: '#b8574a', fonts: ['400 120px "Gochi Hand", cursive'] }), transparent: true }))
  endTitle.position.set(0, HALL_H - 0.75, endZ + 0.02)
  scene.add(endTitle)

  // wall lettering at the entrance
  const title = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.15), new THREE.MeshBasicMaterial({ map: textTex(['Our Museum', 'a museum built out of your photos'], { w: 1400, h: 450, color: '#3b2a30', fonts: ['400 210px "Gochi Hand", cursive', '500 52px Inter'] }), transparent: true }))
  title.position.set(-HALL_W / 2 + 0.02, 2.4, -1.4); title.rotation.y = Math.PI / 2
  const est = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.5), new THREE.MeshBasicMaterial({ map: textTex(['curated with love · for Santhiya'], { w: 1400, h: 230, color: '#8a6f62', fonts: ['500 74px Inter'] }), transparent: true }))
  est.position.set(HALL_W / 2 - 0.02, 2.5, -1.4); est.rotation.y = -Math.PI / 2
  scene.add(title, est)

  // benches down the middle (also solid for walking)
  const walnut = new THREE.MeshStandardMaterial({ color: '#4a3226', roughness: 0.45, metalness: 0.1 })
  const leather = new THREE.MeshStandardMaterial({ color: '#7a3b3b', roughness: 0.55 })
  const obstacles = []
  for (let k = 1; k < perWall; k += 3) {
    const z = -(START + k * SPACING + SPACING / 4)
    const bench = new THREE.Group()
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 0.55), walnut); seat.position.y = 0.42
    const cush = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.5), leather); cush.position.y = 0.52
    bench.add(seat, cush)
    for (const lx of [-0.85, 0.85]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.38, 0.45), walnut); leg.position.set(lx, 0.19, 0); bench.add(leg) }
    bench.position.set(0, 0, z)
    bench.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
    scene.add(bench)
    obstacles.push({ x0: -1.15, x1: 1.15, z0: z - 0.45, z1: z + 0.45 })
  }

  // potted olive trees in the corners
  const pot = new THREE.MeshStandardMaterial({ color: '#f1ece4', roughness: 0.4 })
  const leaf = new THREE.MeshStandardMaterial({ color: '#6f8f5a', roughness: 0.8, flatShading: true })
  const trunk = new THREE.MeshStandardMaterial({ color: '#6b4c35', roughness: 0.9 })
  for (const [x, z] of [[-HALL_W / 2 + 0.7, 1.8], [HALL_W / 2 - 0.7, 1.8], [-HALL_W / 2 + 0.7, endZ + 0.8], [HALL_W / 2 - 0.7, endZ + 0.8]]) {
    const g = new THREE.Group()
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.6, 24), pot); p.position.y = 0.3
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 1.1, 8), trunk); tr.position.y = 1.1
    g.add(p, tr)
    for (let i = 0; i < 7; i++) {
      const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28 + Math.random() * 0.12, 0), leaf)
      f.position.set((Math.random() - 0.5) * 0.6, 1.55 + Math.random() * 0.5, (Math.random() - 0.5) * 0.6)
      g.add(f)
    }
    g.position.set(x, 0, z)
    g.traverse((o) => { if (o.isMesh) o.castShadow = true })
    scene.add(g)
    obstacles.push({ x0: x - 0.45, x1: x + 0.45, z0: z - 0.45, z1: z + 0.45 })
  }

  return { scene, endZ, clickables, frames, obstacles, pm }
}

// billboard avatar that redraws its sprite only when its pose changes
function makeAvatar(look) {
  const c = document.createElement('canvas')
  c.width = 256; c.height = 360
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const h = 1.25, w = (h * 256) / 360
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.4, roughness: 0.9, side: THREE.DoubleSide })
  const geo = new THREE.PlaneGeometry(w, h)
  geo.translate(0, h / 2 - (18 / 360) * h, 0)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.castShadow = true
  mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.4 })
  let key = ''
  return {
    mesh,
    pose(dir, phase, moving) {
      const k = `${dir}|${moving ? Math.floor(phase * 8) : 0}|${moving}`
      if (k === key) return
      key = k
      const g = c.getContext('2d')
      g.clearRect(0, 0, 256, 360)
      drawAvatarInked(g, look, 128, 342, dir, phase, moving, 4.6)
      tex.needsUpdate = true
    },
  }
}

export default function Museum({ photos, herLook, hisLook, onClose }) {
  const host = useRef(null)
  const [loaded, setLoaded] = useState(false)
  const [intro, setIntro] = useState(true)
  const [zoomed, setZoomed] = useState(null)
  const [nearFrame, setNearFrame] = useState(null)
  const [touring, setTouring] = useState(false)
  const api = useRef({})
  const zoomedRef = useRef(null)
  zoomedRef.current = zoomed
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => { const t = setTimeout(() => setIntro(false), 2600); return () => clearTimeout(t) }, [])

  useEffect(() => {
    const el = host.current
    setTouring(false)
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1))
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.9
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    el.appendChild(renderer.domElement)

    const { scene, endZ, clickables, frames, obstacles, pm } = buildMuseum({ photos, renderer, onLoaded: () => setLoaded(true) })
    const camera = new THREE.PerspectiveCamera(58, el.clientWidth / el.clientHeight, 0.05, 80)
    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(el.clientWidth, el.clientHeight), 0.24, 0.5, 0.9))
    composer.addPass(new OutputPass())

    const her = makeAvatar(herLook)
    scene.add(her.mesh)
    const him = hisLook ? makeAvatar(hisLook) : null
    if (him) scene.add(him.mesh)

    const s = { x: 0, z: 1.2, yaw: 0, pitch: -0.06, v: 0, keys: new Set(), hold: { f: 0, t: 0 }, phase: 0, idle: 0, trail: [], tour: null, camYaw: 0, wheel: 0 }
    const partner = { x: 0.9, z: 2.2, phase: 0, moving: false }
    s.camDist = 3.4
    const minX = -HALL_W / 2 + 0.7, maxX = HALL_W / 2 - 0.7
    const minZ = endZ + 1.6, maxZ = 2.3

    const stopTour = () => { if (s.tour) { s.tour = null; setTouring(false) } }
    api.current = {
      startTour: () => { s.tour = { i: 0, wait: 0 }; setTouring(true) },
      stopTour,
      setHold: (k, v) => { s.hold[k] = v; if (v) stopTour() },
    }

    const MOVE_KEYS = ['w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', 'q', 'e']
    const down = (e) => {
      const k = e.key.toLowerCase()
      if (k === 'escape') { zoomedRef.current !== null ? setZoomed(null) : onCloseRef.current(); return }
      if (zoomedRef.current !== null) return
      if (MOVE_KEYS.includes(k)) { s.keys.add(k); if (k !== 'shift') stopTour(); if (k.startsWith('arrow')) e.preventDefault() }
    }
    const up = (e) => s.keys.delete(e.key.toLowerCase())
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)

    // drag to look around, click a frame to open it
    let drag = null
    const cv = renderer.domElement
    const ray = new THREE.Raycaster()
    const pick = (e) => {
      const r = cv.getBoundingClientRect()
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera)
      const hit = ray.intersectObjects(clickables)[0]
      return hit && hit.distance < 10 ? hit.object.userData.index : null
    }
    const onDown = (e) => { drag = { x: e.clientX, y: e.clientY, moved: 0 }; cv.setPointerCapture(e.pointerId) }
    const onMove = (e) => {
      if (!drag) { cv.style.cursor = pick(e) !== null ? 'zoom-in' : 'grab'; return }
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y
      drag.moved += Math.abs(dx) + Math.abs(dy)
      drag.x = e.clientX; drag.y = e.clientY
      s.yaw -= dx * 0.0042
      s.pitch = Math.max(-0.45, Math.min(0.35, s.pitch - dy * 0.003))
      if (drag.moved > 6) stopTour()
    }
    const onUp = (e) => {
      if (drag && drag.moved < 6) { const i = pick(e); if (i !== null) setZoomed(i) }
      drag = null
    }
    const onWheel = (e) => { s.wheel -= e.deltaY * 0.004; stopTour() }
    cv.addEventListener('pointerdown', onDown)
    cv.addEventListener('pointermove', onMove)
    cv.addEventListener('pointerup', onUp)
    cv.addEventListener('wheel', onWheel, { passive: true })

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight
      renderer.setSize(w, h); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix()
    })
    ro.observe(el)

    const blocked = (x, z) => obstacles.some((o) => x > o.x0 - 0.25 && x < o.x1 + 0.25 && z > o.z0 - 0.25 && z < o.z1 + 0.25)
    const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b))
    let raf, last = performance.now(), lastNear = null
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const k = s.keys
      const run = k.has('shift') ? 1.7 : 1
      let fwd = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0) + s.hold.f
      const turn = (k.has('a') || k.has('arrowleft') ? 1 : 0) - (k.has('d') || k.has('arrowright') ? 1 : 0) + s.hold.t
      const strafe = (k.has('e') ? 1 : 0) - (k.has('q') ? 1 : 0)
      if (s.wheel) { fwd += Math.max(-1, Math.min(1, s.wheel)); s.wheel *= 0.88; if (Math.abs(s.wheel) < 0.05) s.wheel = 0 }

      // guided tour: stroll to each frame, turn to face it, pause, move on
      if (s.tour) {
        const f = frames[s.tour.i]
        const side = f.pos.x < 0 ? -1 : 1
        const tx = side * (HALL_W / 2 - 2.6), tz = f.pos.z
        const d = Math.hypot(tx - s.x, tz - s.z)
        if (d > 0.15) {
          const heading = Math.atan2(-(tx - s.x), -(tz - s.z))
          s.yaw += angleDiff(heading, s.yaw) * Math.min(1, dt * 3)
          fwd = Math.min(1, d) * 0.8 * Math.max(0, Math.cos(angleDiff(heading, s.yaw)))
        } else {
          const want = Math.atan2(-(f.pos.x - s.x), -(f.pos.z - s.z))
          s.yaw += angleDiff(want, s.yaw) * Math.min(1, dt * 2.5)
          s.tour.wait += dt
          if (s.tour.wait > 3.2) { s.tour.i = (s.tour.i + 1) % frames.length; s.tour.wait = 0 }
        }
      }

      s.yaw += turn * 1.9 * dt
      s.v += (fwd * 2.4 * run - s.v) * Math.min(1, dt * 7)
      const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw)
      const nx = Math.max(minX, Math.min(maxX, s.x + (fx * s.v - fz * strafe * 1.6) * dt))
      const nz = Math.max(minZ, Math.min(maxZ, s.z + (fz * s.v + fx * strafe * 1.6) * dt))
      if (!blocked(nx, s.z)) s.x = nx
      if (!blocked(s.x, nz)) s.z = nz
      const moving = Math.abs(s.v) > 0.15 || strafe !== 0
      if (moving) { s.phase = (s.phase + dt * 1.5 * run) % 1; s.idle = 0 } else s.idle += dt

      // third-person camera, smoothed behind her
      s.camYaw += angleDiff(s.yaw, s.camYaw) * Math.min(1, dt * 5)
      // keep the camera inside the room: pull it in when a wall is behind her
      const bx = Math.sin(s.camYaw), bz = Math.cos(s.camYaw)
      let room = 3.4
      if (bx > 0.001) room = Math.min(room, (HALL_W / 2 - 0.3 - s.x) / bx)
      if (bx < -0.001) room = Math.min(room, (-HALL_W / 2 + 0.3 - s.x) / bx)
      if (bz > 0.001) room = Math.min(room, (2.7 - s.z) / bz)
      if (bz < -0.001) room = Math.min(room, (endZ + 0.3 - s.z) / bz)
      room = Math.max(0.9, room)
      s.camDist += (room - s.camDist) * Math.min(1, dt * (room < s.camDist ? 14 : 3))
      camera.position.set(s.x + bx * s.camDist, EYE + 0.1 + (3.4 - s.camDist) * 0.18, s.z + bz * s.camDist)
      camera.lookAt(s.x - Math.sin(s.camYaw) * 4, EYE - 0.1 + s.pitch * 6, s.z - Math.cos(s.camYaw) * 4)

      her.mesh.position.set(s.x, 0, s.z)
      her.mesh.lookAt(camera.position.x, 0, camera.position.z)
      const dir = !moving ? (s.idle > 1.8 ? 'down' : 'up') : s.v < -0.1 ? 'down' : strafe > 0 ? 'right' : strafe < 0 ? 'left' : 'up'
      her.pose(dir, s.phase, moving)

      if (him) {
        const lastT = s.trail[s.trail.length - 1]
        if (!lastT || Math.hypot(s.x - lastT.x, s.z - lastT.z) > 0.05) { s.trail.push({ x: s.x, z: s.z }); if (s.trail.length > 300) s.trail.shift() }
        let rest = 1.05, tx = s.x + 0.8, tz = s.z + 0.6
        for (let i = s.trail.length - 1; i > 0; i--) {
          const a = s.trail[i], b = s.trail[i - 1]
          const d = Math.hypot(a.x - b.x, a.z - b.z)
          if (rest <= d) { const q = rest / d; tx = a.x + (b.x - a.x) * q + 0.55; tz = a.z + (b.z - a.z) * q; rest = 0; break }
          rest -= d
        }
        tx = Math.max(minX, Math.min(maxX, tx))
        const dx = tx - partner.x, dz = tz - partner.z, d = Math.hypot(dx, dz)
        partner.moving = d > 0.06
        if (partner.moving) { const st = Math.min(d, 3.2 * run * dt); partner.x += (dx / d) * st; partner.z += (dz / d) * st; partner.phase = (partner.phase + dt * 1.5 * run) % 1 }
        him.mesh.position.set(partner.x, 0, partner.z)
        him.mesh.lookAt(camera.position.x, 0, camera.position.z)
        him.pose(partner.moving ? 'up' : s.idle > 1.8 ? 'down' : 'up', partner.phase, partner.moving)
      }

      // the frame she's standing by gets a caption card
      let near = null, nd = 3.4
      for (const f of frames) {
        const d = Math.hypot(f.pos.x - s.x, f.pos.z - s.z)
        if (d < nd) { nd = d; near = f.idx }
      }
      if (near !== lastNear) { lastNear = near; setNearFrame(near) }

      composer.render()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose()
        const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []
        ms.forEach((m) => { Object.values(m).forEach((v) => v?.isTexture && v.dispose()); m.dispose() })
      })
      pm.dispose()
      composer.dispose()
      renderer.dispose()
      el.removeChild(renderer.domElement)
    }
    // the scene is only rebuilt if the photos or avatars change, not on every parent render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.map((p) => p.src).join(), JSON.stringify(herLook), JSON.stringify(hisLook)])

  const hold = (key, v) => (e) => { e.preventDefault(); api.current.setHold?.(key, v) }
  const holdProps = (key, v) => ({ onPointerDown: hold(key, v), onPointerUp: hold(key, 0), onPointerLeave: hold(key, 0), onPointerCancel: hold(key, 0) })

  return (
    <motion.div className="museum3d" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.7 }}>
      <div className="m3-host" ref={host} />
      <div className="m3-vignette" />

      <div className="m-ui">
        <button className="m-leave" onClick={onClose}>← Leave the museum</button>
        <button className={`m-leave ${touring ? 'on' : ''}`} onClick={() => (touring ? api.current.stopTour() : api.current.startTour())}>
          {touring ? '■ Stop the tour' : '▶ Guided tour'}
        </button>
      </div>

      <AnimatePresence>
        {nearFrame !== null && zoomed === null && (
          <motion.button key={nearFrame} className="m3-caption" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} onClick={() => setZoomed(nearFrame)}>
            <small>No. {String(nearFrame + 1).padStart(2, '0')}</small>
            <span>{photos[nearFrame].caption}</span>
            <em>tap to view</em>
          </motion.button>
        )}
      </AnimatePresence>

      <p className="m3-help">W/S walk · A/D turn · drag to look around · Shift to walk faster</p>
      <div className="m3-pad">
        <span />
        <button {...holdProps('f', 1)} aria-label="Walk forward">▲</button>
        <span />
        <button {...holdProps('t', 1)} aria-label="Turn left">⟲</button>
        <button {...holdProps('f', -1)} aria-label="Step back">▼</button>
        <button {...holdProps('t', -1)} aria-label="Turn right">⟳</button>
      </div>

      <AnimatePresence>
        {(intro || !loaded) && (
          <motion.div className="m-intro" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.1 }}>
            <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9 }}>Our Museum</motion.h2>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>{loaded ? 'a museum built out of your photos' : 'hanging the frames…'}</motion.p>
          </motion.div>
        )}
        {zoomed !== null && (
          <motion.div className="m-zoom" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setZoomed(null)}>
            <motion.figure key={zoomed} initial={{ scale: 0.94, y: 16, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} onClick={(e) => e.stopPropagation()}>
              <img src={photos[zoomed].src} alt={photos[zoomed].caption} />
              <figcaption><span>No. {String(zoomed + 1).padStart(2, '0')}</span> {photos[zoomed].caption}</figcaption>
            </motion.figure>
            <div className="m3-zoomnav" onClick={(e) => e.stopPropagation()}>
              <button className="m-close" onClick={() => setZoomed((zoomed - 1 + photos.length) % photos.length)}>‹ Prev</button>
              <button className="m-close" onClick={() => setZoomed(null)}>× Close</button>
              <button className="m-close" onClick={() => setZoomed((zoomed + 1) % photos.length)}>Next ›</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
