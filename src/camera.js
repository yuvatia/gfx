import { Vector } from "./math.js";
import { CreatePerspectiveProjection, CreateSymmetricOrthographicProjection, createTransformationMatrix } from "./affine.js";
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
            new Vector(100, -100, -1700),
            new Vector(50, 0, 0),
            new Vector(1, 1, 1)),
        settings = CameraSettings.default) {
        this.transform = transform;
        this.validateViewMatrix();
        this.installCameraControls();

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


    onKeyEvent(event) {
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

    onScroll(event) {
        event.preventDefault();
        this.transform.adjustPosition(new Vector(0, 0, event.deltaY));
    };

    installCameraControls() {
        // Listen for button changes
        document.addEventListener('keydown', this.onKeyEvent.bind(this));
    }

    validateViewMatrix() {
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
