import React from 'react';
import introJs from 'intro.js';
import 'intro.js/introjs.css';
import '../App.css';
import {range} from 'ramda';
import * as Tone from 'tone';
import {
    PlayButton,
    PauseButton,
    MuteToggleButton,
    PrevButton,
    NextButton,
} from './buttons/player-controls';
import {
    musicalNotes
} from './play-notes';
import {
    SymmetryButton
} from './buttons/symmetry-button';
import {
    PlusButton
} from './buttons/plus-button';
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
    getAdderWithMousePosition
} from './animations';
import {TrashButton} from './buttons/trash-button';
import {EditButton} from './buttons/edit-button';
import {ArrowButton} from './buttons/arrow-button';
import {
    LargeGridIcon,
    SmallGridIcon,
    RabbitIcon,
    TurtleIcon,
    InfoIcon,
    ShareIcon
} from './buttons/icons';
import {setSliderOnChange} from './sliders';
import presets from './presets';
import Chance from 'chance';
import scales from './scales';

// Intro Modal Component - Music-focused welcome experience
const IntroModal = ({ onClose }) => (
    <div className="intro-overlay" onClick={onClose}>
        <div className="intro-splash" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="intro-header">
                <div className="intro-logo">
                    <span className="logo-arrow">➤</span>
                    <span className="logo-arrow delay1">➤</span>
                    <span className="logo-arrow delay2">➤</span>
                    <span className="logo-arrow delay3">➤</span>
                </div>
                <h1>Arrow Grid</h1>
                <p className="intro-tagline">A generative music toy</p>
            </div>

            {/* How It Works - Visual Grid */}
            <div className="intro-how">
                <div className="intro-card">
                    <div className="card-icon">
                        <svg viewBox="0 0 24 24" width="32" height="32"><polygon points="5,3 19,12 5,21" fill="currentColor"/></svg>
                    </div>
                    <div className="card-text">
                        <strong>Play</strong>
                        <span>Watch arrows bounce</span>
                    </div>
                    <kbd>Space</kbd>
                </div>

                <div className="intro-card">
                    <div className="card-icon">
                        <svg viewBox="0 0 24 24" width="32" height="32"><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
                    </div>
                    <div className="card-text">
                        <strong>Click</strong>
                        <span>Add arrows to grid</span>
                    </div>
                    <kbd>Click</kbd>
                </div>

                <div className="intro-card">
                    <div className="card-icon">
                        <svg viewBox="0 0 24 24" width="32" height="32"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" fill="currentColor"/></svg>
                    </div>
                    <div className="card-text">
                        <strong>Unmute</strong>
                        <span>Hear the music</span>
                    </div>
                    <kbd>M</kbd>
                </div>

                <div className="intro-card">
                    <div className="card-icon">
                        <svg viewBox="0 0 24 24" width="32" height="32"><path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM14.5 12L23 6v12l-8.5-6z" fill="currentColor"/></svg>
                    </div>
                    <div className="card-text">
                        <strong>Explore</strong>
                        <span>Browse presets</span>
                    </div>
                    <kbd>← →</kbd>
                </div>
            </div>

            {/* Quick Keys Reference */}
            <div className="intro-keys">
                <div className="key-item"><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd><span>Symmetry modes</span></div>
                <div className="key-item"><kbd>E</kbd><span>Edit/Erase</span></div>
                <div className="key-item"><kbd>Del</kbd><span>Clear all</span></div>
            </div>

            {/* CTA */}
            <button className="intro-start" onClick={onClose}>
                <span>Start Playing</span>
                <svg viewBox="0 0 24 24" width="20" height="20"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>
            </button>

            <p className="intro-hint">Music starts automatically • Click anywhere to begin</p>
        </div>
    </div>
);
const chance = new Chance();

const clickNext = () => {
    const nextButtonElement = document.querySelectorAll('.introjs-button.introjs-nextbutton')[0];
    if (nextButtonElement) nextButtonElement.click();
};

const clickDone = () => {
    const doneButtonElement = document.querySelectorAll('.introjs-button.introjs-donebutton')[0];
    if (doneButtonElement) doneButtonElement.click();
};

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
            await Tone.start();
            getClickSynth().triggerAttackRelease('C5', 0.02);
        } catch (e) {
            // Ignore audio errors
        }
    }
};

const interactSound = (state) => {
    if (!state.muted) sound.play();
};

export class Application extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            tut: '',
            currentPreset: 0,  // Start at first preset
            presets,
            inputDirection: 0,
            noteLength: props.noteLength || 350,
            grid: presets[0] || newGrid(8, 6),  // Start with first preset
            playing: false,
            muted: true,
            deleting: false,
            horizontalSymmetry: false,
            verticalSymmetry: false,
            backwardDiagonalSymmetry: false,
            forwardDiagonalSymmetry: false,
            inputNumber: 1,
            scale: scales[0].value,
            musicalKey: 60,
            showIntroModal: !localStorage.getItem('arrowgrid-intro-seen')
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
        
        // Add keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyDown);
        
        // Auto-play after a short delay to show users what the app does
        setTimeout(() => {
            if (!this.state.showIntroModal) {
                this.play();
            }
        }, 500);
    }
    
    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeyDown);
        clearInterval(this.timerID);
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
                this.newInputDirection((this.state.inputDirection + 3) % 4);
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.newInputDirection((this.state.inputDirection + 1) % 4);
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
            default:
                break;
        }
    }
    
    closeIntroModal = () => {
        localStorage.setItem('arrowgrid-intro-seen', 'true');
        this.setState({ showIntroModal: false });
        // Auto-play after closing intro
        setTimeout(() => this.play(), 300);
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
        clickNext();
        let nextPresetIndex = this.state.currentPreset + 1;
        if (nextPresetIndex >= this.state.presets.length) {
            nextPresetIndex = 0;
        }
        this.setState({
            grid: this.state.presets[nextPresetIndex],
            currentPreset: nextPresetIndex
        });
    }

    timerID = undefined

    play = () => {
        clickNext();
        this.timerID = setInterval(
            () => this.nextGrid(this.state.noteLength),
            this.state.noteLength,
        );
        this.setState({ playing: true });
    }
    resetTimer = () => {
        clearInterval(this.timerID);
        if (this.state.playing) {
            this.play();
        }
    }
    pause = () => {
        clearInterval(this.timerID);
        this.setState({ playing: false });
    }
    muteToggle = () => {
        clickDone();
        this.setState({ muted: !this.state.muted });
        interactSound(this.state);
    }
    changeEditMode = () => {
        this.setState({ deleting: !this.state.deleting });
    }
    newSize = (value) => {
        const input = parseInt(value, 10);

        this.setState({
            grid: {
                ...this.state.grid,
                id: chance.guid(),
                size: input,
            },
        });
    }
    newNoteLength = (value) => {
        this.resetTimer();
        const input = parseInt(value, 10);

        this.setState({
            noteLength: -1 * input,
        });
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
            this.state.musicalKey)
        });
    }
    newInputDirection = (inputDirection) => {
        this.setState({
            inputDirection,
        });
    }
    newGrid = (number, size) => {
        this.setState({
            grid: newGrid(size, number),
        });
    }
    emptyGrid = () => {
        clickNext();
        this.setState({
            grid: emptyGrid(this.state.grid.size),
        });
    }
    removeTutHighlight = () => {
        this.setState({
            tut: '',
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
    addToGrid = (x, y, e, forced) => {
        clickNext();
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
        return (
            <div className="no-copy midi-toys-app">
                <div className="edit-options">
                    <div className=" edit-options-member app-title-div">
                        <h1>
                            Arrowgrid
                        </h1>
                    </div>
                </div>
                
            
                <div
                    className="edit-options"
                >
                
                <div className="edit-options-member">
                        <div className="">
                            <button
                                title="Start Tutorial"
                                className={"TutorialButton isEnabled " + this.state.tut} 
                                onClick={()=>{
                                    introJs()
                                    .setOption('hideNext', true)
                                    .setOption('hidePrev', true)
                                    .setOption('showBullets', false)
                                    .setOption('nextLabel', '')
                                    .setOption('prevLabel', '')
                                    .setOption('skipLabel', '')
                                    .setOption('doneLabel', '')
                                    .setOption('showStepNumbers', false)
                                    .setOption('exitOnOverlayClick', false)
                                    .start();
                                }}
                            >
                                <InfoIcon/>
                            </button>
                        </div>
                    </div>
                    <div
                        className="edit-options-member"
                    >
                        <div
                            className="slider-container"
                            // data-step="5"
                            // data-intro="Adjust the speed with this slider."
                        >
                            <input
                                id="note-length-slider"
                                className="arrow-input"
                                type="range"
                                max={maxNoteLength}
                                min={minNoteLength}
                                value={-1*this.state.noteLength}
                                onChange={(e) => this.newNoteLength(e.target.value)}
                            />
                        </div>
                        <div
                            className="slider-icon-container"
                        >
                            <RabbitIcon/>
                            <TurtleIcon/>
                        </div>
                    </div>
                    <div
                        className="edit-options-member"
                        data-step="8"
                        data-intro="Turn on the sound to hear your creation! Each edge makes a different note."
                        title="Sound On/Off (M)"
                    >
                        <MuteToggleButton
                            isEnabled={true}
                            isMuted={this.state.muted}
                            onMuteChange={this.muteToggle}
                        />
                    </div>
                </div>
                <div
                    className="edit-options"
                >
                    <div
                        className="edit-options-member"
                        data-step="5"
                        data-intro="Click anywhere on the grid to place arrows. They'll bounce around and make music!"
                    >
                        <div
                            className="edit-options-member"
                            // data-step="6"
                            // data-intro="Repeat!"
                        >
                            <div
                                id="sketch-holder"
                                // data-step="7"
                                // data-intro="Once more."
                            />
                        </div>
                    </div>
                </div>
                <div
                    className="edit-options"
                >
                <div 
                        className="edit-options-member"
                        // data-step="11"
                        // data-intro="Change the arrow direction."
                    >
                    {
                        [
                            (
                                <ArrowButton
                                    number={this.state.inputNumber}
                                    onClick={
                                        () => this.newInputDirection(1)
                                    } 
                                    direction="Up"
                                />),
                            (
                                <ArrowButton
                                    number={this.state.inputNumber}
                                    onClick={
                                        () => this.newInputDirection(2)
                                    }
                                    direction="Right"
                                />),
                            (
                                <ArrowButton
                                    number={this.state.inputNumber}
                                    onClick={
                                        () => this.newInputDirection(3)
                                    }
                                    direction="Down"
                                />),
                            (
                                <ArrowButton
                                    number={this.state.inputNumber}
                                    onClick={
                                        () => this.newInputDirection(0)
                                    }
                                    direction="Left"
                                />),
                        ][this.state.inputDirection]
                    }</div>
                    <div
                        className="edit-options-member"
                    >
                        <div
                            className="slider-container"
                            // data-step="12"
                            // data-intro="Adjust the grid with this slider."
                        >
                            <input
                                id="grid-size-slider"
                                className="arrow-input" 
                                type="range"
                                max={maxSize}
                                min={minSize}
                                value={this.state.grid.size}
                                onChange={(e) => this.newSize(e.target.value)}
                            />
                        </div>
                        <div className="slider-icon-container">
                            <LargeGridIcon/>
                            <SmallGridIcon/>
                        </div>
                    
                    </div>
                    
                    <div
                        className="edit-options-member"
                        // data-step="6"
                        // data-intro="Switch to erase mode."
                    >
                        <div 
                            // data-step="10"
                            // data-intro="Switch to draw mode."
                        >
                            <EditButton isEditing={!this.state.deleting} onClick={this.changeEditMode} className={this.state.deleting ? 'EraseIconRotate' : 'EditIconRotate'}/>
                        </div>
                    </div>
                </div>
                
                
                <SymmetryButton 
                    onClick={
                        ()=>this.setState({
                            backwardDiagonalSymmetry: !this.state.backwardDiagonalSymmetry
                        }
                    )}
                    isActive={this.state.backwardDiagonalSymmetry}
                    className={"backward-diag"}
                />
                <SymmetryButton
                    onClick={
                        ()=>this.setState({
                            forwardDiagonalSymmetry: !this.state.forwardDiagonalSymmetry
                        }
                    )}
                    isActive={this.state.forwardDiagonalSymmetry}
                    className={"forward-diag"}
                />
                <SymmetryButton
                    onClick={
                        ()=>this.setState({
                            horizontalSymmetry: !this.state.horizontalSymmetry
                        }
                    )}
                    isActive={this.state.horizontalSymmetry}
                    className={"horizontal"}
                />
                <SymmetryButton
                    onClick={
                        ()=>this.setState({
                            verticalSymmetry: !this.state.verticalSymmetry
                        }
                    )}
                    isActive={this.state.verticalSymmetry}
                    className={""}
                />
                <PlusButton 
                    onClick={
                        ()=>this.setState({
                            inputNumber: ((this.state.inputNumber + 1) % 5) || 1
                        }
                    )}
                    count={this.state.inputNumber}
                />
                <div className="edit-options">
                    {/*<PlusButton 
                        onClick={this.addPreset}
                    /> */}
                    
                    <div className="edit-options-member">

                        <PrevButton
                            onClick={this.prevPreset}
                            isEnabled={true}
                        />
                    </div>
                    <div className="preset-counter">
                        <span className="preset-number">{this.state.currentPreset + 1}</span>
                        <span className="preset-divider">/</span>
                        <span className="preset-total">{this.state.presets.length}</span>
                    </div> 
                    <div
                        className="edit-options-member"
                        data-step="1"
                        data-intro="Press Play to start the animation and watch the arrows bounce!"
                    >
                        <div
                            // data-step="7"
                            // data-intro="Pause to allow easier editing."
                        >
                        <div
                            // data-step="15"
                            // data-intro="Check to see that your device has sound enabled and play your music."
                        >
                            {
                                this.state.playing ?
                                <PauseButton  onClick={this.pause}></PauseButton> :
                                <PlayButton isEnabled={true} onClick={this.play}></PlayButton>
                            }
                            </div>
                        </div>
                    </div>
                    <div
                        className="edit-options-member" 
                        data-step="2"
                        data-intro="Browse through different preset patterns for inspiration!"
                    >
                    <div
                        className="edit-options-member" 
                        // data-step="3"
                        // data-intro="Again!"
                    >
                        <NextButton
                            onClick={this.nextPreset}
                            isEnabled={true}
                        />
                    </div>
                    </div>
                </div>
                
                <div className="edit-options">
                    <div
                        className="edit-options-member"
                        data-step="4"
                        data-intro="Clear the grid and start fresh!"
                    >
                        <TrashButton onClick={this.emptyGrid}/>
                    </div>
                    <div className= "spacer-div-next-to-trash">
                        <h4>
                            Draw Mode: {!this.state.deleting ? `${this.state.inputNumber}x `+["Up","Right","Down","Left"][this.state.inputDirection]+' Arrows': 'Eraser'}
                        </h4>
                    </div>
                    <div
                        className="edit-options-member"
                        // data-step="16"
                        // data-intro="Share your creation on Facebook!"
                    >
                        <button
                            title="Share on Facebook"
                            className="ShareButton isEnabled"
                            onClick={this.share}
                        >
                            <ShareIcon/>
                        </button> 
                    </div>
                </div>
                
                <div className="settings-section">
                    <div className="settings-group">
                        <label className="settings-label">MIDI Output</label>
                        <select id="midiOut" className="arrow-input">
                            <option value="">Not connected</option>
                        </select>
                    </div>
                    <div className="settings-group">
                        <label className="settings-label">Scale</label>
                        <select value={this.state.scale.toString()} className="arrow-input" onChange={this.updateScale}>
                            {scales.map((scale, index)=>(<option key={index} value={scale.value}>{scale.label}</option>))}
                        </select>
                    </div>
                    <div className="settings-group">
                        <label className="settings-label">Key</label>
                        <select value={this.state.musicalKey} className="arrow-input" onChange={this.updateMusicalKey}>
                            {
                                range(21,109)
                                    .map((midiNote)=>({
                                        label:musicalNotes[midiNote-21].toUpperCase(),value:midiNote
                                    }))
                                    .map((musicalKey)=>(
                                        <option key={musicalKey.value} value={musicalKey.value}>{musicalKey.label}</option>
                                    ))
                            }
                        </select>
                    </div>
                </div>
                
                {this.state.showIntroModal && <IntroModal onClose={this.closeIntroModal} />}
            </div>
        );
    }
}