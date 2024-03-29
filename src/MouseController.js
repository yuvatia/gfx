import { MeshRenderer } from "./components.js";
import { Vector } from "./math.js";
import { Renderer } from "./renderer.js";
import { Transform } from "./transform.js";

export class MouseController {
    static CameraId = -1;

    #dragStart = null;
    #dragStop = null;
    #controlledEntityID = MouseController.CameraId; // Camera
    #renderer = null;
    #scene = null;

    longPressTimer = null;

    constructor(renderer) {
        this.#renderer = renderer;
    }

    onSetActiveScene(scene) {
        this.#scene = scene;
    }

    setControlledEntity(entityId) {
        const setMeshRendererState = (entityId, state) => {
            const mr = this.#scene.forceGetComponent(entityId, MeshRenderer);
            if (!mr) return false;
            mr.outline = state;
            return true;
        }

        setMeshRendererState(this.#controlledEntityID, false);
        this.#controlledEntityID = entityId;
        setMeshRendererState(this.#controlledEntityID, true);
    }

    getControlledEntity() {
        return this.#controlledEntityID;
    }

    #extractRelevantDataFromEvent(event) {
        // If it's a touch event, get first touch
        if (event.touches && event.touches.length > 0) {
            event = event.touches[0];
        } else if (event.changedTouches) {
            event = event.changedTouches[0];
        }
        return { clientX: event.clientX, clientY: event.clientY };
    }

    selectEntityAtClientXY(clientX, clientY) {
        const selectedEntity = this.getEntityAtClientXY(clientX, clientY);
        this.setControlledEntity(selectedEntity);
    }

    getEntityAtClientXY(clientX, clientY) {
        const stencilPixelValue = this.#renderer.pickBufferPixelAtPosition(Renderer.BufferType.STENCIL, clientX, clientY);
        // map 255 to -1 === camera
        const selectedEntity = stencilPixelValue[2] != 255 ? stencilPixelValue[2] : MouseController.CameraId;
        return selectedEntity;
    }

    isEntityAtClientXYDifferentThanSelected(clientX, clientY) {
        const selectedEntity = this.getEntityAtClientXY(clientX, clientY);
        return this.#controlledEntityID !== selectedEntity;
    }

    onMouseClick(event) {
        if (!event.ctrlKey) return;
        event.preventDefault();
        const { clientX, clientY } = this.#extractRelevantDataFromEvent(event);
        this.selectEntityAtClientXY(clientX, clientY);
    }

    onMouseDown(event) {
        const { clientX, clientY } = this.#extractRelevantDataFromEvent(event);
        // Attempt to predict user intent
        if (this.isEntityAtClientXYDifferentThanSelected(clientX, clientY)) {
            event.preventDefault();
        }
        const predictedEntity = this.getEntityAtClientXY(clientX, clientY);
        this.longPressTimer = setTimeout(() => {
            if (this.getEntityAtClientXY(clientX, clientY) === predictedEntity) {
                this.selectEntityAtClientXY(clientX, clientY);
            }
        }, 200);
        this.#dragStart = this.#renderer.mouseToCanvas(clientX, clientY);
        this.#dragStop = null;
    }

    onMouseMove(event) {
        if (!this.#dragStart) return;

        event.preventDefault();
        const { clientX, clientY } = this.#extractRelevantDataFromEvent(event);
        const lastDragStop = this.#dragStop || this.#dragStart;
        this.#dragStop = this.#renderer.mouseToCanvas(clientX, clientY);


        let targetID = this.getControlledEntity();
        // If the shift key is also pressed, treat it as translating the camera
        const isTranslation = event.shiftKey || (event.touches && event.touches.length > 1);
        if (isTranslation) {
            // TODO handedness -> negation
            const delta = lastDragStop.sub(this.#dragStop);
            // let d = new Vector(-event.movementX, -event.movementY, 0);
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
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
        this.#dragStart = null;
        const { clientX, clientY } = this.#extractRelevantDataFromEvent(event);
        this.#dragStop = this.#renderer.mouseToCanvas(clientX, clientY);
    }
}
