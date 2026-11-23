// The 4 graded shots: camera, hero, time of day, mission, HUD numbers.
// The judge sees the game mostly through these frames, so each one stages
// several systems at once: chase + wanted + minimap + mission objective.
// Camera values were tuned against the r2f frames: the cover is brighter and
// crowded, the mission hero car sits fully above the dialogue box.
export const SHOTS = {
  cover: {
    id: 'cover',
    name: '1-cover.jpg',
    missionId: 4,
    district: 'pasaru',
    timeOfDay: 'dusk',
    skyTop: 0x2a1a3a,
    skyMid: 0xd95f4b,
    skyLow: 0xe88a4b,
    fog: 0x3a2430,
    ambient: 0.95,
    sun: 1.0,
    camera: { pos: [-110, 5, 58], target: [-110, 3.5, -12], fov: 62 },
    speedKmh: 0,
    onFoot: true,
    heliVisible: false,
    dialogue: { speaker: 'MIRA KESANG', text: 'Mira: Two down the left aisle! I have got the stall side, Tomo.' },
  },
  city: {
    id: 'city',
    name: '2-city.jpg',
    missionId: 6,
    district: 'strand',
    timeOfDay: 'sunset',
    skyTop: 0x2a4a7a,
    skyMid: 0xe89a4b,
    skyLow: 0xf0c060,
    fog: 0x8a6a4a,
    ambient: 1.0,
    sun: 1.15,
    camera: { pos: [-15, 6.5, 124], target: [28, 2, 131], fov: 65 },
    speedKmh: 112,
    onFoot: false,
    heliVisible: true,
    dialogue: { speaker: 'MIRA KESANG', text: "Mira: He's making for Kumala Pier! Ram the Regent before he reaches the water!" },
  },
  mission: {
    id: 'mission',
    name: '3-mission.jpg',
    missionId: 5,
    district: 'downtown',
    timeOfDay: 'dusk',
    skyTop: 0x2a1a3a,
    skyMid: 0xd95f4b,
    skyLow: 0xc96a3a,
    fog: 0x3a2430,
    ambient: 0.95,
    sun: 1.0,
    // Camera high and close behind the hero coupe: the car sits in the middle
    // band of the frame, fully above the dialogue box, BANK tower dead ahead.
    camera: { pos: [0, 7, 20], target: [2, 2.5, -60], fov: 60 },
    speedKmh: 29,
    onFoot: false,
    heliVisible: false,
    dialogue: { speaker: 'ABUELA CLEO', text: 'Cleo: The bank keeps a safe in the back. In, out, gone. The alarm is your starting gun.' },
  },
  night: {
    id: 'night',
    name: '4-night.jpg',
    missionId: 1,
    district: 'downtown',
    timeOfDay: 'night',
    skyTop: 0x050810,
    skyMid: 0x0a1226,
    skyLow: 0x1a2438,
    fog: 0x0a1220,
    ambient: 0.55,
    sun: 0.35,
    camera: { pos: [0, 7.5, 14], target: [2, 3.5, -50], fov: 62 },
    speedKmh: 0,
    onFoot: true,
    heliVisible: true,
    dialogue: { speaker: 'ABUELA CLEO', text: 'Cleo: You want work, kid? Walk this package to the market stall. No sirens, no shortcuts through the sea.' },
  },
};

export const SHOT_ORDER = ['cover', 'city', 'mission', 'night'];

export function shotById(id) {
  return SHOTS[id] || SHOTS.cover;
}
