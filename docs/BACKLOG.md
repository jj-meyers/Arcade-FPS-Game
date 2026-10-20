# Unfug — remaining work

Status is about shipped behavior, not the ambition of the design brief. Automated evidence belongs in [TESTING.md](TESTING.md); it does not establish subjective fun, balance or real-hardware frame rate.

## Implemented expansion

- Shared FFA and Team Deathmatch rules, team scores/draws, friendly-fire rejection, assists, safe respawns and zero-bot practice.
- Six classes with active abilities, three Impulse cores, movement charging, bounded forces and temporary status effects.
- Twelve weapon mechanics, eight gadgets, three perks, six starting presets and per-gun five-point tuning budgets.
- Modular visual customization, weapon finishes, live menu preview and browser-local saved builds.
- Four bot difficulties, class-aware choices, team-aware targets and mixed human/bot actor support.
- Sprint-crouch sliding, motion reduction, effects/shadow controls and additional HUD feedback.
- Authoritative anonymous small-room WebSocket server/client, input validation, snapshots, host/rematch/disconnect lifecycle. It requires a persistent server; a public endpoint is not deployed with GitHub Pages.

## P0 — validate and tune the expanded loop with people

1. Run several normal-length rounds with novices and experienced FPS players. Compare the preset choices and collect concrete frustration/death examples. Tuning tables are initial values, not a proven competitive metagame.
2. Check all six classes with all three cores. Look for excessive knockback chains, slow stacking, safe healing/resupply positions and extreme movement/attachment combinations.
3. Play actual two-to-eight-human rooms under realistic latency, jitter and packet loss. Local automated clients establish communication and authority, not WAN feel.
4. Listen to the mix through headphones/speakers. Check useful cues under simultaneous weapons and abilities; visual automation cannot judge sound quality.
5. Validate real GPU rendering at common laptop/desktop resolutions and sustained sessions. CPU simulation benchmarks and software WebGL do not substitute for device measurements.
6. Confirm Firefox/Safari pointer-lock, audio, fullscreen and reconnect-to-menu behavior. Automated Chromium is the current baseline.

## P1 — finish partial foundations

- **Latency handling:** authoritative snapshots/interpolation exist; client prediction, reconciliation and server-side hit rewind do not. Design and measure them before competitive multiplayer claims.
- **Public hosting:** deploy and operate a persistent WSS server with health checks, TLS renewal, origin policy, logging, abuse limits and load tests. Static GitHub Pages alone cannot host it.
- **Network resilience:** reconnect/rejoin tokens, host-transition edge cases during deployment, deliberate poor-network tests and longer room churn soak tests.
- **Navigation/tactics:** richer coordination and new-map validation. Height-aware ramp/platform traversal, isolated rooftop drop recovery and danger/cover scoring are implemented; they are not general navigation for arbitrary future maps.
- **Projectile contact:** full swept-sphere/convex collision for grazing edges and complex geometry. The present radius-clearance centerline sweep is approximate.
- **Accessibility:** configurable key bindings, controller support, keyboard focus refinement, alternate team palettes and more HUD scaling. Reduced motion and non-color team cues exist; full accessibility support is not complete.
- **Animation:** richer pose transitions, class reactions and weapon-specific reload motion without delaying input or altering hitboxes. Current animation is procedural and deliberately lightweight.
- **Performance:** reuse/pool frequent transient objects, profile large effect bursts and room concurrency, measure material/mesh caches over long customization sessions.

## P2 — deepen variety without inflating scope

- Better onboarding/training prompts for Impulse, slide, damage sources, tuning budgets and support roles.
- More informed bot choices around return discs, burst tracking, hostile fields, projectile deflection and coordinated team support.
- Further class/attachment balance from observed outcomes, not raw damage alone.
- Optional local match history or challenge goals, only after core reliability. No account progression or unlock economy exists.
- Additional original cosmetic modules and facial expression presets; keep identical hit volumes and legible team/class markers.
- Expand the procedural ambient music and event sound palette based on listening feedback. Music has an independent working gain control; voice packs remain absent.

## Deliberately deferred

- Extra game modes beyond FFA/TDM.
- Large maps, decorative cities/terrain, complex moving world props or a map editor. Keep the present graybox until a separate map-design pass.
- Matchmaking, accounts, ranked ladders, persistence, moderation tools and commercial backend operations.
- Touch gameplay, downloadable desktop packaging and platform distribution.
- Full rigid-body ragdolls, destructible environments and cinematic animation.

## Maintenance rules

Preserve shared simulation authority; validate all external inputs and saved build data; make temporary effects expire; cap projectiles/fields/particles; never infer real GPU FPS or subjective playtest success from a unit test. Keep current mechanics and remaining work separate in documentation as features change.
