/**
 * Per-channel Web Audio API synth engine
 * Replaces Tone.js with native Web Audio for browser-generated sound.
 * Each channel can have its own synth preset + custom parameters.
 */

// ── Presets ────────────────────────────────────────────────

export const SYNTH_PRESETS = {
    // Basic waveforms
    sine:     { name: 'Sine',     category: 'Basic', waveform: 'sine',     attack: 0.01,  decay: 0.15, sustain: 0.4, release: 0.3, cutoff: 5000, resonance: 1 },
    triangle: { name: 'Triangle', category: 'Basic', waveform: 'triangle', attack: 0.01,  decay: 0.12, sustain: 0.5, release: 0.3, cutoff: 5000, resonance: 0.5 },
    square:   { name: 'Square',   category: 'Basic', waveform: 'square',   attack: 0.01,  decay: 0.15, sustain: 0.4, release: 0.2, cutoff: 2500, resonance: 1 },
    sawtooth: { name: 'Sawtooth', category: 'Basic', waveform: 'sawtooth', attack: 0.01,  decay: 0.12, sustain: 0.45,release: 0.25,cutoff: 2500, resonance: 1 },

    // Instruments
    pad:      { name: 'Pad',      category: 'Instrument', waveform: 'sawtooth', attack: 0.25, decay: 0.4,  sustain: 0.7, release: 0.8, cutoff: 1500, resonance: 2 },
    lead:     { name: 'Lead',     category: 'Instrument', waveform: 'square',   attack: 0.01, decay: 0.05, sustain: 0.8, release: 0.1, cutoff: 3500, resonance: 3 },
    bass:     { name: 'Bass',     category: 'Instrument', waveform: 'sawtooth', attack: 0.01, decay: 0.2,  sustain: 0.3, release: 0.1, cutoff: 800,  resonance: 4 },
    pluck:    { name: 'Pluck',    category: 'Instrument', waveform: 'triangle', attack: 0.001,decay: 0.25, sustain: 0.0, release: 0.1, cutoff: 3000, resonance: 1 },
    bell:     { name: 'Bell',     category: 'Instrument', waveform: 'sine',     attack: 0.001,decay: 0.6,  sustain: 0.0, release: 0.4, cutoff: 6000, resonance: 0.5 },
    organ:    { name: 'Organ',    category: 'Instrument', waveform: 'square',   attack: 0.005,decay: 0.01, sustain: 1.0, release: 0.01,cutoff: 5000, resonance: 0.5 },
    strings:  { name: 'Strings',  category: 'Instrument', waveform: 'sawtooth', attack: 0.15, decay: 0.3,  sustain: 0.7, release: 0.4, cutoff: 2500, resonance: 1 },

    // Percussion
    kick:     { name: 'Kick',     category: 'Percussion', isPercussion: true, percType: 'kick' },
    snare:    { name: 'Snare',    category: 'Percussion', isPercussion: true, percType: 'snare' },
    hihat:    { name: 'Hi-Hat',   category: 'Percussion', isPercussion: true, percType: 'hihat' },
    tom:      { name: 'Tom',      category: 'Percussion', isPercussion: true, percType: 'tom' },
    clap:     { name: 'Clap',     category: 'Percussion', isPercussion: true, percType: 'clap' },
    rim:      { name: 'Rimshot',  category: 'Percussion', isPercussion: true, percType: 'rim' },
};

export const DEFAULT_SYNTH = {
    waveform: 'sine',
    attack: 0.01,
    decay: 0.15,
    sustain: 0.4,
    release: 0.3,
    cutoff: 5000,
    resonance: 1,
};

/** Grouped preset keys for <optgroup> rendering */
export const PRESET_GROUPS = [
    { label: 'Basic',      keys: ['sine', 'triangle', 'square', 'sawtooth'] },
    { label: 'Instrument',  keys: ['pad', 'lead', 'bass', 'pluck', 'bell', 'organ', 'strings'] },
    { label: 'Percussion',  keys: ['kick', 'snare', 'hihat', 'tom', 'clap', 'rim'] },
];

/** Flat ordered list of all preset keys */
export const ALL_PRESET_KEYS = PRESET_GROUPS.flatMap(g => g.keys);

// ── Audio Context ──────────────────────────────────────────

let audioCtx = null;
let masterGain = null;
let compressor = null;
let limiter = null;
let initialized = false;
let initPending = null;

function getContext() {
    if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AC();
    }
    return audioCtx;
}

/** Resume AudioContext (call on user gesture) */
export async function resumeAudio() {
    const ctx = getContext();
    if (ctx.state === 'suspended') {
        try { await ctx.resume(); } catch (e) { /* ignore */ }
    }
}

/** Initialize the shared audio graph: compressor → limiter → destination */
export async function initAudio() {
    if (initialized) return;
    if (initPending) return initPending;

    initPending = (async () => {
        const ctx = getContext();
        await resumeAudio();

        // Limiter (DynamicsCompressor with aggressive settings as pseudo-limiter)
        limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -1;
        limiter.knee.value = 0;
        limiter.ratio.value = 20;
        limiter.attack.value = 0.001;
        limiter.release.value = 0.01;
        limiter.connect(ctx.destination);

        // Compressor
        compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -24;
        compressor.ratio.value = 4;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;
        compressor.knee.value = 10;
        compressor.connect(limiter);

        // Master gain
        masterGain = ctx.createGain();
        masterGain.gain.value = 0.8;
        masterGain.connect(compressor);

        initialized = true;
        console.log('Synth engine initialized (Web Audio API)');
    })();
    return initPending;
}

export function isReady() { return initialized; }

// ── MIDI → Frequency ───────────────────────────────────────

function midiToFreq(midiNote) {
    return 440 * Math.pow(2, (midiNote - 69) / 12);
}

// ── Tonal Note Playback ────────────────────────────────────

/**
 * Play a tonal note with the given synth configuration.
 * @param {number} midiNote   - MIDI note number (0-127)
 * @param {number} durationMs - Note duration in milliseconds
 * @param {number} velocity   - 0.0–1.0
 * @param {object} synthConfig - { waveform, attack, decay, sustain, release, cutoff, resonance }
 */
export function playTonalNote(midiNote, durationMs, velocity, synthConfig) {
    if (!initialized || !masterGain) return;
    const ctx = audioCtx;
    const now = ctx.currentTime;
    const freq = midiToFreq(midiNote);
    const cfg = synthConfig || DEFAULT_SYNTH;
    const vel = Math.max(0, Math.min(1, velocity));
    const durSec = Math.max(durationMs / 1000, 0.05);

    // Oscillator
    const osc = ctx.createOscillator();
    osc.type = cfg.waveform || 'sine';
    osc.frequency.setValueAtTime(freq, now);

    // Gain (ADSR envelope)
    const gain = ctx.createGain();
    const a = Math.max(0.001, cfg.attack || 0.01);
    const d = Math.max(0.001, cfg.decay || 0.1);
    const s = Math.max(0.001, cfg.sustain ?? 0.5);  // sustain level (use 0.001 min to avoid exponential ramp to 0)
    const r = Math.max(0.01, cfg.release || 0.3);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vel, now + a);
    gain.gain.linearRampToValueAtTime(vel * s, now + a + d);

    // Release starts at end of duration
    const releaseStart = now + durSec;
    gain.gain.setValueAtTime(vel * s, releaseStart);
    gain.gain.exponentialRampToValueAtTime(0.0001, releaseStart + r);

    // Filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cfg.cutoff || 5000, now);
    filter.Q.setValueAtTime(cfg.resonance || 1, now);

    // Connect: osc → gain → filter → master
    osc.connect(gain);
    gain.connect(filter);
    filter.connect(masterGain);

    osc.start(now);
    osc.stop(releaseStart + r + 0.05);

    // Cleanup
    const cleanupDelay = (durSec + r + 0.2) * 1000;
    setTimeout(() => {
        try { osc.disconnect(); gain.disconnect(); filter.disconnect(); } catch (e) { /* */ }
    }, cleanupDelay);
}

// ── Percussion Playback ────────────────────────────────────

/**
 * Create a white noise buffer source.
 */
function createNoiseSource(ctx, duration) {
    const bufferSize = Math.ceil(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    return source;
}

/**
 * Play a percussion sound.
 * @param {string} percType  - kick|snare|hihat|tom|clap|rim
 * @param {number} midiNote  - Used for pitch tuning (60 = center, higher = higher pitch)
 * @param {number} durationMs - Note duration hint (percussion ignores this mostly)
 * @param {number} velocity  - 0.0–1.0
 */
export function playPercussionNote(percType, midiNote, durationMs, velocity) {
    if (!initialized || !masterGain) return;
    const ctx = audioCtx;
    const now = ctx.currentTime;
    const vel = Math.max(0, Math.min(1, velocity));
    // Pitch offset: midi 60 = center, each semitone shifts pitch
    const pitchRatio = Math.pow(2, (midiNote - 60) / 24); // half-semitone sensitivity

    switch (percType) {
        case 'kick':   playKick(ctx, now, vel, pitchRatio); break;
        case 'snare':  playSnare(ctx, now, vel, pitchRatio); break;
        case 'hihat':  playHiHat(ctx, now, vel, pitchRatio); break;
        case 'tom':    playTom(ctx, now, vel, pitchRatio); break;
        case 'clap':   playClap(ctx, now, vel, pitchRatio); break;
        case 'rim':    playRim(ctx, now, vel, pitchRatio); break;
        default:       playKick(ctx, now, vel, pitchRatio); break;
    }
}

function playKick(ctx, now, vel, pitchRatio) {
    // Sine oscillator with rapid pitch sweep
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150 * pitchRatio, now);
    osc.frequency.exponentialRampToValueAtTime(40 * pitchRatio, now + 0.07);

    gain.gain.setValueAtTime(vel, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.4);
    setTimeout(() => { try { osc.disconnect(); gain.disconnect(); } catch(e){} }, 500);
}

function playSnare(ctx, now, vel, pitchRatio) {
    // Noise burst through bandpass
    const noise = createNoiseSource(ctx, 0.25);
    const noiseGain = ctx.createGain();
    const noiseFilt = ctx.createBiquadFilter();
    noiseFilt.type = 'bandpass';
    noiseFilt.frequency.value = 3000 * pitchRatio;
    noiseFilt.Q.value = 0.8;

    noiseGain.gain.setValueAtTime(vel * 0.7, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    noise.connect(noiseFilt);
    noiseFilt.connect(noiseGain);
    noiseGain.connect(masterGain);
    noise.start(now);
    noise.stop(now + 0.2);

    // Sine body
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180 * pitchRatio, now);
    osc.frequency.exponentialRampToValueAtTime(80 * pitchRatio, now + 0.04);

    oscGain.gain.setValueAtTime(vel * 0.6, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(oscGain);
    oscGain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.15);

    setTimeout(() => {
        try { noise.disconnect(); noiseFilt.disconnect(); noiseGain.disconnect(); osc.disconnect(); oscGain.disconnect(); } catch(e){}
    }, 400);
}

function playHiHat(ctx, now, vel, pitchRatio) {
    const noise = createNoiseSource(ctx, 0.12);
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000 * pitchRatio;
    filter.Q.value = 1;

    gain.gain.setValueAtTime(vel * 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    noise.start(now);
    noise.stop(now + 0.1);
    setTimeout(() => { try { noise.disconnect(); filter.disconnect(); gain.disconnect(); } catch(e){} }, 250);
}

function playTom(ctx, now, vel, pitchRatio) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200 * pitchRatio, now);
    osc.frequency.exponentialRampToValueAtTime(80 * pitchRatio, now + 0.08);

    gain.gain.setValueAtTime(vel * 0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.35);
    setTimeout(() => { try { osc.disconnect(); gain.disconnect(); } catch(e){} }, 450);
}

function playClap(ctx, now, vel, pitchRatio) {
    // Multi-burst filtered noise
    const bursts = [0, 0.015, 0.03];
    bursts.forEach((offset) => {
        const noise = createNoiseSource(ctx, 0.08);
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2500 * pitchRatio;
        filter.Q.value = 1.5;

        gain.gain.setValueAtTime(0.001, now + offset);
        gain.gain.linearRampToValueAtTime(vel * 0.5, now + offset + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.06);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);
        noise.start(now + offset);
        noise.stop(now + offset + 0.08);
        setTimeout(() => { try { noise.disconnect(); filter.disconnect(); gain.disconnect(); } catch(e){} }, 300);
    });
}

function playRim(ctx, now, vel, pitchRatio) {
    // Short high sine click
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800 * pitchRatio, now);

    gain.gain.setValueAtTime(vel * 0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.05);

    // Noise click
    const noise = createNoiseSource(ctx, 0.03);
    const nGain = ctx.createGain();
    const nFilt = ctx.createBiquadFilter();
    nFilt.type = 'highpass';
    nFilt.frequency.value = 4000 * pitchRatio;

    nGain.gain.setValueAtTime(vel * 0.3, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    noise.connect(nFilt);
    nFilt.connect(nGain);
    nGain.connect(masterGain);
    noise.start(now);
    noise.stop(now + 0.03);

    setTimeout(() => { try { osc.disconnect(); gain.disconnect(); noise.disconnect(); nFilt.disconnect(); nGain.disconnect(); } catch(e){} }, 200);
}

// ── Click Sound (UI feedback) ──────────────────────────────

export function playClick() {
    if (!initialized || !masterGain) return;
    const ctx = audioCtx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.05);
    setTimeout(() => { try { osc.disconnect(); gain.disconnect(); } catch(e){} }, 100);
}

// ── Cleanup ────────────────────────────────────────────────

export function disposeAudio() {
    if (masterGain) { try { masterGain.disconnect(); } catch(e){} masterGain = null; }
    if (compressor) { try { compressor.disconnect(); } catch(e){} compressor = null; }
    if (limiter) { try { limiter.disconnect(); } catch(e){} limiter = null; }
    if (audioCtx) { try { audioCtx.close(); } catch(e){} audioCtx = null; }
    initialized = false;
    initPending = null;
}
