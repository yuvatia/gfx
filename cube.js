import { Vector, Point } from './math.js';

export class Mesh {
    constructor(vertices, faces) {
        this.vertices = vertices;
        this.faces = faces;
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

export class Cube extends Mesh {
    constructor() {
        // Vertices:
        // 0 -> (-1, -1, -1);
        // 1 -> (1, -1, -1);
        // 2 -> (-1, 1, -1);
        // 3 -> (1, 1, -1);
        // 4 -> (-1, -1, 1);
        // 5 -> (1, -1, 1);
        // 6 -> (-1, 1, 1);
        // 7 -> (1, 1, 1);
        let vertices = []
        for (let i = 0; i < 8; i++) {
            vertices.push([
                (i & 1) == 0 ? -0.5 : 0.5,
                (i & 2) == 0 ? -0.5 : 0.5,
                (i & 4) == 0 ? -0.5 : 0.5
            ]);
        }

        // Orientation guarantees each halfedge
        // will have a twin
        let faces = [
            // Front Face (CCW)
            [0, 1, 3, 2],

            // Back Face (CCW)
            [4, 6, 7, 5],

            // Top Face (CCW)
            [2, 3, 7, 6],

            // Bottom Face (CCW)
            [0, 4, 5, 1],

            // Left Face (CCW)
            [0, 2, 6, 4],

            // Right Face (CCW)
            [1, 5, 7, 3]
        ];

        // Call super
        super(vertices, faces);

    }
    constructor_old() {
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
}

export class Icosahedron extends Mesh {
    constructor() {
        const X = 0.5257311121191336;
        const Z = 0.8506508083520399;
        const N = 0;

        const vertices = [
            [-X, N, Z], [X, N, Z], [-X, N, -Z], [X, N, -Z],
            [N, Z, X], [N, Z, -X], [N, -Z, X], [N, -Z, -X],
            [Z, X, N], [-Z, X, N], [Z, -X, N], [-Z, -X, N]
        ];

        const triangles = [
            [0, 4, 1], [0, 9, 4], [9, 5, 4], [4, 5, 8], [4, 8, 1],
            [8, 10, 1], [8, 3, 10], [5, 3, 8], [5, 2, 3], [2, 7, 3],
            [7, 10, 3], [7, 6, 10], [7, 11, 6], [11, 0, 6], [0, 1, 6],
            [6, 1, 10], [9, 0, 11], [9, 11, 2], [9, 2, 5], [7, 2, 11]
        ];

        super(vertices, triangles);
    }
}

function vertexForEdge(lookup, vertices, first, second) {
    let key = first < second ? `${first},${second}` : `${second},${first}`;
    
    if (!lookup.has(key)) {
        let edge0 = vertices[first];
        let edge1 = vertices[second];
        let point = edge0.map((coord, index) => (coord + edge1[index]) / 2);
        let pointMagnitude = Math.sqrt(point.reduce((sum, coord) => sum + coord ** 2, 0));
        let normalizedPoint = point.map(coord => coord / pointMagnitude);
        vertices.push(normalizedPoint);
        lookup.set(key, vertices.length - 1);
    }
    
    return lookup.get(key);
}

function subdivide(vertices, triangles) {
    let lookup = new Map();
    let result = [];
    
    triangles.forEach(triangle => {
        let mid = [0, 1, 2].map(edge => vertexForEdge(lookup, vertices, triangle[edge], triangle[(edge + 1) % 3]));
        
        result.push([triangle[0], mid[0], mid[2]]);
        result.push([triangle[1], mid[1], mid[0]]);
        result.push([triangle[2], mid[2], mid[1]]);
        result.push(mid);
    });
    
    return result;
}

export function makeIcosphere(subdivisions = 0) {
    let icosahedron = new Icosahedron();
    let vertices = icosahedron.getVertices().slice();
    let triangles = icosahedron.getFaces().slice();
    
    for (let i = 0; i < subdivisions; i++) {
        triangles = subdivide(vertices, triangles);
    }

    // Fix winding order to be CCW
    triangles = triangles.map(triangle => {
        let a = new Vector(...vertices[triangle[0]]);
        let b = new Vector(...vertices[triangle[1]]);
        let c = new Vector(...vertices[triangle[2]]);
        let normal = b.sub(a).crossProduct(c.sub(a));
        if (normal.dotProduct(a) < 0) {
            return [triangle[0], triangle[2], triangle[1]];
        }
        return triangle;
    });
    
    return new Mesh(vertices, triangles);
}
