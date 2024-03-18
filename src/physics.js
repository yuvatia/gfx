import { CollisionDetection } from "./collision.js";
import { BoxCollider, FollowConstraint, Rigidbody, contactConstraint, contactConstraintForSphere, resolveFollowConstraint } from "./kinematics.js";
import { Matrix } from "./math.js";
import { createContacts } from "./sat_contact_creation.js";
import { Sphere } from "./shape_queries.js";


const createContactIfColliding = (
    s1Collider,
    s1Transform,
    s2Collider,
    s2Transform,
    renderer) => {
    // Run collision detection between selected and another entity
    const result = Sphere.getSphereSphereManifold(s1Collider, s2Collider);
    const separating = !result;
    renderer.drawText(renderer.canvas.width / 2 - 200, 60 - renderer.canvas.height / 2,
        `Separating: ${separating}\nDepth:${result ? result.depth : "N/A"}`, 15, "black", "bold 15px Arial");
    if (!result) return null;
    const { contactA, contactB } = result;
    renderer.drawPath(
        [contactA, contactB],
        Matrix.identity,
        "purple",
        true,
        true,
        true
    );
    return result;
}

const createContactIfCollidingSATClip = (
    s1HalfMesh,
    s1Transform,
    s2HalfMesh,
    s2Transform,
    renderer) => {
    const s1Matrix = s1Transform.toWorldMatrix();
    const s2Matrix = s2Transform.toWorldMatrix();

    // Run collision detection between selected and another entity
    const { result: separating, info } = CollisionDetection.SATEx(s1HalfMesh, s2HalfMesh, s1Matrix, s2Matrix);
    renderer.drawText(renderer.canvas.width / 2 - 200, 60 - renderer.canvas.height / 2, `Separating: ${separating}\nDepth:${info ? info.depth : "N/A"}`, 15, "black", "bold 15px Arial");
    if (!separating) {
        const contacts = createContacts(
            s1HalfMesh,
            s2HalfMesh,
            s1Matrix,
            s2Matrix,
            info,
            null, // renderer,
            Number(document.getElementById("clipStepsCount").value)
        );
        if (!contacts || contacts.length == 0) return null;
        return { contacts, info };
    }
    return null;

}

export class PhysicsPreferences {
    gravity = 9.8;
}

export class PhysicsSystem {
    #patchyPatch = null;

    preferences = new PhysicsPreferences();

    onFixedStep = (scene, debugRenderer) => {
        const fixedStep = 0.5;

        // validate active constraints & collect new ones
        // Collect all follow constraints
        const allFollowConstraints = scene.getComponentView(FollowConstraint);
        // apply forces

        // update velocity

        // solve constraints
        allFollowConstraints.forEach(([entId, [constraint]]) => {
            const tethered = constraint.rb1;
            const tether = constraint.rb2;
            const r = tethered.transform.toWorldMatrix().multiplyVector(constraint.rb1Anchor);
            resolveFollowConstraint(
                tethered,
                r,
                tether.transform.position,
                fixedStep);
        })

        // update positions

        const allRigidbodies = scene.getComponentView(Rigidbody);
        // Narrow-phase
        for (let [ent1Id, [rb1]] of allRigidbodies) {
            for (let [ent2Id, [rb2]] of allRigidbodies) {
                if (ent2Id == ent1Id) {
                    break;
                }

                const s1Transform = rb1.transform;
                const s2Transform = rb2.transform;

                // sphere vs sphere
                let res = null;
                if (rb1.getColliderType() === Rigidbody.ColliderType.SPHERE
                    && rb2.getColliderType() === Rigidbody.ColliderType.SPHERE) {
                    const s1Collider = new Sphere(s1Transform.position, s1Transform.scale.x);
                    const s2Collider = new Sphere(s2Transform.position, s2Transform.scale.x);
                    res = Sphere.getSphereSphereManifold(s1Collider, s2Collider);
                    if (!res) continue;
                    contactConstraintForSphere(
                        rb1,
                        rb2,
                        res.contactA,
                        res.contactB,
                        res.normal,
                        res.depth,
                        fixedStep
                    );
                } else {
                    // Assume box vs box or mesh vs mesh
                    const rb1ColliderMesh = rb1.collider.meshRef || new BoxCollider().meshRef;
                    const rb2ColliderMesh = rb2.collider.meshRef || new BoxCollider().meshRef;
                    res = createContactIfCollidingSATClip(
                        rb1ColliderMesh,
                        rb1.transform,
                        rb2ColliderMesh,
                        rb2.transform,
                        debugRenderer);
                    if (!res) continue;
                    // Ignored for now
                    // continue;
                    this.#patchyPatch = this.#patchyPatch || res;
                    const { contacts, info } = this.#patchyPatch;

                    // Draw contacts
                    if (debugRenderer) {
                        debugRenderer.drawPath(
                            contacts,
                            Matrix.identity,
                            "purple",
                            true,
                            true,
                            true
                        );
                        debugRenderer.drawPath(
                            [contacts[0], contacts[0].toVector().add(info.normal.scale(100))],
                            Matrix.identity,
                            "blue",
                            true,
                            true,
                            true
                        );
                    }
                    contactConstraint(
                        rb1,
                        rb2,
                        contacts,
                        info.normal,
                        info.depth,
                        fixedStep,
                        debugRenderer);
                }
            }
        }

        // Finally, integrate position
        for (let entityId of scene.getView(Rigidbody)) {
            const rbody = scene.getComponent(entityId, Rigidbody);
            rbody.integratePositionPhysicallyAccurate(fixedStep);
            rbody.transform.validateWorldMatrix();
        }
    }
}
