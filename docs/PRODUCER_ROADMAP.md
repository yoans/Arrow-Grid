# Arrow Grid — Producer Roadmap

Arrow Grid is an audio-visual instrument that creates rhythms and melodies from bouncing arrows on a grid. This roadmap outlines planned features for music producers who use Arrow Grid as a MIDI composition tool alongside their DAW.

---

## Current MIDI Capabilities

- **16 MIDI channels** — each arrow color maps to a channel (1-16)
- **MIDI output** — notes sent to any connected MIDI device
- **Per-channel volume** — independent velocity control
- **Per-channel mute** — silence individual channels
- **Program Change** — sent on device selection (all 16 channels)
- **Scale & key selection** — 60+ scales organized by category
- **Auto-detect** — MIDI automatically enables when a device is connected
- **Rescan** — refresh MIDI device list without reloading

---

## Planned Features

### Priority 1 — Core Producer Workflow

#### MIDI Clock Sync
Sync Arrow Grid's internal sequencer to incoming MIDI clock from your DAW. This turns Arrow Grid into a slave that follows your DAW's tempo, start/stop, and song position.

- Receive MIDI Clock (0xF8), Start (0xFA), Stop (0xFC), Continue (0xFB)
- Derive BPM from clock ticks (24 ppqn)
- Toggle: Internal tempo vs External sync
- Visual indicator when synced

#### MIDI Export
Export the current grid's generated note sequence as a Standard MIDI File (.mid). This lets you capture Arrow Grid patterns and drag them into your DAW for editing.

- Export N bars of generated output (configurable: 4, 8, 16, 32 bars)
- Multi-track: one track per channel
- Include note velocity
- Download as .mid file

#### Per-Channel Sound Selection
Allow selecting different Tone.js instruments per channel instead of a single global PolySynth. This makes Arrow Grid useful as a standalone instrument, not just a MIDI controller.

- Per-channel instrument: Synth, FMSynth, AMSynth, PluckSynth, MetalSynth, MembraneSynth
- Per-channel octave offset
- Per-channel pan position
- Saved with grid state

### Priority 2 — Advanced MIDI

#### MIDI CC Mapping
Map Arrow Grid parameters to MIDI CC messages so they can be automated from your DAW or controlled by a MIDI controller.

- Speed → CC (configurable CC number)
- Master volume → CC
- Per-channel volume → CC
- Learn mode: move a knob to assign
- Bidirectional: send CC changes out, receive CC changes in

#### MIDI Input — Play Mode
Use a MIDI keyboard to place arrows on the grid. Each key press places an arrow at the current cursor position with the played note's velocity and channel.

- Map incoming notes to grid positions
- Use note velocity as arrow velocity
- Use MIDI channel as arrow channel
- Step-entry mode: advance cursor after each note

#### Panic Button
A MIDI panic button that sends All Notes Off (CC 123) and All Sound Off (CC 120) on all 16 channels. Essential when notes get stuck.

- Keyboard shortcut: Escape or Ctrl+.
- Sends on all 16 channels
- Also resets Tone.js voices

### Priority 3 — Composition Tools

#### Pattern Chaining
Save multiple grid states as "patterns" and chain them into a sequence. This creates song structures from Arrow Grid patterns.

- Save current grid as a named pattern
- Arrange patterns in a timeline
- Loop individual patterns or play through sequence
- Export full sequence as MIDI

#### Scale & Key Per-Channel
Allow different channels to use different scales and root keys. This enables polymodal compositions where e.g. bass is in minor while melody is in major.

- Per-channel scale override (defaults to global)
- Per-channel root key offset
- Visual indicator of active scale per channel

#### Probability & Humanization
Add controlled randomness to make patterns feel less mechanical.

- Per-arrow note probability (0-100%)
- Velocity humanization (± random offset)
- Timing humanization (± ms jitter)
- Per-channel humanization settings

---

## Integration Guide

### Connecting to a DAW

1. On macOS, use **IAC Driver** (built-in virtual MIDI)
2. On Windows, use **loopMIDI** (free virtual MIDI cable)
3. Select the virtual MIDI port in Arrow Grid's **MIDI Out** dropdown
4. In your DAW, create tracks receiving from the same virtual MIDI port
5. Assign each DAW track to a specific MIDI channel (1-16) to separate Arrow Grid's channels

### Recommended DAW Setup

| DAW Track | MIDI Channel | Arrow Grid Channel | Suggested Use |
|-----------|-------------|-------------------|---------------|
| Track 1   | Ch 1        | Blue              | Lead melody   |
| Track 2   | Ch 2        | Purple            | Harmony       |
| Track 3   | Ch 3        | Green             | Bass          |
| Track 4   | Ch 4        | Orange            | Percussion    |
| Track 5   | Ch 5        | Red               | FX / Accent   |
| ...       | ...         | ...               | ...           |

---

## Contributing

Feature requests and contributions are welcome. If you're a producer with specific workflow needs, please open an issue describing your use case.
