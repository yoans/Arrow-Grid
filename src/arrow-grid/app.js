import React from 'react';
import '../App.css';
import {range} from 'ramda';
import { resumeAudio, initAudio, playClick, SYNTH_PRESETS, PRESET_GROUPS, ALL_PRESET_KEYS, DEFAULT_SYNTH } from './synth-engine';
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
import { rescanMIDI, midiUtils, onMidiConnected, sendProgramChange, isMidiConnected } from './midi';
import presets from './presets';
import Chance from 'chance';
import scales, { scaleGroups } from './scales';
import { CHANNEL_LABELS, CHANNEL_CSS_CLASSES, CHANNEL_COLORS, MAX_CHANNELS, createChannelSettings } from './channels';

const chance = new Chance();

const maxSize = 20;
const minSize = 2;
const minNoteLength = -500;
const maxNoteLength = -50;

// Generate a random grid with tame constraints
const generateRandomGrid = () => {
    const size = 5 + Math.floor(Math.random() * 16);        // 5-20
    const numArrows = 5 + Math.floor(Math.random() * 16);    // 5-20
    const arrows = [];
    for (let i = 0; i < numArrows; i++) {
        arrows.push({
            x: Math.floor(Math.random() * size),
            y: Math.floor(Math.random() * size),
            vector: Math.floor(Math.random() * 4),
            channel: 1 + Math.floor(Math.random() * 9),       // channels 1-9
        });
    }
    // Add 0-8 random walls
    const numWalls = Math.floor(Math.random() * 9);
    const walls = [];
    for (let i = 0; i < numWalls; i++) {
        const isH = Math.random() > 0.5;
        if (isH) {
            const wy = Math.floor(Math.random() * (size - 1));
            const wx = Math.floor(Math.random() * size);
            const key = `h:${wy}:${wx}`;
            if (!walls.includes(key)) walls.push(key);
        } else {
            const wy = Math.floor(Math.random() * size);
            const wx = Math.floor(Math.random() * (size - 1));
            const key = `v:${wy}:${wx}`;
            if (!walls.includes(key)) walls.push(key);
        }
    }
    return { size, arrows, walls, muted: true };
};
const generateRandomSpeed = () => 150 + Math.floor(Math.random() * 251); // 150-400ms


// Simple click sound using synth engine
const sound = {
    async play() {
        try {
            await initAudio();
            playClick();
        } catch (e) {
            // Ignore audio errors
        }
    }
};

export class Application extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            currentPreset: -1,  // -1 = random/custom, 0+ = preset index
            presets,
            inputDirection: 0,
            noteLength: props.noteLength || generateRandomSpeed(),
            grid: props.grid || generateRandomGrid(),  // Start with random grid
            playing: false,
            soundOn: localStorage.getItem('arrowgrid-sound') === 'on',
            midiOn: false,
            deleting: false,
            eraseTarget: 'both', // 'arrows', 'walls', or 'both'
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
            redoStack: [],
            toast: null,
            savedGrids: JSON.parse(localStorage.getItem('arrowgrid-saves') || '[]'),
            showSaveManager: false,
            confirmDeleteIndex: null,
            saveNameInput: '',
            showInfo: false,
            showMidiHelp: false,
            progModalSnapshot: null,  // snapshot of channel settings when FX modal opens
            progInputText: '0',       // custom text input for program number
            progCloseConfirm: false,  // show close confirmation warning
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
        
        // Resume AudioContext on first user gesture (browsers block autoplay)
        const resumeAudioOnGesture = async () => {
            try { await resumeAudio(); await initAudio(); } catch (e) { /* ignore */ }
            document.removeEventListener('pointerdown', resumeAudioOnGesture);
            document.removeEventListener('keydown', resumeAudioOnGesture);
        };
        document.addEventListener('pointerdown', resumeAudioOnGesture, { once: false });
        document.addEventListener('keydown', resumeAudioOnGesture, { once: false });
        this._resumeAudioCleanup = () => {
            document.removeEventListener('pointerdown', resumeAudioOnGesture);
            document.removeEventListener('keydown', resumeAudioOnGesture);
        };
        
        // Click outside to close volume popup
        document.addEventListener('mousedown', this._closeVolumePopup);
        
        // Add resize listener for responsive canvas
        window.addEventListener('resize', this._handleResize);
        
        // Initialize MIDI on startup
        midiUtils();
        
        // Auto-enable MIDI when a device is connected
        onMidiConnected(() => {
            this.setState({ midiOn: true });
        });
        
        // Auto-play after a short delay — but wait for intro modal dismissal
        if (!this.state.showIntro) {
            setTimeout(() => this.play(), 500);
        }
    }
    
    componentDidUpdate() {
        updateCanvas(this.state, new Date());
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('mousedown', this._closeVolumePopup);
        window.removeEventListener('resize', this._handleResize);
        if (this._resumeAudioCleanup) this._resumeAudioCleanup();
        clearTimeout(this._timerID);
        clearTimeout(this._resizeTimer);
    }

    _resizeTimer = null;

    _closeVolumePopup = (e) => {
        if (this.state.activePopup !== null
            && !e.target.closest('.popup-trigger-wrap')
            && !e.target.closest('.prog-modal-overlay')
            && !e.target.closest('.prog-modal')) {
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
            const sidePanelWidth = 116 * 2 + 40 + 48 + 30; // both panels + gaps + wrapper padding + note labels
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
                this.setState({ arrowChannel: this.state.arrowChannel > 1 ? this.state.arrowChannel - 1 : MAX_CHANNELS });
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.setState({ arrowChannel: this.state.arrowChannel < MAX_CHANNELS ? this.state.arrowChannel + 1 : 1 });
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
                if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
                    e.preventDefault();
                    this.redo();
                } else if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.undo();
                }
                break;
            case 'KeyY':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.redo();
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

    // ── Undo / Redo ──
    _pushUndo = () => {
        const snapshot = JSON.stringify(this.state.grid);
        const stack = [...this.state.undoStack, snapshot].slice(-30); // keep last 30
        this.setState({ undoStack: stack, redoStack: [] }); // clear redo on new action
    }
    undo = () => {
        if (this.state.undoStack.length === 0) return;
        const undoStack = [...this.state.undoStack];
        const prev = undoStack.pop();
        const redoStack = [...this.state.redoStack, JSON.stringify(this.state.grid)].slice(-30);
        this.setState({ grid: JSON.parse(prev), undoStack, redoStack });
    }
    redo = () => {
        if (this.state.redoStack.length === 0) return;
        const redoStack = [...this.state.redoStack];
        const next = redoStack.pop();
        const undoStack = [...this.state.undoStack, JSON.stringify(this.state.grid)].slice(-30);
        this.setState({ grid: JSON.parse(next), undoStack, redoStack });
    }

    // ── Save / Load ──
    _getGridData = () => ({
        grid: this.state.grid,
        noteLength: this.state.noteLength,
        scale: this.state.scale,
        musicalKey: this.state.musicalKey,
        channelSettings: this.state.channelSettings,
    });

    _persistSaves = (saves) => {
        localStorage.setItem('arrowgrid-saves', JSON.stringify(saves));
        this.setState({ savedGrids: saves });
    }

    saveToLocalStorage = () => {
        // Quick-save: open manager with save prompt
        this.setState({ showSaveManager: true, saveNameInput: '' });
    }

    saveWithName = (name) => {
        if (!name.trim()) return;
        const entry = {
            name: name.trim(),
            data: this._getGridData(),
            date: new Date().toISOString(),
        };
        const saves = [...this.state.savedGrids, entry];
        this._persistSaves(saves);
        this.setState({ saveNameInput: '' });
        this._showToast(`Saved "${name.trim()}"`);
    }

    loadSavedGrid = (index) => {
        const entry = this.state.savedGrids[index];
        if (!entry) return;
        this._pushUndo();
        const data = entry.data;
        this.setState({
            grid: data.grid,
            noteLength: data.noteLength ?? this.state.noteLength,
            scale: data.scale ?? this.state.scale,
            musicalKey: data.musicalKey ?? this.state.musicalKey,
            channelSettings: data.channelSettings ?? this.state.channelSettings,
            currentPreset: -1,
            showSaveManager: false,
        });
        this._showToast(`Loaded "${entry.name}"`);
    }

    deleteSavedGrid = (index) => {
        const saves = [...this.state.savedGrids];
        const name = saves[index]?.name;
        saves.splice(index, 1);
        this._persistSaves(saves);
        this.setState({ confirmDeleteIndex: null });
        this._showToast(`Deleted "${name}"`);
    }

    renameSavedGrid = (index, newName) => {
        if (!newName.trim()) return;
        const saves = [...this.state.savedGrids];
        saves[index] = { ...saves[index], name: newName.trim() };
        this._persistSaves(saves);
    }

    exportGrid = () => {
        const data = this._getGridData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ag16.json';
        a.click();
        URL.revokeObjectURL(url);
        this._showToast('Exported grid as JSON');
    }

    exportAllSaves = () => {
        const data = this.state.savedGrids;
        if (data.length === 0) { this._showToast('No saves to export'); return; }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ag16-saves.json';
        a.click();
        URL.revokeObjectURL(url);
        this._showToast(`Exported ${data.length} save(s)`);
    }

    importGrid = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const parsed = JSON.parse(ev.target.result);
                    // Detect: is this a single save or an array of saves?
                    if (Array.isArray(parsed)) {
                        // Array of saves — merge into existing
                        const newSaves = [...this.state.savedGrids, ...parsed];
                        this._persistSaves(newSaves);
                        this._showToast(`Imported ${parsed.length} save(s)`);
                    } else if (parsed.grid) {
                        // Single grid — load directly
                        this._pushUndo();
                        this.setState({
                            grid: parsed.grid,
                            noteLength: parsed.noteLength ?? this.state.noteLength,
                            scale: parsed.scale ?? this.state.scale,
                            musicalKey: parsed.musicalKey ?? this.state.musicalKey,
                            channelSettings: parsed.channelSettings ?? this.state.channelSettings,
                            currentPreset: -1,
                        });
                        this._showToast('Imported grid');
                    } else {
                        this._showToast('Invalid file format');
                    }
                } catch (err) {
                    this._showToast('Import failed — invalid JSON');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    loadFromLocalStorage = () => {
        this.setState({ showSaveManager: true });
    }

    // ── Toast ──
    _toastTimer = null;
    _showToast = (msg) => {
        this.setState({ toast: msg });
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => this.setState({ toast: null }), 2000);
    }

    // ── Randomize ──
    randomizeGrid = () => {
        this._pushUndo();
        const tonalKeys = ALL_PRESET_KEYS.filter(k => !SYNTH_PRESETS[k].isPercussion);
        const RAND_ICON_MAP = {
            sine: 'sine', triangle: 'triangle', square: 'square', sawtooth: 'saw',
            pad: 'pad', lead: 'lead', bass: 'bass', pluck: 'guitar',
            bell: 'bell', organ: 'organ', strings: 'strings',
        };
        const newChannelSettings = { ...this.state.channelSettings };
        for (let ch = 1; ch <= MAX_CHANNELS; ch++) {
            const prev = newChannelSettings[ch] || createChannelSettings(ch);
            const key = tonalKeys[Math.floor(Math.random() * tonalKeys.length)];
            const p = SYNTH_PRESETS[key];
            newChannelSettings[ch] = {
                ...prev,
                synthPreset: key,
                icon: RAND_ICON_MAP[key] || prev.icon || 'piano',
                synth: { waveform: p.waveform, attack: p.attack, decay: p.decay, sustain: p.sustain, release: p.release, cutoff: p.cutoff, resonance: p.resonance },
            };
        }
        this.setState({
            grid: generateRandomGrid(),
            noteLength: generateRandomSpeed(),
            currentPreset: -1,
            channelSettings: newChannelSettings,
        });
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
                await resumeAudio();
                await initAudio();
            } catch (e) { /* ignore */ }
        }
        localStorage.setItem('arrowgrid-sound', willEnable ? 'on' : 'off');
        this.setState({ soundOn: willEnable }, () => {
            if (this.state.soundOn) sound.play();
        });
    }
    midiToggle = () => {
        if (!isMidiConnected() && !this.state.midiOn) {
            this.setState({ showMidiHelp: true });
        } else {
            this.setState({ midiOn: !this.state.midiOn });
        }
    }
    changeEditMode = () => {
        this.setState({ deleting: !this.state.deleting, eraseTarget: this.state.eraseTarget || 'both' });
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
        if (e.shiftKey || (this.state.deleting && this.state.eraseTarget !== 'walls')) {
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
                await navigator.share({ title: 'AG16', url: shareUrl });
            } catch (e) { /* cancelled */ }
        } else {
            try {
                await navigator.clipboard.writeText(shareUrl);
                this._showToast('Link copied to clipboard — paste to share!');
            } catch (e) {
                // Fallback: prompt
                window.prompt('Copy this link:', shareUrl);
            }
        }
    }

    updateScale = (event) => {
        this.setState({scale: event.nativeEvent.target.value.split(',').map((asdf)=>parseInt(asdf))});
    };

    nudgeScale = (delta) => {
        const currentStr = this.state.scale.toString();
        const idx = scales.findIndex(s => s.value.toString() === currentStr);
        const nextIdx = ((idx + delta) % scales.length + scales.length) % scales.length;
        this.setState({ scale: scales[nextIdx].value });
    };

    updateMusicalKey = (event) => {
        this.setState({musicalKey: parseInt(event.nativeEvent.target.value)});
    };

    nudgeMusicalKey = (delta) => {
        const range = 108 - 21 + 1;
        const next = 21 + ((this.state.musicalKey - 21 + delta) % range + range) % range;
        this.setState({ musicalKey: next });
    };

    render() {
        // Direction labels for the arrow SVG
        const dirLabels = ["Up","Right","Down","Left"];
        // Continuous rotation: each step adds 90°. At step 0, direction 0 = Up = -90° from the right-pointing SVG
        const arrowRotationDeg = 270 + this.state.arrowRotationStep * 90;
        
        return (
            <div className="app-container">
                <div className="console-wrapper" style={{
                    '--ch-color': `rgb(${(CHANNEL_COLORS[this.state.arrowChannel] || CHANNEL_COLORS[1]).join(',')})`,
                    '--ch-color-glow': `rgba(${(CHANNEL_COLORS[this.state.arrowChannel] || CHANNEL_COLORS[1]).join(',')}, 0.25)`,
                }}>
                    {/* ── Header ── */}
                    <header className="console-header">
                        <h1 className="app-title">
                            <span className="title-arrow">➤</span>
                            AG16
                        </h1>

                        <div className="undo-redo-group">
                            <button 
                                className="undo-redo-btn"
                                onClick={this.undo}
                                title="Undo (Ctrl+Z)"
                                disabled={this.state.undoStack.length === 0}
                            >
                                <svg viewBox="0 0 24 24" width="14" height="14"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" fill="currentColor"/></svg>
                                <span>Undo</span>
                            </button>
                            <button 
                                className="undo-redo-btn"
                                onClick={this.redo}
                                title="Redo (Ctrl+Shift+Z)"
                                disabled={this.state.redoStack.length === 0}
                            >
                                <svg viewBox="0 0 24 24" width="14" height="14"><path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.06-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z" fill="currentColor"/></svg>
                                <span>Redo</span>
                            </button>
                        </div>

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
                            <span className="preset-label">{this.state.currentPreset >= 0 ? (this.state.presets[this.state.currentPreset]?.name || 'Preset') : 'Custom'}</span>
                            <button className="nav-btn" onClick={this.nextPreset} title="Next Preset (→)">
                                <svg viewBox="0 0 24 24" width="14" height="14"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" fill="currentColor"/></svg>
                            </button>
                            <button className="hdr-btn" onClick={this.randomizeGrid} title="Randomize grid">
                                <svg viewBox="0 0 24 24" width="14" height="14"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm-.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.79-3.13z" fill="currentColor"/></svg>
                                <span>Randomize</span>
                            </button>
                            <button className="hdr-btn danger" onClick={this.emptyGrid} title="Clear Grid (Delete)">
                                <svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/></svg>
                                <span>Clear</span>
                            </button>
                        </div>

                        <div className="header-actions">
                            <button
                                className="hdr-btn"
                                onClick={() => this.setState({ showInfo: true })}
                                title="About AG16"
                            >
                                <svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="currentColor"/></svg>
                                <span>Info</span>
                            </button>
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
                                <svg viewBox="93 201 72 71" width="20" height="20"><path d="M 120.27106,271.98996 C 107.53249,269.14054 97.277428,258.6105 93.933365,244.94606 l -0.614486,-2.5109 0.01732,-5.28611 0.01732,-5.28611 0.565808,-2.28831 c 1.182135,-4.78093 3.08103,-9.08676 5.681377,-12.88278 l 1.376046,-2.00877 2.64306,-2.64305 2.64305,-2.64306 2.00878,-1.37605 c 3.86216,-2.64566 8.02214,-4.46924 12.92448,-5.66562 l 2.5109,-0.61277 h 5.15396 5.15395 l 2.51091,0.61277 c 4.90234,1.19638 9.06232,3.01996 12.92448,5.66562 l 2.00878,1.37605 2.64305,2.64306 2.64306,2.64305 1.37605,2.00877 c 2.64565,3.86216 4.46924,8.02214 5.66562,12.92449 l 0.61276,2.5109 v 5.15396 5.15396 l -0.61276,2.5109 c -1.19638,4.90235 -3.01997,9.06233 -5.66562,12.92448 l -1.37605,2.00878 -2.64306,2.64305 -2.64305,2.64306 -2.00878,1.37605 c -3.62697,2.48455 -9.16861,4.95456 -12.29409,5.4797 l -1.08759,0.18274 -0.29925,-1.1405 -0.29924,-1.14049 -0.90795,-1.22726 -0.90794,-1.22726 -1.49136,-0.72966 -1.49137,-0.72965 -1.27281,-0.1223 -1.27281,-0.12231 -1.33137,0.44221 c -0.73225,0.24322 -1.79683,0.77939 -2.36572,1.19149 l -1.03435,0.74928 -0.67068,1.15204 c -0.36887,0.63361 -0.75402,1.53857 -0.85587,2.01102 l -0.18519,0.85899 -0.44154,-0.0307 c -0.24284,-0.0169 -0.6794,-0.0839 -0.97014,-0.1489 z M 105.84353,240.2552 c 0.376,-0.27537 0.89801,-0.9085 1.16002,-1.40696 l 0.47637,-0.90628 -0.12219,-1.00121 c -0.22347,-1.83103 -1.43429,-3.04185 -3.26531,-3.26531 l -1.00122,-0.1222 -0.9198,0.47638 -0.9198,0.47637 -0.59996,0.89808 -0.59995,0.89808 v 0.97905 0.97905 l 0.59995,0.89808 0.59996,0.89808 0.9198,0.47637 0.9198,0.47638 1.03434,-0.12664 1.03434,-0.12664 z m 50.13146,0.075 c 0.36482,-0.23904 0.89506,-0.8147 1.17831,-1.27925 l 0.51501,-0.84463 9.9e-4,-0.95206 9.8e-4,-0.95206 -0.59995,-0.89808 -0.59996,-0.89808 -0.9198,-0.47637 -0.9198,-0.47638 -1.03434,0.12664 -1.03434,0.12663 -0.68364,0.50068 c -0.37601,0.27538 -0.89802,0.90851 -1.16002,1.40696 l -0.47638,0.90629 0.12664,1.03433 0.12663,1.03434 0.50068,0.68365 c 0.27538,0.37601 0.90851,0.89801 1.40696,1.16002 l 0.90628,0.47638 1.00122,-0.1222 c 0.55067,-0.0672 1.29971,-0.31777 1.66453,-0.55681 z m -42.52181,-18.44154 0.92852,-0.92852 0.13283,-1.17849 0.13283,-1.17849 -0.42061,-0.81338 c -0.54759,-1.05893 -1.58867,-1.86255 -2.67753,-2.06682 l -0.87119,-0.16344 -1.22674,0.54265 -1.22674,0.54264 -0.54491,1.23186 -0.54491,1.23186 0.1626,0.813 c 0.22216,1.11082 0.81643,1.95463 1.82118,2.58594 l 0.84463,0.53071 1.28076,-0.1105 1.28075,-0.1105 z m 35.25771,0.52014 0.89808,-0.59996 0.47483,-0.9198 0.47483,-0.9198 -0.15369,-1.0294 c -0.0845,-0.56617 -0.38891,-1.35973 -0.6764,-1.76348 l -0.52271,-0.73408 -1.19473,-0.45627 -1.19474,-0.45627 -1.02904,0.30831 -1.02905,0.30831 -0.68032,0.80851 c -0.82709,0.98294 -1.05834,1.81378 -0.85449,3.06998 l 0.15449,0.95197 0.73676,0.77912 c 0.89156,0.94283 1.49407,1.21403 2.74604,1.23606 l 0.95206,0.0168 z m -17.86122,-7.17694 c 0.90683,-0.59418 1.47417,-1.54818 1.61708,-2.71918 l 0.12219,-1.00122 -0.47637,-0.9198 -0.47637,-0.9198 -0.89808,-0.59995 -0.89808,-0.59996 h -0.97905 -0.97905 l -0.89808,0.59996 -0.89808,0.59995 -0.47637,0.9198 -0.47638,0.9198 0.12664,1.03434 0.12663,1.03434 0.50068,0.68365 c 0.27538,0.376 0.90851,0.89801 1.40696,1.16002 l 0.90628,0.47637 1.00122,-0.12219 c 0.55067,-0.0672 1.29237,-0.31296 1.64823,-0.54613 z" fill="currentColor"/></svg>
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
                                    <div className="slider-overlay-header">
                                        <button className="slider-overlay-back" onClick={() => this.setState({ activePopup: null })} title="Back">‹</button>
                                        <span className="slider-overlay-title">
                                            {this.state.activePopup === 'speed' ? 'Speed' : this.state.activePopup === 'gridSize' ? 'Grid Size' : `Ch${this.state.activePopup} Vol`}
                                        </span>
                                    </div>
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
                                    <button className="slider-overlay-done" onClick={() => this.setState({ activePopup: null })}>Done</button>
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
                                <div className="channel-list-body">
                                <div className="ch-select-arrow" style={{
                                    top: `${((this.state.arrowChannel - 1) / MAX_CHANNELS) * 100 + (100 / MAX_CHANNELS / 2)}%`,
                                    color: `rgb(${(CHANNEL_COLORS[this.state.arrowChannel] || CHANNEL_COLORS[1]).join(',')})`
                                }}>&#9654;</div>
                                {Array.from({ length: MAX_CHANNELS }, (_, i) => i + 1).map(ch => {
                                    const settings = this.state.channelSettings[ch] || createChannelSettings(ch);
                                    const isMuted = settings.muted || false;
                                    const progNum = settings.program ?? 0;
                                    const volPct = Math.round((settings.volume ?? 1.0) * 100);
                                    const iconKey = settings.icon || 'piano';
                                    const ICON_MAP = {
                                        piano: '🎹', guitar: '🎸', bass: '🪕', drums: '🥁', trumpet: '🎺',
                                        sax: '🎷', violin: '🎻', flute: '🪈', pad: '🌊',
                                        lead: '⚡', organ: '🪗', bell: '🔔', voice: '🎤', fx: '✨',
                                        square: '🔲', saw: '🪚', sine: '🌀', noise: '🌫️',
                                    };
                                    const iconChar = ICON_MAP[iconKey] || '🎹';
                                    return (
                                        <div key={ch} className={`channel-item`}>
                                            <div className={`channel-box ${isMuted ? 'muted' : ''}`}
                                                style={{ '--ch-color': `rgb(${(CHANNEL_COLORS[ch] || CHANNEL_COLORS[1]).join(',')})` }}
                                            >
                                                <button
                                                    className={`ch-num-btn ${CHANNEL_CSS_CLASSES[ch]} ${this.state.arrowChannel === ch ? 'active' : ''}`}
                                                    onClick={() => this.setState({ arrowChannel: ch })}
                                                    title={`Select Channel ${ch}`}
                                                >{ch}</button>
                                                <button
                                                    className={`ch-ctrl-btn ${isMuted ? 'off' : 'on'}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const newSettings = { ...this.state.channelSettings };
                                                        newSettings[ch] = { ...settings, muted: !isMuted };
                                                        this.setState({ channelSettings: newSettings });
                                                    }}
                                                    title={isMuted ? `Unmute Ch ${ch}` : `Mute Ch ${ch}`}
                                                >{isMuted ? 'OFF' : 'ON'}</button>
                                                <button
                                                    className="ch-ctrl-btn ch-vol-fixed popup-trigger-wrap"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        this.setState({ activePopup: this.state.activePopup === ch ? null : ch });
                                                    }}
                                                    title={`Ch ${ch} volume: ${volPct}%`}
                                                >{volPct}%</button>
                                                <button
                                                    className="ch-ctrl-btn ch-fx-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const isOpen = this.state.activePopup === `prog-${ch}`;
                                                        if (isOpen) {
                                                            this.setState({ activePopup: null, progModalSnapshot: null, progCloseConfirm: false });
                                                        } else {
                                                            this.setState({
                                                                arrowChannel: ch,
                                                                activePopup: `prog-${ch}`,
                                                                progModalSnapshot: { ...settings, synth: settings.synth ? { ...settings.synth } : undefined },
                                                                progInputText: String(settings.program ?? 0),
                                                                progCloseConfirm: false,
                                                            });
                                                        }
                                                    }}
                                                    title={`Ch ${ch} sound — Program ${progNum}`}
                                                ><span className="ch-fx-icon">{iconChar}</span></button>
                                            </div>
                                        </div>
                                    );
                                })}
                                </div>
                            </div>
                            {/* Program / Sound Selection modal */}
                            {typeof this.state.activePopup === 'string' && this.state.activePopup.startsWith('prog-') && (() => {
                                const ch = parseInt(this.state.activePopup.split('-')[1]);
                                const settings = this.state.channelSettings[ch] || createChannelSettings(ch);
                                const progNum = settings.program ?? 0;
                                const iconKey = settings.icon || 'piano';
                                const presetKey = settings.synthPreset || 'sine';
                                const preset = SYNTH_PRESETS[presetKey] || SYNTH_PRESETS.sine;
                                const isPerc = preset && preset.isPercussion;
                                const synthParams = settings.synth || { ...DEFAULT_SYNTH };
                                const snapshot = this.state.progModalSnapshot;
                                const hasChanges = snapshot && (
                                    snapshot.program !== settings.program ||
                                    snapshot.icon !== (settings.icon || 'piano') ||
                                    snapshot.synthPreset !== (settings.synthPreset || 'sine') ||
                                    JSON.stringify(snapshot.synth) !== JSON.stringify(settings.synth)
                                );
                                const ICONS = [
                                    ['piano', '🎹', 'Piano'],
                                    ['guitar', '🎸', 'Guitar'],
                                    ['bass', '🪕', 'Bass'],
                                    ['drums', '🥁', 'Drums'],
                                    ['trumpet', '🎺', 'Trumpet'],
                                    ['sax', '🎷', 'Sax'],
                                    ['violin', '🎻', 'Violin'],
                                    ['flute', '🪈', 'Flute'],
                                    ['pad', '🌊', 'Pad'],
                                    ['lead', '⚡', 'Lead'],
                                    ['organ', '🪗', 'Organ'],
                                    ['bell', '🔔', 'Bell'],
                                    ['voice', '🎤', 'Voice'],
                                    ['fx', '✨', 'FX'],
                                    ['square', '🔲', 'Square'],
                                    ['saw', '🪚', 'Saw'],
                                    ['sine', '🌀', 'Sine'],
                                    ['triangle', '🔺', 'Triangle'],
                                    ['noise', '🌫️', 'Noise'],
                                    ['strings', '🎼', 'Strings'],
                                    ['perc', '🪘', 'Percussion'],
                                    ['clap', '👏', 'Clap'],
                                    ['synth', '🎛️', 'Synth'],
                                    ['keys', '🎵', 'Keys'],
                                ];
                                const PRESET_ICON_MAP = {
                                    sine: 'sine', triangle: 'triangle', square: 'square', sawtooth: 'saw',
                                    pad: 'pad', lead: 'lead', bass: 'bass', pluck: 'guitar',
                                    bell: 'bell', organ: 'organ', strings: 'strings',
                                    kick: 'drums', snare: 'drums', hihat: 'perc', tom: 'drums',
                                    clap: 'clap', rim: 'perc',
                                };
                                const applyPreset = (key) => {
                                    const p = SYNTH_PRESETS[key];
                                    if (!p) return;
                                    const newSettings = { ...this.state.channelSettings };
                                    const icon = PRESET_ICON_MAP[key] || settings.icon || 'piano';
                                    if (p.isPercussion) {
                                        newSettings[ch] = { ...settings, synthPreset: key, icon };
                                    } else {
                                        newSettings[ch] = { ...settings, synthPreset: key, icon, synth: { waveform: p.waveform, attack: p.attack, decay: p.decay, sustain: p.sustain, release: p.release, cutoff: p.cutoff, resonance: p.resonance } };
                                    }
                                    this.setState({ channelSettings: newSettings });
                                };
                                const updateSynth = (param, value) => {
                                    const newSettings = { ...this.state.channelSettings };
                                    newSettings[ch] = { ...settings, synth: { ...synthParams, [param]: value } };
                                    this.setState({ channelSettings: newSettings });
                                };
                                const nudgePreset = (delta) => {
                                    const idx = ALL_PRESET_KEYS.indexOf(presetKey);
                                    const next = ((idx + delta) % ALL_PRESET_KEYS.length + ALL_PRESET_KEYS.length) % ALL_PRESET_KEYS.length;
                                    applyPreset(ALL_PRESET_KEYS[next]);
                                };
                                const sendProg = (val) => {
                                    const clamped = Math.max(0, Math.min(127, val));
                                    const newSettings = { ...this.state.channelSettings };
                                    newSettings[ch] = { ...settings, program: clamped };
                                    sendProgramChange(ch, clamped);
                                    this.setState({ channelSettings: newSettings, progInputText: String(clamped) });
                                };
                                const applyInputText = () => {
                                    const val = parseInt(this.state.progInputText);
                                    if (!isNaN(val)) sendProg(val);
                                    else this.setState({ progInputText: String(progNum) });
                                };
                                const closeOk = () => {
                                    this.setState({ activePopup: null, progModalSnapshot: null, progCloseConfirm: false });
                                };
                                const closeCancel = () => {
                                    if (snapshot) {
                                        const newSettings = { ...this.state.channelSettings };
                                        newSettings[ch] = { ...snapshot };
                                        if (snapshot.program !== settings.program) sendProgramChange(ch, snapshot.program);
                                        this.setState({ channelSettings: newSettings, activePopup: null, progModalSnapshot: null, progCloseConfirm: false });
                                    } else {
                                        this.setState({ activePopup: null, progModalSnapshot: null, progCloseConfirm: false });
                                    }
                                };
                                const closeX = () => {
                                    if (hasChanges && !this.state.progCloseConfirm) {
                                        this.setState({ progCloseConfirm: true });
                                    } else {
                                        closeOk();
                                    }
                                };
                                return (
                                    <div className="prog-modal-overlay" onClick={closeX} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
                                        <div className="prog-modal" onClick={(e) => e.stopPropagation()}
                                            style={{
                                                '--ch-color': `rgb(${(CHANNEL_COLORS[ch] || CHANNEL_COLORS[1]).join(',')})`,
                                                '--ch-color-glow': `rgba(${(CHANNEL_COLORS[ch] || CHANNEL_COLORS[1]).join(',')}, 0.4)`,
                                            }}
                                        >
                                            <div className="prog-modal-header">
                                                <strong>Channel {ch} — Sound</strong>
                                                <button className="prog-modal-close" onClick={closeX} title="Close">✕</button>
                                            </div>

                                            {/* Section: Icon Selection */}
                                            <div className="prog-section">
                                                <div className="prog-section-label">Icon</div>
                                                <div className="prog-icon-grid">
                                                    {ICONS.map(([key, emoji, label]) => (
                                                        <button
                                                            key={key}
                                                            className={`prog-icon-btn ${iconKey === key ? 'active' : ''}`}
                                                            onClick={() => {
                                                                const newSettings = { ...this.state.channelSettings };
                                                                newSettings[ch] = { ...settings, icon: key };
                                                                this.setState({ channelSettings: newSettings });
                                                            }}
                                                            title={label}
                                                        ><span className="icon-glyph">{emoji}</span></button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* ── Synth Preset ── */}
                                            <div className="prog-group-label"><svg viewBox="0 0 24 24" width="14" height="14" style={{verticalAlign: '-2px', marginRight: '5px'}}><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" fill="currentColor"/></svg>Synth</div>

                                            <div className="prog-section">
                                                <div className="prog-section-label">Preset</div>
                                                <div className="prog-synth-select-row">
                                                    <button className="key-nudge-btn" onClick={() => nudgePreset(-1)} title="Previous preset">◀</button>
                                                    <select
                                                        className="sel prog-synth-sel"
                                                        value={presetKey}
                                                        onChange={(e) => applyPreset(e.target.value)}
                                                    >
                                                        {PRESET_GROUPS.map(group => (
                                                            <optgroup key={group.label} label={group.label}>
                                                                {group.keys.map(k => (
                                                                    <option key={k} value={k}>{SYNTH_PRESETS[k].name}</option>
                                                                ))}
                                                            </optgroup>
                                                        ))}
                                                    </select>
                                                    <button className="key-nudge-btn" onClick={() => nudgePreset(1)} title="Next preset">▶</button>
                                                </div>
                                            </div>

                                            {/* ── Synth Parameters / Percussion hint ── */}
                                            <div className="prog-section">
                                                {!isPerc ? (
                                                    <details className="synth-params-details">
                                                        <summary className="prog-section-label synth-params-toggle">Parameters</summary>
                                                    <div className="synth-params-body"><div className="synth-params">
                                                        <label className="synth-param-row">
                                                            <span className="synth-param-name">Waveform</span>
                                                            <select className="sel synth-waveform-sel" value={synthParams.waveform || 'sine'} onChange={(e) => updateSynth('waveform', e.target.value)}>
                                                                <option value="sine">Sine</option>
                                                                <option value="triangle">Triangle</option>
                                                                <option value="square">Square</option>
                                                                <option value="sawtooth">Sawtooth</option>
                                                            </select>
                                                        </label>
                                                        <label className="synth-param-row">
                                                            <span className="synth-param-name">Attack</span>
                                                            <input type="range" className="synth-slider" min="0.001" max="1" step="0.001" value={synthParams.attack} onChange={(e) => updateSynth('attack', parseFloat(e.target.value))} />
                                                            <span className="synth-param-val">{synthParams.attack.toFixed(3)}</span>
                                                        </label>
                                                        <label className="synth-param-row">
                                                            <span className="synth-param-name">Decay</span>
                                                            <input type="range" className="synth-slider" min="0.001" max="1" step="0.001" value={synthParams.decay} onChange={(e) => updateSynth('decay', parseFloat(e.target.value))} />
                                                            <span className="synth-param-val">{synthParams.decay.toFixed(3)}</span>
                                                        </label>
                                                        <label className="synth-param-row">
                                                            <span className="synth-param-name">Sustain</span>
                                                            <input type="range" className="synth-slider" min="0" max="1" step="0.01" value={synthParams.sustain} onChange={(e) => updateSynth('sustain', parseFloat(e.target.value))} />
                                                            <span className="synth-param-val">{synthParams.sustain.toFixed(2)}</span>
                                                        </label>
                                                        <label className="synth-param-row">
                                                            <span className="synth-param-name">Release</span>
                                                            <input type="range" className="synth-slider" min="0.01" max="2" step="0.01" value={synthParams.release} onChange={(e) => updateSynth('release', parseFloat(e.target.value))} />
                                                            <span className="synth-param-val">{synthParams.release.toFixed(2)}</span>
                                                        </label>
                                                        <label className="synth-param-row">
                                                            <span className="synth-param-name">Cutoff</span>
                                                            <input type="range" className="synth-slider" min="100" max="10000" step="10" value={synthParams.cutoff} onChange={(e) => updateSynth('cutoff', parseFloat(e.target.value))} />
                                                            <span className="synth-param-val">{Math.round(synthParams.cutoff)}</span>
                                                        </label>
                                                        <label className="synth-param-row">
                                                            <span className="synth-param-name">Resonance</span>
                                                            <input type="range" className="synth-slider" min="0.1" max="15" step="0.1" value={synthParams.resonance} onChange={(e) => updateSynth('resonance', parseFloat(e.target.value))} />
                                                            <span className="synth-param-val">{synthParams.resonance.toFixed(1)}</span>
                                                        </label>
                                                    </div></div>
                                                    </details>
                                                ) : (
                                                    <div className="prog-section-label synth-params-toggle perc-hint-row">Percussion — pitch varies by grid position</div>
                                                )}
                                            </div>

                                            {/* ── External MIDI ── */}
                                            <div className="prog-group-label"><svg viewBox="93 201 72 71" width="18" height="18" style={{verticalAlign: '-3px', marginRight: '5px'}}><path d="M 120.27106,271.98996 C 107.53249,269.14054 97.277428,258.6105 93.933365,244.94606 l -0.614486,-2.5109 0.01732,-5.28611 0.01732,-5.28611 0.565808,-2.28831 c 1.182135,-4.78093 3.08103,-9.08676 5.681377,-12.88278 l 1.376046,-2.00877 2.64306,-2.64305 2.64305,-2.64306 2.00878,-1.37605 c 3.86216,-2.64566 8.02214,-4.46924 12.92448,-5.66562 l 2.5109,-0.61277 h 5.15396 5.15395 l 2.51091,0.61277 c 4.90234,1.19638 9.06232,3.01996 12.92448,5.66562 l 2.00878,1.37605 2.64305,2.64306 2.64306,2.64305 1.37605,2.00877 c 2.64565,3.86216 4.46924,8.02214 5.66562,12.92449 l 0.61276,2.5109 v 5.15396 5.15396 l -0.61276,2.5109 c -1.19638,4.90235 -3.01997,9.06233 -5.66562,12.92448 l -1.37605,2.00878 -2.64306,2.64305 -2.64305,2.64306 -2.00878,1.37605 c -3.62697,2.48455 -9.16861,4.95456 -12.29409,5.4797 l -1.08759,0.18274 -0.29925,-1.1405 -0.29924,-1.14049 -0.90795,-1.22726 -0.90794,-1.22726 -1.49136,-0.72966 -1.49137,-0.72965 -1.27281,-0.1223 -1.27281,-0.12231 -1.33137,0.44221 c -0.73225,0.24322 -1.79683,0.77939 -2.36572,1.19149 l -1.03435,0.74928 -0.67068,1.15204 c -0.36887,0.63361 -0.75402,1.53857 -0.85587,2.01102 l -0.18519,0.85899 -0.44154,-0.0307 c -0.24284,-0.0169 -0.6794,-0.0839 -0.97014,-0.1489 z M 105.84353,240.2552 c 0.376,-0.27537 0.89801,-0.9085 1.16002,-1.40696 l 0.47637,-0.90628 -0.12219,-1.00121 c -0.22347,-1.83103 -1.43429,-3.04185 -3.26531,-3.26531 l -1.00122,-0.1222 -0.9198,0.47638 -0.9198,0.47637 -0.59996,0.89808 -0.59995,0.89808 v 0.97905 0.97905 l 0.59995,0.89808 0.59996,0.89808 0.9198,0.47637 0.9198,0.47638 1.03434,-0.12664 1.03434,-0.12664 z m 50.13146,0.075 c 0.36482,-0.23904 0.89506,-0.8147 1.17831,-1.27925 l 0.51501,-0.84463 9.9e-4,-0.95206 9.8e-4,-0.95206 -0.59995,-0.89808 -0.59996,-0.89808 -0.9198,-0.47637 -0.9198,-0.47638 -1.03434,0.12664 -1.03434,0.12663 -0.68364,0.50068 c -0.37601,0.27538 -0.89802,0.90851 -1.16002,1.40696 l -0.47638,0.90629 0.12664,1.03433 0.12663,1.03434 0.50068,0.68365 c 0.27538,0.37601 0.90851,0.89801 1.40696,1.16002 l 0.90628,0.47638 1.00122,-0.1222 c 0.55067,-0.0672 1.29971,-0.31777 1.66453,-0.55681 z m -42.52181,-18.44154 0.92852,-0.92852 0.13283,-1.17849 0.13283,-1.17849 -0.42061,-0.81338 c -0.54759,-1.05893 -1.58867,-1.86255 -2.67753,-2.06682 l -0.87119,-0.16344 -1.22674,0.54265 -1.22674,0.54264 -0.54491,1.23186 -0.54491,1.23186 0.1626,0.813 c 0.22216,1.11082 0.81643,1.95463 1.82118,2.58594 l 0.84463,0.53071 1.28076,-0.1105 1.28075,-0.1105 z m 35.25771,0.52014 0.89808,-0.59996 0.47483,-0.9198 0.47483,-0.9198 -0.15369,-1.0294 c -0.0845,-0.56617 -0.38891,-1.35973 -0.6764,-1.76348 l -0.52271,-0.73408 -1.19473,-0.45627 -1.19474,-0.45627 -1.02904,0.30831 -1.02905,0.30831 -0.68032,0.80851 c -0.82709,0.98294 -1.05834,1.81378 -0.85449,3.06998 l 0.15449,0.95197 0.73676,0.77912 c 0.89156,0.94283 1.49407,1.21403 2.74604,1.23606 l 0.95206,0.0168 z m -17.86122,-7.17694 c 0.90683,-0.59418 1.47417,-1.54818 1.61708,-2.71918 l 0.12219,-1.00122 -0.47637,-0.9198 -0.47637,-0.9198 -0.89808,-0.59995 -0.89808,-0.59996 h -0.97905 -0.97905 l -0.89808,0.59996 -0.89808,0.59995 -0.47637,0.9198 -0.47638,0.9198 0.12664,1.03434 0.12663,1.03434 0.50068,0.68365 c 0.27538,0.376 0.90851,0.89801 1.40696,1.16002 l 0.90628,0.47637 1.00122,-0.12219 c 0.55067,-0.0672 1.29237,-0.31296 1.64823,-0.54613 z" fill="currentColor"/></svg>External MIDI</div>

                                            {/* MIDI Program Selection */}
                                            <div className="prog-section">
                                                <div className="prog-section-label">MIDI Program</div>
                                                <p className="prog-section-hint">Set a sound on a remote / USB-connected MIDI device</p>
                                                <div className="prog-modal-input-row">
                                                    <button
                                                        className="prog-inc-btn"
                                                        onClick={() => sendProg(((progNum - 1) % 128 + 128) % 128)}
                                                        title="Previous program"
                                                    >◀</button>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={this.state.progInputText}
                                                        className="prog-modal-input"
                                                        onChange={(e) => {
                                                            const v = e.target.value;
                                                            if (v === '' || /^\d{0,3}$/.test(v)) {
                                                                this.setState({ progInputText: v });
                                                            }
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') applyInputText();
                                                            else if (e.key === 'Escape') closeX();
                                                        }}
                                                        onBlur={() => applyInputText()}
                                                    />
                                                    <button
                                                        className="prog-inc-btn"
                                                        onClick={() => sendProg((progNum + 1) % 128)}
                                                        title="Next program"
                                                    >▶</button>
                                                </div>
                                            </div>

                                            {/* Close confirmation popup */}
                                            {this.state.progCloseConfirm && (
                                                <div className="prog-confirm-overlay" onClick={(e) => e.stopPropagation()}>
                                                    <div className="prog-confirm-popup">
                                                        <div className="prog-confirm-msg">⚠ Unsaved changes will be lost</div>
                                                        <div className="prog-confirm-actions">
                                                            <button className="prog-confirm-discard" onClick={closeOk}>Discard</button>
                                                            <button className="prog-confirm-stay" onClick={() => this.setState({ progCloseConfirm: false })}>Stay</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Footer: OK / Cancel */}
                                            <div className="prog-modal-footer">
                                                <button className="prog-footer-btn prog-btn-cancel" onClick={closeCancel} title="Revert all changes and close">Cancel</button>
                                                <button className="prog-footer-btn prog-btn-ok" onClick={closeOk} title="Keep changes and close"
                                                    style={{ color: (() => { const c = CHANNEL_COLORS[ch] || CHANNEL_COLORS[1]; return (c[0]*0.299 + c[1]*0.587 + c[2]*0.114) > 186 ? '#000' : '#fff'; })() }}
                                                >OK</button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* ── CENTER CANVAS ── */}
                        <div className="canvas-area" data-step="5" data-intro="Click on the grid to place arrows!">
                            {(() => {
                                const gridSize = this.state.grid.size;
                                const canvasSize = getGridCanvasSize();
                                const border = 2;
                                const cellSize = canvasSize / gridSize;
                                const scale = this.state.scale;
                                const mKey = this.state.musicalKey;
                                const getNoteLabel = (idx) => {
                                    const midi = mKey + scale[idx % scale.length];
                                    if (midi < 21 || midi > 108) return '';
                                    return musicalNotes[midi - 21].toUpperCase();
                                };
                                return (
                                    <div className="grid-label-wrapper" style={{ position: 'relative' }}>
                                        {/* Column labels (top) */}
                                        <div className="grid-labels grid-labels-top">
                                            {range(0, gridSize).map(i => (
                                                <span key={i} className="grid-note-label" style={{
                                                    left: border + i * cellSize + cellSize / 2,
                                                    width: cellSize
                                                }}>{getNoteLabel(i)}</span>
                                            ))}
                                        </div>
                                        {/* Row labels (left) */}
                                        <div className="grid-labels grid-labels-left">
                                            {range(0, gridSize).map(i => (
                                                <span key={i} className="grid-note-label" style={{
                                                    top: border + i * cellSize + cellSize / 2
                                                }}>{getNoteLabel(i)}</span>
                                            ))}
                                        </div>
                                        <div id="sketch-holder" />
                                    </div>
                                );
                            })()}
                        </div>

                        {/* ── RIGHT PANEL ── */}
                        <div className="side-panel" style={{position:'relative'}}>
                            {/* Slider overlay for right panel */}
                            {(this.state.activePopup === 'arrowVol' || this.state.activePopup === 'masterVol') && (
                                <div className="slider-overlay popup-trigger-wrap" onClick={(e) => e.stopPropagation()}>
                                    <div className="slider-overlay-header">
                                        <button className="slider-overlay-back" onClick={() => this.setState({ activePopup: null })} title="Back">‹</button>
                                        <span className="slider-overlay-title">{this.state.activePopup === 'arrowVol' ? 'Arrow Volume' : 'Master Volume'}</span>
                                    </div>
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
                                    <button className="slider-overlay-done" onClick={() => this.setState({ activePopup: null })}>Done</button>
                                </div>
                            )}
                            {/* Channel select overlay */}
                            {this.state.activePopup === 'chSelect' && (
                                <div className="slider-overlay ch-select-overlay popup-trigger-wrap" onClick={(e) => e.stopPropagation()}>
                                    <div className="slider-overlay-header">
                                        <button className="slider-overlay-back" onClick={() => this.setState({ activePopup: null })} title="Back">‹</button>
                                        <span className="slider-overlay-title">Select Channel</span>
                                    </div>
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
                                    <button className="slider-overlay-done" onClick={() => this.setState({ activePopup: null })}>Done</button>
                                </div>
                            )}
                            {/* Draw Tools */}
                            <div className={`panel-group draw-panel ${!this.state.deleting ? 'draw-active' : ''}`}>
                                <h3>Draw</h3>

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
                                            onClick={(e) => { e.stopPropagation(); this.setState({ activePopup: this.state.activePopup === 'chSelect' ? null : 'chSelect', drawMode: 'arrow', deleting: false }); }}
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

                                {/* ── Symmetry (inside Draw section) ── */}
                                {(() => {
                                    const anySym = this.state.verticalSymmetry || this.state.horizontalSymmetry || this.state.forwardDiagonalSymmetry || this.state.backwardDiagonalSymmetry;
                                    return (
                                        <div className={`draw-tool-group ${!this.state.deleting && anySym ? 'active-section' : 'inactive-section'}`}>
                                            <span className="group-label">Symmetry</span>
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
                                    );
                                })()}
                            </div>

                            {/* ── Erase Panel ── */}
                            <div className={`panel-group erase-panel ${this.state.deleting ? 'erase-panel-active' : ''}`}
                                 onClick={() => this.setState({ deleting: true })}
                            >
                                <h3>Erase</h3>
                                <div className="erase-grid">
                                    <button
                                        className={`tool-btn ${this.state.deleting && this.state.eraseTarget === 'arrows' ? 'active' : ''}`}
                                        onClick={(e) => { e.stopPropagation(); this.setState({ deleting: true, eraseTarget: 'arrows' }); }}
                                        title="Erase arrows only"
                                    >
                                        <svg viewBox="0 0 24 24" width="14" height="14"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" fill="currentColor"/></svg>
                                        <span>Arrows</span>
                                    </button>
                                    <button
                                        className={`tool-btn ${this.state.deleting && this.state.eraseTarget === 'walls' ? 'active' : ''}`}
                                        onClick={(e) => { e.stopPropagation(); this.setState({ deleting: true, eraseTarget: 'walls' }); }}
                                        title="Erase walls only"
                                    >
                                        <svg viewBox="0 0 24 24" width="14" height="14"><rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/></svg>
                                        <span>Walls</span>
                                    </button>
                                    <button
                                        className={`tool-btn wide ${this.state.deleting && this.state.eraseTarget === 'both' ? 'active' : ''}`}
                                        onClick={(e) => { e.stopPropagation(); this.setState({ deleting: true, eraseTarget: 'both' }); }}
                                        title="Erase both arrows and walls"
                                    >
                                        <svg viewBox="0 0 24 24" width="14" height="14"><path d="M15.14 3c-.51 0-1.02.2-1.41.59L2.59 14.73c-.78.77-.78 2.04 0 2.83L5.03 20h8.94l7.44-7.44c.79-.78.79-2.04 0-2.83l-4.86-4.86c-.39-.39-.9-.59-1.41-.59zM6.1 18l-1.66-1.66 5.48-5.48 1.66 1.66L6.1 18z" fill="currentColor"/></svg>
                                        <span>Both</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Footer: Music Settings ── */}
                    <footer className="console-footer">
                        <div className="footer-group">
                            <label>Scale</label>
                            <button className="key-nudge-btn" onClick={() => this.nudgeScale(-1)} title="Previous scale">▼</button>
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
                            <button className="key-nudge-btn" onClick={() => this.nudgeScale(1)} title="Next scale">▲</button>
                        </div>
                        <div className="footer-group">
                            <label>Key</label>
                            <button className="key-nudge-btn" onClick={() => this.nudgeMusicalKey(-1)} title="Key down">▼</button>
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
                            <button className="key-nudge-btn" onClick={() => this.nudgeMusicalKey(1)} title="Key up">▲</button>
                        </div>
                        <div className="footer-group">
                            <label>MIDI Out</label>
                            <select id="midiOut" className="sel">
                                <option value="">None</option>
                            </select>
                            {!isMidiConnected() && (
                                <button
                                    className="midi-help-btn"
                                    onClick={() => this.setState({ showMidiHelp: !this.state.showMidiHelp })}
                                    title="MIDI setup help"
                                >
                                    <svg viewBox="0 0 24 24" width="14" height="14"><path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z" fill="currentColor"/></svg>
                                </button>
                            )}
                            {this.state.showMidiHelp && (
                                <div className="midi-help-popup">
                                    <div className="midi-help-popup-header">
                                        <strong>Enable MIDI Access</strong>
                                        <button className="midi-help-close" onClick={() => this.setState({ showMidiHelp: false })}>✕</button>
                                    </div>
                                    <ol className="midi-help-steps">
                                        <li>Connect your MIDI device via USB</li>
                                        <li>In Chrome, go to <strong>Settings → Privacy & Security → Site Settings</strong></li>
                                        <li>Scroll to <strong>MIDI devices</strong> and set to <strong>Allow</strong></li>
                                        <li>Alternatively, click the lock icon in the address bar and enable <strong>MIDI</strong></li>
                                        <li>Reload the page — your device should appear in the dropdown</li>
                                    </ol>
                                    <button className="midi-help-rescan" onClick={() => this.setState({ showMidiHelp: false })}>Got It</button>
                                </div>
                            )}
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

                    {/* ── Action bar ── */}
                    <div className="action-bar">
                        <span className="footer-copyright">© {new Date().getFullYear()} Nathaniel Young</span>
                        <div className="action-bar-buttons">
                            <button className="action-btn" onClick={this.saveToLocalStorage} title="Save to browser (Ctrl+S)">
                                <svg viewBox="0 0 24 24" width="14" height="14"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" fill="currentColor"/></svg>
                                <span>Save</span>
                            </button>
                            <button className="action-btn" onClick={this.loadFromLocalStorage} title="Browse saved grids">
                                <svg viewBox="0 0 24 24" width="14" height="14"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z" fill="currentColor"/></svg>
                                <span>Browse</span>
                            </button>
                            <button className="action-btn" onClick={this.exportGrid} title="Download current grid as JSON file">
                                <svg viewBox="0 0 24 24" width="14" height="14"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor"/></svg>
                                <span>Download</span>
                            </button>
                            <button className="action-btn" onClick={this.importGrid} title="Upload a grid from JSON file">
                                <svg viewBox="0 0 24 24" width="14" height="14"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z" fill="currentColor"/></svg>
                                <span>Upload</span>
                            </button>
                            <button className="action-btn share-btn" onClick={this.share} title="Copy a link to share this creation">
                                <svg viewBox="0 0 24 24" width="14" height="14"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" fill="currentColor"/></svg>
                                <span>Share</span>
                            </button>
                        </div>
                        <a href="https://nathaniel-young.com" target="_blank" rel="noopener noreferrer" className="footer-discover">🔗 Discover more at nathaniel-young.com →</a>
                    </div>
                </div>

                {/* ── Toast notification ── */}
                {this.state.toast && (
                    <div className="toast">{this.state.toast}</div>
                )}

                {/* ── Intro Modal ── */}
                {this.state.showIntro && (
                    <div className="intro-overlay" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); const el = document.querySelector('.intro-sound-choice'); el.classList.remove('highlight'); void el.offsetWidth; el.classList.add('highlight'); }}>
                        <div className="intro-modal" onClick={(e) => e.stopPropagation()}>
                            <h2><span className="title-arrow">➤</span> AG16</h2>
                            <p className="intro-tagline">An audio-visual instrument that creates rhythms and melodies from bouncing arrows on a grid.</p>

                            <div className="intro-steps-visual">
                                <div className="intro-step-card" onClick={() => { const el = document.querySelector('.intro-sound-choice'); el.classList.remove('highlight'); void el.offsetWidth; el.classList.add('highlight'); }}>
                                    <div className="intro-step-icon">👆</div>
                                    <div className="intro-step-text">
                                        <strong>Click the grid</strong>
                                        <span>Place arrows that move and bounce</span>
                                    </div>
                                </div>
                                <div className="intro-step-card" onClick={() => { const el = document.querySelector('.intro-sound-choice'); el.classList.remove('highlight'); void el.offsetWidth; el.classList.add('highlight'); }}>
                                    <div className="intro-step-icon">
                                        <div className="intro-play-icon">
                                            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M8 5v14l11-7z" fill="white"/></svg>
                                        </div>
                                    </div>
                                    <div className="intro-step-text">
                                        <strong>Press Play</strong>
                                        <span>Arrows trigger notes as they move</span>
                                    </div>
                                </div>
                                <div className="intro-step-card" onClick={() => { const el = document.querySelector('.intro-sound-choice'); el.classList.remove('highlight'); void el.offsetWidth; el.classList.add('highlight'); }}>
                                    <div className="intro-step-icon">
                                        <div className="intro-color-dots">
                                            <span style={{background:'rgb(102,126,234)'}}></span>
                                            <span style={{background:'rgb(234,102,102)'}}></span>
                                            <span style={{background:'rgb(102,234,168)'}}></span>
                                            <span style={{background:'rgb(234,196,102)'}}></span>
                                        </div>
                                    </div>
                                    <div className="intro-step-text">
                                        <strong>Choose Channels</strong>
                                        <span>Each channel has its own color and sound</span>
                                    </div>
                                </div>
                                <div className="intro-step-card" onClick={() => { const el = document.querySelector('.intro-sound-choice'); el.classList.remove('highlight'); void el.offsetWidth; el.classList.add('highlight'); }}>
                                    <div className="intro-step-icon">
                                        <span className="intro-key-hint">← →</span>
                                    </div>
                                    <div className="intro-step-text">
                                        <strong>Explore Presets</strong>
                                        <span>Browse with arrow keys or the preset controls</span>
                                    </div>
                                </div>
                            </div>

                            <div className="intro-sound-choice">
                                <button className="intro-close-btn sound-on" onClick={() => { localStorage.setItem('arrowgrid-seen', '1'); localStorage.setItem('arrowgrid-sound', 'on'); this.setState({ showIntro: false, soundOn: true }, () => this.play()); }}>
                                    🔊 Start with Sound
                                </button>
                                <button className="intro-close-btn sound-off" onClick={() => { localStorage.setItem('arrowgrid-seen', '1'); localStorage.setItem('arrowgrid-sound', 'off'); this.setState({ showIntro: false, soundOn: false }, () => this.play()); }}>
                                    🔇 Start without Sound
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Info Modal ── */}
                {this.state.showInfo && (
                    <div className="info-overlay" onClick={() => this.setState({ showInfo: false })}>
                        <div className="info-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="info-modal-header">
                                <h2><span className="title-arrow">➤</span> AG16</h2>
                                <button className="info-modal-close" onClick={() => this.setState({ showInfo: false })}>×</button>
                            </div>
                            <div className="info-modal-body">
                                <section>
                                    <h3>What is AG16?</h3>
                                    <p>AG16 is an audio-visual instrument that creates rhythms and melodies from bouncing arrows on a grid. Place arrows, hit play, and watch them move — each bounce triggers a musical note. It's part sequencer, part generative art, part toy.</p>
                                </section>
                                <section>
                                    <h3>Getting Started</h3>
                                    <ul>
                                        <li><strong>Click</strong> any cell to place an arrow in the current direction and channel.</li>
                                        <li><strong>Shift+Click</strong> to remove an arrow.</li>
                                        <li>Press <strong>Space</strong> to play/pause the simulation.</li>
                                        <li>Use <strong>← →</strong> arrow keys to browse built-in presets.</li>
                                        <li>Use <strong>↑ ↓</strong> arrow keys to switch channels.</li>
                                    </ul>
                                </section>
                                <section>
                                    <h3>Channels</h3>
                                    <p>There are 16 channels, each with its own color. Select a channel before placing arrows to assign them. Each channel has independent volume control and mute toggle. Click a channel's volume button to open a full-height slider overlay. Click the sound icon to open synth and FX settings.</p>
                                </section>
                                <section>
                                    <h3>Walls</h3>
                                    <p>Switch to <strong>Wall mode</strong> (press <strong>W</strong>) to place walls between cells. Arrows bounce off walls, creating more complex patterns. Walls can be placed on any edge between adjacent cells.</p>
                                </section>
                                <section>
                                    <h3>Symmetry</h3>
                                    <p>Enable horizontal, vertical, or diagonal symmetry to automatically mirror your placements across the grid. Combine multiple symmetries for kaleidoscopic patterns.</p>
                                </section>
                                <section>
                                    <h3>Musical Settings</h3>
                                    <ul>
                                        <li><strong>Speed</strong> — controls how fast arrows move (BPM).</li>
                                        <li><strong>Grid Size</strong> — resize from 2×2 up to 20×20.</li>
                                        <li><strong>Scale</strong> — choose from major, minor, pentatonic, modal, exotic, and chromatic scales.</li>
                                        <li><strong>Key</strong> — set the root note (C through B).</li>
                                        <li><strong>Master Volume</strong> — global output level.</li>
                                    </ul>
                                </section>
                                <section>
                                    <h3>MIDI</h3>
                                    <p>Enable MIDI to send note data to external instruments or your DAW. Select MIDI input and output devices from the footer. Each channel sends on its corresponding MIDI channel.</p>
                                </section>
                                <section>
                                    <h3>Save &amp; Share</h3>
                                    <ul>
                                        <li><strong>Save</strong> — name and store your creations in the browser.</li>
                                        <li><strong>Browse</strong> — open the saved grid manager to browse, load, or delete saved grids.</li>
                                        <li><strong>Export / Import</strong> — download your grid as a JSON file, or load one from disk.</li>
                                        <li><strong>Share This Creation</strong> — copy a URL that encodes your grid so others can load it.</li>
                                    </ul>
                                </section>
                                <section>
                                    <h3>Keyboard Shortcuts</h3>
                                    <table className="info-shortcuts">
                                        <tbody>
                                            <tr><td><kbd>Space</kbd></td><td>Play / Pause</td></tr>
                                            <tr><td><kbd>← →</kbd></td><td>Previous / Next preset</td></tr>
                                            <tr><td><kbd>↑ ↓</kbd></td><td>Previous / Next channel</td></tr>
                                            <tr><td><kbd>1 2 3 4</kbd></td><td>Arrow behavior (straight, right, bounce, left)</td></tr>
                                            <tr><td><kbd>M</kbd></td><td>Mute / Unmute</td></tr>
                                            <tr><td><kbd>E</kbd></td><td>Toggle edit mode (delete)</td></tr>
                                            <tr><td><kbd>W</kbd></td><td>Toggle wall mode</td></tr>
                                            <tr><td><kbd>Ctrl+Z</kbd></td><td>Undo</td></tr>
                                            <tr><td><kbd>Ctrl+Shift+Z</kbd> / <kbd>Ctrl+Y</kbd></td><td>Redo</td></tr>
                                            <tr><td><kbd>Ctrl+S</kbd></td><td>Save</td></tr>
                                            <tr><td><kbd>Delete</kbd></td><td>Clear grid</td></tr>
                                        </tbody>
                                    </table>
                                </section>
                                <section className="info-credits">
                                    <p>Created by <a href="https://nathaniel-young.com" target="_blank" rel="noopener noreferrer">Nathaniel Young</a></p>
                                </section>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Save Manager Modal ── */}
                {this.state.showSaveManager && (
                    <div className="save-manager-overlay" onClick={() => this.setState({ showSaveManager: false, confirmDeleteIndex: null })}>
                        <div className="save-manager-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="save-manager-header">
                                <h2>Saved Grids</h2>
                                <button className="save-manager-close" onClick={() => this.setState({ showSaveManager: false, confirmDeleteIndex: null })}>×</button>
                            </div>

                            {/* Save new */}
                            <div className="save-manager-new">
                                <input
                                    type="text"
                                    className="save-name-input"
                                    placeholder="Name this creation…"
                                    value={this.state.saveNameInput}
                                    onChange={(e) => this.setState({ saveNameInput: e.target.value })}
                                    onKeyDown={(e) => { if (e.key === 'Enter') this.saveWithName(this.state.saveNameInput); }}
                                    maxLength={40}
                                    autoFocus
                                />
                                <button
                                    className="save-confirm-btn"
                                    onClick={() => this.saveWithName(this.state.saveNameInput)}
                                    disabled={!this.state.saveNameInput.trim()}
                                >
                                    Save
                                </button>
                            </div>

                            {/* Saved list */}
                            <div className="save-manager-list">
                                {this.state.savedGrids.length === 0 ? (
                                    <div className="save-manager-empty">No saved grids yet. Name your creation above!</div>
                                ) : (
                                    this.state.savedGrids.map((entry, i) => (
                                        <div className="save-manager-item" key={i} onClick={() => this.loadSavedGrid(i)}>
                                            <div className="save-item-play-icon">
                                                <svg viewBox="0 0 24 24" width="14" height="14"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>
                                            </div>
                                            <div className="save-item-info">
                                                <span className="save-item-name">{entry.name}</span>
                                                <span className="save-item-date">{new Date(entry.date).toLocaleDateString()}</span>
                                            </div>
                                            <div className="save-item-actions">
                                                {this.state.confirmDeleteIndex === i ? (
                                                    <>
                                                        <span className="save-item-confirm-label">Delete?</span>
                                                        <button className="save-item-btn confirm-yes" onClick={(e) => { e.stopPropagation(); this.deleteSavedGrid(i); }} title="Confirm delete">
                                                            <svg viewBox="0 0 24 24" width="12" height="12"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/></svg>
                                                        </button>
                                                        <button className="save-item-btn confirm-no" onClick={(e) => { e.stopPropagation(); this.setState({ confirmDeleteIndex: null }); }} title="Cancel">
                                                            <svg viewBox="0 0 24 24" width="12" height="12"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/></svg>
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button className="save-item-btn delete" onClick={(e) => { e.stopPropagation(); this.setState({ confirmDeleteIndex: i }); }} title="Delete">
                                                        <svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/></svg>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Import / Export all */}
                            <div className="save-manager-footer">
                                <p className="save-manager-tip">💡 Browser saves can be lost if you clear site data. Use <strong>Download All</strong> to keep a backup file.</p>
                                <button className="save-manager-action-btn" onClick={this.exportAllSaves} title="Download all saves as JSON">
                                    <svg viewBox="0 0 24 24" width="12" height="12"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor"/></svg>
                                    Download All
                                </button>
                                <button className="save-manager-action-btn" onClick={this.importGrid} title="Upload a grid from JSON file">
                                    <svg viewBox="0 0 24 24" width="12" height="12"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z" fill="currentColor"/></svg>
                                    Upload
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }
}