import * as THREE from 'three'
import { heightFog } from './atmosphere.js'
import { COLS, ROWS, T, BUILDINGS } from '../game/layout.js'

const W = COLS * 2, H = ROWS * 2
const noise = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}
function texture(data, size, color = false) {
  const t = new THREE.DataTexture(data, size, size)
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter
  t.generateMipmaps = true; t.flipY = true
  if (color) t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  return t
}

// Texture arrays keep terrain at one draw call and prevent neighbouring layers
// bleeding across mip levels. Each layer has albedo and normal/roughness RGBA.
function detailAtlas(mobile) {
  const S = mobile ? 512 : 1024, Q = S / 2
  const albedo = new Uint8Array(S * S * 4), normal = new Uint8Array(S * S * 4)
  const bases = [[104, 143, 72], [164, 132, 94], [188, 178, 160], [206, 188, 145]]
  for (let layer = 0; layer < 4; layer++) for (let y = 0; y < Q; y++) for (let x = 0; x < Q; x++) {
    const u = x / Q, v = y / Q, n = noise(x, y + layer * Q)
    const grain = (n - .5) * (layer === 0 ? 48 : 24)
    const mortar = layer === 2 && (v * 8 % 1 < .055 || (u * 8 + (Math.floor(v * 8) % 2) * .5) % 1 < .045)
    const fiber = layer === 0 ? Math.sin(u * Math.PI * 192 + Math.sin(v * Math.PI * 16) * 3) * 10 : 0
    const i = (layer * Q * Q + y * Q + x) * 4
    for (let k = 0; k < 3; k++) albedo[i + k] = bases[layer][k] + grain + fiber - (mortar ? 46 : 0)
    albedo[i + 3] = 255
    normal[i] = 128 + Math.sin(u * Math.PI * 96) * (layer === 0 ? 28 : 9)
    normal[i + 1] = 128 + (n - .5) * 42 + (mortar ? 22 : 0)
    normal[i + 2] = 250; normal[i + 3] = layer === 2 ? 185 : 238
  }
  const layerTexture = (data, color) => {
    const t = new THREE.DataArrayTexture(data, Q, Q, 4)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter
    t.generateMipmaps = true; t.anisotropy = 4
    if (color) t.colorSpace = THREE.SRGBColorSpace
    t.needsUpdate = true
    return t
  }
  return [layerTexture(albedo, true), layerTexture(normal, false)]
}

export function buildTerrain(scene, layout, mobile) {
  const S = mobile ? 256 : 512
  const splat = new Uint8Array(S * S * 4), mask = new Uint8Array(S * S * 4)
  const tile = (c, r) => layout.grid[Math.max(0, Math.min(ROWS - 1, r))][Math.max(0, Math.min(COLS - 1, c))]
  const treeAO = new Float32Array(COLS * ROWS)
  for (const t of layout.trees) treeAO[t.r * COLS + t.c] = 1
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const c = Math.floor(x / S * COLS), r = Math.floor(y / S * ROWS), t = tile(c, r)
    const i = (y * S + x) * 4
    let shore = false, nearLand = false
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const neighbor = tile(c + dx, r + dy)
      if (neighbor === T.WATER || neighbor === T.BRIDGE) shore = true
      else nearLand = true
    }
    const paved = r === 22 || r === 23 || r === 36 || r === 37 || c === 35 || c === 36
    const layer = t === T.PLAZA || (t === T.PATH && paved) ? 2 : t === T.PATH ? 1 : shore ? 3 : 0
    splat[i + layer] = 255
    // Bilinear-filtered coverage preserves the layout water cutouts, including bridges.
    mask[i] = t === T.WATER || t === T.BRIDGE ? 0 : 255
    const fx = x / S * COLS - c - .5, fy = y / S * ROWS - r - .5
    let ao = treeAO[r * COLS + c] * Math.exp(-(fx * fx + fy * fy) * 3) * .38
    for (const b of BUILDINGS) {
      const dx = Math.max(b.col - x / S * COLS, 0, x / S * COLS - b.col - b.w)
      const dy = Math.max(b.row - y / S * ROWS, 0, y / S * ROWS - b.row - b.h)
      ao = Math.max(ao, .28 * Math.exp(-(dx * dx + dy * dy) * 2))
    }
    mask[i + 1] = (1 - ao) * 255; mask[i + 2] = (t === T.WATER || t === T.BRIDGE ? nearLand : shore) ? 255 : 0; mask[i + 3] = 255
  }
  const [albedo, normals] = detailAtlas(mobile)
  const splatTex = texture(splat, S), maskTex = texture(mask, S)
  const material = new THREE.MeshStandardMaterial({ roughness: .94 })
  const uniforms = { terrainAtlas: { value: albedo }, terrainNormal: { value: normals }, terrainSplat: { value: splatTex }, terrainMask: { value: maskTex } }
  material.onBeforeCompile = s => {
    Object.assign(s.uniforms, uniforms)
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 terrainUV;').replace('#include <uv_vertex>', '#include <uv_vertex>\nterrainUV = uv;')
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
      varying vec2 terrainUV;
      uniform sampler2DArray terrainAtlas, terrainNormal;
      uniform sampler2D terrainSplat, terrainMask;
    `).replace('#include <map_fragment>', `
      vec4 coverage = texture2D(terrainMask, terrainUV);
      if (coverage.r < .5) discard;
      vec4 weights = texture2D(terrainSplat, terrainUV);
      weights /= max(dot(weights, vec4(1.)), .001);
      vec2 detail = terrainUV * vec2(72., 48.);
      vec3 uv0 = vec3(detail, 0.);
      vec3 uv1 = vec3(detail * .65, 1.);
      vec3 uv2 = vec3(detail * .5, 2.);
      vec3 uv3 = vec3(detail * .8, 3.);
      vec2 detailDx = dFdx(detail), detailDy = dFdy(detail);
      vec3 terrainColor = vec3(0.); vec4 detailNormal = vec4(0.);
      // Interior pixels normally use one layer. Skip the other six texture reads;
      // explicit gradients keep mip selection defined across blend boundaries.
      if (weights.r > .001) {
        terrainColor += textureGrad(terrainAtlas,uv0,detailDx,detailDy).rgb * weights.r;
        detailNormal += textureGrad(terrainNormal,uv0,detailDx,detailDy) * weights.r;
      }
      if (weights.g > .001) {
        terrainColor += textureGrad(terrainAtlas,uv1,detailDx*.65,detailDy*.65).rgb * weights.g;
        detailNormal += textureGrad(terrainNormal,uv1,detailDx*.65,detailDy*.65) * weights.g;
      }
      if (weights.b > .001) {
        terrainColor += textureGrad(terrainAtlas,uv2,detailDx*.5,detailDy*.5).rgb * weights.b;
        detailNormal += textureGrad(terrainNormal,uv2,detailDx*.5,detailDy*.5) * weights.b;
      }
      if (weights.a > .001) {
        terrainColor += textureGrad(terrainAtlas,uv3,detailDx*.8,detailDy*.8).rgb * weights.a;
        detailNormal += textureGrad(terrainNormal,uv3,detailDx*.8,detailDy*.8) * weights.a;
      }
      float macro = .94 + .055 * sin(terrainUV.x * 73. + sin(terrainUV.y * 41.)) + .035 * cos(terrainUV.y * 97.);
      diffuseColor.rgb *= terrainColor * macro * coverage.g;
    `).replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor *= detailNormal.a;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec3 terrainN = detailNormal.xyz * 2. - 1.;
        normal = normalize(normal + mat3(viewMatrix) * vec3(terrainN.x, 0., -terrainN.y) * .32);
      `)
  }
  heightFog(material)
  const geometry = new THREE.PlaneGeometry(W, H, COLS * 2, ROWS * 2)
  const p = geometry.attributes.position
  // Only inaccessible forest interiors rise. All walkable surfaces remain exactly y=0.
  for (let i = 0; i < p.count; i++) {
    const c = Math.floor((p.getX(i) + COLS) / 2), r = Math.floor((ROWS - p.getY(i)) / 2)
    if (c > 0 && c < COLS - 1 && r > 0 && r < ROWS - 1 && layout.forest[r][c] && layout.solid[r][c]) {
      const fx = (p.getX(i) + COLS) / 2 % 1, fy = (ROWS - p.getY(i)) / 2 % 1
      p.setZ(i, Math.sin(fx * Math.PI) ** 2 * Math.sin(fy * Math.PI) ** 2 * .09)
    }
  }
  geometry.computeVertexNormals()
  const ground = new THREE.Mesh(geometry, material)
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground)
  return { mask: maskTex, dispose() { albedo.dispose(); normals.dispose(); splatTex.dispose(); maskTex.dispose() } }
}

export function enhanceWater(material, mask) {
  const time = { value: 0 }
  material.onBeforeCompile = s => {
    s.uniforms.shoreMask = { value: mask }; s.uniforms.waterTime = time
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 waterUV;').replace('#include <uv_vertex>', '#include <uv_vertex>\nwaterUV = uv;')
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 waterUV; uniform sampler2D shoreMask; uniform float waterTime;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float shore = texture2D(shoreMask, waterUV).b;
        float foam = shore * pow(.5 + .5 * sin((waterUV.x + waterUV.y) * 850. - waterTime * 1.8), 9.) * .28;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.78,.9,.85), foam);
      `).replace('#include <opaque_fragment>', `
        float fresnel = pow(1. - abs(dot(normal, normalize(vViewPosition))), 3.);
        outgoingLight = mix(outgoingLight, vec3(.32,.52,.64), fresnel * .22);
        #include <opaque_fragment>`)
  }
  return time
}
