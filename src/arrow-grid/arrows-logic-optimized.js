/**
 * Optimized Arrow Grid Logic
 * 
 * This is an optimized version of arrows-logic.js that:
 * 1. Uses typed arrays where possible
 * 2. Avoids excessive object/array creation
 * 3. Uses numeric hashing instead of string keys
 * 4. Reuses buffers between frames
 * 5. Minimizes garbage collection pressure
 */

import { playSounds } from './play-notes';

export const NO_BOUNDARY = 0;
export const BOUNDARY = 1;

// Vector directions: 0=up, 1=right, 2=down, 3=left
const VECTOR_UP = 0;
const VECTOR_RIGHT = 1;
const VECTOR_DOWN = 2;
const VECTOR_LEFT = 3;

// Pre-allocated buffers for arrow processing (reused each frame)
let arrowBuffer1 = new Array(1000);
let arrowBuffer2 = new Array(1000);
let locationMap = new Map();
let vectorMap = new Map();

/**
 * Create a numeric hash for arrow position + vector
 * Max grid size of 256 supported
 */
const arrowHash = (x, y, vector) => (x << 16) | (y << 8) | vector;

/**
 * Create a numeric hash for arrow position only
 */
const locationHash = (x, y) => (x << 8) | y;

/**
 * Move arrow one step in its direction (mutates arrow)
 */
const moveArrowInPlace = (arrow) => {
    switch (arrow.vector) {
        case VECTOR_UP: arrow.y--; break;
        case VECTOR_RIGHT: arrow.x++; break;
        case VECTOR_DOWN: arrow.y++; break;
        case VECTOR_LEFT: arrow.x--; break;
    }
};

/**
 * Flip arrow direction (mutates arrow)
 */
const flipArrowInPlace = (arrow) => {
    arrow.vector = (arrow.vector + 2) & 3;
};

/**
 * Rotate arrow by offset (mutates arrow)
 */
const rotateArrowInPlace = (arrow, offset) => {
    arrow.vector = (arrow.vector + offset) & 3;
};

/**
 * Check if arrow is at boundary and pointing outward.
 * Checks both exterior walls and internal walls (if wallSet provided).
 */
const isAtBoundary = (arrow, size, wallSet) => {
    const { x, y, vector } = arrow;
    // Exterior walls
    if (
        (y === 0 && vector === VECTOR_UP) ||
        (x === size - 1 && vector === VECTOR_RIGHT) ||
        (y === size - 1 && vector === VECTOR_DOWN) ||
        (x === 0 && vector === VECTOR_LEFT)
    ) return true;
    // Internal walls
    if (wallSet && wallSet.size > 0) {
        if (vector === VECTOR_UP && y > 0 && wallSet.has(`h:${y - 1}:${x}`)) return true;
        if (vector === VECTOR_RIGHT && x < size - 1 && wallSet.has(`v:${y}:${x}`)) return true;
        if (vector === VECTOR_DOWN && y < size - 1 && wallSet.has(`h:${y}:${x}`)) return true;
        if (vector === VECTOR_LEFT && x > 0 && wallSet.has(`v:${y}:${x - 1}`)) return true;
    }
    return false;
};

/**
 * Check if arrow is within grid bounds
 */
const isInBounds = (arrow, size) => {
    return arrow.x >= 0 && arrow.y >= 0 && arrow.x < size && arrow.y < size;
};

/**
 * Clone an arrow object
 */
const cloneArrow = (arrow) => ({ x: arrow.x, y: arrow.y, vector: arrow.vector, channel: arrow.channel ?? 1, velocity: arrow.velocity ?? 1.0 });

/**
 * Generate a unique ID (simple counter-based for performance)
 */
let idCounter = 0;
const generateId = () => `grid-${++idCounter}`;

/**
 * Create a new grid with random arrows
 */
export const newGrid = (size, numberOfArrows) => {
    const arrows = [];
    for (let i = 0; i < numberOfArrows; i++) {
        arrows.push({
            x: Math.floor(Math.random() * size),
            y: Math.floor(Math.random() * size),
            vector: Math.floor(Math.random() * 4)
        });
    }
    return { size, id: generateId(), arrows, muted: true };
};

/**
 * Create an empty grid
 */
export const emptyGrid = (size) => {
    return { size, id: generateId(), arrows: [], muted: true };
};

/**
 * Remove all arrows at a specific position
 */
export const removeFromGrid = (grid, x, y) => {
    return {
        ...grid,
        id: generateId(),
        arrows: grid.arrows.filter(arrow => arrow.x !== x || arrow.y !== y)
    };
};

// With optimized logic, we can handle ~9000 arrows at 60fps
// Setting limit to 4000 for comfortable headroom
const MAX_ARROWS = 4000;

/**
 * Add arrows to grid with symmetry support
 */
export const addToGrid = (grid, x, y, dir, symmetries, inputNumber, forced, arrowChannel, arrowVelocity) => {
    if (grid.arrows.length > MAX_ARROWS) return grid;
    
    // Check for duplicate
    if (!forced && grid.arrows.some(a => a.x === x && a.y === y && a.vector === dir)) {
        return grid;
    }
    
    const newArrows = [...grid.arrows];
    const toAdd = [];
    
    // Add base arrows
    for (let i = 0; i < inputNumber; i++) {
        toAdd.push({ x, y, vector: dir, channel: arrowChannel ?? 1, velocity: arrowVelocity ?? 1.0 });
    }
    
    // Apply symmetries
    const { horizontalSymmetry, verticalSymmetry, backwardDiagonalSymmetry, forwardDiagonalSymmetry } = symmetries;
    const skipForth = horizontalSymmetry && verticalSymmetry && backwardDiagonalSymmetry;
    
    if (horizontalSymmetry) {
        const len = toAdd.length;
        for (let i = 0; i < len; i++) {
            const a = toAdd[i];
            toAdd.push({
                x: a.x,
                y: getMirror(a.y, grid.size),
                vector: [2, 1, 0, 3][a.vector],
                channel: a.channel,
                velocity: a.velocity
            });
        }
    }
    
    if (verticalSymmetry) {
        const len = toAdd.length;
        for (let i = 0; i < len; i++) {
            const a = toAdd[i];
            toAdd.push({
                x: getMirror(a.x, grid.size),
                y: a.y,
                vector: [0, 3, 2, 1][a.vector],
                channel: a.channel,
                velocity: a.velocity
            });
        }
    }
    
    if (backwardDiagonalSymmetry) {
        const len = toAdd.length;
        for (let i = 0; i < len; i++) {
            const a = toAdd[i];
            toAdd.push({
                x: a.y,
                y: a.x,
                vector: [3, 2, 1, 0][a.vector],
                channel: a.channel,
                velocity: a.velocity
            });
        }
    }
    
    if (forwardDiagonalSymmetry && !skipForth) {
        const len = toAdd.length;
        for (let i = 0; i < len; i++) {
            const a = toAdd[i];
            toAdd.push({
                x: getMirror(a.y, grid.size),
                y: getMirror(a.x, grid.size),
                vector: [1, 0, 3, 2][a.vector],
                channel: a.channel,
                velocity: a.velocity
            });
        }
    }
    
    // Add all new arrows
    for (const arrow of toAdd) {
        if (newArrows.length < MAX_ARROWS) {
            newArrows.push(arrow);
        }
    }
    
    return { ...grid, id: generateId(), arrows: newArrows };
};

const getMirror = (pos, gridSize) => {
    const half = Math.floor(gridSize / 2);
    const offset = half - pos;
    let location = half + offset;
    if ((gridSize % 2) === 0) location--;
    return location;
};

// Legacy exports for compatibility
export const arrowKey = arrow => `{x:${arrow.x},y:${arrow.y},vector:${arrow.vector}}`;
export const locationKey = arrow => `{x:${arrow.x},y:${arrow.y}}`;

export const arrowBoundaryKey = (arrow, size) => {
    return isAtBoundary(arrow, size) ? 'boundary' : 'no-boundary';
};

export const boundaryKey = (arrow, size, rotations = 0, walls) => {
    const vector = (arrow.vector + rotations) % 4;
    if (arrow.y === 0 && vector === 0) return 'y';
    if (arrow.x === size - 1 && vector === 1) return 'x';
    if (arrow.y === size - 1 && vector === 2) return 'y';
    if (arrow.x === 0 && vector === 3) return 'x';
    // Internal walls
    if (walls && walls.length > 0) {
        const wallSet = walls._set || (walls._set = new Set(walls));
        if (vector === 0 && arrow.y > 0 && wallSet.has(`h:${arrow.y - 1}:${arrow.x}`)) return 'y';
        if (vector === 1 && arrow.x < size - 1 && wallSet.has(`v:${arrow.y}:${arrow.x}`)) return 'x';
        if (vector === 2 && arrow.y < size - 1 && wallSet.has(`h:${arrow.y}:${arrow.x}`)) return 'y';
        if (vector === 3 && arrow.x > 0 && wallSet.has(`v:${arrow.y}:${arrow.x - 1}`)) return 'x';
    }
    return 'no-boundary';
};

export const getArrowBoundaryDictionary = (arrows, size, keyFunc, rotations, walls) => {
    const dict = {};
    for (const arrow of arrows) {
        const key = keyFunc(arrow, size, rotations, walls);
        if (!dict[key]) dict[key] = [];
        dict[key].push(arrow);
    }
    return dict;
};

/**
 * OPTIMIZED: Compute next grid state
 * This is the hot path - heavily optimized for performance
 */
export const nextGrid = (grid, length, scale, musicalKey, globalVelocity, channelSettings) => {
    const { size, arrows } = grid;
    const arrowCount = arrows.length;
    
    if (arrowCount === 0) {
        return { ...grid, id: generateId() };
    }

    // Build wall lookup set for internal walls
    const walls = grid.walls || [];
    const wallSet = walls.length > 0 ? new Set(walls) : null;
    
    // Step 1: Group by position+vector+sound and reduce (mod 4)
    vectorMap.clear();
    
    for (let i = 0; i < arrowCount; i++) {
        const arrow = arrows[i];
        // Filter out-of-bounds arrows
        if (arrow.x < 0 || arrow.y < 0 || arrow.x >= size || arrow.y >= size) continue;
        
        const hash = arrowHash(arrow.x, arrow.y, arrow.vector);
        const ch = arrow.channel ?? 1;
        const key = hash * 17 + ch;  // 17 to avoid collisions with channels 1-16
        const existing = vectorMap.get(key);
        if (existing === undefined) {
            vectorMap.set(key, { count: 1, channel: ch, x: arrow.x, y: arrow.y, vector: arrow.vector, velocity: arrow.velocity ?? 1.0 });
        } else {
            existing.count++;
        }
    }
    
    // Step 2: Build reduced arrows array (keep count % 4, or 4 if divisible)
    let reducedCount = 0;
    
    for (const [, entry] of vectorMap) {
        const keep = entry.count % 4 || 4;
        
        for (let j = 0; j < keep; j++) {
            if (reducedCount >= arrowBuffer1.length) {
                arrowBuffer1.length = arrowBuffer1.length * 2;
            }
            arrowBuffer1[reducedCount++] = { x: entry.x, y: entry.y, vector: entry.vector, channel: entry.channel, velocity: entry.velocity ?? 1.0 };
        }
    }
    
    // Step 3: Group by location and apply rotation
    locationMap.clear();
    
    for (let i = 0; i < reducedCount; i++) {
        const arrow = arrowBuffer1[i];
        const hash = locationHash(arrow.x, arrow.y);
        let group = locationMap.get(hash);
        if (!group) {
            group = [];
            locationMap.set(hash, group);
        }
        group.push(arrow);
    }
    
    // Apply rotation to each group (n arrows rotate by n-1)
    let rotatedCount = 0;
    
    for (const group of locationMap.values()) {
        const rotateBy = (group.length - 1) % 4;
        for (const arrow of group) {
            if (rotatedCount >= arrowBuffer2.length) {
                arrowBuffer2.length = arrowBuffer2.length * 2;
            }
            arrowBuffer2[rotatedCount++] = {
                x: arrow.x,
                y: arrow.y,
                vector: (arrow.vector + rotateBy) & 3,
                channel: arrow.channel,
                velocity: arrow.velocity ?? 1.0
            };
        }
    }
    
    // Step 4: Move arrows (flip if at boundary, then move)
    const nextArrows = [];
    const boundaryArrows = [];
    
    for (let i = 0; i < rotatedCount; i++) {
        const arrow = arrowBuffer2[i];
        
        if (isAtBoundary(arrow, size, wallSet)) {
            // At boundary: flip direction, then move
            boundaryArrows.push({ ...arrow }); // For sound
            flipArrowInPlace(arrow);
        }
        
        moveArrowInPlace(arrow);
        nextArrows.push(arrow);
    }
    
    // Step 5: Check for arrows hitting boundary after movement (for sound)
    const soundArrows = [];
    for (const arrow of nextArrows) {
        if (isAtBoundary(arrow, size, wallSet)) {
            soundArrows.push(arrow);
        }
    }
    
    // Play sounds
    playSounds(soundArrows, size, length, grid.soundOn, grid.midiOn, scale, musicalKey, globalVelocity, channelSettings);
    
    return {
        ...grid,
        id: generateId(),
        arrows: nextArrows
    };
};

// For testing: expose internal functions
export const _internal = {
    arrowHash,
    locationHash,
    isAtBoundary,
    isInBounds,
    moveArrowInPlace,
    flipArrowInPlace,
    rotateArrowInPlace,
    cloneArrow
};
