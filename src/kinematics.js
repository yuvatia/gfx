import { createScaleMatrix, decomposeRotationXYZ, invertRotation, reOrthogonalizeRotation } from "./affine.js";
import { Matrix, Vector } from "./math.js";

const getCubeInertiaTensor = (a, b, c) => {
    // a, b, c are the side lengths of the cube (scalars)
    // returns a 3x3 matrix
    const a2 = a * a;
    const b2 = b * b;
    const c2 = c * c;

    const V = a * b * c;
    // TODO factor should be scaled by V, not M
    // const factor = V / 12;
    const factor = 1 / 12;
    return new Matrix([
        factor * (b2 + c2), 0, 0, 0,
        0, factor * (a2 + c2), 0, 0,
        0, 0, factor * (a2 + b2), 0,
        0, 0, 0, 1
    ]);
}

const getInverseCubeInertiaTensor = (a, b, c) => {
    // Inverse diagonal of getCubeInertiaTensor
    return getCubeInertiaTensor(a, b, c).inverseDiagonal();
}


export const getInverseCubeInertiaTensorFromTransform = (transform) => {
    const [a, b, c] = transform.scale.toArray();
    const inverseI0 = getInverseCubeInertiaTensor(a, b, c);
    const rotationMatrix = transform.getRotationMatrix();
    const invertedRotationMatrix = invertRotation(rotationMatrix);
    return rotationMatrix.multiplyMatrix(inverseI0).multiplyMatrix(invertedRotationMatrix);
}

export class Rigidbody {
    constructor(transform, mass, linearVelocity = null, angularVelocity = null) {
        this.transform = transform;
        this.mass = mass;

        this.linearVelocity = linearVelocity || new Vector(1, 0, 0);
        this.angularVelocity = angularVelocity || new Vector(100, 300, 0);
    }

    integratePosition(dt) {
        const dPosition = this.linearVelocity.scale(dt);
        const dRotation = this.angularVelocity.scale(dt);

        // TODO: are euler angles additive? answer: no!!
        // TODO: angular velocity isn't "rate of change of each angle" I think?
        // See here as well: https://math.stackexchange.com/questions/773902/integrating-body-angular-velocity
        this.transform.position = this.transform.position.add(dPosition);
        this.transform.rotation = this.transform.rotation.add(dRotation);
    }

    integratePositionPhysicallyAccurate(dt) {
        // Position is integrated naively
        const dPosition = this.linearVelocity.scale(dt);
        this.transform.position = this.transform.position.add(dPosition);

        // As for angular velocity, we need to account for rotation and inertia tensor,
        // so we have
        // R * InvI0 * Transpose(R) * angularVelocity
        const R = this.transform.getRotationMatrix();
        const omega = getInverseCubeInertiaTensorFromTransform(this.transform).multiplyVector(this.angularVelocity);
        // We now create a skew matrix from omega,
        // which will then be used to rotate the rotation matrix
        // note that R' = R * exp(omega*dt)
        const dRotationMatrix = Matrix.createSkewSymmetric(omega).multiplyMatrix(R).scaleBy(dt);
        let finalRotationMatrix = R.addMatrix(dRotationMatrix);
        // set w to 1
        finalRotationMatrix.elements[15] = 1;

        // Use euler decmpositon
        const useEulerAngles = false;
        if (useEulerAngles) {
            // Note: euler decomposition maintains det = 1 so no "explosion",
            // however it has gimbal lock
            const newEulerAngles = decomposeRotationXYZ(finalRotationMatrix);
            // Gimbal lock messes it up
            this.transform.rotation = newEulerAngles;
            console.log(`${newEulerAngles} `);
            return;
        }

        // Use rotation override
        else {
            // TODO: we have an issue here where we lose precission
            // and need to re-orthonormalize
            // console.log(finalRotationMatrix.determinant());
            finalRotationMatrix = reOrthogonalizeRotation(finalRotationMatrix);
            this.transform.overridenRotationMatrix = finalRotationMatrix;
        }
    }
}
