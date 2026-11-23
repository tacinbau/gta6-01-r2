# Azura Bay — Open-World Crime (GTA 6)

[![make.fun](https://make.fun/badge/gta6-01/tacinbau/gta6-01-r2/rank.svg)](https://make.fun/bounty/gta6-01)
[![make.fun](https://make.fun/badge/gta6-01/tacinbau/gta6-01-r2/reward.svg)](https://make.fun/bounty/gta6-01)
[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game set in Azura Bay, a sun-soaked island city
of stilt houses, glass towers, a night market and a beachfront boulevard.
Built with Three.js (vendored as a minified build under `game/vendor/`).

## Play

Open `game/index.html` in desktop Chrome (or run `node serve.ts` and open
http://localhost:8080). No network needed — every file is local.

- **WASD** drive / walk, **E** enter or leave a car, **Click** shoot
- **1–3** weapons, **R** radio, **G** garage, **X** quick fix, **P** pause

## The city

- **5 districts**: Old Pasaru (night market), Downtown (BANK tower), Kumala
  Strand (beach boulevard), Harbour, Coral Hills
- **136 buildings** — 71 gabled houses, 59 shops with signs and awnings,
  6 glass towers with lit windows
- **20 market stalls**, **204 pedestrians**, **48 vehicles** (traffic, 4 KPD
  cruisers with flashing light bars, 2 yellow school buses), **10 traffic
  lights**, an AIR ONE helicopter with a searchlight cone
- **8 story missions** with crew dialogue (Mira, Lio, Kiki, Abuela Cleo),
  a 5-star wanted system with KPD pursuit, roadblocks and air support,
  garage upgrades, saves and 3 procedural radio stations

## Screenshots

1. Night market — Mission 4, Market Squeeze
2. Beach chase — Mission 6, Oru's Fall, 112 KM/H under AIR ONE
3. Bank job — Mission 5, The Vault, BANK tower on the downtown strip
4. Night patrol — Mission 1, First Errand, heli searchlight

## Tech

- Three.js r160, vendored minified, loaded through an import map
- Deterministic seeded world (mulberry32) — the same seed rebuilds the
  same city, the same traffic and the same shots
- `?selftest=1` runs 12 headless checks; `?shot=cover|city|mission|night`
  stages the four screenshots

## License

MIT — see LICENSE.
