import { Matrix, Vector, lerp } from "./math.js";
import { CreateLookAtView, CreatePerspectiveProjection, CreateSymmetricOrthographicProjection, createTransformationMatrix, decomposeRotationXYZ, getRotationAxes, getSpaceBasis } from "./affine.js";
import { Transform } from "./transform.js";
import { AABB } from "./shape_queries.js";

export class CameraSettings {
    constructor() {
        this.isOrthographic = false;

        // Projection settings
        this.far = 1000;
        this.near = 0.01;
        this.fov = 90;
    }

    static default = new CameraSettings();
}

export class Camera {
    constructor(
        transform = new Transform(
            // new Vector(-150, 20, 100),
            new Vector(0, 0, -100),
            new Vector(0, 180, 180),
            new Vector(1, 1, 1)),
        settings = CameraSettings.default) {
        this.transform = transform;
        this.validateViewMatrix();

        this.focalPoint = Vector.zero;

        this.preferences = settings;

        this.onResize(0, 0); // Placeholder for now
    }

    onFrameStart() {
        // Hack to expose position in editor
        this.preferences.position = this.transform.position;
    }

    getName() {
        return 'Camera';
    }

    onResize(newWidth, newHeight) {
        const fovRadians = newWidth / newHeight;
        this.preferences.fov = fovRadians * 180 / Math.PI;

        this.persProjection = CreatePerspectiveProjection(
            this.preferences.fov,
            newWidth / newHeight,
            this.preferences.near,
            this.preferences.far
        );
        this.orthoProjection = CreateSymmetricOrthographicProjection(
            this.preferences.fov,
            newWidth / newHeight,
            this.preferences.near,
            this.preferences.far
        );
    }

    onKeydownEvent(event) {
        if (event.shiftKey) {
            const { right, up, forward } = this.getDirections();
            if (event.key === 'W') {
                this.transform.adjustPosition(up.scale(5));
            } else if (event.key === 'S') {
                this.transform.adjustPosition(up.neg().scale(5));
            } else if (event.key === 'A') {
                this.transform.adjustPosition(right.scale(5));
            } else if (event.key === 'D') {
                this.transform.adjustPosition(right.neg().scale(5));
            } else if (event.key === 'Z') {
                this.transform.adjustPosition(forward.scale(5));
            } else if (event.key === 'X') {
                this.transform.adjustPosition(forward.neg().scale(5));
            }
            this.validateViewMatrix();
        }
        // If ctrl is pressed then we use the same buttons but to adjust rotation
        if (event.altKey) {
            const { right, up, forward } = { right: Vector.right, up: Vector.up, forward: Vector.forward };
            if (event.key === 'w') {
                this.transform.adjustRotation(right);
            } else if (event.key === 's') {
                this.transform.adjustRotation(right.neg());
            } else if (event.key === 'a') {
                this.transform.adjustRotation(up);
            } else if (event.key === 'd') {
                this.transform.adjustRotation(up.neg());
            } else if (event.key === 'z') {
                this.transform.adjustRotation(forward);
            } else if (event.key === 'x') {
                this.transform.adjustRotation(forward.neg());
            }
            this.validateViewMatrix();
        }
    }

    zoomIn(factor) {
        const { forward: z } = this.getDirections();
        this.transform.adjustPosition(z.scale(factor));
    }

    onMouseScroll(event) {
        event.preventDefault();
        this.zoomIn(event.deltaY * 0.1);
    };

    onMouseDown(event) {
        if (event.type === 'touchstart') {
            this.onTouchStart(event);
        }
    }

    onMouseUp(event) {
        if (event.type === 'touchend') {
            this.onTouchEnd(event);
        }
    }

    onMouseMove(event) {
        if (event.type === 'touchmove') {
            this.onTouchMove(event);
        }
    }

    onTouchStart(event) {
        if (event.touches.length === 2) {
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            const x1 = touch1.clientX;
            const y1 = touch1.clientY;
            const x2 = touch2.clientX;
            const y2 = touch2.clientY;
            const dx = x2 - x1;
            const dy = y2 - y1;
            this.lastDistance = Math.sqrt(dx * dx + dy * dy);
        }
    }

    onTouchMove(event) {
        if (event.touches.length === 2) {
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            const x1 = touch1.clientX;
            const y1 = touch1.clientY;
            const x2 = touch2.clientX;
            const y2 = touch2.clientY;
            const dx = x2 - x1;
            const dy = y2 - y1;
            const isZoomOut = dx * dx + dy * dy > this.lastDistance * this.lastDistance;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (this.lastDistance) {
                const factor = distance / this.lastDistance;
                this.zoomIn(factor * 10 * (isZoomOut ? -1 : 1));
            }
            this.lastDistance = distance;
        }
    }

    onTouchEnd(event) {
        this.lastDistance = null;
    }

    validateViewMatrix() {
        this.viewMatrix = this.transform.getViewMatrix();
    }

    getDirections() {
        return getSpaceBasis(this.transform.getRotationMatrix());
    }

    onSetActiveScene() {
        clearInterval(this.interval);
    }

    easeMoveToPosition(position, duration = 50, steps = 10) {
        this.count = 0;
        clearInterval(this.interval);
        const start = this.transform.position;
        const end = position;
        this.interval = setInterval(() => {
            this.count++;
            this.transform.position = lerp(start, end, this.count / steps);
            if (this.count === steps) {
                clearInterval(this.interval);
            }
        }, duration / steps);
    }

    focusAt(aabb) {
        const { forward } = this.getDirections();

        const cameraDistance = 2.0; // Constant factor

        const extents = aabb.getExtent();
        const maxExtent = Math.max(extents.x, extents.y, extents.z);
        const cameraView = 2.0 * Math.tan(0.5 * (Math.PI / 180) * this.preferences.fov); // Visible height 1 meter in front
        let distance = cameraDistance * maxExtent / cameraView; // Combined wanted distance from the object
        distance += 0.5 * maxExtent; // Estimated offset from the center to the outside of the object
        this.transform.position = aabb.getOrigin().sub(forward.scale(distance));
    }

    lookAt(target) {
        this.focalPoint = target;
        // this.transform.lookAt(target);
        // this.viewMatrix = this.transform.getViewMatrix();

        // return;

        // const up = getRotationAxes(this.transform.getViewMatrix())[1]; // y
        const up = Vector.up;
        const { position, rotationMatrix } = CreateLookAtView(this.transform.position, target, up);
        // this.easeMoveToPosition(position);
        // this.transform.overridenRotationMatrix = rotationMatrix;
        this.transform.rotation = decomposeRotationXYZ(rotationMatrix);
        if (this.transform.rotation.isNaN()) {
            throw ("NaN rotation ", rotationMatrix, this.transform.rotation);
        }
        this.viewMatrix = this.transform.getViewMatrix();
    }

    getViewMatrix() {
        return this.viewMatrix;
    }

    getProjectionMatrix() {
        if (this.preferences.isOrthographic) {
            return this.orthoProjection;
        } else {
            return this.persProjection;
        }
    }
}
