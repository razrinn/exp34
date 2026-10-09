export const ATTACK_KEYS = ['KeyI', 'KeyO', 'KeyP'];
export const ATTACK_BEAT_MS = 900;
export const ATTACK_WINDOW_MS = 240;
export const ATTACK_TIMING_MS = ATTACK_BEAT_MS * ATTACK_KEYS.length;

export function attackTiming(now, random = Math.random) {
  return { startedAt: now, keys: ATTACK_KEYS.map(() => ATTACK_KEYS[Math.floor(random() * ATTACK_KEYS.length)]), results: ATTACK_KEYS.map(() => null) };
}

export function advanceAttack(timing, now) {
  return { ...timing, results: timing.results.map((result, index) =>
    result === null && now > timing.startedAt + index * ATTACK_BEAT_MS + 700 + ATTACK_WINDOW_MS / 2 ? false : result) };
}

export function timeAttack(timing, code, now) {
  timing = advanceAttack(timing, now);
  const index = Math.floor((now - timing.startedAt) / ATTACK_BEAT_MS);
  if (index < 0 || index >= ATTACK_KEYS.length || timing.results[index] !== null) return timing;
  const target = timing.startedAt + index * ATTACK_BEAT_MS + 700;
  const results = [...timing.results];
  results[index] = code === timing.keys[index] && Math.abs(now - target) <= ATTACK_WINDOW_MS / 2;
  return { ...timing, results };
}

export function attackQuality(timing) {
  return timing.results.filter(result => result === true).length / ATTACK_KEYS.length;
}

export function attackMarker(elapsed) {
  const start = 700 - ATTACK_WINDOW_MS / 2;
  const end = 700 + ATTACK_WINDOW_MS / 2;
  const progress = Math.max(0, Math.min(1, elapsed <= start
    ? .75 * elapsed / start : .75 + .25 * (elapsed - start) / (end - start)));
  const vertices = [[50, 6], [94, 50], [50, 94], [6, 50], [50, 6]];
  const edge = Math.min(3, Math.floor(progress * 4));
  const fraction = progress * 4 - edge;
  return { x: vertices[edge][0] + (vertices[edge + 1][0] - vertices[edge][0]) * fraction,
    y: vertices[edge][1] + (vertices[edge + 1][1] - vertices[edge][1]) * fraction };
}
