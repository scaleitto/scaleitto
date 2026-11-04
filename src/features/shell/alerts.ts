// New-order alerts on this device (Zimam: "Device push notifications" + "Notification sounds"): the sound and volume are
// kept in this browser only. Sounds are drawn with the Web Audio API (no audio files to host).
export const alertSounds = ["chime", "cash", "softChime", "beep", "blip", "pop", "marimba", "none"] as const;
export type AlertSound = (typeof alertSounds)[number];
export type AlertPrefs = { sound: AlertSound; volume: number };

const KEY = "sc_alerts";
export const defaultPrefs: AlertPrefs = { sound: "chime", volume: 0.5 };

export function readPrefs(): AlertPrefs {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<AlertPrefs>;
    return {
      sound: (alertSounds as readonly string[]).includes(p.sound as string) ? (p.sound as AlertSound) : defaultPrefs.sound,
      volume: typeof p.volume === "number" && p.volume >= 0 && p.volume <= 1 ? p.volume : defaultPrefs.volume,
    };
  } catch {
    return defaultPrefs;
  }
}

export function writePrefs(p: AlertPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // private mode: the defaults are used
  }
}

// [frequency Hz, start s, length s, wave, end frequency]
type Note = [number, number, number, OscillatorType, number?];
const tunes: Record<Exclude<AlertSound, "none">, Note[]> = {
  chime: [[880, 0, 0.35, "sine"], [1320, 0.15, 0.5, "sine"]],
  cash: [[1318, 0, 0.12, "triangle"], [1568, 0.08, 0.12, "triangle"], [2093, 0.16, 0.35, "triangle"]],
  softChime: [[660, 0, 0.5, "sine"], [990, 0.2, 0.6, "sine"]],
  beep: [[1000, 0, 0.15, "square"], [1000, 0.22, 0.15, "square"]],
  blip: [[1500, 0, 0.08, "sine"]],
  pop: [[600, 0, 0.12, "sine", 180]],
  marimba: [[523, 0, 0.3, "sine"], [784, 0.12, 0.3, "sine"], [1046, 0.24, 0.45, "sine"]],
};

let ctx: AudioContext | null = null;
export function playSound(sound: AlertSound, volume: number) {
  if (sound === "none" || volume <= 0 || typeof window === "undefined") return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    for (const [freq, at, len, wave, to] of tunes[sound]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, now + at);
      if (to) osc.frequency.exponentialRampToValueAtTime(to, now + at + len);
      // Square waves are loud: keep them lower
      const peak = volume * (wave === "square" ? 0.12 : 0.35);
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(peak, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + len);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + at);
      osc.stop(now + at + len + 0.05);
    }
  } catch {
    // no audio on this device
  }
}
