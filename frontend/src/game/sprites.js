// Pre-rendered hand-inked sprites (buildings, trees, lamps, fountain, bench).
// Every sprite gets a wobbly ink outline so the town looks drawn with a pen on paper.
export const RES = 3
export const PAD = 3 // transparent margin (world units) around each sprite for the outline
const TS = 32
const INK = '#4a3340'

/** Wrap a sprite canvas in a slightly wobbly ink outline. `src` must have a transparent margin. */
export function inkOutline(src, thickPx, ink = INK) {
  const w = src.width, h = src.height
  const tint = document.createElement('canvas')
  tint.width = w; tint.height = h
  const t = tint.getContext('2d')
  t.drawImage(src, 0, 0)
  t.globalCompositeOperation = 'source-in'
  t.fillStyle = ink
  t.fillRect(0, 0, w, h)

  const out = document.createElement('canvas')
  out.width = w; out.height = h
  const o = out.getContext('2d')
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2
    const r = thickPx * (0.75 + 0.5 * ((i * 7) % 5) / 4)
    o.drawImage(tint, Math.cos(a) * r, Math.sin(a) * r)
  }
  o.drawImage(src, 0, 0)
  return out
}

function make(w, h, fn) {
  const c = document.createElement('canvas')
  c.width = Math.ceil((w + PAD * 2) * RES)
  c.height = Math.ceil((h + PAD * 2) * RES)
  const x = c.getContext('2d')
  x.scale(RES, RES)
  x.translate(PAD, PAD)
  fn(x)
  return inkOutline(c, 1.25 * RES)
}
const rr = (x, a, b, w, h, r) => { x.beginPath(); x.roundRect(a, b, w, h, r) }

const STYLES = {
  home:  { wall: '#fbe3d6', trim: '#e3a08d', roof: '#d9715f', door: '#9a4e44', sign: '#c4574a', floors: 2 },
  pg:    { wall: '#e4e6f0', trim: '#b4bbd6', roof: '#7d87b0', door: '#5a6690', sign: '#5a6690', floors: 4 },
  cafe:  { wall: '#fdeccf', trim: '#eec497', roof: '#e0954f', door: '#845638', sign: '#a2653a', floors: 2 },
  stage: { wall: '#efe2f7', trim: '#d2b5e8', roof: '#b088d0', door: '#b03a4f', sign: '#86589e', floors: 2 },
  post:  { wall: '#fde2dc', trim: '#f0b0a8', roof: '#df5a58', door: '#85353f', sign: '#c04650', floors: 2 },
  college: { wall: '#f6e7d2', trim: '#d8b48c', roof: '#a34a3c', door: '#6e3b2f', sign: '#8d3a2e', floors: 3 },
  museum:  { wall: '#f4f1ea', trim: '#cfc6b8', roof: '#8e9bb0', door: '#5b5f6e', sign: '#5b5f6e', floors: 0 },
  cinema:  { wall: '#fbe3e6', trim: '#e6a2ad', roof: '#6d5a9c', door: '#43365e', sign: '#c43a5a', floors: 0 },
  arcade:  { wall: '#e6f3ec', trim: '#a8d4c0', roof: '#5fb3a0', door: '#2f6f62', sign: '#2f8f7a', floors: 2 },
}

function windowAt(x, cx, cy, w = 22, h = 22, box = false) {
  x.fillStyle = '#fffaf0'
  rr(x, cx - w / 2 - 2, cy - 2, w + 4, h + 4, 4); x.fill()
  const g = x.createLinearGradient(0, cy, 0, cy + h)
  g.addColorStop(0, '#c4e2f2'); g.addColorStop(1, '#fbe6c4')
  x.fillStyle = g
  rr(x, cx - w / 2, cy, w, h, 3); x.fill()
  x.strokeStyle = '#fffaf0'; x.lineWidth = 1.5
  x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx, cy + h); x.moveTo(cx - w / 2, cy + h / 2); x.lineTo(cx + w / 2, cy + h / 2); x.stroke()
  x.strokeStyle = 'rgba(74,51,64,.55)'; x.lineWidth = 1
  rr(x, cx - w / 2 - 2, cy - 2, w + 4, h + 4, 4); x.stroke()
  if (box) {
    x.fillStyle = '#9a6a52'; x.fillRect(cx - w / 2 - 2, cy + h + 2, w + 4, 5)
    for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#f08a9c' : '#f8c6d0'; x.beginPath(); x.arc(cx - w / 2 + 3 + i * (w - 4) / 3, cy + h + 1, 3, 0, 7); x.fill() }
  }
}

function hatch(x, x0, y0, w, h, gap = 5, alpha = 0.13) {
  x.save()
  x.beginPath(); x.rect(x0, y0, w, h); x.clip()
  x.strokeStyle = `rgba(74,51,64,${alpha})`; x.lineWidth = 1
  for (let i = -h; i < w; i += gap) { x.beginPath(); x.moveTo(x0 + i, y0 + h); x.lineTo(x0 + i + h, y0); x.stroke() }
  x.restore()
}

export function buildingSprite(kind, cols, rows, label) {
  const S = STYLES[kind]
  const W = cols * TS + 16
  const H = rows * TS + 20
  const wy = 58
  const wh = H - wy - 2
  return {
    W, H,
    canvas: make(W, H, (x) => {
      x.fillStyle = 'rgba(74,51,64,.16)'
      x.beginPath(); x.ellipse(W / 2, H - 2, W / 2 - 2, 6, 0, 0, 7); x.fill()

      if (kind === 'home') { x.fillStyle = '#c48a7a'; x.fillRect(W * 0.7, 0, 15, 34); x.fillStyle = '#a56a5c'; x.fillRect(W * 0.7 - 2, 0, 19, 5) }

      // wall
      x.fillStyle = S.wall; rr(x, 8, wy, W - 16, wh, 4); x.fill()
      hatch(x, 8 + (W - 16) * 0.68, wy, (W - 16) * 0.32, wh)
      x.fillStyle = S.trim; x.fillRect(8, H - 9, W - 16, 7)

      if (kind === 'stage') for (const px of [14, W - 24]) { x.fillStyle = '#fff'; x.fillRect(px, wy + 10, 10, wh - 12); x.strokeStyle = 'rgba(74,51,64,.5)'; x.strokeRect(px, wy + 10, 10, wh - 12) }

      // roof
      x.fillStyle = S.roof
      x.beginPath(); x.moveTo(0, wy + 10); x.lineTo(W, wy + 10); x.lineTo(W - 20, 6); x.lineTo(20, 6); x.closePath(); x.fill()
      hatch(x, 0, 6, W, wy + 4, 6, 0.16)
      x.strokeStyle = 'rgba(74,51,64,.22)'; x.lineWidth = 1
      for (let y = 14; y < wy + 8; y += 9) { x.beginPath(); x.moveTo(6 + (y - 6) * 0.05, y); x.lineTo(W - 6 - (y - 6) * 0.05, y); x.stroke() }
      x.fillStyle = S.trim; x.fillRect(0, wy + 6, W, 6)
      x.strokeStyle = 'rgba(74,51,64,.6)'; x.lineWidth = 1.2; x.strokeRect(0, wy + 6, W, 6)

      // windows
      const doorX = W / 2
      const perRow = Math.max(2, Math.floor(cols / 2))
      for (let f = 0; f < S.floors; f++) {
        const ground = f === S.floors - 1
        const cy = wy + 22 + f * 38
        for (let k = 0; k < perRow; k++) {
          const cx = 8 + ((W - 16) * (k + 0.5)) / perRow
          if (ground && Math.abs(cx - doorX) < 30) continue
          if (kind === 'cafe' && ground) continue
          if (kind === 'college' && f === 0 && Math.abs(cx - doorX) < 30) continue
          windowAt(x, cx, cy, 20, 22, kind === 'home' || kind === 'post' || (kind === 'pg' && f % 2))
        }
      }

      if (kind === 'cafe') {
        for (const cx of [W * 0.22, W * 0.78]) windowAt(x, cx, H - 56, 30, 34)
        for (let i = 0; i < Math.floor((W - 16) / 12); i++) {
          x.fillStyle = i % 2 ? '#fffaf0' : '#f28fa2'
          x.beginPath(); x.moveTo(8 + i * 12, H - 80); x.lineTo(20 + i * 12, H - 80); x.lineTo(20 + i * 12, H - 66); x.arc(14 + i * 12, H - 66, 6, 0, Math.PI); x.closePath(); x.fill()
        }
        x.font = '16px serif'; x.textAlign = 'center'; x.fillText('☕', W * 0.78, H - 90)
      }

      if (kind === 'museum') {
        for (let k = 0; k < 6; k++) {
          const cx = 16 + (k * (W - 32)) / 5
          x.fillStyle = '#fffdf8'; x.fillRect(cx - 6, wy + 16, 12, wh - 30)
          x.fillStyle = 'rgba(74,51,64,.12)'; x.fillRect(cx + 2, wy + 16, 4, wh - 30)
          x.fillStyle = S.trim; x.fillRect(cx - 8, wy + 12, 16, 5); x.fillRect(cx - 8, H - 20, 16, 5)
          const fx = cx + (W - 32) / 10
          if (k < 5 && Math.abs(fx - W / 2) > 30) {
            x.fillStyle = '#c9a36b'; x.fillRect(fx - 12, wy + 34, 24, 30)
            x.fillStyle = ['#f4b6c4', '#bcdcea', '#f8d78a', '#c9b6e8', '#b8e0c4'][k]; x.fillRect(fx - 9, wy + 37, 18, 24)
          }
        }
        x.fillStyle = '#e6ded0'; x.fillRect(4, H - 13, W - 8, 5); x.fillRect(8, H - 8, W - 16, 5)
      }
      if (kind === 'cinema') {
        const mw = W * 0.72, mx = (W - mw) / 2, my = wy + 20
        x.fillStyle = '#43365e'; rr(x, mx, my, mw, 36, 6); x.fill()
        x.fillStyle = '#ffe9a8'
        for (let i = 0; i < 18; i++) { const bx = mx + 6 + (i * (mw - 12)) / 17; x.beginPath(); x.arc(bx, my + 4, 1.8, 0, 7); x.arc(bx, my + 32, 1.8, 0, 7); x.fill() }
        x.textAlign = 'center'
        x.fillStyle = '#fff'; x.font = '700 9px Inter, sans-serif'; x.fillText('NOW SHOWING', W / 2, my + 16)
        x.fillStyle = '#ffb3c6'; x.font = '700 11px Inter, sans-serif'; x.fillText('US ♥', W / 2, my + 28)
        for (const px of [W * 0.15, W * 0.85]) {
          x.fillStyle = '#fffaf0'; rr(x, px - 15, H - 66, 30, 44, 3); x.fill()
          x.fillStyle = px < W / 2 ? '#f2a0b4' : '#a9c8e8'; x.fillRect(px - 12, H - 63, 24, 32)
          x.fillStyle = '#fff'; x.font = '12px serif'; x.fillText('♥', px, H - 43)
        }
      }
      if (kind === 'college') {
        x.fillStyle = '#fffaf0'; x.beginPath(); x.arc(W / 2, wy + 32, 13, 0, 7); x.fill()
        x.strokeStyle = INK; x.lineWidth = 1.5; x.stroke()
        x.beginPath(); x.moveTo(W / 2, wy + 32); x.lineTo(W / 2, wy + 23); x.moveTo(W / 2, wy + 32); x.lineTo(W / 2 + 7, wy + 34); x.stroke()
        for (const px of [W / 2 - 32, W / 2 + 24]) { x.fillStyle = '#fffaf0'; x.fillRect(px, H - 62, 8, 53); x.strokeStyle = 'rgba(74,51,64,.5)'; x.strokeRect(px, H - 62, 8, 53) }
        for (const fx of [12, W - 12]) {
          x.strokeStyle = INK; x.lineWidth = 1.3; x.beginPath(); x.moveTo(fx, wy + 8); x.lineTo(fx, wy - 18); x.stroke()
          x.fillStyle = '#f2b830'; x.beginPath(); x.moveTo(fx, wy - 18); x.lineTo(fx + (fx < W / 2 ? 13 : -13), wy - 13); x.lineTo(fx, wy - 8); x.fill()
        }
      }
      if (kind === 'arcade') {
        x.textAlign = 'center'; x.font = '700 16px Inter, sans-serif'
        for (const [px, ch] of [[W * 0.18, '?'], [W * 0.82, '★']]) { x.fillStyle = '#fffaf0'; x.beginPath(); x.arc(px, wy - 6, 11, 0, 7); x.fill(); x.fillStyle = '#2f8f7a'; x.fillText(ch, px, wy - 0.5) }
      }

      // door
      const dx = W / 2 - 16
      const dy = H - 9 - 42
      x.fillStyle = '#fffaf0'; rr(x, dx - 3, dy - 3, 38, 46, [16, 16, 0, 0]); x.fill()
      x.fillStyle = S.door; rr(x, dx, dy, 32, 42, [14, 14, 0, 0]); x.fill()
      x.strokeStyle = 'rgba(255,255,255,.3)'; x.lineWidth = 1.5; rr(x, dx + 4, dy + 5, 10, 30, 5); x.stroke(); rr(x, dx + 18, dy + 5, 10, 30, 5); x.stroke()
      x.fillStyle = '#ffd37a'; x.beginPath(); x.arc(dx + 26, dy + 24, 2.2, 0, 7); x.fill()

      if (kind === 'post') { x.fillStyle = '#d8344a'; rr(x, W - 34, H - 40, 15, 24, [8, 8, 2, 2]); x.fill(); x.fillStyle = '#7a1a28'; x.fillRect(W - 31, H - 30, 9, 2); x.fillRect(W - 28, H - 16, 3, 10) }
      if (kind === 'stage') { x.font = '20px serif'; x.textAlign = 'center'; x.fillStyle = '#f2b830'; x.fillText('★', W / 2, 24) }
      if (kind === 'home') { x.font = '14px serif'; x.textAlign = 'center'; x.fillStyle = '#fff'; x.fillText('♥', W / 2, wy - 14) }

      // rooftop sign
      x.font = '600 11px Inter, sans-serif'
      const tw = x.measureText(label).width + 20
      const sy = kind === 'stage' ? 30 : 24
      x.fillStyle = S.sign; rr(x, W / 2 - tw / 2, sy, tw, 18, 6); x.fill()
      x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 1; rr(x, W / 2 - tw / 2 + 2, sy + 2, tw - 4, 14, 4); x.stroke()
      x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(label, W / 2, sy + 9.5); x.textBaseline = 'alphabetic'
    }),
  }
}

export function treeSprite(kind) {
  const pink = kind === 'pink'
  const cols = pink ? ['#f6bccd', '#f09db4', '#fcd9e3'] : ['#a2d49c', '#7dbb86', '#c0e6ae']
  return {
    W: 60, H: 76,
    canvas: make(60, 76, (x) => {
      x.fillStyle = 'rgba(74,51,64,.16)'; x.beginPath(); x.ellipse(30, 70, 17, 5, 0, 0, 7); x.fill()
      x.fillStyle = '#9a6a52'; rr(x, 26, 44, 9, 26, 3); x.fill()
      x.fillStyle = '#80543f'; x.fillRect(31, 46, 4, 24)
      for (const [cx, cy, r, c] of [[19, 40, 17, cols[1]], [41, 40, 17, cols[1]], [30, 24, 22, cols[0]], [30, 40, 18, cols[0]]]) { x.fillStyle = c; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill() }
      x.fillStyle = cols[2]
      for (const [cx, cy, r] of [[24, 18, 7], [38, 30, 6], [20, 36, 5], [34, 14, 4]]) { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill() }
      hatch(x, 30, 20, 34, 40, 5, 0.1)
    }),
  }
}

export function lampSprite() {
  return {
    W: 20, H: 52,
    canvas: make(20, 52, (x) => {
      x.fillStyle = 'rgba(74,51,64,.16)'; x.beginPath(); x.ellipse(10, 48, 7, 3, 0, 0, 7); x.fill()
      x.fillStyle = '#7a5a68'; x.fillRect(8.5, 14, 3, 34); x.fillRect(5, 44, 10, 4)
      x.fillStyle = '#fff3c4'; rr(x, 6.5, 5, 7, 10, 3); x.fill()
    }),
  }
}

export function fountainSprite() {
  return {
    W: 104, H: 92,
    canvas: make(104, 92, (x) => {
      x.fillStyle = 'rgba(74,51,64,.18)'; x.beginPath(); x.ellipse(52, 78, 46, 10, 0, 0, 7); x.fill()
      x.fillStyle = '#ece0d6'; x.beginPath(); x.ellipse(52, 64, 46, 20, 0, 0, 7); x.fill()
      x.fillStyle = '#d2bfb4'; x.beginPath(); x.ellipse(52, 68, 46, 20, 0, 0, Math.PI); x.fill()
      x.fillStyle = '#bcdcea'; x.beginPath(); x.ellipse(52, 62, 38, 15, 0, 0, 7); x.fill()
      x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.ellipse(44, 58, 14, 4, 0, 0, 7); x.fill()
      x.fillStyle = '#ece0d6'; rr(x, 46, 28, 12, 36, 4); x.fill(); x.beginPath(); x.ellipse(52, 34, 18, 7, 0, 0, 7); x.fill()
      x.strokeStyle = 'rgba(120,180,210,.95)'; x.lineWidth = 2.5; x.lineCap = 'round'
      for (const d of [-1, 0, 1]) { x.beginPath(); x.moveTo(52, 26); x.quadraticCurveTo(52 + d * 22, 6, 52 + d * 30, 44); x.stroke() }
      x.fillStyle = '#e8627c'; x.font = '14px serif'; x.textAlign = 'center'; x.fillText('♥', 52, 22)
    }),
  }
}

export function benchSprite() {
  return {
    W: 72, H: 40,
    canvas: make(72, 40, (x) => {
      x.fillStyle = 'rgba(74,51,64,.16)'; x.beginPath(); x.ellipse(36, 34, 30, 5, 0, 0, 7); x.fill()
      x.fillStyle = '#7a5a68'; x.fillRect(8, 22, 4, 12); x.fillRect(60, 22, 4, 12)
      x.fillStyle = '#c98a6a'; rr(x, 4, 8, 64, 7, 3); x.fill(); rr(x, 4, 17, 64, 7, 3); x.fill()
      x.fillStyle = '#f2a9b9'; rr(x, 24, 13, 24, 5, 2.5); x.fill()
    }),
  }
}
