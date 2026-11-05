import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createQuality } from '../src/town3d/quality.js'
import { buildTerrain } from '../src/town3d/terrain.js'
import { buildLayout, COLS, ROWS } from '../src/game/layout.js'

test('quality demotes on slow frames and budgets, promotes only after sustained recovery', () => {
  const applied = [], q = createQuality(true, t => applied.push(t.name))
  const run = (ms, seconds, calls = 80, triangles = 150000) => {
    for (let i = 0; i < Math.ceil(seconds * 1000 / ms); i++) q.sample(ms, calls, triangles)
  }
  assert.equal(q.tier.name, 'medium')
  run(25, 7); assert.equal(q.tier.name, 'low')
  run(16, 8); assert.equal(q.tier.name, 'low')
  run(16, 6); assert.equal(q.tier.name, 'medium')
  run(16, 3, 121); assert.equal(q.tier.name, 'low')
  run(16, 14); assert.equal(q.tier.name, 'medium')
  q.reset(); run(25, 1); assert.equal(q.tier.name, 'medium')
  run(25, 4); assert.equal(q.tier.name, 'low')
  assert.ok(applied.length >= 5)
})

test('terrain keeps walkable and building surfaces flat, with normalized splat and mobile texture cap', async () => {
  const layout = await buildLayout({ pace: 0 }), scene = new THREE.Scene()
  const terrain = buildTerrain(scene, layout, true), mesh = scene.children[0]
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader }
  mesh.material.onBeforeCompile(shader)
  assert.equal(shader.uniforms.terrainAtlas.value.image.width, 256)
  assert.equal(shader.uniforms.terrainAtlas.value.image.depth, 4)
  const weights = shader.uniforms.terrainSplat.value.image.data
  for (let i = 0; i < weights.length; i += 4) assert.equal(weights[i] + weights[i+1] + weights[i+2] + weights[i+3], 255)
  const p = mesh.geometry.attributes.position
  let hills = 0
  for (let i = 0; i < p.count; i++) {
    const c = Math.floor((p.getX(i) + COLS) / 2), r = Math.floor((ROWS - p.getY(i)) / 2)
    if (c >= COLS || r >= ROWS) continue
    if (!layout.solid[r][c] || !layout.forest[r][c]) assert.equal(p.getZ(i), 0)
    if (p.getZ(i) > .001) hills++
  }
  assert.ok(hills > 0)
  // Tap-to-walk can still cross the main river bridge.
  const path = layout.findPath(10 * 32, 23 * 32, 20 * 32, 23 * 32)
  assert.ok(path?.length)
  terrain.dispose(); mesh.geometry.dispose(); mesh.material.dispose()
})
