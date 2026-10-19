# Validation and playtest notes

## Executed on this build

- **43/43 deterministic tests passed**, no skips: `npm test` on Node 24.
- **11/11 browser scenarios passed**, no page exceptions or console errors: `npm run test:browser` using system Chromium and software WebGL.
- **Standalone build: 11/11 browser scenarios passed**, including pointer lock and match play, while serving only `chaos-fps.html`. Request monitoring confirmed no separate scripts, styles, fonts or other game resources were loaded. The cloud's managed Chromium blocks `file://` navigation by policy, so direct local-file navigation was not verified in that browser; the same artifact was tested over static HTTP.
- **Production build passed**: `npm run build`. The Three.js vendor chunk triggers Vite's advisory size warning; it is about 181 kB gzipped. Game code is about 36 kB gzipped and CSS about 10 kB gzipped. There are no external art/audio downloads.
- **Visual inspection:** 1440×900 menu, arena/HUD, arsenal, setup and results; 390×844 menu. Narrow menus work, but narrow-screen touch gameplay is not implemented.
- **Additional renderer smoke executed:** all seven weapon models/firing paths, spring/shield/vortex/trap visuals, heavy elimination effects capped to the configured budget, restart cleanup, render scale and disposal. No renderer errors.
- **Additional AI simulation executed:** 90 seconds with 12 bots on each difficulty. Bots fired, damaged one another, reloaded, used gadgets and respawned; positions remained finite and within the arena.

The browser runner builds and serves a production snapshot on port 5174, avoiding development-server hot reload during a scenario. It closes its browser and server on completion. Set `TEST_URL` to use an already running server instead. Set `CHROMIUM_PATH` when the browser executable is elsewhere. Screenshots and `browser-report.json` are written to ignored `test-results/`. On failure, the runner writes diagnostics and a screenshot and returns a failing exit code.

To test the portable artifact, run `npm run build:standalone`, serve `dist/` with a static server, then run `STANDALONE=1 TEST_URL=http://127.0.0.1:5175/chaos-fps.html npm run test:browser` (adjust the port). The additional standalone assertion rejects any request for a separate resource. On an unmanaged browser, `TEST_URL` can also be a `file:///.../chaos-fps.html` URL.

Preview diagnosis: the live development server rendered and started correctly in Chromium. A sandboxed iframe without `allow-pointer-lock` reproduced a start failure; the same frame with that capability worked. The source `index.html` now shows an explicit startup fallback instead of a blank page when its module cannot load. Opening the source HTML outside Vite is not equivalent to running the built game.

## Deterministic coverage

| Suite | Executed checks |
| --- | --- |
| Physics | 30/60/120 Hz movement consistency; diagonal normalization; sprint/crouch speed; cover sliding; thin-cover/boundary collision; jump and single landing; ramp-to-platform walk; steep ramp side rejection; exact slope ray; ray distance limits |
| Game | Countdown; yaw-relative movement; pause; body/head hits; cover occlusion; damage and kill attribution; no double kills; self-death; safe respawn and protection; perk impulse bounds; immediate score ending; timer winner/restart; invalid equipment fallback; full FFA; reproducible seeded simulation |
| Combat | Cadence; ammo/reload reserves; quick perk; switch cancellation; dead actors; swept fast projectile; self-ignore; ricochet damage; blast cover; shield hitscan/projectile/blast absorption and owner fire; pull/push; spring cooldown; vortex curves/pull; trap arming; grenade fuse; attacking ends spawn protection |
| Navigation / AI | Obstacle clearance; paths around cover; sealed barriers; thin-wall/corner smoothing; blocked-footprint recovery; seeded roaming; reaction latency; no hidden-position updates or shots through walls; memory expiration; bot-vs-bot targeting; difficulty reaction differences |

## Browser scenarios

1. WebGL initializes, scene renders, lobby loads, native Tab focuses menu buttons.
2. Seven weapon choices, tactical/lethal/perk options and custom selection survive reload.
3. FOV, sensitivity, graphics quality, crosshair and render scale settings persist; rendering resolution and shadow state change.
4. Match configuration, an actual start-button click, pointer lock, countdown and HUD.
5. Actual keyboard movement/sprint/jump and relative mouse events reach the simulation.
6. Actual mouse firing kills a deliberately positioned target; real R/2 input reloads and switches, with matching HUD.
7. Real Q/E input deploys equipment and starts cooldowns; held Tab shows and hides the scoreboard.
8. Injected lethal damage attributes a death, then simulation respawns the player and restores visible health.
9. Escape pauses the simulation clock; clicking Resume recaptures the mouse.
10. Timer results, replay, return to lobby, and a complete accelerated 12-bot hard match with bounded effects and valid positions.
11. Narrow layout loads, and deliberately corrupted local storage falls back safely.

Combat and lifecycle fixtures deliberately place actors, shorten timers or advance fixed simulation steps to make assertions reliable. These are integration checks, not a claim that an automated agent played a skillful uninterrupted match. Sound-generation code executes in these browser runs, but the sound mix was not evaluated by human listening. Software WebGL validates functionality, not real GPU frame-rate performance.

## Manual checks still valuable

1. Run a normal three-minute, five-bot match. Walk, strafe, sprint and jump around every cover object; climb the ramp, jump off the platform, crouch behind low cover. Check mouse feel and perceived responsiveness.
2. Try each preset. Fire downward while airborne with the shotgun, bank rubber rounds around cover, launch a rival then switch weapons, and compare magnet pull versus RMB+LMB push.
3. Deploy every gadget; use a spring pad to escape a grenade, fire from inside a shield, and throw explosives near a vortex. Confirm the visual cues are understandable.
4. Listen on headphones/speakers for shot differentiation, recoil/reload cues, hit confirmation, deaths and match outcomes. Adjust gains and shake.
5. Compare easy, normal and hard; 1, 5 and 12 bots; score-limit and timer endings. Look for unfair aim, trapped bots or repetitive tactics.
6. Alt-tab during play, Esc/resume repeatedly, change settings while paused, then restart twice. Check fullscreen and mouse recapture in the intended browser.
7. Test Firefox/Safari, a low-power integrated GPU and a high-refresh display. Measure actual performance before promising a hardware frame-rate target.

## Known limitations

- Bots' ground navigation avoids the ramp instead of planning elevated routes.
- Projectile collision is a continuous centerline approximation with radius clearance, not full swept-sphere collision at grazing edges.
- Long-lived players can exhaust finite ammo reserves; resupply currently occurs on respawn.
- Boundary collision continues above the visible wall to retain launched actors.
- No touch/controller controls, online networking or desktop packaging.
- Human game-feel/balance assessment, audio audition, real-GPU benchmarks and cross-browser validation remain outstanding. None are claimed as completed.
