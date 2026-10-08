const tones = {
  attack: [440, 180, 0.16], heavy: [220, 70, 0.22],
  hit: [180, 60, 0.20], parry: [900, 1400, 0.12],
  dodge: [400, 120, 0.10], counter: [450, 1100, 0.20],
  heal: [400, 800, 0.25],
};
let context;

export async function playCue(kind) {
  if (!globalThis.AudioContext) return false;
  try {
    context ??= new AudioContext();
    if (context.state !== 'running') await context.resume();
  } catch {
    return false;
  }
  const [from, to, duration] = tones[kind];
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(from, now);
  oscillator.frequency.exponentialRampToValueAtTime(to, now + duration);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.22, now + 0.01);
  gain.gain.setValueAtTime(0.22, now + duration * 0.4);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  return true;
}
