// Web Audio effects adapted from the original domino-demo intro.
export function createFilmSound() {
  const context = new AudioContext();
  let noiseBuffer: AudioBuffer | null = null;

  function noise() {
    if (!noiseBuffer) {
      noiseBuffer = context.createBuffer(1, Math.floor(context.sampleRate * 0.2), context.sampleRate);
      const samples = noiseBuffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
  }

  function tone(start: number, end: number, duration: number, volume: number, type: OscillatorType = 'triangle') {
    if (context.state !== 'running') return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(start, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, end), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  }

  function tick(volume: number, frequency: number) {
    if (context.state !== 'running') return;
    const now = context.currentTime;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = noise();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 1.1;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    source.connect(filter).connect(gain).connect(context.destination);
    source.start(now);
    source.stop(now + 0.07);
  }

  return {
    unlock: () => context.resume(),
    click: (pitch = 1) => { tick(0.45, 2200 * pitch); tone(430 * pitch, 150 * pitch, 0.07, 0.12); },
    thud: () => { tone(120, 36, 0.38, 0.5, 'sine'); tick(0.7, 260); },
    stop: () => { void context.close(); },
  };
}
