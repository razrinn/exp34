export function enemyPose(remaining, duration) {
  const swingDuration = Math.min(240, duration);
  if (remaining > swingDuration) {
    const windup = Math.max(0, (duration - remaining) / (duration - swingDuration));
    return { x: 12 * windup, y: -10 * windup, rotation: 25 * windup };
  }
  const swing = Math.min(1, Math.max(0, 1 - remaining / swingDuration));
  return { x: 12 - 62 * swing, y: -10 + 10 * swing, rotation: 25 - 70 * swing };
}

export const PLAYER_IMPACT_MS = 320;
export const PLAYER_ACTION_MS = 720;
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

export function actionPose(kind, elapsed) {
  const duration = ['attack', 'heavy', 'counter'].includes(kind) ? PLAYER_ACTION_MS : 300;
  const t = Math.max(0, Math.min(1, elapsed / duration));
  const pulse = Math.sin(Math.PI * t);
  const pose = { x: 0, lift: 0, lean: 0, sword: 0, active: elapsed < duration };
  if (['attack', 'heavy', 'counter'].includes(kind)) {
    pose.x = 1.4 * (elapsed <= PLAYER_IMPACT_MS
      ? smooth(elapsed / 180) : 1 - smooth((elapsed - PLAYER_IMPACT_MS) / (PLAYER_ACTION_MS - PLAYER_IMPACT_MS)));
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

// These contact fractions were sampled from the shipped KayKit clips.
export function playerClipProgress(kind, elapsed) {
  const contact = { attack: .2, heavy: .65, counter: .35 }[kind];
  if (contact === undefined) return Math.max(0, Math.min(1, elapsed / 300));
  return elapsed <= PLAYER_IMPACT_MS
    ? contact * Math.max(0, elapsed / PLAYER_IMPACT_MS)
    : contact + (1 - contact) * Math.min(1, (elapsed - PLAYER_IMPACT_MS) / (PLAYER_ACTION_MS - PLAYER_IMPACT_MS));
}

export const ENEMY_ATTACKS = {
  slash: { clip: '1H_Melee_Attack_Slice_Horizontal', windup: .08, contact: .2, swingMs: 140 },
  chop: { clip: '1H_Melee_Attack_Chop', windup: .4, contact: .65, swingMs: 240 },
  thrust: { clip: '1H_Melee_Attack_Stab', windup: .2, contact: .35, swingMs: 180 },
};

export function enemyAttackPose(remaining, duration, hitIndex, style = 'chop') {
  const attack = ENEMY_ATTACKS[style];
  const swing = Math.min(attack.swingMs, duration);
  const windupDuration = Math.max(1, duration - swing);
  // The thrust pulls back early and holds, instead of creeping toward impact.
  const prepare = style === 'thrust' ? Math.min(450, windupDuration) : windupDuration;
  const progress = remaining > swing
    ? attack.windup * smooth((duration - remaining) / prepare)
    : attack.windup + (attack.contact - attack.windup) * smooth(1 - remaining / swing);
  return {
    x: hitIndex > 0 ? 1.4 : 1.4 * smooth(1 - remaining / Math.min(400, duration)),
    clip: Math.max(0, Math.min(attack.contact, progress)),
  };
}
