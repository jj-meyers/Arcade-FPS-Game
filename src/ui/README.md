# UI integration

`UI.js` exports the named and default `UI` class. Import `style.css` once from the application entry point. Mount with `new UI(root, callbacks)` above the game canvas.

Callbacks are `onStart(config, loadout)`, `onPause()`, `onResume()`, `onMenu()`, `onSettings(settings)`, `onFullscreen()`, and `onRestart()`. Starting and resuming call the relevant callback synchronously inside the button click, preserving browser user activation for pointer lock and audio. Game pause state, pointer lock, audio, and rendering remain the application entry point's responsibility; the UI does not advance simulation.

Public presentation methods are `showMenu()`, `showPause()`, `hidePause()`, `showResults(game)`, `showScoreboard(show, game)`, `update(game, dt)`, `handleEvents(events, game)`, `notify(message)`, `startGame()`, and `dispose()`. `isOverlayOpen` reports menu, pause, or results visibility. `settings`, `loadout`, and `matchConfig` hold the user's current preferences.

Preferences use `chaos-fps:preferences:v1` in local storage. Every value is validated against the catalogs or supported numeric limits; corrupt JSON, invalid IDs, incorrect gadget slots, and inaccessible storage fall back safely. Settings changes call `onSettings` immediately. Loadout changes during pause apply on the next match. Scoreboards defer to `game.rankings()` to preserve the match's tie-breaking rules.

Menus use local CSS, original inline weapon art, and inline SVG symbols. They require no downloaded fonts or image assets. Native buttons, labels, inputs, focus indicators, and semantic score tables support keyboard navigation. Gameplay still requires a mouse and keyboard; responsive menu layout does not imply touch gameplay support.

Verified in headless system Chromium with Playwright: menu and settings interactions, equipment selection, preference persistence and corrupt-value recovery, match customization, actual click-triggered pointer lock, pause → settings → resume, 13-player results, restart, and return to lobby. Visual checks covered 1440×900 and 390×844 layouts with no horizontal overflow. Root integration tests cover the simulation and full match behavior separately.
