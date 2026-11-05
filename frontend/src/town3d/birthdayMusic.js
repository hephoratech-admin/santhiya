// "Happy Birthday" played live with WebAudio (no audio files): a music-box/piano melody,
// soft chords and bass, a "ta-da" when the candles go out, then applause and firework pops.
// Must be started from a tap/click/key press so browsers allow the sound.

const BEAT = 0.5 // seconds per beat (120 bpm)
export const SONG_START = 0.3 // seconds after the show starts
const midi = (n) => 440 * 2 ** ((n - 69) / 12)
const N = { F3: 53, G3: 55, A3: 57, B3: 59, C4: 60, E4: 64, F4: 65, G4: 67, A4: 69, B4: 71, C5: 72, D5: 74, E5: 76, F5: 77, G5: 79, C6: 84 }

// [note, start beat, length in beats]; each line is 6 beats
const MELODY = [
  ['G4', 0, 0.75], ['G4', 0.75, 0.25], ['A4', 1, 1], ['G4', 2, 1], ['C5', 3, 1], ['B4', 4, 2],
  ['G4', 6, 0.75], ['G4', 6.75, 0.25], ['A4', 7, 1], ['G4', 8, 1], ['D5', 9, 1], ['C5', 10, 2],
  ['G4', 12, 0.75], ['G4', 12.75, 0.25], ['G5', 13, 1], ['E5', 14, 1], ['C5', 15, 1], ['B4', 16, 1], ['A4', 17, 1],
  ['F5', 18, 0.75], ['F5', 18.75, 0.25], ['E5', 19, 1], ['C5', 20, 1], ['D5', 21, 1], ['C5', 22, 3],
]
const C = [N.C4, N.E4, N.G4], G7 = [N.B3, N.F4, N.G4], F = [N.A3, N.C4, N.F4]
// [chord, bass, start beat, length]
const CHORDS = [
  [C, N.C4 - 12, 1, 3], [G7, N.G3 - 12, 4, 3], [G7, N.G3 - 12, 7, 3], [C, N.C4 - 12, 10, 3],
  [C, N.C4 - 12, 13, 3], [F, N.F3 - 12, 16, 2], [C, N.C4 - 12, 18, 3], [G7, N.G3 - 12, 21, 1], [C, N.C4 - 12, 22, 3],
]
// song lines start at these times (seconds from the start of the show)
export const LINE_TIMES = [0, 6, 12, 18].map((b) => SONG_START + b * BEAT)
export const SONG_END = SONG_START + 25 * BEAT

export function createBirthdayMusic() {
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return { play() {}, blow() {}, stop() {}, setMuted() {} }
  const ac = new AC()
  if (ac.state === 'suspended') ac.resume()
  const master = ac.createGain(); master.gain.value = 0.9
  const comp = ac.createDynamicsCompressor()
  master.connect(comp); comp.connect(ac.destination)
  // a small room reverb from decaying noise
  const verb = ac.createConvolver()
  const len = ac.sampleRate * 2.2, ir = ac.createBuffer(2, len, ac.sampleRate)
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6 }
  verb.buffer = ir
  const wet = ac.createGain(); wet.gain.value = 0.28
  verb.connect(wet); wet.connect(master)
  const out = (node, dry = 1) => { const g = ac.createGain(); g.gain.value = dry; node.connect(g); g.connect(master); node.connect(verb) }
  const noise = (() => { const b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b })()
  const nodes = new Set()
  const keep = (n, end) => { nodes.add(n); n.onended = () => nodes.delete(n); n.stop(end) }

  // piano / music-box pluck
  const pluck = (freq, t, dur, vol = 0.32) => {
    const g = ac.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol, t + 0.012)
    g.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.25)
    g.gain.exponentialRampToValueAtTime(0.0008, t + Math.max(0.6, dur * 1.6))
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800
    g.connect(lp); out(lp)
    for (const [mult, type, v] of [[1, 'triangle', 1], [2, 'sine', 0.35], [3, 'sine', 0.12], [1.003, 'sine', 0.5]]) {
      const o = ac.createOscillator(); o.type = type; o.frequency.value = freq * mult
      const og = ac.createGain(); og.gain.value = v
      o.connect(og); og.connect(g); o.start(t); keep(o, t + Math.max(0.7, dur * 1.7))
    }
  }
  // soft warm pad
  const pad = (freqs, t, dur, vol = 0.05) => {
    const g = ac.createGain()
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.18); g.gain.setValueAtTime(vol, t + dur - 0.1); g.gain.linearRampToValueAtTime(0, t + dur + 0.25)
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400
    g.connect(lp); out(lp, 0.9)
    for (const f of freqs) for (const det of [-6, 6]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(g); o.start(t); keep(o, t + dur + 0.3) }
  }
  const bass = (f, t, dur) => {
    const g = ac.createGain()
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f
    o.connect(g); out(g, 1); o.start(t); keep(o, t + dur + 0.05)
  }
  const burst = (t, { freq = 1800, q = 1, dur = 0.06, vol = 0.2, sweep = 0 } = {}) => {
    const s = ac.createBufferSource(); s.buffer = noise
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(freq, t); bp.Q.value = q
    if (sweep) bp.frequency.exponentialRampToValueAtTime(sweep, t + dur)
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur)
    s.connect(bp); bp.connect(g); out(g, 1)
    s.start(t, Math.random() * 0.5); keep(s, t + dur + 0.02)
  }

  let t0 = 0
  return {
    play() {
      if (ac.state === 'suspended') ac.resume()
      t0 = ac.currentTime + 0.05
      const s = t0 + SONG_START
      // a little sparkle to start
      ;[N.C5, N.E5, N.G5, N.C6].forEach((n, i) => pluck(midi(n), t0 - 0.05 + i * 0.06 + 0.02, 0.4, 0.12))
      for (const [n, b, l] of MELODY) pluck(midi(N[n]), s + b * BEAT, l * BEAT)
      for (const [ch, b0, b, l] of CHORDS) { pad(ch.map(midi), s + b * BEAT, l * BEAT); bass(midi(b0), s + b * BEAT, l * BEAT * 0.9) }
    },
    /** the candles go out: ta-da, applause and fireworks */
    blow(atSec) {
      const t = t0 + atSec
      ;[N.C5, N.E5, N.G5, N.C6].forEach((n, i) => pluck(midi(n), t + i * 0.08, 0.6, 0.28))
      pad([N.C4, N.E4, N.G4, N.C5].map(midi), t + 0.32, 2.2, 0.06)
      bass(midi(N.C4 - 12), t + 0.32, 2)
      // applause: lots of tiny claps that swell and fade
      for (let i = 0; i < 260; i++) {
        const u = Math.random(), at = t + 0.2 + u * 5.5
        burst(at, { freq: 900 + Math.random() * 1800, q: 1.4, dur: 0.035 + Math.random() * 0.03, vol: 0.16 * (1 - u * 0.75) })
      }
      // firework pops, roughly with the ones in the sky
      for (let k = 0; k < 14; k++) {
        const at = t + 0.4 + k * 0.85 + Math.random() * 0.4
        burst(at, { freq: 2600, q: 0.7, dur: 0.9, vol: 0.12, sweep: 400 }) // whistle-y fizz
        burst(at + 0.05, { freq: 140, q: 0.6, dur: 0.5, vol: 0.5, sweep: 60 }) // boom
      }
    },
    stop() {
      const now = ac.currentTime
      master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(master.gain.value, now); master.gain.linearRampToValueAtTime(0, now + 0.4)
      setTimeout(() => { nodes.forEach((n) => { try { n.stop() } catch { /* already stopped */ } }); ac.close().catch(() => {}) }, 500)
    },
    setMuted(m) { master.gain.setTargetAtTime(m ? 0 : 0.9, ac.currentTime, 0.05) },
  }
}
