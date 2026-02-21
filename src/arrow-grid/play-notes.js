import * as Tone from 'tone';
import { makeMIDImessage } from './midi';
import { range } from 'ramda';

// Musical notes array (A0 to C8)
export const musicalNotes = range(0, 8).reduce((accum, curr) => {
    return accum.concat('a a# b c c# d d# e f f# g g#'.split(" ").map(char => {
        return `${char.toUpperCase()}${'a# b'.includes(char) ? curr : curr + 1}`;
    }));
}, []);

// Get note index based on arrow position
const getIndex = (x, y, size, vector) => {
    if (vector === 1 || vector === 3) {
        return y;
    } else if (vector === 0 || vector === 2) {
        return x;
    }
    return 0;
};

// ============================================
// AUDIO ENGINE - Tone.js with single synth for all channels
// ============================================

let audioInitialized = false;
let audioInitPending = null;
let synth = null;  // Single PolySynth for all browser audio
let filter = null;
let reverb = null;
let compressor = null;
let limiter = null;

// Initialize audio on first user interaction (required by browsers)
async function initAudio() {
    if (audioInitialized) return;
    if (audioInitPending) return audioInitPending;
    
    audioInitPending = (async () => {
        try {
            await Tone.start();
        } catch (e) {
            console.warn('Tone.start() failed (no user gesture yet):', e.message);
            audioInitPending = null;
            return;
        }
    
    // Limiter at the end to prevent ANY clipping (-1dB ceiling)
    limiter = new Tone.Limiter(-1).toDestination();
    
    // Compressor to tame dynamics and prevent sudden loud peaks
    compressor = new Tone.Compressor({
        threshold: -24,
        ratio: 4,
        attack: 0.003,
        release: 0.25,
        knee: 10
    }).connect(limiter);
    
    // Subtle reverb for warmth
    reverb = new Tone.Reverb({
        decay: 1.5,
        wet: 0.2,
        preDelay: 0.01
    }).connect(compressor);
    
    // Low-pass filter to smooth harshness
    filter = new Tone.Filter({
        frequency: 3000,
        type: 'lowpass',
        rolloff: -12,
        Q: 1
    }).connect(reverb);
    
    // Single synth for all browser-generated sound
    synth = new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 32,
        voice: Tone.Synth,
        options: {
            oscillator: {
                type: 'sine',
                partials: [1, 0.5, 0.25, 0.125]
            },
            envelope: {
                attack: 0.02,
                decay: 0.1,
                sustain: 0.3,
                release: 0.3
            },
            volume: -18
        }
    }).connect(filter);
    
    audioInitialized = true;
    console.log('Audio engine initialized (single synth)');
    })();
    return audioInitPending;
}

// Create a formatted note name for Tone.js
function getNoteName(noteIndex, scale, musicalKey) {
    const scaleNoteIndex = noteIndex % scale.length;
    const midiNote = musicalKey + scale[scaleNoteIndex];
    return Tone.Frequency(midiNote, 'midi').toNote();
}

export const makePizzaSound = (index, length, scale, musicalKey) => {
    return { noteIndex: index, length, scale, musicalKey };
};

// Play sounds for arrows that hit boundaries
// Each arrow carries a .channel property (1-7 = channel number)
// Muted channels make no sound. Otherwise play browser sound and/or send MIDI.
// channelSettings: { [channelId]: { volume, noteLength, midiChannel, muted } }
export const playSounds = async (boundaryArrows, size, length, soundOn, midiOn, scale, musicalKey, globalVelocity, channelSettings) => {
    const gVel = globalVelocity ?? 1.0;
    const chSettings = channelSettings || {};
    try {
    // Send MIDI messages if MIDI is enabled — each arrow on its own MIDI channel
    if (midiOn) {
        boundaryArrows.forEach((arrow) => {
            const ch = arrow.channel ?? 1;
            const settings = chSettings[ch] || {};
            if (settings.muted) return; // muted channel
            const midiChannel = settings.midiChannel || ch;
            const chVolume = settings.volume ?? 1.0;
            const chNoteLength = arrow.noteLength || settings.noteLength || length;
            const noteToPlay = getIndex(arrow.x, arrow.y, size, arrow.vector);
            const vel = (arrow.velocity ?? 1.0) * gVel * chVolume;
            makeMIDImessage(
                musicalKey + scale[noteToPlay % scale.length],
                chNoteLength,
                vel,
                midiChannel
            ).play();
        });
    }

    // Skip audio if sound is off
    if (!soundOn) return;
    
    // Initialize audio on first play
    if (!audioInitialized) {
        await initAudio();
    }
    
    if (!synth) return;

    // Collect all non-muted arrows for browser audio
    const notesToPlay = new Map();
    boundaryArrows.forEach((arrow) => {
        const ch = arrow.channel ?? 1;
        const settings = chSettings[ch] || {};
        if (settings.muted) return; // muted channel makes no sound
        const chVolume = settings.volume ?? 1.0;
        const chNoteLength = arrow.noteLength || settings.noteLength || length;
        const noteIndex = getIndex(arrow.x, arrow.y, size, arrow.vector);
        const key = `${noteIndex}-${chNoteLength}`;
        if (!notesToPlay.has(key)) {
            const noteName = getNoteName(noteIndex, scale, musicalKey);
            const vel = (arrow.velocity ?? 1.0) * gVel * chVolume;
            notesToPlay.set(key, { noteName, velocity: vel, duration: chNoteLength });
        }
    });

    if (notesToPlay.size > 0) {
        const durationSec = Math.max(length / 1000, 0.05);
        const now = Tone.now() + 0.01;
        const entries = Array.from(notesToPlay.values());
        entries.forEach((entry, i) => {
            const velocity = Math.min(0.7, entry.velocity * 0.9 / Math.sqrt(notesToPlay.size));
            const dur = Math.max(entry.duration / 1000, 0.05);
            const offset = i * 0.002;
            synth.triggerAttackRelease(entry.noteName, dur, now + offset, velocity);
        });
    }
    } catch (e) {
        console.warn('playSounds error:', e.message);
    }
};

// Cleanup function to dispose of audio resources
export const disposeAudio = () => {
    if (synth) { synth.dispose(); synth = null; }
    if (filter) { filter.dispose(); filter = null; }
    if (reverb) { reverb.dispose(); reverb = null; }
    if (compressor) { compressor.dispose(); compressor = null; }
    if (limiter) { limiter.dispose(); limiter = null; }
    audioInitialized = false;
};

// Export for external initialization (e.g., on first user click)
export const ensureAudioReady = initAudio;
