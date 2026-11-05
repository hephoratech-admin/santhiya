// The existing distance fog follows the day/night palette; a small extra layer
// near the ground supplies height-dependent haze without a postprocessing pass.
export function heightFog(material) {
  const compile = material.onBeforeCompile, key = material.customProgramCacheKey()
  material.onBeforeCompile = s => {
    compile(s)
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying float atmosphereHeight;')
      .replace('#include <fog_vertex>', `#include <fog_vertex>
        #ifdef USE_INSTANCING
          atmosphereHeight = (modelMatrix * instanceMatrix * vec4(transformed, 1.)).y;
        #else
          atmosphereHeight = (modelMatrix * vec4(transformed, 1.)).y;
        #endif`)
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying float atmosphereHeight;')
      .replace('#include <fog_fragment>', `#include <fog_fragment>
        #ifdef USE_FOG
          float lowHaze = (1. - exp(-max(vFogDepth - fogNear * .3, 0.) * .002)) * exp(-max(atmosphereHeight, 0.) * .16);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, lowHaze * .24);
        #endif`)
  }
  material.customProgramCacheKey = () => `height-fog-${key}`
  return material
}
