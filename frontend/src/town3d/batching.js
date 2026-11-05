import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

// Bake unanimated opaque architecture across the town. Vertex colours preserve
// the pastel palette while roughness buckets share a small set of materials.
export function batchArchitecture(scene, excluded) {
  const buckets = new Map(), removed = []
  scene.updateMatrixWorld(true)
  scene.traverse(o => {
    const m = o.material
    if (!o.isMesh || o.isInstancedMesh || excluded.has(o) || !m?.isMeshStandardMaterial || m.transparent || m.map || m.normalMap) return
    const glow = m.emissive.getHex() !== 0
    const key = glow ? `glow-${m.uuid}` : `${m.metalness > .25 ? 1 : 0}-${m.roughness < .5 ? 0 : 1}`
    if (!buckets.has(key)) {
      const mat = glow ? m.clone() : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: m.roughness < .5 ? .4 : .85, metalness: m.metalness > .25 ? .5 : 0 })
      mat.vertexColors = true; mat.color.set('#ffffff')
      // Keep live day/night uniforms by retaining the shared emissive material.
      const live = glow && (m === excluded.window || m === excluded.bulb)
      buckets.set(key, { material: live ? m : mat, geos: [], cast: false })
      if (live) { mat.dispose(); m.vertexColors = true }
    }
    const bucket = buckets.get(key), geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
    geo.applyMatrix4(o.matrixWorld)
    const n = geo.attributes.position.count, colors = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) { colors[i * 3] = m.color.r; colors[i * 3 + 1] = m.color.g; colors[i * 3 + 2] = m.color.b }
    // Shared emissive materials retain their own base colour.
    if (bucket.material === m) colors.fill(1)
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) geo.deleteAttribute(name)
    bucket.geos.push(geo); bucket.cast ||= o.castShadow; removed.push(o)
  })
  for (const b of buckets.values()) {
    const geo = mergeGeometries(b.geos); b.geos.forEach(g => g.dispose())
    const mesh = new THREE.Mesh(geo, b.material); mesh.castShadow = b.cast; mesh.receiveShadow = true; scene.add(mesh)
  }
  for (const o of removed) { o.removeFromParent(); o.geometry.dispose() }
  // Keep removed materials reachable for texture/material cleanup on unmount.
  return () => {
    const materials = new Set(removed.map(o => o.material))
    for (const m of materials) if (m !== excluded.window && m !== excluded.bulb) m.dispose()
  }
}

// Logical groups retain their animation API, but GPU submission is instanced.
export function batchAnimated(scene, roots) {
  const buckets = new Map()
  for (const root of roots) root.traverse(o => {
    if (!o.isMesh) return
    const key = `${o.geometry.uuid}/${o.material.uuid}`
    if (!buckets.has(key)) buckets.set(key, { geo: o.geometry, mat: o.material, objects: [] })
    buckets.get(key).objects.push(o)
  })
  for (const b of buckets.values()) {
    b.mesh = new THREE.InstancedMesh(b.geo, b.mat, b.objects.length)
    b.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); b.mesh.frustumCulled = false; scene.add(b.mesh)
  }
  const list = [...buckets.values()]
  return () => {
    for (const root of roots) root.updateMatrixWorld(true)
    for (const b of list) {
      let n = 0
      for (const o of b.objects) {
        let visible = true
        for (let p = o; p; p = p.parent) if (!p.visible) { visible = false; break }
        if (visible) b.mesh.setMatrixAt(n++, o.matrixWorld)
      }
      b.mesh.count = n; b.mesh.visible = n > 0; b.mesh.instanceMatrix.needsUpdate = true
    }
  }
}

// Shared sprite effects (lamp halos and lanterns) submit one billboard batch.
export function batchBillboards(scene, sprites) {
  const source = sprites[0].material
  const material = new THREE.MeshBasicMaterial({ map: source.map, color: source.color, transparent: source.transparent, blending: source.blending, depthWrite: source.depthWrite, depthTest: source.depthTest, toneMapped: source.toneMapped, fog: source.fog })
  material.onBeforeCompile = s => {
    s.vertexShader = s.vertexShader.replace('#include <project_vertex>', `
      vec4 mvPosition = viewMatrix * modelMatrix * instanceMatrix * vec4(0.,0.,0.,1.);
      vec2 billboardScale = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
      mvPosition.xy += position.xy * billboardScale;
      gl_Position = projectionMatrix * mvPosition;`)
  }
  material.customProgramCacheKey = () => 'town-effect-billboards-v1'
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1), material, sprites.length)
  mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  for (const sprite of sprites) sprite.removeFromParent()
  scene.add(mesh)
  return {
    update() {
      material.opacity = source.opacity; mesh.visible = material.opacity > .01
      if (!mesh.visible) return
      let n = 0
      for (const sprite of sprites) if (sprite.visible) { sprite.updateMatrix(); mesh.setMatrixAt(n++, sprite.matrix) }
      mesh.count = n; mesh.instanceMatrix.needsUpdate = true
    },
    dispose() { source.dispose() },
  }
}
