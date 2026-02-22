let selectMIDIOut = null;
let midiAccess = null;
let midiOut = null;
let _onMidiConnected = null;

/**
 * Register a callback for when MIDI output is first connected
 */
export const onMidiConnected = (cb) => { _onMidiConnected = cb; };

function onMIDIFail(err) {
    const midiOutEl = document.getElementById('midiOut');
    const midiOutLabelEl = document.getElementById('midiOut-label');
    if (midiOutEl) midiOutEl.outerHTML = '';
    if (midiOutLabelEl) midiOutLabelEl.outerHTML = '';
}

/**
 * Send a Program Change message on a MIDI channel.
 * channel: 1-16 (MIDI channel number)
 * program: 0-127 (GM program number, 0 = Acoustic Grand Piano)
 */
export const sendProgramChange = (channel, program = 0) => {
    if (!midiOut) return;
    const midiCh = Math.max(0, Math.min(15, (channel || 1) - 1));
    midiOut.send([0xC0 + midiCh, program & 0x7F]);
};

export const makeMIDImessage = (noteToPlay, length, velocity, channel) => {
    const vel = Math.max(1, Math.min(127, Math.round((velocity ?? 1.0) * 127)));
    const midiCh = Math.max(0, Math.min(15, (channel || 1) - 1)); // Convert 1-16 to 0-15
    const note = Math.max(0, Math.min(127, noteToPlay)); // Clamp to valid MIDI range
    return {
        play() {
            if (!midiOut) return;
            midiOut.send([0x90 + midiCh, note, vel]);
            setTimeout(() => {
                if (midiOut) {
                    midiOut.send([0x80 + midiCh, note, 0x00]);
                }
            }, Math.max(1, length - 10));
        },
    };
};

/**
 * Check if MIDI output is currently connected
 */
export const isMidiConnected = () => !!midiOut;

const changeMIDIOut = (ev) => {
    try {
        const selectedID = selectMIDIOut[selectMIDIOut.selectedIndex].value;
        const outputsIterator = midiAccess.outputs.values();
        let nextOutput = outputsIterator.next();
        while (!nextOutput.done) {
            if (selectedID === nextOutput.value.id) {
                midiOut = nextOutput.value;
            }
            nextOutput = outputsIterator.next();
        }
        if (selectedID === undefined) {
            midiOut = undefined;
        }
        // Send Program Change 0 (piano) on channels 1-7 so each channel has a sound loaded
        if (midiOut) {
            for (let ch = 0; ch < 16; ch++) {
                midiOut.send([0xC0 + ch, 0]);
            }
        }
    } catch (err) {
        // MIDI not supported
    }
};
const onMIDIInit = (midi) => {
    
  var allInputs = midi.inputs.values();
  for (var input = allInputs.next(); input && !input.done; input = allInputs.next()) {
    input.value.onmidimessage = (message)=>{console.log(message.data)};
  }

    midiAccess = midi;
    selectMIDIOut = document.getElementById('midiOut');

    selectMIDIOut.options.length = 0;
    selectMIDIOut.add(new Option('Select MIDI Device', undefined, false, false));
    const outputsIterator = midiAccess.outputs.values();
    let nextOutput = outputsIterator.next();
    while (!nextOutput.done) {
        selectMIDIOut.add(
            new Option(nextOutput.value.name, nextOutput.value.id, false, false)
        );
        nextOutput = outputsIterator.next();
    }
    selectMIDIOut.onchange = changeMIDIOut;
    
    // Auto-select first MIDI device if available
    if (selectMIDIOut.options.length > 1) {
        selectMIDIOut.selectedIndex = 1;
        changeMIDIOut();
        if (_onMidiConnected) _onMidiConnected();
    }
};
export const midiUtils = () => {
    try {
        navigator.requestMIDIAccess({}).then(onMIDIInit, onMIDIFail);
    } catch (err) {
        // MIDI not supported
    }
};

export const rescanMIDI = midiUtils;
