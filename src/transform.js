import { createTransformationMatrix, createTranslationMatrix, createScaleMatrix, createRotationMatrixXYZ, invertRotation } from "./affine.js";
import { Component } from "./components.js";
import { Vector } from "./math.js";

export class Transform extends Component {
    position = null;
    rotation = null;
    scale = null;

    overridenRotationMatrix = null;

    constructor(position = Vector.zero, rotation = Vector.zero, scale = Vector.one) {
        super();

        this.position = position.clone();
        this.rotation = rotation.clone();
        this.scale = scale.clone();

        this.overridenRotationMatrix = null;

        this.initialize();
    }

    initialize() {
        this.validateWorldMatrix();
    }

    clone() {
        return new Transform(this.position.clone(), this.rotation.clone(), this.scale.clone());
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
        const viewT = this.position.neg();
        // const viewT = new Vector(this.position.x, this.position.y, -this.position.z);
        if (this.overridenRotationMatrix) {
            return createTranslationMatrix(viewT).multiplyMatrix(this.overridenRotationMatrix)
        }

        return createTransformationMatrix(
            viewT,
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
