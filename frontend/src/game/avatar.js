// Procedural chibi avatar, drawn with canvas shapes so every combination of look works.
import { inkOutline } from './sprites.js'

export const DEFAULT_LOOK = {
  skin: '#e0ac86',
  hairColor: '#2a1a1f',
  hair: 'long',
  top: '#fff6ee',
  bottom: '#4f78a8',
  extra: 'flower',
}

export const OPTIONS = {
  skin: ['#f6d5bd', '#ecbf9a', '#e0ac86', '#c68a62', '#9a6244', '#6e4330'],
  hairColor: ['#1d1218', '#2a1a1f', '#5a3426', '#8a5a3a', '#c9a06a', '#c44a6a'],
  hair: [['long', 'Long'], ['braid', 'Braid'], ['bun', 'Bun'], ['short', 'Bob']],
  top: ['#fff6ee', '#f4a6b8', '#c9a8e8', '#9ed0c0', '#ffd37a', '#e8705f'],
  bottom: ['#4f78a8', '#2e3a56', '#e8c9d4', '#6b8f71'],
  extra: [['flower', 'Flower'], ['glasses', 'Glasses'], ['none', 'None']],
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const mix = (a, b, t) => {
  const [r1, g1, b1] = hex(a)
  const [r2, g2, b2] = hex(b)
  return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`
}
const dark = (c, t = 0.25) => mix(c, '#2a1520', t)

function flower(ctx, x, y) {
  ctx.fillStyle = '#ff8fab'
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * 2.4, y + Math.sin(a) * 2.4, 1.9, 0, 7); ctx.fill()
  }
  ctx.fillStyle = '#ffe27a'
  ctx.beginPath(); ctx.arc(x, y, 1.4, 0, 7); ctx.fill()
}

/**
 * Draw the avatar with its feet at (x, y).
 * dir: 'down' | 'up' | 'left' | 'right'; phase: walk cycle 0..1
 */
export function drawAvatar(ctx, look, x, y, dir = 'down', phase = 0, moving = false, scale = 1, shadow = true) {
  const { skin, hairColor: hc, hair, top, bottom, extra } = look
  const side = dir === 'left' || dir === 'right'
  const swing = moving ? Math.sin(phase * Math.PI * 2) * 3.2 : 0
  const bob = moving ? Math.abs(Math.sin(phase * Math.PI * 2)) * 1.5 : 0
  const hairD = dark(hc, 0.3)

  ctx.save()
  ctx.translate(x, y)
  ctx.scale(dir === 'left' ? -scale : scale, scale)

  if (shadow) {
    ctx.fillStyle = 'rgba(74,51,64,.18)'
    ctx.beginPath(); ctx.ellipse(0, 1, 11, 4, 0, 0, 7); ctx.fill()
  }

  // legs
  const shoe = '#5b2c3f'
  if (!side) {
    for (const [i, s] of [[-1, swing], [1, -swing]]) {
      const lift = Math.max(0, s) * 0.7
      ctx.fillStyle = bottom
      ctx.fillRect(i * 4.6 - 2.3, -13, 4.6, 11 - lift)
      ctx.fillStyle = shoe
      ctx.fillRect(i * 4.6 - 2.6, -3 - lift, 5.2, 3)
    }
  } else {
    for (const s of [swing, -swing]) {
      ctx.fillStyle = bottom
      ctx.fillRect(-2.3 + s, -13, 4.6, 11)
      ctx.fillStyle = shoe
      ctx.fillRect(-2.6 + s, -3, 6, 3)
    }
  }

  ctx.translate(0, -bob)

  // long / braid hair behind the body
  if (dir === 'up' || side) {
    if (hair === 'long') { ctx.fillStyle = hc; ctx.beginPath(); ctx.roundRect(side ? -11 : -10.5, -36, side ? 10 : 21, 26, 7); ctx.fill() }
  }

  // torso + arms
  ctx.fillStyle = top
  ctx.beginPath(); ctx.roundRect(side ? -5.5 : -7.5, -26, side ? 11 : 15, 15, 4); ctx.fill()
  ctx.fillStyle = dark(top, 0.08)
  ctx.fillRect(side ? -5.5 : -7.5, -13, side ? 11 : 15, 2)
  if (!side) {
    for (const [i, s] of [[-1, -swing], [1, swing]]) {
      ctx.fillStyle = top
      ctx.beginPath(); ctx.roundRect(i * 9.5 - 1.8, -25 + s * 0.3, 3.6, 10, 2); ctx.fill()
      ctx.fillStyle = skin
      ctx.beginPath(); ctx.arc(i * 9.5, -14 + s * 0.3, 1.8, 0, 7); ctx.fill()
    }
  } else {
    ctx.fillStyle = top
    ctx.beginPath(); ctx.roundRect(-1.8 + swing * 0.5, -25, 3.6, 10, 2); ctx.fill()
    ctx.fillStyle = skin
    ctx.beginPath(); ctx.arc(swing * 0.5, -14, 1.8, 0, 7); ctx.fill()
  }

  // head
  const hy = -32
  ctx.fillStyle = skin
  ctx.beginPath(); ctx.arc(0, hy, 9.5, 0, 7); ctx.fill()

  // face
  if (dir === 'down') {
    ctx.fillStyle = '#3a2430'
    ctx.beginPath(); ctx.ellipse(-3.6, hy + 0.5, 1.1, 1.6, 0, 0, 7); ctx.ellipse(3.6, hy + 0.5, 1.1, 1.6, 0, 0, 7); ctx.fill()
    ctx.fillStyle = 'rgba(255,110,140,.35)'
    ctx.beginPath(); ctx.arc(-6, hy + 3.5, 1.9, 0, 7); ctx.arc(6, hy + 3.5, 1.9, 0, 7); ctx.fill()
    ctx.strokeStyle = '#a04a5e'; ctx.lineWidth = 0.9
    ctx.beginPath(); ctx.arc(0, hy + 3.6, 1.8, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke()
  } else if (side) {
    ctx.fillStyle = '#3a2430'
    ctx.beginPath(); ctx.ellipse(4.2, hy + 0.5, 1, 1.6, 0, 0, 7); ctx.fill()
    ctx.fillStyle = 'rgba(255,110,140,.35)'
    ctx.beginPath(); ctx.arc(6.2, hy + 3.4, 1.7, 0, 7); ctx.fill()
    ctx.fillStyle = skin
    ctx.beginPath(); ctx.arc(-1, hy + 1.5, 2, 0, 7); ctx.fill()
  }

  // hair on the head
  ctx.fillStyle = hc
  if (dir === 'up') {
    ctx.beginPath(); ctx.arc(0, hy, 10.4, 0, 7); ctx.fill()
    if (hair === 'long') { ctx.beginPath(); ctx.roundRect(-10.2, hy, 20.4, 22, 7); ctx.fill() }
    if (hair === 'braid') { for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? hairD : hc; ctx.beginPath(); ctx.arc(0, hy + 8 + i * 3.4, 2.5, 0, 7); ctx.fill() } }
  } else if (dir === 'down') {
    ctx.beginPath(); ctx.moveTo(-10.2, hy + 1); ctx.bezierCurveTo(-11, hy - 15, 11, hy - 15, 10.2, hy + 1)
    ctx.quadraticCurveTo(5, hy - 3, 0, hy - 4.5); ctx.quadraticCurveTo(-5, hy - 3, -10.2, hy + 1); ctx.fill()
    if (hair === 'long') {
      ctx.beginPath(); ctx.roundRect(-10.4, hy - 2, 4.2, 22, 2); ctx.roundRect(6.2, hy - 2, 4.2, 22, 2); ctx.fill()
    } else if (hair === 'short') {
      ctx.beginPath(); ctx.roundRect(-10.4, hy - 2, 4, 10, 2); ctx.roundRect(6.4, hy - 2, 4, 10, 2); ctx.fill()
    } else if (hair === 'braid') {
      ctx.beginPath(); ctx.roundRect(-10.4, hy - 2, 3.6, 8, 2); ctx.fill()
      for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? hairD : hc; ctx.beginPath(); ctx.arc(7.6, hy + 5 + i * 3.4, 2.4, 0, 7); ctx.fill() }
      ctx.fillStyle = '#ff8fab'; ctx.beginPath(); ctx.arc(7.6, hy + 22, 1.8, 0, 7); ctx.fill()
    }
  } else {
    // side view hair cap
    ctx.beginPath(); ctx.arc(-1.5, hy - 0.5, 10.2, 0, 7); ctx.fill()
    ctx.beginPath(); ctx.moveTo(1, hy - 9); ctx.quadraticCurveTo(9.5, hy - 8, 9.6, hy - 1.5); ctx.quadraticCurveTo(5, hy - 4, 1, hy - 4.5); ctx.fill()
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(-0.5, hy + 1.8, 2, 0, 7); ctx.fill()
    if (hair === 'braid') { for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? hairD : hc; ctx.beginPath(); ctx.arc(-9 - i * 0.4, hy + 6 + i * 3.2, 2.4, 0, 7); ctx.fill() } }
  }
  ctx.fillStyle = hc
  if (hair === 'bun') { ctx.beginPath(); ctx.arc(dir === 'right' || dir === 'left' ? -3 : 0, hy - 11, 4.8, 0, 7); ctx.fill(); ctx.fillStyle = '#ff8fab'; ctx.fillRect(-4, hy - 7.4, 8, 1.4) }

  // long hair locks in front for the down view are drawn above; accessories last
  if (extra === 'flower') {
    if (dir === 'down') flower(ctx, -7.2, hy - 6)
    else if (dir === 'up') flower(ctx, 7.2, hy - 6)
    else flower(ctx, 2, hy - 8.4)
  } else if (extra === 'beard') {
    ctx.fillStyle = hc
    ctx.globalAlpha = 0.9
    if (dir === 'down') {
      ctx.beginPath(); ctx.moveTo(-8.6, hy + 1); ctx.quadraticCurveTo(-8, hy + 9.8, 0, hy + 10); ctx.quadraticCurveTo(8, hy + 9.8, 8.6, hy + 1)
      ctx.quadraticCurveTo(6, hy + 6, 0, hy + 6.2); ctx.quadraticCurveTo(-6, hy + 6, -8.6, hy + 1); ctx.fill()
      ctx.beginPath(); ctx.ellipse(0, hy + 4.4, 3.4, 1.1, 0, 0, 7); ctx.fill()
    } else if (side) {
      ctx.beginPath(); ctx.moveTo(0, hy + 2); ctx.quadraticCurveTo(1, hy + 10, 6, hy + 8.5); ctx.quadraticCurveTo(9, hy + 6, 9.2, hy + 3); ctx.quadraticCurveTo(5, hy + 5.5, 0, hy + 2); ctx.fill()
    }
    ctx.globalAlpha = 1
  } else if (extra === 'glasses') {
    ctx.strokeStyle = '#5b2c3f'; ctx.lineWidth = 1
    if (dir === 'down') { ctx.beginPath(); ctx.arc(-3.7, hy + 0.5, 3.1, 0, 7); ctx.arc(3.7, hy + 0.5, 3.1, 0, 7); ctx.moveTo(-0.6, hy + 0.3); ctx.lineTo(0.6, hy + 0.3); ctx.stroke() }
    else if (side) { ctx.beginPath(); ctx.arc(4.2, hy + 0.5, 3.1, 0, 7); ctx.moveTo(1.1, hy + 0.5); ctx.lineTo(-6, hy - 0.5); ctx.stroke() }
  }

  ctx.restore()
}

// ---- inked, cached version (same pen-and-paper look as the buildings) ----
const AW = 50 // sprite box in avatar units: x -25..25 around the centre, y -59..11 around the feet
const AH = 70
const cache = new Map()

/** Draw the avatar with an ink outline; frames are rendered once and cached. */
export function drawAvatarInked(ctx, look, x, y, dir = 'down', phase = 0, moving = false, scale = 1) {
  const R = Math.max(4, Math.round(scale * 3))
  const bucket = moving ? Math.floor(phase * 8) % 8 : 0
  const key = `${JSON.stringify(look)}|${dir}|${bucket}|${moving}|${R}`
  let spr = cache.get(key)
  if (!spr) {
    if (cache.size > 160) cache.clear()
    const c = document.createElement('canvas')
    c.width = AW * R
    c.height = AH * R
    const g = c.getContext('2d')
    g.scale(R, R)
    drawAvatar(g, look, AW / 2, 59, dir, (bucket + 0.5) / 8, moving, 1, false)
    spr = inkOutline(c, 0.9 * R)
    cache.set(key, spr)
  }
  ctx.fillStyle = 'rgba(74,51,64,.18)'
  ctx.beginPath(); ctx.ellipse(x, y + 1, 11 * scale, 4 * scale, 0, 0, 7); ctx.fill()
  ctx.drawImage(spr, x - (AW / 2) * scale, y - 59 * scale, AW * scale, AH * scale)
}
