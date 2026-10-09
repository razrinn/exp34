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
export const HOME_X = 3;
export const STRIKE_REACH = 4;
export const ENEMY_STEP_BACK_MS = 160;
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

export function retreatDistance(elapsed, duration, end = 0) {
  return end + (STRIKE_REACH - end) * (1 - smooth(elapsed / duration));
}

export function actionPose(kind, elapsed) {
  const duration = ['attack', 'heavy', 'counter'].includes(kind) ? PLAYER_ACTION_MS : 300;
  const t = Math.max(0, Math.min(1, elapsed / duration));
  const pulse = Math.sin(Math.PI * t);
  const pose = { x: 0, lift: 0, lean: 0, sword: 0, active: elapsed < duration };
  if (['attack', 'heavy', 'counter'].includes(kind)) {
    pose.x = elapsed <= PLAYER_IMPACT_MS
      ? STRIKE_REACH * smooth(elapsed / (kind === 'counter' ? PLAYER_IMPACT_MS : 180))
      : retreatDistance(elapsed - PLAYER_IMPACT_MS, PLAYER_ACTION_MS - PLAYER_IMPACT_MS);
    pose.lean = -pulse * .12;
    pose.sword = -pulse * (kind === 'heavy' ? 2.2 : 1.7);
    if (kind === 'heavy') {
      pose.lift = elapsed <= PLAYER_IMPACT_MS
        ? .75 * Math.sin(Math.PI * elapsed / 500)
        : .75 * Math.sin(Math.PI * PLAYER_IMPACT_MS / 500) * (1 - smooth((elapsed - PLAYER_IMPACT_MS) / 180));
    } else if (kind === 'attack') {
      pose.lift = -.15 * Math.sin(Math.PI * Math.min(1, elapsed / 500));
      pose.lean = -pulse * .22;
    }
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
  const prepare = Math.min({ slash: 300, chop: 500, thrust: 450 }[style], windupDuration);
  const progress = remaining > swing
    ? attack.windup * smooth((duration - remaining) / prepare)
    : attack.windup + (attack.contact - attack.windup) * smooth(1 - remaining / swing);
  const approachMs = Math.min(400, hitIndex > 0 ? Math.max(1, duration - ENEMY_STEP_BACK_MS) : duration);
  const start = hitIndex > 0 && duration <= 500 ? STRIKE_REACH - 1 : 0;
  return {
    x: start + (STRIKE_REACH - start) * smooth(1 - remaining / approachMs),
    clip: Math.max(0, Math.min(attack.contact, progress)),
  };
}

export function attackEffects(remaining, duration, style = 'slash') {
  const lead = Math.min(650, duration - 80);
  const end = Math.min(320, duration * .35);
  const cue = remaining <= lead && remaining > end;
  const chargeMs = Math.min(900, duration);
  const charge = remaining > 0 && remaining < chargeMs
    ? smooth(1 - remaining / chargeMs) * (style === 'chop' ? 1 : .7) : 0;
  return { cue, charge };
}


export function enemyWindupPose(remaining, duration, style) {
  const swing = Math.min(ENEMY_ATTACKS[style].swingMs, duration);
  const prepare = Math.min({ slash: 300, chop: 500, thrust: 450 }[style], Math.max(1, duration - swing));
  const amount = smooth((duration - remaining) / prepare) * smooth(remaining / swing);
  const poses = { slash: { lean: -.08, twist: .32, lift: 0 }, chop: { lean: .12, twist: 0, lift: .06 }, thrust: { lean: -.16, twist: -.15, lift: 0 } };
  const pose = poses[style];
  return { lean: pose.lean * amount, twist: pose.twist * amount, lift: pose.lift * amount };
}

export const DEATH_MS = 2200;
export function deathClipProgress(elapsed) {
  return Math.max(0, Math.min(1, elapsed / DEATH_MS));
}
