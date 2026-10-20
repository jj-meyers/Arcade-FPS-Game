# Unfug UI

`UI.js` exports the named and default `UI` class. Import `style.css` once and mount `new UI(root, callbacks)` above the canvas. The UI owns presentation and validated local preferences; the application owns simulation, audio, pointer lock, renderer settings, and networking.

## Application callbacks

- `onStart(config, loadout)`, `onResume()`, `onPause()`, `onMenu()`, `onRestart()`, `onFullscreen()`.
- `onSettings(settings)` applies changes immediately.
- `onPreviewLoadout(loadout)` updates the menu render preview. Editing the secondary weapon sends a cloned display loadout with weapon, modifier, and finish slots swapped; saved equipment is unchanged.
- `onNetwork({action, url, code, name, config, loadout})` connects with action `create` or `join`. An automatic team selection omits `config.playerTeam` so the server assigns a team. Explicit selection supplies `a` or `b`.
- `onNetworkStart()` requests host start/rematch. `onNetworkLeave()` disconnects; `onDisconnect()` is a compatible fallback.

Start/resume callbacks run synchronously inside button handlers to preserve browser user activation for pointer lock. UI code never simulates gameplay or pauses a remote match.

## Public presentation API

`showMenu()`, `showPause()`, `hidePause()`, `showResults(game)`, `showScoreboard(show, game)`, `update(game, dt)`, `handleEvents(events, game)`, `notify(message)`, `startGame()`, and `dispose()` retain the original API.

`beginNetworkMatch()` hides overlays and displays the HUD without starting a local simulation. `showLobby({code, players, isHost, status})` displays the authoritative room roster. `setNetworkStatus(message, isError = false)` presents connection progress/errors. `isNetworked` changes pause wording and available match actions; `lobbyState` supplies host/rematch state.

`settings`, `loadout`, `matchConfig`, and `savedLoadouts` hold current preferences. `isOverlayOpen` reports menu/pause/results visibility. Scoreboards use `game.rankings()`, include assists, and show team shapes as well as colors. Tied team matches display a draw.

## Preferences and customization

Storage key `unfug:preferences:v2` migrates the old `chaos-fps:preferences:v1` record. Every loadout passes through shared `normalizeLoadout`; numeric settings, booleans, catalog IDs, match mode, classes, and up to six saved builds are validated. Corrupt JSON or blocked storage falls back safely. No secret or room code is persisted.

Weapon tuning enforces the shared five-point budget independently per weapon. Character and tuning screens update the actual renderer preview while their controls remain open. Online equipment is chosen when creating/joining a room; changes require leaving and rejoining.

The menus use CSS and original inline SVG art, without external fonts/images. Settings expose actual master/SFX/music volume, inversion, graphics/effects/shadows, reduced motion, shake, render scale, FOV, and crosshair controls. Native labels, focus indicators, buttons, and semantic tables support keyboard navigation. Responsive menus do not imply touch gameplay support.

## Stable browser-test selectors

Existing `data-action`, `data-nav`, `data-slot`, `data-equip`, `data-setting`, and `data-match` selectors remain. New controls use `data-armory-tab`, `data-class`, `data-tuning-gun`, `data-mod-slot` + `data-mod-gun`, `data-finish`, `data-cosmetic`, `data-save-loadout`, `data-load-loadout`, `data-loadout-name`, `data-bot-class`, and `data-network`.
