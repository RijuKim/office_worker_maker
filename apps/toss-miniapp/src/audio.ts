export type AudioSettings = {
  music: boolean;
  sfx: boolean;
  haptics: boolean;
};

type Cue = "tap" | "success" | "warning" | "ending";

let bgm: HTMLAudioElement | null = null;
let audioContext: AudioContext | null = null;

function getAudioContext() {
  try {
    audioContext ??= new AudioContext();
    if (audioContext.state === "suspended") {
      void Promise.resolve(audioContext.resume()).catch(() => undefined);
    }
    return audioContext;
  } catch {
    audioContext = null;
    return null;
  }
}

export function playCue(cue: Cue, enabled: boolean) {
  if (!enabled) return;
  try {
    const context = getAudioContext();
    if (!context) return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const presets: Record<Cue, { frequency: number; duration: number; type: OscillatorType }> = {
      tap: { frequency: 520, duration: 0.055, type: "square" },
      success: { frequency: 740, duration: 0.12, type: "triangle" },
      warning: { frequency: 220, duration: 0.16, type: "sawtooth" },
      ending: { frequency: 880, duration: 0.28, type: "triangle" },
    };
    const preset = presets[cue];
    oscillator.frequency.setValueAtTime(preset.frequency, now);
    oscillator.type = preset.type;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + preset.duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + preset.duration + 0.01);
  } catch {
    // Sound is optional: unsupported or partially implemented Web Audio must not block play.
  }
}

export function vibrate(enabled: boolean, pattern: number | number[] = 12) {
  if (!enabled) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Haptics are an optional enhancement.
  }
}

export async function startBgm(enabled: boolean) {
  if (!enabled) return;
  try {
    bgm ??= new Audio("/bgm.mp3");
    bgm.loop = true;
    bgm.volume = 0.36;
    await Promise.resolve(bgm.play()).catch(() => undefined);
  } catch {
    bgm = null;
  }
}

export function stopBgm() {
  if (!bgm) return;
  try {
    bgm.pause();
    bgm.currentTime = 0;
  } catch {
    bgm = null;
  }
}
