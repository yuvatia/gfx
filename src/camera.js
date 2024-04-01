import { Vector, lerp } from "./math.js";
import { CreateLookAtView, CreatePerspectiveProjection, CreateSymmetricOrthographicProjection, createTransformationMatrix, decomposeRotationXYZ, getRotationAxes } from "./affine.js";
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
            new Vector(-150, 20, -100),
            new Vector(0, 180, 180),
            new Vector(1, 1, 1)),
        settings = CameraSettings.default) {
        this.transform = transform;
        this.validateViewMatrix();

        this.focalPoint = Vector.zero;

        this.settings = settings;

        this.onResize(0, 0); // Placeholder for now
    }

    onResize(newWidth, newHeight) {
        this.persProjection = CreatePerspectiveProjection(
            this.settings.fov,
            newWidth / newHeight,
            this.settings.near,
            this.settings.far
        );
        this.orthoProjection = CreateSymmetricOrthographicProjection(
            this.settings.fov,
            newWidth / newHeight,
            this.settings.near,
            this.settings.far
        );
    }

    onKeydownEvent(event) {
        if (event.shiftKey) {
            if (event.key === 'W') {
                this.transform.adjustPosition(new Vector(0, 50, 0));
            } else if (event.key === 'S') {
                this.transform.adjustPosition(new Vector(0, -50, 0));
            } else if (event.key === 'A') {
                this.transform.adjustPosition(new Vector(-50, 0, 0));
            } else if (event.key === 'D') {
                this.transform.adjustPosition(new Vector(50, 0, 0));
            } else if (event.key === 'Z') {
                this.transform.adjustPosition(new Vector(0, 0, 100));
            } else if (event.key === 'X') {
                this.transform.adjustPosition(new Vector(0, 0, -100));
            }
            this.validateViewMatrix();
        }
        // If ctrl is pressed then we use the same buttons but to adjust rotation
        if (event.altKey) {
            if (event.key === 'w') {
                this.transform.adjustRotation(new Vector(1, 0, 0));
            } else if (event.key === 's') {
                this.transform.adjustRotation(new Vector(-1, 0, 0));
            } else if (event.key === 'a') {
                this.transform.adjustRotation(new Vector(0, 1, 0));
            } else if (event.key === 'd') {
                this.transform.adjustRotation(new Vector(0, -1, 0));
            } else if (event.key === 'z') {
                this.transform.adjustRotation(new Vector(0, 0, 1));
            } else if (event.key === 'x') {
                this.transform.adjustRotation(new Vector(0, 0, -1));
            }
            this.validateViewMatrix();
        }
    }

    onMouseScroll(event) {
        event.preventDefault();
        const [x, y, z] = getRotationAxes(this.transform.getViewMatrix());
        this.transform.adjustPosition(z.scale(event.deltaY));
    };

    validateViewMatrix() {
        this.viewMatrix = this.transform.getViewMatrix();
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

        const up = getRotationAxes(this.transform.getViewMatrix())[1]; // y
        // const up = new Vector(0, 1, 0);
        const { position, rotationMatrix } = CreateLookAtView(this.transform.position, target, up);
        this.easeMoveToPosition(position);
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
        if (this.settings.isOrthographic) {
            return this.orthoProjection;
        } else {
            return this.persProjection;
        }
    }
}
