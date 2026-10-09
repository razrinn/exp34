export const ATTACK_KEYS = ['KeyI', 'KeyO', 'KeyP'];
export const ATTACK_BEAT_MS = 900;
export const ATTACK_WINDOW_MS = 240;
export const ATTACK_TIMING_MS = ATTACK_BEAT_MS * ATTACK_KEYS.length;

export function attackTiming(now) {
  return { startedAt: now, results: ATTACK_KEYS.map(() => null) };
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
  results[index] = code === ATTACK_KEYS[index] && Math.abs(now - target) <= ATTACK_WINDOW_MS / 2;
  return { ...timing, results };
}

export function attackQuality(timing) {
  return timing.results.filter(result => result === true).length / ATTACK_KEYS.length;
}
