import { createTransformationMatrix, createTranslationMatrix, createScaleMatrix, createRotationMatrixXYZ, invertRotation } from "./affine.js";
import { Vector } from "./math.js";

export class Transform {
    constructor(position, rotation, scale) {
        this.position = position;
        this.rotation = rotation;
        this.scale = scale;

        this.overridenRotationMatrix = null;

        this.validateWorldMatrix();
    }

    validateWorldMatrix() {
        if (this.overridenRotationMatrix) {
            this.worldMatrix_ =
                createTranslationMatrix(this.position)
                    .multiplyMatrix(this.overridenRotationMatrix)
                    .multiplyMatrix(createScaleMatrix(this.scale));
            return;
        }
        // Make sure rotation ranges from -180 to 180
        this.rotation = this.rotation.mod(360);
        this.worldMatrix_ = createTransformationMatrix(this.position, this.rotation, this.scale);
    }

    toWorldMatrix() {
        return this.worldMatrix_;
    }

    getRotationMatrix() {
        if (this.overridenRotationMatrix) {
            return this.overridenRotationMatrix;
        }
        return createRotationMatrixXYZ(...this.rotation.toArray());
    }

    getRotationInverse() {
        return invertRotation(this.getRotationMatrix());
    }

    getViewMatrix() {
        return createTransformationMatrix(
            new Vector(this.position.x, this.position.y, -this.position.z),
            this.rotation
        );
    }

    adjustPosition(delta) {
        this.position = this.position.add(delta);
        this.validateWorldMatrix();
    }

    adjustRotation(delta) {
        this.rotation = this.rotation.add(delta);
        this.validateWorldMatrix();
    }

    setPosition(position) {
        this.position = position;
        this.validateWorldMatrix();
    }

    setRotation(rotation) {
        this.rotation = rotation;
        this.validateWorldMatrix();
    }

    setScale(scale) {
        this.scale = scale;
        this.validateWorldMatrix();
    }
}
