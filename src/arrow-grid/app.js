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
            currentPreset: -1,
            presets,
            inputDirection: 0,
            noteLength: props.noteLength || 350,
            grid: props.grid || newGrid(8, 6),
            playing: false,
            muted: true,
            deleting: false,
            horizontalSymmetry: false,
            verticalSymmetry: false,
            backwardDiagonalSymmetry: false,
            forwardDiagonalSymmetry: false,
            inputNumber: 1,
            scale: scales[0].value,
            musicalKey: 60
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
                        data-intro="Hear the thing"
                        title="Sound On/Off"
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
                        data-intro="Swipe Right"
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
                />
                <div className="edit-options">
                    {/*<PlusButton 
                        onClick={this.addPreset}
                    /> */}
                    
                    <div className="edit-options-member">

                        <PrevButton
                            onClick={()=>{
                                let NextPreset = this.state.currentPreset - 1;
                                
                                if (NextPreset<0) {
                                    NextPreset = this.state.presets.length -1;
                                }
 
                                this.setState({
                                    grid: this.state.presets[NextPreset],
                                    currentPreset: NextPreset
                                });
                            }}
                            isEnabled={true}
                        />
                    </div> 
                    <div
                        className="edit-options-member"
                        data-step="1"
                        data-intro="Start the thing"
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
                        data-intro="Change the thing"
                    >
                    <div
                        className="edit-options-member" 
                        // data-step="3"
                        // data-intro="Again!"
                    >
                        <NextButton
                            onClick={()=>{
                                clickNext()
                                let NextPreset = this.state.currentPreset + 1;
                                
                                if (NextPreset>=this.state.presets.length) {
                                    NextPreset = 0;
                                }

                                this.setState({
                                    grid: this.state.presets[NextPreset],
                                    currentPreset: NextPreset
                                });
                            }}
                            isEnabled={true}
                        />
                    </div>
                    </div>
                </div>
                
                <div className="edit-options">
                    <div
                        className="edit-options-member"
                        data-step="4"
                        data-intro="Trash the thing"
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
                            title="Facebook Share"
                            className="ShareButton isEnabled"
                            onClick={this.share}
                        >
                            <ShareIcon/>
                        </button> 
                    </div>
                </div>
                <select id="midiOut" className="arrow-input">
                    <option value="">Not connected</option>
                </select>
                <select value={this.state.scale.toString()} className="arrow-input" onChange={this.updateScale}>
                    {scales.map((scale, index)=>(<option key={index} value={scale.value}>{scale.label}</option>))}
                </select>
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
        );
    }
}