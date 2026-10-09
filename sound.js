let context;
let noise;
let musicBus;
let musicTimer;
let musicStep = 0;
let musicAt = 0;
let musicVolume = 0.35;
let musicRequest = 0;
const musicNodes = new Set();

async function ready() {
  if (!globalThis.AudioContext) return false;
  try {
    context ??= new AudioContext();
    if (context.state !== 'running') await context.resume();
    return context.state === 'running';
  } catch { return false; }
}

function voice(type, from, to, duration, volume, at = context.currentTime, bus = context.destination) {
  const source = type === 'noise' ? context.createBufferSource() : context.createOscillator();
  if (type === 'noise') {
    if (!noise) {
      noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
      const samples = noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(from, at);
    filter.frequency.exponentialRampToValueAtTime(to, at + duration);
    source.connect(filter);
    source.filter = filter;
  } else {
    source.type = type;
    source.frequency.setValueAtTime(from, at);
    source.frequency.exponentialRampToValueAtTime(to, at + duration);
  }
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + Math.min(0.03, duration / 4));
  gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
  (source.filter ?? source).connect(gain);
  gain.connect(bus);
  if (bus === musicBus) musicNodes.add(source);
  source.onended = () => {
    source.disconnect(); source.filter?.disconnect(); gain.disconnect(); musicNodes.delete(source);
  };
  source.start(at);
  source.stop(at + duration);
}

export async function playCue(kind) {
  if (!['attack', 'heavy', 'hit', 'parry', 'dodge', 'counter', 'heal'].includes(kind)) return false;
  if (!await ready()) return false;
  const at = context.currentTime;
  if (kind === 'attack' || kind === 'heavy' || kind === 'hit') {
    const heavy = kind === 'heavy';
    voice('noise', heavy ? 2400 : 4200, 180, heavy ? 0.28 : 0.16, 0.16, at);
    voice('sine', heavy ? 110 : 170, 45, heavy ? 0.35 : 0.18, 0.3, at);
    if (kind !== 'hit') voice('triangle', 740, 260, 0.09, 0.07, at);
  } else if (kind === 'parry' || kind === 'counter') {
    const counter = kind === 'counter';
    voice('noise', 7000, 1200, 0.08, 0.09, at);
    for (const [i, pitch] of [1175, 1760, 2350].entries()) {
      voice('sine', pitch, pitch * 0.98, counter ? 0.5 : 0.28, 0.07 / (i + 1), at + (counter ? i * 0.04 : 0));
    }
    if (counter) voice('sine', 150, 50, 0.3, 0.24, at);
  } else if (kind === 'dodge') {
    voice('noise', 3200, 300, 0.22, 0.09, at);
  } else {
    for (const [i, pitch] of [523.25, 659.25, 783.99, 1046.5].entries()) voice('sine', pitch, pitch, 0.45, 0.08, at + i * 0.07);
  }
  return true;
}

const chords = [[50, 57, 65], [46, 53, 62], [48, 55, 64], [45, 52, 61]];
const melody = [74, null, 77, 81, 79, null, 77, 72, 74, 77, null, 69, 72, null, 73, 69];
const pitch = note => 440 * 2 ** ((note - 69) / 12);

function scheduleMusic() {
  // Schedule a short lookahead on the audio clock; browser frames do not set the rhythm.
  if (musicAt < context.currentTime) musicAt = context.currentTime;
  while (musicAt < context.currentTime + 0.2) {
    const step = musicStep % 64;
    const chord = chords[Math.floor(step / 16)];
    if (step % 16 === 0) {
      for (const note of chord) voice('triangle', pitch(note), pitch(note), 6.1, 0.035, musicAt, musicBus);
    }
    if (step % 4 === 0) voice('sine', pitch(chord[0] - 12), pitch(chord[0] - 12), 0.65, 0.16, musicAt, musicBus);
    const note = melody[step % 16];
    if (note !== null) voice('triangle', pitch(note), pitch(note), 0.55, 0.065, musicAt, musicBus);
    if (step % 4 === 0) voice('sine', 95, 38, 0.2, 0.18, musicAt, musicBus);
    if (step % 8 === 4) voice('noise', 1400, 300, 0.16, 0.075, musicAt, musicBus);
    if (step % 2 === 1) voice('noise', 6500, 3500, 0.045, 0.025, musicAt, musicBus);
    musicStep++;
    musicAt += 60 / 82 / 2;
  }
}

export function setMusicVolume(value) {
  musicVolume = Math.max(0, Math.min(1, Number(value) || 0));
  if (musicBus) musicBus.gain.setTargetAtTime(musicVolume, context.currentTime, 0.05);
}

export async function setMusic(enabled) {
  const request = ++musicRequest;
  if (!enabled) {
    clearInterval(musicTimer); musicTimer = undefined;
    for (const node of musicNodes) { node.stop(); node.onended(); }
    musicNodes.clear();
    return true;
  }
  if (!await ready()) return false;
  if (request !== musicRequest) return true;
  if (musicTimer !== undefined) return true;
  musicBus ??= context.createGain();
  musicBus.gain.setValueAtTime(musicVolume, context.currentTime);
  musicBus.disconnect(); musicBus.connect(context.destination);
  musicStep = 0; musicAt = context.currentTime + 0.03;
  scheduleMusic();
  musicTimer = setInterval(scheduleMusic, 100);
  return true;
}
