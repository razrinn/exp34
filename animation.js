export function enemyPose(remaining, duration) {
  const swingDuration = Math.min(240, duration);
  if (remaining > swingDuration) {
    const windup = Math.max(0, (duration - remaining) / (duration - swingDuration));
    return { x: 12 * windup, y: -10 * windup, rotation: 25 * windup };
  }
  const swing = Math.min(1, Math.max(0, 1 - remaining / swingDuration));
  return { x: 12 - 62 * swing, y: -10 + 10 * swing, rotation: 25 - 70 * swing };
}

export function actionPose(kind, elapsed) {
  const duration = ['attack', 'heavy', 'counter'].includes(kind) ? 500 : 300;
  const t = Math.max(0, Math.min(1, elapsed / duration));
  const pulse = Math.sin(Math.PI * t);
  const pose = { x: 0, lift: 0, lean: 0, sword: 0, active: elapsed < duration };
  if (['attack', 'heavy', 'counter'].includes(kind)) {
    pose.x = pulse * (kind === 'heavy' ? 1.2 : .9);
    pose.lean = -pulse * .12;
    pose.sword = -pulse * (kind === 'heavy' ? 2.2 : 1.7);
  } else if (kind === 'dodge') {
    pose.x = -pulse * .65;
    pose.lean = pulse * .3;
  } else if (kind === 'parry') {
    pose.sword = -pulse * .85;
  } else if (kind === 'hit') {
    pose.x = -pulse * .2;
    pose.lean = pulse * .18;
  } else if (kind === 'heal') {
    pose.lift = pulse * .12;
  }
  return pose;
}
