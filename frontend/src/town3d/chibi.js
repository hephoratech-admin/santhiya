// Round 3D chibi built from simple shapes, so any look from the avatar creator works.
// About 1.25 m tall, facing +z. animate() swings arms and legs while walking.
import * as THREE from 'three'

const mat = (color, roughness = 0.7) => new THREE.MeshStandardMaterial({ color, roughness })

export function makeChibi(look) {
  const g = new THREE.Group()
  const body = new THREE.Group()
  g.add(body)
  const skin = mat(look.skin, 0.62)
  const hair = mat(look.hairColor, 0.5)
  const top = mat(look.top, 0.82)
  const bottom = mat(look.bottom, 0.8)
  const shoe = mat('#5b2c3f', 0.55)
  const ink = new THREE.MeshStandardMaterial({ color: '#25161d', roughness: 0.25 })
  const add = (parent, geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o }

  // legs (pivot at the hip)
  const legs = [-0.085, 0.085].map((x) => {
    const p = new THREE.Group(); p.position.set(x, 0.42, 0); body.add(p)
    add(p, new THREE.CapsuleGeometry(0.072, 0.24, 4, 10), bottom, 0, -0.19, 0)
    const s = add(p, new THREE.SphereGeometry(0.085, 14, 10), shoe, 0, -0.38, 0.035); s.scale.set(1, 0.62, 1.4)
    return p
  })
  // torso + arms (pivot at the shoulder)
  const torso = add(body, new THREE.CapsuleGeometry(0.165, 0.2, 6, 16), top, 0, 0.64, 0); torso.scale.set(1, 1, 0.86)
  const arms = [-1, 1].map((sx) => {
    const p = new THREE.Group(); p.position.set(sx * 0.2, 0.8, 0); body.add(p)
    const a = add(p, new THREE.CapsuleGeometry(0.052, 0.2, 4, 8), top, sx * 0.025, -0.14, 0); a.rotation.z = sx * 0.18
    add(p, new THREE.SphereGeometry(0.058, 12, 8), skin, sx * 0.05, -0.29, 0)
    return p
  })

  // head
  const head = new THREE.Group(); head.position.y = 1.0; body.add(head)
  add(head, new THREE.SphereGeometry(0.245, 28, 20), skin).scale.set(1, 0.96, 1)
  for (const sx of [-1, 1]) {
    const e = add(head, new THREE.SphereGeometry(0.032, 12, 10), ink, sx * 0.085, -0.035, 0.212); e.scale.set(0.85, 1.15, 0.5)
    add(head, new THREE.SphereGeometry(0.009, 6, 6), new THREE.MeshBasicMaterial({ color: '#fff' }), sx * 0.085 + 0.01, -0.02, 0.228)
    const b = add(head, new THREE.CircleGeometry(0.042, 16), new THREE.MeshBasicMaterial({ color: '#ff8aa3', transparent: true, opacity: 0.45 }), sx * 0.135, -0.1, 0.2)
    b.rotation.y = sx * 0.55; b.castShadow = false
  }
  const smile = add(head, new THREE.TorusGeometry(0.03, 0.007, 6, 14, Math.PI), new THREE.MeshBasicMaterial({ color: '#a04a5e' }), 0, -0.105, 0.228)
  smile.rotation.z = Math.PI

  // hair: a cap on top + a back piece, styled by look.hair
  const style = look.hair
  const capLen = style === 'boy' ? 0.42 : 0.47
  const cap = add(head, new THREE.SphereGeometry(0.262, 28, 16, 0, Math.PI * 2, 0, Math.PI * capLen), hair, 0, 0.012, -0.004)
  cap.rotation.x = -0.12
  const backLen = { long: 0.78, braid: 0.66, bun: 0.62, short: 0.66, boy: 0.56 }[style] ?? 0.66
  add(head, new THREE.SphereGeometry(0.268, 28, 16, Math.PI, Math.PI, 0, Math.PI * backLen), hair, 0, 0, -0.01)
  if (style === 'long') {
    const l = add(head, new THREE.CapsuleGeometry(0.19, 0.32, 6, 14), hair, 0, -0.33, -0.1); l.scale.set(1.18, 1, 0.5)
    for (const sx of [-1, 1]) { const lock = add(head, new THREE.CapsuleGeometry(0.06, 0.3, 4, 8), hair, sx * 0.2, -0.26, 0.04); lock.rotation.z = sx * 0.08 }
  } else if (style === 'short') {
    for (const sx of [-1, 1]) add(head, new THREE.CapsuleGeometry(0.07, 0.12, 4, 8), hair, sx * 0.2, -0.09, 0.02)
  } else if (style === 'bun') {
    add(head, new THREE.SphereGeometry(0.11, 16, 12), hair, 0, 0.26, -0.08)
  } else if (style === 'braid') {
    for (let i = 0; i < 6; i++) add(head, new THREE.SphereGeometry(0.06 - i * 0.004, 10, 8), hair, 0.17, -0.12 - i * 0.075, -0.1 + i * 0.01)
    add(head, new THREE.SphereGeometry(0.035, 8, 6), mat('#ff8fab'), 0.17, -0.58, -0.04)
  }

  // accessories
  if (look.extra === 'flower') {
    const f = new THREE.Group(); f.position.set(0.19, 0.16, 0.11); head.add(f)
    const petal = mat('#ff8fab', 0.5)
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; add(f, new THREE.SphereGeometry(0.035, 10, 8), petal, Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0) }
    add(f, new THREE.SphereGeometry(0.025, 8, 6), mat('#ffe27a'), 0, 0, 0.02)
    f.rotation.y = 0.9
  } else if (look.extra === 'glasses') {
    const frame = new THREE.MeshStandardMaterial({ color: '#4a2a36', roughness: 0.3, metalness: 0.4 })
    for (const sx of [-1, 1]) add(head, new THREE.TorusGeometry(0.055, 0.008, 6, 20), frame, sx * 0.085, -0.035, 0.225)
    add(head, new THREE.BoxGeometry(0.05, 0.008, 0.008), frame, 0, -0.03, 0.235)
  } else if (look.extra === 'beard') {
    const bd = add(head, new THREE.SphereGeometry(0.252, 24, 12, 0, Math.PI, Math.PI * 0.6, Math.PI * 0.32), hair, 0, 0, 0.004)
    bd.scale.set(1, 1, 1.02)
    add(head, new THREE.BoxGeometry(0.1, 0.022, 0.02), hair, 0, -0.075, 0.232)
  }

  let phase = 0
  return {
    group: g,
    /** speed: 0 idle … 1 walking … ~1.7 running */
    animate(dt, speed, t) {
      if (speed > 0.05) phase += dt * (7 + speed * 3)
      const k = Math.min(1, speed)
      const sw = Math.sin(phase) * 0.7 * k
      legs[0].rotation.x = sw; legs[1].rotation.x = -sw
      arms[0].rotation.x = -sw * 0.8; arms[1].rotation.x = sw * 0.8
      body.position.y = Math.abs(Math.sin(phase)) * 0.045 * k + (k < 0.05 ? Math.sin(t * 2.2) * 0.008 : 0)
      head.rotation.z = Math.sin(phase * 0.5) * 0.04 * k
    },
  }
}
