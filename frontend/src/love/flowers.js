// Procedurally painted flowers (anemones, roses, dahlias), drawn once into small canvases
// and reused as sprites by the burst animation and the decorations.

// accepts '#rrggbb' or 'rgb(r,g,b)' so mixed colours can be mixed again
const hexRgb = (h) => (h.startsWith('rgb') ? h.match(/\d+/g).slice(0, 3).map(Number) : [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)))
const mix = (a, b, t) => {
  const A = hexRgb(a), B = hexRgb(b)
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`
}
const light = (c, t) => mix(c, '#ffffff', t)
const dark = (c, t) => mix(c, '#2a1520', t)

export const PALETTE = ['#d8322f', '#e8662a', '#3f6fd1', '#7fd1b9', '#f3f1ec', '#7a5cc9', '#f2d36b', '#f29bb5', '#ee8fa6', '#e2876a', '#c94f7c', '#9fb7a1']

function anemone(g, s, c) {
  const cx = s / 2, r = s * 0.47
  for (const [n, len, w, rot, col] of [[8, r, r * 0.6, 0, c], [8, r * 0.74, r * 0.5, Math.PI / 8, light(c, 0.16)]]) {
    for (let i = 0; i < n; i++) {
      g.save()
      g.translate(cx, cx)
      g.rotate(rot + (i * Math.PI * 2) / n)
      const gr = g.createLinearGradient(0, 0, len, 0)
      gr.addColorStop(0, light(col, 0.35)); gr.addColorStop(0.55, col); gr.addColorStop(1, dark(col, 0.12))
      g.fillStyle = gr
      g.beginPath(); g.moveTo(0, 0)
      g.bezierCurveTo(len * 0.3, -w, len * 0.96, -w * 0.85, len, 0)
      g.bezierCurveTo(len * 0.96, w * 0.85, len * 0.3, w, 0, 0)
      g.fill()
      g.strokeStyle = 'rgba(40,20,30,.12)'; g.lineWidth = s / 160; g.stroke()
      g.strokeStyle = 'rgba(40,20,30,.1)'
      for (const k of [-0.25, 0, 0.25]) { g.beginPath(); g.moveTo(len * 0.12, 0); g.quadraticCurveTo(len * 0.5, w * k, len * 0.9, w * k * 1.4); g.stroke() }
      g.restore()
    }
  }
  const cg = g.createRadialGradient(cx, cx, 0, cx, cx, r * 0.2)
  cg.addColorStop(0, '#1d1420'); cg.addColorStop(1, '#3b2a3a')
  g.fillStyle = cg; g.beginPath(); g.arc(cx, cx, r * 0.17, 0, 7); g.fill()
  g.fillStyle = '#e9cf7a'
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; g.beginPath(); g.arc(cx + Math.cos(a) * r * 0.22, cx + Math.sin(a) * r * 0.22, s / 90, 0, 7); g.fill() }
}

function rose(g, s, c) {
  const cx = s / 2, r = s * 0.47
  const layers = [[7, 1, 0], [6, 0.8, 0.45], [5, 0.62, 0.9], [5, 0.45, 1.3], [4, 0.3, 1.8]]
  layers.forEach(([n, k, rot], L) => {
    const rad = r * k
    for (let i = 0; i < n; i++) {
      g.save()
      g.translate(cx, cx)
      g.rotate(rot + (i * Math.PI * 2) / n)
      g.translate(rad * 0.42, 0)
      const gr = g.createRadialGradient(-rad * 0.25, 0, rad * 0.05, 0, 0, rad * 0.62)
      gr.addColorStop(0, dark(c, 0.18 + L * 0.04)); gr.addColorStop(0.6, c); gr.addColorStop(1, light(c, 0.28))
      g.fillStyle = gr
      g.beginPath(); g.ellipse(0, 0, rad * 0.58, rad * 0.5, 0, 0, 7); g.fill()
      g.strokeStyle = light(c, 0.45); g.lineWidth = s / 110
      g.beginPath(); g.ellipse(0, 0, rad * 0.56, rad * 0.48, 0, -1.1, 1.1); g.stroke()
      g.restore()
    }
  })
  // the tight swirl in the middle
  g.strokeStyle = dark(c, 0.35); g.lineWidth = s / 75; g.lineCap = 'round'
  g.beginPath()
  for (let t = 0; t < Math.PI * 5; t += 0.15) {
    const rr = (t / (Math.PI * 5)) * r * 0.24
    const x = cx + Math.cos(t) * rr, y = cx + Math.sin(t) * rr
    t === 0 ? g.moveTo(x, y) : g.lineTo(x, y)
  }
  g.stroke()
}

function dahlia(g, s, c) {
  const cx = s / 2, r = s * 0.47
  for (const [n, len, w, rot, t] of [[20, r, r * 0.17, 0, 0], [16, r * 0.78, r * 0.16, 0.2, 0.12], [12, r * 0.56, r * 0.15, 0.1, 0.24], [8, r * 0.34, r * 0.13, 0.3, 0.36]]) {
    for (let i = 0; i < n; i++) {
      g.save()
      g.translate(cx, cx)
      g.rotate(rot + (i * Math.PI * 2) / n)
      const gr = g.createLinearGradient(0, 0, len, 0)
      gr.addColorStop(0, dark(c, 0.2 - t * 0.3)); gr.addColorStop(1, light(c, 0.12 + t))
      g.fillStyle = gr
      g.beginPath(); g.moveTo(0, -w * 0.3); g.quadraticCurveTo(len * 0.6, -w, len, 0); g.quadraticCurveTo(len * 0.6, w, 0, w * 0.3); g.fill()
      g.strokeStyle = 'rgba(40,20,30,.1)'; g.lineWidth = s / 200; g.stroke()
      g.restore()
    }
  }
  g.fillStyle = light(c, 0.5); g.beginPath(); g.arc(cx, cx, r * 0.1, 0, 7); g.fill()
}

const KINDS = { anemone, rose, dahlia }

export function makeFlower(kind, color, size = 220) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')
  g.shadowColor = 'rgba(60,20,40,.25)'
  g.shadowBlur = size * 0.05
  g.shadowOffsetY = size * 0.02
  KINDS[kind](g, size, color)
  return c
}

let cache = null
/** A shared set of ~30 flower sprites in every kind and colour. */
export function flowerSet() {
  if (cache) return cache
  cache = []
  PALETTE.forEach((col, i) => {
    cache.push(makeFlower('anemone', col))
    cache.push(makeFlower(i % 2 ? 'rose' : 'dahlia', col))
    if (i % 3 === 0) cache.push(makeFlower('rose', col))
  })
  return cache
}

const urlCache = new Map()
/** Data URL of a flower, for use in <img> decorations. */
export function flowerUrl(kind, color, size = 160) {
  const k = `${kind}|${color}|${size}`
  if (!urlCache.has(k)) urlCache.set(k, makeFlower(kind, color, size).toDataURL())
  return urlCache.get(k)
}
