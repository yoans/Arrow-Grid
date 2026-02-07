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
    setWallRemover
} from './animations';
import {setSliderOnChange} from './sliders';
import { rescanMIDI } from './midi';
import presets from './presets';
import Chance from 'chance';
import scales from './scales';

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
            muted: true,
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

            gridStep: 0,
            showCollisions: true
        };
    }

    componentDidMount() {
        // Set up canvas after component is mounted (DOM is ready)
        setUpCanvas(this.state);
        
        const idsAndCallbacks = [
            {id: '#grid-size-slider', onChange: this.newSize},
            {id: '#note-length-slider', onChange: this.newNoteLength}
        ];
        setSliderOnChange(idsAndCallbacks);
        getAdderWithMousePosition(this.addToGrid)();
        setWallToggler(this.toggleWall);
        setWallPlacer(this.addWallAtCell);
        setWallRemover(this.removeWall);
        
        // Add keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyDown);
        
        // Auto-play after a short delay to show users what the app does
        setTimeout(() => this.play(), 500);
    }
    
    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeyDown);
        clearTimeout(this._timerID);
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
            default:
                break;
        }
    }
    
    prevPreset = () => {
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
        const willUnmute = this.state.muted;
        // If unmuting, start audio context now (we're in a user gesture)
        if (willUnmute) {
            try {
                await Tone.start();
            } catch (e) { /* ignore */ }
        }
        this.setState({ muted: !this.state.muted }, () => {
            if (!this.state.muted) sound.play();
        });
    }
    changeEditMode = () => {
        this.setState({ deleting: !this.state.deleting });
    }
    toggleWall = (wallKey) => {
        const walls = this.state.grid.walls || [];
        const idx = walls.indexOf(wallKey);
        const newWalls = idx >= 0
            ? walls.filter((_, i) => i !== idx)
            : [...walls, wallKey];
        // Invalidate cached Set so boundary checks rebuild it
        newWalls._set = undefined;
        this.setState({
            grid: { ...this.state.grid, walls: newWalls }
        });
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
                muted: this.state.muted
            },
            length,
            this.state.scale,
            this.state.musicalKey),
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
        // Collect all wall keys first, then toggle them in a single setState
        const wallKeys = [];
        for (const side of sides) {
            let wallKey = null;
            switch (side) {
                case 'top':
                    if (y > 0) wallKey = `h:${y - 1}:${x}`;
                    break;
                case 'bottom':
                    if (y < size - 1) wallKey = `h:${y}:${x}`;
                    break;
                case 'left':
                    if (x > 0) wallKey = `v:${y}:${x - 1}`;
                    break;
                case 'right':
                    if (x < size - 1) wallKey = `v:${y}:${x}`;
                    break;
                default:
                    break;
            }
            if (wallKey) wallKeys.push(wallKey);
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
                    forced
                )
            });
        }
    }
    share = () => {
        const gridString = window.btoa(JSON.stringify({
            grid: this.state.grid,
            noteLength: this.state.noteLength,
            muted: this.state.muted
        }));
        const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Farrowgrid.sagaciasoft.com/?data=${gridString}&amp;src=sdkpreparse`;
        window.open(shareUrl,'newwindow','width=300,height=250');return false;
    }

    updateScale = (event) => {
        this.setState({scale: event.nativeEvent.target.value.split(',').map((asdf)=>parseInt(asdf))});
    };

    updateMusicalKey = (event) => {
        this.setState({musicalKey: parseInt(event.nativeEvent.target.value)});
    };

    render() {
        const newDate = new Date();
        updateCanvas(this.state, newDate);
        
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

                        <div className="header-actions">
                            <button 
                                className={`hdr-btn ${!this.state.muted ? 'active' : ''}`}
                                onClick={this.muteToggle}
                                title={this.state.muted ? "Unmute (M)" : "Mute (M)"}
                            >
                                {this.state.muted ? (
                                    <svg viewBox="0 0 24 24" width="16" height="16"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" fill="currentColor"/></svg>
                                ) : (
                                    <svg viewBox="0 0 24 24" width="16" height="16"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" fill="currentColor"/></svg>
                                )}
                                <span>{this.state.muted ? 'Muted' : 'Sound'}</span>
                            </button>
                        </div>
                    </header>

                    {/* ── Body: Left | Canvas | Right ── */}
                    <div className="console-body">

                        {/* ── LEFT PANEL ── */}
                        <div className="side-panel">
                            {/* Presets */}
                            <div className="panel-group">
                                <h3>Presets</h3>
                                <div className="preset-nav">
                                    <button className="nav-btn" onClick={this.prevPreset} title="Previous Preset (←)">
                                        <svg viewBox="0 0 24 24" width="14" height="14"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" fill="currentColor"/></svg>
                                    </button>
                                    <span className="preset-label">{this.state.currentPreset + 1} / {this.state.presets.length}</span>
                                    <button className="nav-btn" onClick={this.nextPreset} title="Next Preset (→)">
                                        <svg viewBox="0 0 24 24" width="14" height="14"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" fill="currentColor"/></svg>
                                    </button>
                                </div>
                                <button 
                                    className={`play-btn ${this.state.playing ? 'playing' : ''}`}
                                    onClick={this.state.playing ? this.pause : this.play}
                                    title={this.state.playing ? "Pause (Space)" : "Play (Space)"}
                                >
                                    {this.state.playing ? (
                                        <svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="currentColor"/></svg>
                                    ) : (
                                        <svg viewBox="0 0 24 24" width="18" height="18"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>
                                    )}
                                </button>
                            </div>

                            {/* Speed */}
                            <div className="panel-group">
                                <h3>Speed</h3>
                                <input
                                    type="range"
                                    className="slider-h"
                                    min={minNoteLength}
                                    max={maxNoteLength}
                                    value={-1*this.state.noteLength}
                                    onChange={(e) => this.newNoteLength(e.target.value)}
                                    title="Animation Speed"
                                />
                            </div>

                            {/* Grid Size */}
                            <div className="panel-group">
                                <h3>Grid Size</h3>
                                <input
                                    type="range"
                                    className="slider-h"
                                    min={minSize}
                                    max={maxSize}
                                    value={this.state.grid.size}
                                    onChange={(e) => this.newSize(e.target.value)}
                                    title="Grid Size"
                                />
                                <span className="slider-val">{this.state.grid.size}×{this.state.grid.size}</span>
                            </div>

                            {/* Collision FX toggle */}
                            <button
                                className={`tool-btn wide ${this.state.showCollisions ? 'active' : ''}`}
                                onClick={() => this.setState({ showCollisions: !this.state.showCollisions })}
                                title="Toggle collision effects"
                            >
                                <svg viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="3" fill="currentColor"/><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".5"/><circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" strokeWidth="1" opacity=".25"/></svg>
                                <span>FX</span>
                            </button>
                        </div>

                        {/* ── CENTER CANVAS ── */}
                        <div className="canvas-area" data-step="5" data-intro="Click on the grid to place arrows!">
                            <div id="sketch-holder" />
                        </div>

                        {/* ── RIGHT PANEL ── */}
                        <div className="side-panel">
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

                                {/* ── Arrow Tool Row ── */}
                                <div className={`draw-tool-section ${this.state.deleting ? 'inactive-section' : this.state.drawMode === 'arrow' ? 'active-section' : 'inactive-section'}`}>
                                    <button
                                        className={`section-header-btn ${!this.state.deleting && this.state.drawMode === 'arrow' ? 'active' : ''}`}
                                        onClick={() => this.setState({ drawMode: 'arrow', deleting: false })}
                                        title="Arrow tool"
                                    >
                                        <svg viewBox="0 0 24 24" width="12" height="12"><polygon points="12,2 22,20 2,20" fill="currentColor"/></svg>
                                        <span>Arrows</span>
                                    </button>
                                    <div className="tool-row">
                                        <button
                                            className="tool-btn"
                                            onClick={() => this.newInputDirection((this.state.inputDirection + 1) % 4)}
                                            title={`Direction: ${dirLabels[this.state.inputDirection]} (click to rotate)`}
                                        >
                                            <svg viewBox="0 0 24 24" width="18" height="18" style={{transform: `rotate(${arrowRotationDeg}deg)`, transition: 'transform 0.2s ease'}}>
                                                <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" fill="currentColor"/>
                                            </svg>
                                        </button>
                                        <button
                                            className="tool-btn"
                                            onClick={() => this.setState({inputNumber: ((this.state.inputNumber) % 4) + 1})}
                                            title={`Arrows per click: ${this.state.inputNumber}`}
                                        >
                                            <span className="count-num">×{this.state.inputNumber}</span>
                                        </button>
                                    </div>
                                </div>

                                {/* ── Wall Tool Row ── */}
                                <div className={`draw-tool-section ${this.state.deleting ? 'inactive-section' : this.state.drawMode === 'wall' ? 'active-section' : 'inactive-section'}`}>
                                    <button
                                        className={`section-header-btn ${!this.state.deleting && this.state.drawMode === 'wall' ? 'active' : ''}`}
                                        onClick={() => this.setState({ drawMode: 'wall', deleting: false })}
                                        title="Wall tool (W)"
                                    >
                                        <svg viewBox="0 0 24 24" width="12" height="12">
                                            <rect x="2" y="3" width="20" height="4" rx="1" fill="currentColor" opacity=".7"/>
                                            <rect x="2" y="10" width="9" height="4" rx="1" fill="currentColor" opacity=".5"/>
                                            <rect x="13" y="10" width="9" height="4" rx="1" fill="currentColor" opacity=".5"/>
                                            <rect x="2" y="17" width="20" height="4" rx="1" fill="currentColor" opacity=".7"/>
                                        </svg>
                                        <span>Walls</span>
                                    </button>
                                    <div className="wall-sides-grid">
                                        {['top','bottom','left','right'].map(side => (
                                            <button
                                                key={side}
                                                className={`wall-side-btn ${side} ${this.state.wallSides.has(side) ? 'active' : ''}`}
                                                onClick={() => {
                                                    const next = new Set(this.state.wallSides);
                                                    if (next.has(side)) next.delete(side);
                                                    else next.add(side);
                                                    this.setState({ drawMode: 'wall', wallSides: next, wallClosest: false });
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
                                            className={`wall-side-btn closest wide ${this.state.wallClosest ? 'active' : ''}`}
                                            onClick={() => this.setState({ drawMode: 'wall', wallClosest: true, wallSides: new Set() })}
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

                            {/* Clear */}
                            <div className="panel-group">
                                <button 
                                    className="tool-btn wide danger"
                                    onClick={this.emptyGrid}
                                    title="Clear All (Delete)"
                                >
                                    <svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/></svg>
                                    <span>Clear</span>
                                </button>
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
                                {scales.map((scale, index) => (
                                    <option key={index} value={scale.value}>{scale.label}</option>
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
                    </footer>
                </div>
            </div>
        );
    }
}