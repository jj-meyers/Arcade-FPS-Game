# CHAOS FPS

**Organized nonsense.** An original browser FPS about heavily armed beans, weaponized soda, questionable physics, and free-for-all bot matches. The map is intentionally a small, replaceable graybox.

## Play without installing anything

Download the generated `dist/chaos-fps.html` and open the saved file directly in a current desktop Chrome or Edge browser. It contains the game, renderer, styling and procedural assets in one file; no server or internet connection is required. Use **LET'S MAKE CHAOS** → **START THE MESS** to capture the mouse.

Embedded previews may forbid mouse capture, even when the page renders correctly. Open the downloaded file in a normal browser window. The cloud onboarding interface also does not expose the cloud machine's `localhost` as a public game URL.

To regenerate this portable version after source changes, run `npm run build:standalone`. The regular website build remains `npm run build`.

## Run locally

Use **Node.js 22.12+** (Node 24 is used in this environment).

```sh
cd /workspace/Arcade-FPS-Game  # or your local clone
npm ci
npm run dev
```

Open the local address Vite prints in a current desktop browser. Click **LET'S MAKE CHAOS**, choose match settings, then **START THE MESS**. That click captures the mouse and enables procedural audio. Esc pauses and releases the mouse; click **BACK TO THE MESS** to resume.

If this cloud machine's default npm cache is not writable, use `npm ci --cache /workspace/.npm-cache`. No accounts, credentials, paid assets, backend, or external runtime services are needed. This is a desktop keyboard-and-mouse game; touch controls are not implemented.

## Controls

| Input | Action |
| --- | --- |
| WASD / mouse | Move / look |
| Shift | Sprint |
| Space | Jump |
| C or Ctrl | Crouch |
| Left mouse | Fire |
| Right mouse | Aim; with the magnet, hold with fire to push |
| R | Reload |
| 1 / 2 or wheel | Switch weapons |
| Q / E | Tactical / lethal gadget |
| Tab (hold) | Scoreboard |
| Esc | Pause and free mouse |

Try **Space Program** in the arsenal: launch a rival with Ceiling Fan Club, switch to Personal Space Invader, and pull them back. **Rubber Duckruptcy** gets stronger after a bounce. **Ding-Dong, Gone** can kick you into the air if you fire downward while jumping. Spring pads work on everyone. Bubbles block incoming shots, while their owner can shoot out. Drama Magnets bend projectiles and draw rivals toward a grenade.

## What's here

- Fixed-step movement with sprint, jump, air steering, crouch, ramps and collision.
- Seven weapons, five cooldown gadgets, three perks, four presets and persistent custom loadouts.
- One complete FFA mode: 1–12 bots, three difficulties, four bot personalities, countdown, respawn protection, timer/score endings, rankings, replay and pause.
- Bots use line of sight, delayed reactions, finite memory, imperfect aim, A* navigation, strafing, retreating, weapons and gadgets. They fight each other too.
- Procedural characters, toy weapons, recoil/reload animations, effects and Web Audio sounds.
- Persistent sensitivity, FOV, sound, graphics, render scale, crosshair and shake settings.

## Build and verify

```sh
npm test                 # deterministic Node tests
npm run build            # static production output in dist/
npm run preview          # inspect that build locally
npm run test:browser     # Builds, then tests in Chromium using a local preview server
```

Browser tests use `/usr/bin/chromium` if present. Otherwise install a Playwright browser with `npx playwright install chromium`, or set `CHROMIUM_PATH` to a compatible local Chromium executable. Screenshots and the browser report go to ignored `test-results/`. See [testing notes](docs/TESTING.md) for scope and manual checks.

Deploy the contents of `dist/` to a static HTTPS host. The production game makes no external requests. Networking/multiplayer and desktop packaging are future work. A development server is for local development, not production hosting.

## Development map

| Location | Responsibility |
| --- | --- |
| `src/game/Game.js` | Actors, damage, lifecycle, scoring, authoritative simulation |
| `src/game/physics.js`, `math.js` | Movement, geometry and ray queries |
| `src/game/Combat.js` | Weapons, ammo, projectiles, gadgets and shared interactions |
| `src/game/AI.js`, `navigation.js` | Bot decisions and navigation |
| `src/data/catalog.js` | Equipment values, descriptions, presets, perks |
| `src/data/arena.js` | The deliberately simple, replaceable map |
| `src/render/` | Three.js presentation and procedural assets |
| `src/platform/` | Keyboard/mouse input and audio synthesis |
| `src/ui/` | Menus, HUD and saved preferences |
| `src/main.js` | Browser lifecycle and fixed-step integration |

The simulation has no DOM or Three.js dependency. Inputs, actor IDs and events form a useful boundary for eventual networking; no network transport, prediction or server authority is implemented yet. New maps must supply collision shapes, spawns and ramp data, then rebuild the AI navigation grid.

All game visuals and sounds are generated by this project. Third-party libraries retain their own licenses (Three.js MIT; Vite MIT; Playwright Apache-2.0). No downloaded art or audio assets are used.

See the [master design document](docs/GAME_DESIGN.md), [prioritized backlog](docs/BACKLOG.md), and [implementation contracts](docs/CONTRACT.md).
