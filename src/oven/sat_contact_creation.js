let [separating, info] = CollisionDetection.SATEx(dcel, dcel, s1.transform.localToWorldMatrix, s2.transform.localToWorldMatrix);
text.text = separating ? "N/A" : info.depth.toString();
text.color = separating ? Color.green : Color.red;

if (separating) return;
// Draw axis normal from s1
// Draw face normal
Gizmos.color = Color.yellow;
Gizmos.DrawLine(
    transform.TransformPoint(dcel.centroid),
    transform.TransformPoint(dcel.centroid.add(info.normal.Value.multiply(10)))
);

if(!info.faceContact) {
    // Generate edge contact
    let witnessEdge1Transform = s1.transform.localToWorldMatrix;
    let witnessEdge2Transform = s2.transform.localToWorldMatrix;
    info.witnessEdge1.OnDrawGizmos(s1.transform, Color.yellow);
    info.witnessEdge2.OnDrawGizmos(s2.transform, Color.yellow);
    let closestPoints = HalfEdge.GetClosestPoints(info.witnessEdge1, witnessEdge1Transform, info.witnessEdge2, witnessEdge2Transform);
    DrawAllVertices(closestPoints, Color.red, "Closest Points");
    return;
}

// Clip
// We clip the incident face with the reference face
// along the best axis
let incidentFace = info.incidentFace;
let incidentGO = info.incidentHull === 1 ? s1 : s2;
let incidentTransform = incidentGO.transform.localToWorldMatrix;
let incidentHull = dcel; // from s2

let referenceHull = dcel; // from s1
let referenceGO = info.incidentHull === 1 ? s2 : s1;
let referenceTransform = referenceGO.transform.localToWorldMatrix;
// Find most anti-parallel face
let dotMin = Number.MAX_VALUE;
let incidentNormal = incidentTransform.MultiplyVector(incidentFace.GetFaceNormal(incidentHull.centroid));
for (let candidate of referenceHull.faces) {
    let candidateNormal = referenceTransform.MultiplyVector(candidate.GetFaceNormal(referenceHull.centroid));
    let dot = Vector3.Dot(candidateNormal, incidentNormal);
    if (dotMin > dot) {
        info.referenceFace = candidate;
        dotMin = dot;
    }
}

let referenceFace = info.referenceFace;

let result = referenceFace.GetVertices(referenceTransform);
DrawAllVertices(incidentFace.GetVertices(incidentTransform), Color.red, "Incident");
DrawAllVertices(result, Color.green, "Reference");
if (clipStepsCounts === 0) return;
let firstIncidentEdge = incidentFace.edge;
let currentIncidentEdge = firstIncidentEdge;
let stepsPerformed = 0;
do {
    let clippingFace = currentIncidentEdge.twin.face;
    // Draw clipping plane
    DrawAllVertices(clippingFace.GetVertices(incidentTransform), Color.blue, "Clip");
    // Draw last state
    DrawAllVertices(result, Color.green, "Reference");
    // Draw next state
    result = Face.ClipAgainstFace(result, clippingFace, incidentTransform, dcel.centroid);
    currentIncidentEdge = currentIncidentEdge.next;
} while (currentIncidentEdge !== firstIncidentEdge && clipStepsCounts > ++stepsPerformed);
// result = referenceFace.ClipSelfAgainstFace(incidentFace/*subject*/, s2.transform.localToWorldMatrix/*subject*/, s1.transform.localToWorldMatrix /*incident*/);
DrawAllVertices(result, Color.yellow);
// Now we can draw the clipped face