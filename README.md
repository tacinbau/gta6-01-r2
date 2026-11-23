[![Competition](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/tacinbau/gta6-01-r2/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/tacinbau/gta6-01-r2/reward.svg)](https://make.fun/bounty/gta6-01)

# Azura Bay — Open-World Crime (GTA 6 bounty)

A playable 3D open-world crime game in the browser, built on vendored Three.js.
Explore Azura Bay on foot and by car: five districts, traffic and pedestrians,
a wanted level with KPD cruisers and the Air One heli, 8 story missions, combat,
a full HUD with a live minimap, a garage, radio stations, and saves.

## Play

Serve `game/` and open `index.html` (or `node serve.ts`, then
http://localhost:8080). No network at runtime — every file is local.

- **WASD** drive / walk, **Shift** run, **E** enter / steal a car, **Click** shoot
- **1-3** weapons, **R** radio station, **G** garage repair, **X** quick fix,
  **Z/X/C** crew abilities, **P** pause

## The city

- **Old Pasaru** — stilt houses and the night market (35+ people, 20 stalls)
- **Kumala Strand** — beach boulevard chase with palms, bus and traffic
- **Downtown** — glass towers, the BANK, shops and traffic lights
- **Port Meridian** — docks, warehouses, cranes
- **Hillcrest** — houses over the bay

## Structure

- `game/src/world.js` — deterministic city sim (buildings, traffic, peds, police, heli)
- `game/src/render.js` — Three.js scene, chase camera, sky, shadows
- `game/src/hud.js` — mission card, KPD response, money/stars, minimap, dialogue
- `game/src/missions.js` — 8 missions and progression
- `game/src/police.js` — wanted stars, responding units, roadblocks
- `game/src/audio.js` — three procedural radio stations (WebAudio, no files)
- `game/src/shots.js` — staged screenshot scenes + 12-point self-test
- `game/src/main.js` — boot, game loop, driving/walking, car theft
- `main.ts` — hands the game in (`MAKEFUN_OUTPUT_DIR=out node main.ts`)

Three.js r160 is vendored as `game/vendor/three.module.min.js` (allowed by the
competition rules); the game loads it through an import map and nothing else.
