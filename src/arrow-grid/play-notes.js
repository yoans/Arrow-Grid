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
// AUDIO ENGINE - Tone.js with proper gain staging
// ============================================

let audioInitialized = false;
let audioInitPending = null;
let synth = null;
let filter = null;
let reverb = null;
let compressor = null;
let limiter = null;

// Initialize audio on first user interaction (required by browsers)
async function initAudio() {
    if (audioInitialized) return;
    // Prevent multiple concurrent init attempts
    if (audioInitPending) return audioInitPending;
    
    audioInitPending = (async () => {
        try {
            await Tone.start();
        } catch (e) {
            console.warn('Tone.start() failed (no user gesture yet):', e.message);
            audioInitPending = null;
            return; // bail out — will retry on next call
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
    
    // PolySynth for multiple simultaneous notes
    // With 4000 max arrows, we need more voices - 64 handles most cases
    synth = new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 64,
        voice: Tone.Synth,
        options: {
            oscillator: {
                type: 'sine',
                partials: [1, 0.5, 0.25, 0.125] // Warm harmonic content
            },
            envelope: {
                attack: 0.02,   // 20ms attack prevents clicks
                decay: 0.1,
                sustain: 0.3,
                release: 0.3    // Slightly shorter release to free voices faster
            },
            volume: -18        // More headroom for more voices
        }
    }).connect(filter);
    
    audioInitialized = true;
    console.log('Audio engine initialized');
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
    // Return a simple object for compatibility
    return { noteIndex: index, length, scale, musicalKey };
};

// Play sounds for arrows that hit boundaries
export const playSounds = async (boundaryArrows, size, length, muted, scale, musicalKey) => {
    try {
    // When muted, only send MIDI (no audio init needed)
    if (muted) {
        boundaryArrows.forEach((arrow) => {
            const noteToPlay = getIndex(arrow.x, arrow.y, size, arrow.vector);
            makeMIDImessage(musicalKey + scale[noteToPlay % scale.length], length).play();
        });
        return;
    }
    
    // Initialize audio on first unmuted play
    if (!audioInitialized) {
        await initAudio();
    }
    
    if (!synth) return;
    
    // Collect unique notes to play (avoid duplicates)
    const notesToPlay = new Map();
    
    boundaryArrows.forEach((arrow) => {
        const noteIndex = getIndex(arrow.x, arrow.y, size, arrow.vector);
        if (!notesToPlay.has(noteIndex)) {
            const noteName = getNoteName(noteIndex, scale, musicalKey);
            notesToPlay.set(noteIndex, noteName);
            
            // Send MIDI message
            makeMIDImessage(musicalKey + scale[noteIndex % scale.length], length).play();
        }
    });
    
    // Play all notes with Tone.js
    if (notesToPlay.size > 0) {
        const notes = Array.from(notesToPlay.values());
        const durationSec = Math.max(length / 1000, 0.05); // Min 50ms, convert to seconds
        
        // Adjust velocity based on number of simultaneous notes to prevent clipping
        const velocity = Math.min(0.7, 0.9 / Math.sqrt(notesToPlay.size));
        
        // Schedule slightly in the future to avoid audio glitches
        const now = Tone.now() + 0.01;
        
        notes.forEach((note, i) => {
            // Slight spread to make notes more organic
            const offset = i * 0.002;
            synth.triggerAttackRelease(note, durationSec, now + offset, velocity);
        });
    }
    } catch (e) {
        // Swallow audio errors — don't let them become unhandled rejections
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
