export default [
  // 0 — Rainbow Spiral: arrows scattered across the grid, one per channel
  {
    name: "Spiral",
    size: 8,
    arrows: [
      { x: 0, y: 0, vector: 1, channel: 1 },  // blue — top-left, right
      { x: 7, y: 2, vector: 2, channel: 2 },  // purple — far right, down
      { x: 2, y: 5, vector: 0, channel: 3 },  // green — lower-left, up
      { x: 5, y: 0, vector: 2, channel: 4 },  // orange — top-right area, down
      { x: 0, y: 7, vector: 1, channel: 5 },  // red — bottom-left, right
      { x: 4, y: 3, vector: 3, channel: 6 },  // yellow — center, left
      { x: 7, y: 6, vector: 0, channel: 7 },  // pink — bottom-right, up
      { x: 1, y: 2, vector: 2, channel: 8 },  // teal — upper-left, down
      { x: 6, y: 4, vector: 3, channel: 9 },  // lime — mid-right, left
    ],
    walls: [
      "h:2:3", "h:2:4",
      "v:3:2", "v:4:5",
      "h:5:1", "h:5:6",
    ],
    muted: true
  },
  // 1 — Rainbow X: diagonal cross with all 7 channel colors
  {
    name: "Crossbow",
    size: 8,
    arrows: [
      { x: 0, y: 0, vector: 0, channel: 1 },
      { x: 1, y: 1, vector: 0, channel: 2 },
      { x: 2, y: 2, vector: 0, channel: 3 },
      { x: 3, y: 3, vector: 0, channel: 4 },
      { x: 4, y: 4, vector: 0, channel: 5 },
      { x: 5, y: 5, vector: 0, channel: 6 },
      { x: 6, y: 6, vector: 0, channel: 7 },
      { x: 7, y: 7, vector: 0, channel: 1 },
      { x: 0, y: 7, vector: 1, channel: 7 },
      { x: 1, y: 6, vector: 1, channel: 6 },
      { x: 2, y: 5, vector: 1, channel: 5 },
      { x: 3, y: 4, vector: 1, channel: 4 },
      { x: 4, y: 3, vector: 1, channel: 3 },
      { x: 5, y: 2, vector: 1, channel: 2 },
      { x: 6, y: 1, vector: 1, channel: 1 },
      { x: 7, y: 0, vector: 1, channel: 7 }
    ],
    muted: true
  },
  // 2 — Diamond cage: 4-fold symmetry with walls forming a diamond
  {
    name: "Diamond",
    size: 8,
    arrows: [
      { x: 3, y: 1, vector: 1, channel: 1 },
      { x: 4, y: 1, vector: 3, channel: 1 },
      { x: 1, y: 3, vector: 0, channel: 2 },
      { x: 1, y: 4, vector: 2, channel: 2 },
      { x: 6, y: 3, vector: 0, channel: 5 },
      { x: 6, y: 4, vector: 2, channel: 5 },
      { x: 3, y: 6, vector: 1, channel: 4 },
      { x: 4, y: 6, vector: 3, channel: 4 },
      { x: 3, y: 3, vector: 0, channel: 3 },
      { x: 3, y: 3, vector: 0, channel: 3 },
      { x: 4, y: 4, vector: 2, channel: 6 },
      { x: 4, y: 4, vector: 2, channel: 6 },
      { x: 3, y: 4, vector: 1, channel: 7 },
      { x: 4, y: 3, vector: 3, channel: 7 }
    ],
    walls: [
      'v:3:3', 'v:4:3', 'h:3:3', 'h:3:4',
      'v:3:4', 'v:4:4', 'h:4:3', 'h:4:4'
    ],
    muted: true
  },
  // 3 — Spiral channels: concentric rotating arrows in different colors
  {
    name: "Channels",
    size: 10,
    arrows: [
      // Outer ring — blue ch1
      { x: 0, y: 0, vector: 1, channel: 1 },
      { x: 3, y: 0, vector: 1, channel: 1 },
      { x: 6, y: 0, vector: 1, channel: 1 },
      { x: 9, y: 0, vector: 2, channel: 1 },
      { x: 9, y: 3, vector: 2, channel: 1 },
      { x: 9, y: 6, vector: 2, channel: 1 },
      { x: 9, y: 9, vector: 3, channel: 1 },
      { x: 6, y: 9, vector: 3, channel: 1 },
      { x: 3, y: 9, vector: 3, channel: 1 },
      { x: 0, y: 9, vector: 0, channel: 1 },
      { x: 0, y: 6, vector: 0, channel: 1 },
      { x: 0, y: 3, vector: 0, channel: 1 },
      // Middle ring — purple ch2
      { x: 2, y: 2, vector: 1, channel: 2 },
      { x: 5, y: 2, vector: 1, channel: 2 },
      { x: 7, y: 2, vector: 2, channel: 2 },
      { x: 7, y: 5, vector: 2, channel: 2 },
      { x: 7, y: 7, vector: 3, channel: 2 },
      { x: 4, y: 7, vector: 3, channel: 2 },
      { x: 2, y: 7, vector: 0, channel: 2 },
      { x: 2, y: 4, vector: 0, channel: 2 },
      // Inner — green ch3
      { x: 4, y: 4, vector: 1, channel: 3 },
      { x: 4, y: 4, vector: 1, channel: 3 },
      { x: 5, y: 5, vector: 3, channel: 3 },
      { x: 5, y: 5, vector: 3, channel: 3 },
      { x: 4, y: 5, vector: 0, channel: 4 },
      { x: 5, y: 4, vector: 2, channel: 4 }
    ],
    muted: true
  },
  // 4 — Walled corridors: arrows bounce through maze-like walls
  {
    name: "Corridors",
    size: 8,
    arrows: [
      { x: 0, y: 0, vector: 1, channel: 1 },
      { x: 0, y: 0, vector: 1, channel: 1 },
      { x: 0, y: 0, vector: 1, channel: 1 },
      { x: 7, y: 7, vector: 3, channel: 5 },
      { x: 7, y: 7, vector: 3, channel: 5 },
      { x: 7, y: 7, vector: 3, channel: 5 },
      { x: 0, y: 7, vector: 0, channel: 3 },
      { x: 0, y: 7, vector: 0, channel: 3 },
      { x: 7, y: 0, vector: 2, channel: 7 },
      { x: 7, y: 0, vector: 2, channel: 7 },
      { x: 3, y: 3, vector: 1, channel: 4 },
      { x: 4, y: 4, vector: 3, channel: 6 }
    ],
    walls: [
      'v:0:1', 'v:1:1', 'v:2:1',
      'h:1:0', 'h:1:1', 'h:1:2',
      'v:5:5', 'v:6:5', 'v:5:6',
      'h:5:5', 'h:5:6', 'h:5:7',
      'h:3:3', 'h:3:4', 'v:3:3', 'v:4:3'
    ],
    muted: true
  },
  // 5 — Color pinwheel: rotational symmetry with 4 color arms
  {
    name: "Pinwheel",
    size: 9,
    arrows: [
      // Arm 1 — up (blue)
      { x: 4, y: 1, vector: 0, channel: 1 },
      { x: 4, y: 1, vector: 0, channel: 1 },
      { x: 4, y: 2, vector: 0, channel: 1 },
      // Arm 2 — right (orange)
      { x: 6, y: 4, vector: 1, channel: 4 },
      { x: 6, y: 4, vector: 1, channel: 4 },
      { x: 7, y: 4, vector: 1, channel: 4 },
      // Arm 3 — down (red)
      { x: 4, y: 6, vector: 2, channel: 5 },
      { x: 4, y: 6, vector: 2, channel: 5 },
      { x: 4, y: 7, vector: 2, channel: 5 },
      // Arm 4 — left (green)
      { x: 2, y: 4, vector: 3, channel: 3 },
      { x: 2, y: 4, vector: 3, channel: 3 },
      { x: 1, y: 4, vector: 3, channel: 3 },
      // Center spinner — purple
      { x: 4, y: 4, vector: 0, channel: 2 },
      { x: 4, y: 4, vector: 1, channel: 2 },
      { x: 4, y: 4, vector: 2, channel: 2 },
      { x: 4, y: 4, vector: 3, channel: 2 }
    ],
    walls: [
      'v:3:3', 'v:5:4', 'h:3:4', 'h:4:3'
    ],
    muted: true
  },
  // 6 — Cascading steps: staircase pattern with alternating channel colors
  {
    name: "Cascade",
    size: 12,
    arrows: [
      { x: 0, y: 0, vector: 1, channel: 1 },
      { x: 1, y: 0, vector: 2, channel: 1 },
      { x: 2, y: 2, vector: 1, channel: 2 },
      { x: 3, y: 2, vector: 2, channel: 2 },
      { x: 4, y: 4, vector: 1, channel: 3 },
      { x: 5, y: 4, vector: 2, channel: 3 },
      { x: 6, y: 6, vector: 1, channel: 4 },
      { x: 7, y: 6, vector: 2, channel: 4 },
      { x: 8, y: 8, vector: 1, channel: 5 },
      { x: 9, y: 8, vector: 2, channel: 5 },
      { x: 10, y: 10, vector: 1, channel: 6 },
      { x: 11, y: 10, vector: 2, channel: 6 },
      // Counter arrows going other way
      { x: 11, y: 1, vector: 3, channel: 7 },
      { x: 10, y: 1, vector: 2, channel: 7 },
      { x: 9, y: 3, vector: 3, channel: 7 },
      { x: 8, y: 3, vector: 2, channel: 7 },
      { x: 7, y: 5, vector: 3, channel: 6 },
      { x: 6, y: 5, vector: 2, channel: 6 },
      { x: 5, y: 7, vector: 3, channel: 5 },
      { x: 4, y: 7, vector: 2, channel: 5 },
      { x: 3, y: 9, vector: 3, channel: 4 },
      { x: 2, y: 9, vector: 2, channel: 4 },
      { x: 1, y: 11, vector: 3, channel: 3 },
      { x: 0, y: 11, vector: 2, channel: 3 }
    ],
    walls: [
      'h:1:0', 'h:1:1', 'h:3:2', 'h:3:3',
      'h:5:4', 'h:5:5', 'h:7:6', 'h:7:7',
      'h:9:8', 'h:9:9'
    ],
    muted: true
  },
  // 7 — Mirror hall: horizontal + vertical symmetry with walls creating halls
  {
    name: "Mirror",
    size: 10,
    arrows: [
      // Top-left quadrant
      { x: 1, y: 1, vector: 1, channel: 1 },
      { x: 1, y: 1, vector: 1, channel: 1 },
      { x: 3, y: 1, vector: 1, channel: 2 },
      { x: 3, y: 1, vector: 1, channel: 2 },
      { x: 1, y: 3, vector: 0, channel: 3 },
      { x: 1, y: 3, vector: 0, channel: 3 },
      { x: 3, y: 3, vector: 2, channel: 4 },
      { x: 3, y: 3, vector: 2, channel: 4 },
      // Top-right quadrant (vertical mirror)
      { x: 8, y: 1, vector: 3, channel: 5 },
      { x: 8, y: 1, vector: 3, channel: 5 },
      { x: 6, y: 1, vector: 3, channel: 6 },
      { x: 6, y: 1, vector: 3, channel: 6 },
      { x: 8, y: 3, vector: 0, channel: 7 },
      { x: 8, y: 3, vector: 0, channel: 7 },
      { x: 6, y: 3, vector: 2, channel: 4 },
      { x: 6, y: 3, vector: 2, channel: 4 },
      // Bottom-left (horizontal mirror)
      { x: 1, y: 8, vector: 1, channel: 5 },
      { x: 1, y: 8, vector: 1, channel: 5 },
      { x: 3, y: 8, vector: 1, channel: 6 },
      { x: 3, y: 8, vector: 1, channel: 6 },
      { x: 1, y: 6, vector: 2, channel: 7 },
      { x: 1, y: 6, vector: 2, channel: 7 },
      { x: 3, y: 6, vector: 0, channel: 4 },
      { x: 3, y: 6, vector: 0, channel: 4 },
      // Bottom-right (both mirrors)
      { x: 8, y: 8, vector: 3, channel: 1 },
      { x: 8, y: 8, vector: 3, channel: 1 },
      { x: 6, y: 8, vector: 3, channel: 2 },
      { x: 6, y: 8, vector: 3, channel: 2 },
      { x: 8, y: 6, vector: 2, channel: 3 },
      { x: 8, y: 6, vector: 2, channel: 3 },
      { x: 6, y: 6, vector: 0, channel: 4 },
      { x: 6, y: 6, vector: 0, channel: 4 }
    ],
    walls: [
      'v:0:4', 'v:1:4', 'v:2:4', 'v:3:4', 'v:4:4',
      'v:5:4', 'v:6:4', 'v:7:4', 'v:8:4', 'v:9:4',
      'h:4:0', 'h:4:1', 'h:4:2', 'h:4:3', 'h:4:4',
      'h:4:5', 'h:4:6', 'h:4:7', 'h:4:8', 'h:4:9'
    ],
    muted: true
  },
  // 8 — Heartbeat: converging arrows with pink/red palette
  {
    name: "Heartbeat",
    size: 8,
    arrows: [
      // Left side heart
      { x: 1, y: 2, vector: 0, channel: 7 },
      { x: 2, y: 1, vector: 1, channel: 7 },
      { x: 3, y: 2, vector: 2, channel: 5 },
      { x: 2, y: 3, vector: 3, channel: 5 },
      // Right side heart  
      { x: 4, y: 2, vector: 0, channel: 5 },
      { x: 5, y: 1, vector: 1, channel: 5 },
      { x: 6, y: 2, vector: 2, channel: 7 },
      { x: 5, y: 3, vector: 3, channel: 7 },
      // Bottom point
      { x: 3, y: 4, vector: 2, channel: 5 },
      { x: 3, y: 4, vector: 2, channel: 5 },
      { x: 4, y: 4, vector: 2, channel: 7 },
      { x: 4, y: 4, vector: 2, channel: 7 },
      { x: 3, y: 5, vector: 1, channel: 5 },
      { x: 4, y: 5, vector: 3, channel: 7 },
      { x: 3, y: 6, vector: 1, channel: 6 },
      { x: 4, y: 6, vector: 3, channel: 6 },
      // Extras
      { x: 0, y: 0, vector: 1, channel: 2 },
      { x: 7, y: 0, vector: 3, channel: 2 },
      { x: 0, y: 7, vector: 0, channel: 4 },
      { x: 7, y: 7, vector: 0, channel: 4 }
    ],
    walls: [
      'h:0:2', 'h:0:5', 'v:1:3', 'v:1:4'
    ],
    muted: true
  },
  // 9 — Labyrinth: complex wall maze with multi-colored arrows
  {
    name: "Labyrinth",
    size: 12,
    arrows: [
      { x: 0, y: 0, vector: 1, channel: 1 },
      { x: 0, y: 0, vector: 1, channel: 1 },
      { x: 0, y: 0, vector: 1, channel: 1 },
      { x: 11, y: 11, vector: 3, channel: 5 },
      { x: 11, y: 11, vector: 3, channel: 5 },
      { x: 11, y: 11, vector: 3, channel: 5 },
      { x: 5, y: 5, vector: 0, channel: 3 },
      { x: 5, y: 5, vector: 0, channel: 3 },
      { x: 6, y: 6, vector: 2, channel: 4 },
      { x: 6, y: 6, vector: 2, channel: 4 },
      { x: 0, y: 11, vector: 0, channel: 2 },
      { x: 0, y: 11, vector: 0, channel: 2 },
      { x: 11, y: 0, vector: 2, channel: 6 },
      { x: 11, y: 0, vector: 2, channel: 6 },
      { x: 3, y: 8, vector: 1, channel: 7 },
      { x: 3, y: 8, vector: 1, channel: 7 },
      { x: 8, y: 3, vector: 3, channel: 7 },
      { x: 8, y: 3, vector: 3, channel: 7 }
    ],
    walls: [
      'v:0:2', 'v:1:2', 'v:2:2',
      'h:2:0', 'h:2:1', 'h:2:2',
      'v:9:8', 'v:10:8', 'v:8:8',
      'h:8:9', 'h:8:10', 'h:8:11',
      'h:4:4', 'h:4:5', 'h:4:6', 'h:4:7',
      'h:7:4', 'h:7:5', 'h:7:6', 'h:7:7',
      'v:4:4', 'v:5:4', 'v:6:4', 'v:7:4',
      'v:4:7', 'v:5:7', 'v:6:7', 'v:7:7',
      'v:2:5', 'v:3:5',
      'h:5:8', 'h:6:8'
    ],
    muted: true
  },
  // 10 — Diagonal weave: forward-diagonal symmetry with alternating colors
  {
    name: "Weave",
    size: 13,
    arrows: [
      { x: 0, y: 12, vector: 2, channel: 1 },
      { x: 0, y: 12, vector: 3, channel: 2 },
      { x: 1, y: 11, vector: 2, channel: 3 },
      { x: 1, y: 11, vector: 3, channel: 4 },
      { x: 2, y: 10, vector: 2, channel: 5 },
      { x: 2, y: 10, vector: 3, channel: 6 },
      { x: 3, y: 9, vector: 2, channel: 7 },
      { x: 3, y: 9, vector: 3, channel: 1 },
      { x: 4, y: 8, vector: 2, channel: 2 },
      { x: 4, y: 8, vector: 3, channel: 3 },
      { x: 5, y: 7, vector: 2, channel: 4 },
      { x: 5, y: 7, vector: 3, channel: 5 },
      { x: 6, y: 6, vector: 2, channel: 6 },
      { x: 6, y: 6, vector: 3, channel: 7 },
      { x: 7, y: 5, vector: 2, channel: 1 },
      { x: 7, y: 5, vector: 3, channel: 2 },
      { x: 8, y: 4, vector: 2, channel: 3 },
      { x: 8, y: 4, vector: 3, channel: 4 },
      { x: 9, y: 3, vector: 2, channel: 5 },
      { x: 9, y: 3, vector: 3, channel: 6 },
      { x: 10, y: 2, vector: 2, channel: 7 },
      { x: 10, y: 2, vector: 3, channel: 1 },
      { x: 11, y: 1, vector: 2, channel: 2 },
      { x: 11, y: 1, vector: 3, channel: 3 },
      { x: 12, y: 0, vector: 2, channel: 4 },
      { x: 12, y: 0, vector: 3, channel: 5 }
    ],
    muted: true
  },
  // 11 — Grid city: walled grid with arrows in each cell, all different colors
  {
    name: "Grid City",
    size: 9,
    arrows: [
      { x: 1, y: 1, vector: 1, channel: 1 },
      { x: 1, y: 1, vector: 1, channel: 1 },
      { x: 4, y: 1, vector: 0, channel: 2 },
      { x: 4, y: 1, vector: 0, channel: 2 },
      { x: 7, y: 1, vector: 3, channel: 3 },
      { x: 7, y: 1, vector: 3, channel: 3 },
      { x: 1, y: 4, vector: 2, channel: 4 },
      { x: 1, y: 4, vector: 2, channel: 4 },
      { x: 4, y: 4, vector: 1, channel: 5 },
      { x: 4, y: 4, vector: 0, channel: 5 },
      { x: 4, y: 4, vector: 3, channel: 5 },
      { x: 4, y: 4, vector: 2, channel: 5 },
      { x: 7, y: 4, vector: 0, channel: 6 },
      { x: 7, y: 4, vector: 0, channel: 6 },
      { x: 1, y: 7, vector: 3, channel: 7 },
      { x: 1, y: 7, vector: 3, channel: 7 },
      { x: 4, y: 7, vector: 2, channel: 1 },
      { x: 4, y: 7, vector: 2, channel: 1 },
      { x: 7, y: 7, vector: 1, channel: 2 },
      { x: 7, y: 7, vector: 1, channel: 2 }
    ],
    walls: [
      'v:0:2', 'v:1:2', 'v:2:2',
      'v:3:2', 'v:4:2', 'v:5:2',
      'v:6:2', 'v:7:2', 'v:8:2',
      'v:0:5', 'v:1:5', 'v:2:5',
      'v:3:5', 'v:4:5', 'v:5:5',
      'v:6:5', 'v:7:5', 'v:8:5',
      'h:2:0', 'h:2:1', 'h:2:2',
      'h:2:3', 'h:2:4', 'h:2:5',
      'h:2:6', 'h:2:7', 'h:2:8',
      'h:5:0', 'h:5:1', 'h:5:2',
      'h:5:3', 'h:5:4', 'h:5:5',
      'h:5:6', 'h:5:7', 'h:5:8'
    ],
    muted: true
  },
  // 12 — Color fountain: center burst with walls channeling outward
  {
    name: "Fountain",
    size: 10,
    arrows: [
      { x: 4, y: 4, vector: 0, channel: 1 },
      { x: 4, y: 4, vector: 0, channel: 1 },
      { x: 5, y: 4, vector: 0, channel: 2 },
      { x: 5, y: 4, vector: 0, channel: 2 },
      { x: 4, y: 5, vector: 2, channel: 5 },
      { x: 4, y: 5, vector: 2, channel: 5 },
      { x: 5, y: 5, vector: 2, channel: 6 },
      { x: 5, y: 5, vector: 2, channel: 6 },
      { x: 4, y: 4, vector: 3, channel: 3 },
      { x: 4, y: 4, vector: 3, channel: 3 },
      { x: 5, y: 5, vector: 1, channel: 4 },
      { x: 5, y: 5, vector: 1, channel: 4 },
      { x: 0, y: 0, vector: 2, channel: 7 },
      { x: 9, y: 0, vector: 2, channel: 7 },
      { x: 0, y: 9, vector: 0, channel: 7 },
      { x: 9, y: 9, vector: 0, channel: 7 },
      { x: 0, y: 0, vector: 1, channel: 3 },
      { x: 9, y: 0, vector: 3, channel: 3 },
      { x: 0, y: 9, vector: 1, channel: 4 },
      { x: 9, y: 9, vector: 3, channel: 4 }
    ],
    walls: [
      'v:4:3', 'v:5:3', 'v:4:5', 'v:5:5',
      'h:3:4', 'h:3:5', 'h:5:4', 'h:5:5'
    ],
    muted: true
  }
];
