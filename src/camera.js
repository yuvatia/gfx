import { Matrix, Vector, lerp } from "./math.js";
import { CreateLookAtView, CreatePerspectiveProjection, CreateSymmetricOrthographicProjection, createTransformationMatrix, decomposeRotationXYZ, getRotationAxes, getSpaceBasis } from "./affine.js";
import { Transform } from "./transform.js";

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
            new Vector(0, 0, 100),
            new Vector(0, 0, 0),
            new Vector(1, 1, 1)),
        settings = CameraSettings.default) {
        this.transform = transform;
        this.validateViewMatrix();

        this.focalPoint = new Vector(100, 300, 0); //Vector.zero;

        this.preferences = settings;

        this.onResize(0, 0); // Placeholder for now
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

    onMouseScroll(event) {
        event.preventDefault();
        const z = Vector.forward;
        // const [x, y, z] = getRotationAxes(this.transform.getViewMatrix());
        // let toFocal = this.focalPoint.sub(this.transform.position);
        // NOTES!
        // x is reversed
        // toFocal = new Vector(-toFocal.x, toFocal.y, toFocal.z);
        // const z = toFocal.normalize();
        // let distance = toFocal.magnitude();
        // let scale = event.deltaY * Math.min(1, distance / 500);
        this.transform.adjustPosition(z.scale(event.deltaY * 0.1));
    };

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
