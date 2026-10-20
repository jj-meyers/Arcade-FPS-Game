# Unfug — validation and limits

## Executed automated checks

Gameplay, customization, physics, AI/navigation and real server/client tests run with `npm test`. Browser integration runs use system Chromium with software WebGL. The counts below describe the expanded build, including the latest assist, spawn, and network-cancellation fixes.

- **Logic and server suite: 94/94 passed**, zero skips. This includes 11 network tests (10 real WebSocket scenarios plus a mocked-clock client-cancellation regression).
- **Production build:** Vite build succeeds. Its Three.js vendor chunk emits an advisory size warning; this is not a build error.
- **Local production browser suite: 14/14 passed**, no page exceptions or console errors. It covers the original loop plus classes, tuning, actual model customization, saved builds, F/X actions, motion settings and TDM.
- **Network browser suite: 6/6 passed**, zero errors. Two independent browser contexts create/join a real room, move/fire through actual input, receive shared TDM results, transfer hosting/rematch, disconnect and display a rejected-room error. Evidence: `test-results/network-browser.json`.
- **Standalone artifact: 14/14 browser scenarios passed**, no page exceptions or console errors, with no separate resource requests during bot workflows. `npm run build:standalone` produced the self-contained `dist/unfug.html` (938 KiB), served over local HTTP for this check.

Generated reports and screenshots live in ignored `test-results/`. They contain measured results, not credentials. This document records the useful summary for future checkouts.

## CPU simulation benchmark

The final `node tests/benchmark.mjs` pass used Node **24.19.0** on a shared Linux x64 host (AMD EPYC 9V74, five exposed logical CPUs), fixed seed **2031**, **12 bots** (two of each class), FFA, 60 Hz, a **90-second match plus three-second countdown**, and score limit 100. Each case completed 5,580 simulation steps with finite bounded state. Construction was excluded.

| Difficulty | Whole run elapsed | p95 Game.step | p99 Game.step | Worst step | Eliminations | Peak projectiles / fields |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Easy | 1,844 ms | 0.696 ms | 3.082 ms | 9.371 ms | 86 | 16 / 10 |
| Normal | 1,797 ms | 0.615 ms | 3.882 ms | 17.300 ms | 125 | 18 / 14 |
| Hard | 1,690 ms | 0.622 ms | 3.512 ms | 8.682 ms | 160 | 22 / 14 |
| Veteran | 1,681 ms | 0.607 ms | 3.623 ms | 10.619 ms | 166 | 19 / 18 |

All six class abilities appeared at every difficulty, along with gadgets and Impulse. Whole-run elapsed time includes assertion/event accounting; per-step timings isolate `Game.step`. CPU usage and individual event counts are in `test-results/benchmark.json`. Occasional long steps are recorded rather than hidden by averages. Shared-host scheduling, garbage collection and differing engagements affect these numbers.

A separate instrumented AI pass (seed 123, 120 simulated seconds) observed at most three perception passes, two tactical decisions, two paths and 2,984 expanded path nodes per active tick, below the 3,200-node cap. Permanent tests enforce these work budgets. Its raw historical report is `test-results/ai-benchmark-final.json`; the table above is the final full-simulation run after spawn/assist fixes.

Neither pass measures rendering FPS, GPU speed, WAN latency or human responsiveness. The numbers are observations, not a minimum hardware promise.

## Permanent regression coverage

| Area | Assertions |
| --- | --- |
| Movement | 30/60/120 Hz consistency; normalized diagonals; sprint/crouch; cover sliding; thin-wall/boundary anti-tunneling; jump/landing; ramp/platform traversal; slide momentum/decay/retrigger/cancellation |
| Rays | Head/body distinction, nearest world surface, range limits, exact ramp slope and line-of-sight obstruction |
| Match lifecycle | Countdown, pause, scoring/deaths, single elimination, invulnerability, respawn equipment/safe position/facing, time/score endings, restart, deterministic seeded FFA |
| Team rules | Team assignment/composition, friendly damage/impulse rejection, hostile scoring, assists, team win and timer draw |
| Customization | Legacy migration, malformed IDs, independent tuning budgets, true weapon stat changes/tradeoffs, active weapon handling, equal cosmetic stats/hitboxes |
| Impulse/classes | Movement and hostile force charge caps; pause/teleport/self/team farming rejection; cone/LOS/team rules; three distinct cores; projectile owner retention/speed bounds; brace expiry; healing/resupply team rules; dash collision and airborne launch |
| Weapons/gadgets | Cadence/reserves/reload/switch; swept hits/ricochet; cover-blocked blasts; shield hitscan/projectile/blast behavior; pull/push; springs/vortex/traps/fuses; burst timing/cancel; spin-up/reset; temporary glue slow; returning-disc legs; chain LOS/team exclusion; speed/slow fields; repulsor deflection; bounded cluster children and entity caps |
| AI/navigation | Fair delayed/imperfect aim, hidden-position memory expiration, no shots through walls, bot-vs-bot combat, veteran behavior, human actor exclusion, team targeting, shared work budgets, no starvation, clearance/path smoothing, ramp/platform route, isolated rooftop drop |
| Networking | Real multiple clients and shared authority, movement/combat/scores, TDM, host transfer/room cleanup, payload/rate/input/loadout validation, join limits, stale-input neutralization, rejected connections and socket cleanup |

## Browser workflow coverage

The local suite serves a fixed production snapshot so live source edits cannot trigger HMR mid-scenario. It checks actual WebGL draw calls and native menu Tab focus, all twelve weapon cards, gadget/perk/core choices, six classes, per-gun tuning budgets, live model/color/class preview updates, saved builds and reload persistence.

It then checks settings against actual renderer/input state; native start-button pointer lock and countdown; keyboard movement/sprint/jump and relative mouse motion; real mouse firing/reload/switch; Q/E deployment; F ability and X Impulse; scoreboards; death and a forced multi-step main-loop respawn; Escape/resume; results/replay; an accelerated twelve-bot veteran round; team selection/HUD/draw results; and narrow layout/corrupt-storage fallback.

Some combat actors, charge values and timers are deliberate deterministic fixtures. Automated input is genuine, but this is not a claim of uninterrupted skilled human play. The online suite uses a real server and independent clients, not disconnected simulations. See its report for exact completed scenarios.

## Commands

```sh
npm test
npm run build
npm run test:browser
npm run test:network
npm run test:network:browser
node tests/benchmark.mjs
```

Set `CHROMIUM_PATH` when system Chromium is elsewhere. `TEST_URL` points the local browser runner at an already serving build. For the portable artifact, build it, serve `dist/`, then run `STANDALONE=1 TEST_URL=http://127.0.0.1:5175/unfug.html npm run test:browser`. Standalone checks reject separate resource requests during bot workflows. Network tests intentionally contact the configured room server.

The managed browser in this environment blocks `file://` navigation. Static HTTP testing of the same portable HTML is available; it does not establish direct-file behavior in every browser. Sandboxed frames require `allow-pointer-lock`, while top-level hosted pages avoid that embedding restriction.

## Remaining manual/device testing

- Human movement/gun feel and full-length rounds with different skill levels.
- Weapon/class/core balance, support stacking, chain readability and sensory overload.
- Listening to the actual synthesized audio/music mix.
- Real laptop/mobile-class GPUs, sustained rendering, thermal throttling and long customization sessions.
- Firefox/Safari, fullscreen transitions and browser-specific input behavior.
- Multiple remote humans with latency, jitter, disconnects and abuse/load testing. There is no public hosted room endpoint and no prediction, hit rewind or reconnect recovery.
- Accessibility review. Fixed keyboard controls and desktop mouse input remain required; no controller/touch gameplay.
