// Non-blocking GPU timers. Query objects are allocated once and reused; a result
// is read only after QUERY_RESULT_AVAILABLE, so measuring does not stall the GPU.
export function createFrameProfiler(renderer) {
  const gl = renderer.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2')
  const queries = ext ? Array.from({ length: 4 }, () => gl.createQuery()) : []
  const pending = new Uint8Array(queries.length)
  let next = 0, active = -1
  const stats = { cpuMs: 0, gpuMs: 0 }
  return {
    stats,
    begin() {
      if (!ext) return
      if (gl.getParameter(ext.GPU_DISJOINT_EXT)) {
        pending.fill(0); stats.gpuMs = 0
      }
      for (let i = 0; i < queries.length; i++) {
        if (pending[i] && gl.getQueryParameter(queries[i], gl.QUERY_RESULT_AVAILABLE)) {
          stats.gpuMs = gl.getQueryParameter(queries[i], gl.QUERY_RESULT) / 1e6
          pending[i] = 0
        }
      }
      if (!pending[next]) {
        active = next; gl.beginQuery(ext.TIME_ELAPSED_EXT, queries[active])
        next = (next + 1) % queries.length
      }
    },
    end(cpuMs) {
      stats.cpuMs = cpuMs
      if (active >= 0) { gl.endQuery(ext.TIME_ELAPSED_EXT); pending[active] = 1; active = -1 }
    },
    dispose() { for (const query of queries) gl.deleteQuery(query) },
  }
}
