// Azura Bay missions: 8 story jobs across the 5 districts.
// Each mission has stages, a dialogue line from the crew, a reward and a
// wanted level. The shot presets pick missions 1, 4, 5 and 6 for the cover,
// night, mission and city shots.
import { HERO } from './config.js';

export const MISSIONS = [
  {
    id: 1, name: 'FIRST ERRAND', district: 'pasaru',
    objective: 'Walk the package to the stall in Old Pasaru.',
    stages: ['REACH THE MARKET STALL'],
    next: 'Finish the job',
    dialogue: { speaker: 'ABUELA CLEO', text: 'Cleo: You want work, kid? Walk this package to the market stall. No sirens, no shortcuts through the sea.' },
    reward: 500, wanted: 3, money: 500,
  },
  {
    id: 2, name: 'LOW TIDE', district: 'harbor',
    objective: 'Lift the crate from the docks before the tide turns.',
    stages: ['FIND THE CRATE', 'DODGE THE PATROL'],
    next: 'Bring it to Lio',
    dialogue: { speaker: 'LIO', text: 'Lio: Crate is on pier 4. Patrol walks it every six minutes. Walk, do not run.' },
    reward: 900, wanted: 2, money: 1400,
  },
  {
    id: 3, name: 'CORAL RUN', district: 'hills',
    objective: 'Drive the hills road and lose the tail.',
    stages: ['REACH THE OVERLOOK', 'LOSE THE TAIL'],
    next: 'Park at the overlook',
    dialogue: { speaker: 'MIRA', text: 'Mira: Hills road, third gear, no brakes on the hairpin. Trust me.' },
    reward: 1200, wanted: 3, money: 2600,
  },
  {
    id: 4, name: 'MARKET SQUEEZE', district: 'pasaru',
    objective: 'Take out the Keron Boys 0/3.',
    stages: ['CLEAR THE AISLES'],
    next: 'Finish the job',
    dialogue: { speaker: 'MIRA KESANG', text: 'Mira: Two down the left aisle! I have got the stall side, Tomo.' },
    reward: 1800, wanted: 2, money: 7270,
  },
  {
    id: 5, name: 'THE VAULT', district: 'downtown',
    objective: 'Reach the bank on the downtown strip.',
    stages: ['REACH THE BANK', 'HOLD THE PLAZA'],
    next: 'Hold the plaza',
    dialogue: { speaker: 'ABUELA CLEO', text: 'Cleo: The bank keeps a safe in the back. In, out, gone. The alarm is your starting gun.' },
    reward: 4000, wanted: 2, money: 500,
  },
  {
    id: 6, name: "ORU'S FALL", district: 'strand',
    objective: "Wreck Oru's Regent before it reaches the pier.",
    stages: ['WRECK THE REGENT'],
    next: 'Finish the job',
    dialogue: { speaker: 'MIRA KESANG', text: "Mira: He's making for Kumala Pier! Ram the Regent before he reaches the water!" },
    reward: 5200, wanted: 5, money: 18450,
  },
  {
    id: 7, name: 'NIGHT SHIFT', district: 'downtown',
    objective: 'Shadow the courier through downtown without being seen.',
    stages: ['TAIL THE COURIER', 'PHOTOGRAPH THE HANDOFF'],
    next: 'Do not be seen',
    dialogue: { speaker: 'KIKI', text: 'Kiki: Courier moves at midnight. Eyes out, lights off, phone away.' },
    reward: 2600, wanted: 1, money: 9200,
  },
  {
    id: 8, name: 'HIGH WATER', district: 'strand',
    objective: 'Outrun the storm surge along Strand Boulevard.',
    stages: ['OUTRUN THE SURGE', 'REACH THE GARAGE'],
    next: 'Get to the garage',
    dialogue: { speaker: 'MIRA', text: 'Mira: Water is coming over the seawall. Drive like the bay is chasing you — it is.' },
    reward: 6000, wanted: 4, money: 24000,
  },
];

export function missionById(id) {
  return MISSIONS.find((m) => m.id === id) || MISSIONS[0];
}

export function heroName() {
  return HERO.name;
}
