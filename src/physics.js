import { Rigidbody, contactConstraintForSphere } from "./kinematics.js";
import { Matrix } from "./math.js";
import { Sphere } from "./shape_queries.js";


const createContactIfColliding = (
    s1Collider,
    s1Transform,
    s2Collider,
    s2Transform,
    renderer) => {
    // Run collision detection between selected and another entity
    const result = Sphere.getContactPoints(s1Collider, s2Collider);
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
            renderer,
            Number(document.getElementById("clipStepsCount").value)
        );
        if (!contacts || contacts.length == 0) return null;
        // console.log(contacts);
        // Now we draw the contacts
        renderer.drawPath(
            contacts,
            Matrix.identity,
            "purple",
            true,
            true,
            true
        );
        // contacts.forEach(contact => {
        //     renderer.drawPoint(
        //         contact,
        //         false,
        //         Matrix.identity,
        //         "purple"
        //     )
        // });
        return { contacts, info };
    }
    return null;

}

export class PhysicsPreferences {
    gravity = 9.8;
}

export class PhysicsSystem {
    preferences = new PhysicsPreferences();

    onFixedStep = (scene, debugRenderer) => {
        // validate active constraints & collect new ones

        // apply forces

        // update velocity

        // solve constraints

        // update positions

        const fixedStep = 0.2;

        // let rLocal = rb1.transform.
        //     getRotationMatrix().
        //     multiplyMatrix(createScaleMatrix(rb1.transform.scale)).
        //     multiplyVector(Vector.one.scale(0.5));
        // frameConstraint(
        //     rb1,
        //     rLocal,
        //     rb2.transform.position,
        //     fixedStep
        // );

        // First, apply constraints
        // fooBar(rb1, rb2.transform.position, 10, fixedStep / 150);

        const allRigidbodies = scene.getComponentView(Rigidbody);
        // Narrow-phase
        for (let [ent1Id, [rb1]] of allRigidbodies) {
            for (let [ent2Id, [rb2]] of allRigidbodies) {
                if (ent2Id == ent1Id) {
                    break;
                }

                const s1Transform = rb1.transform;
                const s2Transform = rb2.transform;
                const s1Collider = new Sphere(s1Transform.position, s1Transform.scale.x);
                const s2Collider = new Sphere(s2Transform.position, s2Transform.scale.x);
                let res = createContactIfColliding(
                    s1Collider,
                    s1Transform,
                    s2Collider,
                    s2Transform,
                    debugRenderer
                );

                // res = null;
                if (res) {
                    // const { contacts, info } = res;
                    // contactConstraint(
                    //     rb1,
                    //     rb2,
                    //     contacts,
                    //     info.normal,
                    //     info.depth,
                    //     fixedStep);

                    contactConstraintForSphere(
                        rb1,
                        rb2,
                        res.contactA,
                        res.contactB,
                        res.normal,
                        res.depth,
                        fixedStep
                    );
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
