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
  q.reset()
  run(16, 8); assert.equal(q.tier.name, 'low')
  run(16, 8); assert.equal(q.tier.name, 'medium')
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

test('lowest-tier resolution has a floor and only recovers with measured headroom', () => {
  const applied = [], q = createQuality(true, (tier, scale) => applied.push([tier.name, scale]))
  const run = (ms, seconds, workMs) => {
    for (let i = 0; i < Math.ceil(seconds * 1000 / ms); i++) q.sample(ms, 80, 180000, workMs)
  }
  run(25, 18, 23)
  assert.equal(q.tier.name, 'low')
  assert.equal(q.stats.resolution, .7)
  run(16, 30, 15)
  assert.equal(q.stats.resolution, .7, 'vsync-limited 60fps alone must not cause an expensive promotion')
  run(16, 14, 6)
  assert.equal(q.stats.resolution, .75)
  run(16, 14, 6)
  assert.equal(q.stats.resolution, .8)
  assert.ok(applied.every(([, scale]) => scale >= .7 && scale <= 1))
})

import { townMapDistance } from '../src/town3d/camera.js'
import { batchAnimated } from '../src/town3d/batching.js'
import { createFrameProfiler } from '../src/town3d/frameProfiler.js'

test('map camera contains all town corners and roofs in portrait and landscape', () => {
  for (const aspect of [390/844, 844/390, 1280/720]) {
    const d = townMapDistance(aspect), camera = new THREE.PerspectiveCamera(50, aspect, .3, 2000)
    camera.position.set(0, Math.sin(1.25) * d, 4 + Math.cos(1.25) * d); camera.lookAt(0, 0, 4); camera.updateMatrixWorld()
    for (const x of [-COLS, COLS]) for (const z of [-ROWS, ROWS]) for (const y of [0, 18]) {
      const p = new THREE.Vector3(x,y,z).project(camera)
      assert.ok(Math.abs(p.x) < 1 && Math.abs(p.y) < 1, `${aspect}: clipped corner ${x},${y},${z}`)
    }
  }
})

test('crowd batching preserves colours, visibility and animated transforms across shared geometry', () => {
  const scene = new THREE.Scene(), roots = [], colours = ['#ff0000','#0000ff']
  for (let i = 0; i < 2; i++) {
    const root = new THREE.Group(); root.position.x = i * 4
    root.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshStandardMaterial({color:colours[i]})))
    roots.push(root)
  }
  const update = batchAnimated(scene, roots, {coalesce:true}); update()
  assert.equal(scene.children.length, 1)
  const batch = scene.children[0], colour = new THREE.Color(), matrix = new THREE.Matrix4(), position = new THREE.Vector3()
  assert.equal(batch.count, 2); batch.getColorAt(1,colour); assert.equal(colour.getHexString(),'0000ff')
  roots[0].visible = false; roots[1].position.x = 9; update()
  assert.equal(batch.count,1); batch.getMatrixAt(0,matrix); position.setFromMatrixPosition(matrix); assert.equal(position.x,9)
  batch.getColorAt(0,colour); assert.equal(colour.getHexString(),'0000ff')
  update.dispose(); batch.dispose(); batch.material.dispose()
})

test('GPU profiler polls availability before reading and reuses its four queries', () => {
  let created = 0, reads = 0, disposed = 0, available = false
  const ext = {GPU_DISJOINT_EXT:3,TIME_ELAPSED_EXT:4}
  const gl = {
    QUERY_RESULT_AVAILABLE:1, QUERY_RESULT:2,
    getExtension:()=>ext, createQuery:()=>({id:created++}), deleteQuery:()=>disposed++,
    getParameter:()=>false, beginQuery:()=>{},endQuery:()=>{},
    getQueryParameter:(query,key)=>key===1?available:(reads++,3e6),
  }
  const profiler = createFrameProfiler({getContext:()=>gl})
  profiler.begin(); profiler.end(4); profiler.begin(); profiler.end(5)
  assert.equal(reads,0); assert.equal(created,4)
  available = true; profiler.begin(); profiler.end(6)
  assert.equal(profiler.stats.gpuMs,3); assert.equal(profiler.stats.cpuMs,6); assert.equal(created,4)
  profiler.dispose(); assert.equal(disposed,4)
})

import { prepareBirthdayMusic, createBirthdayMusic } from '../src/town3d/birthdayMusic.js'

test('birthday score is prepared once and a tap starts one buffer with no live synthesizer graph', async () => {
  const previousWindow = globalThis.window
  let offlineContexts = 0, liveSources = 0, liveGains = 0, liveOscillators = 0, starts = 0, closed = 0
  const param = () => ({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){},cancelScheduledValues(){}})
  const node = () => ({gain:param(),frequency:param(),detune:param(),Q:param(),connect(){},disconnect(){},start(){},stop(){}})
  const prepared = {prepared:true}
  class Offline {
    constructor(){ offlineContexts++; this.state='suspended';this.currentTime=0;this.sampleRate=24000;this.destination={} }
    createGain(){return node()} createDynamicsCompressor(){return node()} createConvolver(){return node()}
    createBiquadFilter(){return node()} createOscillator(){return node()} createBufferSource(){return node()}
    createBuffer(ch,length){const arrays=Array.from({length:ch},()=>new Float32Array(length));return {getChannelData:i=>arrays[i]}}
    startRendering(){return Promise.resolve(prepared)}
  }
  class Live {
    constructor(){this.state='suspended';this.currentTime=0;this.destination={}}
    resume(){this.state='running';return Promise.resolve()}
    close(){closed++;return Promise.resolve()}
    createBufferSource(){liveSources++;const n=node();n.start=()=>starts++;return n}
    createGain(){liveGains++;return node()}
    createOscillator(){liveOscillators++;return node()}
  }
  globalThis.window={OfflineAudioContext:Offline,AudioContext:Live}
  try {
    const [a,b]=await Promise.all([prepareBirthdayMusic(),prepareBirthdayMusic()])
    assert.equal(a,prepared);assert.equal(b,prepared);assert.equal(offlineContexts,1)
    const music=createBirthdayMusic();music.play();music.play();music.blow(15.8);music.setMuted(true);music.setMuted(false)
    assert.equal(liveSources,1);assert.equal(liveGains,1);assert.equal(liveOscillators,0);assert.equal(starts,1)
    music.stop();music.stop();await new Promise(resolve=>setTimeout(resolve,550));assert.equal(closed,1)
  } finally {globalThis.window=previousWindow}
})

test('every place and collectible remains reachable from the spawn', async () => {
  const layout = await buildLayout({pace:0})
  for (const target of [...layout.places,...layout.hearts]) {
    const route = layout.findPath(layout.spawn.x,layout.spawn.y,target.x,target.y)
    assert.ok(route?.length, `No path to ${target.id}`)
    for (const waypoint of route) assert.ok(layout.free(waypoint.x,waypoint.y), `Blocked waypoint to ${target.id}`)
  }
})

test('map recovery does not raise the saved walking resolution', () => {
  const applied=[], q=createQuality(true,(tier,scale)=>applied.push([tier.name,scale]))
  const run=(ms,seconds,cost)=>{for(let i=0;i<Math.ceil(seconds*1000/ms);i++)q.sample(ms,70,140000,cost)}
  run(25,18,23);assert.equal(q.stats.resolution,.7)
  q.setMode('map');run(16,28,5);assert.ok(q.stats.resolution>.7)
  const mapResolution=q.stats.resolution
  q.setMode('walk');assert.equal(q.stats.resolution,.7)
  q.setMode('map');assert.equal(q.stats.resolution,mapResolution)
  const before=applied.length;q.setMode('map');assert.equal(applied.length,before)
})
