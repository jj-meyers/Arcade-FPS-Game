# Project request and latest direction

The brief below is retained as the requested scope, not as a claim that every item is implemented. Current behavior and remaining work are documented in [GAME_DESIGN.md](GAME_DESIGN.md), [BACKLOG.md](BACKLOG.md), and [TESTING.md](TESTING.md).

The latest user direction takes precedence over earlier wording:

- Working title: **Unfug**, with the possibility of a later rename.
- Reduce slogans and unnecessary words throughout the interface. Remove copy such as “Big weapons. Small brain energy” and “Zero chill. All skill.” Keep useful explanations.
- Include extensive player and gun customization.
- Give bot behavior, difficulty differences and performance particular attention.
- Continue this existing project; do not modify a separate Nuketown/Black Ops 2 project.

---

# MAJOR GAME DEVELOPMENT UPDATE — EVOLVING MY CHAOTIC ARCADE FPS INTO A UNIQUE MULTIPLAYER GAME

## 1. YOUR MISSION

I want you to significantly expand, redesign, polish, and improve my EXISTING browser-based 3D arcade FPS game.

**IMPORTANT: This is an update to my existing Arcade FPS Game, NOT a new project.**

First, thoroughly inspect the existing repository, understand its current architecture, identify all implemented systems, and evaluate what works well and what needs improvement.

Preserve existing functioning features wherever practical. Refactor or replace weak systems when doing so will meaningfully improve the game, but don't unnecessarily rebuild everything from scratch.

I want this game to evolve into an exceptionally fun, creative, unpredictable, distinctive, mechanically sophisticated, lighthearted, chaotic arcade FPS.

My long-term vision is a multiplayer game that players want to return to because of its interesting mechanics, enjoyable combat, huge variety of possible playstyles, funny interactions, expressive characters, and highly replayable matches.

Think of this as an ambitious indie game project, not an experimental FPS tutorial.

I want you to think like an experienced game designer, gameplay engineer, multiplayer engineer, technical artist, animator, UI/UX designer, and QA tester.

**Your most important responsibility is to make this game substantially MORE FUN, not simply bigger.**

---

# 2. GAME INSPIRATIONS — STUDY THE STRENGTHS OF THESE GAMES

I want the overall experience to draw inspiration from the qualities of the following games:

**Plants vs. Zombies: Garden Warfare 2**

- Extremely colorful, cartoonish presentation.
- Distinctive, expressive characters.
- Entertaining character abilities.
- Different combat styles and unusual projectiles.
- Fun interactions between characters.
- Lighthearted humor.

**Team Fortress 2**

- Strong character identities and silhouettes.
- Excellent class differentiation.
- Weapons with meaningful advantages and disadvantages.
- Teamwork and counterplay.
- Goofy physics and unexpected combat interactions.
- Readable, personality-driven art direction.
- Fast, satisfying combat.

**Overwatch 2**

- Abilities that interact with one another.
- Interesting combat roles.
- Distinct movement and fighting styles.
- Satisfying feedback.
- Strategic combinations of abilities and equipment.
- Visually readable chaotic combat.

**Shotgun Farmers**

- Absurd weapon concepts.
- Playful mechanics.
- Accessible shooting.
- Unusual combat systems.
- Casual multiplayer fun.

**Hypercharge: Unboxed**

- Colorful toy-like presentation.
- Interesting scale and visual personality.
- Creative weapon presentation.
- Lighthearted environments.
- Playful combat.

**Paladins**

- Flexible customization.
- Different ability combinations.
- Playstyle specialization.
- Build experimentation.
- Strategic tradeoffs.

**Splatoon 3**

- Unconventional weapons.
- Expressive visuals.
- Highly recognizable effects.
- Creative movement and combat interactions.
- Satisfying visual feedback.

**Krunker**

- Responsive browser FPS controls.
- Fast gameplay.
- Accessible movement.
- Simple but effective combat fundamentals.
- Quick, replayable matches.

**Shell Shockers**

- Simple and approachable gameplay.
- Ridiculous character concepts.
- Casual browser accessibility.
- Instantly understandable shooting mechanics.
- Fun and unserious presentation.

**Friends vs Friends**

- Creative combat modifiers.
- Unusual weapon combinations.
- Unpredictable interactions.
- Build experimentation.
- Match-to-match variety.

## CRITICAL RULE: ORIGINALITY

These games are references for their design strengths, not blueprints to copy.

I do NOT want this game to feel like a collection of mechanics taken directly from other games.

I want you to understand WHY the mechanics, visuals, dynamics, and interactions in these games are enjoyable, then use that understanding to invent original systems that fit together coherently.

Do not directly recreate copyrighted characters, models, maps, artwork, sounds, or signature abilities.

Invent original names, silhouettes, weapons, gadgets, abilities, visual effects, character designs, and game systems.

Familiar FPS fundamentals like health, reloading, jumping, and aiming are fine. The goal is not to reinvent every universal control, but to create a distinctive overall gameplay identity.

I want this game to be recognizable as its own title.

---

# 3. DEFINE A UNIQUE GAME IDENTITY

Before implementing major new systems, analyze the existing game and determine how to make its core identity more distinctive.

My desired personality is:

- Chaotic.
- Funky.
- Wonky.
- Absurd.
- Colorful.
- Lighthearted.
- Funny.
- Mechanically creative.
- Highly replayable.
- Accessible but surprisingly deep.
- Unpredictable without being frustrating.

I want combat to frequently produce situations that make players laugh, experiment, or discover unexpected strategies.

However, the game must still have reliable controls, understandable mechanics, and enough balance for skillful play.

The best description is:

**Organized chaos with mechanical depth.**

Create approximately 3–5 clear gameplay design pillars that guide future decisions.

Develop a cohesive original theme, terminology, and visual identity around these pillars.

Avoid simply combining disconnected mechanics because they exist in other games.

Everything should feel like it belongs in the same game.

---

# 4. INVENT A SIGNATURE GAMEPLAY SYSTEM

One of my biggest goals is for this game to have something distinctive that sets it apart from typical arena shooters.

I want you to invent at least one original, expandable core mechanic that influences multiple gameplay systems.

It should not be an isolated gimmick.

It should affect how players think about weapons, gadgets, movement, combat, and loadouts.

For example, you could explore a system based on unusual physics properties, interactive combat effects, momentum manipulation, temporary transformations, or combinations between different equipment.

One possible direction is a universal system where weapons, abilities, and gadgets apply different physical or gameplay properties that can interact.

For example, one effect might make an object bouncy, while another creates attraction, propulsion, or some other interaction.

Players could discover unexpected combinations.

This is only an example. You should critically evaluate it and invent something better if possible.

Requirements:

- Easy to understand at a basic level.
- Allows creative strategies.
- Produces entertaining interactions.
- Supports multiple weapons and gadgets.
- Has meaningful counters or tradeoffs.
- Works against bots.
- Can eventually work in multiplayer.
- Has clear visual and audio feedback.
- Is computationally reasonable for a browser game.

Avoid introducing too many interconnected effects at once.

Start with a small, polished set and build a flexible system for expansion.

I want this signature mechanic to be a major contributor to the game's originality and replayability.

---

# 5. COMBAT AND GUNPLAY — MAJOR IMPROVEMENTS

Thoroughly evaluate and improve the existing shooting mechanics.

Combat should feel significantly more responsive, satisfying, dynamic, and polished.

Improve:

- Aiming responsiveness.
- Weapon firing.
- Hit detection.
- Recoil.
- Reloading.
- Weapon switching.
- Weapon handling.
- Projectile behavior.
- Accuracy and spread.
- Damage calculation.
- Damage falloff when appropriate.
- Critical hits or headshots where suitable.
- Audio and visual feedback.
- Hitmarkers.
- Elimination feedback.
- Combat animations.
- Weapon balancing.

Different guns should feel meaningfully different to use.

Don't create weapons that are identical except for their damage values.

Consider characteristics such as:

- Projectile velocity.
- Projectile size.
- Recoil patterns.
- Knockback.
- Range.
- Spread.
- Movement penalties.
- Reload timing.
- Alternate fire modes.
- Charge mechanics.
- Ricochets.
- Explosions.
- Unusual status effects.
- Physics-based interactions.

Some weapons should reward precision, others aggressive movement, creativity, positioning, or smart equipment combinations.

Maintain a balance between conventional, intuitive shooting and completely ridiculous weapons.

The player should be able to enjoy the game using a relatively normal weapon, but also experiment with absurd ones.

---

# 6. EXPAND THE WEAPON ARSENAL

Review all existing weapons before adding new ones.

Fix anything that is incomplete, unbalanced, visually confusing, or not sufficiently different from other weapons.

Then expand the arsenal with a carefully selected variety of original weapons.

Aim for roughly 10–14 genuinely distinct weapons in the developed version, adjusting the count based on the existing content and implementation quality.

Include a mixture of:

- Fast-firing weapons.
- Heavy close-range weapons.
- Precision weapons.
- Sniper-style weapons.
- Explosive or projectile weapons.
- Weird physics-based weapons.
- Unconventional utility weapons.
- Weapons with alternate firing behavior.

I want several weapons that would feel completely at home in a crazy cartoon arcade game.

Invent original ideas.

Examples of creative directions:

- Weapons with unusual projectile trajectories.
- Weapons that affect enemy movement.
- Weapons that manipulate objects.
- Weapons with interesting risk/reward mechanics.
- Weapons that interact with certain gadgets.
- Weapons with unusual secondary firing effects.
- Weapons that reward creative positioning.

Do not copy recognizable signature weapons from my inspiration games.

Every weapon should have:

1. A distinctive visual identity.
2. A unique gameplay role.
3. Clear strengths.
4. Clear weaknesses.
5. Appropriate effects and animations.
6. Meaningful interaction with other game systems.
7. Functional AI support where reasonable.

I want an arsenal that encourages experimentation rather than always choosing the weapon with the highest damage.

---

# 7. EXPAND PLAYER CLASSES AND PLAYSTYLES

I want stronger class diversity and more interesting character builds.

Take inspiration from the role differentiation of TF2, Garden Warfare, Overwatch, and Paladins, but design an original system.

Create or improve several recognizable playstyle archetypes.

Possible combat roles include:

- Fast and mobile skirmishers.
- Durable close-range fighters.
- Precision specialists.
- Gadget-focused tricksters.
- Explosive area-control specialists.
- Support-oriented characters.
- Strange wildcard characters.

These are broad archetypes, not mandatory character templates.

Create original personalities and gameplay identities.

Aim for approximately 5–7 meaningful initial classes or archetypes, depending on what already exists.

Each should have:

- A clear gameplay identity.
- Distinct strengths and weaknesses.
- Appropriate weapon options.
- Interesting abilities or perks.
- A recognizable visual silhouette.
- Distinct movement or combat characteristics where appropriate.
- Interactions with other classes.
- Meaningful counters.

I want players to genuinely feel a difference when changing classes.

Avoid simply creating characters with different health totals and weapon models.

The class system should add variety and strategy without becoming excessively rigid.

---

# 8. LOADOUT CUSTOMIZATION — CREATIVE FREEDOM

One of my biggest priorities is player agency.

I want players to have meaningful freedom in how they approach combat.

Expand the existing loadout system to support creative combinations of:

- Primary weapons.
- Secondary weapons.
- Tactical gadgets.
- Lethal gadgets.
- Class abilities.
- Passive perks.
- Special modifiers or other original equipment categories.

However, use good game-design judgment.

I do not want the game to become overloaded with unnecessary equipment slots or confusing customization menus.

I want customization to be intuitive but mechanically deep.

Explore an original balancing system that encourages tradeoffs between powerful equipment choices.

For example, powerful options might have costs, restrictions, or mutually exclusive selections.

Do not blindly recreate Black Ops 2's Pick 10 system.

Invent a customization structure that makes sense for this game.

Important requirements:

- Several premade loadouts.
- Fully functional custom loadouts.
- Loadout saving.
- Easy equipment swapping.
- Clear weapon statistics.
- Useful ability descriptions.
- Visual previews where practical.
- Appropriate restrictions and balancing.
- Support for different playstyles.

Ensure selections actually affect in-game equipment and behavior.

I want players to enjoy experimenting with builds even outside active matches.

---

# 9. ABILITIES, GADGETS, AND EQUIPMENT

Expand the existing equipment system significantly.

I want gadgets and abilities to be a major source of humor, creativity, tactical decision-making, and mechanical interactions.

Include a combination of recognizable tactical roles and highly unconventional original concepts.

Possible categories:

- Mobility gadgets.
- Defensive equipment.
- Area-control equipment.
- Explosive gadgets.
- Distraction tools.
- Physics manipulation.
- Traps.
- Support tools.
- Temporary buffs.
- Unusual projectile modifiers.

Create interesting interactions between gadgets, weapons, classes, and the game's signature mechanic.

I particularly want players to discover clever combinations.

For example, a defensive ability might become useful offensively when combined with another mechanic.

Or a movement gadget might create an unexpected escape route or unusual attack opportunity.

Prioritize gameplay depth and emergent interactions over a huge number of equipment items.

Every ability should have:

- Clearly defined behavior.
- Appropriate cooldowns or limits.
- Visible effects.
- Understandable feedback.
- Reliable activation.
- Useful strategic applications.
- Counterplay.
- AI compatibility where practical.

Avoid abilities that simply guarantee kills without meaningful skill or decision-making.

---

# 10. MOVEMENT AND PHYSICS — MAKE THEM EXCEPTIONAL

Improve the existing first-person movement system.

Movement should feel amazing even without enemies.

Review and polish:

- Walking.
- Sprinting.
- Jumping.
- Air control.
- Acceleration.
- Deceleration.
- Camera movement.
- Weapon bobbing.
- Landing.
- Collisions.
- Sliding if appropriate.
- Knockback.
- Physics impulses.
- Movement-related abilities.

I want fast, fluid, accessible arcade movement.

It should feel responsive and slightly exaggerated, not realistic or sluggish.

Explore original movement interactions that complement the signature gameplay system.

For example, certain abilities, gadgets, or weapons might temporarily change how players move or interact with surfaces.

However, maintain consistency and player control.

Avoid complicated movement mechanics that feel unreliable or require excessive precision just to move normally.

The game should reward mastery while remaining fun for casual players.

Make sure unusual physics interactions do not cause players to fall through geometry, get permanently stuck, or experience uncontrollable camera movement.

---

# 11. AI BOTS — MAJOR PRIORITY

I want significantly improved AI bot behavior.

Bots are extremely important because they let me enjoy and test the game without needing other players online.

Review the existing AI system and improve its intelligence, reliability, personality, and gameplay diversity.

Bots should:

- Navigate the arena reliably.
- Avoid getting stuck.
- Find and attack enemies.
- Aim and shoot realistically for their difficulty.
- React to incoming attacks.
- Reposition.
- Use cover appropriately.
- Retreat when necessary.
- Pursue targets.
- Switch weapons.
- Use gadgets and abilities.
- Respond to unusual physics interactions.
- Participate in scoring.
- Die and respawn correctly.

I especially want bots to behave differently based on their class, loadout, and personality.

Possible bot personalities:

- Extremely aggressive.
- Cautious.
- Precision-focused.
- Explosive and chaotic.
- Gadget-heavy.
- Mobile and evasive.
- Defensive.
- Opportunistic.

Avoid making bots seem intelligent simply by giving them perfect accuracy or unfair knowledge.

Use reasonable decision-making based on information the bot could actually perceive.

## Bot difficulty

Keep customizable difficulty settings, including:

- Easy.
- Normal.
- Hard.
- Veteran or equivalent.

Difficulty should influence factors such as:

- Reaction time.
- Accuracy.
- Movement decisions.
- Positioning.
- Awareness.
- Equipment usage.
- Tactical decision-making.

Higher difficulty should be genuinely more challenging, not merely an unfair increase in damage or health.

## Bot customization

Allow players to customize:

- Number of bots.
- Difficulty.
- Match duration.
- Score limit.
- Game mode.
- Team composition where relevant.

Bots should be capable of fighting each other without the player being involved.

They should also support mixed human-and-bot matches when multiplayer becomes functional.

---

# 12. MULTIPLAYER — BUILD TOWARD ACTUAL PLAYER MATCHES

The game should ultimately function as a real online multiplayer FPS.

Inspect the existing networking implementation first.

If multiplayer already exists, verify it and improve its reliability.

If it does not exist, establish a realistic, expandable multiplayer foundation and implement playable small-room multiplayer when feasible.

Important features include:

- Multiple human players joining the same match.
- Browser-based access.
- Private rooms or join codes.
- Player names.
- Character synchronization.
- Weapon synchronization.
- Shared damage and health.
- Shared scoring.
- Shared match rules.
- Respawning.
- Team assignments where applicable.
- Bot integration.
- Match results synchronized across players.

Use an appropriate authoritative server approach rather than allowing clients to independently decide important results.

Design for reasonable latency handling, prediction, interpolation, and validation as the multiplayer system develops.

Do not pretend that opening two disconnected browser windows constitutes functional multiplayer.

Test actual communication between separate clients and the match server wherever possible.

Do not sacrifice a working single-player bot mode while adding networking.

If the full multiplayer implementation cannot be completed in this development session, preserve a working bot experience and clearly document which multiplayer features are functional versus planned.

---

# 13. GAME MODES — DO NOT ADD LOTS OF NEW MODES

I specifically do NOT want you to spend time creating many new game modes.

Keep the existing modes and focus on making them much better.

The intended scope is:

**Free-for-All**

- Players and bots compete individually.
- Customizable score limits.
- Customizable match duration.
- Proper elimination scoring.
- Leaderboards and match results.

**Team Deathmatch**

- Players and bots compete in teams.
- Team-based scoring.
- Appropriate team assignments.
- Team-colored identification.
- Team win conditions.
- Customizable match settings.

If Team Deathmatch has not yet been implemented, build it after ensuring that Free-for-All works well.

Do not add capture-the-flag, battle royale, payload, domination, or other major modes at this stage.

Instead, improve the existing game modes with better mechanics, better bot behavior, scoring, balancing, match pacing, and presentation.

## Match systems

Improve:

- Match setup.
- Team assignments.
- Match countdown.
- Scoreboard.
- Kill feed.
- Kill tracking.
- Death tracking.
- Assists where appropriate.
- Match timer.
- Respawning.
- Score limits.
- Match-ending rules.
- Victory and defeat screens.
- Final statistics.
- Rematch options.
- Return-to-menu behavior.

Make the complete match experience feel polished.

---

# 14. REPLAYABILITY AND EMERGENT GAMEPLAY

I want players to have reasons to return to the game beyond simply wanting to shoot enemies.

Replayability should come primarily from mechanical depth, creative choices, dynamic interactions, and different playstyles.

Explore ways to support:

- Different viable loadouts.
- Interesting class matchups.
- Meaningful equipment combinations.
- Creative weapon strategies.
- Varied bot personalities.
- Unusual physics interactions.
- Different team compositions.
- Distinct playstyles.
- Skill expression.
- Unexpected combat outcomes.
- A broad range of viable tactics.

Consider optional lightweight progression or cosmetic unlocks only if they support replayability without distracting from core combat.

Avoid grinding systems or artificial engagement mechanics.

I want players to replay because matches are fun and unpredictable, not because they are forced to unlock basic content.

Think carefully about actual gameplay dynamics that emerge when systems interact.

For example, a weapon might be especially effective against one playstyle but vulnerable to another.

A gadget might become much more interesting when paired with an unconventional movement ability.

A defensive character might create opportunities for a highly mobile teammate.

Design for interesting player decisions, not just a massive quantity of content.

---

# 15. ART DIRECTION — FUNKY, CARTOONISH, AND DISTINCTIVE

I want a major improvement to the game's visual identity.

However, I do not want photorealistic graphics.

Aim for a polished, stylized, modern cartoon aesthetic that fits the game's ridiculous personality.

Think:

- Strong character silhouettes.
- Vibrant colors.
- Interesting shapes.
- Exaggerated proportions.
- Expressive animations.
- Unusual weapon designs.
- Funny visual effects.
- Appealing materials.
- Cohesive lighting.
- Playful visual details.
- Clean environmental readability.

The game should look intentionally designed rather than randomly assembled from geometric primitives.

Take inspiration from the visual readability of TF2, the colorful personality of Garden Warfare, and the expressive energy of other stylized arcade shooters.

But create a unique aesthetic.

I want the art direction to reinforce the gameplay rather than compete with it.

## Character visuals

Improve existing character models.

Explore:

- Distinctive silhouettes.
- Interesting body shapes.
- Goofy proportions.
- Recognizable class identities.
- Expressive faces or accessories.
- Cartoonish reactions.
- Better materials.
- Better movement presentation.

Avoid generic military soldiers.

The characters should feel like they belong in a weird, playful universe.

## Weapon visuals

Improve weapon models and presentation.

Weapons should have:

- Distinct silhouettes.
- Interesting materials.
- Recognizable shapes.
- Appropriate animations.
- Visible functional components.
- Better effects.
- Consistent visual design.

Make weapons look like they belong to their gameplay mechanics.

For example, a weapon that manipulates bouncing projectiles might visually communicate that behavior.

Use original or properly licensed assets. Procedural modeling is acceptable where practical.

Prioritize effective visual design over unnecessarily high polygon counts.

---

# 16. CHARACTER CUSTOMIZATION

Expand the existing character customization system.

I want players to be able to create funny, strange, expressive characters.

Possible customization categories:

- Hats.
- Helmets.
- Glasses.
- Sunglasses.
- Masks.
- Face accessories.
- Back accessories.
- Outfit colors.
- Patterns.
- Body colors.
- Other cosmetic details.

Focus on variety and fun combinations.

Cosmetics should:

- Attach correctly to characters.
- Remain positioned during animations.
- Be visible to other players and bots where applicable.
- Not interfere with gameplay readability.
- Not create unfair advantages.
- Save correctly when selected.

Create a modular system for future cosmetics rather than hardcoding each accessory separately.

Visual character customization should feel fun to use, even if the current models remain relatively simple.

---

# 17. ANIMATIONS AND CHARACTER BEHAVIOR

Significantly improve animation quality.

I do not expect cinematic realism, but I want movement and combat to look expressive and intentional.

Improve animations for:

- Walking.
- Running.
- Sprinting.
- Jumping.
- Landing.
- Shooting.
- Reloading.
- Weapon switching.
- Taking damage.
- Using gadgets.
- Activating abilities.
- Knockback.
- Eliminations.
- Respawning.

Explore procedural animation techniques where appropriate.

I especially want funny character reactions and exaggerated physics-based animations.

For example, powerful explosions might trigger comic reactions or exaggerated body motion.

However, prioritize visual clarity and reliable gameplay.

Avoid animations that obstruct aiming, significantly delay inputs, or make hit detection unreliable.

---

# 18. UI AND UX — COMPLETE VISUAL OVERHAUL

I want the game interface to feel substantially more polished, playful, and cohesive.

Review and improve every existing menu and interface.

This includes:

- Main menu.
- Play menu.
- Match setup.
- Bot settings.
- Multiplayer lobby where available.
- Class selection.
- Loadout customization.
- Character customization.
- Weapon previews.
- Settings.
- Pause menu.
- Scoreboard.
- Gameplay HUD.
- Kill feed.
- End-of-match screen.

I want the UI to have personality.

Use playful shapes, clean typography, appealing transitions, subtle animations, and consistent styling.

However, do not sacrifice usability for visual complexity.

## Gameplay HUD

Improve presentation of:

- Health.
- Armor or shields if applicable.
- Ammunition.
- Current weapon.
- Gadgets.
- Ability cooldowns.
- Crosshair.
- Hitmarkers.
- Match timer.
- Score.
- Kill feed.
- Team information.

Create subtle but satisfying feedback when the player damages or eliminates an enemy.

Keep hitmarkers small and unobtrusive.

Make important information easy to understand even during extremely chaotic fights.

Do not clutter the screen with excessive UI.

---

# 19. SETTINGS AND ACCESSIBILITY

Review and improve the existing player settings.

Include functional options such as:

- Mouse sensitivity.
- Field of view.
- Graphics presets.
- Rendering resolution or scale.
- Shadow quality.
- Effects quality.
- Master volume.
- Music volume.
- Sound effects volume.
- Crosshair customization.
- Camera shake.
- Motion effects.
- Fullscreen.
- Control bindings where feasible.

Settings should actually affect the game.

Save preferences locally when practical.

Also include useful accessibility considerations:

- Colorblind-friendly indicators.
- Distinguishable team markings beyond color alone.
- Clear audio cues.
- Adjustable visual intensity.
- Reduced camera shake.
- Readable UI text.
- Clear ability indicators.

Because the game can become extremely chaotic, visual readability is particularly important.

---

# 20. VISUAL EFFECTS AND GAME FEEL

I want dramatic improvements to combat presentation.

Add or enhance:

- Muzzle flashes.
- Projectile trails.
- Impact particles.
- Explosion effects.
- Smoke.
- Weapon-specific effects.
- Damage indicators.
- Hitmarkers.
- Elimination effects.
- Ability activation feedback.
- Character reactions.
- Physics impact feedback.
- Movement-related effects.
- Appropriate camera feedback.

Make each effect visually distinctive and appropriate to its source.

For example, a strange physics weapon should not have exactly the same effects as a conventional rifle.

Explore stylized visual techniques rather than expensive realistic rendering.

Effects should be satisfying but not overwhelming.

Ensure players can still clearly see enemies, projectiles, and important game information.

Optimize effects for browser performance.

---

# 21. AUDIO AND SOUND DESIGN

Improve sound feedback throughout the game.

Each weapon should have appropriate firing and reload sounds.

Abilities and gadgets should have distinctive audio cues.

Include appropriate sounds for:

- Movement.
- Jumping.
- Landing.
- Shooting.
- Reloading.
- Hits.
- Eliminations.
- Explosions.
- Ability activations.
- Match countdowns.
- Victory and defeat.
- UI interactions.

Where possible, use original procedural audio or appropriately licensed assets.

Avoid introducing unnecessary large audio dependencies.

The sound design should reinforce the game's goofy personality while giving players useful combat information.

---

# 22. MAP DEVELOPMENT — KEEP IT LIMITED FOR NOW

This is an important constraint.

I previously requested that we save significant map creation for future development sessions.

**Continue following that direction.**

Do not spend a large portion of this development session designing a detailed environment.

Keep the current testing arena relatively simple.

You may improve:

- Combat flow.
- Cover placement.
- Spawn locations.
- Navigation.
- Lighting.
- Basic materials.
- Arena readability.
- Simple obstacles needed for gameplay.
- Performance.
- Collision reliability.

However, do not build an enormous detailed city, neighborhood, or elaborate environment.

I want to personally guide larger map design decisions later.

For now, the arena should mainly function as a reliable testing ground for all the increasingly sophisticated gameplay systems.

Use clean, attractive styling where useful, but prioritize the characters, weapons, mechanics, bots, and overall feel.

---

# 23. BALANCING AND FAIRNESS

Review the game's balance across all major systems.

I want chaotic interactions, but not a game dominated by obviously overpowered equipment.

Evaluate:

- Weapon damage.
- Time to kill.
- Fire rates.
- Accuracy.
- Range.
- Reloading.
- Movement speeds.
- Player health.
- Class health differences.
- Ability strength.
- Cooldowns.
- Gadget availability.
- Respawn timing.
- Bot difficulty.
- Knockback.
- Explosive damage.
- Area-control effects.

Avoid balancing everything so aggressively that all weapons feel identical.

Different choices should have strong identities.

However, there should be meaningful counterplay.

Create basic balancing documentation where useful.

I want the player to feel that creative decision-making and mechanical skill matter.

---

# 24. TECHNICAL ARCHITECTURE AND CODE QUALITY

Before major implementation, analyze the current technical architecture.

Identify:

- Fragile systems.
- Repeated code.
- Unnecessary complexity.
- Performance bottlenecks.
- Broken dependencies.
- Poor state management.
- Inconsistent interfaces.
- Systems that will complicate multiplayer.

Refactor where appropriate.

Keep important systems modular and expandable.

Pay particular attention to:

- Movement.
- Damage handling.
- Weapons.
- Projectiles.
- Abilities.
- Gadgets.
- Physics interactions.
- Classes.
- Loadouts.
- AI behavior.
- Match rules.
- Player state.
- Multiplayer synchronization.
- UI state.
- Saved preferences.

Use data-driven configurations wherever practical.

Avoid building huge monolithic files with every game mechanic mixed together.

Ensure new gameplay features integrate cleanly with existing systems.

Use the actual project's chosen development stack unless there is a compelling technical reason to change it.

Do not migrate the entire project to another engine unnecessarily.

---

# 25. PERFORMANCE AND BROWSER COMPATIBILITY

The game must remain playable in a modern desktop browser.

Prioritize smooth, consistent frame rates.

Optimize:

- Rendering.
- Projectile simulation.
- Collision detection.
- Particle effects.
- Character models.
- AI updates.
- Physics.
- Animation.
- Networking.
- Asset loading.

Offer adjustable graphical settings.

Avoid expensive effects that provide minimal visible improvement.

Measure performance where possible rather than assuming the game is optimized.

Pay special attention to performance when multiple bots are active simultaneously and many projectiles or gadgets are being used.

Gracefully limit expensive simulations when necessary.

A polished, responsive arcade game is more valuable than technically impressive graphics that make gameplay sluggish.

---

# 26. TESTING AND BUG FIXING — EXTREMELY IMPORTANT

Thoroughly test the existing systems and all major new features.

Do not simply implement features and assume they function.

Run the game whenever the environment permits.

Use automated tests for deterministic systems and actual gameplay testing for interactive behavior.

Test:

**Movement**

- WASD controls.
- Sprinting.
- Jumping.
- Collisions.
- Air movement.
- Knockback.
- Camera behavior.

**Combat**

- Shooting.
- Reloading.
- Weapon switching.
- Damage.
- Hit detection.
- Critical hits.
- Projectile behavior.
- Elimination effects.

**Gadgets and abilities**

- Activation.
- Cooldowns.
- Effects.
- Interaction with weapons.
- Interaction with physics.
- Interaction with bots.

**Bots**

- Navigation.
- Enemy detection.
- Aiming.
- Shooting.
- Ability usage.
- Death and respawning.
- Difficulty differences.
- Multiple-bot performance.

**Match systems**

- Free-for-All.
- Team Deathmatch when implemented.
- Scoring.
- Timer.
- Win conditions.
- Match ending.
- Scoreboard.
- Restarting.

**Multiplayer**

- Joining sessions.
- Multiple-player synchronization.
- Shared combat events.
- Damage validation.
- Respawning.
- Disconnect handling.
- Shared match results.

**Customization and UI**

- Loadout saving.
- Character accessories.
- Menu navigation.
- Settings persistence.
- Match configuration.

Fix problems discovered during testing.

Don't claim an interaction has been tested unless you have actually verified it.

When testing is not possible, clearly explain why and provide specific manual testing steps.

---

# 27. DEVELOPMENT APPROACH AND PRIORITIES

I am giving you a large number of interconnected requirements because I want this project to become ambitious and mechanically rich.

However, I do not expect you to implement hundreds of features simultaneously without considering quality.

I want you to work intelligently and systematically.

First, inspect the current repository and understand what already exists.

Then create a prioritized implementation plan.

Focus on:

**Priority 1 — Preserve and strengthen the foundation**

- Fix broken systems.
- Improve movement and gunplay.
- Ensure health, damage, scoring, and matches work.
- Improve fundamental architecture.

**Priority 2 — Create a unique gameplay identity**

- Develop the original signature mechanic.
- Improve creative physics interactions.
- Make weapons and gadgets more interesting.
- Create consistent design principles.

**Priority 3 — Expand mechanical depth**

- New weapons.
- New gadgets.
- Class differentiation.
- Abilities.
- Loadout customization.
- Build experimentation.

**Priority 4 — Improve bots and multiplayer**

- Smarter bot behavior.
- More varied bot personalities.
- Better difficulty settings.
- Team behavior.
- Working multiplayer foundations or enhancements.

**Priority 5 — Upgrade presentation**

- Character models.
- Weapon models.
- Animations.
- UI.
- Visual effects.
- Audio feedback.
- Cosmetic customization.

**Priority 6 — Polish, balance, and optimize**

- Testing.
- Performance improvements.
- Bug fixes.
- Balancing.
- Better usability.
- Match flow improvements.

These priorities can overlap where appropriate.

Do not waste time implementing features that already work well.

Do not endlessly plan instead of writing code.

Start executing after creating a concise, practical plan.

---

# 28. DOCUMENTATION AND MASTER GAME SPECIFICATION

Create or update a comprehensive master game design document inside the repository.

Document:

- Overall game vision.
- Unique design pillars.
- Original core mechanics.
- Weapon systems.
- Gadgets.
- Abilities.
- Classes.
- Loadout customization.
- Player movement.
- Physics interactions.
- Character customization.
- Bot AI.
- Game modes.
- Multiplayer architecture.
- UI and settings.
- Art direction.
- Known issues.
- Performance considerations.
- Future development plans.

Maintain a clear list of completed, partially completed, and planned features.

Do not silently omit requested features.

If a requirement cannot reasonably be implemented during this session, preserve it in the backlog.

Use documentation to make future Codex development sessions more efficient.

---

# 29. CREATIVE FREEDOM AND EXPECTATIONS

I want you to take substantial creative initiative.

Do not simply recreate the examples in this prompt.

Invent new weapons, gadgets, mechanics, characters, combat interactions, and stylistic ideas.

I would actually prefer that you surprise me with an original mechanic that makes the game significantly more entertaining than implementing a predictable feature solely because it exists in another shooter.

Think carefully about why players would enjoy every feature.

Ask questions such as:

- Does this make the game more fun?
- Does it create meaningful decisions?
- Does it encourage experimentation?
- Does it interact with other systems?
- Does it support replayability?
- Is it visually understandable?
- Can bots use or respond to it?
- Does it have counterplay?
- Does it reinforce the game's unique identity?
- Does it create memorable moments?

Avoid unnecessary complexity.

**I want a creative, mechanically rich game, not a random collection of gimmicks.**

Make reasonable decisions independently and continue working without frequently pausing for approval on minor design choices.

However, preserve major existing design constraints, especially the limited game modes and intentionally simple map.

---

# 30. NO STRICT TIME LIMIT — BUT MAINTAIN QUALITY

I do not have a strict 90-minute development limit for this task.

Take the time available in the current session to make substantial, meaningful improvements.

That does not mean spending the entire session designing systems that never get implemented.

I want working code, functional mechanics, successful integration, and testing.

Prioritize quality over raw feature count.

When a particularly ambitious feature would require disproportionate effort, consider implementing a well-designed initial version and documenting future improvements.

Keep the project playable throughout development.

Do not leave it in a broken state simply because an unfinished feature was ambitious.

---

# 31. DEFINITION OF SUCCESS

At the end of this development session, I want the game to feel substantially more complete, creative, polished, and enjoyable than it did previously.

I want to experience:

- More satisfying movement.
- Better weapons.
- More unusual combat interactions.
- A stronger original gameplay identity.
- More creative gadgets.
- Interesting classes and loadouts.
- Smarter and more entertaining AI bots.
- Better combat feedback.
- More expressive characters.
- Improved animations.
- Better UI and customization.
- Reliable scoring and match systems.
- More interesting match dynamics.
- Improved multiplayer functionality where feasible.
- Better overall performance and stability.
- Significantly greater replayability.

I want every match to have the potential to play out differently because of the choices players make and how the game's systems interact.

The result should feel less like a conventional FPS with some funny weapons and more like a unique, imaginative arcade shooter built around its own compelling mechanics.

Keep the map simple for now.

Focus your effort on everything that makes the game enjoyable to PLAY.

---

# 32. FINAL EXECUTION INSTRUCTIONS

1. Inspect the existing Arcade FPS Game repository thoroughly.
2. Identify all existing systems and current limitations.
3. Create a concise implementation plan and a coherent original game-design direction.
4. Preserve existing working functionality.
5. Begin implementing meaningful improvements immediately.
6. Build and integrate features incrementally.
7. Test major systems as you progress.
8. Fix bugs and integration issues.
9. Maintain playable builds.
10. Update the master game specification and development backlog.
11. Summarize what was implemented and actually tested.
12. Explain how to launch the updated game and access any multiplayer features.

Do not merely produce a design document or a large collection of disconnected prototypes.

Make real improvements to the existing game.

Do not modify my separate Nuketown/Black Ops 2 FPS repository.

Do not create a completely new game or unnecessarily restart development.

Above all, **MAKE THIS GAME FEEL ORIGINAL, ABSURD, EXPRESSIVE, MECHANICALLY DEEP, UNPREDICTABLE, SATISFYING, AND EXTREMELY FUN.**

I want a chaotic arcade FPS with enough creativity, polish, and replayability that it could eventually stand out as a legitimate indie multiplayer game.
