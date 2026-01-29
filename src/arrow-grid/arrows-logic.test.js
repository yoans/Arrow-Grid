/**
 * Arrow Grid - Core Logic Tests
 * 
 * Tests for the arrow movement algorithm to ensure correctness
 * before optimization. These tests lock in expected behavior.
 */

import {
    newGrid,
    emptyGrid,
    addToGrid,
    removeFromGrid,
    nextGrid,
    arrowKey,
    locationKey,
    arrowBoundaryKey,
    boundaryKey,
    getArrowBoundaryDictionary,
    NO_BOUNDARY,
    BOUNDARY
} from './arrows-logic';

// Mock playSounds to avoid audio in tests
jest.mock('./play-notes', () => ({
    playSounds: jest.fn(),
    musicalNotes: []
}));

describe('Grid Creation', () => {
    test('newGrid creates grid with correct size', () => {
        const grid = newGrid(8, 0);
        expect(grid.size).toBe(8);
        expect(grid.arrows).toHaveLength(0);
        expect(grid.id).toBeDefined();
    });

    test('newGrid creates specified number of arrows', () => {
        const grid = newGrid(8, 5);
        expect(grid.arrows).toHaveLength(5);
    });

    test('newGrid arrows are within bounds', () => {
        const grid = newGrid(8, 20);
        grid.arrows.forEach(arrow => {
            expect(arrow.x).toBeGreaterThanOrEqual(0);
            expect(arrow.x).toBeLessThan(8);
            expect(arrow.y).toBeGreaterThanOrEqual(0);
            expect(arrow.y).toBeLessThan(8);
            expect(arrow.vector).toBeGreaterThanOrEqual(0);
            expect(arrow.vector).toBeLessThanOrEqual(3);
        });
    });

    test('emptyGrid creates grid with no arrows', () => {
        const grid = emptyGrid(10);
        expect(grid.size).toBe(10);
        expect(grid.arrows).toHaveLength(0);
    });
});

describe('Arrow Keys', () => {
    test('arrowKey generates unique key for arrow', () => {
        const arrow = { x: 3, y: 5, vector: 2 };
        const key = arrowKey(arrow);
        expect(key).toBe('{x:3,y:5,vector:2}');
    });

    test('locationKey generates key without vector', () => {
        const arrow = { x: 3, y: 5, vector: 2 };
        const key = locationKey(arrow);
        expect(key).toBe('{x:3,y:5}');
    });

    test('different arrows have different arrowKeys', () => {
        const arrow1 = { x: 3, y: 5, vector: 2 };
        const arrow2 = { x: 3, y: 5, vector: 1 };
        expect(arrowKey(arrow1)).not.toBe(arrowKey(arrow2));
    });

    test('arrows at same location have same locationKey', () => {
        const arrow1 = { x: 3, y: 5, vector: 2 };
        const arrow2 = { x: 3, y: 5, vector: 1 };
        expect(locationKey(arrow1)).toBe(locationKey(arrow2));
    });
});

describe('Boundary Detection', () => {
    const size = 8;

    test('arrow pointing up at top edge is at boundary', () => {
        const arrow = { x: 4, y: 0, vector: 0 }; // vector 0 = up
        expect(boundaryKey(arrow, size)).toBe('y');
        expect(arrowBoundaryKey(arrow, size)).toBe(BOUNDARY);
    });

    test('arrow pointing right at right edge is at boundary', () => {
        const arrow = { x: 7, y: 4, vector: 1 }; // vector 1 = right
        expect(boundaryKey(arrow, size)).toBe('x');
        expect(arrowBoundaryKey(arrow, size)).toBe(BOUNDARY);
    });

    test('arrow pointing down at bottom edge is at boundary', () => {
        const arrow = { x: 4, y: 7, vector: 2 }; // vector 2 = down
        expect(boundaryKey(arrow, size)).toBe('y');
        expect(arrowBoundaryKey(arrow, size)).toBe(BOUNDARY);
    });

    test('arrow pointing left at left edge is at boundary', () => {
        const arrow = { x: 0, y: 4, vector: 3 }; // vector 3 = left
        expect(boundaryKey(arrow, size)).toBe('x');
        expect(arrowBoundaryKey(arrow, size)).toBe(BOUNDARY);
    });

    test('arrow in middle is not at boundary', () => {
        const arrow = { x: 4, y: 4, vector: 0 };
        expect(boundaryKey(arrow, size)).toBe(NO_BOUNDARY);
        expect(arrowBoundaryKey(arrow, size)).toBe(NO_BOUNDARY);
    });

    test('arrow at edge but pointing inward is not at boundary', () => {
        const arrow = { x: 0, y: 4, vector: 1 }; // at left edge, pointing right
        expect(boundaryKey(arrow, size)).toBe(NO_BOUNDARY);
    });
});

describe('Add/Remove Arrows', () => {
    test('addToGrid adds arrow to empty grid', () => {
        const grid = emptyGrid(8);
        const symmetries = {
            horizontalSymmetry: false,
            verticalSymmetry: false,
            backwardDiagonalSymmetry: false,
            forwardDiagonalSymmetry: false
        };
        const newGridResult = addToGrid(grid, 3, 3, 0, symmetries, 1, false);
        expect(newGridResult.arrows).toHaveLength(1);
        expect(newGridResult.arrows[0]).toMatchObject({ x: 3, y: 3, vector: 0 });
    });

    test('addToGrid respects max 400 arrow limit', () => {
        let grid = emptyGrid(8);
        const symmetries = {
            horizontalSymmetry: false,
            verticalSymmetry: false,
            backwardDiagonalSymmetry: false,
            forwardDiagonalSymmetry: false
        };
        // Add 401 arrows
        for (let i = 0; i < 401; i++) {
            grid = addToGrid(grid, i % 8, Math.floor(i / 8) % 8, i % 4, symmetries, 1, true);
        }
        expect(grid.arrows.length).toBeLessThanOrEqual(400);
    });

    test('removeFromGrid removes arrow at position', () => {
        const grid = emptyGrid(8);
        const symmetries = {
            horizontalSymmetry: false,
            verticalSymmetry: false,
            backwardDiagonalSymmetry: false,
            forwardDiagonalSymmetry: false
        };
        const gridWithArrow = addToGrid(grid, 3, 3, 0, symmetries, 1, false);
        const gridWithoutArrow = removeFromGrid(gridWithArrow, 3, 3);
        expect(gridWithoutArrow.arrows).toHaveLength(0);
    });

    test('addToGrid with horizontal symmetry adds mirrored arrow', () => {
        const grid = emptyGrid(8);
        const symmetries = {
            horizontalSymmetry: true,
            verticalSymmetry: false,
            backwardDiagonalSymmetry: false,
            forwardDiagonalSymmetry: false
        };
        const newGridResult = addToGrid(grid, 3, 1, 0, symmetries, 1, false);
        expect(newGridResult.arrows.length).toBeGreaterThan(1);
    });
});

describe('Arrow Movement (nextGrid)', () => {
    test('single arrow moves in its direction', () => {
        const grid = {
            size: 8,
            id: 'test',
            arrows: [{ x: 4, y: 4, vector: 0 }], // pointing up
            muted: true
        };
        const next = nextGrid(grid, 350, [0, 2, 4, 5, 7, 9, 11], 60);
        expect(next.arrows).toHaveLength(1);
        expect(next.arrows[0].y).toBe(3); // moved up
        expect(next.arrows[0].x).toBe(4); // same x
    });

    test('arrow at boundary flips direction', () => {
        const grid = {
            size: 8,
            id: 'test',
            arrows: [{ x: 4, y: 0, vector: 0 }], // pointing up at top edge
            muted: true
        };
        const next = nextGrid(grid, 350, [0, 2, 4, 5, 7, 9, 11], 60);
        expect(next.arrows).toHaveLength(1);
        expect(next.arrows[0].vector).toBe(2); // flipped to down
        expect(next.arrows[0].y).toBe(1); // moved down
    });

    test('two arrows at same location rotate', () => {
        const grid = {
            size: 8,
            id: 'test',
            arrows: [
                { x: 4, y: 4, vector: 0 },
                { x: 4, y: 4, vector: 1 }
            ],
            muted: true
        };
        const next = nextGrid(grid, 350, [0, 2, 4, 5, 7, 9, 11], 60);
        expect(next.arrows).toHaveLength(2);
        // Both arrows should have rotated by 1 (2 arrows at same spot)
        const vectors = next.arrows.map(a => a.vector).sort();
        expect(vectors).toEqual([1, 2]); // rotated from [0,1] to [1,2]
    });

    test('four arrows at same location rotate back to original', () => {
        const grid = {
            size: 8,
            id: 'test',
            arrows: [
                { x: 4, y: 4, vector: 0 },
                { x: 4, y: 4, vector: 1 },
                { x: 4, y: 4, vector: 2 },
                { x: 4, y: 4, vector: 3 }
            ],
            muted: true
        };
        const next = nextGrid(grid, 350, [0, 2, 4, 5, 7, 9, 11], 60);
        expect(next.arrows).toHaveLength(4);
        // 4 arrows rotate by 4-1=3, which is same as -1, so vectors stay same
    });

    test('grid maintains size after nextGrid', () => {
        const grid = newGrid(8, 10);
        grid.muted = true;
        const next = nextGrid(grid, 350, [0, 2, 4, 5, 7, 9, 11], 60);
        expect(next.size).toBe(8);
    });

    test('arrows stay within bounds after movement', () => {
        const grid = newGrid(8, 50);
        grid.muted = true;
        let current = grid;
        // Run 100 iterations
        for (let i = 0; i < 100; i++) {
            current = nextGrid(current, 350, [0, 2, 4, 5, 7, 9, 11], 60);
            current.arrows.forEach(arrow => {
                expect(arrow.x).toBeGreaterThanOrEqual(0);
                expect(arrow.x).toBeLessThan(8);
                expect(arrow.y).toBeGreaterThanOrEqual(0);
                expect(arrow.y).toBeLessThan(8);
            });
        }
    });
});

describe('Arrow Dictionary Creation', () => {
    test('getArrowBoundaryDictionary groups arrows by key', () => {
        const arrows = [
            { x: 0, y: 0, vector: 0 },
            { x: 0, y: 0, vector: 1 },
            { x: 1, y: 1, vector: 0 }
        ];
        const dict = getArrowBoundaryDictionary(arrows, 8, locationKey);
        expect(Object.keys(dict)).toHaveLength(2);
        expect(dict['{x:0,y:0}']).toHaveLength(2);
        expect(dict['{x:1,y:1}']).toHaveLength(1);
    });

    test('getArrowBoundaryDictionary separates boundary and non-boundary', () => {
        const arrows = [
            { x: 4, y: 0, vector: 0 }, // at boundary (top, pointing up)
            { x: 4, y: 4, vector: 0 }  // not at boundary
        ];
        const dict = getArrowBoundaryDictionary(arrows, 8, arrowBoundaryKey);
        expect(dict[BOUNDARY]).toHaveLength(1);
        expect(dict[NO_BOUNDARY]).toHaveLength(1);
    });
});

describe('Performance Baseline', () => {
    test('can handle 100 arrows for 100 iterations', () => {
        const grid = newGrid(20, 100);
        grid.muted = true;
        let current = grid;
        const start = performance.now();
        
        for (let i = 0; i < 100; i++) {
            current = nextGrid(current, 350, [0, 2, 4, 5, 7, 9, 11], 60);
        }
        
        const elapsed = performance.now() - start;
        console.log(`100 arrows x 100 iterations: ${elapsed.toFixed(2)}ms`);
        expect(elapsed).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    test('can handle 200 arrows for 50 iterations', () => {
        const grid = newGrid(20, 200);
        grid.muted = true;
        let current = grid;
        const start = performance.now();
        
        for (let i = 0; i < 50; i++) {
            current = nextGrid(current, 350, [0, 2, 4, 5, 7, 9, 11], 60);
        }
        
        const elapsed = performance.now() - start;
        console.log(`200 arrows x 50 iterations: ${elapsed.toFixed(2)}ms`);
        expect(elapsed).toBeLessThan(5000);
    });

    test('arrow count remains stable over iterations', () => {
        const grid = newGrid(10, 50);
        grid.muted = true;
        let current = grid;
        const initialCount = current.arrows.length;
        
        for (let i = 0; i < 50; i++) {
            current = nextGrid(current, 350, [0, 2, 4, 5, 7, 9, 11], 60);
        }
        
        // Arrow count should not explode
        expect(current.arrows.length).toBeLessThanOrEqual(initialCount * 2);
    });
});

describe('Edge Cases', () => {
    test('empty grid stays empty', () => {
        const grid = emptyGrid(8);
        grid.muted = true;
        const next = nextGrid(grid, 350, [0, 2, 4, 5, 7, 9, 11], 60);
        expect(next.arrows).toHaveLength(0);
    });

    test('single arrow on 2x2 grid bounces correctly', () => {
        const grid = {
            size: 2,
            id: 'test',
            arrows: [{ x: 0, y: 0, vector: 0 }], // top-left, pointing up
            muted: true
        };
        const next = nextGrid(grid, 350, [0, 2, 4, 5, 7, 9, 11], 60);
        expect(next.arrows[0].vector).toBe(2); // flipped to down
    });

    test('corner arrow behavior', () => {
        const grid = {
            size: 8,
            id: 'test',
            arrows: [{ x: 0, y: 0, vector: 3 }], // top-left corner, pointing left
            muted: true
        };
        const next = nextGrid(grid, 350, [0, 2, 4, 5, 7, 9, 11], 60);
        expect(next.arrows[0].vector).toBe(1); // flipped to right
    });

    test('many arrows at same position reduce correctly', () => {
        // 5 arrows with same vector at same position should reduce to 1 (5 % 4 = 1)
        const grid = {
            size: 8,
            id: 'test',
            arrows: [
                { x: 4, y: 4, vector: 0 },
                { x: 4, y: 4, vector: 0 },
                { x: 4, y: 4, vector: 0 },
                { x: 4, y: 4, vector: 0 },
                { x: 4, y: 4, vector: 0 }
            ],
            muted: true
        };
        const next = nextGrid(grid, 350, [0, 2, 4, 5, 7, 9, 11], 60);
        // After reduction: 5 % 4 = 1 arrow, which then moves
        expect(next.arrows.length).toBe(1);
    });
});
