import { Cube, Icosahedron, Mesh, makeGrid, makeIcosphere, makeRect } from "./geometry.js";
import { Point, Vector, Matrix } from "./math.js"
import { DCELRepresentation } from "./halfmesh.js";
import { BoxCollider, FollowConstraint, Rigidbody, SphereCollider } from "./kinematics.js";
import { RenderSystem, Renderer, RendererPrefrences } from "./renderer.js";
import { Transform } from "./transform.js";
import { PhysicsSystem } from "./physics.js";
import { MeshFilter, Material, MeshRenderer, DirectionalLight } from "./components.js";
import { Director, SimpleDirector } from "./Director.js";
import { Camera } from "./camera.js";
import { MouseController } from "./MouseController.js";
import { Reviver } from "./reviver.js";

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

const BoxDCEL = DCELRepresentation.fromSimpleMesh(new Cube());
const SphereDCEL = DCELRepresentation.fromSimpleMesh(makeIcosphere(2));
const makeRigidBox = (
    scene,
    position,
    rotation,
    scale,
    mass,
    gravityScale = 0.0,
    isBox = true,
    name = "Box") => {
    const dcel = isBox ? BoxDCEL : SphereDCEL;
    const entityId = scene.newEntity(name, new Transform(position, rotation, scale));
    // Add mesh component
    scene.addComponent(entityId, MeshFilter).meshRef = dcel;
    // Add material component
    scene.addComponent(entityId, Material).diffuseColor = new Point(255, 70, 0, 1); // Red
    // Add rigidbody component
    const rb = scene.addComponent(
        entityId,
        Rigidbody,
        scene.getComponent(entityId, Transform), mass, Vector.zero, Vector.zero,
        isBox ? new BoxCollider() : new SphereCollider());
    rb.gravityScale = gravityScale;
    return entityId;
}

export const setupScene = (scene, entitiesCount, width, height, withGrid = true) => {
    if (entitiesCount < 4) {
        entitiesCount = 4;
    }
    scene.clear();

    const followDemo = true;

    const cubeDcel = followDemo ? DCELRepresentation.fromSimpleMesh(new Cube()) : DCELRepresentation.fromSimpleMesh(makeIcosphere(2));

    // Grid has to be first since we don't have any Z-ordering or perspective tricks
    if (withGrid) {
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
    }

    for (let i = 0; i < entitiesCount; ++i) {
        let position = new Vector(
            (2 * Math.random() - 1) * width,
            (2 * Math.random() - 1) * height,
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
        makeRigidBox(scene, position, rotation, scale, 20, 0, true, `Entity ${i}`);
    }


    // Create a light source
    // shine towards Z axis
    const lightEntity = scene.newEntity("Light");
    scene.getComponent(lightEntity, Transform).position.x = 1337;
    const light = scene.addComponent(lightEntity, DirectionalLight);
    light.direction = new Vector(0, 0.5, 1).normalize();
    light.intensity = 0.012;
    light.color = new Point(100, 255, 0, 1);

    // TEMP
    // const serialized = scene.serializeEntity(lightEntity);
    // console.log(serialized)
    // console.log(parsed);
    // console.log(Object.assign(new Transform(), parsedTransform);
    // serialized.
    // EOTEMP

    const rbodiesView = scene.getComponentView(Rigidbody);
    const [ent1Id, [rb1]] = rbodiesView[0];
    const [ent2Id, [rb2]] = rbodiesView[1];
    const [, [rb3]] = rbodiesView[2];
    const [, [rb4]] = rbodiesView[3];

    if (followDemo && false) {
        // rb2.linearVelocity = new Vector(-90, -100, 0);
        // rb0.setMass(1000);
        // rb1.angularVelocity = new Vector(1, 0, 0);

        // Create a follow constraint
        const followEntId = scene.newEntity("FollowConstraint");
        scene.addComponent(followEntId, FollowConstraint, scene.getUUID(ent1Id), scene.getUUID(ent2Id), Vector.one.scale(0.5));

        return;
    }

    // Collision demo

    rb1.linearVelocity = new Vector(-50, 0, 0);
    rb1.transform.position = rb2.transform.position.sub(new Vector(550, 0, 0));
    rb3.transform.position = rb2.transform.position.sub(new Vector(650, 0, 0));
    // rb3.transform.position = rb2.transform.position.sub(new Vector(650, 90, 0));
    rb4.transform.position = rb2.transform.position.sub(new Vector(730, -70, 0));
    rb2.gravityScale = 0.03;
    rb2.transform.scale = new Vector(100, 100, 100);
    rb2.transform.position = rb4.transform.position.add(new Vector(0, 0, 150));
}

class GameplaySystem {
    #scene = null;
    rbodies = [];

    onSetActiveScene(scene) {
        this.#scene = scene;
    }

    #spawnCube() {
        this.rbodies.push(makeRigidBox(
            this.#scene,
            new Vector(-380, 320, 150), Vector.zero, new Vector(100, 100, 100),
            10, // Mass
            0.2  // Gravity
        ));
    }

    onFixedStep(scene, renderer) {
        // Make sure all rbodies are on the ground plane
        this.rbodies.forEach((entityId) => {
            const rb = this.#scene.getComponent(entityId, Rigidbody);
            if (rb.transform.position.z < 0) {
                rb.transform.position.z = 0;
                rb.linearVelocity = Vector.zero;
            }
        });
    }

    onMouseClick(event) {
        this.#spawnCube();
    }
}


const main = () => {
    // Initialize renderer
    const canvas = document.getElementById("color");
    const stencil = document.getElementById("stencil");
    const depth = document.getElementById("depth");

    const director = SimpleDirector(canvas, stencil, depth);
    director.registerSystem(new GameplaySystem());
    bindSettingControls(director.renderer);

    const scene = director.getScene();
    let entitiesCount = document.getElementById("entitiesCount").value;
    document.getElementById("entitiesCount").addEventListener("change", (event) => {
        entitiesCount = Number(event.currentTarget.value || 0);
        setupScene(scene, entitiesCount, canvas.width, canvas.height);
    });
    setupScene(scene, entitiesCount, canvas.width, canvas.height);

    const serialized = JSON.stringify(scene);
    const parsed = JSON.parse(serialized, Reviver.parse);
    console.log(parsed);
    director.setActiveScene(parsed);


    director.setFpsTarget(60);
    director.start();

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

// document.addEventListener("DOMContentLoaded", main);
