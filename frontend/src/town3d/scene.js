// Builds the 3D town from the shared layout. 1 tile = 2 m; layout "pixels" (32/tile) → metres via /16.
import * as THREE from 'three'
import { Sky } from 'three/addons/objects/Sky.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { BUILDINGS, COLS, ROWS, T, TS } from '../game/layout.js'
import { makeBuilding, glowMats, heartShape } from './buildings.js'

export const X = (px) => px / 16 - COLS
export const Z = (py) => py / 16 - ROWS
export const toPx = (x, z) => ({ x: (x + COLS) * 16, y: (z + ROWS) * 16 })
const W_M = COLS * 2, H_M = ROWS * 2

function rng(seed) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
}

// ---------- ground texture painted from the grid (water tiles are cut out) ----------
function groundTexture(layout, mobile) {
  const P = mobile ? 24 : 32 // pixels per tile
  const c = document.createElement('canvas')
  c.width = COLS * P; c.height = ROWS * P
  const g = c.getContext('2d')
  const rand = rng(11)
  const { grid } = layout
  const at = (cc, rr) => (cc < 0 || rr < 0 || cc >= COLS || rr >= ROWS ? T.GRASS : grid[rr][cc])
  g.fillStyle = '#9fcf84'
  g.fillRect(0, 0, c.width, c.height)
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = ['rgba(120,180,90,.18)', 'rgba(190,220,130,.16)', 'rgba(90,150,90,.12)', 'rgba(220,235,160,.12)'][i % 4]
    g.beginPath(); g.arc(rand() * c.width, rand() * c.height, P * (0.4 + rand() * 1.8), 0, 7); g.fill()
  }
  for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) {
    const t = grid[r][q], x = q * P, y = r * P
    if (t === T.GRASS) {
      if (layout.forest[r][q]) { g.fillStyle = 'rgba(60,110,60,.22)'; g.beginPath(); g.arc(x + P / 2, y + P / 2, P * 0.9, 0, 7); g.fill() }
      const nearWater = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(q + dx, r + dy) === T.WATER)
      if (nearWater) { g.fillStyle = 'rgba(214,196,150,.85)'; g.fillRect(x, y, P, P) }
      continue
    }
    if (t === T.WATER || t === T.BRIDGE) continue
    const base = t === T.PLAZA ? '#efd7cc' : '#ead6b8'
    g.fillStyle = base; g.fillRect(x - 0.5, y - 0.5, P + 1, P + 1)
    // cobbles
    const n = 3
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = rand()
      g.fillStyle = t === T.PLAZA ? (v < 0.5 ? '#e7c8bd' : '#f3ded4') : (v < 0.5 ? '#dfc8a6' : '#f1e1c6')
      g.beginPath(); g.roundRect(x + (i * P) / n + 1.2, y + (j * P) / n + 1.2, P / n - 2.4, P / n - 2.4, P / 14); g.fill()
    }
    // soft kerb where the path meets grass
    g.fillStyle = 'rgba(120,96,70,.28)'
    if (at(q, r - 1) === T.GRASS) g.fillRect(x, y, P, P * 0.07)
    if (at(q, r + 1) === T.GRASS) g.fillRect(x, y + P * 0.93, P, P * 0.07)
    if (at(q - 1, r) === T.GRASS) g.fillRect(x, y, P * 0.07, P)
    if (at(q + 1, r) === T.GRASS) g.fillRect(x + P * 0.93, y, P * 0.07, P)
  }
  // cut the water out with overlapping circles so river banks and the lake shore are rounded
  g.globalCompositeOperation = 'destination-out'
  g.fillStyle = '#000'
  for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) {
    const t = grid[r][q]
    if (t !== T.WATER && t !== T.BRIDGE) continue
    g.beginPath(); g.arc(q * P + P / 2, r * P + P / 2, P * 0.78, 0, 7); g.fill()
  }
  g.globalCompositeOperation = 'source-over'
  // a heart mosaic in the plaza
  g.fillStyle = 'rgba(232,98,124,.55)'
  g.font = `${P * 2.2}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText('♥', 35.5 * P + P / 2, 26 * P)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

function waterNormals() {
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')
  const img = g.createImageData(S, S)
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const a = (x / S) * Math.PI * 2, b = (y / S) * Math.PI * 2
    const nx = Math.sin(a * 3 + Math.sin(b * 2)) * 0.5 + Math.sin(a * 7 + b * 5) * 0.25
    const ny = Math.cos(b * 3 + Math.sin(a * 2)) * 0.5 + Math.cos(b * 6 - a * 4) * 0.25
    const i = (y * S + x) * 4
    img.data[i] = 128 + nx * 90; img.data[i + 1] = 128 + ny * 90; img.data[i + 2] = 255; img.data[i + 3] = 255
  }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(24, 16)
  return t
}

function labelTexture(text) {
  const c = document.createElement('canvas')
  c.width = 1024; c.height = 128
  const g = c.getContext('2d')
  g.font = '600 46px Inter, sans-serif'
  const w = Math.min(1000, g.measureText(text).width + 64)
  g.fillStyle = 'rgba(255,250,244,.94)'
  g.beginPath(); g.roundRect((1024 - w) / 2, 18, w, 84, 42); g.fill()
  g.strokeStyle = 'rgba(196,87,74,.6)'; g.lineWidth = 4; g.stroke()
  g.fillStyle = '#5b2c3f'; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(text, 512, 62)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// soft round glow used for fireflies, lamp halos and lantern light
function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  r.addColorStop(0, 'rgba(255,255,255,1)')
  r.addColorStop(0.25, 'rgba(255,255,255,.55)')
  r.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = r; g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

// a little paper sky-lantern with a heart on it
function lanternTexture() {
  const c = document.createElement('canvas')
  c.width = 64; c.height = 96
  const g = c.getContext('2d')
  const halo = g.createRadialGradient(32, 50, 4, 32, 50, 46)
  halo.addColorStop(0, 'rgba(255,190,120,.55)'); halo.addColorStop(1, 'rgba(255,150,120,0)')
  g.fillStyle = halo; g.fillRect(0, 0, 64, 96)
  const body = g.createLinearGradient(0, 22, 0, 78)
  body.addColorStop(0, '#ffd9a0'); body.addColorStop(0.6, '#ffb070'); body.addColorStop(1, '#ff8a6a')
  g.fillStyle = body
  g.beginPath(); g.moveTo(18, 24); g.lineTo(46, 24); g.quadraticCurveTo(52, 52, 44, 76); g.lineTo(20, 76); g.quadraticCurveTo(12, 52, 18, 24); g.fill()
  g.fillStyle = 'rgba(232,70,110,.85)'
  g.font = '22px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText('\u2665', 32, 52)
  g.fillStyle = '#fff3c4'; g.beginPath(); g.ellipse(32, 78, 7, 3, 0, 0, 7); g.fill()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function buildTown3D(layout, { mobile = false, names = {} } = {}) {
  const scene = new THREE.Scene()
  const rand = rng(5)

  // ---- sky, stars, fog ----
  const sky = new Sky()
  sky.scale.setScalar(900)
  Object.assign(sky.material.uniforms, {})
  sky.material.uniforms.turbidity.value = 5
  sky.material.uniforms.rayleigh.value = 1.4
  sky.material.uniforms.mieCoefficient.value = 0.004
  sky.material.uniforms.mieDirectionalG.value = 0.82
  scene.add(sky)
  const starGeo = new THREE.BufferGeometry()
  const sp = new Float32Array(1500 * 3)
  for (let i = 0; i < 1500; i++) {
    const th = rand() * Math.PI * 2, ph = Math.acos(rand() * 0.95)
    sp[i * 3] = Math.sin(ph) * Math.cos(th) * 700; sp[i * 3 + 1] = Math.cos(ph) * 700; sp[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * 700
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3))
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#fff6e8', size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }))
  scene.add(stars)
  scene.fog = new THREE.Fog('#cfe6f2', 70, 260)

  // ---- lights ----
  const hemi = new THREE.HemisphereLight('#e3f2ff', '#9bbf86', 0.75)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight('#fff1dc', 2.2)
  sun.castShadow = true
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048)
  const sc = sun.shadow.camera
  sc.left = -38; sc.right = 38; sc.top = 38; sc.bottom = -38; sc.near = 1; sc.far = 160
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.03
  scene.add(sun, sun.target)
  const pool = Array.from({ length: mobile ? 4 : 7 }, () => { const l = new THREE.PointLight('#ffcf8a', 0, 15, 1.6); scene.add(l); return l })

  // ---- ground + water + outer meadow ----
  const meadow = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshStandardMaterial({ color: '#8fbf74', roughness: 1 }))
  meadow.rotation.x = -Math.PI / 2; meadow.position.y = -0.6; meadow.receiveShadow = true
  scene.add(meadow)
  const wn = waterNormals()
  const water = new THREE.Mesh(new THREE.PlaneGeometry(W_M, H_M), new THREE.MeshStandardMaterial({ color: '#3a8fbf', roughness: 0.12, metalness: 0.05, normalMap: wn, normalScale: new THREE.Vector2(0.45, 0.45) }))
  water.rotation.x = -Math.PI / 2; water.position.y = -0.12; water.receiveShadow = true
  scene.add(water)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W_M, H_M), new THREE.MeshStandardMaterial({ map: groundTexture(layout, mobile), alphaTest: 0.5, roughness: 0.95 }))
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true
  scene.add(ground)

  // ---- buildings, door rings, labels ----
  const labels = []
  const rings = []
  const ringMat = new THREE.MeshStandardMaterial({ color: '#ff9fb2', emissive: '#e8627c', emissiveIntensity: 0.6, transparent: true, opacity: 0.85 })
  for (const b of BUILDINGS) {
    const { group, height, depth } = makeBuilding(b.kind, b.w, b.h, b.label)
    group.position.set(X((b.col + b.w / 2) * TS), 0, Z((b.row + b.h) * TS) - 0.6)
    scene.add(group)
    const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(names[b.id] ?? b.label), depthTest: false, transparent: true, sizeAttenuation: false }))
    lab.scale.set(0.4, 0.05, 1)
    lab.position.set(group.position.x, height + 1.6, group.position.z - depth / 2)
    lab.renderOrder = 10
    scene.add(lab)
    labels.push({ id: b.id, sprite: lab })
  }
  for (const p of layout.places) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.07, 8, 40), ringMat)
    r.rotation.x = -Math.PI / 2
    r.position.set(X(p.x), 0.06, Z(p.y))
    scene.add(r)
    rings.push({ id: p.id, mesh: r })
  }

  // ---- trees (instanced): trunk + clustered canopy ----
  const trunkGeo = new THREE.CylinderGeometry(0.13, 0.2, 1.7, 7); trunkGeo.translate(0, 0.85, 0)
  const blobs = [[0, 2.4, 0, 1.15], [0.65, 2.05, 0.2, 0.8], [-0.6, 2.1, -0.15, 0.85], [0.1, 2.95, -0.2, 0.75], [-0.15, 2.0, 0.6, 0.7]]
  const canopyGeo = mergeGeometries(blobs.map(([x, y, z, r]) => { const s = new THREE.IcosahedronGeometry(r, 1); s.translate(x, y, z); return s }))
  const trees = layout.trees
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: '#86593f', roughness: 0.9 }), trees.length)
  const pinkT = trees.filter((t) => t.pink), greenT = trees.filter((t) => !t.pink)
  const canopy = (list, color) => {
    const m = new THREE.InstancedMesh(canopyGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, flatShading: true }), list.length)
    const base = new THREE.Color(color)
    list.forEach((t, i) => {
      m.setColorAt(i, base.clone().offsetHSL((rand() - 0.5) * 0.04, (rand() - 0.5) * 0.1, (rand() - 0.5) * 0.08))
    })
    return m
  }
  const pinkM = canopy(pinkT, '#f4a9c0'), greenM = canopy(greenT, '#7fbf78')
  const dummy = new THREE.Object3D()
  const place = (t) => { dummy.position.set(X((t.c + 0.5 + t.jx * 0.3) * TS), 0, Z((t.r + 0.5 + t.jy * 0.3) * TS)); dummy.rotation.set(0, t.rot, 0); dummy.scale.setScalar(t.s * 1.25); dummy.updateMatrix() }
  trees.forEach((t, i) => { place(t); trunks.setMatrixAt(i, dummy.matrix) })
  pinkT.forEach((t, i) => { place(t); pinkM.setMatrixAt(i, dummy.matrix) })
  greenT.forEach((t, i) => { place(t); greenM.setMatrixAt(i, dummy.matrix) })
  for (const m of [trunks, pinkM, greenM]) { m.castShadow = true; m.receiveShadow = true; scene.add(m) }

  // ---- flowers + grass tufts ----
  const fl = layout.flowers
  const petalGeo = mergeGeometries([...Array(5)].map((_, i) => { const a = (i / 5) * Math.PI * 2; const p = new THREE.SphereGeometry(0.075, 8, 6); p.scale(1, 0.3, 0.62); p.rotateY(-a); p.translate(Math.cos(a) * 0.085, 0, Math.sin(a) * 0.085); return p }).concat([new THREE.SphereGeometry(0.045, 8, 6)]))
  const flowerM = new THREE.InstancedMesh(petalGeo, new THREE.MeshStandardMaterial({ color: '#fff', roughness: 0.55 }), fl.length)
  const stemGeo = new THREE.CylinderGeometry(0.012, 0.014, 0.3, 4); stemGeo.translate(0, 0.15, 0)
  const stems = new THREE.InstancedMesh(stemGeo, new THREE.MeshStandardMaterial({ color: '#5d9b4c', roughness: 1 }), fl.length)
  const fcols = ['#f490a8', '#ffffff', '#ffe27a', '#d9b8f4', '#ff9a7a'].map((c) => new THREE.Color(c))
  fl.forEach((f, i) => {
    const sc = 0.9 + rand() * 0.7
    dummy.position.set(X(f.x), 0, Z(f.y)); dummy.rotation.set(0, rand() * 6, 0); dummy.scale.setScalar(sc); dummy.updateMatrix(); stems.setMatrixAt(i, dummy.matrix)
    dummy.position.y = 0.3 * sc; dummy.rotation.set((rand() - 0.5) * 0.5, rand() * 6, (rand() - 0.5) * 0.5); dummy.updateMatrix()
    flowerM.setMatrixAt(i, dummy.matrix); flowerM.setColorAt(i, fcols[f.k])
  })
  scene.add(flowerM, stems)
  const tufts = []
  for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) if (layout.grid[r][q] === T.GRASS && !layout.solid[r][q]) for (let k = 0; k < (mobile ? 2 : 4); k++) tufts.push([(q + rand()) * 2 - COLS, (r + rand()) * 2 - ROWS])
  const tuftGeo = new THREE.ConeGeometry(0.06, 0.34, 3); tuftGeo.translate(0, 0.17, 0)
  const tuftM = new THREE.InstancedMesh(tuftGeo, new THREE.MeshStandardMaterial({ color: '#6fae5c', roughness: 1 }), tufts.length)
  tufts.forEach(([x, z], i) => { dummy.position.set(x, 0, z); dummy.rotation.set((rand() - 0.5) * 0.4, rand() * 6, (rand() - 0.5) * 0.4); dummy.scale.set(1, 0.7 + rand() * 0.8, 1); dummy.updateMatrix(); tuftM.setMatrixAt(i, dummy.matrix) })
  scene.add(tuftM)

  // ---- street lamps ----
  const poleGeo = new THREE.CylinderGeometry(0.07, 0.1, 3.4, 8); poleGeo.translate(0, 1.7, 0)
  const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshStandardMaterial({ color: '#4d3a44', roughness: 0.4, metalness: 0.5 }), layout.lamps.length)
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.24, 14, 10), glowMats.bulb, layout.lamps.length)
  const lampPos = layout.lamps.map((l) => new THREE.Vector3(X(l.x), 3.5, Z(l.y)))
  lampPos.forEach((p, i) => {
    dummy.position.set(p.x, 0, p.z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); poles.setMatrixAt(i, dummy.matrix)
    dummy.position.set(p.x, 3.5, p.z); dummy.updateMatrix(); heads.setMatrixAt(i, dummy.matrix)
  })
  poles.castShadow = true
  scene.add(poles, heads)
  // warm halos around each lamp head that fade in at night
  const glowTex = glowTexture()
  const haloMat = new THREE.SpriteMaterial({ map: glowTex, color: '#ffc37a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
  for (const p of lampPos) {
    const h = new THREE.Sprite(haloMat)
    h.position.copy(p); h.scale.setScalar(2.6)
    scene.add(h)
  }
  const lightSpots = [...lampPos, ...layout.places.map((p) => new THREE.Vector3(X(p.x), 2.6, Z(p.y) - 0.8))]

  // ---- bridges ----
  const wood = new THREE.MeshStandardMaterial({ color: '#b98a5e', roughness: 0.75 })
  const darkWood = new THREE.MeshStandardMaterial({ color: '#7a5538', roughness: 0.8 })
  for (const r0 of [22, 36]) {
    const cols = []
    for (let q = 0; q < COLS; q++) if (layout.grid[r0][q] === T.BRIDGE) cols.push(q)
    if (!cols.length) continue
    const x0 = Math.min(...cols) * 2 - COLS - 0.6, x1 = (Math.max(...cols) + 1) * 2 - COLS + 0.6
    const len = x1 - x0, cx = (x0 + x1) / 2, cz = (r0 + 1) * 2 - ROWS
    const deck = new THREE.Mesh(new THREE.BoxGeometry(len, 0.18, 4.2), wood); deck.position.set(cx, 0.05, cz)
    deck.castShadow = deck.receiveShadow = true
    scene.add(deck)
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.14), darkWood); rail.position.set(cx, 0.95, cz + side * 2)
      scene.add(rail)
      for (let k = 0; k <= 4; k++) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1, 0.16), darkWood); post.position.set(x0 + (k * len) / 4, 0.5, cz + side * 2); post.castShadow = true; scene.add(post) }
    }
  }

  // ---- fountain with a little spray ----
  const stone = new THREE.MeshStandardMaterial({ color: '#efe6e0', roughness: 0.7 })
  const fx = X(36 * TS), fz = Z(23 * TS)
  const fount = new THREE.Group()
  fount.position.set(fx, 0, fz)
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.95, 0.55, 32), stone); basin.position.y = 0.27
  const pool2 = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.05, 32), water.material); pool2.position.y = 0.5
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.5, 16), stone); pillar.position.y = 1.1
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.4, 0.25, 24), stone); bowl.position.y = 1.85
  const fheart = new THREE.Mesh(new THREE.ExtrudeGeometry(heartShape(0.5), { depth: 0.12, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03 }), new THREE.MeshStandardMaterial({ color: '#f07a96', roughness: 0.35, emissive: '#e8627c', emissiveIntensity: 0.25 }))
  fheart.position.y = 2.45
  fount.add(basin, pool2, pillar, bowl, fheart)
  fount.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
  scene.add(fount)
  const NS = 260
  const spray = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: '#dff4ff', size: 0.09, transparent: true, opacity: 0.85, depthWrite: false }))
  spray.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NS * 3), 3))
  spray.position.set(fx, 1.95, fz)
  const sprayP = Array.from({ length: NS }, () => ({ a: rand() * 6.28, t: rand(), v: 0.6 + rand() * 0.5 }))
  scene.add(spray)

  // ---- park bench + picnic blanket ----
  const bench = new THREE.Group()
  bench.position.set(X(29 * TS), 0, Z(31.6 * TS))
  for (const [w, h, d, x, y, z, m] of [[2.4, 0.12, 0.6, 0, 0.55, 0, wood], [2.4, 0.5, 0.1, 0, 0.95, 0.28, wood], [0.1, 0.55, 0.5, -1, 0.27, 0, darkWood], [0.1, 0.55, 0.5, 1, 0.27, 0, darkWood]]) {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; bench.add(o)
  }
  scene.add(bench)
  const ging = document.createElement('canvas'); ging.width = ging.height = 128
  const gg = ging.getContext('2d'); gg.fillStyle = '#fff'; gg.fillRect(0, 0, 128, 128); gg.fillStyle = 'rgba(232,98,124,.55)'
  for (let i = 0; i < 8; i++) { gg.fillRect(i * 16, 0, 8, 128); gg.fillRect(0, i * 16, 128, 8) }
  const gtex = new THREE.CanvasTexture(ging); gtex.colorSpace = THREE.SRGBColorSpace
  const blanket = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 3.6), new THREE.MeshStandardMaterial({ map: gtex, roughness: 0.9 }))
  blanket.rotation.x = -Math.PI / 2; blanket.rotation.z = 0.15; blanket.position.set(X(21.5 * TS), 0.03, Z(32 * TS)); blanket.receiveShadow = true
  scene.add(blanket)

  // ---- collectible hearts ----
  const heartGeo = new THREE.ExtrudeGeometry(heartShape(0.55), { depth: 0.16, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 3 })
  heartGeo.center()
  const heartMat = new THREE.MeshStandardMaterial({ color: '#ff5f86', emissive: '#ff2f63', emissiveIntensity: 0.55, roughness: 0.25, metalness: 0.1 })
  const hearts = layout.hearts.map((h) => {
    const m = new THREE.Mesh(heartGeo, heartMat)
    m.position.set(X(h.x), 1.1, Z(h.y)); m.castShadow = true
    scene.add(m)
    return { id: h.id, mesh: m, gone: 0 }
  })

  // ---- petals drifting in the air around the camera ----
  const pc = document.createElement('canvas'); pc.width = pc.height = 64
  const pg = pc.getContext('2d'); pg.fillStyle = '#ffd0dc'; pg.beginPath(); pg.ellipse(32, 32, 26, 14, 0.5, 0, 7); pg.fill()
  const ptex = new THREE.CanvasTexture(pc)
  const NP = mobile ? 120 : 240
  const petals = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: ptex, size: 0.32, transparent: true, depthWrite: false, opacity: 0.9 }))
  const pp = new Float32Array(NP * 3)
  for (let i = 0; i < NP; i++) { pp[i * 3] = (rand() - 0.5) * 60; pp[i * 3 + 1] = rand() * 14; pp[i * 3 + 2] = (rand() - 0.5) * 60 }
  petals.geometry.setAttribute('position', new THREE.BufferAttribute(pp, 3))
  scene.add(petals)

  // ---- fireflies: wander low over the grass, glow at dusk and night ----
  const NF = mobile ? 70 : 160
  const ffMat = new THREE.PointsMaterial({ map: glowTex, color: '#fff27a', size: 0.55, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
  const fireflies = new THREE.Points(new THREE.BufferGeometry(), ffMat)
  const ffP = Array.from({ length: NF }, () => ({ x: (rand() - 0.5) * 70, y: 0.4 + rand() * 2.6, z: (rand() - 0.5) * 70, ph: rand() * 6.28, sp: 0.4 + rand() * 0.8 }))
  fireflies.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NF * 3), 3))
  fireflies.frustumCulled = false
  scene.add(fireflies)

  // ---- heart sky-lanterns drifting up into the sky ----
  const NL = mobile ? 14 : 28
  const lanternMat = new THREE.SpriteMaterial({ map: lanternTexture(), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false })
  const spawnLantern = (l, center, fresh) => {
    l.x = center.x + (rand() - 0.5) * 50; l.z = center.z + (rand() - 0.5) * 50
    l.y = fresh ? 3 + rand() * 30 : 2 + rand() * 3
    l.v = 0.35 + rand() * 0.45; l.ph = rand() * 6.28
  }
  const lanterns = Array.from({ length: NL }, () => {
    const sp = new THREE.Sprite(lanternMat)
    sp.scale.set(1.4, 2.1, 1)
    scene.add(sp)
    const l = { sp }
    spawnLantern(l, { x: 0, z: 0 }, true)
    return l
  })

  // ---- per-frame animation of the world itself ----
  const update = (t, dt, center, night = 0, dusk = 0) => {
    const glow = Math.max(night, dusk * 0.6)
    haloMat.opacity = night * 0.85
    ffMat.opacity = glow * 0.95
    lanternMat.opacity = 0.25 + glow * 0.75
    if (ffMat.opacity > 0.01) {
      const f = fireflies.geometry.attributes.position
      for (let i = 0; i < NF; i++) {
        const p = ffP[i]
        // keep the swarm around her
        if (p.x - center.x > 35) p.x -= 70; else if (p.x - center.x < -35) p.x += 70
        if (p.z - center.z > 35) p.z -= 70; else if (p.z - center.z < -35) p.z += 70
        f.array[i * 3] = p.x + Math.sin(t * p.sp + p.ph) * 0.9
        f.array[i * 3 + 1] = p.y + Math.sin(t * p.sp * 1.7 + p.ph) * 0.35
        f.array[i * 3 + 2] = p.z + Math.cos(t * p.sp * 0.8 + p.ph) * 0.9
      }
      f.needsUpdate = true
      ffMat.size = 0.4 + Math.sin(t * 3) * 0.08
    }
    for (const l of lanterns) {
      l.y += dt * l.v
      if (l.y > 40) spawnLantern(l, center, false)
      l.sp.position.set(l.x + Math.sin(t * 0.4 + l.ph) * 1.2, l.y, l.z + Math.cos(t * 0.3 + l.ph) * 1.2)
    }
    wn.offset.x = t * 0.012; wn.offset.y = t * 0.008
    for (const r of rings) r.mesh.scale.setScalar(1 + Math.sin(t * 3 + r.mesh.position.x) * 0.08)
    for (const h of hearts) {
      if (h.gone > 0) { h.gone += dt; const k = Math.max(0, 1 - h.gone * 2); h.mesh.scale.setScalar(k * 1.6 + 0.001); h.mesh.position.y += dt * 3; if (k <= 0) h.mesh.visible = false; continue }
      h.mesh.rotation.y = t * 1.6 + h.id
      h.mesh.position.y = 1.1 + Math.sin(t * 2.2 + h.id) * 0.18
    }
    const a = spray.geometry.attributes.position
    sprayP.forEach((s, i) => {
      s.t += dt * s.v
      if (s.t > 1) { s.t -= 1; s.a = Math.random() * 6.28 }
      const r = s.t * 1.4
      a.array[i * 3] = Math.cos(s.a) * r; a.array[i * 3 + 1] = 0.6 * s.t * 4 * (1 - s.t) - s.t * 1.3; a.array[i * 3 + 2] = Math.sin(s.a) * r
    })
    a.needsUpdate = true
    const q = petals.geometry.attributes.position
    for (let i = 0; i < NP; i++) {
      q.array[i * 3 + 1] -= dt * 0.6
      q.array[i * 3] += Math.sin(t + i) * dt * 0.4
      if (q.array[i * 3 + 1] < 0) { q.array[i * 3 + 1] = 12 + Math.random() * 3; q.array[i * 3] = center.x + (Math.random() - 0.5) * 60; q.array[i * 3 + 2] = center.z + (Math.random() - 0.5) * 60 }
    }
    q.needsUpdate = true
  }

  return { scene, sky, stars, sun, hemi, pool, lightSpots, labels, rings, hearts, update, bridgeRows: [22, 23, 36, 37] }
}
