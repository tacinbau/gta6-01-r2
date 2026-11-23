# Azura Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/tacinbau/gta6-01-r2/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/tacinbau/gta6-01-r2/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime story on an invented island city. You are a new face in
Azura Bay, and Abuela Cleo has eight jobs for you — deliveries, a car theft,
a street race, a vault, a rescue, a smuggling run and the final casino score.
Drive, steal, run, survive.

A complete original game in plain HTML5 Canvas and vanilla JavaScript (ES
modules, no libraries, no network). Not affiliated with any other game or
studio.

## The city

Five districts with their own standing: Old Town, The Hills, Downtown, The
Docks and the Marina — a seeded road grid, traffic, pedestrians, a beach,
street lamps and landmarks from Cleo's Garage to Casino Solmar.

## Systems

- **On foot and by car** — walk, sprint, steal any parked car (E), arcade
  driving with five car models in the garage.
- **Wanted 0–5 stars** — police cruisers chase and ram, roadblocks at 3
  stars, the Air One helicopter at 4. Heat cools when you stay out of sight.
- **Crew** — Rook the getaway driver (+12% top speed) and Vera the hacker
  (heat cools 40% faster); recruit them through the story.
- **District standing** — each finished job raises standing in its
  district and earns garage discounts.
- **Combat** — fists, pistol and SMG (1/2/3), mouse aim, ammo to buy.
- **Garage** — buy cars, upgrade engine / tires / armor, save your ride.
- **Save** — F saves to localStorage; continue from the title screen.
- **Radio** — three procedural synth stations (R), all WebAudio, no files.
- **HUD + minimap** — cash, health, wanted stars, weapon slots, mission
  banner with a countdown, objective arrow and a live minimap.

## How to play

| Key | Action |
| --- | --- |
| W A S D / Arrows | Walk / drive |
| Shift | Sprint on foot |
| E | Enter / steal a car, exit a car |
| J | Jobs list (press 1–8 to start the next job) |
| Mouse | Aim · Click — shoot |
| 1 / 2 / 3 | Fists / pistol / SMG (buys the weapon if you lack it) |
| G | Garage (near Cleo's) · Tab — crew |
| R | Radio · F — save · P — pause |

Get busted or wasted and you wake up at Azura General, $200 lighter.
Finish all eight jobs to pull the Azura Job and beat the game.

## Run it

```sh
node serve.ts   # http://localhost:8080
```
