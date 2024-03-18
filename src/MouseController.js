import { Vector } from "./math.js";
import { Renderer } from "./renderer.js";
import { Transform } from "./transform.js";

export class MouseController {
    #dragStart = null;
    #dragStop = null;
    #controlledEntityID = -1; // Camera
    #renderer = null;
    #scene = null;

    constructor(renderer) {
        this.#renderer = renderer;
    }

    onSetActiveScene(scene) {
        this.#scene = scene;
    }

    setControlledEntity(entityId) {
        this.#controlledEntityID = entityId;
    }

    getControlledEntity() {
        return this.#controlledEntityID;
    }

    onMouseClick(event) {
        if (event.ctrlKey) {
            const stencilPixelValue = this.#renderer.pickBufferPixelAtPosition(Renderer.BufferType.STENCIL, event.clientX, event.clientY);
            // map 255 to -1 === camera
            const selectedEntity = stencilPixelValue[2] != 255 ? stencilPixelValue[2] : -1;
            document.getElementById("controlledEntity").value = `${selectedEntity}`;
            this.setControlledEntity(selectedEntity);
        }
    }

    onMouseDown(event) {
        this.#dragStart = this.#renderer.mouseToCanvas(event.clientX, event.clientY);
    }

    onMouseMove(event) {
        if (!this.#dragStart) return;

        this.#dragStop = this.#renderer.mouseToCanvas(event.clientX, event.clientY);

        let targetID = this.getControlledEntity();
        // If the shift key is also pressed, treat it as translating the camera
        if (event.shiftKey) {
            // TODO handedness -> negation
            let delta = new Vector(-event.movementX, -event.movementY, 0);
            let target = targetID == -1 ? this.#renderer.camera.transform : this.#scene.getComponent(targetID, Transform);
            target.adjustPosition(delta);
        } else {
            // Arcball rotation
            let extraRotation = this.#renderer.doArcballPrep(this.#dragStart, this.#dragStop);
            if (targetID == -1) {
                this.#renderer.finalRotationMat = extraRotation;
            } else {
                // TODO: invert/decompose
                // TODO need to adjust rotation instead
                let target = this.#scene.getComponent(targetID, Transform);
                const rotationMatrix = target.getRotationMatrix();
                target.overridenRotationMatrix = target.getRotationMatrix().multiplyMatrix(extraRotation);
                // cubeModelMatrices[targetID] = cubeModelMatrices[targetID].multiplyMatrix(extraRotation);
            }
        }
    }

    onMouseUp(event) {
        this.#dragStart = null;
        this.#dragStop = this.#renderer.mouseToCanvas(event.clientX, event.clientY);
    }
}
