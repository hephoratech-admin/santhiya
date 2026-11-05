import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { COLS, ROWS, T } from '../game/layout.js'
import { heightFog } from './atmosphere.js'
import { windify } from './nature.js'

function random(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 } }
const colors = ['#eeb5c4', '#80a65b', '#53785b', '#80a35d']
function leafTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const g = c.getContext('2d'), rand = random(17)
  // Left half is a porous branch of leaves, right half an opaque bark strip.
  for (let i = 0; i < 85; i++) {
    const x = 64 + (rand() - .5) * 100, y = 128 + (rand() - .5) * 216
    const d = ((x - 64) / 57) ** 2 + ((y - 128) / 122) ** 2
    if (d > 1) continue
    g.fillStyle = `hsl(65,12%,${65 + rand() * 34}%)`
    g.beginPath(); g.ellipse(x, y, 5 + rand() * 7, 3 + rand() * 5, rand() * 6, 0, Math.PI * 2); g.fill()
    g.strokeStyle = 'rgba(70,70,45,.25)'; g.beginPath(); g.moveTo(x - 3, y); g.lineTo(x + 4, y); g.stroke()
  }
  g.fillStyle = '#92735b'; g.fillRect(128, 0, 128, 256)
  for (let i = 0; i < 90; i++) { g.strokeStyle = i % 2 ? '#795d48' : '#b09170'; const x = 129 + rand() * 126; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (rand() - .5) * 6, 256); g.stroke() }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
function paintImpostor(species) {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const g = c.getContext('2d'), rand = random(91 + species)
  g.strokeStyle = '#79573f'; g.lineWidth = species === 3 ? 7 : 11
  g.beginPath(); g.moveTo(128, 249); g.quadraticCurveTo(120, 170, 128, species === 3 ? 62 : 100); g.stroke()
  g.fillStyle = colors[species]
  for (let i = 0; i < (species === 3 ? 160 : 530); i++) {
    let x, y
    if (species === 3) { const a = (i % 8) / 8 * Math.PI * 2, d = rand(); x = 128 + Math.cos(a) * d * 115; y = 56 + Math.sin(a) * d * 38 + d * d * 48 }
    else { const a = rand() * Math.PI * 2, d = Math.sqrt(rand()); x = 128 + Math.cos(a) * d * (species === 2 ? 37 : 112); y = (species === 2 ? 104 : 92) + Math.sin(a) * d * (species === 2 ? 99 : 81) }
    g.fillStyle = new THREE.Color(colors[species]).multiplyScalar(.76 + rand() * .38).getStyle()
    g.beginPath(); g.ellipse(x, y, species === 2 ? 4 : 7, 4, rand() * 6, 0, 7); g.fill()
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex
}
function colored(geo, color, leaf) {
  const uv = geo.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setX(i, leaf ? uv.getX(i) * .49 : .51 + uv.getX(i) * .48)
  const a = new Float32Array(geo.attributes.position.count * 3), c = new THREE.Color(color)
  for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3))
  const sway = new Float32Array(geo.attributes.position.count).fill(leaf ? 1 : .08)
  geo.setAttribute('leafSway', new THREE.BufferAttribute(sway, 1))
  return geo
}
function treeGeometry(species, mid) {
  const rand = random(42 + species), pieces = [], height = species === 3 ? 4.8 : species === 2 ? 4.6 : 3.8
  const trunk = new THREE.CylinderGeometry(species === 3 ? .09 : .10, .19, species === 3 ? 4 : 2.7, 5)
  trunk.translate(0, species === 3 ? 2 : 1.35, 0); pieces.push(colored(trunk, '#ffffff', false))
  if (!mid && species < 2) for (let i = 0; i < 4; i++) {
    const branch = new THREE.CylinderGeometry(.025, .075, 1.5, 4)
    branch.rotateZ(.7); branch.rotateY(i * 1.57); branch.translate(Math.cos(i * 1.57) * .3, 2, Math.sin(i * 1.57) * .3)
    pieces.push(colored(branch, '#ffffff', false))
  }
  const count = species === 3 ? (mid ? 8 : 16) : mid ? 9 : 28
  for (let i = 0; i < count; i++) {
    const card = new THREE.PlaneGeometry(1, 1)
    if (species === 3) {
      // Long tapered fronds droop from the crown in a radial fan.
      card.scale(.65, 2.65, 1); card.translate(0, 1.25, 0); card.rotateX(1.18); card.rotateZ(.15)
      card.rotateY(i / count * Math.PI * 2); card.translate(0, 3.95, 0)
    } else {
      const a = i * 2.39996, k = (i + .5) / count
      const radius = species === 2 ? .5 * Math.sin(k * Math.PI) : 1.05 * Math.sin(k * Math.PI)
      const y = species === 2 ? 1.5 + k * 3 : 1.7 + k * 1.7
      card.scale(species === 2 ? .95 : 1.6, species === 2 ? 1.3 : 1.65, 1)
      card.rotateY(a); card.rotateX((rand() - .5) * 1.2)
      card.translate(Math.cos(a) * radius, y, Math.sin(a) * radius)
    }
    const color = new THREE.Color(colors[species]).multiplyScalar(.83 + rand() * .3)
    pieces.push(colored(card, color, true))
  }
  const geo = mergeGeometries(pieces); pieces.forEach(p => p.dispose()); geo.computeBoundingSphere()
  return { geo, height }
}
function swayMaterial(material) {
  windify(material, { amp: .13, height: 4.5, speed: 1.1 })
  const compile = material.onBeforeCompile
  material.onBeforeCompile = shader => {
    compile(shader)
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float leafSway;').replace('k *= k;', 'k *= k * leafSway;')
  }
  material.customProgramCacheKey = () => 'tree-leaf-sway-v1'
  return material
}

export function buildVegetation(scene, layout, mobile) {
  const atlas = leafTexture(), rand = random(194), groups = [], resources = [atlas]
  const material = swayMaterial(new THREE.MeshStandardMaterial({ map: atlas, alphaTest: .48, side: THREE.DoubleSide, vertexColors: true, roughness: .86 }))
  heightFog(material)
  const depth = swayMaterial(new THREE.MeshDepthMaterial({ map: atlas, alphaTest: .48, side: THREE.DoubleSide, depthPacking: THREE.RGBADepthPacking }))
  const dummy = new THREE.Object3D(), tint = new THREE.Color(), chunks = new Map()
  const counts = [0, 0, 0, 0]
  for (const t of layout.trees) {
    const species = t.pink ? 0 : (t.c > 52 && t.r > 30 && rand() < .6) ? 3 : rand() < .25 ? 2 : 1
    const x = (t.c + .5 + t.jx * .3) * 2 - COLS, z = (t.r + .5 + t.jy * .3) * 2 - ROWS
    dummy.position.set(x, 0, z); dummy.rotation.set(0, t.rot, 0); dummy.scale.setScalar(t.s * 1.25); dummy.updateMatrix()
    const entry = { species, x, z, scale: t.s * 1.25, matrix: dummy.matrix.clone(), color: tint.setRGB(.88 + rand() * .18, .9 + rand() * .12, .92 + rand() * .1).clone() }
    const key = Math.floor(t.c / 8) + Math.floor(t.r / 8) * 9
    if (!chunks.has(key)) chunks.set(key, { sphere: new THREE.Sphere(new THREE.Vector3(Math.floor(t.c / 8) * 16 + 8 - COLS, 3, Math.floor(t.r / 8) * 16 + 8 - ROWS), 17), entries: [] })
    chunks.get(key).entries.push(entry); counts[species]++
  }
  for (let species = 0; species < 4; species++) {
    const lods = []
    for (let lod = 0; lod < 3; lod++) {
      let geo, mat
      if (lod < 2) { geo = treeGeometry(species, lod === 1).geo; mat = material }
      else {
        geo = new THREE.PlaneGeometry(species === 2 ? 2.2 : 4.7, species === 3 ? 5.4 : 5.1)
        const tex = paintImpostor(species); resources.push(tex)
        mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: .48, side: THREE.DoubleSide, roughness: 1 })
        heightFog(mat)
      }
      const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, counts[species]))
      mesh.setColorAt(0, new THREE.Color('#ffffff'))
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.count = 0
      mesh.frustumCulled = false; mesh.castShadow = lod === 0; mesh.receiveShadow = true
      if (lod === 0) mesh.customDepthMaterial = depth
      scene.add(mesh); lods.push(mesh)
    }
    groups.push(lods)
  }
  const frustum = new THREE.Frustum(), projection = new THREE.Matrix4(), sphere = new THREE.Sphere(), chunkList = [...chunks.values()]
  const grassGeo = new THREE.BufferGeometry()
  grassGeo.setAttribute('position', new THREE.Float32BufferAttribute([-.04,0,0, .04,0,0, .025,.26,.025, -.04,0,0, .025,.26,.025, .01,.45,.07],3))
  grassGeo.computeVertexNormals()
  const grassCenter = { value: new THREE.Vector3() }, grassRadius = { value: mobile ? 12 : 17 }
  const grassMat = windify(new THREE.MeshStandardMaterial({ color: '#779f51', roughness: 1, side: THREE.DoubleSide }), { amp: .09, height: .45, speed: 2.4 })
  const grassCompile = grassMat.onBeforeCompile
  grassMat.onBeforeCompile = s => {
    grassCompile(s); s.uniforms.grassCenter = grassCenter; s.uniforms.grassRadius = grassRadius
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform vec3 grassCenter; uniform float grassRadius;')
      .replace('#include <project_vertex>', `
        vec3 bladeWorld = (modelMatrix * instanceMatrix * vec4(0.,0.,0.,1.)).xyz;
        transformed.y *= 1. - smoothstep(grassRadius - 3., grassRadius, distance(bladeWorld.xz, grassCenter.xz));
        #include <project_vertex>`)
  }
  grassMat.customProgramCacheKey = () => 'local-grass-v1'
  const grass = new THREE.InstancedMesh(grassGeo, grassMat, mobile ? 1800 : 4500)
  grass.instanceMatrix.setUsage(THREE.DynamicDrawUsage); grass.frustumCulled = false; scene.add(grass)
  let lastX = Infinity, lastZ = Infinity, lastDensity = 0
  const update = (camera, center, tier, map) => {
    camera.updateMatrixWorld(); projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(projection)
    for (const lods of groups) for (const m of lods) m.count = 0
    for (const chunk of chunkList) {
      if (!frustum.intersectsSphere(chunk.sphere)) continue
      for (const entry of chunk.entries) {
        sphere.center.set(entry.x, 3, entry.z); sphere.radius = 4.5 * entry.scale
        if (!frustum.intersectsSphere(sphere)) continue
        const d = Math.hypot(camera.position.x - entry.x, camera.position.y - 2, camera.position.z - entry.z)
        const lod = d < tier.near ? 0 : d < tier.mid ? 1 : 2, m = groups[entry.species][lod], i = m.count++
        if (lod === 2) {
          dummy.position.set(entry.x, (entry.species === 3 ? 2.7 : 2.55) * entry.scale, entry.z); dummy.quaternion.copy(camera.quaternion); dummy.scale.setScalar(entry.scale); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix)
        } else m.setMatrixAt(i, entry.matrix)
        m.setColorAt(i, entry.color)
      }
    }
    for (const lods of groups) for (const m of lods) {
      m.visible = m.count > 0
      if (m.count) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true }
    }
    grass.visible = !map; grassCenter.value.copy(center)
    if (map) return
    const cx = Math.floor(center.x), cz = Math.floor(center.z), density = Math.min(grass.instanceMatrix.count, tier.grass)
    if (cx === lastX && cz === lastZ && density === lastDensity) return
    lastX = cx; lastZ = cz; lastDensity = density
    const radius = grassRadius.value, rng = random(819); let count = 0
    for (let i = 0; i < density; i++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * radius, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r
      const c = Math.floor((x + COLS) / 2), row = Math.floor((z + ROWS) / 2)
      if (c < 0 || row < 0 || c >= COLS || row >= ROWS || layout.grid[row][c] !== T.GRASS || layout.solid[row][c]) continue
      dummy.position.set(x, 0, z); dummy.rotation.set(0, rng() * 6.28, 0); dummy.scale.setScalar(.65 + rng() * .65); dummy.updateMatrix(); grass.setMatrixAt(count++, dummy.matrix)
    }
    grass.count = count; grass.instanceMatrix.needsUpdate = true
  }
  return { update, dispose() { resources.forEach(t => t.dispose()); depth.dispose() } }
}
