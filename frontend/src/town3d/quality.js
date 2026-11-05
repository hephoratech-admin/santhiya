// Frame-time hysteresis avoids oscillation; a promotion requires both sustained
// healthy frame intervals and measured GPU/CPU headroom for the next setting.
export const TIERS = [
  { name: 'low', mobileDpr: 1, dpr: 1.1, shadow: 512, grass: 550, near: 22, mid: 55, bloom: false },
  { name: 'medium', mobileDpr: 1.25, dpr: 1.4, shadow: 1024, grass: 1500, near: 34, mid: 78, bloom: true },
  { name: 'high', mobileDpr: 1.5, dpr: 1.75, shadow: 2048, grass: 4200, near: 40, mid: 100, bloom: true },
]

export function createQuality(mobile, apply) {
  let index = mobile ? 1 : 2, elapsed = 0, frames = 0, healthy = 0, warmup = 4, work = 0
  let resolution = 1, mode = 'walk'
  const profiles = { walk: { index, resolution, initialized: true }, map: { index, resolution, initialized: false } }
  const stats = { fps: 0, ms: 0, workMs: 0, tier: TIERS[index].name, resolution: 1 }
  const set = () => {
    stats.tier = TIERS[index].name; stats.resolution = resolution
    apply(TIERS[index], resolution); healthy = 0
  }
  set()
  return {
    stats,
    get tier() { return TIERS[index] },
    setMode(nextMode) {
      if (mode === nextMode || !profiles[nextMode]) return
      profiles[mode].index = index; profiles[mode].resolution = resolution
      const target = profiles[nextMode]
      if (!target.initialized) { target.index = index; target.resolution = resolution; target.initialized = true }
      const changed = index !== target.index || resolution !== target.resolution
      mode = nextMode; index = target.index; resolution = target.resolution
      if (changed) set()
      elapsed = 0; frames = 0; work = 0; healthy = 0
    },
    reset() { elapsed = 0; frames = 0; work = 0; healthy = 0; warmup = 2 },
    sample(ms, calls, triangles, workMs = 0) {
      if (warmup > 0) { warmup -= ms / 1000; return false }
      elapsed += ms; frames++; work += workMs
      if (elapsed < 2000) return false
      stats.ms = elapsed / frames; stats.fps = 1000 / stats.ms; stats.workMs = work / frames
      const overBudget = calls > 120 || triangles > 300000
      if (stats.ms > 20 || overBudget || (index === 0 && stats.ms > 18)) {
        if (index > 0) { index--; resolution = 1; set() }
        else if (stats.ms > 18 && resolution > .7) { resolution = Math.max(.7, Math.round((resolution - .1) * 100) / 100); set() }
        else healthy = 0
      } else if (stats.ms < 17.2 && stats.workMs < 11 && !overBudget) {
        healthy += elapsed
        if (healthy >= 12000) {
          if (resolution < 1) { resolution = Math.min(1, Math.round((resolution + .05) * 100) / 100); set() }
          else if (index < 2) { index++; set() }
        }
      } else healthy = 0
      elapsed = 0; frames = 0; work = 0
      return true
    },
  }
}
