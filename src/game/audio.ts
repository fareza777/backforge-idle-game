import type { GameSettings } from './types';

export type SoundName =
  | 'click'
  | 'hammer'
  | 'merge'
  | 'sword'
  | 'bow'
  | 'hit'
  | 'coin'
  | 'victory'
  | 'error'
  | 'crit'
  | 'overdrive'
  | 'smelt'
  | 'shield';

type AudioContextConstructor = typeof AudioContext;

export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private ambienceSource: AudioBufferSourceNode | null = null;
  private ambienceTimer: ReturnType<typeof setInterval> | null = null;
  private settings: GameSettings;
  private lastPlayed = new Map<SoundName, number>();

  constructor(settings: GameSettings) {
    this.settings = settings;
  }

  updateSettings(settings: GameSettings): void {
    this.settings = settings;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(settings.sfx ? settings.sfxVolume : 0, this.context.currentTime, 0.03);
    }
    if (this.ambienceGain && this.context) {
      this.ambienceGain.gain.setTargetAtTime(settings.ambience ? settings.ambienceVolume * 0.22 : 0, this.context.currentTime, 0.08);
    }
    if (settings.ambience) this.startAmbience();
    else this.stopAmbience();
  }

  unlock(): void {
    if (!this.context) {
      const Constructor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
      if (!Constructor) return;
      this.context = new Constructor();
      this.master = this.context.createGain();
      this.master.gain.value = this.settings.sfx ? this.settings.sfxVolume : 0;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') void this.context.resume();
    if (this.settings.ambience) this.startAmbience();
  }

  play(name: SoundName): void {
    if (!this.settings.sfx || this.settings.sfxVolume <= 0) return;
    this.unlock();
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const last = this.lastPlayed.get(name) ?? -10;
    const throttle = name === 'hit' || name === 'sword' || name === 'crit' ? 0.065 : 0.025;
    if (now - last < throttle) return;
    this.lastPlayed.set(name, now);

    if (name === 'hammer') {
      this.noise(now, 0.12, 520, 0.34);
      this.tone(now, 92, 0.16, 0.28, 'sine');
    } else if (name === 'crit') {
      this.tone(now, 880, 0.12, 0.16, 'triangle');
      this.tone(now + 0.02, 1320, 0.18, 0.12, 'sine');
      this.noise(now, 0.06, 3200, 0.12, 'highpass');
    } else if (name === 'overdrive') {
      this.noise(now, 0.28, 650, 0.36, 'lowpass');
      this.tone(now + 0.04, 72, 0.34, 0.36, 'sine');
      this.tone(now + 0.06, 520, 0.28, 0.22, 'triangle');
      this.tone(now + 0.1, 780, 0.32, 0.16, 'sine');
    } else if (name === 'smelt') {
      this.noise(now, 0.16, 2200, 0.18, 'bandpass');
      this.tone(now + 0.05, 987.77, 0.14, 0.12, 'sine');
      this.tone(now + 0.12, 1318.5, 0.18, 0.12, 'sine');
    } else if (name === 'shield') {
      this.noise(now, 0.08, 420, 0.22);
      this.tone(now, 165, 0.1, 0.16, 'triangle');
    } else if (name === 'merge') {
      [523.25, 659.25, 783.99].forEach((frequency, index) => this.tone(now + index * 0.065, frequency, 0.34, 0.18, 'sine'));
      this.noise(now, 0.08, 2600, 0.1);
    } else if (name === 'sword') {
      this.noise(now, 0.13, 1800, 0.2, 'highpass');
      this.tone(now + 0.015, 240, 0.09, 0.08, 'triangle');
    } else if (name === 'bow') {
      this.noise(now, 0.055, 900, 0.13, 'bandpass');
      this.tone(now, 420, 0.07, 0.07, 'triangle');
    } else if (name === 'hit') {
      this.noise(now, 0.075, 260, 0.2);
      this.tone(now, 110, 0.08, 0.11, 'sine');
    } else if (name === 'coin') {
      this.tone(now, 1046.5, 0.12, 0.13, 'sine');
      this.tone(now + 0.055, 1318.5, 0.16, 0.1, 'sine');
    } else if (name === 'victory') {
      [392, 523.25, 659.25, 783.99].forEach((frequency, index) => this.tone(now + index * 0.085, frequency, 0.42, 0.14, 'sine'));
    } else if (name === 'error') {
      this.tone(now, 180, 0.16, 0.1, 'triangle');
      this.tone(now + 0.08, 145, 0.18, 0.08, 'triangle');
    } else {
      this.tone(now, 540, 0.045, 0.055, 'sine');
    }
  }

  private tone(start: number, frequency: number, duration: number, volume: number, type: OscillatorType): void {
    if (!this.context || !this.master) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private noise(start: number, duration: number, frequency: number, volume: number, type: BiquadFilterType = 'lowpass'): void {
    if (!this.context || !this.master) return;
    const length = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = buffer;
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, start);
    filter.Q.value = type === 'bandpass' ? 0.8 : 0.4;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(start);
    source.stop(start + duration + 0.01);
  }

  startAmbience(): void {
    if (!this.settings.ambience || this.ambienceSource || !this.context) return;
    const duration = 4;
    const buffer = this.context.createBuffer(1, this.context.sampleRate * duration, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < data.length; index += 1) {
      const white = Math.random() * 2 - 1;
      previous = (previous + 0.02 * white) / 1.02;
      // Subtle hearth crackle pops mixed with warm wind
      const crackle = Math.random() < 0.00035 ? (Math.random() - 0.5) * 0.85 : 0;
      data[index] = previous * 3.1 + crackle;
    }
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = true;
    filter.type = 'lowpass';
    filter.frequency.value = 760;
    gain.gain.value = this.settings.ambienceVolume * 0.22;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.context.destination);
    source.start();
    this.ambienceSource = source;
    this.ambienceGain = gain;
    this.ambienceTimer = setInterval(() => this.birdCall(), 9500);
  }

  private birdCall(): void {
    if (!this.settings.ambience || !this.context || document.hidden) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1450, now);
    oscillator.frequency.exponentialRampToValueAtTime(2150, now + 0.08);
    oscillator.frequency.exponentialRampToValueAtTime(1650, now + 0.18);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(this.settings.ambienceVolume * 0.035, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    oscillator.connect(gain);
    gain.connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.24);
  }

  stopAmbience(): void {
    if (this.ambienceTimer) clearInterval(this.ambienceTimer);
    this.ambienceTimer = null;
    this.ambienceSource?.stop();
    this.ambienceSource = null;
    this.ambienceGain = null;
  }

  dispose(): void {
    this.stopAmbience();
    if (this.context) void this.context.close();
    this.context = null;
    this.master = null;
  }
}
