// Save and load: cash, garage, upgrades, mission progress, standing, crew.
// localStorage only; nothing leaves the machine.
import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      cash: state.cash,
      jobsDone: state.jobsDone,
      standing: state.standing,
      crew: state.crew,
      garage: state.garage,
      weapons: state.weapons,
      ammo: state.ammo,
      health: state.player.health,
      playerX: state.player.x,
      playerY: state.player.y,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  try {
    return !!window.localStorage.getItem(SAVE_KEY);
  } catch (e) {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    /* storage unavailable */
  }
}
