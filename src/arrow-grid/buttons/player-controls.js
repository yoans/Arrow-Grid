import React from 'react';

export const PlayButton = ({ onClick, isEnabled }) => (
    <button
        className="PlayButton isEnabled"
        onClick={onClick}
        disabled={!isEnabled}
        title="Play (Space)"
    >
        <svg viewBox="0 0 20 20" width="20" height="20">
            <polygon points="5,3 17,10 5,17" fill="white" />
        </svg>
    </button>
);

export const PauseButton = ({ onClick }) => (
    <button
        className="PauseButton isEnabled"
        onClick={onClick}
        title="Pause (Space)"
    >
        <svg viewBox="0 0 20 20" width="20" height="20">
            <rect x="4" y="3" width="4" height="14" fill="white" />
            <rect x="12" y="3" width="4" height="14" fill="white" />
        </svg>
    </button>
);

export const MuteToggleButton = ({ isMuted, onMuteChange, isEnabled }) => (
    <button
        className={isMuted ? "SoundOffButton isEnabled" : "SoundOnButton isEnabled"}
        onClick={onMuteChange}
        disabled={!isEnabled}
        title={isMuted ? "Turn Sound On (M)" : "Mute (M)"}
    >
        <svg viewBox="0 0 20 20" width="20" height="20">
            {isMuted ? (
                <>
                    <polygon points="2,7 6,7 11,3 11,17 6,13 2,13" fill="white" />
                    <line x1="14" y1="7" x2="18" y2="13" stroke="white" strokeWidth="2" />
                    <line x1="18" y1="7" x2="14" y2="13" stroke="white" strokeWidth="2" />
                </>
            ) : (
                <>
                    <polygon points="2,7 6,7 11,3 11,17 6,13 2,13" fill="white" />
                    <path d="M14,6 Q18,10 14,14" stroke="white" strokeWidth="2" fill="none" />
                </>
            )}
        </svg>
    </button>
);

export const PrevButton = ({ onClick, isEnabled }) => (
    <button
        className="PrevButton isEnabled"
        onClick={onClick}
        disabled={!isEnabled}
        title="Previous Preset (Left Arrow)"
    >
        <svg viewBox="0 0 20 20" width="20" height="20">
            <rect x="3" y="4" width="3" height="12" fill="white" />
            <polygon points="17,4 7,10 17,16" fill="white" />
        </svg>
    </button>
);

export const NextButton = ({ onClick, isEnabled }) => (
    <button
        className="NextButton isEnabled"
        onClick={onClick}
        disabled={!isEnabled}
        title="Next Preset (Right Arrow)"
    >
        <svg viewBox="0 0 20 20" width="20" height="20">
            <polygon points="3,4 13,10 3,16" fill="white" />
            <rect x="14" y="4" width="3" height="12" fill="white" />
        </svg>
    </button>
);
