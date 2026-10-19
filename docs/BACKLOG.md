# Prioritized development backlog

The initial brief's complete playable loop is the milestone. Status labels distinguish implemented systems from validation and planned work. See TESTING.md for evidence; passing deterministic logic does not establish subjective game feel.

## P0 — first-build release checks

- **Implemented / automated logic tested:** fixed-step movement, sprint, jump, air control, crouch, wall/box/ramp collision, impulses, hit zones, seven weapons, ammo/reload/switch, five gadgets, three perks, FFA AI, difficulty/personality behavior, navigation, scoring, countdown, respawn, timer/score endings and deterministic replay of inputs.
- **Implemented / browser validation recorded separately:** full menu/setup/loadout/settings/HUD/pause/results flow, pointer lock, WebGL models/effects, input integration, preference persistence and procedural audio activation.
- **Needs human playtesting:** sustained gun feel, sound mix through speakers/headphones, visibility during heavy effects, difficulty curve, arsenal balance, readability at various displays and physical mouse sensitivity.
- **Needs cross-browser testing:** Firefox, Safari, full-screen transitions and device-specific graphics behavior. Chromium integration is the automated baseline.

## P1 — deepen the playable loop

1. Human feedback pass on movement, combat cadence, projectile speed and damage falloff. Tune easy difficulty for new players before making hard more lethal.
2. Elevation-aware AI routes onto the ramp/platform; cover scoring and explicit escape from dangerous fields. Current navigation is conservative and mostly ground-based.
3. Full swept-sphere projectile collision for grazing edges; robust arbitrary map geometry when new maps require it. Current continuous centerline model handles the graybox and tested fast shots.
4. Better physical mouse recoil/ADS tuning, optional recoil patterns, accessibility options for bob and motion, rebindable controls and controller support.
5. Ammo economy/pickups for long survival streaks, optional health pickups, and clearer cause-of-death feedback. Current reserves replenish on respawn; no pickups exist.
6. Deeper bot gadget tactics and perception of shields/springs; improve personality expression without omniscience.
7. Mobile-friendly menus already scale, but **touch gameplay is not implemented**. Treat touch controls as an explicit platform decision.

## P2 — future content with user direction

- Map design session with the user. Keep the current map simple until then; do not build scenery as a substitute for systems.
- Smoke/decoys/sticky tools, additional weapon alternate modes and attachment systems. Five current gadgets are the initial varied selection; examples in the brief are inspiration, not all promised equipment.
- Sliding, more character customization, expanded animation/rigging and audio layers/music.
- Training targets or a sandbox mode, match mutators, assists and combo feedback; preserve the one reliable FFA mode first.

## P3 — larger project milestones

- Online multiplayer: authoritative server, transport, synchronization, prediction/reconciliation, lag compensation, security, lobbies and hosting. **Planned; no networking implemented.**
- Team Deathmatch and other modes with teams, scoring adapters, friendly fire and spawn rules. **Planned.**
- Downloadable desktop package, platform integration and distribution. **Planned.**
- Custom maps/editor, new content packs and progression. **Planned.**

## Intentional exclusions and implementation limits

- No elaborate city, terrain, texture library or decorative world assets.
- No external services, paid assets, account systems or backend.
- Controlled arcade movement/impulses, not general rigid-body physics or ragdolls.
- Projectile radius uses forward clearance around centerline sweeps; contact is approximate at grazing angles.
- Boundary collision continues above the visible wall to retain launched characters.
- No fabricated benchmark or claim of human playtesting; automation results and remaining checks are explicit.
