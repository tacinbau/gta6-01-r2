// A small seeded random number generator (mulberry32): the same seed gives the same city,
// the same traffic and the same missions, which is what makes the screenshot scenes repeatable.
// Nothing in the simulation uses Math.random.
export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An integer in [min, max). */
export function randInt(random, min, max) {
  return min + Math.floor(random() * (max - min));
}

/** One element of an array, picked by the seeded stream. */
export function randPick(random, list) {
  return list[Math.floor(random() * list.length)];
}
