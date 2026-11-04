// Procedural 3D buildings. Origin = ground level, centre of the front wall; the door faces +z.
// Every building is "baked": meshes sharing a material are merged, so each house is only a few draw calls.
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

export const STYLES = {
  home:    { wall: '#fbe3d6', trim: '#e3a08d', roof: '#d9715f', door: '#9a4e44', sign: '#c4574a', floors: 2, roofType: 'hip' },
  college: { wall: '#f6e7d2', trim: '#d8b48c', roof: '#a34a3c', door: '#6e3b2f', sign: '#8d3a2e', floors: 3, roofType: 'hip' },
  pg:      { wall: '#e4e6f0', trim: '#b4bbd6', roof: '#7d87b0', door: '#5a6690', sign: '#5a6690', floors: 4, roofType: 'hip' },
  cafe:    { wall: '#fdeccf', trim: '#eec497', roof: '#e0954f', door: '#845638', sign: '#a2653a', floors: 2, roofType: 'hip' },
  museum:  { wall: '#f4f1ea', trim: '#d9d0c2', roof: '#8e9bb0', door: '#5b5f6e', sign: '#5b5f6e', floors: 2, roofType: 'temple', tall: 1.25 },
  stage:   { wall: '#efe2f7', trim: '#d2b5e8', roof: '#b088d0', door: '#b03a4f', sign: '#86589e', floors: 2, roofType: 'hip' },
  cinema:  { wall: '#fbe3e6', trim: '#e6a2ad', roof: '#6d5a9c', door: '#43365e', sign: '#c43a5a', floors: 2, roofType: 'flat' },
  arcade:  { wall: '#e6f3ec', trim: '#a8d4c0', roof: '#5fb3a0', door: '#2f6f62', sign: '#2f8f7a', floors: 2, roofType: 'hip' },
  post:    { wall: '#fde2dc', trim: '#f0b0a8', roof: '#df5a58', door: '#85353f', sign: '#c04650', floors: 2, roofType: 'hip' },
}
const FH = 2.8 // floor height (m)

const cache = new Map()
const M = (color, roughness = 0.85, extra = {}) => {
  const k = `${color}|${roughness}|${JSON.stringify(extra)}`
  if (!cache.has(k)) cache.set(k, new THREE.MeshStandardMaterial({ color, roughness, ...extra }))
  return cache.get(k)
}
/** shared materials the scene brightens at night */
export const glowMats = {
  window: new THREE.MeshStandardMaterial({ color: '#bcd9ea', emissive: '#ffcf86', emissiveIntensity: 0, roughness: 0.15, metalness: 0.35 }),
  bulb: new THREE.MeshStandardMaterial({ color: '#fff4d6', emissive: '#ffd58f', emissiveIntensity: 0.4 }),
}

function signTexture(text, bg) {
  const c = document.createElement('canvas')
  c.width = 1024; c.height = 220
  const g = c.getContext('2d')
  g.font = '600 92px Inter, sans-serif'
  const w = Math.min(1000, g.measureText(text).width + 120)
  const x = (1024 - w) / 2
  g.fillStyle = bg
  g.beginPath(); g.roundRect(x, 20, w, 180, 46); g.fill()
  g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 7
  g.beginPath(); g.roundRect(x + 16, 36, w - 32, 148, 34); g.stroke()
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(text, 512, 112)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return { tex: t, aspect: w / 180 }
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const stripes = canvasTexture(256, 64, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#fffaf0' : '#f28fa2'; g.fillRect(i * 32, 0, 32, 64) } })
const clockFace = canvasTexture(256, 256, (g) => {
  g.fillStyle = '#fffaf0'; g.beginPath(); g.arc(128, 128, 122, 0, 7); g.fill()
  g.strokeStyle = '#4a3340'; g.lineWidth = 10; g.stroke()
  g.lineCap = 'round'
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.lineWidth = 6; g.beginPath(); g.moveTo(128 + Math.cos(a) * 95, 128 + Math.sin(a) * 95); g.lineTo(128 + Math.cos(a) * 108, 128 + Math.sin(a) * 108); g.stroke() }
  g.lineWidth = 9; g.beginPath(); g.moveTo(128, 128); g.lineTo(128, 60); g.moveTo(128, 128); g.lineTo(172, 140); g.stroke()
})
const marquee = canvasTexture(512, 128, (g) => {
  g.fillStyle = '#43365e'; g.fillRect(0, 0, 512, 128)
  g.fillStyle = '#fff'; g.font = '700 34px Inter, sans-serif'; g.textAlign = 'center'; g.fillText('NOW SHOWING', 256, 52)
  g.fillStyle = '#ffb3c6'; g.font = '700 42px Inter, sans-serif'; g.fillText('US ♥', 256, 100)
})

export function heartShape(size = 1) {
  const s = new THREE.Shape()
  const k = size
  s.moveTo(0, -0.45 * k)
  s.bezierCurveTo(-0.15 * k, -0.3 * k, -0.6 * k, -0.05 * k, -0.6 * k, 0.22 * k)
  s.bezierCurveTo(-0.6 * k, 0.48 * k, -0.35 * k, 0.6 * k, -0.18 * k, 0.6 * k)
  s.bezierCurveTo(-0.06 * k, 0.6 * k, 0, 0.5 * k, 0, 0.42 * k)
  s.bezierCurveTo(0, 0.5 * k, 0.06 * k, 0.6 * k, 0.18 * k, 0.6 * k)
  s.bezierCurveTo(0.35 * k, 0.6 * k, 0.6 * k, 0.48 * k, 0.6 * k, 0.22 * k)
  s.bezierCurveTo(0.6 * k, -0.05 * k, 0.15 * k, -0.3 * k, 0, -0.45 * k)
  return s
}

function bake(group) {
  group.updateMatrixWorld(true)
  const byMat = new Map()
  const keep = []
  group.traverse((o) => {
    if (!o.isMesh) return
    if (o.userData.keep) { keep.push(o); return }
    const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
    geo.applyMatrix4(o.matrixWorld)
    for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name)
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2))
    if (!byMat.has(o.material)) byMat.set(o.material, [])
    byMat.get(o.material).push(geo)
  })
  const out = new THREE.Group()
  for (const [m, geos] of byMat) {
    const mesh = new THREE.Mesh(mergeGeometries(geos), m)
    mesh.castShadow = true
    mesh.receiveShadow = true
    out.add(mesh)
  }
  for (const o of keep) { o.updateMatrixWorld(true); const c = o.clone(); c.matrix.copy(o.matrixWorld); c.matrix.decompose(c.position, c.quaternion, c.scale); out.add(c) }
  return out
}

/** w, h are the footprint in tiles (2 m each). Returns { group, height } */
export function makeBuilding(kind, w, h, label) {
  const S = STYLES[kind]
  const W = w * 2 - 0.8
  const D = h * 2 - 1.6
  const Hb = S.floors * FH * (S.tall ?? 1)
  const g = new THREE.Group()
  const box = (bw, bh, bd, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), m); o.position.set(x, y, z); g.add(o); return o }
  const cyl = (rt, rb, hh, m, x, y, z, seg = 16) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, hh, seg), m); o.position.set(x, y, z); g.add(o); return o }
  const wall = M(S.wall, 0.88), trim = M(S.trim, 0.7), roof = M(S.roof, 0.6), door = M(S.door, 0.5), white = M('#fffaf2', 0.7), gold = M('#d7b46a', 0.35, { metalness: 0.6 })
  const fz = 0 // front wall plane
  const cz = -D / 2

  box(W + 0.3, 0.32, D + 0.3, trim, 0, 0.16, cz)
  box(W, Hb, D, wall, 0, Hb / 2 + 0.3, cz)
  box(W + 0.36, 0.22, D + 0.36, trim, 0, Hb + 0.4, cz)
  const top = Hb + 0.51

  // roof
  let roofH = 0
  if (S.roofType === 'hip') {
    roofH = Math.min(W, D) * 0.42
    const geo = new THREE.ConeGeometry(1, roofH, 4, 1)
    geo.rotateY(Math.PI / 4)
    const r = new THREE.Mesh(geo, roof)
    r.scale.set((W + 0.9) / Math.SQRT2, 1, (D + 0.9) / Math.SQRT2)
    r.position.set(0, top + roofH / 2, cz)
    g.add(r)
  } else if (S.roofType === 'flat') {
    box(W + 0.2, 0.3, D + 0.2, roof, 0, top + 0.15, cz)
    box(W + 0.2, 0.6, 0.18, roof, 0, top + 0.45, fz - 0.1)
    roofH = 0.6
  } else {
    // temple: flat roof + triangular pediment over a portico of columns
    box(W + 0.2, 0.3, D + 0.2, roof, 0, top + 0.15, cz)
    const tri = new THREE.Shape()
    tri.moveTo(-(W + 1.2) / 2, 0); tri.lineTo((W + 1.2) / 2, 0); tri.lineTo(0, 1.9); tri.closePath()
    const ped = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 1.6, bevelEnabled: false }), roof)
    ped.position.set(0, top + 0.3, fz - 0.35)
    g.add(ped)
    const pedFace = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.05, bevelEnabled: false }), white)
    pedFace.scale.set(0.82, 0.7, 1); pedFace.position.set(0, top + 0.5, fz + 1.27)
    g.add(pedFace)
    roofH = 2.2
    box(W + 1.2, 0.5, 1.5, white, 0, top - 0.05, fz + 0.5) // entablature
    for (let k = 0; k < 6; k++) {
      const x = -W / 2 + 0.5 + (k * (W - 1)) / 5
      cyl(0.28, 0.32, top - 0.6, white, x, (top - 0.6) / 2 + 0.3, fz + 0.75, 20)
      box(0.8, 0.18, 0.8, trim, x, top - 0.38, fz + 0.75)
    }
    for (let k = 0; k < 3; k++) box(W + 1.4 - k * 0.4, 0.16, 1.9 - k * 0.35, M('#e8e2d6', 0.8), 0, 0.08 + k * 0.16, fz + 1.2 - k * 0.15)
  }

  // windows on the front and both sides
  const win = (x, y, z, rotY) => {
    const grp = new THREE.Group()
    grp.position.set(x, y, z); grp.rotation.y = rotY
    const f = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.3, 0.1), white)
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.08), glowMats.window); gl.position.z = 0.056
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.08, 0.03), white); bar.position.z = 0.07
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.06, 0.03), white); bar2.position.z = 0.07
    const sill = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.25), trim); sill.position.set(0, -0.7, 0.08)
    grp.add(f, gl, bar, bar2, sill)
    if (kind === 'home' || kind === 'post') {
      const boxm = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.28), M('#9a6a52')); boxm.position.set(0, -0.85, 0.12)
      grp.add(boxm)
      for (let i = 0; i < 4; i++) { const fl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), M(i % 2 ? '#f08a9c' : '#f8c6d0', 0.6)); fl.position.set(-0.4 + i * 0.27, -0.7, 0.16); grp.add(fl) }
    }
    g.add(grp)
  }
  if (S.roofType !== 'temple') {
    for (let f = 0; f < S.floors; f++) {
      const y = 0.3 + f * FH * (S.tall ?? 1) + 1.55
      const n = Math.max(2, Math.floor(W / 2.5))
      for (let k = 0; k < n; k++) {
        const x = -W / 2 + (W * (k + 0.5)) / n
        if (f === 0 && Math.abs(x) < 1.6) continue
        if (kind === 'cinema' && f === 0) continue
        if (kind === 'cafe' && f === 0) continue
        if (kind === 'college' && f === S.floors - 1 && Math.abs(x) < 1.4) continue
        win(x, y, fz + 0.02, 0)
      }
      const ns = Math.max(1, Math.floor(D / 2.8))
      for (let k = 0; k < ns; k++) {
        const z = cz - D / 2 + (D * (k + 0.5)) / ns
        win(-W / 2 - 0.02, y, z, -Math.PI / 2)
        win(W / 2 + 0.02, y, z, Math.PI / 2)
      }
    }
  } else {
    for (const sx of [-1, 1]) for (const zz of [0.3, 0.7]) win(sx * (W / 2 + 0.02), 2.4, cz - D / 2 + D * zz, sx * Math.PI / 2)
  }

  // door, step, lamp
  const dz = S.roofType === 'temple' ? fz : fz
  box(1.7, 2.45, 0.14, white, 0, 1.52, dz + 0.04)
  box(1.4, 2.25, 0.14, door, 0, 1.43, dz + 0.1)
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), gold); knob.position.set(0.48, 1.35, dz + 0.2); g.add(knob)
  box(2.2, 0.16, 0.7, trim, 0, 0.08, dz + 0.35)
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), glowMats.bulb); lamp.position.set(0, 2.95, dz + 0.3); g.add(lamp)

  // sign over the door
  const { tex, aspect } = signTexture(label, S.sign)
  const sh = 0.62
  const sw = Math.min(W - 0.6, sh * aspect)
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw / aspect), new THREE.MeshBasicMaterial({ map: tex, transparent: true }))
  sign.position.set(0, S.roofType === 'temple' ? top + 0.15 : 3.55, S.roofType === 'temple' ? fz + 1.26 : fz + 0.08)
  sign.userData.keep = true
  g.add(sign)

  // personality
  if (kind === 'home') {
    box(0.8, 1.8, 0.8, M('#b57a6c', 0.8), W * 0.28, top + roofH * 0.55, cz - D * 0.15)
    const heart = new THREE.Mesh(new THREE.ExtrudeGeometry(heartShape(0.5), { depth: 0.08, bevelEnabled: false }), M('#e8627c', 0.4))
    heart.position.set(0, top + roofH * 0.32, fz + 0.25); heart.rotation.x = -0.6
    g.add(heart)
  }
  if (kind === 'cafe') {
    for (const x of [-W / 3.2, W / 3.2]) {
      const gw = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.9), glowMats.window); gw.position.set(x, 1.4, fz + 0.03); g.add(gw)
      box(2.4, 0.1, 0.1, white, x, 2.4, fz + 0.06); box(2.4, 0.1, 0.1, white, x, 0.45, fz + 0.06)
    }
    const aw = new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, 0.08, 1.4), new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.7 }))
    aw.position.set(0, 3.0, fz + 0.65); aw.rotation.x = 0.35
    g.add(aw)
    for (const x of [-W / 2.6, W / 2.6]) {
      cyl(0.45, 0.45, 0.06, M('#fffaf0', 0.5), x, 0.85, fz + 2.2); cyl(0.05, 0.05, 0.8, M('#4a3340', 0.4), x, 0.42, fz + 2.2, 8)
      for (const sx of [-0.75, 0.75]) cyl(0.22, 0.22, 0.06, M('#e0954f', 0.6), x + sx, 0.5, fz + 2.2)
    }
  }
  if (kind === 'pg') {
    for (let f = 1; f < S.floors; f++) {
      const y = 0.3 + f * FH + 0.15
      box(W * 0.6, 0.12, 0.9, white, 0, y, fz + 0.45)
      box(W * 0.6, 0.5, 0.05, M('#7d87b0', 0.5, { metalness: 0.4 }), 0, y + 0.3, fz + 0.88)
    }
  }
  if (kind === 'college') {
    const clock = new THREE.Mesh(new THREE.CircleGeometry(0.85, 32), new THREE.MeshStandardMaterial({ map: clockFace, roughness: 0.5 }))
    clock.position.set(0, 0.3 + (S.floors - 1) * FH + 1.55, fz + 0.06)
    g.add(clock)
    for (const x of [-1.9, 1.9]) cyl(0.25, 0.28, 3.1, white, x, 1.85, fz + 0.4, 18)
    box(4.6, 0.3, 0.9, white, 0, 3.45, fz + 0.35)
    for (const sx of [-1, 1]) {
      cyl(0.05, 0.05, 3, M('#4a3340', 0.4, { metalness: 0.5 }), sx * (W / 2 - 0.4), top + 1.5, cz + D / 2 - 0.4, 8)
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.6), M('#f2b830', 0.6, { side: THREE.DoubleSide }))
      flag.position.set(sx * (W / 2 - 0.4) + sx * 0.5, top + 2.65, cz + D / 2 - 0.4)
      g.add(flag)
    }
  }
  if (kind === 'stage') {
    const star = new THREE.Shape()
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2; const r = i % 2 ? 0.32 : 0.75; i ? star.lineTo(Math.cos(a) * r, -Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, -Math.sin(a) * r) }
    const st = new THREE.Mesh(new THREE.ExtrudeGeometry(star, { depth: 0.2, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04 }), M('#f2b830', 0.3, { metalness: 0.6, emissive: '#7a5400', emissiveIntensity: 0.2 }))
    st.position.set(0, top + roofH + 0.7, cz)
    g.add(st)
    for (const x of [-W / 2 + 0.5, W / 2 - 0.5]) cyl(0.25, 0.25, Hb, white, x, Hb / 2 + 0.3, fz + 0.3, 16)
  }
  if (kind === 'cinema') {
    const mq = new THREE.Mesh(new THREE.BoxGeometry(W * 0.75, 1.2, 0.5), [M('#43365e'), M('#43365e'), M('#43365e'), M('#43365e'), new THREE.MeshBasicMaterial({ map: marquee }), M('#43365e')])
    mq.position.set(0, 3.4, fz + 0.4); mq.userData.keep = true
    g.add(mq)
    for (let i = 0; i < 16; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), glowMats.bulb); b.position.set(-W * 0.36 + (i * W * 0.72) / 15, 4.06, fz + 0.66); g.add(b) }
    for (const x of [-W / 2.8, W / 2.8]) { box(1.4, 2, 0.08, white, x, 1.5, fz + 0.05); box(1.2, 1.8, 0.04, M(x < 0 ? '#f2a0b4' : '#a9c8e8', 0.6), x, 1.5, fz + 0.1) }
  }
  if (kind === 'arcade') {
    for (const [x, col] of [[-W / 2 + 1.2, '#f2b830'], [W / 2 - 1.2, '#f28fa2']]) {
      const d = cyl(0.55, 0.55, 0.12, M(col, 0.4), x, top + roofH * 0.35, fz + 0.2, 24); d.rotation.x = Math.PI / 2 - 0.5
    }
  }
  if (kind === 'post') {
    const mb = cyl(0.32, 0.32, 0.9, M('#d8344a', 0.4), W / 2 - 0.9, 0.75, fz + 0.7, 18)
    mb.scale.z = 0.8
    box(0.1, 0.6, 0.1, M('#7a1a28'), W / 2 - 0.9, 0.3, fz + 0.7)
    const heart = new THREE.Mesh(new THREE.ExtrudeGeometry(heartShape(0.6), { depth: 0.1, bevelEnabled: false }), M('#fffaf0', 0.4))
    heart.position.set(0, top + roofH * 0.3, fz + 0.3); heart.rotation.x = -0.6
    g.add(heart)
  }

  return { group: bake(g), height: top + roofH, depth: D }
}
