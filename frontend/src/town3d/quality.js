// Frame-time hysteresis avoids oscillation; a promotion requires 12 healthy seconds.
export const TIERS = [
  { name: 'low', mobileDpr: 1, dpr: 1.1, shadow: 512, grass: 550, near: 22, mid: 55, bloom: false },
  { name: 'medium', mobileDpr: 1.25, dpr: 1.4, shadow: 1024, grass: 1500, near: 34, mid: 78, bloom: true },
  { name: 'high', mobileDpr: 1.5, dpr: 1.75, shadow: 2048, grass: 4200, near: 40, mid: 100, bloom: true },
]

export function createQuality(mobile, apply) {
  let index = mobile ? 1 : 2, elapsed = 0, frames = 0, healthy = 0, warmup = 4
  const stats = { fps: 0, ms: 0, tier: TIERS[index].name }
  const set = () => { stats.tier = TIERS[index].name; apply(TIERS[index]); healthy = 0 }
  set()
  return {
    stats,
    get tier() { return TIERS[index] },
    reset() { elapsed = 0; frames = 0; healthy = 0; warmup = 2 },
    sample(ms, calls, triangles) {
      if (warmup > 0) { warmup -= ms / 1000; return false }
      elapsed += ms; frames++
      if (elapsed < 2000) return false
      stats.ms = elapsed / frames; stats.fps = 1000 / stats.ms
      const overBudget = calls > 120 || triangles > 300000
      if ((stats.ms > 20 || overBudget) && index > 0) { index--; set() }
      else if (stats.ms < 17.2 && !overBudget) {
        healthy += elapsed
        if (healthy >= 12000 && index < 2) { index++; set() }
      } else healthy = 0
      elapsed = 0; frames = 0
      return true
    },
  }
}
