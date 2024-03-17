import { Rigidbody } from "./kinematics.js";


export class PhysicsPreferences {
    gravity = 9.8;
}

export class PhysicsSystem {
    preferences = new PhysicsPreferences();

    onFixedStep(activeScene, fixedDt) {
        const relevantEntities = activeScene.getView(Rigidbody);
        const allRigidbodies = relevantEntities.map(entity => entity.getComponent(Rigidbody));

        // validate active constraints & collect new ones

        // apply forces

        // update velocity

        // solve constraints

        // update positions
        for (let rbody of allRigidbodies) {
            rbody.integratePositionPhysicallyAccurate(fixedDt);
            rbody.transform.validateWorldMatrix();
        }
    }

    
}
