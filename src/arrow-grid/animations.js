import p5 from 'p5';
import {
    BOUNDARY,
    NO_BOUNDARY,
    getArrowBoundaryDictionary,
    locationKey,
    arrowBoundaryKey,
    boundaryKey
} from './arrows-logic';

let stateDrawing;
let previousTime;

// Collision burst particles
let particles = [];
let lastBurstStep = -1;
const spawnBurst = (cx, cy, cellSz) => {
    const count = 8;
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
        const speed = cellSz * (0.6 + Math.random() * 0.5);
        particles.push({
            x: cx, y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            decay: 0.02 + Math.random() * 0.02,
            size: cellSz * (0.15 + Math.random() * 0.2)
        });
    }
};

let mouseX = 1;
let mouseY = 1;
let mouseXstart = 1;
let mouseYstart = 1;
let cellSize = 1;
let thisArrowAdder = () => {};
let mouseIsPressed;
const gridCanvasSize = 320;
const gridCanvasBorderSize = 2;

// Theme colors
const arrowColor = [102, 126, 234, 200]; // Accent Purple
const convertPixelToIndex = pixel => Math.floor(
    (pixel - gridCanvasBorderSize) / cellSize
);
// const nat = () => chance.natural({
//     min: 0,
//     max: 255,
// });
const mouseIsInSketch = () => mouseX > 0 + gridCanvasBorderSize &&
        mouseX < gridCanvasSize - gridCanvasBorderSize &&
        mouseY > 0 + gridCanvasBorderSize &&
        mouseY < gridCanvasSize - gridCanvasBorderSize
    ;
export const getAdderWithMousePosition = (arrowAdder) => (e) => {
    thisArrowAdder = arrowAdder;
    if (mouseIsInSketch()) {
        const mouseXindex = convertPixelToIndex(mouseX);
        const mouseYindex = convertPixelToIndex(mouseY);
        arrowAdder(mouseXindex, mouseYindex, e);
    } else {
    }
};
export const setUpCanvas = (state) => {
    stateDrawing = state;
    previousTime = new Date();
    const triangleDrawingArray = [
        (topLeft, cellSize, sketch) => sketch.triangle(
            topLeft.x + (cellSize / 2.0), topLeft.y,
            topLeft.x + cellSize, topLeft.y + cellSize,
            topLeft.x, topLeft.y + cellSize
        ),
        (topLeft, cellSize, sketch) => sketch.triangle(
            topLeft.x, topLeft.y,
            topLeft.x + cellSize, topLeft.y + (cellSize / 2.0),
            topLeft.x, topLeft.y + cellSize
        ),
        (topLeft, cellSize, sketch) => sketch.triangle(
            topLeft.x, topLeft.y,
            topLeft.x + cellSize, topLeft.y,
            topLeft.x + (cellSize / 2.0), topLeft.y + cellSize
        ),
        (topLeft, cellSize, sketch) => sketch.triangle(
            topLeft.x + cellSize, topLeft.y,
            topLeft.x + cellSize, topLeft.y + cellSize,
            topLeft.x, topLeft.y + (cellSize / 2.0)
        )
    ];
    const triangleRotatingArray = [

        (cellSize, sketch, percentage) => sketch.triangle(
            cellSize / 2.0, -(cellSize * percentage),
            cellSize, cellSize - (cellSize * percentage),
            0, cellSize - (cellSize * percentage)
        ),
        (cellSize, sketch, percentage) => sketch.triangle(
            0 + cellSize * percentage, cellSize - (cellSize * percentage),
            (cellSize / 2) + (cellSize * percentage * 1.5), 0.5 * cellSize * percentage,
            cellSize, cellSize
        ),
        (cellSize, sketch, percentage) => sketch.quad(
            0, cellSize,
            cellSize / 2, cellSize * percentage,
            cellSize, cellSize,
            cellSize / 2, cellSize + cellSize * percentage),
        (cellSize, sketch, percentage) => sketch.triangle(
            0, cellSize,
            (cellSize / 2) - (1.5 * cellSize * percentage), 0.5 * cellSize * percentage,
            cellSize - (cellSize * percentage), cellSize - (cellSize * percentage))
    ];
    const translateAndRotate = (topLeft, sketch, vector, cellSize) => {
        const xShift = vector === 1 || vector === 2 ? cellSize : 0;
        const yShift = vector === 2 || vector === 3 ? cellSize : 0;
        sketch.translate(topLeft.x + xShift, topLeft.y + yShift);
        sketch.angleMode(sketch.DEGREES);
        sketch.rotate(90 * vector);
    };
    const timeShift = ({ x, y }, vector, shiftAmount) => {
        const shifted = [
            { x, y: y - shiftAmount },
            { x: x + shiftAmount, y },
            { x, y: y + shiftAmount },
            { x: x - shiftAmount, y },
        ];
        return shifted[vector];
    };

    const drawingContext = (sketch) => {
        // eslint-disable-next-line no-param-reassign
        sketch.setup = () => {
            sketch.createCanvas(gridCanvasSize + gridCanvasBorderSize * 2, gridCanvasSize + gridCanvasBorderSize * 2).parent('sketch-holder').id('arrows-animation');
        };
        // eslint-disable-next-line no-param-reassign
        sketch.draw = () => {
            mouseX = sketch.mouseX;
            mouseY = sketch.mouseY;
            mouseIsPressed = sketch.mouseIsPressed;
            
            const setMouseStart = (e) => {
                mouseXstart=mouseX;
                mouseYstart=mouseY;
                const mouseXindex = convertPixelToIndex(mouseX);
                const mouseYindex = convertPixelToIndex(mouseY);
                if(mouseIsInSketch()){
                    thisArrowAdder(mouseXindex, mouseYindex, e, true);
                }
            }
            const setTouchStart = (e) => {
                mouseXstart=mouseX;
                mouseYstart=mouseY;
                const mouseXindex = convertPixelToIndex(mouseX);
                const mouseYindex = convertPixelToIndex(mouseY);
                if(mouseIsPressed && mouseIsInSketch()){
                    thisArrowAdder(mouseXindex, mouseYindex, e, true);
                }
            }
            const sameAsStart = ()=>{
                const mouseXindex = convertPixelToIndex(mouseX);
                const mouseYindex = convertPixelToIndex(mouseY);
                const mouseXindexStart = convertPixelToIndex(mouseXstart);
                const mouseYindexStart = convertPixelToIndex(mouseYstart);
                return mouseXindexStart === mouseXindex && mouseYindexStart === mouseYindex;
            };
            const setMouseEnd = (e) => {
                mouseXstart=-1000;
                mouseYstart=-1000;
            }
            
            sketch.touchStarted = setTouchStart;
            sketch.touchEnded = setMouseEnd;
            sketch.mousePressed = setMouseStart;
            sketch.mouseReleased = setMouseEnd;


            const onDrag = (e) =>{
                
                if(mouseIsPressed && mouseIsInSketch() && !sameAsStart()){
                    const mouseXindex = convertPixelToIndex(mouseX);
                    const mouseYindex = convertPixelToIndex(mouseY);
                    thisArrowAdder(mouseXindex, mouseYindex, e);
                    e.preventDefault()
                }
            }
            sketch.mouseDragged = onDrag;
            sketch.touchMoved = onDrag;
            
            // draw grid
            sketch.push()
            sketch.strokeWeight(0);
            sketch.fill(18, 18, 31, 255); // --bg-card match
            sketch.rect(gridCanvasBorderSize, gridCanvasBorderSize, gridCanvasSize, gridCanvasSize);
            sketch.noFill();
            sketch.strokeWeight(gridCanvasBorderSize*2);
            sketch.stroke(102, 126, 234, 100); // --accent-purple border
            sketch.rect(0, 0, gridCanvasSize+gridCanvasBorderSize*2, gridCanvasSize+gridCanvasBorderSize*2);

            sketch.pop();
            //draw grid lines
            cellSize = (gridCanvasSize * 1.0) / (1.0 * stateDrawing.grid.size);
            sketch.push();
            sketch.stroke(255, 255, 255, 20); // Subtle white lines
            sketch.strokeWeight(1);
            for (var i=1; i<stateDrawing.grid.size; i++) {
                // horizontal
                sketch.line(1+gridCanvasBorderSize, 1+gridCanvasBorderSize + i * cellSize, gridCanvasSize, 1 + i * cellSize);
                // vertical
                sketch.line(1+gridCanvasBorderSize + i * cellSize, 1+gridCanvasBorderSize, 1 + i * cellSize, gridCanvasSize,);
            }
            sketch.pop();

            const convertIndexToPixel = index => (index * cellSize) + gridCanvasBorderSize;
            const convertArrowToTopLeft = xy => (
                {
                    x: convertIndexToPixel(xy.x),
                    y: convertIndexToPixel(xy.y)
                }
            );
            const timeDiff = new Date().getTime() - previousTime.getTime();
            const possiblePercentage = ((
                stateDrawing.playing ? timeDiff : 0
            ) / (
                1.0 * stateDrawing.noteLength
            ));
            const percentage = possiblePercentage > 1 ? 1 : possiblePercentage;
            const boundaryDictionary = getArrowBoundaryDictionary(
                stateDrawing.grid.arrows || [],
                stateDrawing.grid.size,
                boundaryKey
            );
            const boundaryDictionaryX = boundaryDictionary['x'] || [];
            const boundaryDictionaryY = boundaryDictionary['y'] || [];
            // Spawn burst particles at wall collisions once per grid step
            if (stateDrawing.playing && stateDrawing.showCollisions && percentage > 0.92 && lastBurstStep !== stateDrawing.gridStep) {
                lastBurstStep = stateDrawing.gridStep;
                const allBoundary = [...boundaryDictionaryX, ...boundaryDictionaryY];
                allBoundary.forEach((arrow) => {
                    const cx = convertIndexToPixel(arrow.x) + cellSize / 2;
                    const cy = convertIndexToPixel(arrow.y) + cellSize / 2;
                    spawnBurst(cx, cy, cellSize);
                });
            }

            // Update and draw particles
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.x += p.vx * 0.12;
                p.y += p.vy * 0.12;
                p.vx *= 0.92;
                p.vy *= 0.92;
                p.life -= p.decay;
                if (p.life <= 0) {
                    particles.splice(i, 1);
                    continue;
                }
                sketch.push();
                sketch.noStroke();
                const alpha = p.life * 180;
                sketch.fill(102, 126, 234, alpha);
                sketch.ellipse(p.x, p.y, p.size * p.life, p.size * p.life);
                sketch.pop();
            }
            // draw arrows

            const arrowLocationDictionary = getArrowBoundaryDictionary(
                stateDrawing.grid.arrows,
                stateDrawing.grid.size,
                locationKey
            );

            // non-rotated arrows
            const arrowsToNotRotateDictionary = Object.keys(arrowLocationDictionary).reduce(
                (acc, location) => (
                    arrowLocationDictionary[location].length === 1 ?
                        [
                            ...acc,
                            ...arrowLocationDictionary[location],
                        ] :
                        acc
                ),
                []
            );
            // non-wall Arrows
            const arrowDictionary = getArrowBoundaryDictionary(
                arrowsToNotRotateDictionary,
                stateDrawing.grid.size,
                arrowBoundaryKey
            );
            (arrowDictionary[NO_BOUNDARY] || []).map((arrow) => {
                sketch.push();
                sketch.strokeWeight(0);
                sketch.fill(...arrowColor);
                const shiftedTopLeft = timeShift(
                    convertArrowToTopLeft(arrow),
                    arrow.vector,
                    cellSize * percentage
                );
                const triangleDrawer = triangleDrawingArray[arrow.vector];
                triangleDrawer(shiftedTopLeft, cellSize, sketch);
                sketch.pop();
                return undefined;
            });
            // wall Arrows
            (arrowDictionary[BOUNDARY] || []).map((arrow) => {
                sketch.push();
                sketch.strokeWeight(0);
                sketch.fill(...arrowColor);
                const topLeft = convertArrowToTopLeft(arrow);
                translateAndRotate(topLeft, sketch, arrow.vector, cellSize);
                sketch.quad(
                    0, cellSize,
                    cellSize / 2, cellSize * percentage,
                    cellSize, cellSize,
                    cellSize / 2, cellSize + cellSize * percentage
                );
                sketch.pop();
                return undefined;
            });
            // rotating Arrows

            const arrowsToRotateDictionary = Object.keys(arrowLocationDictionary).reduce(
                (acc, location) => (
                    arrowLocationDictionary[location].length !== 1 ?
                        {
                            ...acc,
                            [location]: arrowLocationDictionary[location],
                        } :
                        acc
                ),
                {}
            );
            Object.keys(arrowsToRotateDictionary).map((arrowsToRotateIndex) => {
                const rotations = (
                    (
                        arrowsToRotateDictionary[arrowsToRotateIndex].length % 4
                    ) || 4
                ) - 1;
                const bouncedRotation = (rotations + 2) % 4;
                // draw not bounced
                const bouncingDictionary = getArrowBoundaryDictionary(
                    arrowsToRotateDictionary[arrowsToRotateIndex],
                    stateDrawing.grid.size,
                    arrowBoundaryKey,
                    rotations
                );
                const arrowsNotBouncing = bouncingDictionary[NO_BOUNDARY] || [];
                arrowsNotBouncing.map((arrow) => {
                    const topLeft = convertArrowToTopLeft(arrow);
                    
                    sketch.push();
                    sketch.strokeWeight(0);
                    sketch.fill(...arrowColor);
                    translateAndRotate(topLeft, sketch, arrow.vector, cellSize);
                    
                    triangleRotatingArray[rotations](cellSize, sketch, percentage);
                    
                    sketch.pop();
                    return undefined;
                });
                
                const arrowsBouncing = bouncingDictionary[BOUNDARY] || [];

                // bounced
                arrowsBouncing.map((arrow) => {
                    const topLeft = convertArrowToTopLeft(arrow);

                    sketch.push();
                    sketch.strokeWeight(0);
                    sketch.fill(...arrowColor);
                    translateAndRotate(topLeft, sketch, arrow.vector, cellSize);
                    triangleRotatingArray[bouncedRotation](cellSize, sketch, percentage);

                    sketch.pop();
                    return undefined;
                });
                return undefined;
            });

            // draw hover input
            sketch.cursor(sketch.CROSS);
            if (!stateDrawing.deleting) {
                sketch.cursor(sketch.HAND);
                // triangleDrawingArray[stateDrawing.inputDirection](
                //     convertArrowToTopLeft(
                //         {
                //             x: mouseXindex,
                //             y: mouseYindex
                //         }
                //     ),
                //     cellSize,
                //     sketch
                // );
            }
            // eslint-disable-next-line no-param-reassign
            // sketch.touchEnded = (e) => {
            //     if (sketch.mouseX > 0 + gridCanvasBorderSize &&
            //         sketch.mouseX < gridCanvasSize - gridCanvasBorderSize &&
            //         sketch.mouseY > 0 + gridCanvasBorderSize &&
            //         sketch.mouseY < gridCanvasSize - gridCanvasBorderSize
            //     ) {
            //         if (arrowAdder) {
            //             arrowAdder(mouseXindex, mouseYindex, e);
            //             return false;
            //         }
            //     } else {
            //     }
            // };
        };
    };

    // eslint-disable-next-line
    new p5(drawingContext);
};
export const updateCanvas = (state, date) => {
    // Guard against being called before setUpCanvas
    if (!stateDrawing) {
        return;
    }

    const noteLengthChanged = state.noteLength !== stateDrawing.noteLength;
    const gridStepped = state.gridStep !== stateDrawing.gridStep;
    const presetChanged = state.currentPreset !== stateDrawing.currentPreset;
    const playStateChanged = state.playing !== stateDrawing.playing;

    if (noteLengthChanged && stateDrawing.noteLength > 0) {
        // Rescale previousTime so the current animation percentage is preserved
        const elapsed = date.getTime() - previousTime.getTime();
        const pct = Math.min(Math.max(elapsed / stateDrawing.noteLength, 0), 1);
        previousTime = new Date(date.getTime() - pct * state.noteLength);
    }

    if (gridStepped || presetChanged) {
        // Reset animation cycle on actual grid steps or preset switches
        previousTime = date;
    }

    if (playStateChanged && state.playing) {
        // Starting playback — begin animation from 0%
        previousTime = date;
    }

    // Always sync so size, arrows, direction, and other changes propagate immediately
    stateDrawing = state;
};
