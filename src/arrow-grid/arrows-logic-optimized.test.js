/**
 * Tests for Optimized Arrow Logic
 * Compares output with original implementation and benchmarks performance
 */

import * as original from './arrows-logic';
import * as optimized from './arrows-logic-optimized';

// Mock playSounds
jest.mock('./play-notes', () => ({
    playSounds: jest.fn(),
    musicalNotes: []
}));

describe('Optimized Logic - Correctness', () => {
    test('emptyGrid produces equivalent output', () => {
        const origGrid = original.emptyGrid(8);
        const optGrid = optimized.emptyGrid(8);
        
        expect(optGrid.size).toBe(origGrid.size);
        expect(optGrid.arrows).toHaveLength(0);
        expect(optGrid.muted).toBe(true);
    });

    test('removeFromGrid works correctly', () => {
        const grid = optimized.emptyGrid(8);
        const symmetries = {
            horizontalSymmetry: false,
            verticalSymmetry: false,
            backwardDiagonalSymmetry: false,
            forwardDiagonalSymmetry: false
        };
        
        const withArrow = optimized.addToGrid(grid, 3, 3, 0, symmetries, 1, false);
        expect(withArrow.arrows).toHaveLength(1);
        
        const without = optimized.removeFromGrid(withArrow, 3, 3);
        expect(without.arrows).toHaveLength(0);
    });

    test('single arrow movement matches original', () => {
        // Test arrow moving up
        const origGrid = {
            size: 8, id: 'test', muted: true,
            arrows: [{ x: 4, y: 4, vector: 0 }]
        };
        const optGrid = { ...origGrid };
        
        const origNext = original.nextGrid(origGrid, 350, [0], 60);
        const optNext = optimized.nextGrid(optGrid, 350, [0], 60);
        
        expect(optNext.arrows).toHaveLength(origNext.arrows.length);
        expect(optNext.arrows[0].x).toBe(origNext.arrows[0].x);
        expect(optNext.arrows[0].y).toBe(origNext.arrows[0].y);
        expect(optNext.arrows[0].vector).toBe(origNext.arrows[0].vector);
    });

    test('boundary flip matches original', () => {
        const origGrid = {
            size: 8, id: 'test', muted: true,
            arrows: [{ x: 4, y: 0, vector: 0 }] // at top, pointing up
        };
        const optGrid = { ...origGrid, arrows: [...origGrid.arrows] };
        
        const origNext = original.nextGrid(origGrid, 350, [0], 60);
        const optNext = optimized.nextGrid(optGrid, 350, [0], 60);
        
        expect(optNext.arrows[0].vector).toBe(origNext.arrows[0].vector);
        expect(optNext.arrows[0].y).toBe(origNext.arrows[0].y);
    });

    test('arrow reduction (mod 4) works correctly', () => {
        // 5 identical arrows should reduce to 1
        const grid = {
            size: 8, id: 'test', muted: true,
            arrows: [
                { x: 4, y: 4, vector: 0 },
                { x: 4, y: 4, vector: 0 },
                { x: 4, y: 4, vector: 0 },
                { x: 4, y: 4, vector: 0 },
                { x: 4, y: 4, vector: 0 }
            ]
        };
        
        const next = optimized.nextGrid(grid, 350, [0], 60);
        expect(next.arrows.length).toBe(1);
    });

    test('rotation at same location works correctly', () => {
        // 2 different arrows at same location
        const grid = {
            size: 8, id: 'test', muted: true,
            arrows: [
                { x: 4, y: 4, vector: 0 },
                { x: 4, y: 4, vector: 1 }
            ]
        };
        
        const next = optimized.nextGrid(grid, 350, [0], 60);
        expect(next.arrows).toHaveLength(2);
        
        // Each arrow should have rotated by 1 (2 arrows = rotate by 1)
        const vectors = new Set(next.arrows.map(a => a.vector));
        expect(vectors.has(1)).toBe(true);
        expect(vectors.has(2)).toBe(true);
    });
});

describe('Optimized Logic - Edge Cases', () => {
    test('handles empty grid', () => {
        const grid = optimized.emptyGrid(8);
        const next = optimized.nextGrid(grid, 350, [0], 60);
        expect(next.arrows).toHaveLength(0);
    });

    test('handles out-of-bounds arrows gracefully', () => {
        const grid = {
            size: 8, id: 'test', muted: true,
            arrows: [
                { x: -1, y: 4, vector: 0 },
                { x: 4, y: 4, vector: 0 },
                { x: 10, y: 4, vector: 0 }
            ]
        };
        
        const next = optimized.nextGrid(grid, 350, [0], 60);
        // Only valid arrow should remain
        expect(next.arrows.length).toBeLessThanOrEqual(1);
    });

    test('arrows stay in bounds over many iterations', () => {
        let grid = optimized.newGrid(8, 50);
        grid.muted = true;
        
        for (let i = 0; i < 100; i++) {
            grid = optimized.nextGrid(grid, 350, [0], 60);
            for (const arrow of grid.arrows) {
                expect(arrow.x).toBeGreaterThanOrEqual(0);
                expect(arrow.x).toBeLessThan(8);
                expect(arrow.y).toBeGreaterThanOrEqual(0);
                expect(arrow.y).toBeLessThan(8);
            }
        }
    });

    test('2x2 grid corner behavior', () => {
        const grid = {
            size: 2, id: 'test', muted: true,
            arrows: [{ x: 0, y: 0, vector: 0 }]
        };
        
        const next = optimized.nextGrid(grid, 350, [0], 60);
        expect(next.arrows[0].vector).toBe(2); // flipped down
    });
});

describe('Performance Benchmarks', () => {
    test('100 arrows x 100 iterations - optimized', () => {
        let grid = optimized.newGrid(20, 100);
        grid.muted = true;
        const start = performance.now();
        
        for (let i = 0; i < 100; i++) {
            grid = optimized.nextGrid(grid, 350, [0], 60);
        }
        
        const elapsed = performance.now() - start;
        console.log(`OPTIMIZED: 100 arrows x 100 iterations: ${elapsed.toFixed(2)}ms`);
        expect(elapsed).toBeLessThan(1000);
    });

    test('200 arrows x 100 iterations - optimized', () => {
        let grid = optimized.newGrid(20, 200);
        grid.muted = true;
        const start = performance.now();
        
        for (let i = 0; i < 100; i++) {
            grid = optimized.nextGrid(grid, 350, [0], 60);
        }
        
        const elapsed = performance.now() - start;
        console.log(`OPTIMIZED: 200 arrows x 100 iterations: ${elapsed.toFixed(2)}ms`);
        expect(elapsed).toBeLessThan(2000);
    });

    test('400 arrows x 100 iterations - optimized', () => {
        let grid = optimized.newGrid(20, 400);
        grid.muted = true;
        const start = performance.now();
        
        for (let i = 0; i < 100; i++) {
            grid = optimized.nextGrid(grid, 350, [0], 60);
        }
        
        const elapsed = performance.now() - start;
        console.log(`OPTIMIZED: 400 arrows x 100 iterations: ${elapsed.toFixed(2)}ms`);
        expect(elapsed).toBeLessThan(5000);
    });

    test('compare original vs optimized performance', () => {
        // Original
        let origGrid = original.newGrid(15, 100);
        origGrid.muted = true;
        const origStart = performance.now();
        
        for (let i = 0; i < 50; i++) {
            origGrid = original.nextGrid(origGrid, 350, [0], 60);
        }
        
        const origElapsed = performance.now() - origStart;
        
        // Optimized
        let optGrid = optimized.newGrid(15, 100);
        optGrid.muted = true;
        const optStart = performance.now();
        
        for (let i = 0; i < 50; i++) {
            optGrid = optimized.nextGrid(optGrid, 350, [0], 60);
        }
        
        const optElapsed = performance.now() - optStart;
        
        console.log(`Original: ${origElapsed.toFixed(2)}ms`);
        console.log(`Optimized: ${optElapsed.toFixed(2)}ms`);
        console.log(`Speedup: ${(origElapsed / optElapsed).toFixed(2)}x`);
        
        // Optimized should be faster (or at least not significantly slower)
        expect(optElapsed).toBeLessThanOrEqual(origElapsed * 1.5);
    });
});

describe('Internal Functions', () => {
    const { arrowHash, locationHash, isAtBoundary, moveArrowInPlace, flipArrowInPlace } = optimized._internal;
    
    test('arrowHash produces unique values', () => {
        const h1 = arrowHash(0, 0, 0);
        const h2 = arrowHash(0, 0, 1);
        const h3 = arrowHash(0, 1, 0);
        const h4 = arrowHash(1, 0, 0);
        
        const set = new Set([h1, h2, h3, h4]);
        expect(set.size).toBe(4);
    });
    
    test('locationHash groups same positions', () => {
        const h1 = locationHash(5, 5);
        const h2 = locationHash(5, 5);
        expect(h1).toBe(h2);
    });
    
    test('isAtBoundary detects boundaries correctly', () => {
        expect(isAtBoundary({ x: 4, y: 0, vector: 0 }, 8)).toBe(true);
        expect(isAtBoundary({ x: 7, y: 4, vector: 1 }, 8)).toBe(true);
        expect(isAtBoundary({ x: 4, y: 7, vector: 2 }, 8)).toBe(true);
        expect(isAtBoundary({ x: 0, y: 4, vector: 3 }, 8)).toBe(true);
        expect(isAtBoundary({ x: 4, y: 4, vector: 0 }, 8)).toBe(false);
    });
    
    test('moveArrowInPlace mutates correctly', () => {
        const arrow = { x: 5, y: 5, vector: 0 };
        moveArrowInPlace(arrow);
        expect(arrow.y).toBe(4);
        
        arrow.vector = 1;
        moveArrowInPlace(arrow);
        expect(arrow.x).toBe(6);
    });
    
    test('flipArrowInPlace flips direction', () => {
        const arrow = { x: 0, y: 0, vector: 0 };
        flipArrowInPlace(arrow);
        expect(arrow.vector).toBe(2);
        
        flipArrowInPlace(arrow);
        expect(arrow.vector).toBe(0);
    });
});
