# Unfug runtime interfaces

Browser ES modules, with Three.js confined to rendering. The same DOM-free simulation runs locally and on the Node room server. Simulation uses fixed 1/60-second steps, plain vectors, feet positions and +Y up. Forward is `{x:-sin(yaw)*cos(pitch),y:sin(pitch),z:-cos(yaw)*cos(pitch)}`.

## Data and builds

`catalog.js` exports `WEAPONS`, `GADGETS`, `PERKS`, `PRESETS`, `DEFAULT_LOADOUT`. `customization.js` exports `GAME_TITLE`, `CLASSES`, `IMPULSE_CORES`, `COSMETICS`, `WEAPON_MODS`, `WEAPON_FINISHES`, `TUNING_BUDGET`, `normalizeLoadout`, `normalizeCosmetics`, `tuningCost`, `resolveWeapon`, and `movementModifiers`.

A normalized build contains:

```js
{
  primary, secondary, tactical, lethal, perk, classId, impulseCore,
  mods: {
    primary: { barrel, magazine, handling },
    secondary: { barrel, magazine, handling }
  },
  finishes: { primary, secondary },
  cosmetics: { bodyColor, accentColor, hat, face, back, pattern }
}
```

Primary/secondary must differ. Modifier defaults are `standard`; each gun has an independent five-point budget. `normalizeLoadout(input)` validates and returns a fresh legal build. `resolveWeapon(baseWeapon,equipment,slot)` returns effective stats without changing the catalog; slot is `primary` or `secondary`. Cosmetic and finish IDs never change simulation stats. Catalog entries use `{id,name,description,color,...}`; cosmetic categories and tuning slots contain maps indexed by ID. Class abilities have `{name,description,cooldown}`.

## Game and actors

`new Game({seed,loadout})`; `start(config,loadout)`, `step(dt,input=null)`, `setPaused(bool)`, `applyInput(actor,input)`, `createActor(index,isPlayer,equipment)`, `respawn(actor)`, `end(reason)`.

Match configuration: `{mode:'ffa'|'tdm',botCount:0..12,difficulty:'easy'|'normal'|'hard'|'veteran',duration:30..900,scoreLimit:1..100,playerTeam:'a'|'b',name,botClasses}`. UI offers a smaller convenient set of duration/score options. Selected bot classes cycle in order; team bot pairs mirror class choices. Match state is `menu`, `countdown`, `playing`, or `ended`, with countdown/remaining/duration, team scores `{a,b}`, `winnerTeam` (null for draws), `winnerId`, and `endReason`.

`game.actors`, `player`, `map`, `time`, `events`, `paused`, `combat`, `ai`, and `humanInputs` are shared state. `humanInputs` is a Map from actor ID to bounded input. `step` uses its explicit input for `game.player`, otherwise the Map, and applies Map inputs to other human actors. AI skips `isHuman`/`isPlayer`; `isPlayer` identifies the locally controlled actor in the browser and the current host in server simulation. IDs must never be compared to the literal string `player` outside initialization.

Actors have id/name/isHuman/isPlayer/team, equipment/classId/cosmetics/color/personality; pos/prevPos/vel/yaw/pitch/radius/height; health/maxHealth/alive/grounded; kills/deaths/assists/damageDealt/shotsFired/streak/bestStreak; respawnAt/invulnerableUntil; activeSlot/inventory/gadgetReady/abilityReady/impulseCharge; ai/intent/aiming; damage bookkeeping; bracedUntil/slowedUntil/hasteUntil and slide state. All classes/cosmetics retain 100 health and the same collision dimensions. Timed state uses simulation seconds.

`areEnemies(a,b)` is the common team predicate. `damage(target,amount,{attackerId,weaponId,headshot,impulse})` validates living/protected/team state, applies brace, records recent assists and scores. `addImpulse(actor,vector,attackerId)` applies class/perk/brace resistance, bounds velocity, and grants capped charge for hostile forces. Self and allied forces do not grant that charge. Movement charges from measured displacement with a per-tick cap. Respawn clears temporary state and refills equipment.

World queries: `getActor(id)`, `eye(actor)`, `groundHeight(x,z)`, `worldRaycast(origin,dir,range)`, `raycast(origin,dir,range,ignoreId)`, `canSee(a,b)`. Ray results are nearest `{point,normal,distance,actor,headshot,obstacle}` or null. The map supplies size, axis-aligned obstacles, slopes and spawn positions; keep physics/navigation/render geometry aligned.

## Inputs and combat

Input: `{moveX,moveZ,yaw,pitch,sprint,crouch,jump,fire,alt,reload,switchSlot,tactical,lethal,ability,impulse}`. Movement is local right/forward; Game converts it into world-space actor intent. Jump/reload/switch/gadget/ability/Impulse are edges consumed once. Mouse fire/aim and movement are held. Sprint+crouch begins a guarded slide if moving fast enough; jump cancels it.

`Combat(game)` exposes `equip(actor)`, `getWeapon(actor)`, `getWeaponState(actor)`, `switchWeapon(actor,slot)`, `reload(actor)`, `fire(actor,dir,alt)`, `useGadget(actor,slot,dir)`, `useAbility(actor,dir)`, `useImpulse(actor,dir)`, `update(dt)`. Inventory is weapon-ID keyed (unique guns avoid conflicting slot states). Effective tuning is used for magazine/reserve/reload/cadence/range/projectile speed/handling.

Projectile records have id/ownerId/ownerTeam/weaponId/kind/pos/vel/color/radius, damage/impulse parameters, expiry/travel/collision state. Fields have id/ownerId/ownerTeam/kind/pos/radius/color/created/expires plus mechanics-specific state. Collections are bounded to 128 projectiles/64 fields globally and 16/8 per owner. Fields include spring/shield/vortex/trap/booster/repulsor/heal/supply/dampen. Area effects use world occlusion and team predicates. Projectile reflection preserves ownership. Collision is a continuous centerline query with forward-radius clearance, not a full swept sphere.

`game.emit(event)` timestamps bounded event records. Consumers handle shot/impact/explosion/gadget/ability/impulse/reload/switch/damage/eliminate/assist/spawn/jump/land/slide/matchStart/go/matchEnd. Actor-linked events include actorId; shot events include weaponId/origin/point/color/pellet, ability events classId, Impulse events core/direction/radius. Renderer/audio/UI tolerate unknown events.

## AI and rendering

`AI(game).update(dt)` produces intentions and uses the same combat methods as humans. `AI_DIFFICULTIES` exposes actual tier values; no tier alters health/damage. Target perception and memory remain separate from true live coordinates. Shared work caps rotate service order; `frameStats` and cumulative `stats` expose diagnostics. `NavigationGrid(map,{traverseRamps:true})` supports the arena ramp/platform, collision clearance, path budgets and reachable roam points; the default conservative mode remains available.

`Renderer(canvas,game,settings)` exposes resize/applySettings/render/handleEvents/dispose, plus `renderer` and `camera` for diagnostics. `render(dt,alpha)` interpolates actor transforms. Dynamic geometry/material ownership must be disposed when replacing a preview, while shared primitive assets stay cached. `game.menuLoadout` supplies the current menu preview. Player/class/weapon signatures trigger model rebuilds only on meaningful changes. Effects are bounded/reused; settings control shadows, resolution, effects density and motion. Ally markers are depth-tested. Chest badges use ▲A and ◆B; an overhead diamond marks an ally.

## UI, audio and lifecycle

`UI(root,callbacks)` exposes settings/loadout/matchConfig/savedLoadouts, showMenu/showPause/hidePause/showResults/update/handleEvents/showScoreboard/notify/startGame. Online adds showLobby/beginNetworkMatch/setNetworkStatus, `lobbyState`, and `isNetworked`. Callbacks: onStart(config,loadout), onPause/onResume/onMenu/onRestart, onSettings(settings), onFullscreen, onPreviewLoadout(loadout), onNetwork(options), onNetworkStart, onNetworkLeave. See `src/ui/README.md` for details.

Preferences use `unfug:preferences:v2` with migration from `chaos-fps:preferences:v1`. Validate all stored data; storage failure is nonfatal. A preview may swap weapon slots in a clone while editing the secondary; saved equipment remains unchanged. Settings cover sensitivity/invertY/FOV, master/SFX/music gains, quality/renderScale/shadows/effects, crosshair/shake/reducedMotion. Key bindings are fixed.

Main owns mouse capture, event draining, local stepping and online snapshot presentation. Direct button gestures request pointer lock and audio. Lost focus pauses local matches; online menus send neutral input while the server continues. Never step local Game/Combat in an online match. `GameAudio` uses original Web Audio synthesis with separate SFX/music gain stages and a voice cap.

## Multiplayer

`NetworkClient({onState,onLobby,onError,onClose})` exposes `connect({url,action,code,name,config,loadout})`, `startMatch()`, `sendInput(input)`, `disconnect()`, connected/playerId/lobby. Creation/join resolves with a lobby response. Failures stay visible; intentional cancellation is distinct from established connection loss. Input edges survive transport throttling.

`makeSnapshot(game,{tick,playerId,events})` and `applySnapshot(game,snapshot,localPlayerId)` live in `src/net/snapshot.js`. Server adds a room session ID. Snapshots contain serializable actors/projectiles/fields/match/time/events, recipient player ID and sequence. Hydration maps the recipient to game.player, retains previous positions for interpolation, and rejects duplicate/older snapshots. No separate client damage rules exist.

`createGameServer({port,host,autoTick,maxRooms})` returns server handles, rooms, tick and async close. Rooms simulate 60 Hz and send 15 Hz snapshots, with up to eight humans/twelve bots. Default capacity is eight rooms/128 connections; unjoined connections expire after 30 seconds. Host transfer, ended-room joins, rematches, stale-input neutralization, name/loadout/input/payload/rate validation and empty-room cleanup are implemented. See server/validation.js for limits.

GitHub Pages hosts the static bot-capable browser build. Real remote rooms require an independently hosted persistent WSS server. Prediction, reconciliation, hit rewind, accounts and reconnect recovery remain planned. A local successful test is not evidence of a deployed public multiplayer endpoint.

## Builds and tests

Use npm test, npm run build, npm run test:browser and npm run test:network:browser. Browser suites build dist and must run sequentially. `npm run build:standalone` produces dist/unfug.html after a normal build. Serve that file over HTTP for managed-browser validation. Debug APIs are available only with `?debug` at `window.__UNFUG__` (legacy alias `__CHAOS__`); they are test fixtures, not trusted server authority. See TESTING.md for executed checks and limits.
