import { Vector, Point } from './math.js';

export class Cube {
    constructor() {
        this.vertices = [
            // Define the cube's vertices here
            // Each vertex is represented by an array of three coordinates (x, y, z)
            // For a unit cube, the coordinates range from -0.5 to 0.5
            [-0.5, -0.5, -0.5], // Vertex 0
            [0.5, -0.5, -0.5],  // Vertex 1
            [0.5, 0.5, -0.5],   // Vertex 2
            [-0.5, 0.5, -0.5],  // Vertex 3
            [-0.5, -0.5, 0.5],  // Vertex 4
            [0.5, -0.5, 0.5],   // Vertex 5
            [0.5, 0.5, 0.5],    // Vertex 6
            [-0.5, 0.5, 0.5]    // Vertex 7
        ];

        this.faces = [
            // Define the cube's faces here
            // Each face is represented by an array of indices to the vertices array
            // The order of the indices determines the face's vertices' order
            [0, 1, 2, 3], // Face 0 (front)
            [1, 5, 6, 2], // Face 1 (right)
            [5, 4, 7, 6], // Face 2 (back)
            [4, 0, 3, 7], // Face 3 (left)
            [3, 2, 6, 7], // Face 4 (top)
            [4, 5, 1, 0]  // Face 5 (bottom)
        ];
    }

    getVertices() {
        return this.vertices;
    }

    isInwards(origin, direction) {
        // Let origin, direction define the vector V originating at point P
        // Let O be the center of the shape
        // PV is directed outwards iff dotProduct(OP, PV) < 0
        // Since the cube is centered at the origin, this
        // actually amounts to P * (V - P) = PV - PP < 0
        return origin.dotProduct(direction.sub(origin)) < 0;
    }

    getFaceNormal(i) {
        let face = this.faces[i];
        // Assume face.length >= 3
        let A = new Vector(...this.vertices[face[0]]);
        let B = new Vector(...this.vertices[face[1]]);
        let C = new Vector(...this.vertices[face[2]]);
        let AB = B.sub(A);
        let AC = C.sub(A);
        let normal = AB.crossProduct(AC).normalize();
        let shouldFlip = this.isInwards(A, normal);
        return shouldFlip ? normal.neg() : normal;
    }
    
    getFaces() {
        return this.faces;
    }
}
