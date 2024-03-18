import { Matrix, Vector } from "../math.js";

class Jacobian {
    constructor(type) {
        this.m_type = type;
        this.m_va = Vector.zero.clone();
        this.m_wa = Vector.zero.clone();
        this.m_vb = Vector.zero.clone();
        this.m_wb = Vector.zero.clone();
        this.m_bias = 0.0;
        this.m_effectiveMass = 0.0;
        this.m_totalLambda = 0.0;
    }

    init(contact, dir, dt) {
        this.m_va = dir.neg();
        this.m_wa = contact.m_rA.crossProduct(dir).neg();
        this.m_vb = dir.clone();
        this.m_wb = contact.m_rB.crossProduct(dir);
        // console.log(this.m_wb);

        this.m_bias = 0.0;
        if (this.m_type === Jacobian.Type.Normal) {
            // let beta = contact.BodyA.ContactBeta * contact.BodyB.ContactBeta;
            let beta = 0.01;
            let restitution = contact.BodyA.restitution * contact.BodyB.restitution;
            let relativeVelocity =
                contact.BodyB.linearVelocity.sub(contact.BodyA.linearVelocity)
                    .add(
                        contact.BodyB.angularVelocity.crossProduct(contact.m_rB).sub(
                            contact.BodyA.angularVelocity.crossProduct(contact.m_rA))
                    );
            let closingVelocity = relativeVelocity.dotProduct(dir);
            this.m_bias = -(beta / dt) * contact.Penetration + restitution * closingVelocity;
        }

        let k =
            contact.BodyA.massInv
            + this.m_wa.dotProduct(contact.BodyA.getInverseInertiaTensor().multiplyVector(this.m_wa))
            + contact.BodyB.massInv
            + this.m_wb.dotProduct(contact.BodyB.getInverseInertiaTensor().multiplyVector(this.m_wb));

        this.m_effectiveMass = 1.0 / k;
        this.m_totalLambda = 0.0;
    }

    resolve(contact, dt, debugRenderer) {
        let jv =
            this.m_va.dotProduct(contact.BodyA.linearVelocity)
            + this.m_wa.dotProduct(contact.BodyA.angularVelocity)
            + this.m_vb.dotProduct(contact.BodyB.linearVelocity)
            + this.m_wb.dotProduct(contact.BodyB.angularVelocity);

        let lambda = this.m_effectiveMass * (-(jv + this.m_bias));

        let oldTotalLambda = this.m_totalLambda;
        switch (this.m_type) {
            case Jacobian.Type.Normal:
                this.m_totalLambda = Math.max(0.0, this.m_totalLambda + lambda);
                break;

            case Jacobian.Type.Tangent:
                let friction = contact.BodyA.friction * contact.BodyB.friction;
                let maxFriction = friction * contact.m_jN.m_totalLambda;
                this.m_totalLambda = Math.min(Math.max(this.m_totalLambda + lambda, -maxFriction), maxFriction);
                break;
        }
        lambda = this.m_totalLambda - oldTotalLambda;

        contact.BodyA.linearVelocity = contact.BodyA.linearVelocity.add(this.m_va.scale(lambda * contact.BodyA.massInv));
        contact.BodyA.angularVelocity = contact.BodyA.angularVelocity.add(
            contact.BodyA.getInverseInertiaTensor().multiplyVector(this.m_wa.scale(lambda))
        );

        contact.BodyB.linearVelocity = contact.BodyB.linearVelocity.add(this.m_vb.scale(lambda * contact.BodyB.massInv));
        contact.BodyB.angularVelocity = contact.BodyB.angularVelocity.add(
            contact.BodyB.getInverseInertiaTensor()
                .multiplyVector(this.m_wb.scale(lambda))
        );

        // if (debugRenderer) {
        //     const bDV = this.m_vb.scale(lambda * contact.BodyB.massInv);
        //     const bDW = contact.BodyB.getInverseInertiaTensor().multiplyVector(this.m_wb.scale(lambda));
        //     console.log(`DW ${bDW}`);
        //     // debugRenderer.drawPath([Vector.zero, bDV.scale(200)], Matrix.identity, "red", true, true, true);
        //     debugRenderer.drawPath([Vector.zero, bDW.scale(200)], Matrix.identity, "orange", true, true, true);
        // }

        // console.log("Done!");

    }
}

Jacobian.Type = {
    Normal: 0,
    Tangent: 1
};

export class Contact {
    constructor(BodyA, BodyB, PositionA, PositionB, Normal, Penetration) {
        this.BodyA = BodyA;
        this.BodyB = BodyB;
        this.PositionA = PositionA;
        this.PositionB = PositionB
        this.Normal = Normal;
        this.Penetration = Penetration;

        this.m_rA = null;
        this.m_rB = null;

        this.m_jN = new Jacobian(Jacobian.Type.Normal);
        this.m_jT = new Jacobian(Jacobian.Type.Tangent);
        this.m_jB = new Jacobian(Jacobian.Type.Tangent);
    }

    initVelocityConstraint(dt) {
        this.m_rA = this.PositionA.sub(this.BodyA.transform.position);
        this.m_rB = this.PositionB.sub(this.BodyB.transform.position);

        let [tangent, bitangent] = VectorUtil.formOrthogonalBasis(this.Normal);

        this.m_jN.init(this, this.Normal, dt);
        this.m_jT.init(this, tangent, dt);
        this.m_jB.init(this, bitangent, dt);
    }

    solveVelocityConstraint(dt, debugRenderer) {
        this.m_jN.resolve(this, dt, debugRenderer);
        this.m_jT.resolve(this, dt);
        this.m_jB.resolve(this, dt);
    }
}

// Define VectorUtil.formOrthogonalBasis function
const VectorUtil = {
    formOrthogonalBasis: function (normal) {
        let tangent = Vector.zero;
        if (Math.abs(normal.x) >= 0.57735) {
            tangent = new Vector(normal.y, -normal.x, 0).normalize();
        } else {
            tangent = new Vector(normal.z, -normal.y, 0).normalize();
        }
        let bitangent = normal.crossProduct(tangent);
        return [tangent, bitangent];
    }
};
