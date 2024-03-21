import { Vector, Matrix } from "./math.js";
import { Interval } from "./halfmesh.js";

export class Plane {
    // No enums in vanilla JS
    static Side =
        {
            Front: "Front",
            Back: "Back",
            On: "On"
        }

    constructor(normal, distance) {
        // N*x + D = 0;
        if (normal.isNaN()) {
            console.log("NaN normal!!");
        }
        this.normal = normal; // Vector
        this.distance = distance; // float
    }

    static FromNormalAndPoint(normal, point) {
        // Calculate plane from normal and point
        // N*x + D = 0;
        // So D = -N*P
        return new Plane(
            normal.normalize(),
            normal.neg().dotProduct(point.toVector()));
    }

    static FromPoints(a, b, c) {
        var normal = (b.sub(a)).crossProduct(c.sub(a)).normalize();
        return Plane.FromNormalAndPoint(normal, a);
    }

    GetSide(point) {
        const distance = this.GetPointDistance(point);
        // if (distance > 0.001f) return Side.Front;
        // if (distance < -0.001f) return Side.Back;
        if (distance > 0.001) return Plane.Side.Back;
        if (distance < -0.001) return Plane.Side.Front;
        return Plane.Side.On;
    }

    GetPointDistance(point) {
        // Positive if point is in front, negative if on back, 0 if on
        return this.normal.dotProduct(point) + this.distance;
    }

    Clip(he) {
        return this.Clip(he.origin.position, he.next.origin.position);
    }

    Clip(start, end) {
        // We have an intersection when the line defined by AB (A=start B=end)
        // satisfied the line equation. In general, the line is defiend as:
        // l = a + t(b-a)
        // a point x on the plane satisfies the equation
        // n*x + d = 0
        // substituting we get:
        // n*(a+t(b-a)) + d = 0
        // n*a + tn*(b-a) + d = 0
        // t = (d + n*a) / (n*(a-b))
        // t = (d + n*a) / n*(vec(ba)))
        // We need to make sure t is clamped between 0 and 1
        // then subsitute t in first equation to get the point

        // TODO performance
        // ensure start and end are arrays
        start = new Vector(...start.toArray());
        end = new Vector(...end.toArray());
        var nA = this.normal.dotProduct(start);
        var nBA = this.normal.dotProduct(start.sub(end));
        // Consider degenerate case where the line
        // is on the plane, then there is no intersection
        if (nBA == 0) {
            return null;
        }
        var t = (this.distance + nA) / nBA;
        // If intersection is outside the line then no intersection
        if (t < 0 || t > 1) {
            return null;
        }
        const position = start.add(end.sub(start).scale(t));
        return position;
    }

}


export class CollisionDetection {
    static isMinkowskiFace(h1, h2, t1, t2) {
        // Given two halfedges, we ask if they construct
        // a Minkowski face. Due to the duality of Minowski
        // Sum and Gauss map overlays, we conclude that
        // two edges build a Minkowski face iff their
        // respective arcs on the unit sphere intersect.
        // An intersection between two lines occurs iff
        // the vertices of one lines lay on different sides of
        // the other line. We can use the plane equation to
        // determine the side of the point. Consider:
        // A, B - normals of halfedge 1 (normals are vertices in gauss map)
        // C, D - halfedge 2 (since we actually care for minkowski diff, we will use -C, -D)
        // AB and CD intersect iff:
        //   1. A, B lie on different sides of the plane given by DxC (cross)
        //   2. C, D lie on different sides of AxB
        // Since we deal with great arcs and not straight lines, 
        // we also need to make sure that the arcs are on the same hemisphere.
        // We verify this by making sure that, given a point from line 1 and a point from line 2,
        // both points are on the same side of the plane given by the cross product
        // of the remaining points. w.l.t we check:
        // B, D lie on the same side of the plane given by AxC
        // This function does just that, but also simplifies the algebera to avoid calculations.
        const a = t1.multiplyPoint(h1.face.GetFaceNormal()).toVector();
        const b = t1.multiplyPoint(h1.twin.face.GetFaceNormal()).toVector();
        const c = t2.multiplyPoint(h2.face.GetFaceNormal().neg()).toVector();
        const d = t2.multiplyPoint(h2.twin.face.GetFaceNormal().neg()).toVector();

        const bXa = b.crossProduct(a);
        const dXc = d.crossProduct(c);

        const cDotBA = c.dotProduct(bXa);
        const dDotBA = d.dotProduct(bXa);
        const aDotDC = a.dotProduct(dXc);
        const bDotDC = b.dotProduct(dXc);

        const areOnDifferentSides = cDotBA * dDotBA < 0 && aDotDC * bDotDC < 0;
        const isSameHemisphere = cDotBA * bDotDC > 0;
        return areOnDifferentSides && isSameHemisphere;

    }
    static DoOverlapOnAxis(axis, s1, s2, t1 = Matrix.identity, t2 = Matrix.identity) {
        axis = axis.normalize();
        let i1 = s1.projectOnAxis(axis, t1);
        let i2 = s2.projectOnAxis(axis, t2);
        return Interval.areOverlapping(i1, i2);
    }

    static GetOverlapOnAxis(axis, s1, s2, t1 = Matrix.identity, t2 = Matrix.identity) {
        axis = axis.normalize();
        let i1 = s1.projectOnAxis(axis, t1);
        let i2 = s2.projectOnAxis(axis, t2);
        return Interval.getOverlap(i1, i2);
    }

    static GetEdgeAxis(edge1, edge2, e1_centeroid, t1 = Matrix.identity, t2 = Matrix.identity) {
        let e1World = t1.multiplyVector(edge1.getDirection());
        let e2World = t2.multiplyVector(edge2.getDirection());
        let axis = e1World.crossProduct(e2World).normalize();
        let e1_center_world = new Vector(...t1.multiplyPoint(e1_centeroid).toArray());
        let vec_to_e1_center = e1_center_world.sub(edge1.origin.position);
        if (vec_to_e1_center.dotProduct(axis) < 0.0) {
            axis = axis.neg();
        }
        return axis;
    }

    static BooleanSAT(s1, s2, t1 = Matrix.identity, t2 = Matrix.identity) {
        for (let face of s1.faces) {
            let axis = t1.multiplyVector(face.GetFaceNormal(s1.centroid));
            if (!this.DoOverlapOnAxis(axis, s1, s2, t1, t2)) {
                return true;
            }
        }
        for (let face of s2.faces) {
            let axis = t2.multiplyVector(face.GetFaceNormal(s2.centroid));
            if (!this.DoOverlapOnAxis(axis, s1, s2, t1, t2)) {
                return true;
            }
        }
        for (let edge1 of s1.halfEdges) {
            for (let edge2 of s2.halfEdges) {
                let axis = this.GetEdgeAxis(edge1, edge2, s1.centroid, t1, t2);
                if (!this.isMinkowskiFace(edge1, edge2, t1, t2)) {
                    // Irrelevant, continue searching
                    continue;
                }
                if (!this.DoOverlapOnAxis(axis, s1, s2, t1, t2)) {
                    return true;
                }
            }
        }
        return false;
    }

    static QueryFaceDirection(s1, s2, t1, t2) {
        let info = new CollisionInfo();
        for (let face of s1.faces) {
            let axis = t1.multiplyVector(face.GetFaceNormal(s1.centroid)).normalize();
            let overlap = this.GetOverlapOnAxis(axis, s1, s2, t1, t2);
            let plane = Plane.FromNormalAndPoint(
                axis,
                t1.multiplyPoint(face.edge.origin.position)
            );

            let supportS2 = s2.getSupport(axis.neg(), t2);
            let distance = plane.GetPointDistance(supportS2);
            if (overlap == null) {
                return { result: true, info: null };
            }
            if (distance > info.distance) {
                info.distance = distance;
                info.depth = -distance;
                info.normal = axis;
                info.incidentFace = face;
                continue;
            }
            if (distance >= 0.0) {
                continue;
            }
            let length = overlap.length();
            if (length < info.depth) {
                info.distance = distance;
                info.depth = length;
                info.normal = axis;
                info.incidentFace = face;
            }
        }
        return { result: false, info: info };
    }

    static SATEx(s1, s2, t1 = Matrix.identity, t2 = Matrix.identity) {
        let info = new CollisionInfo();

        let { result: hull1FaceResult, info: hull1FaceInfo } = this.QueryFaceDirection(s1, s2, t1, t2);
        if (hull1FaceResult) return { result: true, info: null };
        if (hull1FaceInfo.depth < info.depth) {
            info = hull1FaceInfo;
            info.incidentHull = 1;
        }
        let { result: hull2FaceResult, info: hull2FaceInfo } = this.QueryFaceDirection(s2, s1, t2, t1);
        if (hull2FaceResult) return { result: true, info: null };
        if (hull2FaceInfo.depth < info.depth) {
            info = hull2FaceInfo;
            info.incidentHull = 2;
        }

        for (let edge1 of s1.halfEdges) {
            for (let edge2 of s2.halfEdges) {
                let axis = this.GetEdgeAxis(edge1, edge2, s1.centroid, t1, t2).normalize();
                let overlap = this.GetOverlapOnAxis(axis, s1, s2, t1, t2);
                if (!this.isMinkowskiFace(edge1, edge2, t1, t2)) {
                    // Irrelevant, continue searching
                    continue;
                }
                if (overlap == null) {
                    return { result: true, info: null };
                }
                let e1_origin_world = t1.multiplyPoint(edge1.origin.position);
                let plane = Plane.FromNormalAndPoint(axis, e1_origin_world);
                let e2_origin_world = t2.multiplyPoint(edge2.origin.position);
                let distance = plane.GetPointDistance(e2_origin_world);
                if (distance >= 0.0) {
                    continue;
                }
                let length = overlap.length();
                if (length < info.depth) {
                    info.witnessEdge1 = edge1;
                    info.witnessEdge2 = edge2;
                    info.depth = length;
                    info.normal = axis;
                    info.faceContact = false;
                }
            }
        }
        return { result: false, info: info };
    }
}

export class CollisionInfo {
    constructor() {
        this.normal = null;
        this.distance = -Infinity;
        this.depth = Number.MAX_VALUE;
        this.incidentFace = null;
        this.incidentHull = 0;
        this.referenceFace = null;
        this.witnessEdge1 = null;
        this.witnessEdge2 = null;
        this.faceContact = true;
    }
}
