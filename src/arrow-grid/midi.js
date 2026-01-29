let selectMIDIOut = null;
let midiAccess = null;
let midiOut = null;

function onMIDIFail(err) {
    const midiOutEl = document.getElementById('midiOut');
    const midiOutLabelEl = document.getElementById('midiOut-label');
    if (midiOutEl) midiOutEl.outerHTML = '';
    if (midiOutLabelEl) midiOutLabelEl.outerHTML = '';
    // console.log(`MIDI initialization failed. ${err}`);
}

export const makeMIDImessage = (noteToPlay, length) => {
    return {
        play() {
            (midiOut || { send: () => { } }).send([
                0x90,
                noteToPlay,
                0x40,
            ]);
            setTimeout(() => {
                (midiOut || { send: () => { } }).send([
                    0x80,
                    noteToPlay,
                    0x00,
                ]);
            }, length - 1);
        },
    };
};

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
    } catch (err) {
        // console.log(`MIDI is not supported by your browser access ${ev}`);
    }
};
const onMIDIInit = (midi) => {
    
  var allInputs = midi.inputs.values();
  // loop over all available inputs and listen for any MIDI input
  for (var input = allInputs.next(); input && !input.done; input = allInputs.next()) {
    // when a MIDI value is received call the onMIDIMessage function
    input.value.onmidimessage = (message)=>{console.log(message.data)};
  }

    midiAccess = midi;
    // eslint-disable-next-line no-undef
    selectMIDIOut = document.getElementById('midiOut');

    // clear the MIDI output select
    selectMIDIOut.options.length = 0;
    // eslint-disable-next-line no-undef
    selectMIDIOut.add(new Option('Select MIDI Device', undefined, false, false));
    const outputsIterator = midiAccess.outputs.values();
    let nextOutput = outputsIterator.next();
    while (!nextOutput.done) {
        selectMIDIOut.add(
            // eslint-disable-next-line no-undef
            new Option(nextOutput.value.name, nextOutput.value.id, false, false)
        );
        nextOutput = outputsIterator.next();
    }
    selectMIDIOut.onchange = changeMIDIOut;
};
export const midiUtils = () => {
    try {
        // eslint-disable-next-line no-undef
        navigator.requestMIDIAccess({}).then(onMIDIInit, onMIDIFail);
    } catch (err) {
        // console.log('MIDI is not supported by your browser access ');
    }
};
