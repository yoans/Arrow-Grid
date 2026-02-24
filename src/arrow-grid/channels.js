/**
 * Channel Definitions for Arrow Grid
 * 
 * Each arrow is assigned a channel (1-16).
 * When MIDI is enabled, notes are sent on the corresponding MIDI channel.
 * When MIDI is off, all channels play the same browser-generated sound.
 * Each channel has its own color, volume, and mute state.
 */

// Channel color definitions: [R, G, B]  (index 0 unused, channels are 1-based)
export const CHANNEL_COLORS = [
    [102, 126, 234],   // 0: fallback (not used as a channel)
    [102, 126, 234],   // 1: Blue
    [180, 100, 255],   // 2: Purple
    [57, 255, 120],    // 3: Green
    [255, 160, 40],    // 4: Orange
    [255, 60, 60],     // 5: Red
    [255, 240, 40],    // 6: Yellow
    [255, 50, 200],    // 7: Neon Pink
    [0, 200, 200],     // 8: Cyan
    [200, 200, 200],   // 9: Silver
    [255, 120, 120],   // 10: Salmon
    [120, 255, 200],   // 11: Mint
    [200, 140, 80],    // 12: Bronze
    [140, 180, 255],   // 13: Sky
    [220, 120, 255],   // 14: Lavender
    [255, 200, 100],   // 15: Gold
    [100, 255, 255],   // 16: Aqua
];

// CSS color class names matching each channel
export const CHANNEL_CSS_CLASSES = [
    'ch-blue',      // 0: fallback
    'ch-blue',      // 1
    'ch-purple',    // 2
    'ch-green',     // 3
    'ch-orange',    // 4
    'ch-red',       // 5
    'ch-yellow',    // 6
    'ch-pink',      // 7
    'ch-cyan',      // 8
    'ch-silver',    // 9
    'ch-salmon',    // 10
    'ch-mint',      // 11
    'ch-bronze',    // 12
    'ch-sky',       // 13
    'ch-lavender',  // 14
    'ch-gold',      // 15
    'ch-aqua',      // 16
];

// Human-readable channel labels
export const CHANNEL_LABELS = [
    'Ch 0',  'Ch 1',  'Ch 2',  'Ch 3',
    'Ch 4',  'Ch 5',  'Ch 6',  'Ch 7',
    'Ch 8',  'Ch 9',  'Ch 10', 'Ch 11',
    'Ch 12', 'Ch 13', 'Ch 14', 'Ch 15',
    'Ch 16',
];

import { DEFAULT_SYNTH } from './synth-engine';

// Default channel settings
export const DEFAULT_CHANNEL_SETTINGS = {
    volume: 1.0,        // 0.0–1.0
    midiChannel: null,   // MIDI channel (1-16), null = same as channel id
    muted: false,        // whether this channel is muted
    program: 0,          // MIDI program number (0-127), 0 = Acoustic Grand Piano
    synthPreset: 'sine', // key from SYNTH_PRESETS
    synth: { ...DEFAULT_SYNTH }, // per-channel synth parameters
    icon: 'piano',       // mnemonic icon key for quick visual reference
};

/**
 * Create settings for a new channel
 */
export const createChannelSettings = (channelId) => ({
    ...DEFAULT_CHANNEL_SETTINGS,
    synth: { ...DEFAULT_SYNTH },
    midiChannel: channelId,  // default MIDI channel = channel id
});

/**
 * Get color for a channel with alpha based on velocity
 */
export const getChannelColor = (channel, velocity) => {
    const v = velocity ?? 1.0;
    const alphaScale = 0.25 + 0.75 * v;
    const ch = channel ?? 1;
    const color = CHANNEL_COLORS[ch] || CHANNEL_COLORS[1];
    return [color[0], color[1], color[2], Math.round(200 * alphaScale)];
};

/**
 * Get preview color for a channel (semi-transparent)
 */
export const getChannelPreviewColor = (channel) => {
    const ch = channel ?? 1;
    const color = CHANNEL_COLORS[ch] || CHANNEL_COLORS[1];
    return [color[0], color[1], color[2], 60];
};

/**
 * Get particle color for a channel
 */
export const getChannelParticleColor = (channel) => {
    const ch = channel ?? 1;
    return CHANNEL_COLORS[ch] || CHANNEL_COLORS[1];
};

export const MAX_CHANNELS = 16;
