# Gameplay regression record — 5 November 2026

The checks below used the application's real UI in the local production preview. Mobile checks used a 390x844 viewport, 3x device scale, touch/coarse pointer and 4x CPU throttling in Chromium on Intel UHD graphics. This is a proxy, not a physical iPhone/Safari result.

| Area | Actions and observed result | Evidence |
| --- | --- | --- |
| Sliding puzzle | Solved the displayed, randomly shuffled board using 18 legal tile-button moves; HUD became 1/2 and the menu showed Solved. | `sliding-puzzle-solved.jpg` |
| Matching puzzle | Flipped matching photo cards through their buttons; six tries found all six pairs; HUD became 2/2. | `matching-puzzle-solved.jpg` |
| Gift gate | Gift began locked at 0/2, remained locked at 1/2, opened automatically after the second win; unwrapping displayed the gift photo and text; photo loaded at natural width 1600. | `puzzles-locked-gift.jpg`, `gift-revealed.jpg` |
| Saved puzzle progress | Observed `["slide","match"]` in the existing game storage key and 2/2 after a reload. Restored the original storage value after testing. | UI screenshots and recorded check |
| Partner | Closing the gift spawned the partner and displayed the follow greeting. Walking after return showed the second avatar following; prebuilt player batches also tested after museum return. | `partner-following.jpg` |
| Museum | Entered, loaded gallery photos, started/stopped guided tour, opened a frame, used Next/Prev, verified the full-size image loaded, walked manually, left and re-entered with the partner; no production console errors. | `museum-gallery.jpg`, `museum-photo-viewer.jpg`, `museum-with-partner.jpg` |
| Background rendering | Town performance sample count stayed at 20 while puzzles/gift were open; museum also paused the underlying town renderer. Rendering resumed on return. | UI checks and performance log |
| Heart collection | Real map taps and Shift-to-run routes collected heart IDs 13, 12, 11, 3, 4 and 5; HUD advanced from 0/16 to 6/16 and displayed the letter unlock message. | `heart-collection-checks.json`, `six-hearts-collected.jpg` |
| Letter gate | Entry at zero hearts displayed the six-heart requirement; after collecting six, the actual letter modal opened. Next/Previous photo controls worked. The reply form was inspected; no message was submitted. | `letter-box-locked.jpg`, `letter-box-unlocked.jpg` |
| Routing | A real route crossed the river bridge and collected the western road heart, followed by a cross-town return route. Automated checks also prove every place and all 16 hearts are reachable. An isolated original heart placement was corrected. | `bridge-route-complete.jpg`, automated tests |
| Birthday | Followed the birthday route, made a wish, observed song/wish, candles-out celebration/fireworks and finale card, toggled mute both ways, and returned using Thank you. Movement keys were held during the show and did not interrupt it. | `birthday-fireworks.jpg`, `birthday-card.jpg` |
| Day/night and map | Natural cycle and day/night control exercised, with lit lamps, fireflies and lanterns. Portrait map now contains the whole town; mathematical bounds are tested in portrait and landscape. | final mobile screenshots and automated tests |
| Lifecycle | Avatar-editor unmount/re-entry, museum leave/re-entry and multiple town reloads completed without production runtime errors. GPU timers, renderer targets, shadows, environment maps and input listeners have cleanup paths. | UI checks and production error log |

`route-points.json` records deterministic layout coordinates used to choose map taps; collection and movement still passed through raycasting, A*, collision and the ordinary game loop. `?fps&at=post`, `at=arcade`, `at=museum` and `at=party&birthday` are reproducible diagnostic starting positions, gated by the existing FPS debug query.

The original puzzle progress was restored after the test. No reply message or other external communication was sent through the game.

Performance measurements and their limitations are recorded separately; functional checks do not by themselves certify a sustained frame rate.
