import { CollisionDetection } from "./collision.js";
import { BoxCollider, FollowConstraint, Rigidbody, contactConstraint, contactConstraintForSphere, resolveFollowConstraint } from "./kinematics.js";
import { Matrix, Vector } from "./math.js";
import { Contact } from "./oven/contact.js";
import { createContacts } from "./sat_contact_creation.js";
import { Sphere } from "./shape_queries.js";
import { Transform } from "./transform.js";

const getMeshMeshManifold = (
    s1HalfMesh,
    s1Transform,
    s2HalfMesh,
    s2Transform,
    renderer,
    clipStepsCount = 999) => {
    const s1Matrix = s1Transform.toWorldMatrix();
    const s2Matrix = s2Transform.toWorldMatrix();

    // Run collision detection between selected and another entity
    const { result: separating, info } = CollisionDetection.SATEx(s1HalfMesh, s2HalfMesh, s1Matrix, s2Matrix);
    if (renderer) {
        renderer.drawText(renderer.canvas.width / 2 - 200, 60 - renderer.canvas.height / 2, `Separating: ${separating}\nDepth:${info ? info.depth : "N/A"}`, 15, "black", "bold 15px Arial");
    }
    if (!separating) {
        const contacts = createContacts(
            s1HalfMesh,
            s2HalfMesh,
            s1Matrix,
            s2Matrix,
            info,
            null, // renderer,
            clipStepsCount
        );
        if (!contacts || contacts.length == 0) return null;
        // TODO we should project on a shared plane
        const contactsA = contacts.map(c => c);
        const contactsB = contacts.map(c => c);
        const contactPairs = contactsA.map((cA, i) => {
            return [new Vector(...cA.toArray()), new Vector(...contactsB[i].toArray())]
        });
        return { contactPairs, info };
    }
    return null;

}

export class PhysicsPreferences {
    gravity = 9.8;
    clipStepsCount = 99;
    visualize = false;
}

export class PhysicsSystem {
    #patchyPatch = null;

    preferences = new PhysicsPreferences();

    #followConstraints = [];
    #rigidBodies = [];

    #collectConstraints(scene, debugRenderer) {
        this.#followConstraints = scene.getComponentView(FollowConstraint);
        // Collect UUIDComponent matching followConstraint id
        this.#followConstraints.map(([, [constraint]]) => {
            const rb1 = scene.getComponentByUUID(constraint.rb1ID, Rigidbody);
            const rb2 = scene.getComponentByUUID(constraint.rb2ID, Rigidbody);
            constraint.setRigidbodies(rb1, rb2);
        });
        // If any of the constraints have no rbodies then remove them
        this.#followConstraints = this.#followConstraints.filter(([, [constraint]]) => {
            return constraint.rb1 && constraint.rb2;
        });

        // Collect collision constraints from last frame
        this.#rigidBodies = scene.getComponentView(Rigidbody);
        // Update all Transform refs in rbodies
        this.#rigidBodies.forEach(([entId, [rb]]) => {
            rb.setTransform(scene.getComponent(entId, Transform));
        });
        this.#collectCollisions(debugRenderer);
    }

    #solveConstraints(fixedStep) {
        this.#followConstraints.forEach(([entId, [constraint]]) => {
            const tethered = constraint.rb1;
            const tether = constraint.rb2;
            const r = tethered.transform.toWorldMatrix().multiplyVector(constraint.rb1Anchor);
            resolveFollowConstraint(
                tethered,
                r,
                tether.transform.position,
                fixedStep);
        })
    }

    #contactContraints = [];

    getCollisionContactIfColliding(rb1, rb2, debugRenderer) {
        const s1Transform = rb1.transform;
        const s2Transform = rb2.transform;

        // sphere vs sphere
        let res = null;
        if (rb1.getColliderType() === Rigidbody.ColliderType.SPHERE
            && rb2.getColliderType() === Rigidbody.ColliderType.SPHERE) {
            const s1Collider = new Sphere(s1Transform.position, s1Transform.scale.x);
            const s2Collider = new Sphere(s2Transform.position, s2Transform.scale.x);
            res = Sphere.getSphereSphereManifold(s1Collider, s2Collider);
            if (!res) return null;
            return [new Contact(rb1, rb2, res.contactA, res.contactB, res.normal, res.depth)];
        }
        // Assume box vs box or mesh vs mesh
        const rb1ColliderMesh = rb1.collider.meshRef || new BoxCollider().meshRef;
        const rb2ColliderMesh = rb2.collider.meshRef || new BoxCollider().meshRef;
        res = getMeshMeshManifold(
            rb1ColliderMesh,
            rb1.transform,
            rb2ColliderMesh,
            rb2.transform,
            debugRenderer,
            this.preferences.clipStepsCount);
        if (!res) return null;
        // Ignored for now
        // continue;
        this.#patchyPatch = res; // this.#patchyPatch || res;
        const { contactPairs, info } = this.#patchyPatch;

        // Draw contacts
        if (debugRenderer) {
            debugRenderer.drawPath(
                contactPairs.map(([a, b]) => a),
                Matrix.identity,
                "purple",
                true,
                true,
                true
            );
            debugRenderer.drawPath(
                [contactPairs[0][0], contactPairs[0][0].add(info.normal.scale(100))],
                Matrix.identity,
                "blue",
                true,
                true,
                true
            );
        }
        const contactsFinal = contactPairs.map(([contactA, contactB]) => new Contact(rb1, rb2, contactA, contactB, info.normal, info.depth));
        return contactsFinal;
    }


    #collectCollisions(debugRenderer) {
        this.#contactContraints = [];
        for (let [ent1Id, [rb1]] of this.#rigidBodies) {
            for (let [ent2Id, [rb2]] of this.#rigidBodies) {
                if (ent2Id == ent1Id) {
                    break;
                }

                const contacts = this.getCollisionContactIfColliding(rb1, rb2, debugRenderer);
                if (!contacts || contacts.length == 0) continue;
                this.#contactContraints.push(...contacts);
            }
        }
    }

    #solveCollisions = (debugRenderer, fixedStep) => {
        this.#contactContraints.forEach(c => c.initVelocityConstraint(fixedStep));
        // PGS, run n times hoping for convergence
        for (let i = 0; i < 7; i++) {
            this.#contactContraints.forEach(c => c.solveVelocityConstraint(fixedStep, debugRenderer));
        }
    }

    integratePosition(dt) {
        for (let [, [rbody]] of this.#rigidBodies) {
            rbody.integratePositionPhysicallyAccurate(dt);
            rbody.transform.validateWorldMatrix();
        }
    }

    onFixedStep = (scene, debugRenderer) => {
        const fixedStep = 0.4;

        // validate active constraints & collect new ones
        // Collect all follow constraints
        this.#collectConstraints(scene, this.preferences.visualize ? debugRenderer : null);

        // apply forces
        this.#rigidBodies.forEach(([entId, [rb]]) => {
            const gravityForce = new Vector(0, 0, -this.preferences.gravity * rb.mass * rb.gravityScale);
            rb.force = rb.force.add(gravityForce);
        });

        // update velocity

        // solve constraints, collisions last
        this.#solveConstraints(fixedStep);
        this.#solveCollisions(this.preferences.visualize ? debugRenderer : null, fixedStep);

        // update positions
        // Finally, integrate position
        this.integratePosition(fixedStep);
    }
}
