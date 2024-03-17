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
import { Scene } from "./scene.js";

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
                    renderer.preferences[event.currentTarget.id] = Number(event.currentTarget.value || 0);
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

class MeshFilter {
    meshRef = null;
}

class Material {
    diffuseColor = "white";
}

class DirectionalLight {
    color = "white";
    intensity = 0.02;
    direction = new Vector(0, 0.5, -1).normalize();
}


const setupScene = (scene, entitiesCount, canvas) => {
    if (entitiesCount < 4) {
        entitiesCount = 4;
    }
    scene.clear();

    const cubeDcel = DCELRepresentation.fromSimpleMesh(makeIcosphere(2));
    // const cubeDcel = DCELRepresentation.fromSimpleMesh(cube);

    for (let i = 0; i < entitiesCount; ++i) {
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
        let scale = new Vector(70, 70, 70);
        if (i === 0) scale = new Vector(80, 80, 80);
        const entityId = scene.newEntity(`Entity ${i}`, new Transform(position, rotation, scale));
        // Add mesh component
        scene.addComponent(entityId, MeshFilter).meshRef = cubeDcel;
        // Add material component
        // Add rigidbody component
        scene.addComponent(
            entityId,
            Rigidbody,
            scene.getComponent(entityId, Transform), 20, Vector.zero, Vector.zero);
        // Add collider component
    }

    // scene.getComponent(1, Rigidbody).linearVelocity = new Vector(-90, -100, 0);
    // scene.getComponent(scene.getEntities()[1].id, Rigidbody).setMass(1000);
    // scene.getComponent(0, Rigidbody).angularVelocity = new Vector(1, 0, 0);


    // Stacking:
    scene.getComponent(scene.getEntities()[1].id, Rigidbody).linearVelocity = new Vector(-50, 0, 0);
    scene.getComponent(scene.getEntities()[0].id, Transform).position = scene.getComponent(scene.getEntities()[1].id, Transform).position.sub(new Vector(400, 0, 0));
    scene.getComponent(scene.getEntities()[2].id, Transform).position = scene.getComponent(scene.getEntities()[1].id, Transform).position.sub(new Vector(650, 90, 0));
    scene.getComponent(scene.getEntities()[3].id, Transform).position = scene.getComponent(scene.getEntities()[1].id, Transform).position.sub(new Vector(650, -200, 0));


    // Create a light source
    // shine towards Z axis
    const lightEntity = scene.newEntity("Light");
    const light = scene.addComponent(lightEntity, DirectionalLight);
    light.direction = new Vector(0, 0.5, -1).normalize();
    light.intensity = 0.02;
    light.color = new Point(100, 255, 0, 1);

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

    const cube = new Cube();

    const scene = new Scene();
    let entitiesCount = document.getElementById("entitiesCount").value;
    document.getElementById("entitiesCount").addEventListener("change", (event) => {
        entitiesCount = Number(event.currentTarget.value || 0);
        setupScene(scene, entitiesCount, canvas);
    });
    setupScene(scene, entitiesCount, canvas);

    const grid = makeGrid();

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
            let target = targetID == -1 ? renderer.camera.transform : scene.getComponent(targetID, Transform);
            target.adjustPosition(delta);
        } else {
            // Arcball rotation
            let extraRotation = renderer.doArcballPrep(dragStart, dragStop);
            if (targetID == -1) {
                renderer.finalRotationMat = extraRotation;
            } else {
                // TODO: invert/decompose
                // TODO need to adjust rotation instead
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

    // const cube = makeIcosphere(3);
    const verts = cube.getVertices();

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

                // But actually move around in a circle
                // light.direction = createRotationMatrixX(timestamp * 0.03).multiplyVector(light.direction);

                let cubeDiffuseColor = new Point(255, 70, 0, 1); // Red

                const colorNames = [
                    "blue",
                    "red",
                    "green",
                    "yellow",
                    "purple",
                    "pink"
                ]

                const directionalLightSources = scene.getView(DirectionalLight).map(entityId => scene.getComponent(entityId, DirectionalLight));

                const drawMesh = (mesh, modelMatrix, entityId) => {
                    const drawFace = (face, modelMatrix, i, entityId) => {
                        const faceVerts = face.getVertices();
                        const faceNormal = face.GetFaceNormal();
                        // We now apply simple shading by taking faceNormal times directional light vector
                        // We use Lamber's cosine law to calculate the color
                        let worldNormal = modelMatrix.multiplyVector(faceNormal).normalize();

                        // TOOD support multiple light sources
                        let finalDiffuse = colorNames[i % colorNames.length];
                        if (renderer.preferences.shadingEnabled) {
                            for (let directionalLight of directionalLightSources) {
                                const lightDirection = directionalLight.direction;
                                const lightColor = directionalLight.color;
                                const lightIntensity = directionalLight.intensity;

                                let brightness = lightIntensity * Math.max(lightDirection.dotProduct(worldNormal), 0);
                                const combinedColor = new Vector(
                                    lightColor.x * cubeDiffuseColor.x,
                                    lightColor.y * cubeDiffuseColor.y,
                                    lightColor.z * cubeDiffuseColor.z);

                                // const diffuse = lightColor.multiply(brightness);
                                finalDiffuse = combinedColor.scale(brightness); // TODO: account for own color
                                finalDiffuse = `rgba(${finalDiffuse.x}, ${finalDiffuse.y}, ${finalDiffuse.z}, 1)`;
                            }
                        }

                        let outlineColor = finalDiffuse;
                        if (Number(document.getElementById("controlledEntity").value) === entityId) {
                            outlineColor = "red";
                        }

                        return renderer.drawPath(
                            faceVerts,
                            modelMatrix,
                            finalDiffuse,
                            null, // Don't force fill
                            true,
                            false,
                            `rgba(${entityId}, ${entityId}, ${entityId}, 1)`,
                            outlineColor
                        );
                    };

                    mesh.faces.forEach((face, i) => {
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

                const createContactIfColliding = (s1Collider, s1Transform, s2Collider, s2Transform) => {
                    // Run collision detection between selected and another entity
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

                    // let rLocal = rb1.transform.
                    //     getRotationMatrix().
                    //     multiplyMatrix(createScaleMatrix(rb1.transform.scale)).
                    //     multiplyVector(Vector.one.scale(0.5));
                    // frameConstraint(
                    //     rb1,
                    //     rLocal,
                    //     rb2.transform.position,
                    //     fixedStep
                    // );

                    // First, apply constraints
                    // fooBar(rb1, rb2.transform.position, 10, fixedStep / 150);

                    const allRigidbodies = scene.getComponentView(Rigidbody);
                    // Narrow-phase
                    for (let [ent1Id, [rb1]] of allRigidbodies) {
                        for (let [ent2Id, [rb2]] of allRigidbodies) {
                            if (ent2Id == ent1Id) {
                                break;
                            }

                            const s1Transform = rb1.transform;
                            const s2Transform = rb2.transform;
                            const s1Collider = new Sphere(s1Transform.position, s1Transform.scale.x);
                            const s2Collider = new Sphere(s2Transform.position, s2Transform.scale.x);
                            let res = createContactIfColliding(s1Collider, s1Transform, s2Collider, s2Transform);
                            // res = null;
                            if (res) {
                                // const { contacts, info } = res;
                                // contactConstraint(
                                //     rb1,
                                //     rb2,
                                //     contacts,
                                //     info.normal,
                                //     info.depth,
                                //     fixedStep);

                                contactConstraintForSphere(
                                    rb1,
                                    rb2,
                                    res.contactA,
                                    res.contactB,
                                    res.normal,
                                    res.depth,
                                    fixedStep
                                );
                            }

                        }
                    }

                    // Finally, integrate position
                    for (let entityId of scene.getView(Rigidbody)) {
                        const rbody = scene.getComponent(entityId, Rigidbody);
                        rbody.integratePositionPhysicallyAccurate(fixedStep);
                        rbody.transform.validateWorldMatrix();
                    }
                }
                updateRigidbody();

                const cubeModelMatricesAndMeshes = scene.getView(Transform, MeshFilter).map(entId => {
                    const [transform, meshFilter] = [scene.getComponent(entId, Transform), scene.getComponent(entId, MeshFilter)];
                    transform.validateWorldMatrix();
                    return [transform.toWorldMatrix(), meshFilter.meshRef, entId];
                });
                cubeModelMatricesAndMeshes.forEach(([modelMatrix, meshRef, entId]) => drawMesh(meshRef, modelMatrix, entId));

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
