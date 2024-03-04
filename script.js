import { Cube } from "./cube.js";
import { SignalEmitter } from "./signal_emitter.js";
import { Point, Vector, Matrix} from "./math.js"

function createRotationMatrixX(angle) {
    const radians = angle * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    return new Matrix([
        1, 0, 0, 0,
        0, cos, sin, 0,
        0, -sin, cos, 0,
        0, 0, 0, 1
    ]);
}

function createRotationMatrixY(angle) {
    const radians = angle * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    return new Matrix([
        cos, 0, -sin, 0,
        0, 1, 0, 0,
        sin, 0, cos, 0,
        0, 0, 0, 1
    ]);
}

function createRotationMatrixZ(angle) {
    const radians = angle * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    return new Matrix([
        cos, sin, 0, 0,
        -sin, cos, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ]);
}

function createTranslationMatrix(translationVector) {
    const [x, y, z] = translationVector.toArray();
    return new Matrix([
        1, 0, 0, x,
        0, 1, 0, y,
        0, 0, 1, z,
        0, 0, 0, 1
    ]);
}

function createScaleMatrix(scaleVector) {
    const [x, y, z] = scaleVector.toArray();
    return new Matrix([
        x, 0, 0, 0,
        0, y, 0, 0,
        0, 0, z, 0,
        0, 0, 0, 1
    ]);
}

function createRotationMatrixXYZ(xRot, yRot, zRot) {
    const rotationX = createRotationMatrixX(xRot);
    const rotationY = createRotationMatrixY(yRot);
    const rotationZ = createRotationMatrixZ(zRot);
    const rotationXYZ = rotationX.multiplyMatrix(rotationY).multiplyMatrix(rotationZ);
    return rotationXYZ;
}

function createaAxisAngleRotationMatrix(axis, angle) {
    // Angle is in degrees
    const theta = angle * Math.PI / 180;
    // Get axis coords
    const [x, y, z] = axis.toArray();

    // Rodriguez' formula in column-major matrix form
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    const oneMinusCosTheta = 1 - cosTheta;

    const xx = x * x;
    const xy = x * y;
    const xz = x * z;
    const yy = y * y;
    const yz = y * z;
    const zz = z * z;

    const xSinTheta = x * sinTheta;
    const ySinTheta = y * sinTheta;
    const zSinTheta = z * sinTheta;

    const rotationMatrix = new Matrix([
        xx * oneMinusCosTheta + cosTheta, xy * oneMinusCosTheta - zSinTheta, xz * oneMinusCosTheta + ySinTheta, 0,
        xy * oneMinusCosTheta + zSinTheta, yy * oneMinusCosTheta + cosTheta, yz * oneMinusCosTheta - xSinTheta, 0,
        xz * oneMinusCosTheta - ySinTheta, yz * oneMinusCosTheta + xSinTheta, zz * oneMinusCosTheta + cosTheta, 0,
        0, 0, 0, 1
    ]);

    return rotationMatrix;
}

function invertRotation(rotationMatrix) {
    return rotationMatrix.transpose();
}

function invertScale(scaleMatrix) {
    const [x, y, z] = [1 / scaleMatrix[0], 1 / scaleMatrix[5], 1 / scaleMatrix[10]];
    return createScaleMatrix(new Vector(x, y, z));
}

function invertTranslation(translationMatrix) {
    let inverted = new Matrix(translationMatrix.elements);
    inverted.elements[4] = -inverted.elements[4];
    inverted.elements[8] = -inverted.elements[8];
    inverted.elements[12] = -inverted.elements[12];
    return inverted;
}

function createTransformationMatrix(translationVector, rotationEuler = new Point(0, 0, 0), scaleVector = new Point(1, 1, 1)) {
    const translation = createTranslationMatrix(translationVector);
    const rotationXYZ = createRotationMatrixXYZ(...rotationEuler.toArray());
    const scale = createScaleMatrix(scaleVector);
    // Note: order is important. First we scale, then rotate (still origin is preserved), only then do we translate.
    // Order of rotation/scale seems unimportant however order of translation vs rotation is important because
    // rotation is around the origin.
    return translation.multiplyMatrix(rotationXYZ).multiplyMatrix(scale);
    return scale.multiplyMatrix(rotationXYZ).multiplyMatrix(translation);
}


function CreateOrthographicMatrix(left, right, bottom, top, near, far) {
    // Transform some box shape defined by A(left, bottom, near) and B(right, top, far) to a unit cube
    // We do this by applying a transformation + scale.
    // Also note that we look down on the Z axis which is why there is 
    // a minus in the Z column
    return new Matrix([
        2 / (right - left), 0, 0, -(right + left) / (right - left),
        0, 2 / (top - bottom), 0, -(top + bottom) / (top - bottom),
        0, 0, -2 / (far - near), -(far + near) / (far - near),
        0, 0, 0, 1
    ]);
}

function CreatePerspectiveMatrix(near, far) {
    return new Matrix([
        near, 0, 0, 0,
        0, near, 0, 0,
        0, 0, far + near, - far * near,
        0, 0, -1, 0
    ]);
}

function CreateSymmetricOrthographicProjection(fov, aspect, near, far) {
    // Assuming symmetry, we know that ortho is actually given by (left, -left, bottom, -bottom, near, far)
    // so we only need to find left and top
    const fovRadians = fov * Math.PI / 180;
    const top = near * Math.tan(fovRadians / 2);
    const bottom = -top;
    const left = bottom * aspect;
    const right = top * aspect;
    const ortho = CreateOrthographicMatrix(left, right, bottom, top, near, far);
    return ortho;
}

function CreatePerspectiveProjection(fov, aspect, near, far) {
    /*
    Short path
    */
    // const fovRadians = fov * Math.PI / 180;
    // const f = 1 / Math.tan(fovRadians / 2);
    // return new Matrix([
    //     f / aspect, 0, 0, 0,
    //     0, f, 0, 0,
    //     0, 0, (far + near) / (near - far), (2 * far * near) / (near - far),
    //     0, 0, -1, 0
    // ]);

    /*
    Long path
    */
    const ortho = CreateSymmetricOrthographicProjection(fov, aspect, near, far);
    const persp = CreatePerspectiveMatrix(near, far);
    // row-major: First apply perspective, then ortho
    // however, since we use column-major, we do persp*ortho
    return persp.multiplyMatrix(ortho);
    return ortho.multiplyMatrix(persp);
}

class Camera {
    constructor() {
        this.position = new Vector(0, 0, -1000);
        this.rotation = new Vector(1, 0, 0);
        this.validateViewMatrix();

        // Listen for button changes
        document.addEventListener('keydown', (event) => {
            if (event.shiftKey) {
                if (event.key === 'W') {
                    console.log('here');
                    this.adjustPosition(new Vector(0, 50, 0));
                } else if (event.key === 'S') {
                    this.adjustPosition(new Vector(0, -50, 0));
                } else if (event.key === 'A') {
                    this.adjustPosition(new Vector(-50, 0, 0));
                } else if (event.key === 'D') {
                    this.adjustPosition(new Vector(50, 0, 0));
                } else if (event.key === 'Z') {
                    this.adjustPosition(new Vector(0, 0, 100));
                } else if (event.key === 'X') {
                    this.adjustPosition(new Vector(0, 0, -100));
                }
            }
            // If ctrl is pressed then we use the same buttons but to adjust rotation
            if (event.altKey) {
                if (event.key === 'w') {
                    this.rotation = this.rotation.add(new Vector(1, 0, 0));
                } else if (event.key === 's') {
                    this.rotation = this.rotation.add(new Vector(-1, 0, 0));
                } else if (event.key === 'a') {
                    this.rotation = this.rotation.add(new Vector(0, 1, 0));
                } else if (event.key === 'd') {
                    this.rotation = this.rotation.add(new Vector(0, -1, 0));
                } else if (event.key === 'z') {
                    this.rotation = this.rotation.add(new Vector(0, 0, 1));
                } else if (event.key === 'x') {
                    this.rotation = this.rotation.add(new Vector(0, 0, -1));
                }
                this.validateViewMatrix();
            }
        });
    }

    validateViewMatrix() {
        this.viewMatrix = createTransformationMatrix(
            new Vector(this.position.x, this.position.y, -this.position.z),
            this.rotation
        )
    }

    adjustPosition(positionDelta) {
        this.position = this.position.add(positionDelta);
        this.validateViewMatrix();
    }

    getViewMatrix() {
        return this.viewMatrix;
    }
}

class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.projectionMatrix = new Matrix();
        this.orthoProjection = new Matrix();
        this.camera = new Camera();

        this.finalRotationMat = new Matrix();

        this.canvasTranslation = new Vector(0, 0, 0);

        this.clearColor = "rgba(0, 0, 255, 0.1)";

        this.onResize();

        window.addEventListener("resize", this.onResize.bind(this));

        // Listen for scroll events
        this.canvas.addEventListener('wheel', (event) => {
            event.preventDefault();
            this.camera.adjustPosition(new Vector(0, 0, event.deltaY));
        });

    }

    worldToEye(point) {
        // return point;
        const eyeSpace = this.camera.getViewMatrix().multiplyPoint(point);
        // Note: the actual finalRotationMat rotates around the origin so we need to use a similarity transform
        const camT = createTranslationMatrix(this.camera.position);
        // Apply final rotation
        // TODO is this really how it's done?
        const camTInverse = invertTranslation(camT);
        const arcballRotation = camT.multiplyMatrix(this.finalRotationMat).multiplyMatrix(camTInverse); // T*R*T^-1
        return arcballRotation.multiplyPoint(eyeSpace);

    }

    eyeToClip(point) {
        // no projection
        // return point;
        // Pure ortho projection
        // return this.orthoProjection.multiplyPoint(point);
        // With perspective
        return this.projectionMatrix.multiplyPoint(point);
    }

    perspectiveDivision(point) {
        return point.multiply(1 / point.w);
    }

    project3Dto2D(point) {
        const eyeSpace = this.worldToEye(point);
        const clipSpace = this.eyeToClip(eyeSpace);

        // Apply clipping against all 6 planes
        var clipSpace3 = [clipSpace.x, clipSpace.y, clipSpace.z];
        var w = clipSpace.w;
        for (var i = 0; i < clipSpace3.length; ++i) {
            // if -w <= x, y, z <= w
            // then inside
            let current = clipSpace3[i];
            if (!(-w <= current && current <= w)) {
                //return null;
            }
        }

        const ndc = this.perspectiveDivision(clipSpace);
        return ndc;
    }

    screenToNDC(screenX, screenY) {
        var ndcX = 2 * screenX / this.canvas.width; // - 1
        var ndcY = 2 * screenY / this.canvas.height; // - 1
        var zSquared = 1 - (ndcX * ndcX + ndcY * ndcY);
        var ndcZ = (zSquared) < 0 ? 0 : Math.sqrt(zSquared);
        return new Vector(
            ndcX,
            ndcY,
            ndcZ
        );
    }

    doArcballPrep(screenStart, screenEnd) {
        let v0 = this.screenToNDC(screenStart.x, screenStart.y).normalize();
        let v1 = this.screenToNDC(screenEnd.x, screenEnd.y).normalize();
        // console.log(`${v0}, ${v1}`)
        let theta = Math.acos(v0.dotProduct(v1));
        let thetaDegrees = theta * 180 / Math.PI;
        // axis is defined by cross product
        let axis = v0.crossProduct(v1).normalize();
        console.log(`${thetaDegrees} angle`);
        // TODO negated due to handedness issue perhaps?
        thetaDegrees = -thetaDegrees;
        let rotationMat = createaAxisAngleRotationMatrix(axis, thetaDegrees);
        this.finalRotationMat = rotationMat;
    }

    onResize() {
        // No need to resize canvas since responsiveness is guaranteed
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        // Translate so that origin is in the middle
        this.canvasTranslation.x = this.canvas.width * 0.5;
        this.canvasTranslation.y = this.canvas.height * 0.5;
        this.ctx.translate(this.canvasTranslation.x, this.canvasTranslation.y);

        this.projectionMatrix = CreatePerspectiveProjection(
            90,
            this.canvas.width / this.canvas.height,
            0.01,
            1000
        );
        this.orthoProjection = CreateSymmetricOrthographicProjection(
            90,
            this.canvas.width / this.canvas.height,
            0.1,
            1000
        )
    }

    start(dt) {
        // Discard transform, draw grid, framerate and background
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = this.clearColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw text "FPS: (x, y)" in upper right corner
        this.ctx.font = "bold 15px Arial";
        this.ctx.fillStyle = "black";
        // Convert dt to frameRate
        const frameRate = (1000 / dt);

        this.drawGrid();

        this.ctx.fillText(`FPS: ${frameRate.toFixed(0)}`, this.canvas.width - 100, 20);

        this.ctx.restore();
    }

    drawGrid(cellWidth = 10) {
        // Draws XY grid. cellWidth in pixels

        let determinePos = (x, y) => {
            return [x, y];
            // return transform.multiplyPoint(new Point(x, y)).toArray();
            // return this.determineXY(new Point(x, y), transform).toArray();
        }

        this.ctx.beginPath();
        this.ctx.strokeStyle = "rgba(211, 211, 211, 0.2)";
        this.ctx.lineWidth = 1;
        // Draws y lines
        for (let i = 0; i < this.canvas.width; i += cellWidth) {
            this.ctx.moveTo(...determinePos(i, 0));
            this.ctx.lineTo(...determinePos(i, this.canvas.height));
            this.ctx.stroke();
        }
        // Draws x lines
        for (let i = 0; i < this.canvas.height; i += cellWidth) {
            this.ctx.moveTo(...determinePos(0, i));
            this.ctx.lineTo(...determinePos(this.canvas.width, i));
            this.ctx.stroke();
        }
    }

    determineXY(p, transform = new Matrix()) {
        const worldSpace = transform.multiplyPoint(p);
        const clipSpace = this.project3Dto2D(worldSpace);
        // return worldSpace;
        return clipSpace;
    }

    drawText(x, y, text, lineHeight = 10, style = "black", font = "12px arial") {
        const lines = text.split('\n');
        this.ctx.fillStyle = style;
        this.ctx.font = font;

        lines.forEach((line, index) => {
            this.ctx.fillText(line, x, y + index * lineHeight);
        });
    };

    drawPoint(p, debugDraw = false, transform = new Matrix(), color = "black") {
        let screenPoint = this.determineXY(p, transform);
        if (screenPoint === null) return;

        const [x, y, z] = screenPoint.toArray();
        // console.log(`${this.projectionMatrix}`);
        this.ctx.beginPath();
        this.ctx.arc(x, y, 3, 0, Math.PI * 2);
        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.stroke();

        if (!debugDraw) return;
        this.drawText(x, y, `(${x}, ${y})`, 10, color);
        // this.drawText(x, y, transform.toString(), 10, color);
    }

    drawPath(path, transform = new Matrix(), color = "black") {
        this.ctx.beginPath();
        this.ctx.strokeStyle = color;
        this.ctx.fillStyle = color;

        let screenPoint = this.determineXY(path[0], transform);
        if (screenPoint != null) {
            this.ctx.moveTo(...screenPoint.toArray());

        }
        path.forEach(p => {
            screenPoint = this.determineXY(p, transform);
            if (screenPoint === null) return;
            const [x, y, z] = screenPoint.toArray();
            this.ctx.lineTo(x, y);
        });
        // Fill volume enclosed by path (if any)
        this.ctx.fill();
        this.ctx.closePath();
        this.ctx.stroke();

        path.forEach(p => {
            this.drawPoint(p, false, transform, color);
        });
    }

    drawPath2D(path, color = "black", debugDraw = false) {
        this.ctx.beginPath();
        this.ctx.strokeStyle = color;
        this.ctx.fillStyle = color;
        this.ctx.moveTo(...path[0].toArray());
        path.forEach(p => {
            const [x, y, z] = p.toArray();
            this.ctx.lineTo(x, y);
        });
        // Fill volume enclosed by path (if any)
        this.ctx.fill();
        this.ctx.closePath();
        this.ctx.stroke();

        path.forEach(p => {
            this.drawPoint2D(p, color, debugDraw);
        });
    }

    drawPoint2D(p, color = "black", debugDraw = false) {
        const [x, y, z] = p.toArray();
        // console.log(`${this.projectionMatrix}`);
        this.ctx.beginPath();
        this.ctx.arc(x, y, 3, 0, Math.PI * 2);
        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.stroke();

        if (!debugDraw) return;
        this.drawText(x, y, `${this.screenToNDC(x, y)}`, 10, color);
        // this.drawText(x, y, `(${x}, ${y})`, 10, color);

    }

    drawStuff() {
        const w = 200;
        const h = 200;
        const imageData = this.ctx.createImageData(w, h);

        // Gradient from top left to bottom right
        for (let i = 0; i < w; i++) {
            for (let j = 0; j < h; j++) {
                const index = (i + j * w) * 4;
                imageData.data[index + 0] = 255 * (i / w);  // r
                imageData.data[index + 1] = 255 * (j / h);  // g
                imageData.data[index + 2] = 0;  // b
                imageData.data[index + 3] = 255;  // a
            }
        }

        const destLocal = new Vector(10, 10, 0);
        // Need to account for current translation
        const destCanvas = destLocal.add(this.canvasTranslation);
        this.ctx.putImageData(imageData, destCanvas.x, destCanvas.y);

    }
}


const main = () => {
    // Used to signal render event
    const signalEmitter = new SignalEmitter();

    // Initialize renderer
    const canvas = document.getElementById("canvas");
    const renderer = new Renderer(canvas);

    const mouseToCanvas = (mouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        var factorX = canvas.width / rect.width;
        var factorY = canvas.height / rect.height;
        return new Point(
            factorX * (mouseEvent.clientX - rect.left) - canvas.width / 2,
            factorY * (mouseEvent.clientY - rect.top) - canvas.height / 2,
            0
        );
        // old: offset - width * 0.5
    }
    // Capture clicks on canvas
    canvas.addEventListener("click", async (e) => {
        const hitPoint = mouseToCanvas(e);
        while (1) {
            await signalEmitter.waitForSignal();
            renderer.drawPoint2D(hitPoint, "red", true);
        }
    });

    // Capture drag start and stop then draw path from start to stop
    let dragStart = null;
    canvas.addEventListener("mousedown", (e) => {
        dragStart = mouseToCanvas(e);
    });
    canvas.addEventListener("mousemove", async (e) => {
        if (!dragStart) return;

        const dragStop = mouseToCanvas(e);


        // If the shift key is also pressed, treat it as translating the camera
        if (e.shiftKey) {
            // TODO handedness -> negation
            let delta = new Vector(-e.movementX, -e.movementY, 0)
            renderer.camera.adjustPosition(delta);
            return;
        }

        // else, do arcball rotation
        await signalEmitter.waitForSignal();
        renderer.drawPath2D([dragStart, dragStop]);
        renderer.doArcballPrep(dragStart, dragStop);

    });
    canvas.addEventListener("mouseup", async (e) => {
        let myStart = dragStart
        dragStart = null;
        const dragStop = mouseToCanvas(e);
        while (1) {
            await signalEmitter.waitForSignal();
            renderer.drawPath2D([myStart, dragStop]);
        }
    });


    let lastFrameTime = null;
    const fps = 60;
    const fpsInterval = 1000 / fps;


    let p0 = new Point(0, 0, 0);
    let p1 = new Point(4, 20, 0);
    let p2 = new Point(100, 30, 0);

    const cube = new Cube();
    const verts = cube.getVertices();

    // Generate n model matrices with different positions and rotations
    let cubeModelMatrices = []
    for (let i = 0; i < 20; ++i) {
        cubeModelMatrices.push(
            createTransformationMatrix(
                new Vector(
                    (2 * Math.random() - 1) * canvas.width,
                    (2 * Math.random() - 1) * canvas.height,
                    30 * (Math.random() * 2 - 1)),
                new Vector(
                    360 * Math.random(),
                    360 * Math.random(),
                    360 * Math.random()),
                new Vector(100, 100, 100)
            )
        )
    }

    const tick = (timestamp) => {
        if (!lastFrameTime) lastFrameTime = timestamp;
        const elapsed = timestamp - lastFrameTime;

        if (elapsed >= fpsInterval) {
            lastFrameTime = timestamp - (elapsed % fpsInterval);
            const updateFrame = () => {
                renderer.start(elapsed);
                signalEmitter.signalAll();

                const time = timestamp * 0.001;
                const frequency = 1;
                const amplitude = 50;
                const x = amplitude * Math.sin(2 * Math.PI * frequency * time);

                let translationVector = new Vector(x, 0, 0);
                let world = createTransformationMatrix(translationVector, new Vector(0, 0, x * 3), new Vector(10, 2, 1));

                // renderer.drawStuff();
                renderer.drawPath([p0, p1]);


                // const cubeModelMatrix = 
                // createRotationMatrixZ(-20).multiplyMatrix(
                // createaAxisAngleRotationMatrix(new Vector(0, 0, 1), 20).multiplyMatrix(
                //     createScaleMatrix(new Vector(1000, 1000, 1))
                // ));
                // shine towards Z axis
                let directionalLight = new Vector(0, 0, 1).normalize();
                // But actually move around in a circle
                let xRot = 0;
                directionalLight = createRotationMatrixX(timestamp * 0.1).multiplyVector(directionalLight);
                let lightIntensity = 0.006;  // Full intensity
                let lightColor = new Point(100, 255, 0, 1); // pure white
                let cubeDiffuseColor = new Point(255, 70, 0, 1); // Red

                const drawCube = (cube, modelMatrix) => {
                    cube.getFaces().forEach((indices, i) => {
                        const faceVerts = indices.map((index) => new Point(...verts[index]));
                        const faceNormal = cube.getFaceNormal(i);
                        // We now apply simple shading by taking faceNormal times directional light vector
                        // We use Lamber's cosine law to calculate the color
                        let worldNormal = modelMatrix.multiplyVector(faceNormal).normalize();
                        let brightness = lightIntensity * Math.max(directionalLight.dotProduct(worldNormal), 0);
                        const combinedColor = new Point(
                            lightColor.x * cubeDiffuseColor.x, 
                            lightColor.y * cubeDiffuseColor.y, 
                            lightColor.z * cubeDiffuseColor.z);
                        // const diffuse = lightColor.multiply(brightness);
                        const diffuse = combinedColor.multiply(brightness); // TODO: account for own color
                        // console.log(`${faceFinalColor}`);
                        renderer.drawPath(
                            faceVerts,
                            modelMatrix,
                            `rgba(${diffuse.x}, ${diffuse.y}, ${diffuse.z}, 1)`
                            // `rgba(${i * 30}, ${i * 30}, ${i * 10}, 1)`
                        );
                    });
                }

                cubeModelMatrices.forEach((modelMatrix) => drawCube(cube, modelMatrix));

                renderer.drawPoint(
                    p0,
                    true,
                    createTranslationMatrix(new Vector(10, 0, 0)),
                    "red");

                renderer.drawPath([p0, p1, p2]);
                // renderer.drawPath([p0, p1, p2], world, "red");

                renderer.drawPath([p0, p1], createRotationMatrixXYZ(x / 3, 0, 0), "green");
                renderer.drawPath([p0, p1], createRotationMatrixXYZ(0, x / 3, 0), "purple");
                renderer.drawPath([p0, p1], createRotationMatrixXYZ(0, 0, 10), "yellow");
            }
            updateFrame();
        }

        // Keep scheduling next animation frame
        requestAnimationFrame(tick);
    }

    // Requests first animation frame
    requestAnimationFrame(tick);
}

document.addEventListener("DOMContentLoaded", main);


/*
Bugs:
1. axis-angle rotation has inverted handedness
2. scaling z seems off
3. projection could also be a bit off, maybe camera is too close
4. there is probably an issue where we divide by W when multiplying points
5. seems like rotation implies position somehow? would have expected cubes to be at the same
   point and just rotated, instead they are spread out. Seems like the scale doesn't really apply properly perhaps?
6. Clip space clipping - seems like it doesn't work, or inversed.
7. axis angle rotation - maybe has an issue? handedness weirdness + seems weird when rotating around arbitray axis

Regarding:
1. seems to be a bigger issue where handedness is just inverted in general, which leads to the confusion.
2. seems to have been an issue with determineXY where i artifically introduced a bias which would accumulate
3. solved, order should have been P*O and not O*P, has to do with major
4. fixed, now done only when applying perspective
5. Issue was related to order - we need to apply rotation *before* translation because we rotate around the origin
6. TODO
7. Fixed. Again - rotation is around the origin so needs to happen before translation, or with a similarity transform T*R*T^-1
*/


/*
TODOs:
1. Basic shading
2. backface culling by z ordering
3. clipping

regarding shading, what we want to do is:
1. Associate each pixel with a normal. This is pretty much how deferred shading is done.
2. Have a directional light source (or point light source) and calculate the dot product between the normal and the light direction.
3. Use the dot product to calculate the color of the pixel.
We need to decide between Blinn and Phong shading.
Let's start with figuring out how to associate a pixel with a normal. To do this we first need to be able to color each pixel and not
use the fill method.
*/