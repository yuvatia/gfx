import { Cube, Icosahedron, makeGrid, makeIcosphere, makeRect } from "./geometry.js";
import { SignalEmitter } from "./signal_emitter.js";
import { Point, Vector, Matrix } from "./math.js"
import { createTransformationMatrix, createRotationMatrixX, createRotationMatrixY, createRotationMatrixZ, createScaleMatrix, decomposeRotationXYZ } from "./affine.js";
import { DCELRepresentation } from "./halfmesh.js";
import { CollisionDetection } from "./collision.js";
import { createContacts } from "./sat_contact_creation.js";
import { Rigidbody, contactConstraint, contactConstraintForSphere, fooBar, frameConstraint } from "./kinematics.js";
import { Sphere } from "./shape_queries.js";
import { Renderer } from "./renderer.js";
import { Transform } from "./transform.js";

const bindSettingControls = (renderer) => {
    const settings = [
        "entitiesCount",
        "collisionControl",
        "wireframeMode",
        "backfaceCulling",
        "shadingEnabled",
        "bufferSelection",
        "clipStepsCount"
    ];
    settings.forEach((setting) => {
        let element = document.getElementById(setting);
        if (element) {
            const elementType = element.type;
            element.addEventListener("change", (event) => {
                if (event.currentTarget.type === 'checkbox') {
                    renderer.preferences[event.currentTarget.id] = event.currentTarget.checked;
                } else if (event.currentTarget.type === 'number') {
                    renderer.preferences[event.currentTarget.id] = Number(value);
                }
            });
            if (elementType === 'checkbox') {
                element.checked = renderer.preferences[element.id];
            } else if (elementType === 'number') {
                // element.value = renderer.preferences[element.id];
            }
        }
    });

}

export class Orchestrator {
    constructor(canvas) {
        this.systems = [];
    }
    registerSystem(system, specification) {

    }
    onResize() {
        // Fire resize event   
    }
    onFrame() {
        // Fire render signal
    }
    onFixedUpdate() {
        // Physics etc
    }
    onKeyInput() {

    }
    onMouseInput() {

    }
}

const main = () => {
    // Used to signal render event
    const signalEmitter = new SignalEmitter();

    // Initialize renderer
    const canvas = document.getElementById("color");
    const stencil = document.getElementById("stencil");
    const depth = document.getElementById("depth");

    const renderer = new Renderer(
        canvas, stencil, depth
    );

    bindSettingControls(renderer);

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

    // Capture clicks on canvas
    canvas.addEventListener("click", async (e) => {
        // Mousepicking
        if (e.ctrlKey) {
            const stencilPixelValue = renderer.pickBufferPixelAtPosition(Renderer.BufferType.STENCIL, e.clientX, e.clientY);
            console.log(`${stencilPixelValue}`);
            // map 255 to -1 === camera
            const selectedEntity = stencilPixelValue[2] != 255 ? stencilPixelValue[2] : -1;
            document.getElementById("controlledEntity").value = `${selectedEntity}`;
        }
        // while (1) {
        //     await signalEmitter.waitForSignal();
        //     const hitPoint = renderer.mouseToCanvas(e.clientX, e.clientY);
        //     renderer.drawPoint2D(hitPoint, "red", true);
        // }
    });

    // Capture drag start and stop then draw path from start to stop
    let dragStart = null;
    canvas.addEventListener("mousedown", (e) => {
        dragStart = renderer.mouseToCanvas(e.clientX, e.clientY);
    });
    canvas.addEventListener("mousemove", async (e) => {
        if (!dragStart) return;

        const dragStop = renderer.mouseToCanvas(e.clientX, e.clientY);

        let targetID = document.getElementById("controlledEntity").value;
        // If the shift key is also pressed, treat it as translating the camera
        if (e.shiftKey) {
            // TODO handedness -> negation
            let delta = new Vector(-e.movementX, -e.movementY, 0);
            let target = targetID == -1 ? renderer.camera.transform : cubeTransforms[targetID];
            target.adjustPosition(delta);
            if (targetID != -1) {
                // TOOD unproject
                // target.setPosition(renderer.mouseToCanvas(e.clientX, e.clientY).neg());

                cubeModelMatrices[targetID] = target.toWorldMatrix();
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
        const dragStop = renderer.mouseToCanvas(e.clientX, e.clientY);
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
                let lightIntensity = 0.02;  // Full intensity
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
                        const faceColor = renderer.preferences.shadingEnabled ? `rgba(${diffuse.x}, ${diffuse.y}, ${diffuse.z}, 1)` : colorNames[i % colorNames.length];
                        let outlineColor = faceColor;
                        if (Number(document.getElementById("controlledEntity").value) === entityId) {
                            outlineColor = "red";
                        }
                        return renderer.drawPath(
                            faceVerts,
                            modelMatrix,
                            faceColor,
                            null, // Don't force fill
                            true,
                            false,
                            `rgba(${entityId}, ${entityId}, ${entityId}, 1)`,
                            // `rgba(${i * 30}, ${i * 30}, ${i * 10}, 1)`
                            outlineColor
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
                        const faceColor = renderer.shadingEnabled ? `rgba(${diffuse.x}, ${diffuse.y}, ${diffuse.z}, 1)` : colorNames[i % colorNames.length];
                        renderer.drawPath(
                            faceVerts,
                            modelMatrix,
                            faceColor,
                            false,
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
