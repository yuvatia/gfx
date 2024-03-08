import { Vector, Matrix, Point } from './math.js';

class Interval {
    constructor(min, max) {
        this.min = min;
        this.max = max;
    }

    static areOverlapping(a, b) {
        return (b.min <= a.max) && (a.min <= b.max);
    }

    static getOverlap(a, b) {
        if (!Interval.areOverlapping(a, b)) return null;
        return new Interval(
            Math.max(a.min, b.min),
            Math.min(a.max, b.max)
        );
    }

    length() {
        return this.max - this.min;
    }
}

class Vertex {
    constructor(pos) {
        this.position = new Vector(pos.x, pos.y, pos.z);
        this.incidentEdge = null;
    }

    onDrawGizmos(transform) {
        // TODO: Implement onDrawGizmos functionality
        // Gizmos.color = Color.green;
        // Gizmos.DrawSphere(transform.TransformPoint(position), 0.05f);
    }
}

class HalfEdge {
    constructor(v) {
        this.twin = null;
        this.next = null;
        this.prev = null;
        this.origin = v;
        this.face = null;
    }

    onDrawGizmos(transform, color = null) {
        // TODO: Implement onDrawGizmos functionality
        // Gizmos.color = color || Color.red;
        // Gizmos.DrawLine(
        //     transform.TransformPoint(origin.position),
        //     transform.TransformPoint(next.origin.position)
        // );
    }

    getDirection() {
        return this.next.origin.position.sub(this.origin.position);
    }

    getLength() {
        return this.getDirection().magnitude();
    }

    static getDistance(a, aToWorld, b, bToWorld) {
        const n = aToWorld.multiplyVector(a.getDirection().crossProduct(bToWorld.multiplyVector(b.getDirection())));
        const distance = Math.abs(a.origin.position.sub(b.origin.position).dotProduct(n));
        return distance;
    }

    static getClosestPoints(a, aToWorld, b, bToWorld) {
        const p1 = aToWorld.multiplyPoint(a.origin.position);
        const p2 = bToWorld.multiplyPoint(b.origin.position);
        const d1 = aToWorld.multiplyVector(a.getDirection());
        const d2 = bToWorld.multiplyVector(b.getDirection());
        const n = d1.crossProduct(d2);
        const n1 = d1.crossProduct(n);
        const n2 = d2.crossProduct(n);

        const closestA = p1.add(p2.sub(p1).dotProduct(n2) / d1.dotProduct(n2)).multiply(d1);
        const closestB = p2.add(p1.sub(p2).dotProduct(n1) / d2.dotProduct(n1)).multiply(d2);

        return [closestA, closestB];
    }
}

class Face {
    constructor() {
        this.edge = null;
    }

    getVertices(transform = Matrix.identity) {
        const vertices = [];
        let start = this.edge;
        let current = this.edge;
        do {
            const pos = transform.multiplyPoint(
                new Point(...current.origin.position.toArray())
            );
            vertices.push(pos);
            current = current.next;
        } while (current !== start);
        return vertices;
    }

    onDrawGizmos(transform) {
        // TODO: Implement onDrawGizmos functionality
        // HalfEdge start = edge;
        // HalfEdge current = edge;
        // do {
        //     current.OnDrawGizmos(transform);
        //     current = current.next;
        // } while (current !== start);
        // Gizmos.color = Color.blue;
        // Vector3 centroid = GetFaceCenter();
        // Gizmos.DrawLine(
        //     transform.TransformPoint(centroid),
        //     transform.TransformPoint(centroid + GetFaceNormal(centroid))
        // );
    }

    GetFaceCenter() {
        let start = this.edge;
        let current = this.edge;
        let center = new Vector(0, 0, 0);
        let count = 0;
        do {
            center += current.origin.position;
            current = current.next;
            count++;
        } while (current != start);
        center = center.scale(1 / count);
        return center;
    }

    // Default to centered at origin
    GetFaceNormal(centroid = Vector.zero) {
        // Get face normal by calculating the cross
        // product of two edges on the face.
        // Then, make sure it is aimed outwards
        // by checking the dot product with
        // a point outside the shape,
        // calculated by taking the centroid + a vertex
        // on the boundary (on the face), then
        // negate normal if necessary
        let normal = this.edge.getDirection().crossProduct(this.edge.next.getDirection()).normalize();

        // var outsidePoint = edge.origin.position + (edge.origin.position - centroid);
        var outsidePoint = this.edge.origin.position.sub(centroid);
        if (outsidePoint.dotProduct(normal) < 0.0) {
            // Flip normal
            normal = normal.scale(-1);
        }

        return normal;
    }
}

class DCELRepresentation {
    constructor() {
        this.vertices = [];
        this.halfEdges = [];
        this.faces = [];
        this.centroid = new Vector(0, 0, 0);
    }

    getSupport(direction, transform = Matrix.identity) {
        let maxDot = -Infinity;
        let support = null;

        this.vertices.forEach(vertex => {
            const dot = vertex.position.dotProduct(direction);
            if (dot > maxDot) {
                maxDot = dot;
                support = vertex.position;
            }
        });

        return transform.multiplyPoint(new Point(...support.toArray()));
    }

    projectOnAxis(axis, transform = Matrix.identity) {
        // TODO: the better idea would be to transform
        // the axis to local space

        // We iterate over all the vertices and find the minimum.
        // Alternatively, we could just use the symmetry of the
        // shape and only project the center then add extent.
        // This is the general case so we won't make any assumptions.

        // Assuming extent
        // float extent = 1;
        // var projection = Vector3.Dot(effectiveTransform.MultiplyPoint(centroid), axis);
        // return new Interval() { min = projection - extent, max = projection + extent };

        let minProjection = Infinity;
        let maxProjection = -Infinity;

        this.vertices.forEach(vertex => {
            const effectivePosition = transform.multiplyPoint(vertex.position.toPoint()).toVector();
            const projection = effectivePosition.dotProduct(axis);
            minProjection = Math.min(minProjection, projection);
            maxProjection = Math.max(maxProjection, projection);
        });

        return new Interval(minProjection, maxProjection);
    }

    static fromSimpleMesh(mesh) {
        const dcel = new DCELRepresentation();

        // Create vertices
        dcel.vertices = mesh.getVertices().map(pos => new Vertex(new Vector(...pos)));

        // Calculate centroid
        dcel.centroid = Vector.zero;
        dcel.vertices.forEach(vertex => {
            dcel.centroid = dcel.centroid.add(vertex.position);
        });
        dcel.centroid = dcel.centroid.scale(1 / dcel.vertices.length);

        // Create half edges and faces
        let halfEdgeIndex = 0;
        let lastIndex = 0;
        mesh.getFaces().forEach(faceIndices => {
            const face = new Face();
            dcel.faces.push(face);

            lastIndex = halfEdgeIndex;

            faceIndices.forEach(vertIndex => {
                const halfEdge = new HalfEdge(dcel.vertices[vertIndex]);
                dcel.halfEdges.push(halfEdge);
                halfEdgeIndex++;
            });

            for (let j = lastIndex; j < halfEdgeIndex; j++) {
                const nextIndex = (j + 1 - lastIndex) % faceIndices.length + lastIndex;
                const prevIndex = (j - 1 + faceIndices.length - lastIndex) % faceIndices.length + lastIndex;

                dcel.halfEdges[j].next = dcel.halfEdges[nextIndex];
                dcel.halfEdges[j].prev = dcel.halfEdges[prevIndex];
                dcel.halfEdges[j].face = face;

                if (!face.edge) {
                    face.edge = dcel.halfEdges[j];
                }
            }
        });

        // Connect twin halfedges
        for (let i = 0; i < dcel.halfEdges.length; i++) {
            const current = dcel.halfEdges[i];
            if (!current.twin) {
                for (let j = i + 1; j < dcel.halfEdges.length; j++) {
                    const candidate = dcel.halfEdges[j];
                    if (current.origin === candidate.next.origin && current.next.origin === candidate.origin) {
                        current.twin = candidate;
                        candidate.twin = current;
                        break;
                    }
                }
            }
        }
        // Sanity check
        dcel.halfEdges.forEach(he => {
            if (!he.twin) {
                console.error(`Halfedge at origin ${he.origin.position} has no twin`);
            }
        });

        return dcel;
    }
}

export { Interval, Vertex, HalfEdge, Face, DCELRepresentation };
