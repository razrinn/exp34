export function createSceneClock(readNow = () => performance.now()) {
  let real = readNow();
  let visual = real;
  let rate = 1;
  const now = () => {
    const next = readNow();
    visual += Math.max(0, next - real) * rate;
    real = next;
    return visual;
  };
  return {
    now,
    focus(focused) { now(); rate = focused ? 0.15 : 1; },
  };
}
