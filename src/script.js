import { Cube, Icosahedron, Mesh, makeGrid, makeIcosphere, makeRect } from "./geometry.js";
import { SignalEmitter } from "./signal_emitter.js";
import { Point, Vector, Matrix } from "./math.js"
import { createTransformationMatrix, createRotationMatrixX, createRotationMatrixY, createRotationMatrixZ, createScaleMatrix, decomposeRotationXYZ } from "./affine.js";
import { DCELRepresentation } from "./halfmesh.js";
import { CollisionDetection } from "./collision.js";
import { createContacts } from "./sat_contact_creation.js";
import { Rigidbody, contactConstraint, contactConstraintForSphere, fooBar, frameConstraint } from "./kinematics.js";
import { Sphere } from "./shape_queries.js";
import { RenderSystem, Renderer } from "./renderer.js";
import { Transform } from "./transform.js";
import { PhysicsSystem } from "./physics.js";
import { MeshFilter, Material, MeshRenderer, DirectionalLight } from "./components.js";
import { Director } from "./Director.js";

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

const setupScene = (scene, entitiesCount, canvas) => {
    if (entitiesCount < 4) {
        entitiesCount = 4;
    }
    scene.clear();

    const cubeDcel = DCELRepresentation.fromSimpleMesh(makeIcosphere(2));
    // const cubeDcel = DCELRepresentation.fromSimpleMesh(cube);

    // Grid has to be first since we don't have any Z-ordering or perspective tricks
    const grid = DCELRepresentation.fromSimpleMesh(makeGrid());
    const gridEntity = scene.newEntity("Grid",
        new Transform(
            Vector.zero,
            Vector.zero,
            new Vector(60, 60, 0))
    );
    scene.addComponent(gridEntity, MeshFilter).meshRef = makeGrid();
    const gridMaterial = scene.addComponent(gridEntity, Material);
    gridMaterial.diffuseColor = new Point(128, 128, 128, 1); // gray
    const gridRenderPrefs = scene.addComponent(gridEntity, MeshRenderer);
    gridRenderPrefs.shadingOn = false;
    gridRenderPrefs.wireframe = true;
    gridRenderPrefs.writeIdToStencil = false;

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
        scene.addComponent(entityId, Material).diffuseColor = new Point(255, 70, 0, 1); // Red
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
    light.intensity = 0.012;
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

    const director = new Director();
    director.setRenderer(renderer);
    director.registerSystem(new PhysicsSystem());
    director.registerSystem(new RenderSystem(renderer));

    bindSettingControls(renderer);

    const scene = director.getScene();
    let entitiesCount = document.getElementById("entitiesCount").value;
    document.getElementById("entitiesCount").addEventListener("change", (event) => {
        entitiesCount = Number(event.currentTarget.value || 0);
        setupScene(scene, entitiesCount, canvas);
    });
    setupScene(scene, entitiesCount, canvas);

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

    const tick = (timestamp) => {
        if (!lastFrameTime) lastFrameTime = timestamp;
        const elapsed = timestamp - lastFrameTime;

        if (elapsed >= fpsInterval) {
            signalEmitter.signalAll();
            director.onFrameStart(elapsed);
            director.onFixedStep(elapsed);
            director.renderScene(elapsed);
            lastFrameTime = timestamp - (elapsed % fpsInterval);
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
