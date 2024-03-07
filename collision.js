import { Vector, Matrix } from "math.js";
import { Interval } from "./halfmesh.js";
import { Plane } from "affine.js";

export class CollisionDetection {
    DoOverlapOnAxis(axis, s1, s2, t1 = Matrix.identity, t2 = Matrix.identity) {
        let i1 = s1.projectOnAxis(axis, t1);
        let i2 = s2.projectOnAxis(axis, t2);
        return Interval.AreOverlapping(i1, i2);
    }

    GetOverlapOnAxis(axis, s1, s2, t1 = Matrix.identity, t2 = Matrix.identity) {
        let i1 = s1.projectOnAxis(axis, t1);
        let i2 = s2.projectOnAxis(axis, t2);
        return Interval.GetOverlap(i1, i2);
    }

    GetEdgeAxis(edge1, edge2, e1_centeroid, t1 = Matrix.identity, t2 = Matrix.identity) {
        let axis = Vector.normalized(Vector.crossProduct(t1.multiplyVector(edge1.GetDirection()), t2.multiplyVector(edge2.GetDirection())));
        let e1_center_world = t1.multiplyPoint(e1_centeroid);
        let vec_to_e1_center = Vector.subtract(e1_center_world, edge1.origin.position);
        if (Vector.dot(vec_to_e1_center, axis) < 0.0) {
            axis = Vector.negate(axis);
        }
        return axis;
    }

    BooleanSAT(s1, s2, t1 = Matrix.identity, t2 = Matrix.identity) {
        let effectiveT1 = t1;
        let effectiveT2 = t2;

        for(let face of s1.faces) {
            let axis = effectiveT1.multiplyVector(face.GetFaceNormal(s1.centroid));
            if (!this.DoOverlapOnAxis(axis, s1, s2, t1, t2)) {
                return true;
            }
        }
        for(let face of s2.faces) {
            let axis = effectiveT2.multiplyVector(face.GetFaceNormal(s2.centroid));
            if (!this.DoOverlapOnAxis(axis, s1, s2, t1, t2)) {
                return true;
            }
        }
        for(let edge1 of s1.halfEdges) {
            for(let edge2 of s2.halfEdges) {
                let axis = this.GetEdgeAxis(edge1, edge2, s1.centroid, t1, t2);
                if (!this.DoOverlapOnAxis(axis, s1, s2, t1, t2)) {
                    return true;
                }
            }
        }
        return false;
    }

    QueryFaceDirection(s1, s2, effectiveT1, effectiveT2) {
        let info = new CollisionInfo();
        for(let face of s1.faces) {
            let axis = effectiveT1.multiplyVector(face.GetFaceNormal(s1.centroid));
            let overlap = this.GetOverlapOnAxis(axis, s1, s2, effectiveT1, effectiveT2);
            let plane = Plane.FromNormalAndPoint(axis, effectiveT1.multiplyPoint(face.edge.origin.position));
            let supportS2 = s2.GetSupport(Vector.negate(axis), effectiveT2);
            let distance = plane.GetPointDistance(supportS2);
            if (overlap == null) {
                return {result: true, info: null};
            }
            if (distance >= 0.0) {
                continue;
            }
            let length = overlap.Length();
            if (length < info.depth) {
                info.depth = length;
                info.normal = axis;
                info.incidentFace = face;
            }
        }
        return {result: false, info: info};
    }

    SATEx(s1, s2, t1 = Matrix.identity, t2 = Matrix.identity) {
        let info = new CollisionInfo();
        let effectiveT1 = t1;
        let effectiveT2 = t2;

        let {result: hull1FaceResult, info: hull1FaceInfo} = this.QueryFaceDirection(s1, s2, effectiveT1, effectiveT2);
        if (hull1FaceResult) return {result: true, info: null};
        if (hull1FaceInfo.depth < info.depth) {
            info = hull1FaceInfo;
            info.incidentHull = 1;
        }
        let {result: hull2FaceResult, info: hull2FaceInfo} = this.QueryFaceDirection(s2, s1, effectiveT2, effectiveT1);
        if (hull2FaceResult) return {result: true, info: null};
        if (hull2FaceInfo.depth < info.depth) {
            info = hull2FaceInfo;
            info.incidentHull = 2;
        }

        for(let edge1 of s1.halfEdges) {
            for(let edge2 of s2.halfEdges) {
                let axis = this.GetEdgeAxis(edge1, edge2, s1.centroid, t1, t2);
                let overlap = this.GetOverlapOnAxis(axis, s1, s2, t1, t2);
                if (overlap == null) {
                    return {result: true, info: null};
                }
                let e1_origin_world = t1.multiplyPoint(edge1.origin.position);
                let plane = Plane.FromNormalAndPoint(axis, e1_origin_world);
                let e2_origin_world = t2.multiplyPoint(edge2.origin.position);
                let distance = plane.GetPointDistance(e2_origin_world);
                if (distance >= 0.0) {
                    continue;
                }
                let length = overlap.Length();
                if (length < info.depth) {
                    info.witnessEdge1 = edge1;
                    info.witnessEdge2 = edge2;
                    info.depth = length;
                    info.normal = axis;
                    info.faceContact = false;
                }
            }
        }
        return {result: false, info: info};
    }
}

export class CollisionInfo {
    constructor() {
        this.normal = null;
        this.depth = Number.MAX_VALUE;
        this.incidentFace = null;
        this.incidentHull = 0;
        this.referenceFace = null;
        this.witnessEdge1 = null;
        this.witnessEdge2 = null;
        this.faceContact = true;
    }
}
