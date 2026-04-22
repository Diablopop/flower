// Mulberry32 — fast, high-quality 32-bit PRNG seeded from an integer
function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(31, hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

// Returns a function rand() → [0, 1) deterministically from seed
// Accepts a string (hashed) or integer seed
export function seededRandom(seed) {
  const numSeed = typeof seed === 'string' ? hashString(seed) : seed;
  return mulberry32(numSeed);
}

// Convenience: pick a random item from array using a rand() function
export function randChoice(arr, rand) {
  return arr[Math.floor(rand() * arr.length)];
}

// Convenience: random integer in [min, max] inclusive
export function randInt(min, max, rand) {
  return min + Math.floor(rand() * (max - min + 1));
}
