// Generates soft, dreamy placeholder "photos" (SVG) so the sample looks complete.
// Replace files in public/photos with your real pictures (and update backend/story.json).
import { mkdirSync, writeFileSync } from 'node:fs'

const out = new URL('../public/photos/', import.meta.url)
mkdirSync(out, { recursive: true })

const palettes = [
  { sky: ['#ffe6d5', '#ffc2b8', '#f4a6c0'], sun: '#fff6df', hills: ['#e49ab0', '#c4708a', '#8f4a63'] },
  { sky: ['#fff1e0', '#ffd4b0', '#f9aaa4'], sun: '#fffbe8', hills: ['#eba28f', '#c97a7a', '#8d5060'] },
  { sky: ['#efe3ff', '#f8c9e2', '#ffd9c4'], sun: '#fff4f8', hills: ['#cf9ac6', '#a971a8', '#6f4a82'] },
  { sky: ['#e3f1ff', '#f6d5ea', '#ffd0c2'], sun: '#fffaf0', hills: ['#b9a0d0', '#9a7bb8', '#6a5391'] },
  { sky: ['#fff4d9', '#ffd8a8', '#ffb6a0'], sun: '#fffdf2', hills: ['#e6a07c', '#c47a68', '#8a4e50'] },
  { sky: ['#ffe8ee', '#ffc8d6', '#f2a0b8'], sun: '#fff8fa', hills: ['#e08aa4', '#bd6584', '#7f3f5f'] },
  { sky: ['#fdebd9', '#f9cfc4', '#e9b0cb'], sun: '#fff7e6', hills: ['#d494a8', '#b0708a', '#774a68'] },
  { sky: ['#f9e6ff', '#ffcfe0', '#ffe0b8'], sun: '#fffbea', hills: ['#da9fc0', '#b87aa4', '#7e5088'] },
]

const rng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

function scene(name, w, h, pi, seed) {
  const r = rng(seed)
  const p = palettes[pi % palettes.length]
  const sx = w * (0.25 + r() * 0.5)
  const sy = h * (0.38 + r() * 0.12)

  let bokeh = ''
  for (let i = 0; i < 26; i++) {
    const rad = 14 + r() * (i % 3 === 0 ? 70 : 38)
    bokeh += `<circle cx="${(r() * w).toFixed(0)}" cy="${(r() * h * 0.85).toFixed(0)}" r="${rad.toFixed(0)}" fill="#fff" opacity="${(0.1 + r() * 0.3).toFixed(2)}" filter="url(#b${i % 2})"/>`
  }

  let sparks = ''
  for (let i = 0; i < 40; i++) {
    sparks += `<circle cx="${(r() * w).toFixed(0)}" cy="${(r() * h * 0.5).toFixed(0)}" r="${(0.8 + r() * 1.8).toFixed(1)}" fill="#fff" opacity="${(0.4 + r() * 0.5).toFixed(2)}"/>`
  }

  const hill = (base, amp, f, ph, fill, op) => {
    let d = `M0 ${h} L0 ${base}`
    for (let x = 0; x <= w; x += 20) d += ` L${x} ${(base + Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.3 + ph * 2) * amp * 0.4).toFixed(1)}`
    return `<path d="${d} L${w} ${h} Z" fill="${fill}" opacity="${op}"/>`
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sky[0]}"/><stop offset=".55" stop-color="${p.sky[1]}"/><stop offset="1" stop-color="${p.sky[2]}"/></linearGradient>
  <radialGradient id="sun" cx="${sx}" cy="${sy}" r="${h * 0.7}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${p.sun}" stop-opacity="1"/><stop offset=".25" stop-color="${p.sun}" stop-opacity=".55"/><stop offset="1" stop-color="${p.sun}" stop-opacity="0"/></radialGradient>
  <filter id="b0" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
  <filter id="b1" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
</defs>
<rect width="${w}" height="${h}" fill="url(#sky)"/>
<rect width="${w}" height="${h}" fill="url(#sun)"/>
<circle cx="${sx}" cy="${sy}" r="${h * 0.07}" fill="${p.sun}" opacity=".95"/>
${sparks}
${bokeh}
${hill(h * 0.68, h * 0.05, 0.004, r() * 6, p.hills[0], 0.85)}
${hill(h * 0.78, h * 0.045, 0.006, r() * 6, p.hills[1], 0.92)}
${hill(h * 0.9, h * 0.035, 0.009, r() * 6, p.hills[2], 1)}
</svg>`
  writeFileSync(new URL(name, out), svg)
}

scene('hero1.svg', 1600, 900, 0, 11)
scene('hero2.svg', 1600, 900, 4, 22)
scene('hero3.svg', 1600, 900, 2, 33)
scene('p1.svg', 900, 1200, 0, 101)
scene('p2.svg', 1200, 900, 5, 102)
scene('p3.svg', 1000, 1000, 1, 103)
scene('p4.svg', 900, 1200, 2, 104)
scene('p5.svg', 1200, 900, 4, 105)
scene('p6.svg', 900, 1200, 6, 106)
scene('p7.svg', 1000, 1000, 7, 107)
scene('p8.svg', 1200, 900, 3, 108)
console.log('Generated 11 placeholder photos in public/photos')
