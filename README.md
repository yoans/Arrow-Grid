# Arrow Grid

A creative visual and musical grid application built with React. Generate interesting visuals, rhythms, and melodies with this cerebral algorithm.

## Getting Started

### Prerequisites

- Node.js 20.x or later (recommended: use `nvm` to manage versions)
- npm

### Installation

```bash
npm install
```

### Development

Start the development server:

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload when you make edits.

### Build

Build the app for production:

```bash
npm run build
```

This creates an optimized production build in the `build` folder.

## Features

- **Arrow Grid Canvas**: Click on the grid to place arrows in different directions
- **Play/Pause Controls**: Animate the grid to see arrows move and generate sounds
- **Musical Scales**: Choose from 60+ different musical scales
- **Key Selection**: Pick any musical key from A0 to C8
- **Speed Control**: Adjust animation tempo with the speed slider
- **Symmetry Modes**: Toggle horizontal, vertical, and diagonal symmetry
- **Presets**: Cycle through pre-made patterns

## Tech Stack

- React 18
- p5.js for canvas animations
- Pizzicato for audio synthesis
- intro.js for tutorials
- ramda for functional utilities

## Project Structure

```
src/
├── index.js          # React entry point
├── App.js            # Main App component
├── App.css           # Global styles
└── arrow-grid/       # Core application
    ├── app.js        # Main application component
    ├── animations.js # p5.js canvas animations
    ├── arrows-logic.js # Grid logic
    ├── play-notes.js # Sound generation
    ├── midi.js       # MIDI integration
    ├── scales.js     # Musical scales
    ├── presets.js    # Pre-made patterns
    ├── sliders.js    # Slider controls
    └── buttons/      # UI button components
```

## License

MIT
