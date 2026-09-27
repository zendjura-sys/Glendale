// Tiny synthesizer for demo tracks, so a fresh install has playable music without shipping audio files.

const RATE = 22050;
const NOTE = (n) => 440 * 2 ** ((n - 69) / 12); // MIDI note → Hz

/**
 * Renders a looped chord progression with a simple arpeggio on top as a 16-bit mono WAV.
 * `chords` are arrays of MIDI notes; every chord lasts one bar of 4 beats.
 */
export function renderWav({ chords, bpm = 96, bars = 16, wave = 'soft' }) {
  const beat = 60 / bpm;
  const seconds = bars * 4 * beat;
  const total = Math.floor(seconds * RATE);
  const data = new Float32Array(total);

  const tone = (freq, start, dur, gain) => {
    const s0 = Math.floor(start * RATE);
    const len = Math.floor(dur * RATE);
    for (let i = 0; i < len && s0 + i < total; i++) {
      const t = i / RATE;
      const env = Math.min(1, t / 0.02) * Math.exp(-t * (wave === 'pluck' ? 4 : 1.6));
      const ph = 2 * Math.PI * freq * t;
      const v = Math.sin(ph) + 0.35 * Math.sin(2 * ph) + 0.12 * Math.sin(3 * ph);
      data[s0 + i] += v * env * gain;
    }
  };

  for (let bar = 0; bar < bars; bar++) {
    const chord = chords[bar % chords.length];
    const t0 = bar * 4 * beat;
    // Pad: the whole chord, one octave down.
    for (const n of chord) tone(NOTE(n - 12), t0, 4 * beat, 0.12);
    // Bass on beats 1 and 3.
    tone(NOTE(chord[0] - 24), t0, 2 * beat, 0.25);
    tone(NOTE(chord[0] - 24), t0 + 2 * beat, 2 * beat, 0.2);
    // Arpeggio in eighth notes.
    const arp = [...chord, chord[1] + 12, chord[2], chord[1], chord[0] + 12, chord[2]];
    for (let k = 0; k < 8; k++) tone(NOTE(arp[k % arp.length]), t0 + (k * beat) / 2, beat, 0.14);
  }

  // Fade in/out and normalize.
  let peak = 0;
  for (let i = 0; i < total; i++) {
    const fade = Math.min(1, i / (RATE * 1.5), (total - i) / (RATE * 2.5));
    data[i] *= fade;
    peak = Math.max(peak, Math.abs(data[i]));
  }
  const scale = peak ? 0.85 / peak : 1;

  const buf = Buffer.alloc(44 + total * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + total * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(total * 2, 40);
  for (let i = 0; i < total; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, data[i] * scale)) * 32767), 44 + i * 2);
  return { buffer: buf, duration: seconds };
}

export const DEMO_TRACKS = [
  { title: 'Ранкове світло', artist: 'Glendale Sessions', album: 'Demo', chords: [[60, 64, 67], [57, 60, 64], [65, 69, 72], [67, 71, 74]], bpm: 92 },
  { title: 'Нічне місто', artist: 'Aurora Lane', album: 'Demo', chords: [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]], bpm: 84, wave: 'pluck' },
  { title: 'Літо в Одесі', artist: 'Sea Breeze', album: 'Demo', chords: [[62, 66, 69], [59, 62, 66], [55, 59, 62], [57, 61, 64]], bpm: 104 },
  { title: 'Карпати', artist: 'Glendale Sessions', album: 'Demo', chords: [[64, 67, 71], [60, 64, 67], [62, 65, 69], [59, 62, 67]], bpm: 76 },
];
