// Tiny WebAudio synth: a soft piano-ish pluck, a warm pad and an ambient loop.
// No audio files needed; everything is generated in the browser.
export const BPM = 84
export const EIGHTH = 60 / BPM / 2
export const BAR = EIGHTH * 8
// C – Am – F – G, four tones each (low pad voices + top note for the arpeggio)
export const CHORDS = [
  [130.81, 164.81, 196.0, 261.63],
  [110.0, 130.81, 164.81, 220.0],
  [87.31, 130.81, 174.61, 220.0],
  [98.0, 123.47, 146.83, 196.0],
]

let ac = null
let master = null
let amb = null
let timer = null
let wanted = false
let suspended = false

export function getAC() {
  if (!ac) {
    ac = new (window.AudioContext || window.webkitAudioContext)()
    master = ac.createGain()
    master.gain.value = 0.8
    // a little echo makes the plucks feel dreamy
    const delay = ac.createDelay()
    delay.delayTime.value = 0.32
    const fb = ac.createGain()
    fb.gain.value = 0.32
    const wet = ac.createGain()
    wet.gain.value = 0.35
    master.connect(ac.destination)
    master.connect(delay)
    delay.connect(fb)
    fb.connect(delay)
    delay.connect(wet)
    wet.connect(ac.destination)
  }
  if (ac.state === 'suspended') ac.resume()
  return ac
}

export const getOut = () => (getAC(), master)

export function pluck(freq, when, vol = 0.22, dest = master, dur = 1.4) {
  const a = getAC()
  const g = a.createGain()
  g.connect(dest || master)
  g.gain.setValueAtTime(0, when)
  g.gain.linearRampToValueAtTime(vol, when + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
  ;[['triangle', freq, 1], ['sine', freq * 2, 0.35]].forEach(([type, f, m]) => {
    const o = a.createOscillator()
    const og = a.createGain()
    o.type = type
    o.frequency.value = f
    og.gain.value = m
    o.connect(og)
    og.connect(g)
    o.start(when)
    o.stop(when + dur + 0.05)
  })
}

function padTone(freq, when, dur, vol, dest) {
  const a = getAC()
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = 'sine'
  o.frequency.value = freq
  g.gain.setValueAtTime(0, when)
  g.gain.linearRampToValueAtTime(vol, when + 0.6)
  g.gain.linearRampToValueAtTime(0, when + dur)
  o.connect(g)
  g.connect(dest)
  o.start(when)
  o.stop(when + dur + 0.05)
}

/** One bar of accompaniment: a soft pad plus an eighth-note arpeggio. */
export function chordBar(chord, when, dest, arpVol = 0.04, padVol = 0.05) {
  chord.slice(0, 3).forEach((f) => padTone(f, when, BAR + 0.4, padVol, dest))
  if (arpVol > 0) {
    const order = [0, 1, 2, 3, 2, 1, 3, 2]
    order.forEach((n, i) => pluck(chord[n] * 2, when + i * EIGHTH, arpVol, dest, 1.1))
  }
}

function run() {
  if (!wanted || suspended || amb) return
  const a = getAC()
  const node = a.createGain()
  node.connect(master)
  amb = node
  let t = a.currentTime + 0.1
  let bar = 0
  const tick = () => {
    while (t < a.currentTime + 3) {
      chordBar(CHORDS[bar % 4], t, node, 0.03, 0.05)
      t += BAR
      bar++
    }
  }
  tick()
  timer = setInterval(tick, 1000)
}

function halt() {
  if (!amb) return
  clearInterval(timer)
  const node = amb
  amb = null
  node.gain.cancelScheduledValues(ac.currentTime)
  node.gain.setValueAtTime(node.gain.value, ac.currentTime)
  node.gain.linearRampToValueAtTime(0, ac.currentTime + 0.5)
  setTimeout(() => node.disconnect(), 700)
}

export function setMusic(on) {
  wanted = on
  on ? run() : halt()
}
export function suspendMusic() { suspended = true; halt() }
export function resumeMusic() { suspended = false; run() }
