import { Vector } from "./math.js";
import { createTransformationMatrix } from "./affine.js";

export class Camera {
    constructor() {
        this.position = new Vector(0, 0, -1000);
        this.rotation = new Vector(1, 0, 0);
        this.validateViewMatrix();
        this.installCameraControls();
    }

    installCameraControls() {
        // Listen for button changes
        document.addEventListener('keydown', (event) => {
            if (event.shiftKey) {
                if (event.key === 'W') {
                    console.log('here');
                    this.adjustPosition(new Vector(0, 50, 0));
                } else if (event.key === 'S') {
                    this.adjustPosition(new Vector(0, -50, 0));
                } else if (event.key === 'A') {
                    this.adjustPosition(new Vector(-50, 0, 0));
                } else if (event.key === 'D') {
                    this.adjustPosition(new Vector(50, 0, 0));
                } else if (event.key === 'Z') {
                    this.adjustPosition(new Vector(0, 0, 100));
                } else if (event.key === 'X') {
                    this.adjustPosition(new Vector(0, 0, -100));
                }
            }
            // If ctrl is pressed then we use the same buttons but to adjust rotation
            if (event.altKey) {
                if (event.key === 'w') {
                    this.rotation = this.rotation.add(new Vector(1, 0, 0));
                } else if (event.key === 's') {
                    this.rotation = this.rotation.add(new Vector(-1, 0, 0));
                } else if (event.key === 'a') {
                    this.rotation = this.rotation.add(new Vector(0, 1, 0));
                } else if (event.key === 'd') {
                    this.rotation = this.rotation.add(new Vector(0, -1, 0));
                } else if (event.key === 'z') {
                    this.rotation = this.rotation.add(new Vector(0, 0, 1));
                } else if (event.key === 'x') {
                    this.rotation = this.rotation.add(new Vector(0, 0, -1));
                }
                this.validateViewMatrix();
            }
        });
    }

    validateViewMatrix() {
        this.viewMatrix = createTransformationMatrix(
            new Vector(this.position.x, this.position.y, -this.position.z),
            this.rotation
        )
    }

    adjustPosition(positionDelta) {
        this.position = this.position.add(positionDelta);
        this.validateViewMatrix();
    }

    getViewMatrix() {
        return this.viewMatrix;
    }
}
