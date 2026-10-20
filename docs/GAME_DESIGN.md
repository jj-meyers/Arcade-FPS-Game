# Unfug — game design and implementation

## Identity

Unfug is a toy-box arena shooter where moving and manipulating momentum creates opportunities. The cast are expressive modular bean contraptions, not military soldiers. The existing fast shooter remains recognizable; this update adds connected systems rather than a new engine or large map.

Five pillars guide future changes:

1. **Movement creates choices.** Sprinting, sliding, launch tools and the Impulse meter should create routes and timing decisions.
2. **Readable mischief.** A surprising interaction still needs an identifiable source, visible effect and counterplay.
3. **Builds have costs.** Weapons, classes and attachments trade advantages for weaknesses; cosmetics never buy combat strength.
4. **The same rules for everyone.** Bots and network humans use shared movement, weapon and damage code. Difficulty changes decisions and imperfect aim, not health or damage.
5. **Reliable rounds first.** FFA and TDM, offline bots, clear results and fast rematches take priority over extra modes or decorative world content.

Reference games informed qualities such as readable silhouettes, class counterplay and unconventional weapons. The models, sounds, names and implemented equipment here are original procedural work. No recognizable characters or assets were imported from those games.

## Round structure

Lobby → choose a preset or saved build → tune equipment and appearance → configure FFA/TDM or join a room → countdown → combat/respawn → results → rematch or lobby.

Local setup supports zero to twelve bots, four difficulty tiers, class composition, player name, team, duration and score limit. Zero bots permits practice. TDM prevents friendly damage and friendly offensive impulses. Team eliminations determine the win; a tied timer produces a draw. FFA scores individual eliminations. Assists require at least 20 damage within the last six seconds and do not add another team point. Suicide adds a death without a kill.

Actors have 100 health. Respawn takes 2.8 seconds, restores equipment and gives 1.3 seconds of protection that ends when attacking. Spawn scoring favors distance from enemies, usable cover and, in TDM, a mild home-side preference. It does not treat nearby teammates as threats. Individual rankings prioritize kills, fewer deaths, assists, then name. Match results include a winning team for TDM.

A local pause freezes simulation clocks. Opening an online menu releases the local mouse while the authoritative match continues for everyone.

## Signature system: Impulse

The universal meter starts at 35 and caps at 100. Real horizontal movement charges 1.5 per unit, capped at 10 per second; pauses, standing still and teleports do not farm it. Receiving a hostile impulse, including a nondamaging pulse or field, can grant eight charge at most once per second. Spend a full meter with X to emit a short cone pulse:

| Core | Role | Counterplay |
| --- | --- | --- |
| Repel | Separate enemies or redirect approaching projectiles | Cover, range, resistance, approach from outside the cone |
| Lift | Set up an airborne follow-up or interrupt a close rush | Resistance and repositioning; pulse deals no damage |
| Pull | Bring a rival into short range or bend a shot's trajectory | Keep distance, break sight, use a movement ability |

The pulse reaches eight units, requires line of sight and does no direct damage. It does not affect teammates. Projectile velocity changes are bounded, and ownership does not change: a reflected projectile keeps its original kill attribution. A repeat guard prevents duplicate pulses. The three cores cost the same.

Impulse connects the movement loop to combat without forcing every player into an unusual weapon. Launch a rival with Updraft, follow up with a precision shot, reposition with a slide and spend a pulse to control the landing. Pulling a shot is risky because its damage ownership stays with its original shooter. Shields, resistance perks and geometry are useful counters.

## Classes and builds

Classes share health and collision dimensions. They define a movement tradeoff and one active ability on F, while allowing any weapon/gadget combination.

| Class | Identity | Ability and cost |
| --- | --- | --- |
| Runner | 10% faster, more vulnerable to impulse | Dash; 8 s cooldown, stopped by collision |
| Bulwark | Slower and resistant to impulse | Brace for 3 s: 35% damage reduction and stronger impulse resistance, with a movement penalty; 15 s cooldown |
| Medic | Neutral movement and team sustain | Temporary healing field; 16 s cooldown |
| Engineer | Slightly slower, faster reload | Finite reserve-ammo resupply field; 17 s cooldown |
| Disruptor | Area denial | Temporary field slows exposed enemies and their projectiles; 16 s cooldown |
| Acrobat | Higher jumps and stronger air control | Upward launch, usable in air; 11 s cooldown |

Support fields help their owner and teammates; in FFA they help only the owner. Timed fields/statuses expire. Existing perks add a second tradeoff: Springs increases speed/jump and incoming knockback; Anchor reduces knockback at movement/reload cost; Quick Hands reduces reload time.

Each build contains two distinct weapons, tactical and lethal gadgets, one perk, class, Impulse core, two gun tuning sets, finishes and appearance. Six presets offer starting points; six browser-local custom saves preserve complete builds. Existing preferences migrate through normalization. Invalid or over-budget values fall back to legal selections.

Each gun has its own five-point tuning budget:

- Barrel options affect accuracy, range, cadence, damage or impulse.
- Magazine options exchange capacity, reserve ammo and reload time.
- Handling options exchange movement, accuracy and cadence.

Modifiers apply to actual simulation values, not just displayed stats. Over-budget configurations drop choices in a deterministic order. Classes and perks stack with these modifiers, so extreme combinations need ongoing balance review. Tuning does not replace the different weapon mechanics.

## Arsenal

Exact values and authoritative descriptions live in `src/data/catalog.js`.

| Weapon | Main mechanic | Weakness |
| --- | --- | --- |
| Fizz | Fast hitscan soda spray | Spread and range falloff |
| Doorbell | Nine pellets; recoil pushes the user | Short effective range, small magazine |
| Bankshot | Three ricochets, 22% damage increase per bounce | Travel time and geometry |
| Confetti | Bouncing lobbed explosive | Slow follow-up, self-splash risk |
| Last Straw | Precise high-damage shot and headshots | Small magazine, slow cadence |
| Updraft | Projectile lifts targets | Low damage; needs a follow-up |
| Yoink | Pull; RMB+fire reverses into push | Short range |
| Burst Stapler | Three timed hitscan rounds | Must track across the burst |
| Spool | Sustained fire spins up cadence and spread | Slow start, declining precision |
| Tack | Projectile applies a short slow | Low damage, travel time |
| Return Disc | Can hit once going out and once returning | Requires positioning on both legs |
| Arc | Conducts to two nearby visible enemies | Short range; cover/shields interrupt chains |

Ammo, reserves, reloads, switching and cadence remain shared mechanics. Headshots use a separate geometric head volume. Shooting an empty weapon attempts a reload; switching cancels an unfinished reload. Model recoil is visual except Doorbell's explicit physical recoil. ADS changes FOV and applicable accuracy.

## Gadgets and interactions

| Gadget | Role | Limits |
| --- | --- | --- |
| Spring Pad | Launch and route changes | Per-actor retrigger delay; teammates only in TDM, shared in FFA |
| Bubble | Block enemy shots and blasts; allies can shoot out | 160 health, seven seconds |
| Vortex | Pull exposed enemies and hostile projectiles | Cover and duration bound the effect |
| Rush Pad | Owner/allied speed field | Short lingering buff after leaving |
| Repulsor | Push enemies and deflect their projectiles | Local radius, line of sight and finite duration |
| Cherry Bomb | Bouncing timed explosive | Fuse, self-damage and cooldown |
| Whoopee Trap | Proximity damage and launch | Arms after 0.8 s; allies do not trigger it |
| Cherry Trio | Splits into three small delayed explosives | Limited children, modest individual radius |

Projectile and field collections have hard limits. Area interactions use world occlusion. Boosts/slows are timed; repeated refresh does not create permanent status. Full general-purpose rigid-body interactions, movable props and arbitrary effect stacking are outside this version.

## Movement, bots and presentation

Simulation advances at 60 Hz. Acceleration, normalized diagonal input, grounded/air steering, sprint, crouch, jump, slopes, cover sliding and bounded impulses are shared by all actors. Sprint then press crouch with enough momentum to slide; holding crouch cannot repeatedly retrigger it. Jump cancels a slide. Substeps prevent fast movement crossing thin walls. Projectiles use swept centerline/radius-clearance collision, not general swept convex geometry.

Bots perceive through range/facing/line-of-sight checks, wait before firing and remember only last-seen positions briefly. Hearing gives a noisy damage cue. Four difficulties change reaction, aim error, movement/tactics and equipment use. They retain the same health and weapon damage. Classes/loadouts/personality influence choices. Bots can fight other bots and coexist with humans; human actors are excluded from AI control. Navigation now supports ramp-to-platform routes with surface-height-aware traversal and physical drop recovery from isolated rooftops. More complex multi-level geometry still needs further navigation work.

Characters are modular procedural models with class silhouettes and selectable colors/accessories/patterns. Team identification uses shape/text cues in addition to color. All cosmetics retain the same hit volumes. Weapon finishes and tuning alter presentation. Procedural motion covers running, air movement, recoil, reload, hits and elimination; it is not a skeletal cinematic animation system or ragdoll simulation.

The HUD exposes health, ammo, gadgets, ability readiness, Impulse charge/core, team score, kills and match time. Settings change sensitivity, inverted vertical aim, FOV, audio/music gains, graphics preset, render scale, shadows, effects quality, crosshair, shake and reduced motion. Preferences and builds use versioned local storage. Accessibility remains partial: controls are fixed and touch/controller support is absent.

Sound is synthesized through Web Audio. Shots, impacts, abilities, Impulse, movement and match events have generated cues, with a procedural ambient musical layer and an independent music-volume setting. No voice acting or downloaded sound library is included.

## Multiplayer foundation

The Node WebSocket server imports the same `Game` simulation. Rooms use anonymous six-character codes, support eight humans plus twelve bots and have one host who starts/rematches. Join is allowed in lobby/results. Host departure transfers ownership; an empty room is removed. Server simulation is 60 Hz, snapshots 15 Hz. Clients send input, not trusted positions or damage.

The transport validates names, loadouts and inputs, caps payloads/rates and allows at most eight rooms and 128 connections and neutralizes stale inputs. Snapshots contain actors, projectiles, fields, events, match state and recipient-specific player identity. The browser interpolates authoritative updates. No local movement prediction, rewind/lag compensation, reconnect recovery, accounts, matchmaking or persistent progression are implemented. This is playable small-room groundwork, not a hardened competitive backend.

The static bot game runs on GitHub Pages. Real remote rooms require a separately hosted persistent server behind TLS/WebSocket upgrades. A public compatible server is not part of the static deployment.

## Architecture, scope and validation

Data defines loadouts; normalization is shared by UI/server/simulation. `Game` owns match and actor state, `Combat` owns equipment effects, AI emits intentions, physics applies movement, and renderer/UI/audio consume state/events. Network snapshots cross this boundary without a separate client damage model. The simple map remains data-driven and intentionally unchanged in scope.

Executed checks are recorded in `TESTING.md`. Balance, perceived responsiveness, sound mix, readability on real GPUs and WAN latency still require human/device testing. `BACKLOG.md` distinguishes implemented work, partial systems and next priorities. Do not add new modes or an elaborate map before testing this expanded combat loop with people.
