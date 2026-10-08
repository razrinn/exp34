const tones = {
  attack: [220, 110, 0.10], heavy: [140, 45, 0.18],
  hit: [110, 40, 0.16], parry: [900, 1400, 0.12],
  dodge: [400, 120, 0.10], counter: [450, 1100, 0.20],
  heal: [400, 800, 0.25],
};
let context;

export function playCue(kind) {
  if (!globalThis.AudioContext) return;
  context ??= new AudioContext();
  if (context.state === 'suspended') context.resume().catch(() => {});
  const [from, to, duration] = tones[kind];
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(from, now);
  oscillator.frequency.exponentialRampToValueAtTime(to, now + duration);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
}
