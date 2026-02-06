
import * as R from 'ramda';
import Chance from 'chance';
import {playSounds} from './play-notes';

const chance = new Chance();
export const NO_BOUNDARY = 'no-boundary';
export const BOUNDARY = 'boundary';
// const vectors = [
//     'arrow-up',
//     'arrow-right',
//     'arrow-down',
//     'arrow-left',
// ];
const vectorOperations = [
    ({ x, y, vector }) => ({ x, y: y - 1, vector }),
    ({ x, y, vector }) => ({ x: x + 1, y, vector }),
    ({ x, y, vector }) => ({ x, y: y + 1, vector }),
    ({ x, y, vector }) => ({ x: x - 1, y, vector }),
];
const getVector = () => chance.natural({
    min: 0,
    max: 3,
});
const cycleVector = (vector, number) => (vector + number - 1) % 4;
const getRandomNumber = size => chance.natural({
    min: 0,
    max: size - 1,
});
// const getRows = size => R.range(0, size).map(() => R.range(0, size));
const getArrow = size => () => ({
    x: getRandomNumber(size),
    y: getRandomNumber(size),
    vector: getVector(),
});
export const removeFromGrid = (grid, x, y) => {
    const nextGrid = {
        ...grid,
        id: chance.guid(),
        arrows: grid.arrows.filter(arrow => arrow.x !== x || arrow.y !== y),
    };
    return nextGrid;
};
const getMirror = (pos, gridSize) => {
    var half = Math.floor(gridSize/2);
    var offset = half-pos;
    var location = half + offset;
    if((gridSize%2)===0) {
      location = location-1
    }
    return location;
};
const getForwardDiagMirror = (xpos, ypos, gridSize) => {
    return {x: getMirror(ypos,gridSize), y: getMirror(xpos,gridSize)};
}
const getBackwardDiagMirror = (xpos, ypos) => {
    return {x: ypos, y: xpos};
}
const calculateForwardDiagonalVector = (vector) => {
    return [1,0,3,2][vector];
};
const calculateBackwardDiagonalVector = (vector) => {
    return [3,2,1,0][vector];
};
const calculateHorizontalVector = (vector) => {
    return [2,1,0,3][vector];
};
const calculateVerticalDiagonalVector = (vector) => {
    return [0,3,2,1][vector];
};
export const addToGrid = (grid, x, y, dir, symmetries, inputNumber, forced) => {
    if(grid.arrows.length>4000 || (!forced && grid.arrows.filter(arrow => arrow.x === x && arrow.y === y && arrow.vector === dir).length)){
        return grid
    }
    const symmetricArrowsToAdd = R.range(0, inputNumber).map(()=>({x, y, vector: dir}));
    const skipForthSymmetry = symmetries.horizontalSymmetry && symmetries.verticalSymmetry && symmetries.backwardDiagonalSymmetry;
    if (symmetries.horizontalSymmetry) {
        symmetricArrowsToAdd.map((arrowToMirror) => symmetricArrowsToAdd.push(
            {
                ...arrowToMirror,
                y: getMirror(arrowToMirror.y, grid.size),
                vector: calculateHorizontalVector(arrowToMirror.vector)
            }
        ));
    }
    if (symmetries.verticalSymmetry) {
        symmetricArrowsToAdd.map((arrowToMirror) => symmetricArrowsToAdd.push(
            {
                ...arrowToMirror,
                x: getMirror(arrowToMirror.x, grid.size),
                vector: calculateVerticalDiagonalVector(arrowToMirror.vector)
            }
        ));
    }
    if (symmetries.backwardDiagonalSymmetry) {
        symmetricArrowsToAdd.map((arrowToMirror) => symmetricArrowsToAdd.push(
            {
                ...arrowToMirror,
                ...getBackwardDiagMirror(arrowToMirror.x, arrowToMirror.y),
                vector: calculateBackwardDiagonalVector(arrowToMirror.vector)
            }
        ));
    }
    if (symmetries.forwardDiagonalSymmetry && !skipForthSymmetry) {
        symmetricArrowsToAdd.map((arrowToMirror) => symmetricArrowsToAdd.push(
            {
                ...arrowToMirror,
                ...getForwardDiagMirror(arrowToMirror.x, arrowToMirror.y, grid.size),
                vector: calculateForwardDiagonalVector(arrowToMirror.vector)
            }
        ));
    }
    grid.id = chance.guid();
    return symmetricArrowsToAdd.reduce((accumGrid, arrow)=>{
        return addOneToGrid(accumGrid, arrow.x, arrow.y, arrow.vector);
    }, grid);
};

const addOneToGrid = (grid, x, y, dir) => {
    const nextGrid = {
        ...grid,
        id: chance.guid(),
        arrows: [
            ...grid.arrows,
            {
                x,
                y,
                vector: dir,
            },
        ],
    };
    return nextGrid;
};

export const newGrid = (size, numberOfArrows) => {
    const arrows = R.range(0, numberOfArrows).map(getArrow(size));
    return { size: size, id: chance.guid(), arrows, muted: true };
};

export const emptyGrid = (size) => {
    return { size: size, id: chance.guid(), arrows: [], muted: true };
};
// const seedGrid = () => newGrid(getRandomNumber(20) + 12, getRandomNumber(50) + 1);
const moveArrow = arrow => vectorOperations[arrow.vector](arrow);
export const arrowKey = arrow => `{x:${arrow.x},y:${arrow.y},vector:${arrow.vector}}`;
export const locationKey = arrow => `{x:${arrow.x},y:${arrow.y}}`;

export const arrowBoundaryKey = (arrow, size, rotations = 0, walls) => {
    const returnVal = boundaryKey(arrow, size, rotations, walls);
    return (returnVal === 'x' || returnVal === 'y') ? BOUNDARY: returnVal;
};

export const boundaryKey = (arrow, size, rotations = 0, walls) => {
    const v = (arrow.vector + rotations) % 4;
    // Check exterior walls
    if (arrow.y === 0 && v === 0) return 'y';
    if (arrow.x === size - 1 && v === 1) return 'x';
    if (arrow.y === size - 1 && v === 2) return 'y';
    if (arrow.x === 0 && v === 3) return 'x';
    // Check internal walls
    if (walls && walls.length > 0) {
        const wallSet = walls._set || (walls._set = new Set(walls));
        // up: wall at h:(y-1):x
        if (v === 0 && arrow.y > 0 && wallSet.has(`h:${arrow.y - 1}:${arrow.x}`)) return 'y';
        // right: wall at v:y:x
        if (v === 1 && arrow.x < size - 1 && wallSet.has(`v:${arrow.y}:${arrow.x}`)) return 'x';
        // down: wall at h:y:x
        if (v === 2 && arrow.y < size - 1 && wallSet.has(`h:${arrow.y}:${arrow.x}`)) return 'y';
        // left: wall at v:y:(x-1)
        if (v === 3 && arrow.x > 0 && wallSet.has(`v:${arrow.y}:${arrow.x - 1}`)) return 'x';
    }
    return NO_BOUNDARY;
};
const newArrayIfFalsey = thingToCheck => (thingToCheck || []);
const rotateArrow = number => arrow => ({
    ...arrow,
    vector: cycleVector(arrow.vector, number),
});
const rotateSet = set => set.map(rotateArrow(set.length));
const flipArrow = ({ vector, ...rest }) => ({ vector: (vector + 2) % 4, ...rest });
export const getArrowBoundaryDictionary = (arrows, size, keyFunc, rotations, walls) => arrows.reduce(
    (arrowDictionary, arrow) => {
        const key = keyFunc(arrow, size, rotations, walls);
        const arrayAtKey = [
            ...(newArrayIfFalsey(arrowDictionary[key])),
            arrow,
        ];
        const newArrowDictionary = {
            ...arrowDictionary,
            [key]: arrayAtKey
        };

        return newArrowDictionary;
    }
    , {},
);

export const nextGrid = (grid, length, scale, musicalKey) => {
    const {
        size,
        arrows
    } = grid;
    const arrowsWithVectorDictionary = getArrowBoundaryDictionary(arrows, size, arrowKey);
    const reducedArrows = Object.keys(arrowsWithVectorDictionary).reduce(
        (acc, arrowsWithSameVectorKey) => {
            const arrowsAtIndex = arrowsWithVectorDictionary[arrowsWithSameVectorKey];
            const reducedArrowsAtIndex = R.take(arrowsAtIndex.length % 4 || 4, arrowsAtIndex);
            return [...acc, ...reducedArrowsAtIndex];
        }
        , [],
    ).filter(arrow => arrow.x >= 0 && arrow.y >= 0 && arrow.x < size && arrow.y < size);
    const arrowSetDictionary = getArrowBoundaryDictionary(reducedArrows, size, locationKey);
    const arrowSets = Object.keys(arrowSetDictionary).map(key => arrowSetDictionary[key]);
    const rotatedArrows = arrowSets.map(rotateSet);
    const flatRotatedArrows = rotatedArrows.reduce(
        (accum, current) => [...accum, ...current],
        []
    );
    const arrowBoundaryDictionary = getArrowBoundaryDictionary(
        flatRotatedArrows, size, arrowBoundaryKey
    );
    const movedArrowsInMiddle = newArrayIfFalsey(
        arrowBoundaryDictionary[NO_BOUNDARY]).map(moveArrow
    );
    const movedFlippedBoundaryArrows = newArrayIfFalsey(
        arrowBoundaryDictionary[BOUNDARY]).map(flipArrow).map(moveArrow
    );
    const nextGridArrows = [
        ...movedArrowsInMiddle,
        ...movedFlippedBoundaryArrows,
    ]
    const noisyArrowBoundaryDictionary = getArrowBoundaryDictionary(nextGridArrows, size, arrowBoundaryKey);
    playSounds(newArrayIfFalsey(noisyArrowBoundaryDictionary[BOUNDARY]), size, length, grid.muted, scale, musicalKey);
    return {
        ...grid,
        id: chance.guid(),
        size,
        arrows: nextGridArrows,
    };
};
