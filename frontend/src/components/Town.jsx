import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { drawAvatarInked } from '../game/avatar.js'
import { TS, WORLD_H, WORLD_W } from '../game/world.js'
import PlaceModal from './PlaceModal.jsx'
// the 3D museum (three.js) only downloads when she walks in
const Museum = lazy(() => import('./Museum.jsx'))
import Arcade from './Arcade.jsx'

const SPEED = 105
const RUN = 170
const NEAR = 56
const INTRO = 4.2
const CYCLE = 300 // seconds for a full day
const KEYMAP = { w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right' }
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
const GAMES_KEY = 'love-town-games'
const loadGames = () => { try { return JSON.parse(localStorage.getItem(GAMES_KEY)) || [] } catch { return [] } }
const dirOf = (vx, vy) => (Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : vy > 0 ? 'down' : 'up')

export default function Town({ look, name, story, world, onEditAvatar }) {
  const canvas = useRef(null)
  const miniRef = useRef(null)
  const [near, setNear] = useState(null)
  const [open, setOpen] = useState(null)
  const [count, setCount] = useState(0)
  const [toast, setToast] = useState('')
  const [ready, setReady] = useState(false)
  const [night, setNight] = useState(false)
  const [mapMode, setMapMode] = useState(false)
  const [hasPartner, setHasPartner] = useState(false)
  const [games, setGames] = useState(loadGames)
  const [coarse] = useState(() => window.matchMedia?.('(pointer: coarse)').matches ?? false)

  const g = useRef({})
  const total = world.hearts.length
  const need = story.heartsNeeded ?? 6
  const partner = story.partner
  const placeById = Object.fromEntries(story.places.map((p) => [p.id, p]))

  const flash = useCallback((msg, ms = 3400) => {
    setToast(msg)
    clearTimeout(g.current.toastT)
    g.current.toastT = setTimeout(() => setToast(''), ms)
  }, [])

  const interact = useCallback(() => {
    const s = g.current
    if (!s.near || s.open) return
    if (s.near === 'post' && s.got.size < need) { flash(`Collect ${need} hearts to open the letter box (${s.got.size}/${need})`); return }
    s.open = s.near
    s.keys.clear()
    s.target = null
    s.path = null
    setOpen(s.near)
  }, [flash, need])
  const interactRef = useRef(interact)
  interactRef.current = interact

  const close = useCallback(() => {
    const s = g.current
    const was = s.open
    s.open = null
    setOpen(null)
    // after her first visit somewhere, he shows up and follows her everywhere
    if (!s.partner && partner && was) {
      const pl = world.places.find((p) => p.id === was)
      s.partner = { x: pl.x + 22, y: pl.y + 18, dir: 'up', phase: 0, moving: false }
      s.trail = [{ x: s.partner.x, y: s.partner.y }, { x: s.p.x, y: s.p.y }]
      s.floaters.push({ x: s.partner.x, y: s.partner.y - 40, t: performance.now() / 1000, text: '♥ ♥ ♥' })
      setHasPartner(true)
      flash(`Look who's here! ${partner.name} will follow you everywhere now ♥`, 4200)
    }
  }, [flash, partner, world])

  const winGame = useCallback((id) => {
    setGames((gs) => {
      const next = gs.includes(id) ? gs : [...gs, id]
      try { localStorage.setItem(GAMES_KEY, JSON.stringify(next)) } catch { /* fine */ }
      return next
    })
  }, [])

  const toggleMap = useCallback(() => {
    const s = g.current
    if (!s.view) return
    if (s.zoomT > s.view.fit * 1.05) { s.prevZoom = s.zoomT; s.zoomT = s.view.fit } else s.zoomT = s.prevZoom || s.view.base
  }, [])
  const zoomBy = (f) => { g.current.zoomT = (g.current.zoomT || 1.6) * f }
  const toggleNight = () => { const s = g.current; s.clock = s.night > 0.5 ? 0.5 : 0.02 }

  useEffect(() => {
    const s = g.current
    let raf
    let alive = true
    Object.assign(s, {
      keys: new Set(), pad: { up: false, down: false, left: false, right: false }, got: new Set(),
      open: null, near: null, target: null, floaters: [], partner: null, trail: [], loveT: 0,
      clock: 0.42, night: 0, zoomT: null, zoom: 1, ptrs: new Map(),
      petals: Array.from({ length: 22 }, () => ({ x: Math.random(), y: Math.random(), s: 3 + Math.random() * 5, v: 20 + Math.random() * 30, w: Math.random() * 6, r: Math.random() * 6 })),
      flies: Array.from({ length: 36 }, (_, i) => ({ ...world.parkSpots[(i * 7) % world.parkSpots.length], ph: Math.random() * 6 })),
      butterflies: Array.from({ length: 7 }, (_, i) => ({ home: world.parkSpots[(i * 11) % world.parkSpots.length], ph: Math.random() * 6, hue: ['#f6a5c0', '#ffd36e', '#b9a6f0', '#9fd8f0'][i % 4] })),
      clouds: Array.from({ length: 6 }, (_, i) => ({ x: i * 520, y: 160 + ((i * 337) % (WORLD_H - 300)), r: 140 + (i % 3) * 50 })),
    })

    // a sheet of paper grain, multiplied over the whole view
    const paper = document.createElement('canvas')
    paper.width = paper.height = 160
    const pc = paper.getContext('2d')
    const px = pc.createImageData(160, 160)
    for (let i = 0; i < px.data.length; i += 4) {
      const v = 215 + Math.random() * 40
      px.data[i] = v; px.data[i + 1] = v - 6; px.data[i + 2] = v - 20; px.data[i + 3] = 255
    }
    pc.putImageData(px, 0, 0)
    s.paper = paper
    s.dark = document.createElement('canvas')

    const onDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const k = e.key.toLowerCase()
      if (KEYMAP[k]) { e.preventDefault(); if (!s.open) { s.keys.add(KEYMAP[k]); s.target = null; s.path = null } }
      else if (k === 'shift') s.run = true
      else if ((k === 'e' || k === 'enter' || k === ' ') && !s.open) { if (k === ' ') e.preventDefault(); if (!e.repeat) interactRef.current() }
      else if (k === 'm' && !s.open) toggleMap()
    }
    const onUp = (e) => {
      const k = e.key.toLowerCase()
      if (KEYMAP[k]) s.keys.delete(KEYMAP[k])
      else if (k === 'shift') s.run = false
    }
    const onWheel = (e) => { e.preventDefault(); if (s.zoomT) s.zoomT *= Math.exp(-e.deltaY * 0.0015) }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    const cv = canvas.current
    cv.addEventListener('wheel', onWheel, { passive: false })

    const update = (dt, t) => {
      const p = s.p
      s.clock = (s.clock + dt / CYCLE) % 1
      const day = 0.5 + 0.5 * Math.cos((s.clock - 0.5) * Math.PI * 2)
      s.night = clamp((0.55 - day) / 0.4, 0, 1)
      s.dusk = clamp(1 - Math.abs(day - 0.45) / 0.18, 0, 1)
      if ((s.night > 0.5) !== s.wasNight) { s.wasNight = s.night > 0.5; setNight(s.wasNight) }

      const playing = t - s.t0 > INTRO - 0.6 && !s.open
      let vx = 0, vy = 0
      if (playing) {
        const k = s.keys, pd = s.pad
        vx = (k.has('right') || pd.right ? 1 : 0) - (k.has('left') || pd.left ? 1 : 0)
        vy = (k.has('down') || pd.down ? 1 : 0) - (k.has('up') || pd.up ? 1 : 0)
        // follow the A* waypoints one by one
        if (!vx && !vy && s.path?.length) {
          const wp = s.path[0]
          const dx = wp.x - p.x, dy = wp.y - p.y
          const d = Math.hypot(dx, dy)
          if (s.stuck > 0.6) { s.path = null; s.target = null; s.stuck = 0 }
          else if (d < 5) { s.path.shift(); if (!s.path.length) { s.path = null; s.target = null } }
          else { vx = dx / d; vy = dy / d }
        }
      }
      p.moving = !!(vx || vy)
      const sp = s.run ? RUN : SPEED
      if (p.moving) {
        const len = Math.hypot(vx, vy)
        const mx = (vx / len) * sp * dt, my = (vy / len) * sp * dt
        const bx = p.x, by = p.y
        if (world.free(p.x + mx, p.y)) p.x += mx
        if (world.free(p.x, p.y + my)) p.y += my
        s.stuck = s.path && Math.hypot(p.x - bx, p.y - by) < 0.2 * sp * dt ? (s.stuck || 0) + dt : 0
        p.dir = dirOf(vx, vy)
        p.phase = (p.phase + dt * (sp / SPEED) * 1.7) % 1
      }

      // he follows her footsteps, a few steps behind
      const q = s.partner
      if (q) {
        const last = s.trail[s.trail.length - 1]
        if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 3) { s.trail.push({ x: p.x, y: p.y }); if (s.trail.length > 400) s.trail.shift() }
        let rest = 30, tx = p.x, ty = p.y
        for (let i = s.trail.length - 1; i > 0; i--) {
          const a = s.trail[i], b = s.trail[i - 1]
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          if (rest <= d) { const k = rest / d; tx = a.x + (b.x - a.x) * k; ty = a.y + (b.y - a.y) * k; rest = 0; break }
          rest -= d; tx = b.x; ty = b.y
        }
        const dx = tx - q.x, dy = ty - q.y, d = Math.hypot(dx, dy)
        if (d > 420) { q.x = tx; q.y = ty }
        else if (d > 2) {
          const step = Math.min(d, Math.max(sp * 1.15, d * 4) * dt)
          q.x += (dx / d) * step; q.y += (dy / d) * step
          q.dir = dirOf(dx, dy); q.moving = true
          q.phase = (q.phase + dt * 1.8) % 1
        } else { q.moving = false; if (!p.moving) q.dir = dirOf(p.x - q.x, p.y - q.y) }
        // standing together for a moment makes little hearts float up
        if (!p.moving && !q.moving && Math.hypot(p.x - q.x, p.y - q.y) < 60) {
          s.loveT += dt
          if (s.loveT > 2.4) { s.loveT = 0.6; s.floaters.push({ x: (p.x + q.x) / 2, y: Math.min(p.y, q.y) - 40, t, text: '♥' }) }
        } else s.loveT = 0
      }

      let best = null, bd = NEAR
      for (const pl of world.places) {
        const d = Math.hypot(p.x - pl.x, p.y - pl.y)
        if (d < bd) { bd = d; best = pl.id }
      }
      if (best !== s.near) { s.near = best; setNear(best) }

      for (const h of world.hearts) {
        if (!s.got.has(h.id) && Math.hypot(p.x - h.x, p.y - 8 - h.y) < 18) {
          s.got.add(h.id)
          s.floaters.push({ x: h.x, y: h.y, t, text: '+1 ♥' })
          setCount(s.got.size)
          if (s.got.size === total) flash('You found every heart! ♥')
          else if (s.got.size === need) flash('The Love Letters box is open now ♥')
        }
      }
    }

    const tag = (ctx, x, y, text, color) => {
      ctx.font = '600 9px Inter, sans-serif'
      ctx.textAlign = 'center'
      const w = ctx.measureText(text).width + 12
      ctx.fillStyle = 'rgba(255,250,240,.9)'; ctx.beginPath(); ctx.roundRect(x - w / 2, y, w, 13, 6); ctx.fill()
      ctx.fillStyle = color; ctx.fillText(text, x, y + 9.5)
    }

    const render = (t) => {
      const c = canvas.current
      if (!c) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const W = c.clientWidth, H = c.clientHeight
      if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr) }
      const ctx = c.getContext('2d')
      const p = s.p

      // camera: a fly-over of the whole town first, then it follows her. Wheel / pinch / map button change zoom.
      const base = clamp(Math.min(W / 560, H / 360), 1.25, 2.6)
      const fit = Math.min(W / WORLD_W, H / WORLD_H)
      const e = ease(clamp((t - s.t0) / INTRO, 0, 1))
      if (s.zoomT == null) s.zoomT = base
      s.zoomT = clamp(s.zoomT, fit, base * 1.8)
      if (e < 1) s.zoom = fit + (base - fit) * e
      else s.zoom += (s.zoomT - s.zoom) * 0.15
      const zoom = s.zoom
      const isMap = zoom < base * 0.6
      if (isMap !== s.wasMap) { s.wasMap = isMap; setMapMode(isMap) }
      const tx = WORLD_W / 2 + (p.x - WORLD_W / 2) * e
      const ty = WORLD_H / 2 + (p.y - 16 - WORLD_H / 2) * e
      if (!s.cam || e < 1) s.cam = { x: tx, y: ty }
      else { s.cam.x += (tx - s.cam.x) * 0.12; s.cam.y += (ty - s.cam.y) * 0.12 }
      const vw = W / zoom, vh = H / zoom
      const camX = vw >= WORLD_W ? (WORLD_W - vw) / 2 : clamp(s.cam.x - vw / 2, 0, WORLD_W - vw)
      const camY = vh >= WORLD_H ? (WORLD_H - vh) / 2 : clamp(s.cam.y - vh / 2, 0, WORLD_H - vh)
      s.view = { camX, camY, zoom, base, fit }
      const day = 1 - s.night

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.fillStyle = '#e9dfc6'
      ctx.fillRect(0, 0, c.width, c.height)
      const worldT = () => ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, -camX * dpr * zoom, -camY * dpr * zoom)
      worldT()
      ctx.drawImage(world.ground, 0, 0, WORLD_W, WORLD_H)
      ctx.strokeStyle = '#4a3340'; ctx.lineWidth = 3 / zoom; ctx.strokeRect(0, 0, WORLD_W, WORLD_H)

      ctx.fillStyle = 'rgba(255,255,255,.5)'
      for (const [wc, wr] of world.waterTiles) {
        const x = wc * TS, y = wr * TS
        if (x < camX - TS || x > camX + vw || y < camY - TS || y > camY + vh) continue
        ctx.fillRect(x + ((t * 9 + wc * 11 + wr * 5) % 28), y + 10 + ((wr * 7) % 12), 6, 1.5)
      }

      for (const pl of world.places) {
        const k = 0.5 + 0.5 * Math.sin(t * 3 + pl.x)
        const on = pl.id === s.near
        ctx.strokeStyle = on ? 'rgba(196,87,74,.95)' : 'rgba(196,87,74,.5)'
        ctx.lineWidth = on ? 2.4 : 1.6
        ctx.beginPath(); ctx.ellipse(pl.x, pl.y, 16 + k * 3, 7 + k * 1.5, 0, 0, 7); ctx.stroke()
        ctx.fillStyle = on ? 'rgba(255,150,140,.35)' : 'rgba(255,150,140,.16)'
        ctx.fill()
      }
      if (s.path?.length) {
        // dotted trail along the route she'll take
        ctx.strokeStyle = 'rgba(196,87,74,.7)'; ctx.lineWidth = 2; ctx.lineCap = 'round'
        ctx.setLineDash([2, 7]); ctx.lineDashOffset = -t * 20
        ctx.beginPath(); ctx.moveTo(p.x, p.y)
        for (const wp of s.path) ctx.lineTo(wp.x, wp.y)
        ctx.stroke(); ctx.setLineDash([])
      }
      if (s.target) {
        ctx.strokeStyle = 'rgba(196,87,74,.9)'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.ellipse(s.target.x, s.target.y, 8 + Math.sin(t * 6) * 2, 4 + Math.sin(t * 6), 0, 0, 7); ctx.stroke()
        ctx.fillStyle = '#e0486c'; ctx.font = '12px serif'; ctx.textAlign = 'center'; ctx.fillText('♥', s.target.x, s.target.y - 6 + Math.sin(t * 6) * 2)
      }

      ctx.textAlign = 'center'
      ctx.font = '20px serif'
      for (const h of world.hearts) {
        if (s.got.has(h.id)) continue
        const bob = Math.sin(t * 3 + h.id) * 3
        const glow = ctx.createRadialGradient(h.x, h.y - 8 + bob, 1, h.x, h.y - 8 + bob, 20)
        glow.addColorStop(0, 'rgba(255,140,175,.55)'); glow.addColorStop(1, 'rgba(255,140,175,0)')
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(h.x, h.y - 8 + bob, 20, 0, 7); ctx.fill()
        ctx.fillStyle = '#e0486c'; ctx.fillText('♥', h.x, h.y - 2 + bob)
      }

      // sprites and both avatars, sorted by their base line
      const actors = [{ ...p, look, kind: 'her' }]
      if (s.partner) actors.push({ ...s.partner, look: partner.look, kind: 'him' })
      actors.sort((a, b) => a.y - b.y)
      let ai = 0
      const drawActor = (a) => drawAvatarInked(ctx, a.look, a.x, a.y, a.dir, a.phase, a.moving)
      for (const sp of world.sprites) {
        while (ai < actors.length && actors[ai].y < sp.baseY) drawActor(actors[ai++])
        if (sp.x + sp.w < camX || sp.x > camX + vw || sp.y + sp.h < camY || sp.y > camY + vh) continue
        ctx.drawImage(sp.img, sp.x, sp.y, sp.w, sp.h)
      }
      while (ai < actors.length) drawActor(actors[ai++])
      if (!isMap) {
        tag(ctx, p.x, p.y - 58, name, '#c4574a')
        if (s.partner) tag(ctx, s.partner.x, s.partner.y - 58, partner.name, '#5a6690')
      }

      // daytime life: drifting cloud shadows and butterflies
      if (day > 0.05) {
        for (const cl of s.clouds) {
          const x = ((cl.x + t * 14) % (WORLD_W + 600)) - 300
          ctx.fillStyle = `rgba(74,51,64,${0.06 * day})`
          ctx.beginPath(); ctx.ellipse(x, cl.y, cl.r, cl.r * 0.55, 0, 0, 7); ctx.ellipse(x + cl.r * 0.6, cl.y + 20, cl.r * 0.7, cl.r * 0.4, 0, 0, 7); ctx.fill()
        }
        for (const b of s.butterflies) {
          const bx = b.home.x + Math.sin(t * 0.7 + b.ph) * 60, by = b.home.y + Math.sin(t * 1.1 + b.ph * 2) * 30 - 20
          const flap = Math.abs(Math.sin(t * 14 + b.ph)) * 4 + 1
          ctx.globalAlpha = day
          ctx.fillStyle = b.hue
          ctx.beginPath(); ctx.ellipse(bx - 2.5, by, flap, 3.5, -0.4, 0, 7); ctx.ellipse(bx + 2.5, by, flap, 3.5, 0.4, 0, 7); ctx.fill()
          ctx.fillStyle = '#4a3340'; ctx.fillRect(bx - 0.6, by - 3, 1.2, 6)
          ctx.globalAlpha = 1
        }
      }

      s.floaters = s.floaters.filter((f) => t - f.t < 1.4)
      for (const f of s.floaters) {
        ctx.globalAlpha = 1 - (t - f.t) / 1.4
        ctx.fillStyle = '#e0486c'; ctx.font = '600 14px Inter, sans-serif'; ctx.textAlign = 'center'
        ctx.fillText(f.text, f.x, f.y - 14 - (t - f.t) * 28)
      }
      ctx.globalAlpha = 1

      // dusk glow, then night: darkness with holes cut out for every lamp, door and window
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      if (s.dusk > 0) { ctx.fillStyle = `rgba(255,140,90,${s.dusk * 0.16})`; ctx.fillRect(0, 0, c.width, c.height) }
      if (s.night > 0.01) {
        const d = s.dark
        if (d.width !== c.width || d.height !== c.height) { d.width = c.width; d.height = c.height }
        const dc = d.getContext('2d')
        dc.globalCompositeOperation = 'source-over'
        dc.clearRect(0, 0, d.width, d.height)
        dc.fillStyle = `rgba(18,22,60,${0.66 * s.night})`
        dc.fillRect(0, 0, d.width, d.height)
        dc.globalCompositeOperation = 'destination-out'
        const k = dpr * zoom
        const hole = (x, y, r) => {
          const sx = (x - camX) * k, sy = (y - camY) * k, sr = r * k
          if (sx < -sr || sy < -sr || sx > d.width + sr || sy > d.height + sr) return
          const gr = dc.createRadialGradient(sx, sy, 0, sx, sy, sr)
          gr.addColorStop(0, 'rgba(0,0,0,.95)'); gr.addColorStop(0.55, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)')
          dc.fillStyle = gr; dc.beginPath(); dc.arc(sx, sy, sr, 0, 7); dc.fill()
        }
        for (const L of world.lights) hole(L.x, L.y, L.r * (0.95 + 0.05 * Math.sin(t * 3 + L.x)))
        hole(p.x, p.y - 20, 75)
        if (s.partner) hole(s.partner.x, s.partner.y - 20, 50)
        ctx.drawImage(d, 0, 0)
        // warm lamp glow + fireflies on top
        worldT()
        ctx.globalCompositeOperation = 'lighter'
        for (const L of world.lights) {
          if (!L.lamp) continue
          const gr = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, 34)
          gr.addColorStop(0, `rgba(255,200,120,${0.45 * s.night})`); gr.addColorStop(1, 'rgba(255,200,120,0)')
          ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(L.x, L.y, 34, 0, 7); ctx.fill()
        }
        for (const f of s.flies) {
          const fx = f.x + Math.sin(t * 0.6 + f.ph) * 40, fy = f.y + Math.cos(t * 0.8 + f.ph * 1.3) * 26 - 14
          const a = s.night * (0.5 + 0.5 * Math.sin(t * 3 + f.ph * 4))
          const gr = ctx.createRadialGradient(fx, fy, 0, fx, fy, 7)
          gr.addColorStop(0, `rgba(255,240,150,${a})`); gr.addColorStop(1, 'rgba(255,240,150,0)')
          ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(fx, fy, 7, 0, 7); ctx.fill()
        }
        ctx.globalCompositeOperation = 'source-over'
      }

      // map mode: big labels for every place + a "you are here" pulse
      if (isMap) {
        worldT()
        const fs = 13 / zoom
        ctx.font = `600 ${fs}px Inter, sans-serif`
        ctx.textAlign = 'center'
        for (const pl of world.places) {
          const label = placeById[pl.id]?.name.replace('Sri Ramakrishna College of Arts and Science', 'Sri Ramakrishna College') ?? pl.id
          const w = ctx.measureText(label).width + fs * 1.2
          const y = pl.y + 16 / zoom
          ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = '#4a3340'; ctx.lineWidth = 1.5 / zoom
          ctx.beginPath(); ctx.roundRect(pl.x - w / 2, y, w, fs * 1.7, fs * 0.5); ctx.fill(); ctx.stroke()
          ctx.fillStyle = '#4a3340'; ctx.fillText(label, pl.x, y + fs * 1.22)
        }
        const pr = (14 + Math.sin(t * 5) * 4) / zoom
        ctx.strokeStyle = '#c4574a'; ctx.lineWidth = 3 / zoom
        ctx.beginPath(); ctx.arc(p.x, p.y - 12, pr + 10 / zoom, 0, 7); ctx.stroke()
      }

      // screen-space mood: drifting petals, paper grain, warm edges
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.globalAlpha = 1 - s.night * 0.7
      for (const pt of s.petals) {
        pt.y += (pt.v / H) * 0.016; pt.x += Math.sin(t + pt.w) * 0.0004
        if (pt.y > 1.05) { pt.y = -0.05; pt.x = Math.random() }
        ctx.save(); ctx.translate(pt.x * W, pt.y * H); ctx.rotate(t * 0.8 + pt.r)
        ctx.fillStyle = 'rgba(247,180,200,.75)'; ctx.beginPath(); ctx.ellipse(0, 0, pt.s, pt.s * 0.55, 0, 0, 7); ctx.fill(); ctx.restore()
      }
      ctx.globalAlpha = 1
      if (!s.pat) s.pat = ctx.createPattern(s.paper, 'repeat')
      ctx.globalCompositeOperation = 'multiply'
      ctx.globalAlpha = 0.45
      ctx.fillStyle = s.pat; ctx.fillRect(0, 0, W, H)
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.8)
      v.addColorStop(0, 'rgba(110,70,40,0)'); v.addColorStop(1, 'rgba(110,70,40,.2)')
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H)

      // corner mini-map
      const m = miniRef.current
      if (m) {
        const mw = m.clientWidth, mh = m.clientHeight
        if (m.width !== Math.round(mw * dpr)) { m.width = Math.round(mw * dpr); m.height = Math.round(mh * dpr) }
        const mc = m.getContext('2d')
        mc.setTransform(dpr, 0, 0, dpr, 0, 0)
        mc.drawImage(world.mini, 0, 0, mw, mh)
        if (s.night > 0) { mc.fillStyle = `rgba(18,22,60,${0.45 * s.night})`; mc.fillRect(0, 0, mw, mh) }
        const sc = mw / WORLD_W
        mc.fillStyle = '#e0486c'
        for (const h of world.hearts) if (!s.got.has(h.id)) { mc.beginPath(); mc.arc(h.x * sc, h.y * sc, 1.6, 0, 7); mc.fill() }
        mc.strokeStyle = '#4a3340'; mc.lineWidth = 1
        mc.strokeRect(camX * sc, camY * sc, Math.min(vw, WORLD_W) * sc, Math.min(vh, WORLD_H) * sc)
        if (s.partner) { mc.fillStyle = '#5a6690'; mc.beginPath(); mc.arc(s.partner.x * sc, s.partner.y * sc, 2.6, 0, 7); mc.fill() }
        mc.fillStyle = '#c4574a'; mc.strokeStyle = '#fff'; mc.lineWidth = 1.5
        mc.beginPath(); mc.arc(p.x * sc, p.y * sc, 3.4, 0, 7); mc.fill(); mc.stroke()
      }
    }

    s.p = { x: world.spawn.x, y: world.spawn.y, dir: 'down', phase: 0, moving: false }
    s.t0 = performance.now() / 1000
    s.cam = null
    setReady(true)
    let last = performance.now()
    const frame = (now) => {
      if (!alive) return
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      update(dt, now / 1000)
      render(now / 1000)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      clearTimeout(s.toastT)
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      cv.removeEventListener('wheel', onWheel)
    }
    // the world, avatar and story are fixed for the lifetime of this component
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // tap / click to walk, two fingers to pinch-zoom
  const onPointerDown = (e) => {
    const s = g.current
    s.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (s.ptrs.size === 2) { const [a, b] = [...s.ptrs.values()]; s.pinch = Math.hypot(a.x - b.x, a.y - b.y); s.target = null; return }
    if (!s.view || s.open) return
    const r = e.currentTarget.getBoundingClientRect()
    const { camX, camY, zoom } = s.view
    const tx = camX + (e.clientX - r.left) / zoom, ty = camY + (e.clientY - r.top) / zoom
    const path = world.findPath(s.p.x, s.p.y, tx, ty)
    if (!path?.length) { s.path = null; s.target = null; return }
    s.path = path
    s.target = path[path.length - 1]
    s.stuck = 0
  }
  const onPointerMove = (e) => {
    const s = g.current
    if (!s.ptrs.has(e.pointerId)) return
    s.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (s.ptrs.size === 2 && s.pinch) {
      const [a, b] = [...s.ptrs.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      s.zoomT *= d / s.pinch
      s.pinch = d
    }
  }
  const onPointerUp = (e) => { const s = g.current; s.ptrs.delete(e.pointerId); if (s.ptrs.size < 2) s.pinch = 0 }

  const pad = (dir, on) => (e) => { e.preventDefault(); g.current.pad[dir] = on; if (on) { g.current.target = null; g.current.path = null } }
  const place = near && placeById[near]
  const openPlace = open && placeById[open]

  return (
    <div className="town">
      <canvas ref={canvas} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} />

      <div className="bars"><i /><i /></div>
      <div className="welcome"><span className="script">Welcome to our little town</span></div>

      {ready && (
        <>
          <div className="hud-top">
            <div className="hud-left">
              <div className="pill"><b>♥</b> {count} / {total}</div>
              <div className="pill" title="Puzzles solved"><b>✦</b> {games.length} / 2 puzzles</div>
            </div>
            <button className="pill ghost" onClick={onEditAvatar}>✎ {name}</button>
          </div>

          <div className="hud-tools">
            <button className="tool" onClick={toggleNight} title="Day / night">{night ? '☾' : '☀'}</button>
            <button className="tool" onClick={() => zoomBy(1.25)} title="Zoom in">+</button>
            <button className="tool" onClick={() => zoomBy(0.8)} title="Zoom out">−</button>
            <button className={`tool ${mapMode ? 'on' : ''}`} onClick={toggleMap} title="Full map (M)">⤢</button>
          </div>

          <button className="minimap" onClick={toggleMap} aria-label="Toggle full map">
            <canvas ref={miniRef} />
            <span>{mapMode ? 'back to her' : 'map'}</span>
          </button>

          <AnimatePresence>
            {place && !open && !mapMode && (
              <motion.button key={near} className="enter" onClick={interact} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }}>
                <small>{coarse ? 'tap to enter' : 'press E to enter'}</small>
                <span>{place.name}</span>
                <em>{place.caption}</em>
              </motion.button>
            )}
            {toast && <motion.div className="toast" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{toast}</motion.div>}
          </AnimatePresence>

          <p className="help">{coarse ? 'pad or tap to walk · pinch to zoom' : 'WASD / arrows to walk · Shift to run · scroll to zoom · M for the map'}</p>

          {coarse && (
            <div className="dpad">
              {['up', 'left', 'right', 'down'].map((d) => (
                <button key={d} className={d} onPointerDown={pad(d, true)} onPointerUp={pad(d, false)} onPointerLeave={pad(d, false)} onPointerCancel={pad(d, false)} aria-label={d}>
                  {{ up: '▲', down: '▼', left: '◀', right: '▶' }[d]}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {open === 'museum' && (
          <Suspense key="museum" fallback={<div className="m-intro"><h2>Our Museum</h2><p>opening the doors…</p></div>}>
            <Museum photos={story.gallery} herLook={look} hisLook={hasPartner ? partner.look : null} onClose={close} />
          </Suspense>
        )}
        {open === 'arcade' && <Arcade key="arcade" photos={story.gallery} gift={story.gift} done={games} onWin={winGame} onClose={close} />}
        {openPlace && open !== 'museum' && open !== 'arcade' && <PlaceModal key={open} place={openPlace} story={story} onClose={close} />}
      </AnimatePresence>
    </div>
  )
}
