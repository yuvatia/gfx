import { createScaleMatrix, decomposeRotationXYZ, invertRotation, reOrthogonalizeRotation } from "./affine.js";
import { Matrix, Vector } from "./math.js";

const getCubeInertiaTensor = (a, b, c, mass) => {
    // a, b, c are the side lengths of the cube (scalars)
    // returns a 3x3 matrix
    const a2 = a * a;
    const b2 = b * b;
    const c2 = c * c;

    const V = a * b * c;
    // TODO factor should be scaled by V, not M
    // const factor = V / 12;
    const factor = mass / 12.0;
    return new Matrix([
        factor * (b2 + c2), 0, 0, 0,
        0, factor * (a2 + c2), 0, 0,
        0, 0, factor * (a2 + b2), 0,
        0, 0, 0, 1
    ]);
}

const getInverseCubeInertiaTensor = (a, b, c, mass) => {
    // Inverse diagonal of getCubeInertiaTensor
    return getCubeInertiaTensor(a, b, c, mass).inverseDiagonal();
}


export const getInverseCubeInertiaTensorFromTransform = (transform, mass) => {
    const [a, b, c] = transform.scale.toArray();
    const inverseI0 = getInverseCubeInertiaTensor(a, b, c, mass);
    const rotationMatrix = transform.getRotationMatrix();
    const invertedRotationMatrix = invertRotation(rotationMatrix);
    return rotationMatrix.multiplyMatrix(inverseI0).multiplyMatrix(invertedRotationMatrix);
}

export class Rigidbody {
    constructor(transform, mass, linearVelocity = null, angularVelocity = null) {
        this.transform = transform;
        this.mass = mass;
        this.massInv = mass === 0 ? 0 : 1 / mass;

        this.linearVelocity = linearVelocity || new Vector(1, 0, 0);
        this.angularVelocity = angularVelocity || new Vector(1000, 3000, 0);
    }

    integratePosition(dt) {
        // Temporary to make sure constraints are solved in a timely fashion
        const dPosition = this.linearVelocity.scale(dt * 2000);
        const dRotation = this.angularVelocity.scale(dt);

        // TODO: are euler angles additive? answer: no!!
        // TODO: angular velocity isn't "rate of change of each angle" I think?
        // See here as well: https://math.stackexchange.com/questions/773902/integrating-body-angular-velocity
        this.transform.position = this.transform.position.add(dPosition);
        this.transform.rotation = this.transform.rotation.add(dRotation);
    }

    getOmega() {
        return getInverseCubeInertiaTensorFromTransform(this.transform, this.mass).multiplyVector(this.angularVelocity);
    }

    integratePositionPhysicallyAccurate(dt) {
        // x' = v * dt
        this.transform.position = this.transform.position.add(this.linearVelocity.scale(dt));
        // R' = R * exp(omega*dt)
        const R = this.transform.getRotationMatrix();
        const deltaR = Matrix.createSkewSymmetric(this.angularVelocity).multiplyMatrix(R).scaleBy(dt);
        const finalRotation = reOrthogonalizeRotation(R.addMatrix(deltaR));
        // this.transform.rotation = decomposeRotationXYZ(finalRotation);
        this.transform.overridenRotationMatrix = finalRotation;
    }

    integratePositionPhysicallyAccurateOld(dt) {
        // This does something weird with omega vs tensor
        // Note: we use first order taylor-series approximation
        // f(t+dt) = f(t) + f'(t) * dt
        // For center of mass we have x(t+dt) = x(t) + v(t) * dt
        // Next we need to apply rotation. Given a rotation R(t), we know that R'(t) = cross(omega(t)) * R(t)
        // So we get:
        // R(t+dt) = R(t) + cross(omega(t)) * R(t) * dt
        // Position is integrated naively
        // Note that we need to use the moment of inertia to get the angular velocity of some point relative to the COM
        const dPosition = this.linearVelocity.scale(dt);
        this.transform.position = this.transform.position.add(dPosition);

        // As for angular velocity, we need to account for rotation and inertia tensor,
        // so we have
        // R * InvI0 * Transpose(R) * angularVelocity
        const R = this.transform.getRotationMatrix();
        const omega = this.getOmega();
        // We now create a skew matrix from omega,
        // which will then be used to rotate the rotation matrix
        // note that R' = R * exp(omega*dt)
        const dRotationMatrix = Matrix.createSkewSymmetric(omega).multiplyMatrix(R).scaleBy(dt);
        let finalRotationMatrix = R.addMatrix(dRotationMatrix);

        // Use euler decmpositon
        const useEulerAngles = true;
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

export const fooBar = (rb1, p0, dt) => {
    const beta_coefficient = 0.01;
    const c = rb1.transform.position.sub(p0); // Distance is C
    // Using Baumgarte stabilization - b = beta_coefficient(C) / dt
    const b = c.scale(beta_coefficient / dt);
    // Apply velocity correction to rb1
    rb1.linearVelocity = rb1.linearVelocity.sub(b);
    // Damping
    rb1.linearVelocity = rb1.linearVelocity.scale(0.9);
    // rb1.transform.position = rb1.transform.position.add(rb1.linearVelocity.scale(dt));
}

export const frameConstraint = (rb, r, p, dt) => {
    const Beta = 0.3;

    // Apply gravity but *only* on this body - todo later add opt in flag for gravity in Rigidbody
    const Gravity = new Vector(0, -20, 0);
    const massInv = rb.massInv;

    const inertiaInvWs = getInverseCubeInertiaTensorFromTransform(rb.transform, rb.mass);

    // gravity
    rb.linearVelocity = rb.linearVelocity.add(Gravity.scale(dt));

    // constraint errors
    let cPos = rb.transform.position.add(r).sub(p);
    let cVel = rb.linearVelocity.add(rb.angularVelocity.crossProduct(r));

    // constraint resolution
    let s = Matrix.createSkewSymmetric(r.neg());
    let k = Matrix.identity.scaleBy(massInv).addMatrix(s.multiplyMatrix(inertiaInvWs).multiplyMatrix(s.transpose()));
    let effectiveMass = Matrix.inverseMatrix3x3(k);
    let lambda = effectiveMass.multiplyVector(cVel.add(cPos.scale(Beta / dt)).neg());

    // velocity correction
    rb.linearVelocity = rb.linearVelocity.add(lambda.scale(massInv));
    rb.angularVelocity = rb.angularVelocity.add(inertiaInvWs.multiplyMatrix(s.transpose()).multiplyVector(lambda));
    rb.linearVelocity = rb.linearVelocity.scale(0.98); // temp magic
    rb.angularVelocity = rb.angularVelocity.scale(0.98); // temp magic 
}

export const frameConstraint1Broken = (rb, r, p, dt) => {
    dt = 0.02;

    // Apply gravity but *only* on this body - todo later add opt in flag for gravity in Rigidbody
    const Gravity = new Vector(0, -2000, 0);
    rb.linearVelocity = rb.linearVelocity.add(Gravity.scale(dt));

    const cPos = rb.transform.position.add(r).sub(p);

    // If within threshold, do nothing
    if (cPos.magnitude() < 0.01) {
        return;
    }

    // cVel = JV
    // const omega = rb.getOmega();
    const omega = rb.angularVelocity;
    const JV = rb.linearVelocity.add(omega.crossProduct(r));
    // console.log(`${JV}`);
    // TODO should be negated?
    const s = Matrix.createSkewSymmetric(r.neg());

    // Baumgarte stabilization
    const beta = 0.02;
    const b = cPos.scale(beta / dt);

    // const inertiaInvWs = getInverseCubeInertiaTensorFromTransform(rb.transform, rb.mass);
    // TODO temporary hack
    const rotationMatrix = rb.transform.getRotationMatrix();
    const invertedRotationMatrix = invertRotation(rotationMatrix);
    const inertiaInvWs = rotationMatrix.multiplyMatrix(Matrix.identity).multiplyMatrix(invertedRotationMatrix);
    const k = Matrix.identity.scaleBy(rb.massInv).addMatrix(s.multiplyMatrix(inertiaInvWs).multiplyMatrix(s.transpose()));
    const effectiveMassInverse = Matrix.inverseMatrix3x3(k);
    const lambda = effectiveMassInverse.multiplyVector(JV.add(b).neg());
    // console.log(`${rb.angularVelocity}`);

    // Velocity correction
    const linearDelta = lambda.scale(rb.massInv);
    rb.linearVelocity = rb.linearVelocity.add(linearDelta);
    const angularDelta = inertiaInvWs.multiplyMatrix(s).multiplyVector(lambda);
    console.log(`${inertiaInvWs}`);
    rb.angularVelocity = rb.angularVelocity.add(angularDelta);

    // damping
    rb.linearVelocity = rb.linearVelocity.scale(0.98);
    rb.angularVelocity = rb.angularVelocity.scale(0.98);
}
