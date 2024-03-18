import { Cube, Icosahedron, Mesh, makeGrid, makeIcosphere, makeRect } from "./geometry.js";
import { SignalEmitter } from "./signal_emitter.js";
import { Point, Vector, Matrix } from "./math.js"
import { DCELRepresentation } from "./halfmesh.js";
import { BoxCollider, FollowConstraint, Rigidbody, SphereCollider } from "./kinematics.js";
import { RenderSystem, Renderer, RendererPrefrences } from "./renderer.js";
import { Transform } from "./transform.js";
import { PhysicsSystem } from "./physics.js";
import { MeshFilter, Material, MeshRenderer, DirectionalLight } from "./components.js";
import { Director } from "./Director.js";
import { Camera } from "./camera.js";
import { MouseController } from "./MouseController.js";

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

    const followDemo = true;

    const cubeDcel = followDemo ? DCELRepresentation.fromSimpleMesh(new Cube()) : DCELRepresentation.fromSimpleMesh(makeIcosphere(2));

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
        // if (i === 0) scale = new Vector(80, 80, 80);
        const entityId = scene.newEntity(`Entity ${i}`, new Transform(position, rotation, scale));
        // Add mesh component
        scene.addComponent(entityId, MeshFilter).meshRef = cubeDcel;
        // Add material component
        scene.addComponent(entityId, Material).diffuseColor = new Point(255, 70, 0, 1); // Red
        // Add rigidbody component
        scene.addComponent(
            entityId,
            Rigidbody,
            scene.getComponent(entityId, Transform), 20, Vector.zero, Vector.zero,
            followDemo ? new BoxCollider() : new SphereCollider());
        // Add collider component
    }


    // Create a light source
    // shine towards Z axis
    const lightEntity = scene.newEntity("Light");
    const light = scene.addComponent(lightEntity, DirectionalLight);
    light.direction = new Vector(0, 0.5, 1).normalize();
    light.intensity = 0.012;
    light.color = new Point(100, 255, 0, 1);

    const rbodiesView = scene.getComponentView(Rigidbody);
    const [, [rb1]] = rbodiesView[0];
    const [, [rb2]] = rbodiesView[1];
    const [, [rb3]] = rbodiesView[2];
    const [, [rb4]] = rbodiesView[3];

    if (followDemo && false) {
        // rb2.linearVelocity = new Vector(-90, -100, 0);
        // rb0.setMass(1000);
        // rb1.angularVelocity = new Vector(1, 0, 0);

        // Create a follow constraint
        const followEntId = scene.newEntity("FollowConstraint");
        scene.addComponent(followEntId, FollowConstraint, rb1, rb2, Vector.one.scale(0.5));

        return;
    }

    // Collision demo

    rb1.linearVelocity = new Vector(-50, 0, 0);
    rb1.transform.position = rb2.transform.position.sub(new Vector(550, 0, 0));
    rb3.transform.position = rb2.transform.position.sub(new Vector(650, 0, 0));
    // rb3.transform.position = rb2.transform.position.sub(new Vector(650, 90, 0));
    rb4.transform.position = rb2.transform.position.sub(new Vector(730, -70, 0));
    rb2.linearVelocity = new Vector(0, 0, -10);
    rb2.transform.scale = new Vector(100, 100, 100);
    rb2.transform.position = rb4.transform.position.add(new Vector(0, 0, 150));
}

const main = () => {
    // Used to signal render event
    const signalEmitter = new SignalEmitter();

    // Initialize renderer
    const canvas = document.getElementById("color");
    const stencil = document.getElementById("stencil");
    const depth = document.getElementById("depth");

    const sceneCamera = new Camera();
    const renderer = new Renderer(
        canvas, stencil, depth, RendererPrefrences.default, sceneCamera
    );
    // renderer.preferences.wireframeMode = true;

    const director = new Director();
    director.setRenderer(renderer);
    director.registerSystem(new PhysicsSystem());
    director.registerSystem(sceneCamera);
    director.registerSystem(new RenderSystem(renderer));
    director.registerSystem(new MouseController(renderer));
    director.raiseOnSetActiveScene();
    bindSettingControls(renderer);

    const scene = director.getScene();
    let entitiesCount = document.getElementById("entitiesCount").value;
    document.getElementById("entitiesCount").addEventListener("change", (event) => {
        entitiesCount = Number(event.currentTarget.value || 0);
        setupScene(scene, entitiesCount, canvas);
    });
    setupScene(scene, entitiesCount, canvas);

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
