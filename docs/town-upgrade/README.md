# Town rendering upgrade

This branch replaces the faceted tree crowns and painted terrain with four leaf-card tree species and blended PBR ground, and reduces the existing scene's submission cost. The production build now meets the requested 55–60 FPS overlay target in the permitted mobile CPU-throttle proxy. Physical iPhone/Safari performance remains untested.

## Implementation

- Cherry blossom, oak, cypress and palm trees share an alpha-tested leaf/bark texture. Each species has full, simplified and camera-facing billboard instances, with colour/scale/rotation variation. Eight-tile vegetation chunks and per-tree bounds compact the visible instances into 12 shared batches. Only near trees cast shadows; leaves sway more than wood, including in the depth pass.
- Grass, dirt, paving and sand use generated albedo plus normal/roughness texture arrays. Layout-derived splat and coverage maps blend the layers and expose the water. Arrays prevent mip bleeding between materials; unused layers skip their texture reads. Detail layers are 256px on mobile, 512px on desktop; no external assets or texture downloads. Large-scale tint and baked tree/building AO reduce repetition.
- Inaccessible forest tiles have small mounds. Roads, building footprints and all walkable grass remain flat. A reusable local grass field follows the avatar, with density tiers and a shrinking edge, and disappears in map view.
- Water keeps the existing scrolling normal map, with inexpensive Fresnel tint and shoreline foam. Height haze uses the existing day/night fog palette. The plaza heart inlay, lamps, labels and collectible hearts remain.
- Architecture shares vertex-colour material buckets. Animated birds, clouds, butterflies, hearts and door rings use shared instance batches; halos and lanterns use billboard batches. Near flowers use compacted mesh instances; distant/map flowers use points. Player and birthday meshes share geometry and material palettes through instance colours. Fixed head details are merged while blinking and walking pivots remain separate.
- Low/medium/high quality keeps independent walking/map profiles and samples frame intervals in two-second windows, demotes above 20ms or the draw/triangle budgets, and waits twelve healthy seconds before promotion. Mobile starts at medium. Pixel ratio, grass, LOD, shadow size and bloom respond to the tier. At low quality, dynamic resolution can fall to 0.7 DPR; recovery requires measured CPU/GPU headroom. Bloom is half resolution and disabled on low. The one shadow light follows the player with a 60m frustum; the point-light pool is capped at four. Low uses contact blobs instead of avatar shadow draws; far map avatars use small proxy meshes.
- Rendering pauses while the document is hidden or a place modal is open. Museum lights are limited to four; mobile reflection targets are capped. The existing birthday score is prepared offline during loading and played through one buffer, without changing the music. Temporary vectors, light-order buffers and the partner trail are reused. Unmount disposes shader textures, depth materials, instance buffers, shadows, postprocessing passes, environment targets and input listeners.
- The town stays dynamically imported. Loading preloads its chunk, precompiles shaders and settles quality before presenting the town. The final town chunk is approximately 663KB / 182KB gzip, including Three.js, plus a 5.1KB / 2.1KB gzip birthday music chunk; the build retains Vite's 500KB chunk advisory.

## Reproduce

```sh
cd frontend
npm run build
node --test tests/town-rendering.test.mjs
npm run preview -- --host 127.0.0.1
```

Open `/?town&fps`. The overlay includes shadow and postprocessing draws because renderer statistics reset once per complete frame. Its frame rate is the average over two seconds, after a four-second warmup; it is not a worst-frame guarantee. `&time=day`, `&time=sunset` and `&time=night` set a reproducible starting phase only when `fps` is present, then the normal cycle continues.

For the mobile proxy, use 390x844, touch/coarse pointer and 4x CPU throttle. Reload after configuring the device so its initial tier and texture dimensions are selected correctly. Walk, use tap routing, toggle M/map and day/night, and test the partner and birthday show separately. Do not run a second town renderer alongside the measured page.

## Validation and measurements

Production build, all **9 automated tests**, and whitespace checks pass. Tests cover quality hysteresis and separate map/walk profiles, dynamic resolution, terrain/bridge constraints, map bounds, animated batching, nonblocking GPU timers, prepared birthday audio and reachability of every place and all 16 hearts. The latter caught and corrected an isolated original heart placement.

The real-UI regression exercised both puzzles, persistence, gift locking/unwrapping, partner following, museum/gallery/tour/photo controls, heart collection, locked/unlocked letters, bridge routing, birthday music/candles/fireworks/card/mute, map/day-night and unmount/re-entry. See [the regression record](regression/README.md). Original puzzle storage was restored; no reply message was submitted.

The final proxy used Chromium on Intel UHD/ANGLE D3D11, 390x844 CSS pixels, device scale 3, touch and **4x CPU throttle**, on the production preview. After warmup, an uninterrupted keyboard sequence walked left/right, entered map view, then returned to walking. No screenshots or DOM snapshots ran during that timed input sequence. The raw trace also includes subsequent idle sampling; all 68 two-second windows stayed within 55–60 FPS (floating-point rounding permits 60.03).

| Final proxy view | Two-second FPS range | Peak draw calls | Peak triangles | Moving windows |
| --- | ---: | ---: | ---: | ---: |
| Walking | 55.06–60.03 | 76 | 141,365 | 15 |
| Map | 55.56–60.03 | 72 | 138,177 | 7 |

The run used low quality with adaptive DPR; consult [raw samples](regression/final-mobile-performance.json) for each value. These are averaged overlay measurements, **not a guarantee that every frame stays above 45 FPS**: worst walking/map frame was 33.5ms and the complete trace includes a 50.1ms idle spike; worst window p95 was 33.3ms. Physical iPhone 13/Safari has not been tested. The permitted proxy passes the stated overlay acceptance, with those frame-pacing and hardware limitations recorded explicitly.

For context, the original `d54916c` spawn sampled 7.1 FPS, 320 draws and about 1,238k triangles at 1280x720, 1x CPU and fixed DPR 1.25. Earlier upgraded measurements (including the first 45 FPS mobile run) preceded the optimizations in this revision. Neither they nor the baseline are matched-quality comparisons with the final mobile run; they should not be used to calculate a device speedup. The screenshots below include the original desktop visual comparisons and refreshed final mobile views.

## Screenshots

Before (original terrain and faceted crowns):

![Before](before.jpg)

After, walking:

![Walking](after-walk-day.jpg)

After, full map:

![Map](after-map-day.jpg)

After, sunset:

![Sunset](after-sunset.jpg)

After, night:

![Night](after-map-night.jpg)

Mobile CPU-throttle proxy:

![Mobile walk](after-mobile-walk.jpg)

![Mobile map](after-mobile-map.jpg)
