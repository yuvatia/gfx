import { Vector } from "./math.js";

export class MeshFilter {
    meshRef = null;
}
export class Material {
    diffuseColor = "white";
    faceColoring = false;
}
export class MeshRenderer {
    shading = true;
    wireframe = null; // Default to global settings
    writeIdToStencil = true; // Writes entityId to stencil for mousepicking
    static default = new MeshRenderer();
}
export class DirectionalLight {
    color = "white";
    intensity = 0.02;
    direction = new Vector(0, 0.5, -1).normalize();
}
