# Azura Bay

[![Rank](https://make.fun/badge/gta6-01/tacinbau/gta6-01-r2/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/tacinbau/gta6-01-r2/reward.svg)](https://make.fun/bounty/gta6-01)
[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game in the spirit of GTA 6, built for the make.fun gta6-01 bounty.
A sun-soaked invented island city — never Vice City, never Liberty City — explored on foot
and by car, with traffic, pedestrians, a wanted level, police who chase, ram, roadblock and
send a helicopter, and eight story missions from the fixer Abuela Cleo.

## The game

- **Azura Bay**: five districts (Old Town, The Hills, Downtown, The Docks, Marina) with
  standing 0–5 that earns garage discounts.
- **Eight missions**: errand, car theft, lose-the-tail, a 3-lap street race against a ghost
  coupe, a bank vault hold, a convoy rescue, a smuggling run, and the final casino score.
- **Crew**: Rook (+12% top speed) and Vera (heat cools faster, roadblocks held back),
  recruited through the story.
- **Wanted 0–5 stars**: cruisers chase and ram, roadblocks at 3 stars, Air One helicopter
  with a spotlight at 4 stars. Busted or wasted costs $200 at the hospital.
- **Three weapon slots** (fists, pistol, SMG) with mouse aim; **five garage cars** plus
  engine, tire and armor upgrades; **localStorage saves**; **three procedural WebAudio
  radio stations** plus engine hum.
- **HUD** with minimap, wanted stars, mission banner and countdown, and an objective arrow.

## Controls

WASD drive / walk — E enter a car — mouse to aim, click to shoot — 1-3 weapons —
R radio — G garage (near the garage) — P pause.

## Verification

- `?selftest=1` runs nine headless checks: city builds, traffic and pedestrians spawn,
  600 steps clean, a mission starts and advances, police spawn at heat, the renderer paints,
  and the save/load round-trips.
- Four staged screenshots (`shots.json`, seed 7): the Vault mission with a police chase,
  a dusk drive through the Marina, Lose the Tail, and a night chase under Air One.
- Two program runs produce byte-identical output (deterministic seeded RNG throughout).

## Tech

Vanilla JavaScript, 2D canvas, no libraries, no network. `main.ts` hands the game in with
the kit's `vendor/makefun-game.ts` dossier builder. Serve locally with `node serve.ts`.
