# Unfug

A browser arena shooter about movement, homemade contraptions, and controlled nonsense. This expands the existing game: its original movement, equipment, graybox arena, and bot loop remain the foundation.

**Play:** [jj-meyers.github.io/Arcade-FPS-Game](https://jj-meyers.github.io/Arcade-FPS-Game/). The static site supports local bot matches. Online rooms require a separately running compatible WebSocket server; GitHub Pages does not run that server.

## Run locally

Use Node.js **22.12 or newer**. This workspace uses Node 24.

```sh
npm ci
npm run dev
```

Open the address Vite prints in a desktop browser. Start a match to capture the mouse and enable audio. Esc releases the mouse. Local bot matches pause when the browser loses focus; a shared online match keeps running on its server.

For a cache-permission issue in the cloud workspace, use `npm ci --cache /workspace/.npm-cache`. No accounts or external assets are needed for bot play. Touch gameplay and controllers are not implemented.

## Play styles

- **FFA or Team Deathmatch:** 0–12 bots, easy/normal/hard/veteran, match length, score limit, team selection and bot class selection.
- **Six classes:** Runner dash, Bulwark brace, Medic healing, Engineer resupply, Disruptor slowing field, Acrobat airborne launch. Everyone has 100 health and the same collision dimensions.
- **Impulse:** movement fills a meter. Spend it on a short directional Repel, Lift or Pull pulse. It moves enemies and flying projectiles without directly dealing damage. Cover, positioning and resistant builds provide counters.
- **Twelve weapons:** fast spray, shotgun recoil, ricochets, explosives, precision, launch/pull tools, timed burst, spin-up, glue slow, returning disc and chain conductor.
- **Eight gadgets, three perks, six presets:** choose combinations freely. Each gun has a five-point tuning budget, with explicit stat tradeoffs.
- **Appearance:** body/accent colors, hats, face/back accessories, patterns and weapon finishes. Cosmetics do not alter stats or hitboxes. Six saved custom loadouts live in browser storage.

The map remains one small graybox. The project focuses on combat, bots and interactions before adding more arenas or modes.

## Controls

| Input | Action |
| --- | --- |
| WASD / mouse | Move / look |
| Shift | Sprint |
| C or Ctrl | Crouch; press while sprinting to slide |
| Space | Jump; cancels a slide |
| Left mouse | Fire |
| Right mouse | Aim; with Yoink, hold with fire to push |
| R | Reload |
| 1 / 2 or wheel | Switch weapons |
| Q / E | Tactical / lethal gadget |
| F | Class ability |
| X | Impulse, when fully charged |
| Tab (hold) | Scoreboard |
| Esc | Menu / release mouse |

Try **Air Time**: launch a rival, switch to a precision or pulling weapon, then use your Impulse to change their landing. **Banker** uses ricochets and cover. **Support** combines team healing, speed and a weapon that punishes clustered enemies. These are strategies to experiment with, not claims of settled competitive balance.

## Small-room multiplayer

```sh
npm run server
```

The server listens on `0.0.0.0:8080` by default. Override `HOST` and `PORT` as needed. `GET /health` reports readiness and room count. Open the game's online menu, use `ws://localhost:8080` when playing locally, create a room and share its six-character code. Other players connect to the **same server URL** and code. The host starts the match or rematch. Rooms support at most eight humans plus twelve bots.

For remote play, run the Node server on a persistent host behind TLS with WebSocket upgrades enabled, and supply its `wss://` address. An HTTPS GitHub Pages client cannot use an insecure remote `ws://` server. There is no publicly deployed multiplayer endpoint bundled with the static game.

The server owns simulation, movement, damage, scoring and match results. Clients submit bounded input. Authoritative simulation runs at 60 Hz and broadcasts snapshots at 15 Hz; the browser interpolates state. The first version has no client movement prediction, server rewind/lag compensation, account authentication or reconnect recovery. Public competitive deployment needs further security, latency and operational testing.

## Build and verify

```sh
npm test                    # deterministic gameplay + real server/client tests
npm run build               # normal static production output in dist/
npm run preview             # inspect that output locally
npm run build:standalone     # self-contained dist/unfug.html
npm run test:browser         # builds a snapshot, runs real Chromium/WebGL workflows
npm run test:network:browser # two independent browsers with a real room server
node tests/benchmark.mjs     # 12 bots x four difficulties, CPU simulation timings
```

The portable HTML contains the game and procedural assets. Download it and open it in a desktop browser, or serve it from a static host. Bot play has no runtime network dependency. Sandboxed embedded previews may disallow pointer lock; use a normal browser tab.

Browser tests use `/usr/bin/chromium` if present, otherwise Playwright's installed Chromium; `CHROMIUM_PATH` can override it. Generated reports and screenshots are ignored in `test-results/`. See [TESTING.md](docs/TESTING.md) for executed evidence and its limits.

## Development map

| Location | Responsibility |
| --- | --- |
| `src/game/Game.js` | Actors, shared human input, damage, teams, assists and match lifecycle |
| `src/game/physics.js`, `math.js` | Movement, slide, collision and geometric queries |
| `src/game/Combat.js` | Weapons, projectiles, gadgets, class abilities and Impulse |
| `src/game/AI.js`, `navigation.js` | Perception, tactics, navigation and difficulty |
| `src/data/catalog.js` | Weapon/gadget/perk/preset balance |
| `src/data/customization.js` | Classes, cosmetics, tuning budgets and validation |
| `src/data/arena.js` | Graybox geometry and spawns |
| `src/render/` | Three.js models, animation and bounded effects |
| `src/platform/` | Keyboard/mouse and audio synthesis |
| `src/ui/` | Menus, HUD and versioned saved preferences |
| `src/net/`, `server/` | Client transport, snapshots and authoritative room server |
| `src/main.js` | Local/network lifecycle, input and frame loop |

Simulation is independent of the DOM and Three.js. Both local games and the room server use it. Keep mechanics in data and shared simulation, then expose feedback through events; do not implement separate client damage rules. New maps must supply collision and spawn data and rebuild navigation.

Original visuals and sounds are generated by this project. Three.js and Vite use MIT licenses; Playwright uses Apache-2.0; ws uses MIT. No copied game characters, artwork or sound packs are used.

See the [retained project brief](docs/PROJECT_BRIEF.md), [design and mechanics](docs/GAME_DESIGN.md), [remaining work](docs/BACKLOG.md), [validation](docs/TESTING.md), and [expansion interfaces](docs/UPDATE_CONTRACT.md).
