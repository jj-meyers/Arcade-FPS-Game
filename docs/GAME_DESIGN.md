# CHAOS FPS — master game design

## Intent and boundaries

A fast, readable, silly arena FPS in which movement and equipment create surprises. The player remains in control; confusion and random instant death are not design goals. Priorities: fun, input response, legible combat, capable bots, reliable full matches, then presentation. The initial map deliberately contains only a floor, boundary walls, nine boxes and one ramp. Environmental art, multiplayer and additional modes wait for later sessions.

## Current playable loop

Lobby → choose a preset or customize five equipment slots → configure a bot FFA → three-second countdown → fight/respawn → score or time limit → ranked results → replay or lobby. Match settings support 1–12 bots, easy/normal/hard, 1/3/5/10 minutes and 10/20/30/50 eliminations. The simulation additionally accepts shorter durations for testing. Every opponent is hostile to everyone else.

An elimination awards one point. Self-eliminations add a death without a kill. Ranking sorts kills descending, deaths ascending, then name as a deterministic final tie-break. The first score-limit event ends the match immediately; at the time limit the ranked leader wins. Respawn takes 2.8 seconds at a spawn favoring distance from living opponents. A 1.3-second spawn shield ends when the actor attacks. Ammo, health and gadgets reset on respawn. Pausing freezes all simulation clocks.

## Movement and collision

Simulation ticks at 60 Hz; rendering has its own clock. Horizontal movement accelerates toward the desired velocity, with stronger control on the ground and weaker air steering. Default movement is 6.5 units/s, sprint 10, crouch 3.6; gravity is 24 units/s² and baseline jump impulse 9 units/s. Diagonal movement is normalized. Crouching lowers the actor's height. Sliding and wall running are not included.

The controller is a vertically aligned character volume. Short substeps prevent crossing thin cover at high speed. Horizontal collision slides along walls; feet stand on box tops and the ramp's exact sloped plane. Knockback shares the movement velocity and is bounded. The arena has an invisible upper continuation of its boundary so launching cannot eject actors from the playable area.

Hitscan checks cover, boundary, ramp, body and head geometry. Headshots use a separate sphere. Projectiles use continuous centerline segments with forward radius clearance; they do not use general swept convex geometry. Blast, trap and vortex effects check cover occlusion. Bots use the same movement, damage, equipment and collision routines as the player.

## Arsenal

Exact balancing lives in `src/data/catalog.js`.

| Weapon | Role and mechanic | Tradeoff |
| --- | --- | --- |
| Fizzy Business | 32-round soda SMG; fast hitscan spray | Range falloff and spread |
| Ding-Dong, Gone | Nine-pellet shotgun; recoil also pushes the shooter | Short effective range, six rounds |
| Rubber Duckruptcy | Rubber projectile; three bounces, +22% damage per bank | Travel time and geometry matter |
| Party Foul | Arcing, bouncing confetti mortar; timed or contact explosion | Four rounds; self-splash is possible |
| The Last Straw | Accurate, high-damage precision hitscan | Five rounds and slow follow-up |
| Ceiling Fan Club | Air projectile that launches the target upward | Modest damage; needs a follow-up |
| Personal Space Invader | Short-range momentum magnet; pulls by default, RMB+LMB pushes | Low range and damage |

Weapons have magazines, finite reserves, fire cadence, reload durations, switching delay and meaningful headshot multipliers where appropriate. ADS narrows FOV and most hitscan spread. Firing an empty gun attempts a reload. Switching cancels the unfinished reload. Shooting triggers original synthesis, traces, impacts, muzzle flashes, kick and subtle hitmarkers; elimination adds a sound sting and confetti. Visual kick is procedural; there is no complex attachment/recoil-pattern system.

## Equipment and combinations

| Gadget | Slot | Behavior / restriction |
| --- | --- | --- |
| Boing Insurance | Tactical | 18-second shared spring pad; 12-second deployment cooldown; per-actor retrigger cooldown |
| Personal Bubble | Tactical | Stationary seven-second, 160-health shield; owner can shoot outward; 17-second cooldown |
| Drama Magnet | Tactical | Five-second local gravity field pulling exposed enemies and bending flying projectiles; 15-second cooldown |
| Cherry Bomb-ish | Lethal | Bouncing grenade, 1.65-second fuse, radial damage/knockback; nine-second cooldown |
| Whoopee Cushion | Lethal | Proximity trap, 0.8-second arming delay, damage plus launch; owner does not trigger it; 12-second cooldown |

Spring pads make vertical routes and escapes. Downward shotgun recoil adds height. Air-cannon launches create precision opportunities. Magnet pull can gather rivals near explosives; its alternate push can repel them. Gravity fields curve rubber shots and grenades. Cover blocks area effects, and shields can intercept shots and explosions. Self-blast damage is reduced, not removed. No team-specific gadget rules are needed in this FFA build.

Perks: **Loose Springs** increases speed and jump impulse but also incoming knockback; **Emotional Baggage** cuts incoming impulse with movement/reload penalties; **Fast Hands, No Plans** reduces reload time. Four curated presets are House Party, Creative Accounting, Space Program and Certified Disaster. Primary, secondary, tactical, lethal and perk choices persist in versioned local storage.

## Bots

Bots use A* over a clearance-aware grid derived from the map, with collision-tested path smoothing. Limited range/cone and line-of-sight checks govern perception. Visible enemies may be any other actor. Targets hidden by walls are remembered briefly at their last observed position; damage cues provide a noisy hint instead of exact tracking. Every shot rechecks occlusion.

Difficulty modifies reaction latency, aim error, prediction, firing bursts, aggression and movement, not health. Profiles favor rush, distance, unusual gadgets, or precision; they map to aggressive, cautious, chaotic and precision personalities in the actor data. Bots roam when uninformed, strafe while engaged, reload, swap weapons, react to pressure, use situational gadgets and recover when stuck. The grid conservatively treats the current ramp as blocked, so bots fight around it instead of planning elevation routes.

## Presentation and settings

Procedural bean combatants with expressive eyes, hats, feet and toy guns. Running, airborne motion, recoil, reload, hits and confetti eliminations are presented using transforms and bounded effects. Viewmodel weapons render in a separate scene to avoid clipping into cover. A restrained graybox leaves combat readable. Lighting/shadows, render resolution, FOV, crosshair, camera shake, input sensitivity and sound gains respond to settings. Quality presets reduce shadows/effect budgets. Settings and equipment survive reload, including safe fallback from malformed local storage.

All sound is Web Audio synthesis: shots, reloads, switching, hits, kills, blasts, gadgets, jumps, landings, menus and match outcomes. Browser audio starts only after an interaction. There is no music track or external sound library.

## Architecture and extension

`Game` owns simulation state and match rules. `Combat` owns projectiles and gadget fields. `AI` emits intentions and calls the shared combat API. Physics handles movement and geometric queries. Input produces player intentions. Renderer/UI/audio consume state and events. `main.js` advances the simulation using an accumulator and handles pointer lock, pause, focus loss and results. Catalog and arena modules supply data.

For multiplayer, retain actor IDs, commands and event boundaries; add an authoritative server, validated input protocol, state serialization, interpolation/prediction and reconciliation. Deterministic seeded tests aid diagnosis but are not a network implementation. For more maps, start with data-compatible obstacles/ramps/spawns and rebuild navigation. Complex meshes, moving cover and general rigid bodies would need further collision/navigation work.

## Validation status and known limits

The authoritative executed checks and browser scenarios are recorded in `TESTING.md`. The core deterministic suite covers physics, match rules, combat interactions, bot perception and full bot matches. Human feel/balance testing, other browsers, real GPU performance, mobile input, touch accessibility, online multiplayer and desktop packaging remain separate work. Production is a static browser build, not a hosted service.

The roadmap and every deferred initial-brief feature are tracked in `BACKLOG.md`. Expand the gameplay before expanding the map.
