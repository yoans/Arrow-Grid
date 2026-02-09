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
const synths = {};  // One PolySynth per oscillator type
let filter = null;
let reverb = null;
let compressor = null;
let limiter = null;

const OSCILLATOR_TYPES = ['sine', 'square', 'sawtooth'];

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
    
    // Create a separate PolySynth for each oscillator type
    for (const oscType of OSCILLATOR_TYPES) {
        synths[oscType] = new Tone.PolySynth(Tone.Synth, {
            maxPolyphony: 32,
            voice: Tone.Synth,
            options: {
                oscillator: {
                    type: oscType,
                    ...(oscType === 'sine' ? { partials: [1, 0.5, 0.25, 0.125] } : {})
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
    }
    
    audioInitialized = true;
    console.log('Audio engine initialized (3 synths)');
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
// Each arrow carries its own .sound property ('sine', 'square', 'sawtooth', or null)
// null = blue/silent arrows — they make no sound
export const playSounds = async (boundaryArrows, size, length, muted, scale, musicalKey) => {
    try {
    // When muted, only send MIDI (no audio init needed)
    if (muted) {
        boundaryArrows.forEach((arrow) => {
            if (!arrow.sound) return; // silent arrows skip MIDI too
            const noteToPlay = getIndex(arrow.x, arrow.y, size, arrow.vector);
            makeMIDImessage(musicalKey + scale[noteToPlay % scale.length], length).play();
        });
        return;
    }
    
    // Initialize audio on first unmuted play
    if (!audioInitialized) {
        await initAudio();
    }
    
    if (Object.keys(synths).length === 0) return;

    // Group arrows by sound type, skip null/silent (blue) arrows
    const soundGroups = new Map();
    boundaryArrows.forEach((arrow) => {
        if (!arrow.sound) return; // blue arrows are silent
        const sType = arrow.sound;
        if (!soundGroups.has(sType)) soundGroups.set(sType, []);
        soundGroups.get(sType).push(arrow);
    });

    const durationSec = Math.max(length / 1000, 0.05);
    const now = Tone.now() + 0.01;

    // Play each sound group on its own dedicated synth — true harmony
    for (const [sType, arrows] of soundGroups) {
        const s = synths[sType];
        if (!s) continue;

        // Collect unique notes for this group
        const notesToPlay = new Map();
        arrows.forEach((arrow) => {
            const noteIndex = getIndex(arrow.x, arrow.y, size, arrow.vector);
            if (!notesToPlay.has(noteIndex)) {
                const noteName = getNoteName(noteIndex, scale, musicalKey);
                notesToPlay.set(noteIndex, noteName);
                makeMIDImessage(musicalKey + scale[noteIndex % scale.length], length).play();
            }
        });

        if (notesToPlay.size > 0) {
            const notes = Array.from(notesToPlay.values());
            const velocity = Math.min(0.7, 0.9 / Math.sqrt(notesToPlay.size));
            notes.forEach((note, i) => {
                const offset = i * 0.002;
                s.triggerAttackRelease(note, durationSec, now + offset, velocity);
            });
        }
    }
    } catch (e) {
        // Swallow audio errors — don't let them become unhandled rejections
        console.warn('playSounds error:', e.message);
    }
};

// Cleanup function to dispose of audio resources
export const disposeAudio = () => {
    for (const key of Object.keys(synths)) {
        synths[key].dispose();
        delete synths[key];
    }
    if (filter) { filter.dispose(); filter = null; }
    if (reverb) { reverb.dispose(); reverb = null; }
    if (compressor) { compressor.dispose(); compressor = null; }
    if (limiter) { limiter.dispose(); limiter = null; }
    audioInitialized = false;
};

// Export for external initialization (e.g., on first user click)
export const ensureAudioReady = initAudio;
