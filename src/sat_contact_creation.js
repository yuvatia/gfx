import { Face, HalfEdge } from "./halfmesh.js";

export function createContacts(s1, s2, s1World, s2World, info) {
    // // Draw axis normal from s1
    // // Draw face normal
    // Gizmos.color = Color.yellow;
    // Gizmos.DrawLine(
    //     transform.TransformPoint(s1.centroid),
    //     transform.TransformPoint(s1.centroid.add(info.normal.Value.multiply(10)))
    // );

    if (!info.faceContact) {
        // Generate edge contact
        let witnessEdge1Transform = s1World;
        let witnessEdge2Transform = s2World;
        // info.witnessEdge1.OnDrawGizmos(s1.transform, Color.yellow);
        // info.witnessEdge2.OnDrawGizmos(s2.transform, Color.yellow);
        let closestPoints = HalfEdge.getClosestPoints(info.witnessEdge1, witnessEdge1Transform, info.witnessEdge2, witnessEdge2Transform);
        // DrawAllVertices(closestPoints, Color.red, "Closest Points");
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
    // DrawAllVertices(incidentFace.getVertices(incidentTransform), Color.red, "Incident");
    // DrawAllVertices(result, Color.green, "Reference");
    // if (clipStepsCounts === 0) return;
    const clipStepsCounts = 50; // TODO remove
    let firstIncidentEdge = incidentFace.edge;
    let currentIncidentEdge = firstIncidentEdge;
    let stepsPerformed = 0;
    do {
        let clippingFace = currentIncidentEdge.twin.face;
        // Draw clipping plane
        // DrawAllVertices(clippingFace.GetVertices(incidentTransform), Color.blue, "Clip");
        // Draw last state
        // DrawAllVertices(result, Color.green, "Reference");
        // Draw next state
        result = Face.clipAgainstFace(result, clippingFace, incidentTransform, s1.centroid);
        currentIncidentEdge = currentIncidentEdge.next;
    } while (currentIncidentEdge !== firstIncidentEdge && clipStepsCounts > ++stepsPerformed);
    // result = referenceFace.ClipSelfAgainstFace(incidentFace/*subject*/, s2World/*subject*/, s1World /*incident*/);
    // DrawAllVertices(result, Color.yellow);
    return result;
    // Now we can draw the clipped face
}
