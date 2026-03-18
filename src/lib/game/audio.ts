// ─── Procedural audio engine (Web Audio API, no asset files) ───

let ctx: AudioContext | null = null;
let muted = false;

export function initAudio() {
  if (ctx) return;
  ctx = new AudioContext();
}

export function setMuted(m: boolean) {
  muted = m;
}

export function isMuted(): boolean {
  return muted;
}

function tone(
  freq: number,
  type: OscillatorType,
  duration: number,
  startTime: number,
  gainStart: number,
  gainEnd: number,
  freqEnd?: number,
) {
  if (!ctx || muted) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  if (freqEnd !== undefined) {
    osc.frequency.linearRampToValueAtTime(freqEnd, startTime + duration);
  }
  gain.gain.setValueAtTime(gainStart, startTime);
  gain.gain.linearRampToValueAtTime(gainEnd, startTime + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

function noise(duration: number, startTime: number, volume: number, filterFreq: number) {
  if (!ctx || muted) return;
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1);
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = filterFreq;
  filter.Q.value = 1;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.linearRampToValueAtTime(0, startTime + duration);
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(startTime);
  src.stop(startTime + duration);
}

export type SoundName =
  | "footstep"
  | "attack"
  | "hit_taken"
  | "pickup"
  | "level_up"
  | "death"
  | "descend"
  | "boss_intro"
  | "door_open"
  | "use_scroll"
  | "use_potion"
  | "trap";

export function playSound(name: SoundName) {
  if (!ctx || muted) return;
  ctx.resume();
  const t = ctx.currentTime;

  switch (name) {
    case "footstep":
      noise(0.03, t, 0.06, 800);
      break;

    case "attack":
      tone(200, "sawtooth", 0.1, t, 0.12, 0, 80);
      break;

    case "hit_taken":
      tone(150, "square", 0.08, t, 0.1, 0, 100);
      break;

    case "pickup":
      tone(440, "sine", 0.06, t, 0.1, 0.02);
      tone(660, "sine", 0.06, t + 0.07, 0.1, 0);
      break;

    case "level_up":
      tone(523, "sine", 0.1, t, 0.12, 0.06);       // C5
      tone(659, "sine", 0.1, t + 0.1, 0.12, 0.06);  // E5
      tone(784, "sine", 0.1, t + 0.2, 0.12, 0.06);  // G5
      tone(1047, "sine", 0.15, t + 0.3, 0.14, 0);   // C6
      break;

    case "death":
      tone(80, "sine", 1.2, t, 0.15, 0);
      tone(83, "sine", 1.2, t, 0.08, 0); // slight detune
      break;

    case "descend":
      tone(400, "sine", 0.3, t, 0.1, 0, 100);
      break;

    case "boss_intro":
      tone(60, "sawtooth", 0.8, t, 0.1, 0);
      tone(247, "sine", 0.6, t + 0.1, 0.08, 0); // B3
      tone(349, "sine", 0.6, t + 0.1, 0.08, 0); // F4 (tritone)
      break;

    case "door_open":
      noise(0.02, t, 0.08, 2000);
      tone(300, "sine", 0.05, t + 0.02, 0.08, 0);
      break;

    case "use_potion":
      tone(300, "sine", 0.05, t, 0.08, 0.02);
      tone(500, "sine", 0.05, t + 0.06, 0.08, 0.02);
      tone(700, "sine", 0.05, t + 0.12, 0.08, 0);
      break;

    case "use_scroll":
      tone(600, "sine", 0.08, t, 0.1, 0, 1200);
      noise(0.1, t + 0.05, 0.04, 3000);
      break;

    case "trap":
      tone(200, "square", 0.06, t, 0.12, 0);
      noise(0.04, t, 0.1, 1500);
      break;
  }
}
