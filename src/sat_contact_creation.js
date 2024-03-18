import { Face, HalfEdge } from "./halfmesh.js";
import { Matrix } from "./math.js";

const debugDrawEdge = (debugRenderer, edge, transform, color) => {
    if (!debugRenderer) return;
    debugRenderer.drawPath(
        edge.getVertices(),
        transform,
        color);
}

const drawAllVertices = (debugRenderer, vertices, color) => {
    if (!debugRenderer) return;
    vertices.forEach(vert => debugRenderer.drawPoint(vert, false, Matrix.identity, color));
}

const drawFace = (debugRenderer, face, color, transform = Matrix.identity) => {
    if (!debugRenderer) return;
    // Disable backface culling
    debugRenderer.backfaceCulling = false;
    debugRenderer.drawPath(
        face.getVertices(),
        transform,
        color,
        false);
    // Enable backface culling
    debugRenderer.backfaceCulling = true;
}

export function createContacts(s1, s2, s1World, s2World, info, debugRenderer = null, clipStepsCount = 0) {
    // Draw axis normal from s1
    // Draw face normal
    if (debugRenderer) {
        debugRenderer.drawPath(
            [s1World.multiplyPoint(s1.centroid),
            s1World.multiplyPoint(s1.centroid.add(info.normal.scale(10)))],
            Matrix.identity,
            "yellow");
    }

    if (!info.faceContact) {
        // Generate edge contact
        let witnessEdge1Transform = s1World;
        let witnessEdge2Transform = s2World;

        debugDrawEdge(debugRenderer, info.witnessEdge1, witnessEdge1Transform, "yellow");
        debugDrawEdge(debugRenderer, info.witnessEdge2, witnessEdge2Transform, "green");
        let closestPoints = HalfEdge.getClosestPoints(info.witnessEdge1, witnessEdge1Transform, info.witnessEdge2, witnessEdge2Transform);
        drawAllVertices(debugRenderer, closestPoints, "red");
        return closestPoints;
    }

    // Clip
    // We clip the incident face with the reference face
    // along the best axis
    let incidentFace = info.incidentFace;
    let incidentTransform = info.incidentHull === 1 ? s1World : s2World;
    let incidentHull = s2; // from s2

    let referenceHull = s1; // from s1
    let referenceTransform = info.incidentHull === 1 ? s2World : s1World;

    // Find most anti-parallel face
    let dotMin = Number.MAX_VALUE;
    let incidentNormal = incidentTransform.multiplyVector(incidentFace.GetFaceNormal(incidentHull.centroid));
    for (let candidate of referenceHull.faces) {
        let candidateNormal = referenceTransform.multiplyVector(candidate.GetFaceNormal(referenceHull.centroid));
        let dot = candidateNormal.dotProduct(incidentNormal);
        if (dotMin > dot) {
            info.referenceFace = candidate;
            dotMin = dot;
        }
    }

    let referenceFace = info.referenceFace;

    let result = referenceFace.getVertices(referenceTransform);
    // Incident Face
    drawFace(
        debugRenderer,
        incidentFace,
        "red",
        incidentTransform);
    // Reference Face
    drawFace(
        debugRenderer,
        referenceFace,
        "green",
        referenceTransform);

    if (clipStepsCount === 0) return;

    let firstIncidentEdge = incidentFace.edge;
    let currentIncidentEdge = firstIncidentEdge;
    let stepsPerformed = 0;
    do {
        let clippingFace = currentIncidentEdge.twin.face;
        // Draw clipping plane
        drawFace(debugRenderer, clippingFace, "blue", incidentTransform);
        // Draw last state
        drawAllVertices(debugRenderer, result, "green");
        // Advance to next state
        result = Face.clipAgainstFace(result, clippingFace, incidentTransform, s1.centroid);
        currentIncidentEdge = currentIncidentEdge.next;
    } while (currentIncidentEdge !== firstIncidentEdge && clipStepsCount > ++stepsPerformed);
    // result = referenceFace.ClipSelfAgainstFace(incidentFace/*subject*/, s2World/*subject*/, s1World /*incident*/);
    // DrawAllVertices(result, Color.yellow);
    return result;
    // Now we can draw the clipped face
}
