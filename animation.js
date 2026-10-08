export function enemyPose(remaining, duration) {
  const swingDuration = Math.min(240, duration);
  if (remaining > swingDuration) {
    const windup = Math.max(0, (duration - remaining) / (duration - swingDuration));
    return { x: 12 * windup, y: -10 * windup, rotation: 25 * windup };
  }
  const swing = Math.min(1, Math.max(0, 1 - remaining / swingDuration));
  return { x: 12 - 62 * swing, y: -10 + 10 * swing, rotation: 25 - 70 * swing };
}
