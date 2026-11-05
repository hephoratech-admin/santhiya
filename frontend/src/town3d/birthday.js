// Birthday party for the 3D town: cake, balloons, bunting, banner, guests and a little show.
// Turned on by isBirthday() in ../birthday-date.js.
import * as THREE from 'three'
import { batchAnimated, batchArchitecture, batchBillboards } from './batching.js'
import { makeChibi } from './chibi.js'
import { heartShape } from './buildings.js'
import { X, Z } from './scene.js'
import { OPTIONS } from '../game/avatar.js'
import { TS } from '../game/layout.js'
import { LINE_TIMES, SONG_END } from './birthdayMusic.js'

export { isBirthday } from '../birthday-date.js'

// timeline of the celebration (seconds after she makes her wish)
// follows the music in birthdayMusic.js: four song lines, then the wish, then the candles go out
export const SHOW = { song: LINE_TIMES, wish: SONG_END + 0.4, blow: SONG_END + 3, end: SONG_END + 8.4 }

function rng(seed) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
}
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra })

function glowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64
  const g = c.getContext('2d')
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,.6)'); r.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = r; g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

function bannerTex(text) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 220
  const g = c.getContext('2d')
  const grad = g.createLinearGradient(0, 0, 1024, 0)
  grad.addColorStop(0, '#ff8fab'); grad.addColorStop(0.5, '#ffb3c7'); grad.addColorStop(1, '#ff8fab')
  g.fillStyle = grad; g.beginPath(); g.roundRect(6, 6, 1012, 208, 40); g.fill()
  g.strokeStyle = '#fff'; g.lineWidth = 8; g.setLineDash([22, 14]); g.beginPath(); g.roundRect(22, 22, 980, 176, 30); g.stroke()
  g.setLineDash([])
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.shadowColor = 'rgba(160,40,80,.55)'; g.shadowBlur = 10; g.shadowOffsetY = 4
  g.font = '700 84px "Great Vibes", "Dancing Script", cursive'
  g.fillText(text, 512, 112)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  return t
}

function hatTex(a, b) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64
  const g = c.getContext('2d')
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? a : b; g.fillRect(i * 8, 0, 8, 64) }
  g.fillStyle = '#fff'; for (let i = 0; i < 10; i++) { g.beginPath(); g.arc((i * 23) % 64, (i * 37) % 64, 2.5, 0, 7); g.fill() }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping
  return t
}

const BALLOON = ['#ff6f91', '#ffd166', '#ffffff', '#c9a8e8', '#ff9a7a', '#7fd1b9', '#f4a6b8']
const PARTY = ['#ff6f91', '#ffd166', '#7fd1b9', '#c9a8e8', '#ff9a7a', '#8ec5ff']

export function buildBirthday(scene, layout, { mobile = false, name = 'You' } = {}) {
  const excluded = new Set(); scene.traverse(o => excluded.add(o))
  const rand = rng(1311)
  const pick = (a) => a[(rand() * a.length) | 0]
  const anim = [] // per-frame callbacks
  const shadows = !mobile

  // the party sits in the middle of the park
  const cakePx = { x: 26 * TS, y: 29 * TS }
  const cx = X(cakePx.x), cz = Z(cakePx.y)
  const glow = glowTex()

  // ---- table + cake ----
  const party = new THREE.Group(); party.position.set(cx, 0, cz); scene.add(party)
  const add = (geo, m, x, y, z, parent = party) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = shadows; o.receiveShadow = true; parent.add(o); return o }
  add(new THREE.CylinderGeometry(1.15, 1.15, 0.06, 40), std('#fffaf4'), 0, 0.78, 0)
  add(new THREE.CylinderGeometry(1.2, 1.3, 0.7, 40, 1, true), std('#ffd6e0', { side: THREE.DoubleSide }), 0, 0.42, 0)
  add(new THREE.CylinderGeometry(0.12, 0.2, 0.75, 12), std('#b98a5e'), 0, 0.37, 0)
  add(new THREE.CylinderGeometry(0.62, 0.62, 0.04, 40), std('#ffffff', { roughness: 0.25, metalness: 0.3 }), 0, 0.83, 0)
  const tiers = [[0.55, 0.32, '#ffc2d1'], [0.42, 0.28, '#fff1e6'], [0.3, 0.24, '#ff9fb6']]
  let y = 0.85
  const sprinkle = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.012, 0.03, 2, 4), new THREE.MeshStandardMaterial({ roughness: 0.4 }), 140)
  let si = 0
  const dm = new THREE.Object3D()
  for (const [r, h, col] of tiers) {
    add(new THREE.CylinderGeometry(r, r, h, 40), std(col, { roughness: 0.45 }), 0, y + h / 2, 0)
    const drip = add(new THREE.TorusGeometry(r, 0.035, 8, 40), std('#ffffff', { roughness: 0.3 }), 0, y + h, 0); drip.rotation.x = Math.PI / 2
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2
      const d = add(new THREE.SphereGeometry(0.035, 8, 6), drip.material, Math.cos(a) * r, y + h - 0.05 - (k % 3) * 0.025, Math.sin(a) * r); d.scale.set(1, 1.8, 1)
    }
    for (let k = 0; k < 40 && si < 140; k++, si++) {
      const a = rand() * Math.PI * 2
      dm.position.set(Math.cos(a) * r * 1.01, y + 0.04 + rand() * (h - 0.08), Math.sin(a) * r * 1.01); dm.rotation.set(rand() * 6, rand() * 6, rand() * 6); dm.updateMatrix()
      sprinkle.setMatrixAt(si, dm.matrix); sprinkle.setColorAt(si, new THREE.Color(pick(PARTY)))
    }
    y += h
  }
  sprinkle.count = si
  party.add(sprinkle)
  const topY = y
  const heart = add(new THREE.ExtrudeGeometry(heartShape(0.22), { depth: 0.05, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015 }), std('#e8627c', { emissive: '#ff2f63', emissiveIntensity: 0.3, roughness: 0.3 }), 0, topY + 0.32, -0.05)
  heart.geometry.center()

  // candles with flickering flames
  const flames = []
  const flameMat = new THREE.SpriteMaterial({ map: glow, color: '#ffc861', blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, transparent: true })
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.3
    const x = Math.cos(a) * 0.19, z = Math.sin(a) * 0.19
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 8), std(PARTY[k % PARTY.length]), x, topY + 0.09, z)
    const f = new THREE.Sprite(flameMat); f.position.set(x, topY + 0.23, z); f.scale.set(0.12, 0.2, 1)
    party.add(f)
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff6c8', toneMapped: false }))
    core.position.set(x, topY + 0.22, z); core.scale.set(1, 1.7, 1)
    party.add(core)
    flames.push({ f, core, ph: rand() * 6 })
  }
  const candleLight = new THREE.PointLight('#ffb766', 3, 7, 1.6); candleLight.position.set(0, topY + 0.5, 0); party.add(candleLight)
  let lit = 1

  // gifts around the table
  for (let k = 0; k < 6; k++) {
    const a = 0.8 + k * 0.85, r = 1.65 + rand() * 0.3, s = 0.28 + rand() * 0.2
    const box = add(new THREE.BoxGeometry(s, s * 0.85, s), std(pick(PARTY), { roughness: 0.5 }), Math.cos(a) * r, s * 0.42, Math.sin(a) * r)
    box.rotation.y = rand() * 3
    const rib = std('#ffffff', { roughness: 0.4 })
    add(new THREE.BoxGeometry(s * 1.02, s * 0.87, s * 0.18), rib, 0, 0, 0, box)
    add(new THREE.BoxGeometry(s * 0.18, s * 0.87, s * 1.02), rib, 0, 0, 0, box)
    const bow = add(new THREE.TorusGeometry(s * 0.16, s * 0.05, 6, 14), rib, 0, s * 0.48, 0, box); bow.rotation.y = 0.7
  }

  // a soft light pillar over the cake so she can spot the party from far away
  const beaconMat = new THREE.MeshBasicMaterial({ color: '#ffb3c7', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.6, 40, 24, 1, true), beaconMat)
  beacon.position.set(cx, 20, cz); scene.add(beacon)

  // ---- banner on two poles at the north edge of the party ----
  const bz = cz - 5.2
  const poleMat = std('#fff3f6', { roughness: 0.4 })
  for (const sx of [-3.8, 3.8]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.2, 10), poleMat); pole.position.set(cx + sx, 2.1, bz); pole.castShadow = shadows; scene.add(pole)
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), std('#ffd166', { metalness: 0.4, roughness: 0.3 })); knob.position.set(cx + sx, 4.25, bz); scene.add(knob)
  }
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 1.55, 24, 1), new THREE.MeshStandardMaterial({ map: bannerTex(`Happy Birthday ${name}!`), side: THREE.DoubleSide, roughness: 0.8 }))
  banner.position.set(cx, 3.35, bz); scene.add(banner)
  const bpos = banner.geometry.attributes.position, bx0 = Float32Array.from(bpos.array)
  anim.push((t) => { for (let i = 0; i < bpos.count; i++) bpos.array[i * 3 + 2] = bx0[i * 3 + 2] + Math.sin(t * 2.2 + bx0[i * 3] * 0.9) * 0.08; bpos.needsUpdate = true })

  // ---- balloons ----
  const balloonGeo = new THREE.SphereGeometry(0.34, mobile ? 12 : 20, mobile ? 8 : 16); balloonGeo.scale(1, 1.18, 1)
  const knotGeo = new THREE.ConeGeometry(0.06, 0.09, 8); knotGeo.rotateX(Math.PI)
  const heartGeo = new THREE.ExtrudeGeometry(heartShape(0.62), { depth: 0.16, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: mobile ? 1 : 3, curveSegments: mobile ? 6 : 12 }); heartGeo.center()
  const stringMat = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 })
  const balloons = []
  const cluster = (x, z, n, h0 = 2.4) => {
    for (let k = 0; k < n; k++) {
      const col = pick(BALLOON)
      const isHeart = rand() < 0.25
      const m = new THREE.Mesh(isHeart ? heartGeo : balloonGeo, std(col, { roughness: 0.22, metalness: 0.08, emissive: col, emissiveIntensity: 0.06 }))
      m.castShadow = shadows
      const knot = new THREE.Mesh(knotGeo, m.material); knot.position.y = isHeart ? -0.42 : -0.42; m.add(knot)
      const off = { x: (rand() - 0.5) * 0.9, z: (rand() - 0.5) * 0.9, h: h0 + rand() * 1.1 }
      scene.add(m)
      balloons.push({ m, x, z, off, ph: rand() * 6, heart: isHeart })
    }
  }
  // around the table, on the banner poles, around the plaza and along the main road
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.4; cluster(cx + Math.cos(a) * 1.4, cz + Math.sin(a) * 1.4, 1, 1.9) }
  cluster(cx - 3.8, bz, 4, 4.2); cluster(cx + 3.8, bz, 4, 4.2)
  const fx = X(36 * TS), fz = Z(23 * TS)
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; cluster(fx + Math.cos(a) * 3.2, fz + Math.sin(a) * 3.2, mobile ? 2 : 3, 1.8) }
  const nearLamps = layout.lamps.map((l) => ({ x: X(l.x), z: Z(l.y) })).filter((l) => Math.hypot(l.x - fx, l.z - fz) < 34 || Math.hypot(l.x - cx, l.z - cz) < 22)
  for (const l of nearLamps) cluster(l.x + 0.3, l.z, 2, 3.2)
  const stringGeometry = new THREE.BufferGeometry()
  stringGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(balloons.length * 6), 3))
  const strings = new THREE.LineSegments(stringGeometry, stringMat); strings.frustumCulled = false; scene.add(strings)
  anim.push((t) => {
    for (let i = 0; i < balloons.length; i++) {
      const b = balloons[i]
      const sx = b.x + b.off.x + Math.sin(t * 0.9 + b.ph) * 0.18, sz = b.z + b.off.z + Math.cos(t * 0.7 + b.ph) * 0.18
      const sy = b.off.h + Math.sin(t * 1.3 + b.ph) * 0.12
      b.m.position.set(sx, sy, sz)
      b.m.rotation.set(Math.sin(t + b.ph) * 0.12, b.heart ? Math.sin(t * 0.6 + b.ph) * 0.6 : 0, Math.cos(t * 0.8 + b.ph) * 0.12)
      const a = stringGeometry.attributes.position
      a.setXYZ(i * 2, b.x, b.heart ? 0.9 : 0.8, b.z); a.setXYZ(i * 2 + 1, sx, sy - 0.45, sz)
    }
    stringGeometry.attributes.position.needsUpdate = true
  })

  // ---- bunting: little flags strung from lamp to lamp ----
  const lampTops = layout.lamps.map((l) => new THREE.Vector3(X(l.x), 3.3, Z(l.y)))
  const pairs = []
  lampTops.forEach((a, i) => {
    let best = -1, bd = 1e9
    lampTops.forEach((b, j) => { if (j === i) return; const d = a.distanceTo(b); if (d < bd && d > 3) { bd = d; best = j } })
    if (best >= 0 && bd < 18 && !pairs.some(([p, q]) => (p === best && q === i))) pairs.push([i, best])
  })
  const flagGeo = new THREE.BufferGeometry()
  flagGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.17, 0, 0, 0.17, 0, 0, 0, -0.38, 0]), 3))
  flagGeo.computeVertexNormals()
  const flagSpots = []
  const ropePts = []
  for (const [i, j] of pairs) {
    const A = lampTops[i], B = lampTops[j], len = A.distanceTo(B), n = Math.max(3, Math.floor(len / 0.65))
    const pt = (u) => new THREE.Vector3().lerpVectors(A, B, u).setY(A.y - Math.sin(u * Math.PI) * Math.min(1.1, len * 0.08))
    for (let k = 0; k < 16; k++) { ropePts.push(pt(k / 16), pt((k + 1) / 16)) }
    for (let k = 1; k < n; k++) flagSpots.push({ p: pt(k / n), yaw: Math.atan2(B.x - A.x, B.z - A.z) - Math.PI / 2 })
  }
  if (ropePts.length) scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ropePts), new THREE.LineBasicMaterial({ color: '#fff4f6' })))
  const flags = new THREE.InstancedMesh(flagGeo, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.7 }), Math.max(1, flagSpots.length))
  flagSpots.forEach((f, k) => { dm.position.copy(f.p); dm.rotation.set(0, f.yaw, 0); dm.scale.setScalar(1); dm.updateMatrix(); flags.setMatrixAt(k, dm.matrix); flags.setColorAt(k, new THREE.Color(PARTY[k % PARTY.length])) })
  flags.count = flagSpots.length
  scene.add(flags)

  // ---- gentle confetti always drifting over the party, plus a big burst when the candles go out ----
  const NC = mobile ? 260 : 600
  const cPos = new Float32Array(NC * 3), cCol = new Float32Array(NC * 3), cVel = new Float32Array(NC * 3)
  const cc = new THREE.Color()
  for (let i = 0; i < NC; i++) {
    cPos[i * 3] = cx + (rand() - 0.5) * 16; cPos[i * 3 + 1] = rand() * 8; cPos[i * 3 + 2] = cz + (rand() - 0.5) * 16
    cc.set(pick(PARTY)); cCol.set([cc.r, cc.g, cc.b], i * 3)
  }
  const confGeo = new THREE.BufferGeometry()
  confGeo.setAttribute('position', new THREE.BufferAttribute(cPos, 3)); confGeo.setAttribute('color', new THREE.BufferAttribute(cCol, 3))
  const confetti = new THREE.Points(confGeo, new THREE.PointsMaterial({ size: 0.13, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }))
  confetti.frustumCulled = false
  scene.add(confetti)
  let burst = 0
  anim.push((t, dt) => {
    burst = Math.max(0, burst - dt * 0.35)
    for (let i = 0; i < NC; i++) {
      const j = i * 3
      cVel[j + 1] -= dt * (burst > 0 ? 4 : 0.6)
      cVel[j] *= 0.98; cVel[j + 2] *= 0.98; cVel[j + 1] = Math.max(cVel[j + 1], -1.4)
      cPos[j] += (cVel[j] + Math.sin(t * 2 + i) * 0.25) * dt
      cPos[j + 1] += cVel[j + 1] * dt
      cPos[j + 2] += (cVel[j + 2] + Math.cos(t * 1.7 + i) * 0.25) * dt
      if (cPos[j + 1] < 0) { cPos[j] = cx + (Math.random() - 0.5) * 16; cPos[j + 1] = 7 + Math.random() * 3; cPos[j + 2] = cz + (Math.random() - 0.5) * 16; cVel[j] = cVel[j + 1] = cVel[j + 2] = 0 }
    }
    confGeo.attributes.position.needsUpdate = true
  })
  const popConfetti = () => {
    burst = 1
    for (let i = 0; i < NC; i++) {
      const j = i * 3, a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 5
      cPos[j] = cx; cPos[j + 1] = topY + 0.3; cPos[j + 2] = cz
      cVel[j] = Math.cos(a) * sp; cVel[j + 1] = 5 + Math.random() * 7; cVel[j + 2] = Math.sin(a) * sp
    }
  }

  // ---- fireworks in the sky (during the celebration) ----
  const NF = mobile ? 700 : 1400
  const fPos = new Float32Array(NF * 3), fCol = new Float32Array(NF * 3), fVel = new Float32Array(NF * 3), fLife = new Float32Array(NF)
  const fwGeo = new THREE.BufferGeometry()
  fwGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3)); fwGeo.setAttribute('color', new THREE.BufferAttribute(fCol, 3))
  const fireworks = new THREE.Points(fwGeo, new THREE.PointsMaterial({ map: glow, size: 0.9, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }))
  fireworks.frustumCulled = false
  scene.add(fireworks)
  let fNext = 0, fCursor = 0, fireUntil = 0
  const boom = () => {
    const ox = cx + (Math.random() - 0.5) * 26, oy = 13 + Math.random() * 9, oz = cz - 6 + (Math.random() - 0.5) * 18
    const col = new THREE.Color(pick(['#ff6f91', '#ffd166', '#ffffff', '#c9a8e8', '#7fd1b9', '#ff9fb6']))
    const n = 110, heartBurst = Math.random() < 0.5
    for (let k = 0; k < n; k++) {
      const i = fCursor; fCursor = (fCursor + 1) % NF
      const t = (k / n) * Math.PI * 2
      let vx, vy, vz
      if (heartBurst) { vx = 16 * Math.sin(t) ** 3 * 0.32; vy = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 0.32; vz = (Math.random() - 0.5) * 0.6 }
      else { const u = Math.random() * 2 - 1, ph = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u), sp = 4.5 + Math.random() * 1.5; vx = r * Math.cos(ph) * sp; vy = u * sp; vz = r * Math.sin(ph) * sp }
      fPos.set([ox, oy, oz], i * 3); fVel.set([vx, vy, vz], i * 3); fLife[i] = 1
      fCol.set([col.r, col.g, col.b], i * 3)
    }
  }
  anim.push((t, dt) => {
    if (t < fireUntil && t > fNext) { boom(); fNext = t + 0.45 + Math.random() * 0.6 }
    for (let i = 0; i < NF; i++) {
      if (fLife[i] <= 0) continue
      const j = i * 3
      fLife[i] -= dt * 0.55
      fVel[j + 1] -= dt * 2.2
      fVel[j] *= 0.985; fVel[j + 1] *= 0.985; fVel[j + 2] *= 0.985
      fPos[j] += fVel[j] * dt; fPos[j + 1] += fVel[j + 1] * dt; fPos[j + 2] += fVel[j + 2] * dt
      const k = Math.max(0, fLife[i])
      fCol[j] *= 0.995; fCol[j + 1] *= 0.995; fCol[j + 2] *= 0.995
      if (k <= 0) fPos[j + 1] = -999
    }
    fwGeo.attributes.position.needsUpdate = true; fwGeo.attributes.color.needsUpdate = true
  })

  // ---- guests: friends in party hats around the cake, and more strolling through town ----
  const randomLook = () => ({
    skin: pick(OPTIONS.skin), hairColor: pick(OPTIONS.hairColor), hair: pick(['long', 'braid', 'bun', 'short', 'boy', 'boy']),
    top: pick(OPTIONS.top), bottom: pick(OPTIONS.bottom), extra: pick(['none', 'none', 'glasses', 'flower', 'beard']),
  })
  const sharedHat = hatTex('#ffffff', '#a8a8a8')
  const addHat = (chibi) => {
    const a = pick(PARTY)
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.32, 16), new THREE.MeshStandardMaterial({ map: sharedHat, color: a, roughness: 0.6 }))
    hat.position.set(0.04, 0.33, 0); hat.rotation.z = -0.2
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), std('#ffffff')); pom.position.y = 0.17; hat.add(pom)
    chibi.head.add(hat)
  }
  const noShadow = (g) => g.traverse((o) => { if (o.isMesh) o.castShadow = false })
  const guests = []
  const NG = mobile ? 8 : 12
  for (let k = 0; k < NG; k++) {
    // a horseshoe around the table, open to the east where she walks in
    const a = Math.PI * 0.32 + (k / (NG - 1)) * Math.PI * 1.36
    const r = 2.7 + (k % 2) * 0.55
    const look = randomLook(), c = makeChibi(look, { simplified: true }); c.group.userData.actorColor = look.top; addHat(c)
    if (!shadows) noShadow(c.group)
    const gx = cx + Math.cos(a) * r, gz = cz + Math.sin(a) * r
    c.group.position.set(gx, 0, gz)
    c.group.rotation.y = Math.atan2(cx - gx, cz - gz)
    scene.add(c.group)
    guests.push({ c, x: gx, z: gz, base: c.group.rotation.y, ph: rand() * 6 })
  }
  const walkers = []
  const NW = mobile ? 3 : 7
  const spots = [...layout.places.map((p) => ({ x: p.x, y: p.y + 30 })), ...layout.parkSpots.filter((_, i) => i % 9 === 0)]
  for (let k = 0; k < NW; k++) {
    const look = randomLook(), c = makeChibi(look, { simplified: true }); c.group.userData.actorColor = look.top; addHat(c)
    noShadow(c.group)
    const s0 = pick(spots)
    scene.add(c.group)
    walkers.push({ c, x: s0.x, y: s0.y, face: 0, path: null, wait: rand() * 3, sp: 34 + rand() * 18 })
  }
  anim.push((t, dt) => {
    for (const w of walkers) {
      if (!w.path?.length) {
        w.wait -= dt
        if (w.wait <= 0) { const to = pick(spots); w.path = layout.findPath(w.x, w.y, to.x, to.y); w.wait = 1.5 + Math.random() * 4 }
        w.c.animate(dt, 0, t + w.sp)
      } else {
        const wp = w.path[0], dx = wp.x - w.x, dy = wp.y - w.y, d = Math.hypot(dx, dy)
        if (d < 4) w.path.shift()
        else { const st = Math.min(d, w.sp * dt); w.x += (dx / d) * st; w.y += (dy / d) * st; w.face += Math.atan2(Math.sin(Math.atan2(dx, dy) - w.face), Math.cos(Math.atan2(dx, dy) - w.face)) * Math.min(1, dt * 8) }
        w.c.animate(dt, 0.75, t)
      }
      w.c.group.position.set(X(w.x), 0, Z(w.y)); w.c.group.rotation.y = w.face
    }
  })

  const actors = [...guests.map(g => g.c), ...walkers.map(w => w.c)]
  scene.updateMatrixWorld(true)
  for (const flame of flames) { scene.attach(flame.core); scene.attach(flame.f) }
  const flameBatch = batchBillboards(scene, flames.map(fl => fl.f))
  const movingRoots = [...actors.map(c => c.group), ...balloons.map(b => b.m), ...flames.map(fl => fl.core)]
  for (const root of movingRoots) root.removeFromParent()
  excluded.add(heart)
  const disposeStatic = batchArchitecture(scene, excluded)
  const updateBatches = batchAnimated(scene, movingRoots, { coalesce: true })
  const proxy = new THREE.InstancedMesh(new THREE.CapsuleGeometry(.22, .55, 2, 5), new THREE.MeshBasicMaterial(), actors.length)
  proxy.frustumCulled = false; proxy.instanceMatrix.setUsage(THREE.DynamicDrawUsage); proxy.count = 0; scene.add(proxy)
  const proxyDummy = new THREE.Object3D(), actorColors = actors.map(c => new THREE.Color(c.group.userData.actorColor))
  const render = (camera, map) => {
    let n = 0
    for (let i = 0; i < actors.length; i++) {
      const root = actors[i].group
      root.visible = !map && root.position.distanceToSquared(camera.position) < 55 * 55
      if (!root.visible) {
        proxyDummy.position.copy(root.position); proxyDummy.position.y += .65; proxyDummy.updateMatrix()
        proxy.setMatrixAt(n, proxyDummy.matrix); proxy.setColorAt(n++, actorColors[i])
      }
    }
    proxy.count = n; proxy.visible = n > 0; proxy.instanceMatrix.needsUpdate = true
    if (proxy.instanceColor) proxy.instanceColor.needsUpdate = true
    updateBatches(); flameBatch.update()
  }

  // ---- the show ----
  let showT = -1, blown = false
  const start = (t) => { showT = t; blown = false; lit = 1; beaconMat.opacity = 0 }
  const reset = () => { showT = -1 }

  const update = (t, dt, her) => {
    for (const f of anim) f(t, dt)
    const e = showT >= 0 ? t - showT : -1
    if (e >= SHOW.blow && !blown) { blown = true; popConfetti(); fireUntil = t + 14; fNext = t }
    lit = blown ? Math.max(0, lit - dt * 3) : 1
    for (const fl of flames) {
      const flick = 0.85 + Math.sin(t * 17 + fl.ph) * 0.1 + Math.sin(t * 29 + fl.ph * 2) * 0.06
      fl.f.scale.set(0.12 * lit * flick, 0.22 * lit * flick, 1); fl.f.visible = lit > 0.02
      fl.core.scale.set(lit, 1.7 * lit, lit); fl.core.visible = lit > 0.02
    }
    candleLight.intensity = 3 * lit * (0.9 + Math.sin(t * 13) * 0.1)
    heart.rotation.y = t * 1.2
    beacon.visible = showT < 0 && !blown
    if (beacon.visible) beaconMat.opacity = 0.16 + Math.sin(t * 2) * 0.06
    // guests sway along with the song, then jump and cheer
    for (const g of guests) {
      const toHer = her ? Math.atan2(her.x - g.x, her.z - g.z) : g.base
      let yy = 0, rot = g.base, tilt = 0
      if (e < 0) { yy = Math.abs(Math.sin(t * 2.4 + g.ph)) * 0.05; tilt = Math.sin(t * 1.2 + g.ph) * 0.05 }
      else if (e < SHOW.blow) { rot = toHer; tilt = Math.sin(e * Math.PI * 1.1 + g.ph * 0.2) * 0.14 }
      else { rot = toHer; yy = Math.abs(Math.sin((e - SHOW.blow) * 7 + g.ph)) * 0.45 * Math.max(0.25, 1 - (e - SHOW.blow) / 10) }
      g.c.group.position.y = yy
      g.c.group.rotation.y += Math.atan2(Math.sin(rot - g.c.group.rotation.y), Math.cos(rot - g.c.group.rotation.y)) * Math.min(1, dt * 5)
      g.c.group.rotation.z = tilt
      g.c.animate(dt, 0, t + g.ph)
    }
  }

  // she and the guests can't walk through the table
  const blocks = (px, py) => Math.hypot(px - cakePx.x, py - cakePx.y) < 30
  const cakeTop = new THREE.Vector3(cx, topY, cz)
  return { update, render, dispose() { disposeStatic(); updateBatches.dispose(); flameBatch.dispose(); for (const actor of actors) actor.dispose() }, start, reset, blocks, cakePx, cakeTop, approach: { x: cakePx.x + 44, y: cakePx.y } }
}
