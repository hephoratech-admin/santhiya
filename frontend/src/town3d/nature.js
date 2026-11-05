// Little touches of life for the 3D town: wind in the grass and trees, drifting clouds,
// birds, butterflies and dust puffs under her feet.
import * as THREE from 'three'

export const wind = { value: 0 } // shared time uniform for all swaying materials

/**
 * Make an (instanced) material sway in the wind. Vertices higher above the model's
 * origin move more, so stems bend instead of sliding.
 */
export function windify(material, { amp = 0.12, height = 1, speed = 1.6, uniform = false } = {}) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            vec3 ip = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          #else
            vec3 ip = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          #endif
          float ph = ip.x * 0.31 + ip.z * 0.23;
          float k = ${uniform ? '1.0' : `clamp(position.y / ${height.toFixed(3)}, 0.0, 1.5)`};
          k *= k;
          float gust = 0.65 + 0.35 * sin(uWind * 0.37 + ip.x * 0.05);
          transformed.x += sin(uWind * ${speed.toFixed(3)} + ph) * ${amp.toFixed(3)} * k * gust;
          transformed.z += cos(uWind * ${(speed * 0.83).toFixed(3)} + ph * 1.3) * ${(amp * 0.6).toFixed(3)} * k * gust;
        }`)
  }
  material.customProgramCacheKey = () => `wind-${amp}-${height}-${speed}-${uniform}`
  return material
}

function rng(seed) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
}

export function buildNature(scene, { mobile = false } = {}) {
  const rand = rng(77)
  const parts = []

  // ---- puffy low-poly clouds ----
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.4, roughness: 1, flatShading: true, fog: false, transparent: true, opacity: 0.96 })
  const clouds = []
  const NC = mobile ? 9 : 16
  for (let i = 0; i < NC; i++) {
    const g = new THREE.Group()
    const n = 5 + ((rand() * 4) | 0)
    for (let k = 0; k < n; k++) {
      const r = 4 + rand() * 5
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), cloudMat)
      m.position.set((k - n / 2) * 4.2 + rand() * 2, rand() * 2.5 - (Math.abs(k - n / 2) * 0.6), rand() * 4 - 2)
      m.scale.y = 0.62
      g.add(m)
    }
    g.position.set((rand() - 0.5) * 520, 55 + rand() * 35, (rand() - 0.5) * 520)
    g.rotation.y = rand() * 6
    g.scale.setScalar(0.9 + rand() * 0.9)
    scene.add(g)
    clouds.push({ g, v: 1.2 + rand() * 1.4 })
  }

  // ---- birds: little flocks circling high over the town ----
  const birdMat = new THREE.MeshStandardMaterial({ color: '#3d3340', roughness: 0.8, side: THREE.DoubleSide })
  const wingGeo = new THREE.BufferGeometry()
  wingGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, -0.18, 0, 0, 0.22, 0.75, 0.05, 0.02]), 3))
  wingGeo.computeVertexNormals()
  const bodyGeo = new THREE.ConeGeometry(0.09, 0.55, 6); bodyGeo.rotateX(Math.PI / 2)
  const flocks = []
  for (let f = 0; f < (mobile ? 2 : 3); f++) {
    const birds = []
    const n = 5 + ((rand() * 4) | 0)
    for (let i = 0; i < n; i++) {
      const b = new THREE.Group()
      b.add(new THREE.Mesh(bodyGeo, birdMat))
      const wl = new THREE.Mesh(wingGeo, birdMat), wr = new THREE.Mesh(wingGeo, birdMat)
      wr.scale.x = -1
      b.add(wl, wr)
      b.scale.setScalar(1.3)
      scene.add(b)
      // V formation offsets
      const side = i % 2 ? 1 : -1, row = Math.ceil(i / 2)
      birds.push({ b, wl, wr, off: new THREE.Vector3(side * row * 1.6, (rand() - 0.5) * 0.8, -row * 1.8), ph: rand() * 6 })
    }
    flocks.push({ birds, r: 45 + rand() * 60, h: 26 + rand() * 14, sp: (0.05 + rand() * 0.04) * (f % 2 ? -1 : 1), a: rand() * 6, cx: (rand() - 0.5) * 60, cz: (rand() - 0.5) * 50 })
  }

  // ---- butterflies fluttering around her in the daytime ----
  const bfTex = (col) => {
    const c = document.createElement('canvas'); c.width = c.height = 64
    const g = c.getContext('2d')
    g.fillStyle = col
    g.beginPath(); g.ellipse(34, 22, 26, 18, -0.4, 0, 7); g.fill()
    g.beginPath(); g.ellipse(30, 46, 16, 12, 0.5, 0, 7); g.fill()
    g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(40, 20, 5, 0, 7); g.fill()
    g.strokeStyle = 'rgba(60,30,40,.6)'; g.lineWidth = 2; g.beginPath(); g.ellipse(34, 22, 26, 18, -0.4, 0, 7); g.stroke()
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  const bfMats = ['#ffb3c7', '#ffd166', '#a8d8ff', '#c9a8e8', '#ffffff'].map((c) => new THREE.MeshBasicMaterial({ map: bfTex(c), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }))
  const bfWing = new THREE.PlaneGeometry(0.32, 0.32); bfWing.translate(0.16, 0, 0); bfWing.rotateX(-Math.PI / 2)
  const butterflies = []
  for (let i = 0; i < (mobile ? 8 : 16); i++) {
    const b = new THREE.Group()
    const m = bfMats[i % bfMats.length]
    const wl = new THREE.Mesh(bfWing, m), wr = new THREE.Mesh(bfWing, m)
    wr.scale.x = -1
    b.add(wl, wr)
    scene.add(b)
    butterflies.push({ b, wl, wr, home: new THREE.Vector3((rand() - 0.5) * 40, 0, (rand() - 0.5) * 40), ph: rand() * 6, sp: 0.5 + rand() * 0.6 })
  }

  // ---- dust puffs under her feet when she runs ----
  const dc = document.createElement('canvas'); dc.width = dc.height = 64
  const dg = dc.getContext('2d'); const gr = dg.createRadialGradient(32, 32, 0, 32, 32, 32)
  gr.addColorStop(0, 'rgba(235,220,200,.9)'); gr.addColorStop(1, 'rgba(235,220,200,0)'); dg.fillStyle = gr; dg.fillRect(0, 0, 64, 64)
  const dustTex = new THREE.CanvasTexture(dc)
  const puffs = Array.from({ length: 24 }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTex, transparent: true, depthWrite: false, opacity: 0 }))
    s.visible = false; scene.add(s)
    return { s, life: 0 }
  })
  let pi = 0, lastPuff = 0
  const puff = (x, z, t) => {
    if (t - lastPuff < 0.14) return
    lastPuff = t
    const p = puffs[pi]; pi = (pi + 1) % puffs.length
    p.life = 1; p.s.visible = true
    p.s.position.set(x + (Math.random() - 0.5) * 0.3, 0.12, z + (Math.random() - 0.5) * 0.3)
  }

  const tmp = new THREE.Vector3()
  const update = (t, dt, center, night, dusk) => {
    wind.value = t
    const day = 1 - night
    // clouds drift and wrap around; they get dim and blue at night, warm at dusk
    cloudMat.color.setRGB(1, 1, 1).lerp(new THREE.Color('#ffc9a8'), dusk * 0.6 * day).lerp(new THREE.Color('#2c3360'), night * 0.85)
    cloudMat.emissive.copy(cloudMat.color); cloudMat.emissiveIntensity = 0.4 * day
    for (const c of clouds) {
      c.g.position.x += c.v * dt
      if (c.g.position.x > 300) c.g.position.x = -300
    }
    // birds only by day
    for (const f of flocks) {
      f.a += f.sp * dt
      const hx = f.cx + Math.cos(f.a) * f.r, hz = f.cz + Math.sin(f.a) * f.r
      const yaw = Math.atan2(-Math.sin(f.a) * Math.sign(f.sp), Math.cos(f.a) * Math.sign(f.sp)) // tangent
      for (const b of f.birds) {
        b.b.visible = day > 0.3
        if (!b.b.visible) continue
        tmp.copy(b.off).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw)
        b.b.position.set(hx + tmp.x, f.h + b.off.y + Math.sin(t * 0.8 + b.ph) * 0.4, hz + tmp.z)
        b.b.rotation.set(0, yaw, Math.sign(f.sp) * 0.25)
        const flap = Math.sin(t * 9 + b.ph) * 0.7
        b.wl.rotation.z = flap; b.wr.rotation.z = -flap
      }
    }
    // butterflies wander around spots near her
    for (const b of butterflies) {
      b.b.visible = day > 0.35
      if (!b.b.visible) continue
      if (b.home.distanceTo(tmp.set(center.x, 0, center.z)) > 30) b.home.set(center.x + (Math.random() - 0.5) * 36, 0, center.z + (Math.random() - 0.5) * 36)
      const u = t * b.sp + b.ph
      b.b.position.set(b.home.x + Math.sin(u) * 2.2 + Math.sin(u * 2.3) * 0.6, 0.6 + Math.abs(Math.sin(u * 1.7)) * 0.9, b.home.z + Math.cos(u * 0.8) * 2.2)
      b.b.rotation.y = Math.atan2(Math.cos(u) * 2.2, -Math.sin(u * 0.8) * 1.76)
      const flap = Math.sin(t * 18 + b.ph) * 1.1
      b.wl.rotation.z = flap; b.wr.rotation.z = -flap
    }
    for (const p of puffs) {
      if (p.life <= 0) continue
      p.life -= dt * 1.6
      p.s.material.opacity = Math.max(0, p.life) * 0.55
      p.s.scale.setScalar(0.35 + (1 - p.life) * 0.9)
      p.s.position.y += dt * 0.35
      if (p.life <= 0) p.s.visible = false
    }
  }
  parts.push(update)
  return { update, puff }
}
