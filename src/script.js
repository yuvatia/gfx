import { Cube, Icosahedron, makeGrid, makeIcosphere, makeRect } from "./geometry.js";
import { SignalEmitter } from "./signal_emitter.js";
import { Point, Vector, Matrix } from "./math.js"
import { Camera } from "./camera.js";
import { createTransformationMatrix, createRotationMatrixX, createRotationMatrixY, createRotationMatrixZ, createTranslationMatrix, createScaleMatrix, createaAxisAngleRotationMatrix, CreatePerspectiveProjection, CreateSymmetricOrthographicProjection, invertTranslation, createRotationMatrixXYZ, decomposeRotationXYZ, invertRotation } from "./affine.js";
import { DCELRepresentation } from "./halfmesh.js";
import { CollisionDetection } from "./collision.js";
import { createContacts } from "./sat_contact_creation.js";
import { Rigidbody, contactConstraint, contactConstraintForSphere, fooBar, frameConstraint } from "./kinematics.js";
import { Sphere } from "./shape_queries.js";

class Renderer {
    constructor(canvas) {
        this.backfaceCulling = true;
        this.shadingControl = true;

        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.projectionMatrix = new Matrix();
        this.orthoProjection = new Matrix();
        this.camera = new Camera();

        // Projection settings
        this.far = 1000;
        this.near = 0.01;
        this.fov = 90;

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

    project3Dto2D(point, applyPerspectiveDivision = true) {
        const eyeSpace = this.worldToEye(point);
        const clipSpace = this.eyeToClip(eyeSpace);

        // Apply clipping against all 6 planes
        var clipSpace3 = [clipSpace.x, clipSpace.y, clipSpace.z];
        var w = clipSpace.w;
        if (document.getElementById("perspectiveClipEnabled").checked) {
            // if -w <= x, y, z <= w and w > 0, then inside viewing volume
            if (w > 0) return null;
            for (var i = 0; i < clipSpace3.length; ++i) {
                const isInside = -w <= clipSpace3[i] && clipSpace3[i] <= w;
                if (isInside) {
                    return null;
                }
            }
        }

        const ndc = applyPerspectiveDivision ? this.perspectiveDivision(clipSpace) : clipSpace;
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
        // console.log(`${thetaDegrees} angle`);
        // TODO negated due to handedness issue perhaps?
        thetaDegrees = -thetaDegrees;
        let rotationMat = createaAxisAngleRotationMatrix(axis, thetaDegrees);
        return rotationMat;
    }

    onResize() {
        // No need to resize canvas since responsiveness is guaranteed
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        // Translate so that origin is in the middle
        this.canvasTranslation.x = this.canvas.width * 0.5;
        this.canvasTranslation.y = this.canvas.height * 0.5;
        this.ctx.translate(this.canvasTranslation.x, this.canvasTranslation.y);

        const stencilBuffer = document.getElementById("stencil");
        stencilBuffer.width = window.innerWidth;
        stencilBuffer.height = window.innerHeight;
        this.stencilBufferCtx = stencilBuffer.getContext("2d", { willReadFrequently: true });
        this.stencilBufferCtx.translate(this.canvasTranslation.x, this.canvasTranslation.y);


        const depthBuffer = document.getElementById("depth");
        depthBuffer.width = window.innerWidth;
        depthBuffer.height = window.innerHeight;
        this.depthBufferCtx = depthBuffer.getContext("2d");
        this.depthBufferCtx.translate(this.canvasTranslation.x, this.canvasTranslation.y);

        this.projectionMatrix = CreatePerspectiveProjection(
            this.fov,
            this.canvas.width / this.canvas.height,
            this.near,
            this.far
        );
        this.orthoProjection = CreateSymmetricOrthographicProjection(
            this.fov,
            this.canvas.width / this.canvas.height,
            this.near,
            this.far
        )
    }

    saveCanvasState() {
        this.ctx.save();
        this.stencilBufferCtx.save();
        this.depthBufferCtx.save();
    }

    resetCanvasTransform() {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.stencilBufferCtx.setTransform(1, 0, 0, 1, 0, 0);
        this.depthBufferCtx.setTransform(1, 0, 0, 1, 0, 0);
    }

    restoreCanvasState() {
        this.ctx.restore();
        this.stencilBufferCtx.restore();
        this.depthBufferCtx.restore();
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Stencil: set default value of rgba(0, 0, 255, 1) for all pixels, that way we pick the camera
        // when not picking an entity
        this.stencilBufferCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.stencilBufferCtx.fillStyle = "rgba(0, 0, 255, 1)";
        this.stencilBufferCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);


        this.depthBufferCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    start(dt) {
        // Discard transform, draw grid, framerate and background
        this.saveCanvasState();
        this.resetCanvasTransform();

        this.clearCanvas();
        this.ctx.fillStyle = this.clearColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw text "FPS: (x, y)" in upper right corner
        this.ctx.font = "bold 15px Arial";
        this.ctx.fillStyle = "black";
        // Convert dt to frameRate
        const frameRate = (1000 / dt);

        // this.drawXYGrid2D();

        this.ctx.fillText(`FPS: ${frameRate.toFixed(0)}`, this.canvas.width - 100, 20);
        this.ctx.fillText(`Camera: ${this.camera.position.toString()}`, this.canvas.width - 250, 40);
        this.restoreCanvasState();
    }

    drawXYGrid2D(cellWidth = 10) {
        // Draws XY grid. cellWidth in pixels

        let determinePos = (x, y) => {
            return [x, y];
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

    determineXY(p, transform = new Matrix(), applyPerspectiveDivision = true) {
        const worldSpace = transform.multiplyPoint(p);
        const clipSpace = this.project3Dto2D(worldSpace, applyPerspectiveDivision);
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


    drawPath(
        path,
        transform = new Matrix(),
        color = "black",
        fill = true,
        applyPerspectiveDivision = true,
        drawPoints = false,
        stencilID = "black") {
        if (drawPoints) {
            path.forEach(p => {
                this.drawPoint(p, false, transform, color);
            });
        }

        let screenPath = [];
        path.forEach(p => {
            let screenPoint = this.determineXY(p, transform, applyPerspectiveDivision);
            screenPath.push(screenPoint);
        });

        // Perspective clipping application, check if any of screnPath is null and if so, return
        if (screenPath.some(p => p === null)) {
            return;
        }

        /*
        backface culling
        */
        if (screenPath.length >= 3) {
            let a = new Vector(...screenPath[0].toArray());
            let b = new Vector(...screenPath[1].toArray());
            let c = new Vector(...screenPath[2].toArray());
            let ab = b.sub(a);
            let ac = c.sub(b);
            // see if normal is facing in positive z or not
            // See https://gamedev.stackexchange.com/questions/203694/how-to-make-backface-culling-work-correctly-in-both-orthographic-and-perspective
            let sign = ab.x * ac.y - ac.x * ab.y;
            let isBackface = sign > 0;  // Sign reversed due to handedness
            if (isBackface && this.backfaceCulling) {
                // Only backface is culled, keep rendering mesh
                return;
            }
        }

        this.ctx.beginPath();
        this.ctx.strokeStyle = color;
        this.ctx.fillStyle = color;

        // If shape is the selected shape, do something
        const selectedID = document.getElementById("controlledEntity").value;
        if (stencilID === `rgba(${selectedID}, ${selectedID}, ${selectedID}, 1)`) {
            this.ctx.strokeStyle = "red";
        } else if (stencilID === "rgba(1, 1, 1, 1)") {
            // Draw entityID one's wireframe
            // The one we compare against
            // this.ctx.strokeStyle = "blue";
        }

        this.stencilBufferCtx.beginPath();
        // Store entity ID in red channel
        this.stencilBufferCtx.fillStyle = stencilID;
        this.stencilBufferCtx.strokeStyle = stencilID;
        this.depthBufferCtx.beginPath();
        this.depthBufferCtx.fillStyle = "black";

        if (screenPath[0] != null) {
            const pos = screenPath[0].toArray();
            this.ctx.moveTo(...pos);
            this.stencilBufferCtx.moveTo(...pos);
            this.depthBufferCtx.moveTo(...pos);

        }
        screenPath.forEach(p => {
            if (p === null) return;
            const [x, y, z] = p.toArray();
            this.ctx.lineTo(x, y);
            this.stencilBufferCtx.lineTo(x, y);
            this.depthBufferCtx.lineTo(x, y);
        });
        // Fill volume enclosed by path (if any)
        if (fill) {
            this.ctx.fill();
        }
        // Always fill stencil and depth
        this.stencilBufferCtx.fill();
        this.depthBufferCtx.fill();


        this.ctx.closePath();
        this.stencilBufferCtx.closePath();
        this.depthBufferCtx.closePath();
        this.ctx.stroke();
        // Don't stroke stencil, just fill
        this.stencilBufferCtx.stroke();
        this.depthBufferCtx.stroke();
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

    drawColorGradient() {
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

class Transform {
    constructor(position, rotation, scale) {
        this.position = position;
        this.rotation = rotation;
        this.scale = scale;

        this.overridenRotationMatrix = null;

        this.validateWorldMatrix();
    }

    validateWorldMatrix() {
        if (this.overridenRotationMatrix) {
            this.worldMatrix_ =
                createTranslationMatrix(this.position)
                    .multiplyMatrix(this.overridenRotationMatrix)
                    .multiplyMatrix(createScaleMatrix(this.scale));
            return;
        }
        // Make sure rotation ranges from -180 to 180
        this.rotation = this.rotation.mod(360);
        this.worldMatrix_ = createTransformationMatrix(this.position, this.rotation, this.scale);
    }

    toWorldMatrix() {
        return this.worldMatrix_;
    }

    getRotationMatrix() {
        if (this.overridenRotationMatrix) {
            return this.overridenRotationMatrix;
        }
        return createRotationMatrixXYZ(...this.rotation.toArray());
    }

    getRotationInverse() {
        return invertRotation(this.getRotationMatrix());
    }

    adjustPosition(delta) {
        this.position = this.position.add(delta);
        this.validateWorldMatrix();
    }

    adjustRotation(delta) {
        this.rotation = this.rotation.add(delta);
        this.validateWorldMatrix();
    }

    setPosition(position) {
        this.position = position;
        this.validateWorldMatrix();
    }

    setRotation(rotation) {
        this.rotation = rotation;
        this.validateWorldMatrix();
    }

    setScale(scale) {
        this.scale = scale;
        this.validateWorldMatrix();
    }
}


const main = () => {
    // Used to signal render event
    const signalEmitter = new SignalEmitter();

    // Initialize renderer
    const canvas = document.getElementById("color");
    const renderer = new Renderer(canvas);

    // Initialize transforms
    let cubeTransforms = [];
    for (let i = 0; i < document.getElementById("entitiesCount").value; ++i) {
        let position = new Vector(
            (2 * Math.random() - 1) * canvas.width,
            (2 * Math.random() - 1) * canvas.height,
            30 * (Math.random() * 2 - 1));
        position.x = 350 * i;
        position.y = 250 * i;
        position.z = 0;

        let rotation = new Vector(
            360 * Math.random(),
            360 * Math.random(),
            360 * Math.random());
        rotation = Vector.zero;
        // if (i === 1) rotation = Vector.zero;
        let scale = new Vector(100, 100, 100);
        if (i === 1) scale = new Vector(70, 70, 70);
        cubeTransforms.push(
            new Transform(
                position,
                rotation,
                scale
            )
        )
    }
    let cubeModelMatrices = [];
    for (let t of cubeTransforms) {
        cubeModelMatrices.push(t.toWorldMatrix());
    }
    let cubeRigidbodies = [];
    for (let t of cubeTransforms) {
        cubeRigidbodies.push(new Rigidbody(t, 20, Vector.zero, Vector.zero));
    }
    // cubeRigidbodies[1].linearVelocity = new Vector(-90, -100, 0);
    cubeRigidbodies[1].setMass(100);
    // cubeRigidbodies[0].angularVelocity = new Vector(1, 0, 0);


    // Stacking:
    cubeRigidbodies[1].linearVelocity = new Vector(-20, -100, 0);
    cubeRigidbodies[0].transform.position = cubeRigidbodies[1].transform.position.sub(new Vector(0, 500, 0));

    const mouseToCanvas = (mouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        var factorX = canvas.width / rect.width;
        var factorY = canvas.height / rect.height;
        const xOffset = mouseEvent.clientX - rect.left;
        const yOffset = mouseEvent.clientY - rect.top;
        return new Vector(
            factorX * xOffset - canvas.width / 2,
            factorY * yOffset - canvas.height / 2,
            0
        );
        // old: offset - width * 0.5
    }

    const pickStencil = (mouseEvent) => {
        // Mouse picking
        let [x, y] = mouseToCanvas(mouseEvent).add(renderer.canvasTranslation).toArray();
        const data = renderer.stencilBufferCtx.getImageData(x, y, 1, 1).data;
        // map 255 to -1 to camera
        const selectedEntity = data[2] != 255 ? data[2] : -1;
        document.getElementById("controlledEntity").value = `${selectedEntity}`;
    }
    // Capture clicks on canvas
    canvas.addEventListener("click", async (e) => {
        const hitPoint = mouseToCanvas(e);
        // Mousepicking
        if (e.ctrlKey) {
            pickStencil(e);
        }
        // while (1) {
        //     await signalEmitter.waitForSignal();
        //     renderer.drawPoint2D(hitPoint, "red", true);
        // }
    });

    // Capture drag start and stop then draw path from start to stop
    let dragStart = null;
    canvas.addEventListener("mousedown", (e) => {
        dragStart = mouseToCanvas(e);
    });
    canvas.addEventListener("mousemove", async (e) => {
        if (!dragStart) return;

        const dragStop = mouseToCanvas(e);

        let targetID = document.getElementById("controlledEntity").value;
        // If the shift key is also pressed, treat it as translating the camera
        if (e.shiftKey) {
            // TODO handedness -> negation
            let delta = new Vector(-e.movementX, -e.movementY, 0);
            let target = targetID == -1 ? renderer.camera : cubeTransforms[targetID];
            if (targetID != -1) {
                // TOOD unproject
                // target.setPosition(mouseToCanvas(e).neg());
                target.adjustPosition(delta);
                cubeModelMatrices[targetID] = target.toWorldMatrix();
            } else {
                renderer.camera.adjustPosition(delta);
            }
        } else {
            // Arcball rotation
            let extraRotation = renderer.doArcballPrep(dragStart, dragStop);
            if (targetID == -1) {
                renderer.finalRotationMat = extraRotation;
            } else {
                // TODO: invert/decompose
                cubeModelMatrices[targetID] = cubeModelMatrices[targetID].multiplyMatrix(extraRotation);
            }
        }

        // await signalEmitter.waitForSignal();
        // renderer.drawPath2D([dragStart, dragStop]);
    });
    canvas.addEventListener("mouseup", async (e) => {
        let myStart = dragStart
        dragStart = null;
        const dragStop = mouseToCanvas(e);
        // while (1) {
        //     await signalEmitter.waitForSignal();
        //     renderer.drawPath2D([myStart, dragStop]);
        // }
    });


    let lastFrameTime = null;
    const fps = 60;
    const fpsInterval = 1000 / fps;


    let p0 = new Point(0, 0, 0);
    let p1 = new Point(4, 20, 0);
    let p2 = new Point(100, 30, 0);

    const cube = new Cube();
    const cubeDcel = DCELRepresentation.fromSimpleMesh(makeIcosphere(2));
    // const cubeDcel = DCELRepresentation.fromSimpleMesh(cube);
    const grid = makeGrid();
    // const cube = makeIcosphere(3);
    const verts = cube.getVertices();

    // cubeModelMatrices = [cubeModelMatrices.pop()];

    const tick = (timestamp) => {
        if (!lastFrameTime) lastFrameTime = timestamp;
        const elapsed = timestamp - lastFrameTime;

        if (elapsed >= fpsInterval) {
            lastFrameTime = timestamp - (elapsed % fpsInterval);
            const updateFrame = () => {
                renderer.start(elapsed);
                grid.getFaces().forEach((indices) => {
                    const faceVerts = indices.map((index) => new Point(...grid.getVertices()[index]));
                    renderer.drawPath(
                        faceVerts,
                        createScaleMatrix(new Vector(60, 60, 0)),
                        "gray",
                        false,
                        true,
                        false);
                });
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
                let directionalLight = new Vector(0, 0.5, -1).normalize();
                // But actually move around in a circle
                // directionalLight = createRotationMatrixX(timestamp * 0.03).multiplyVector(directionalLight);
                // Draw direction of directional light. We can illustrate this by a bunch of arrows
                renderer.drawPoint(p0, false, new Matrix(), "gray");
                let lightIntensity = 0.006;  // Full intensity
                let lightColor = new Point(100, 255, 0, 1); // pure white
                let cubeDiffuseColor = new Point(255, 70, 0, 1); // Red

                const colorNames = [
                    "blue",
                    "red",
                    "green",
                    "yellow",
                    "purple",
                    "pink"
                ]
                const drawCube = (cube, modelMatrix, entityId) => {
                    const drawFace = (face, modelMatrix, i, entityId) => {
                        const faceVerts = face.getVertices();
                        const faceNormal = face.GetFaceNormal();
                        // We now apply simple shading by taking faceNormal times directional light vector
                        // We use Lamber's cosine law to calculate the color
                        let worldNormal = modelMatrix.multiplyVector(faceNormal).normalize();

                        let brightness = lightIntensity * Math.max(directionalLight.dotProduct(worldNormal), 0);
                        const combinedColor = new Vector(
                            lightColor.x * cubeDiffuseColor.x,
                            lightColor.y * cubeDiffuseColor.y,
                            lightColor.z * cubeDiffuseColor.z);
                        // const diffuse = lightColor.multiply(brightness);
                        const diffuse = combinedColor.scale(brightness); // TODO: account for own color
                        const faceColor = renderer.shadingControl ? `rgba(${diffuse.x}, ${diffuse.y}, ${diffuse.z}, 1)` : colorNames[i % colorNames.length];
                        return renderer.drawPath(
                            faceVerts,
                            modelMatrix,
                            faceColor,
                            !document.getElementById("wireframeMode").checked,
                            true,
                            false,
                            `rgba(${entityId}, ${entityId}, ${entityId}, 1)`
                            // `rgba(${i * 30}, ${i * 30}, ${i * 10}, 1)`
                        );
                    };

                    cubeDcel.faces.forEach((face, i) => {
                        drawFace(face, modelMatrix, i, entityId);
                    });

                    return;

                    // SimpleMesh rendering
                    cube.getFaces().forEach((indices, i) => {
                        const faceVerts = indices.map((index) => new Point(...verts[index]));
                        const faceNormal = cube.getFaceNormal(i);
                        // We now apply simple shading by taking faceNormal times directional light vector
                        // We use Lamber's cosine law to calculate the color
                        let worldNormal = modelMatrix.multiplyVector(faceNormal).normalize();

                        let brightness = lightIntensity * Math.max(directionalLight.dotProduct(worldNormal), 0);
                        const combinedColor = new Vector(
                            lightColor.x * cubeDiffuseColor.x,
                            lightColor.y * cubeDiffuseColor.y,
                            lightColor.z * cubeDiffuseColor.z);
                        // const diffuse = lightColor.multiply(brightness);
                        const diffuse = combinedColor.scale(brightness); // TODO: account for own color
                        const faceColor = renderer.shadingControl ? `rgba(${diffuse.x}, ${diffuse.y}, ${diffuse.z}, 1)` : colorNames[i % colorNames.length];
                        renderer.drawPath(
                            faceVerts,
                            modelMatrix,
                            faceColor,
                            !document.getElementById("wireframeMode").checked
                            // `rgba(${i * 30}, ${i * 30}, ${i * 10}, 1)`
                        );
                    });
                }

                const createContactIfColliding = (s1HalfMesh, s1Transform, s2HalfMesh, s2Transform) => {
                    // Run collision detection between selected and another entity
                    const s1Collider = new Sphere(s1Transform.position, s1Transform.scale.x);
                    const s2Collider = new Sphere(s2Transform.position, s2Transform.scale.x);
                    const result = Sphere.getContactPoints(s1Collider, s2Collider);
                    const separating = !result;
                    renderer.drawText(renderer.canvas.width / 2 - 200, 60 - renderer.canvas.height / 2,
                        `Separating: ${separating}\nDepth:${result ? result.depth : "N/A"}`, 15, "black", "bold 15px Arial");
                    if (!result) return null;
                    const { contactA, contactB } = result;
                    renderer.drawPath(
                        [contactA, contactB],
                        Matrix.identity,
                        "purple",
                        true,
                        true,
                        true
                    );
                    return result;
                }

                const createContactIfCollidingSATClip = (s1HalfMesh, s1Transform, s2HalfMesh, s2Transform) => {
                    const s1Matrix = s1Transform.toWorldMatrix();
                    const s2Matrix = s2Transform.toWorldMatrix();

                    // Run collision detection between selected and another entity
                    const { result: separating, info } = CollisionDetection.SATEx(s1HalfMesh, s2HalfMesh, s1Matrix, s2Matrix);
                    renderer.drawText(renderer.canvas.width / 2 - 200, 60 - renderer.canvas.height / 2, `Separating: ${separating}\nDepth:${info ? info.depth : "N/A"}`, 15, "black", "bold 15px Arial");
                    if (!separating) {
                        const contacts = createContacts(
                            s1HalfMesh,
                            s2HalfMesh,
                            s1Matrix,
                            s2Matrix,
                            info,
                            renderer,
                            Number(document.getElementById("clipStepsCount").value)
                        );
                        if (!contacts || contacts.length == 0) return null;
                        // console.log(contacts);
                        // Now we draw the contacts
                        renderer.drawPath(
                            contacts,
                            Matrix.identity,
                            "purple",
                            true,
                            true,
                            true
                        );
                        // contacts.forEach(contact => {
                        //     renderer.drawPoint(
                        //         contact,
                        //         false,
                        //         Matrix.identity,
                        //         "purple"
                        //     )
                        // });
                        return { contacts, info };
                    }
                    return null;

                }
                const updateRigidbody = () => {
                    // const fixedStep = elapsed / 50;
                    const fixedStep = 0.2;

                    // let rLocal = cubeRigidbodies[0].transform.
                    //     getRotationMatrix().
                    //     multiplyMatrix(createScaleMatrix(cubeRigidbodies[0].transform.scale)).
                    //     multiplyVector(Vector.one.scale(0.5));
                    // frameConstraint(
                    //     cubeRigidbodies[0],
                    //     rLocal,
                    //     cubeRigidbodies[1].transform.position,
                    //     fixedStep
                    // );
                    // First, apply constraints
                    // fooBar(cubeRigidbodies[0], cubeRigidbodies[1].transform.position, 10, fixedStep / 150);

                    const s1HalfMesh = cubeDcel;
                    const s1Transform = cubeTransforms[0];
                    const s2HalfMesh = cubeDcel;
                    const s2Transform = cubeTransforms[1];
                    // console.log(cubeRigidbodies[1]);
                    let res = createContactIfColliding(s1HalfMesh, s1Transform, s2HalfMesh, s2Transform);
                    // res = null;
                    if (res) {
                        // const { contacts, info } = res;
                        // contactConstraint(
                        //     cubeRigidbodies[0],
                        //     cubeRigidbodies[1],
                        //     contacts,
                        //     info.normal,
                        //     info.depth,
                        //     fixedStep);

                        contactConstraintForSphere(
                            cubeRigidbodies[0],
                            cubeRigidbodies[1],
                            res.contactA,
                            res.contactB,
                            res.normal,
                            res.depth,
                            fixedStep
                        );
                    }
                    // Finally, integrate position
                    for (let i = 0; i < cubeTransforms.length; ++i) {
                        cubeRigidbodies[i].integratePositionPhysicallyAccurate(fixedStep);
                        cubeTransforms[i].validateWorldMatrix();
                        cubeModelMatrices[i] = cubeTransforms[i].toWorldMatrix();
                    }
                }
                updateRigidbody();

                cubeModelMatrices.forEach((modelMatrix, index) => drawCube(cube, modelMatrix, index));

                if (!document.getElementById("collisionControl").checked) {
                    return;
                }

            }
            updateFrame();
        }

        // Keep scheduling next animation frame
        requestAnimationFrame(tick);
    }

    // Requests first animation frame
    requestAnimationFrame(tick);

    document.getElementById("cullingControl").addEventListener("change", (event) => {
        renderer.backfaceCulling = event.currentTarget.checked;
    });

    document.getElementById("shadingControl").addEventListener("change", (event) => {
        renderer.shadingControl = event.currentTarget.checked;
    });

    let entityListElement = document.getElementById("controlledEntity");
    const populateEntityList = (element) => {
        // Add options with values from 0 to 20, and then -1
        for (let i = -1; i < document.getElementById("entitiesCount").value; ++i) {
            let option = document.createElement("option");
            option.value = i;
            option.text = i;
            element.appendChild(option);
        }
        // Set default value to -1
        element.value = -1;
    }
    populateEntityList(entityListElement);

    let bufferSelectionElement = document.getElementById("bufferSelection");
    const populateBufferSelection = (element) => {
        let option = document.createElement("option");
        option.value = "color";
        option.text = "Color";
        element.appendChild(option);

        option = document.createElement("option");
        option.value = "depth";
        option.text = "Depth";
        element.appendChild(option);

        option = document.createElement("option");
        option.value = "stencil";
        option.text = "Stencil";
        element.appendChild(option);

        element.addEventListener("change", (event) => {
            let buffer = document.getElementById(event.currentTarget.value);
            let otherBuffers = Array.from(document.getElementsByTagName("canvas"));
            console.log(otherBuffers);
            otherBuffers.forEach((buffer) => {
                buffer.style.display = "none";
            });
            buffer.style.display = "block";
        });
    }
    populateBufferSelection(bufferSelectionElement);
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
1. TODO - seems to be a bigger issue where handedness is just inverted in general, which leads to the confusion.
2. seems to have been an issue with determineXY where i artifically introduced a bias which would accumulate
3. solved, order should have been P*O and not O*P, has to do with major
4. fixed, now done only when applying perspective
5. Issue was related to order - we need to apply rotation *before* translation because we rotate around the origin
6. Fixed. Issue was not checking w > 0, but it really did end up being inverted. Again due to handedness issue probably.
7. Fixed. Again - rotation is around the origin so needs to happen before translation, or with a similarity transform T*R*T^-1
*/


/*
TODOs:
Sadly pretty much all those things require some refactoring so might as well just get on with it
0. mouse picking!! We can either do it by raycasting or by mousepick buffer
1. translate unity collision detection code to this repo, then add sequential impulse solver to this repo as well.
TODOs low priority:
1. grid rotation -- Done with grid mesh
2. arcball should actually effect camera rotation and accumulate
3. shadows?
4. clipping

Regarding shadows:
Shadows are essentially just the projection of the nearest object
unto the further object.
*/

/*
We're working towards the following goal:
A decent visualization of SAT for collision detection then clipping
for contact generation.

To achieve this goal:
1. Mousepicking
    -- would require raycasting + acceleration struct, or
    -- stencil buffer testing <-- went this route for now but will implement more stuff later
2. Selecting entity to move, then all controls will target effected entity
3. Make sure all ported unity code works
*/