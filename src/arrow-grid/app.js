import React from 'react';
import '../App.css';
import {range} from 'ramda';
import * as Tone from 'tone';
import {
    musicalNotes
} from './play-notes';
import {
    emptyGrid,
    newGrid,
    nextGrid as nextGridLogic,
    removeFromGrid,
    addToGrid
} from './arrows-logic-optimized';  // 🚀 Using optimized implementation
import {
    updateCanvas,
    setUpCanvas,
    getAdderWithMousePosition,
    setWallToggler,
    setWallPlacer,
    setWallRemover,
    resizeGridCanvas,
    getGridCanvasSize
} from './animations';
// sliders.js is no longer used (popup-trigger buttons replaced DOM sliders)
import { rescanMIDI, midiUtils, onMidiConnected } from './midi';
import presets from './presets';
import Chance from 'chance';
import scales, { scaleGroups } from './scales';
import { CHANNEL_LABELS, CHANNEL_CSS_CLASSES, CHANNEL_COLORS, MAX_CHANNELS, createChannelSettings } from './channels';

const chance = new Chance();

const maxSize = 20;
const minSize = 2;
const minNoteLength = -500;
const maxNoteLength = -50;


// Simple click sound using Tone.js
let clickSynth = null;
const getClickSynth = () => {
    if (!clickSynth) {
        clickSynth = new Tone.Synth({
            oscillator: { type: 'sine' },
            envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
            volume: -20
        }).toDestination();
    }
    return clickSynth;
};

const sound = {
    async play() {
        try {
            if (Tone.context.state !== 'running') {
                await Tone.start();
            }
            getClickSynth().triggerAttackRelease('C5', 0.02);
        } catch (e) {
            // Ignore audio errors
        }
    }
};

export class Application extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            currentPreset: 0,  // Start at first preset
            presets,
            inputDirection: 0,
            noteLength: props.noteLength || 350,
            grid: presets[0] || newGrid(8, 6),  // Start with first preset
            playing: false,
            soundOn: true,
            midiOn: false,
            deleting: false,
            drawMode: 'arrow',  // 'arrow' or 'wall'
            wallSides: new Set(),  // multi-select: 'top','bottom','left','right'
            wallClosest: true,     // 'closest' mode (mutually exclusive with sides)
            horizontalSymmetry: false,
            verticalSymmetry: false,
            backwardDiagonalSymmetry: false,
            forwardDiagonalSymmetry: false,
            arrowRotationStep: 0,  // cumulative rotation counter for smooth animation
            inputNumber: 1,
            scale: scales[0].value,
            musicalKey: 60,
            arrowChannel: 1,   // 1-7 = channel number
            activeChannels: MAX_CHANNELS,  // all channels always visible
            activePopup: null,  // which popup is open: null, 'speed', 'gridSize', or channel number
            channelSettings: {  // per-channel settings
                1: createChannelSettings(1),
                2: createChannelSettings(2),
                3: createChannelSettings(3),
                4: createChannelSettings(4),
                5: createChannelSettings(5),
                6: createChannelSettings(6),
                7: createChannelSettings(7),
                8: createChannelSettings(8),
                9: createChannelSettings(9),
                10: createChannelSettings(10),
                11: createChannelSettings(11),
                12: createChannelSettings(12),
                13: createChannelSettings(13),
                14: createChannelSettings(14),
                15: createChannelSettings(15),
                16: createChannelSettings(16),
            },
            inputVelocity: 1.0,  // 0.0–1.0 per-arrow velocity
            globalVelocity: 1.0, // 0.0–1.0 master velocity multiplier

            gridStep: 0,
            showCollisions: true,
            showIntro: !localStorage.getItem('arrowgrid-seen'),
            undoStack: [],
        };
    }

    componentDidMount() {
        // Compute initial canvas size before setup
        this._computeCanvasSize();

        // Set up canvas after component is mounted (DOM is ready)
        setUpCanvas(this.state);
        
        getAdderWithMousePosition(this.addToGrid)();
        setWallToggler(this.toggleWall);
        setWallPlacer(this.addWallAtCell);
        setWallRemover(this.removeWall);
        
        // Add keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyDown);
        
        // Click outside to close volume popup
        document.addEventListener('mousedown', this._closeVolumePopup);
        
        // Add resize listener for responsive canvas
        window.addEventListener('resize', this._handleResize);
        
        // Initialize MIDI on startup
        midiUtils();
        
        // Auto-enable MIDI when a device is connected
        onMidiConnected(() => {
            this.setState({ midiOn: true, soundOn: true });
        });
        
        // Auto-play after a short delay to show users what the app does
        setTimeout(() => this.play(), 500);
    }
    
    componentDidUpdate() {
        updateCanvas(this.state, new Date());
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('mousedown', this._closeVolumePopup);
        window.removeEventListener('resize', this._handleResize);
        clearTimeout(this._timerID);
        clearTimeout(this._resizeTimer);
    }

    _resizeTimer = null;

    _closeVolumePopup = (e) => {
        if (this.state.activePopup !== null && !e.target.closest('.popup-trigger-wrap')) {
            this.setState({ activePopup: null });
        }
    };

    _computeCanvasSize = () => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const isPortrait = vh > vw || vw <= 860;

        let canvasSize;
        if (isPortrait) {
            // Portrait: canvas width = viewport width minus padding/margins
            const padding = 40; // wrapper padding + borders
            canvasSize = Math.min(vw - padding, vh * 0.6);
        } else {
            // Landscape: canvas height = viewport height minus header/footer/padding
            const chrome = 220; // header + footer + gaps + wrapper padding
            const sidePanelWidth = 130 * 2 + 40 + 48; // both panels + gaps + wrapper padding
            canvasSize = Math.min(vh - chrome, vw - sidePanelWidth);
        }

        // Clamp to reasonable range
        canvasSize = Math.max(200, Math.min(Math.floor(canvasSize), 800));
        resizeGridCanvas(canvasSize);
    }

    _handleResize = () => {
        clearTimeout(this._resizeTimer);
        this._resizeTimer = setTimeout(() => {
            this._computeCanvasSize();
            this.forceUpdate();
        }, 100);
    }
    
    handleKeyDown = (e) => {
        // Don't trigger shortcuts when typing in inputs
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        
        switch (e.code) {
            case 'Space':
                e.preventDefault();
                this.state.playing ? this.pause() : this.play();
                break;
            case 'KeyM':
                this.muteToggle();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.prevPreset();
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.nextPreset();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.newInputDirection((this.state.inputDirection + 3) % 4, -1);
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.newInputDirection((this.state.inputDirection + 1) % 4, 1);
                break;
            case 'Digit1':
                this.setState({ inputNumber: 1 });
                break;
            case 'Digit2':
                this.setState({ inputNumber: 2 });
                break;
            case 'Digit3':
                this.setState({ inputNumber: 3 });
                break;
            case 'Digit4':
                this.setState({ inputNumber: 4 });
                break;
            case 'Delete':
            case 'Backspace':
                if (!e.target.tagName.match(/INPUT|TEXTAREA/)) {
                    e.preventDefault();
                    this.emptyGrid();
                }
                break;
            case 'KeyE':
                this.changeEditMode();
                break;
            case 'KeyW':
                this.setState({ deleting: false, drawMode: this.state.drawMode === 'wall' ? 'arrow' : 'wall', wallSides: new Set(), wallClosest: true });
                break;
            case 'KeyZ':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.undo();
                }
                break;
            case 'KeyS':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.saveToLocalStorage();
                }
                break;
            default:
                break;
        }
    }

    // ── Undo ──
    _pushUndo = () => {
        const snapshot = JSON.stringify(this.state.grid);
        const stack = [...this.state.undoStack, snapshot].slice(-30); // keep last 30
        this.setState({ undoStack: stack });
    }
    undo = () => {
        if (this.state.undoStack.length === 0) return;
        const stack = [...this.state.undoStack];
        const prev = stack.pop();
        this.setState({ grid: JSON.parse(prev), undoStack: stack });
    }

    // ── Save / Load ──
    saveToLocalStorage = () => {
        const data = {
            grid: this.state.grid,
            noteLength: this.state.noteLength,
            scale: this.state.scale,
            musicalKey: this.state.musicalKey,
            channelSettings: this.state.channelSettings,
        };
        localStorage.setItem('arrowgrid-save', JSON.stringify(data));
        this._showToast('Grid saved');
    }
    loadFromLocalStorage = () => {
        const raw = localStorage.getItem('arrowgrid-save');
        if (!raw) { this._showToast('No saved grid'); return; }
        try {
            const data = JSON.parse(raw);
            this._pushUndo();
            this.setState({
                grid: data.grid,
                noteLength: data.noteLength ?? this.state.noteLength,
                scale: data.scale ?? this.state.scale,
                musicalKey: data.musicalKey ?? this.state.musicalKey,
                channelSettings: data.channelSettings ?? this.state.channelSettings,
            });
            this._showToast('Grid loaded');
        } catch (e) {
            this._showToast('Load failed');
        }
    }

    // ── Toast ──
    _toastTimer = null;
    _showToast = (msg) => {
        this.setState({ toast: msg });
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => this.setState({ toast: null }), 2000);
    }
    
    prevPreset = () => {
        this._pushUndo();
        let nextPresetIndex = this.state.currentPreset - 1;
        if (nextPresetIndex < 0) {
            nextPresetIndex = this.state.presets.length - 1;
        }
        this.setState({
            grid: this.state.presets[nextPresetIndex],
            currentPreset: nextPresetIndex
        });
    }
    
    nextPreset = () => {
        this._pushUndo();
        let nextPresetIndex = this.state.currentPreset + 1;
        if (nextPresetIndex >= this.state.presets.length) {
            nextPresetIndex = 0;
        }
        this.setState({
            grid: this.state.presets[nextPresetIndex],
            currentPreset: nextPresetIndex
        });
    }

    _timerID = undefined
    _lastTickTime = 0

    _scheduleNextTick = () => {
        clearTimeout(this._timerID);
        if (!this.state.playing) return;
        const now = Date.now();
        const elapsed = now - this._lastTickTime;
        const remaining = Math.max(0, this.state.noteLength - elapsed);
        this._timerID = setTimeout(() => {
            this._lastTickTime = Date.now();
            this.nextGrid(this.state.noteLength);
            this._scheduleNextTick();
        }, remaining);
    }

    play = () => {
        this._lastTickTime = Date.now();
        this.setState({ playing: true }, () => this._scheduleNextTick());
    }
    pause = () => {
        clearTimeout(this._timerID);
        this.setState({ playing: false });
    }
    muteToggle = async () => {
        const willEnable = !this.state.soundOn;
        if (willEnable) {
            try {
                await Tone.start();
            } catch (e) { /* ignore */ }
        }
        this.setState({ soundOn: willEnable }, () => {
            if (this.state.soundOn) sound.play();
        });
    }
    midiToggle = () => {
        this.setState({ midiOn: !this.state.midiOn });
    }
    changeEditMode = () => {
        this.setState({ deleting: !this.state.deleting });
    }
    toggleWall = (wallKey) => {
        // When called from 'closest' mode, convert wallKey to cell+side and use addWallAtCell for symmetry
        const parts = wallKey.split(':');
        const type = parts[0];
        const wy = parseInt(parts[1]);
        const wx = parseInt(parts[2]);
        // h:y:x = horizontal wall on bottom edge of cell (wx, wy) = top edge of cell (wx, wy+1)
        // v:y:x = vertical wall on right edge of cell (wx, wy) = left edge of cell (wx+1, wy)
        // Pick the cell+side interpretation that makes sense
        let cellX, cellY, side;
        if (type === 'h') {
            cellX = wx;
            cellY = wy;
            side = 'bottom';
        } else {
            cellX = wx;
            cellY = wy;
            side = 'right';
        }
        this.addWallAtCell(cellX, cellY, new Set([side]));
    }
    removeWall = (wallKey) => {
        const walls = this.state.grid.walls || [];
        const idx = walls.indexOf(wallKey);
        if (idx < 0) return; // wall doesn't exist, nothing to remove
        const newWalls = walls.filter((_, i) => i !== idx);
        newWalls._set = undefined;
        this.setState({
            grid: { ...this.state.grid, walls: newWalls }
        });
    }
    newSize = (value) => {
        const input = parseInt(value, 10);
        // Filter walls that would be out of bounds for new size
        const oldWalls = this.state.grid.walls || [];
        const newWalls = oldWalls.filter(wk => {
            const parts = wk.split(':');
            const wy = parseInt(parts[1]);
            const wx = parseInt(parts[2]);
            if (parts[0] === 'h') return wy < input - 1 && wx < input;
            return wy < input && wx < input - 1;
        });
        this.setState({
            grid: {
                ...this.state.grid,
                size: input,
                walls: newWalls,
            },
        });
    }
    newNoteLength = (value) => {
        const input = parseInt(value, 10);
        this.setState({
            noteLength: -1 * input,
        }, () => this._scheduleNextTick());
    }

    nextGrid = (length) => {
        this.setState({
            grid: nextGridLogic({
                ...this.state.grid,
                id: chance.guid(),
                soundOn: this.state.soundOn,
                midiOn: this.state.midiOn
            },
            length,
            this.state.scale,
            this.state.musicalKey,
            this.state.globalVelocity,
            this.state.channelSettings),
            gridStep: this.state.gridStep + 1
        });
    }
    newInputDirection = (inputDirection, delta = 1) => {
        this.setState({
            inputDirection,
            arrowRotationStep: this.state.arrowRotationStep + delta,
        });
    }
    newGrid = (number, size) => {
        this.setState({
            grid: newGrid(size, number),
        });
    }
    emptyGrid = () => {
        this._pushUndo();
        this.setState({
            grid: emptyGrid(this.state.grid.size),
        });
    }
    addPreset = () => {
        const encoded = window.btoa(
            JSON.stringify({
                noteLength:this.state.noteLength,
                grid: this.state.grid
            })
        );
        console.log(encoded);
        // this.setState({
        //     presets: [
        //         ...this.state.presets,
        //         putArrowsInGrid(
        //             this.state.grid.arrows
        //         )
        //     ]
        // });
    }
    addWallAtCell = (x, y, sideOrSides) => {
        const size = this.state.grid.size;
        const sides = sideOrSides instanceof Set ? sideOrSides : new Set([sideOrSides]);

        // Mirror helper (same as getMirror in arrows-logic-optimized)
        const mirror = (pos) => {
            const half = Math.floor(size / 2);
            const offset = half - pos;
            let location = half + offset;
            if ((size % 2) === 0) location--;
            return location;
        };

        // Side flip maps matching arrow vector symmetry transforms
        const flipH   = { top: 'bottom', bottom: 'top', left: 'left',  right: 'right' };
        const flipV   = { top: 'top',    bottom: 'bottom', left: 'right', right: 'left' };
        const flipBD  = { top: 'left',   bottom: 'right',  left: 'top',   right: 'bottom' };
        const flipFD  = { top: 'right',  bottom: 'left',   left: 'bottom', right: 'top' };

        // Build list of {x, y, sides} placements starting with the original
        let placements = [{ x, y, sides: [...sides] }];

        const { horizontalSymmetry, verticalSymmetry, backwardDiagonalSymmetry, forwardDiagonalSymmetry } = this.state;
        const skipForth = horizontalSymmetry && verticalSymmetry && backwardDiagonalSymmetry;

        if (horizontalSymmetry) {
            const len = placements.length;
            for (let i = 0; i < len; i++) {
                const p = placements[i];
                placements.push({
                    x: p.x,
                    y: mirror(p.y),
                    sides: p.sides.map(s => flipH[s])
                });
            }
        }

        if (verticalSymmetry) {
            const len = placements.length;
            for (let i = 0; i < len; i++) {
                const p = placements[i];
                placements.push({
                    x: mirror(p.x),
                    y: p.y,
                    sides: p.sides.map(s => flipV[s])
                });
            }
        }

        if (backwardDiagonalSymmetry) {
            const len = placements.length;
            for (let i = 0; i < len; i++) {
                const p = placements[i];
                placements.push({
                    x: p.y,
                    y: p.x,
                    sides: p.sides.map(s => flipBD[s])
                });
            }
        }

        if (forwardDiagonalSymmetry && !skipForth) {
            const len = placements.length;
            for (let i = 0; i < len; i++) {
                const p = placements[i];
                placements.push({
                    x: mirror(p.y),
                    y: mirror(p.x),
                    sides: p.sides.map(s => flipFD[s])
                });
            }
        }

        // Convert all placements to wall keys
        const wallKeys = [];
        for (const p of placements) {
            for (const side of p.sides) {
                let wallKey = null;
                switch (side) {
                    case 'top':
                        if (p.y > 0) wallKey = `h:${p.y - 1}:${p.x}`;
                        break;
                    case 'bottom':
                        if (p.y < size - 1) wallKey = `h:${p.y}:${p.x}`;
                        break;
                    case 'left':
                        if (p.x > 0) wallKey = `v:${p.y}:${p.x - 1}`;
                        break;
                    case 'right':
                        if (p.x < size - 1) wallKey = `v:${p.y}:${p.x}`;
                        break;
                    default:
                        break;
                }
                if (wallKey && !wallKeys.includes(wallKey)) wallKeys.push(wallKey);
            }
        }

        if (wallKeys.length === 0) return;
        let walls = [...(this.state.grid.walls || [])];
        for (const key of wallKeys) {
            const idx = walls.indexOf(key);
            if (idx >= 0) {
                walls.splice(idx, 1);
            } else {
                walls.push(key);
            }
        }
        walls._set = undefined;
        this.setState({
            grid: { ...this.state.grid, walls }
        });
    }
    addToGrid = (x, y, e, forced) => {
        this._pushUndo();
        if (e.shiftKey || this.state.deleting) {
            this.setState({
                grid: removeFromGrid(this.state.grid, x, y)
            });
        } else {
            const symmetries = {
                horizontalSymmetry: this.state.horizontalSymmetry,
                verticalSymmetry: this.state.verticalSymmetry,
                backwardDiagonalSymmetry: this.state.backwardDiagonalSymmetry,
                forwardDiagonalSymmetry: this.state.forwardDiagonalSymmetry
            };
            this.setState({
                grid: addToGrid(
                    this.state.grid,
                    x,
                    y,
                    this.state.inputDirection,
                    symmetries,
                    this.state.inputNumber,
                    forced,
                    this.state.arrowChannel,
                    this.state.inputVelocity
                )
            });
        }
    }
    share = async () => {
        const gridString = window.btoa(JSON.stringify({
            grid: this.state.grid,
        }));
        const shareUrl = `${window.location.origin}${window.location.pathname}?data=${gridString}`;
        
        if (navigator.share) {
            try {
                await navigator.share({ title: 'Arrow Grid', url: shareUrl });
            } catch (e) { /* cancelled */ }
        } else {
            try {
                await navigator.clipboard.writeText(shareUrl);
                this._showToast('Link copied!');
            } catch (e) {
                // Fallback: prompt
                window.prompt('Copy this link:', shareUrl);
            }
        }
    }

    updateScale = (event) => {
        this.setState({scale: event.nativeEvent.target.value.split(',').map((asdf)=>parseInt(asdf))});
    };

    updateMusicalKey = (event) => {
        this.setState({musicalKey: parseInt(event.nativeEvent.target.value)});
    };

    render() {
        // Direction labels for the arrow SVG
        const dirLabels = ["Up","Right","Down","Left"];
        // Continuous rotation: each step adds 90°. At step 0, direction 0 = Up = -90° from the right-pointing SVG
        const arrowRotationDeg = 270 + this.state.arrowRotationStep * 90;
        
        return (
            <div className="app-container">
                <div className="console-wrapper">
                    {/* ── Header ── */}
                    <header className="console-header">
                        <h1 className="app-title">
                            <span className="title-arrow">➤</span>
                            Arrow Grid
                        </h1>

                        <button 
                            className={`play-btn-hero ${this.state.playing ? 'playing' : ''}`}
                            onClick={this.state.playing ? this.pause : this.play}
                            title={this.state.playing ? "Pause (Space)" : "Play (Space)"}
                        >
                            {this.state.playing ? (
                                <svg viewBox="0 0 24 24" width="22" height="22"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="currentColor"/></svg>
                            ) : (
                                <svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>
                            )}
                        </button>

                        <div className="header-presets">
                            <button className="nav-btn" onClick={this.prevPreset} title="Previous Preset (←)">
                                <svg viewBox="0 0 24 24" width="14" height="14"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" fill="currentColor"/></svg>
                            </button>
                            <span className="preset-label">{this.state.presets[this.state.currentPreset]?.name || 'Custom'}</span>
                            <button className="nav-btn" onClick={this.nextPreset} title="Next Preset (→)">
                                <svg viewBox="0 0 24 24" width="14" height="14"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" fill="currentColor"/></svg>
                            </button>
                            <button className="hdr-btn danger" onClick={this.emptyGrid} title="Clear Grid (Delete)">
                                <svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/></svg>
                                <span>Clear Grid</span>
                            </button>
                        </div>

                        <div className="header-actions">
                            <button 
                                className={`hdr-btn ${this.state.soundOn ? 'active' : ''}`}
                                onClick={this.muteToggle}
                                title={this.state.soundOn ? "Mute Sound" : "Enable Sound"}
                            >
                                {this.state.soundOn ? (
                                    <svg viewBox="0 0 24 24" width="16" height="16"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" fill="currentColor"/></svg>
                                ) : (
                                    <svg viewBox="0 0 24 24" width="16" height="16"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" fill="currentColor"/></svg>
                                )}
                                <span>Sound</span>
                            </button>
                            <button 
                                className={`hdr-btn ${this.state.midiOn ? 'active' : ''}`}
                                onClick={this.midiToggle}
                                title={this.state.midiOn ? "Disable MIDI" : "Enable MIDI"}
                            >
                                <svg viewBox="0 0 24 24" width="16" height="16"><path d="M21 3H3v18h18V3zm-2 16H5V5h14v14zM7 7h2v10H7V7zm4 0h2v10h-2V7zm4 0h2v10h-2V7z" fill="currentColor"/></svg>
                                <span>MIDI</span>
                            </button>
                        </div>
                    </header>

                    {/* ── Body: Left | Canvas | Right ── */}
                    <div className="console-body">

                        {/* ── LEFT PANEL ── */}
                        <div className="side-panel" style={{position:'relative'}}>
                            {/* Slider overlay — renders on top of side panel */}
                            {(this.state.activePopup === 'speed' || this.state.activePopup === 'gridSize' || typeof this.state.activePopup === 'number') && (
                                <div
                                    className="slider-overlay popup-trigger-wrap"
                                    onClick={(e) => e.stopPropagation()}
                                    style={typeof this.state.activePopup === 'number' ? {
                                        '--ch-r': CHANNEL_COLORS[this.state.activePopup]?.[0] ?? 102,
                                        '--ch-g': CHANNEL_COLORS[this.state.activePopup]?.[1] ?? 126,
                                        '--ch-b': CHANNEL_COLORS[this.state.activePopup]?.[2] ?? 234,
                                    } : undefined}
                                >
                                    <span className="slider-overlay-title">
                                        {this.state.activePopup === 'speed' ? 'Speed' : this.state.activePopup === 'gridSize' ? 'Grid Size' : `Ch${this.state.activePopup} Vol`}
                                    </span>
                                    <span className="slider-overlay-val">
                                        {this.state.activePopup === 'speed'
                                            ? `${Math.round(60000 / this.state.noteLength)} bpm`
                                            : this.state.activePopup === 'gridSize'
                                                ? `${this.state.grid.size}×${this.state.grid.size}`
                                                : `${Math.round(((this.state.channelSettings[this.state.activePopup]?.volume ?? 1.0)) * 100)}%`
                                        }
                                    </span>
                                    <input
                                        type="range"
                                        className="slider-overlay-range"
                                        orient="vertical"
                                        min={this.state.activePopup === 'speed' ? minNoteLength : this.state.activePopup === 'gridSize' ? minSize : 0}
                                        max={this.state.activePopup === 'speed' ? maxNoteLength : this.state.activePopup === 'gridSize' ? maxSize : 100}
                                        value={this.state.activePopup === 'speed'
                                            ? -1 * this.state.noteLength
                                            : this.state.activePopup === 'gridSize'
                                                ? this.state.grid.size
                                                : Math.round((this.state.channelSettings[this.state.activePopup]?.volume ?? 1.0) * 100)
                                        }
                                        onChange={(e) => {
                                            if (this.state.activePopup === 'speed') {
                                                this.newNoteLength(e.target.value);
                                            } else if (this.state.activePopup === 'gridSize') {
                                                this.newSize(e.target.value);
                                            } else {
                                                const ch = this.state.activePopup;
                                                const settings = this.state.channelSettings[ch] || createChannelSettings(ch);
                                                const newSettings = { ...this.state.channelSettings };
                                                newSettings[ch] = { ...settings, volume: parseInt(e.target.value) / 100 };
                                                this.setState({ channelSettings: newSettings });
                                            }
                                        }}
                                    />
                                    <button className="slider-overlay-close" onClick={() => this.setState({ activePopup: null })}>✕</button>
                                </div>
                            )}

                            {/* Speed */}
                            <div className="panel-group">
                                <h3>Speed</h3>
                                <button
                                    className="popup-trigger-btn popup-trigger-wrap"
                                    onClick={() => this.setState({ activePopup: this.state.activePopup === 'speed' ? null : 'speed' })}
                                    title="Adjust speed"
                                >{Math.round(60000 / this.state.noteLength)} bpm</button>
                            </div>

                            {/* Grid Size */}
                            <div className="panel-group">
                                <h3>Grid Size</h3>
                                <button
                                    className="popup-trigger-btn popup-trigger-wrap"
                                    onClick={() => this.setState({ activePopup: this.state.activePopup === 'gridSize' ? null : 'gridSize' })}
                                    title="Adjust grid size"
                                >{this.state.grid.size}×{this.state.grid.size}</button>
                            </div>

                                            {/* Channel selector */}
                            <div className="channel-row">
                                <div className="channel-header">
                                    <h3>Channels</h3>
                                </div>
                                {/* Channel buttons */}
                                {Array.from({ length: MAX_CHANNELS }, (_, i) => i + 1).map(ch => {
                                    const settings = this.state.channelSettings[ch] || createChannelSettings(ch);
                                    const isMuted = settings.muted || false;
                                    return (
                                        <div key={ch}
                                            className={`channel-item ${this.state.arrowChannel === ch ? 'selected' : ''}`}
                                            onClick={() => this.setState({ arrowChannel: ch })}
                                        >
                                            <div className={`channel-box ${CHANNEL_CSS_CLASSES[ch]} ${this.state.arrowChannel === ch ? 'active' : ''} ${isMuted ? 'muted' : ''}`}>
                                                <span className="ch-label-inline">Ch{ch}</span>
                                                <button
                                                    className={`ch-mute-btn-inline ${isMuted ? 'muted' : ''}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const newSettings = { ...this.state.channelSettings };
                                                        newSettings[ch] = { ...settings, muted: !isMuted };
                                                        this.setState({ arrowChannel: ch, channelSettings: newSettings });
                                                    }}
                                                    title={isMuted ? `Unmute Ch ${ch}` : `Mute Ch ${ch}`}
                                                >
                                                    {isMuted ? (
                                                        <svg viewBox="0 0 24 24" width="10" height="10"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/><line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="2"/></svg>
                                                    ) : (
                                                        <svg viewBox="0 0 24 24" width="10" height="10"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M7 12.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                                    )}
                                                </button>
                                                <div className="ch-vol-wrap popup-trigger-wrap">
                                                    <button
                                                        className="ch-vol-btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            this.setState({ activePopup: this.state.activePopup === ch ? null : ch, arrowChannel: ch });
                                                        }}
                                                        title={`Ch ${ch} volume: ${Math.round((settings.volume ?? 1.0) * 100)}%`}
                                                    >
                                                        <svg viewBox="0 0 24 24" width="10" height="10"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" fill="currentColor"/></svg>
                                                        <span>{Math.round((settings.volume ?? 1.0) * 100)}%</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── CENTER CANVAS ── */}
                        <div className="canvas-area" data-step="5" data-intro="Click on the grid to place arrows!">
                            <div id="sketch-holder" />
                        </div>

                        {/* ── RIGHT PANEL ── */}
                        <div className="side-panel" style={{position:'relative'}}>
                            {/* Slider overlay for right panel */}
                            {(this.state.activePopup === 'arrowVol' || this.state.activePopup === 'masterVol') && (
                                <div className="slider-overlay popup-trigger-wrap" onClick={(e) => e.stopPropagation()}>
                                    <span className="slider-overlay-title">{this.state.activePopup === 'arrowVol' ? 'Arrow Volume' : 'Master Volume'}</span>
                                    <span className="slider-overlay-val">
                                        {this.state.activePopup === 'arrowVol'
                                            ? `${Math.round(this.state.inputVelocity * 100)}%`
                                            : `${Math.round(this.state.globalVelocity * 100)}%`
                                        }
                                    </span>
                                    <input
                                        type="range"
                                        className="slider-overlay-range"
                                        orient="vertical"
                                        min={this.state.activePopup === 'arrowVol' ? '5' : '0'}
                                        max="100"
                                        value={this.state.activePopup === 'arrowVol'
                                            ? Math.round(this.state.inputVelocity * 100)
                                            : Math.round(this.state.globalVelocity * 100)
                                        }
                                        onChange={(e) => {
                                            if (this.state.activePopup === 'arrowVol') {
                                                this.setState({ inputVelocity: parseInt(e.target.value) / 100 });
                                            } else {
                                                this.setState({ globalVelocity: parseInt(e.target.value) / 100 });
                                            }
                                        }}
                                    />
                                    <button className="slider-overlay-close" onClick={() => this.setState({ activePopup: null })}>✕</button>
                                </div>
                            )}
                            {/* Channel select overlay */}
                            {this.state.activePopup === 'chSelect' && (
                                <div className="slider-overlay ch-select-overlay popup-trigger-wrap" onClick={(e) => e.stopPropagation()}>
                                    <span className="slider-overlay-title">Select Channel</span>
                                    <div className="ch-select-grid">
                                        {Array.from({length: MAX_CHANNELS}, (_, i) => i + 1).map(ch => (
                                            <button
                                                key={ch}
                                                className={`ch-select-item ${this.state.arrowChannel === ch ? 'selected' : ''}`}
                                                style={{background: `rgb(${CHANNEL_COLORS[ch].join(',')})`}}
                                                onClick={(e) => { e.stopPropagation(); this.setState({ arrowChannel: ch, activePopup: null }); }}
                                            >{ch}</button>
                                        ))}
                                    </div>
                                    <button className="slider-overlay-close" onClick={() => this.setState({ activePopup: null })}>✕</button>
                                </div>
                            )}
                            {/* Draw Tools */}
                            <div className="panel-group draw-panel">
                                <h3>Draw</h3>
                                {/* Mode toggle: Draw / Erase */}
                                <div className="draw-mode-toggle">
                                    <button
                                        className={`mode-btn ${!this.state.deleting ? 'active' : ''}`}
                                        onClick={() => this.setState({ deleting: false })}
                                        title="Draw / Add mode"
                                    >
                                        <svg viewBox="0 0 24 24" width="14" height="14"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/></svg>
                                        <span>Draw</span>
                                    </button>
                                    <button
                                        className={`mode-btn ${this.state.deleting ? 'erasing' : ''}`}
                                        onClick={() => this.setState({ deleting: true })}
                                        title="Erase / Remove mode (E)"
                                    >
                                        <svg viewBox="0 0 24 24" width="14" height="14"><path d="M15.14 3c-.51 0-1.02.2-1.41.59L2.59 14.73c-.78.77-.78 2.04 0 2.83L5.03 20h8.94l7.44-7.44c.79-.78.79-2.04 0-2.83l-4.86-4.86c-.39-.39-.9-.59-1.41-.59zM6.1 18l-1.66-1.66 5.48-5.48 1.66 1.66L6.1 18z" fill="currentColor"/></svg>
                                        <span>Erase</span>
                                    </button>
                                </div>

                                {/* ── Arrow Tool Group ── */}
                                <div className={`draw-tool-group ${this.state.deleting ? 'inactive-section' : this.state.drawMode === 'arrow' ? 'active-section' : 'inactive-section'}`}
                                     onClick={() => this.setState({ drawMode: 'arrow', deleting: false })}
                                     style={{
                                         '--ch-r': CHANNEL_COLORS[this.state.arrowChannel]?.[0] ?? 102,
                                         '--ch-g': CHANNEL_COLORS[this.state.arrowChannel]?.[1] ?? 126,
                                         '--ch-b': CHANNEL_COLORS[this.state.arrowChannel]?.[2] ?? 234,
                                     }}
                                >
                                    <span className="group-label">Arrow</span>
                                    {/* Channel selector */}
                                    <div className="tool-btn-labeled" style={{width:'100%'}}>
                                        <span className="tool-label">channel</span>
                                        <button
                                            className="ch-select-btn popup-trigger-wrap"
                                            onClick={(e) => { e.stopPropagation(); this.setState({ activePopup: this.state.activePopup === 'chSelect' ? null : 'chSelect' }); }}
                                            style={{background: `rgb(${CHANNEL_COLORS[this.state.arrowChannel].join(',')})`}}
                                            title={`Channel ${this.state.arrowChannel}`}
                                        >Ch{this.state.arrowChannel}</button>
                                    </div>
                                    <div className="tool-row">
                                        <div className="tool-btn-labeled">
                                            <span className="tool-label">direction</span>
                                            <button
                                                className="tool-btn"
                                                onClick={() => this.newInputDirection((this.state.inputDirection + 1) % 4)}
                                                title={`Direction: ${dirLabels[this.state.inputDirection]} (click to rotate)`}
                                            >
                                                <svg viewBox="0 0 24 24" width="18" height="18" style={{transform: `rotate(${arrowRotationDeg}deg)`, transition: 'transform 0.2s ease'}}>
                                                    <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" fill="currentColor"/>
                                                </svg>
                                            </button>
                                        </div>
                                        <div className="tool-btn-labeled">
                                            <span className="tool-label">path</span>
                                            <button
                                                className="tool-btn"
                                                onClick={() => this.setState({inputNumber: ((this.state.inputNumber) % 4) + 1, drawMode: 'arrow', deleting: false})}
                                                title={['Straight path','Always turn right','Back and forth','Always turn left'][this.state.inputNumber - 1] + ` (×${this.state.inputNumber})`}
                                            >
                                            {this.state.inputNumber === 1 && (
                                                <svg viewBox="0 0 24 24" width="18" height="18" style={{transform: `rotate(${arrowRotationDeg + 90}deg)`, transition: 'transform 0.2s ease'}}>
                                                    <path d="M12 20 L12 4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
                                                    <path d="M8 8 L12 4 L16 8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                                                </svg>
                                            )}
                                            {this.state.inputNumber === 2 && (
                                                <svg viewBox="0 0 24 24" width="18" height="18" style={{transform: `rotate(${arrowRotationDeg + 90}deg)`, transition: 'transform 0.2s ease'}}>
                                                    <path d="M8 20 L8 8 Q8 4 12 4 Q16 4 16 8 L16 16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                                                    <path d="M13 13 L16 16 L19 13" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                                                </svg>
                                            )}
                                            {this.state.inputNumber === 3 && (
                                                <svg viewBox="0 0 24 24" width="18" height="18" style={{transform: `rotate(${arrowRotationDeg + 90}deg)`, transition: 'transform 0.2s ease'}}>
                                                    <path d="M12 4 L12 20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
                                                    <path d="M8 8 L12 4 L16 8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                                                    <path d="M8 16 L12 20 L16 16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                                                </svg>
                                            )}
                                            {this.state.inputNumber === 4 && (
                                                <svg viewBox="0 0 24 24" width="18" height="18" style={{transform: `rotate(${arrowRotationDeg + 90}deg)`, transition: 'transform 0.2s ease'}}>
                                                    <path d="M16 20 L16 8 Q16 4 12 4 Q8 4 8 8 L8 16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                                                    <path d="M5 13 L8 16 L11 13" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                                                </svg>
                                            )}
                                        </button>
                                        </div>
                                    </div>
                                    <div className="tool-btn-labeled" style={{width:'100%'}}>
                                        <span className="tool-label">Arrow Vol</span>
                                        <button
                                            className="popup-trigger-btn"
                                            onClick={(e) => { e.stopPropagation(); this.setState({ activePopup: this.state.activePopup === 'arrowVol' ? null : 'arrowVol' }); }}
                                            title={`Arrow volume: ${Math.round(this.state.inputVelocity * 100)}%`}
                                        >{Math.round(this.state.inputVelocity * 100)}%</button>
                                    </div>
                                </div>

                                {/* ── Wall Tool Group ── */}
                                <div className={`draw-tool-group ${this.state.deleting ? 'inactive-section' : this.state.drawMode === 'wall' ? 'active-section' : 'inactive-section'}`}
                                     onClick={() => this.setState({ drawMode: 'wall', deleting: false })}
                                >
                                    <span className="group-label">Wall</span>
                                    <div className="wall-sides-grid">
                                        {['top','bottom','left','right'].map(side => (
                                            <button
                                                key={side}
                                                className={`wall-side-btn ${side} ${this.state.drawMode === 'wall' && this.state.wallSides.has(side) ? 'active' : ''}`}
                                                onClick={() => {
                                                    const next = new Set(this.state.wallSides);
                                                    if (next.has(side)) next.delete(side);
                                                    else next.add(side);
                                                    this.setState({ drawMode: 'wall', deleting: false, wallSides: next, wallClosest: false });
                                                }}
                                                title={`${side.charAt(0).toUpperCase() + side.slice(1)} wall`}
                                            >
                                                {side === 'top' && <svg viewBox="0 0 24 24" width="14" height="14"><rect x="3" y="3" width="18" height="3" rx="1" fill="currentColor"/><rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1" opacity=".25"/></svg>}
                                                {side === 'bottom' && <svg viewBox="0 0 24 24" width="14" height="14"><rect x="3" y="18" width="18" height="3" rx="1" fill="currentColor"/><rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1" opacity=".25"/></svg>}
                                                {side === 'left' && <svg viewBox="0 0 24 24" width="14" height="14"><rect x="3" y="3" width="3" height="18" rx="1" fill="currentColor"/><rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1" opacity=".25"/></svg>}
                                                {side === 'right' && <svg viewBox="0 0 24 24" width="14" height="14"><rect x="18" y="3" width="3" height="18" rx="1" fill="currentColor"/><rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1" opacity=".25"/></svg>}
                                            </button>
                                        ))}
                                        <button
                                            className={`wall-side-btn closest wide ${this.state.wallClosest && this.state.drawMode === 'wall' ? 'active' : ''}`}
                                            onClick={() => this.setState({ drawMode: 'wall', deleting: false, wallClosest: true, wallSides: new Set() })}
                                            title="Add wall to closest edge"
                                        >
                                            <svg viewBox="0 0 24 24" width="12" height="12"><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                                            <span>Closest</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Symmetry */}
                            <div className="panel-group">
                                <h3>Symmetry</h3>
                                <div className="sym-grid">
                                    <button className={`tool-btn ${this.state.verticalSymmetry ? 'active' : ''}`} onClick={() => this.setState({verticalSymmetry: !this.state.verticalSymmetry})} title="Vertical (1)">
                                        <svg viewBox="0 0 24 24" width="16" height="16"><line x1="12" y1="3" x2="12" y2="21" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                                    </button>
                                    <button className={`tool-btn ${this.state.horizontalSymmetry ? 'active' : ''}`} onClick={() => this.setState({horizontalSymmetry: !this.state.horizontalSymmetry})} title="Horizontal (2)">
                                        <svg viewBox="0 0 24 24" width="16" height="16"><line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                                    </button>
                                    <button className={`tool-btn ${this.state.forwardDiagonalSymmetry ? 'active' : ''}`} onClick={() => this.setState({forwardDiagonalSymmetry: !this.state.forwardDiagonalSymmetry})} title="Diagonal / (3)">
                                        <svg viewBox="0 0 24 24" width="16" height="16"><line x1="5" y1="19" x2="19" y2="5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                                    </button>
                                    <button className={`tool-btn ${this.state.backwardDiagonalSymmetry ? 'active' : ''}`} onClick={() => this.setState({backwardDiagonalSymmetry: !this.state.backwardDiagonalSymmetry})} title="Diagonal \ (4)">
                                        <svg viewBox="0 0 24 24" width="16" height="16"><line x1="5" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Footer: Music Settings ── */}
                    <footer className="console-footer">
                        <div className="footer-group">
                            <label>Scale</label>
                            <select 
                                className="sel"
                                value={this.state.scale.toString()} 
                                onChange={this.updateScale}
                            >
                                {scaleGroups.map((group) => (
                                    <optgroup key={group.group} label={group.group}>
                                        {Object.entries(group.scales).map(([name, intervals]) => (
                                            <option key={name} value={intervals}>
                                                {name.charAt(0).toUpperCase() + name.slice(1)}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </div>
                        <div className="footer-group">
                            <label>Key</label>
                            <select 
                                className="sel"
                                value={this.state.musicalKey} 
                                onChange={this.updateMusicalKey}
                            >
                                {range(21, 109).map((midiNote) => (
                                    <option key={midiNote} value={midiNote}>
                                        {musicalNotes[midiNote - 21].toUpperCase()}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="footer-group">
                            <label>MIDI Out</label>
                            <select id="midiOut" className="sel">
                                <option value="">None</option>
                            </select>
                            <button
                                className="midi-rescan-btn"
                                onClick={rescanMIDI}
                                title="Rescan MIDI devices"
                            >
                                <svg viewBox="0 0 24 24" width="14" height="14"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" fill="currentColor"/></svg>
                            </button>
                        </div>
                        <div className="footer-group">
                            <label>Master Vol</label>
                            <button
                                className="popup-trigger-btn popup-trigger-wrap"
                                onClick={() => this.setState({ activePopup: this.state.activePopup === 'masterVol' ? null : 'masterVol' })}
                                title={`Master volume: ${Math.round(this.state.globalVelocity * 100)}%`}
                                style={{width: '70px', padding: '4px 8px', minHeight: '24px', fontSize: '0.75em'}}
                            >{Math.round(this.state.globalVelocity * 100)}%</button>
                        </div>
                    </footer>
                </div>
                
                {/* ── Toast notification ── */}
                {this.state.toast && (
                    <div className="toast">{this.state.toast}</div>
                )}

                {/* ── Intro Modal ── */}
                {this.state.showIntro && (
                    <div className="intro-overlay" onClick={() => { localStorage.setItem('arrowgrid-seen', '1'); this.setState({ showIntro: false }); }}>
                        <div className="intro-modal" onClick={(e) => e.stopPropagation()}>
                            <h2><span className="title-arrow">➤</span> Arrow Grid</h2>
                            <p>An audio-visual instrument that creates rhythms and melodies from bouncing arrows.</p>
                            <ul className="intro-steps">
                                <li><strong>Click</strong> the grid to place arrows</li>
                                <li><strong>Arrows</strong> move, bounce off walls, and trigger notes</li>
                                <li><strong>Channels</strong> give each arrow a color and sound</li>
                                <li>Use <strong>←→</strong> to browse presets, <strong>Space</strong> to play/pause</li>
                                <li>Enable <strong>MIDI</strong> to send notes to your DAW</li>
                            </ul>
                            <button className="intro-close-btn" onClick={() => { localStorage.setItem('arrowgrid-seen', '1'); this.setState({ showIntro: false }); }}>
                                Start Playing
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Floating action bar ── */}
                <div className="fab-bar">
                    <button className="fab-btn" onClick={this.undo} title="Undo (Ctrl+Z)" disabled={this.state.undoStack.length === 0}>
                        <svg viewBox="0 0 24 24" width="16" height="16"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" fill="currentColor"/></svg>
                    </button>
                    <button className="fab-btn" onClick={this.saveToLocalStorage} title="Save (Ctrl+S)">
                        <svg viewBox="0 0 24 24" width="16" height="16"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" fill="currentColor"/></svg>
                    </button>
                    <button className="fab-btn" onClick={this.loadFromLocalStorage} title="Load saved grid">
                        <svg viewBox="0 0 24 24" width="16" height="16"><path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z" fill="currentColor"/></svg>
                    </button>
                    <button className="fab-btn" onClick={this.share} title="Share grid link">
                        <svg viewBox="0 0 24 24" width="16" height="16"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" fill="currentColor"/></svg>
                    </button>
                </div>
            </div>
        );
    }
}