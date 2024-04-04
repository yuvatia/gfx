import { Asset, MeshAsset } from "../asset.js";
import { createScaleMatrix, decomposeRotationXYZ, invertRotation, reOrthogonalizeRotation } from "./affine.js";
import { Component, UUID, UUIDComponent } from "./components.js";
import { Cube } from "./geometry.js";
import { DCELRepresentation } from "./halfmesh.js";
import { Matrix, Vector } from "./math.js";
import { Contact } from "./oven/contact.js";
import { createContacts } from "./sat_contact_creation.js";

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

const getSphereInertiaTensor = (r, mass) => {
    // r is the radius of the sphere (scalar)
    // returns a 3x3 matrix
    const factor = (2.0 / 5.0) * mass * r * r;
    return new Matrix([
        factor, 0, 0, 0,
        0, factor, 0, 0,
        0, 0, factor, 0,
        0, 0, 0, 1
    ]);

}

const getInverseCubeInertiaTensor = (a, b, c, mass) => {
    // Inverse diagonal of getCubeInertiaTensor
    return getCubeInertiaTensor(a, b, c, mass).inverseDiagonal();
}

const getInverseSphereInertiaTensor = (r, mass) => {
    // Inverse diagonal of getCubeInertiaTensor
    return getSphereInertiaTensor(r, mass).inverseDiagonal();
}

export const getInverseSphereInertiaTensorFromTransform = (transform, mass) => {
    const [a, b, c] = transform.scale.toArray();
    // Assuming a = b = c = r
    const inverseI0 = getInverseSphereInertiaTensor(a, mass);
    const rotationMatrix = transform.getRotationMatrix();
    const invertedRotationMatrix = invertRotation(rotationMatrix);
    return rotationMatrix.multiplyMatrix(inverseI0).multiplyMatrix(invertedRotationMatrix);
}



export const getInverseCubeInertiaTensorFromTransform = (transform, mass) => {
    const [a, b, c] = transform.scale.toArray();
    const inverseI0 = getInverseCubeInertiaTensor(a, b, c, mass);
    const rotationMatrix = transform.getRotationMatrix();
    const invertedRotationMatrix = invertRotation(rotationMatrix);
    return rotationMatrix.multiplyMatrix(inverseI0).multiplyMatrix(invertedRotationMatrix);
}

export class SphereCollider {
    meshRef = null;
}

export class BoxCollider {
    meshRef = MeshAsset.get('Cube');
}

export class MeshCollider {
    meshRef = null;
}

export class Rigidbody extends Component {
    mass = 1;
    #massInv = 1;  // Not editable
    transform = null;

    linearVelocity = new Vector(0, 0, 0);
    angularVelocity = new Vector(1000, 3000, 0);

    friction = 1.0;
    restitution = 0.0;

    angularDamping = 0.999;
    linearDamping = 0.999;

    gravityScale = 0.0;

    collider = null; // Not editable at the moment sadly?

    constructor(transform = null, mass = 1, linearVelocity = null, angularVelocity = null, collider = null) {
        super();

        this.setTransform(transform);
        this.setMass(mass);

        this.linearVelocity = linearVelocity || new Vector(0, 0, 0);
        this.angularVelocity = angularVelocity || new Vector(0, 0, 0);

        this.friction = 1.0;
        this.restitution = 0;

        this.angularDamping = 0.999;
        this.linearDamping = 0.999;

        this.collider = collider || new BoxCollider();

        this.gravityScale = 0.0;

        this.force = Vector.zero;
        this.torque = Vector.zero;
    }

    static get typename() {
        return 'Rigidbody';
    }

    get typename() {
        return Rigidbody.typename;
    }

    initialize() {
        // Will validate inv mass
        this.setMass(this.mass);
    }

    static ColliderType = {
        SPHERE: "sphere",
        BOX: "box",
        MESH: "mesh"
    };

    setTransform(transform) {
        this.transform = transform;
    }

    getColliderType() {
        if (this.collider === null || this.collider.constructor === undefined) {
            return Rigidbody.ColliderType.BOX;
        }
        switch (this.collider.constructor) {
            case BoxCollider:
                return Rigidbody.ColliderType.BOX;
            case SphereCollider:
                return Rigidbody.ColliderType.SPHERE;
            case MeshCollider:
                return Rigidbody.ColliderType.MESH;
        }
    }

    get massInv() {
        return this.#massInv;
    }

    getInverseInertiaTensor() {
        switch (this.getColliderType()) {
            case Rigidbody.ColliderType.SPHERE:
                return getInverseSphereInertiaTensorFromTransform(this.transform, this.mass);
            default:
                break;
        }
        return getInverseCubeInertiaTensorFromTransform(this.transform, this.mass);
    }

    setMass(newMass) {
        this.mass = newMass;
        this.#massInv = this.mass === 0 ? 0 : 1 / this.mass;
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
        return this.getInverseInertiaTensor().multiplyVector(this.angularVelocity);
    }

    integratePositionPhysicallyAccurate(dt) {
        // implicit euler - first velocity, then position
        // v' = v + a * dt
        this.linearVelocity = this.linearVelocity.add(this.force.scale(this.#massInv).scale(dt));

        // x' = v * dt
        this.transform.position = this.transform.position.add(this.linearVelocity.scale(dt));
        // R' = R * exp(omega*dt)
        const R = this.transform.getRotationMatrix();
        const deltaR = Matrix.createSkewSymmetric(this.angularVelocity).multiplyMatrix(R).scaleBy(dt);
        const finalRotation = reOrthogonalizeRotation(R.addMatrix(deltaR));
        this.transform.rotation = decomposeRotationXYZ(finalRotation);
        if (this.transform.rotation.isNaN()) {
            throw ("NaN rotation ", finalRotation, this.transform.rotation);
        }
        // this.transform.overridenRotationMatrix = finalRotation;

        // Apply some damping
        this.linearVelocity = this.linearVelocity.scale(this.linearDamping);
        this.angularVelocity = this.angularVelocity.scale(this.angularDamping);
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

export const resolveFollowConstraint = (rb, r, p, dt) => {
    const Beta = 0.3;

    // Apply gravity but *only* on this body - todo later add opt in flag for gravity in Rigidbody
    const Gravity = new Vector(0, -20, 0);
    const massInv = rb.massInv;

    const inertiaInvWs = rb.getInverseInertiaTensor();

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

export const contactConstraint = (rb1, rb2, contacts, normal, depth, dt, debugRenderer) => {
    let contact_constraints = [];
    // PositionA and PositionB are contact points in A, B relative to A, B.
    // but actually they are global!!! O: O: O: holy
    for (let contact of contacts) {
        let p = new Vector(...contact.toArray());
        let contactA = p;//p.sub(rb1.transform.position);
        let contactB = p;//p.sub(rb2.transform.position);
        contact_constraints.push(new Contact(
            rb1, rb2, contactA, contactB, normal, depth
        ));
    }
    return contact_constraints;
}

export const contactConstraintForSphere = (rb1, rb2, contactA, contactB, normal, depth, dt) => {
    return new Contact(
        rb1, rb2, contactA, contactB, normal, depth
    );
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
    // console.log(`${inertiaInvWs}`);
    rb.angularVelocity = rb.angularVelocity.add(angularDelta);

    // damping
    rb.linearVelocity = rb.linearVelocity.scale(0.98);
    rb.angularVelocity = rb.angularVelocity.scale(0.98);
}


export class FollowConstraint extends Component {
    rb1ID = UUID.empty;  // tethered
    rb2ID = UUID.empty;  // tether
    rb1Anchor = Vector.zero.clone(); // in rb1 local space

    #rb1 = new Rigidbody();  // tethered
    #rb2 = new Rigidbody();  // tether


    constructor(rb1ID = UUID.empty, rb2ID = UUID.empty, rb1Anchor = Vector.zero.clone()) {
        super();

        this.rb1ID = rb1ID;
        this.rb2ID = rb2ID;
        this.rb1Anchor = rb1Anchor;
    }

    static get typename() {
        return 'FollowConstraint';
    }

    get typename() {
        return FollowConstraint.typename;
    }

    setRigidbodies(rb1, rb2) {
        this.#rb1 = rb1;
        this.#rb2 = rb2;
    }

    get rb1() {
        return this.#rb1;
    }

    get rb2() {
        return this.#rb2;
    }
}
