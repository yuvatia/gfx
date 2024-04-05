import { createTranslationMatrix, decomposeRotationXYZ, reOrthogonalizeRotation } from "./affine.js";
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

    getName() {
        return 'Mouse Control';
    }

    onSetActiveScene(scene) {
        this.#scene = scene;
        this.#controlledEntityID = MouseController.CameraId;
        this.#dragStart = this.#dragStop = null;
        // this.#renderer.camera.lookAt(new Vector(150, -20, 0));
    }

    setControlledEntity(entityId) {
        if (this.#controlledEntityID === entityId) return;

        const setMeshRendererState = (entityId, state) => {
            const mr = this.#scene.forceGetComponent(entityId, MeshRenderer);
            if (!mr) return false;
            mr.outline = state;
            return true;
        }

        setMeshRendererState(this.#controlledEntityID, false);
        this.#controlledEntityID = entityId;
        setMeshRendererState(this.#controlledEntityID, true);

        // const entityTransform = this.#scene.getComponent(this.#controlledEntityID, Transform);
        // if (entityTransform) {
        //     this.#renderer.camera.lookAt(entityTransform.position);
        // }
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
        let stencilClearColors = this.#renderer.stencilClearColors.slice(5, -1).split(', ').map(Number); // ["a", "b", "c", "d"]
        if (stencilClearColors[0] === stencilPixelValue[0] && stencilClearColors[1] === stencilPixelValue[1] && stencilClearColors[2] === stencilPixelValue[2]) {
            return MouseController.CameraId;
        }
        return (stencilPixelValue[2] << 0) + (stencilPixelValue[1] << 8) + (stencilPixelValue[0] << 16);

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
        // Pinching handled by Camera
        if (event.touches && event.touches.length === 2) return;

        event.preventDefault();

        const { clientX, clientY } = this.#extractRelevantDataFromEvent(event);
        const lastDragStop = this.#dragStop || this.#dragStart;
        this.#dragStop = this.#renderer.mouseToCanvas(clientX, clientY);


        let targetID = this.getControlledEntity();
        // If the shift key is also pressed, treat it as translating the camera
        const isTranslation = event.shiftKey || (event.touches && event.touches.length === 3);
        if (isTranslation) {
            const delta = this.#dragStop.sub(lastDragStop);
            let target = targetID == MouseController.CameraId ? this.#renderer.camera.transform : this.#scene.getComponent(targetID, Transform);
            target.adjustPosition(delta);
        } else {
            // Arcball rotation (Incremenetal)
            let extraRotation = this.#renderer.doArcballPrep(lastDragStop, this.#dragStop);
            const target = targetID == MouseController.CameraId ? this.#renderer.camera.transform : this.#scene.getComponent(targetID, Transform);
            const newRotationMatrix = reOrthogonalizeRotation(target.getRotationMatrix().multiplyMatrix(extraRotation));
            const newRot = decomposeRotationXYZ(newRotationMatrix);
            if (newRot.isNaN()) {
                throw ("NaN rotation! " + newRot.toString());
            }
            target.rotation = newRot;
            // target.overridenRotationMatrix = newRotationMatrix;
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
