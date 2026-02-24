import { makeMIDImessage } from './midi';
import { SYNTH_PRESETS, initAudio, playTonalNote, playPercussionNote, disposeAudio as disposeSynthEngine, isReady } from './synth-engine';
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

// Play sounds for arrows that hit boundaries
// Each arrow carries a .channel property (1-16 = channel number)
// Muted channels make no sound. Otherwise play browser sound and/or send MIDI.
// channelSettings: { [channelId]: { volume, midiChannel, muted, synthPreset, synth } }
export const playSounds = async (boundaryArrows, size, length, soundOn, midiOn, scale, musicalKey, globalVelocity, channelSettings) => {
    const gVel = globalVelocity ?? 1.0;
    const chSettings = channelSettings || {};
    try {
    // Send MIDI messages if MIDI is enabled — each arrow on its own MIDI channel
    if (midiOn) {
        boundaryArrows.forEach((arrow) => {
            const ch = arrow.channel ?? 1;
            const settings = chSettings[ch] || {};
            if (settings.muted) return;
            const midiChannel = settings.midiChannel || ch;
            const chVolume = settings.volume ?? 1.0;
            const noteToPlay = getIndex(arrow.x, arrow.y, size, arrow.vector);
            const vel = (arrow.velocity ?? 1.0) * gVel * chVolume;
            makeMIDImessage(
                musicalKey + scale[noteToPlay % scale.length],
                length,
                vel,
                midiChannel
            ).play();
        });
    }

    // Skip audio if sound is off
    if (!soundOn) return;

    // Initialize audio on first play
    if (!isReady()) {
        await initAudio();
    }

    // Group arrows by channel so each channel's synth config is applied
    const channelNotes = new Map(); // channelId → Map<noteIndex, { midiNote, velocity }>
    boundaryArrows.forEach((arrow) => {
        const ch = arrow.channel ?? 1;
        const settings = chSettings[ch] || {};
        if (settings.muted) return;
        const chVolume = settings.volume ?? 1.0;
        const noteIndex = getIndex(arrow.x, arrow.y, size, arrow.vector);
        const midiNote = musicalKey + scale[noteIndex % scale.length];
        const vel = (arrow.velocity ?? 1.0) * gVel * chVolume;

        if (!channelNotes.has(ch)) channelNotes.set(ch, new Map());
        const notes = channelNotes.get(ch);
        if (!notes.has(noteIndex)) {
            notes.set(noteIndex, { midiNote, velocity: vel });
        }
    });

    // Count total notes for volume normalization
    let totalNotes = 0;
    channelNotes.forEach(notes => totalNotes += notes.size);

    // Play each channel's notes with its own synth config
    channelNotes.forEach((notes, ch) => {
        const settings = chSettings[ch] || {};
        const presetKey = settings.synthPreset || 'sine';
        const preset = SYNTH_PRESETS[presetKey];
        const isPerc = preset && preset.isPercussion;

        notes.forEach((entry, noteIndex) => {
            // Normalize velocity to prevent clipping with many simultaneous notes
            const velocity = Math.min(0.7, entry.velocity * 0.9 / Math.sqrt(totalNotes));

            if (isPerc) {
                playPercussionNote(preset.percType, entry.midiNote, length, velocity);
            } else {
                // Use per-channel custom synth params
                const synthConfig = settings.synth || preset || {};
                playTonalNote(entry.midiNote, length, velocity, synthConfig);
            }
        });
    });

    } catch (e) {
        console.warn('playSounds error:', e.message);
    }
};

// Cleanup function to dispose of audio resources
export const disposeAudio = () => {
    disposeSynthEngine();
};

// Export for external initialization (e.g., on first user click)
export const ensureAudioReady = initAudio;
