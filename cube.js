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

    getFaces() {
        return this.faces;
    }
}
