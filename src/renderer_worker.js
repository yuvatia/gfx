self.onmessage = function (event) {
    const { face, modelMatrix, material, entityId, renderPrefs, i } = event.data;
    const colorNames = [
        "blue",
        "red",
        "green",
        "yellow",
        "purple",
        "pink"
    ]

    const faceVerts = face.getVertices();
    const faceNormal = face.GetFaceNormal();
    let worldNormal = modelMatrix.multiplyVector(faceNormal).normalize();

    let finalDiffuse =
        material.faceColoring ? colorNames[i % colorNames.length] : material.diffuse;
    if (renderPrefs.shading) {
        for (let directionalLight of renderPrefs.directionalLightSources) {
            const lightDirection = directionalLight.direction;
            const lightColor = directionalLight.color;
            const lightIntensity = directionalLight.intensity;

            let brightness = lightIntensity * Math.max(lightDirection.dotProduct(worldNormal), 0);
            const combinedColor = new Vector(
                lightColor.x * material.diffuse.x,
                lightColor.y * material.diffuse.y,
                lightColor.z * material.diffuse.z);

            finalDiffuse = combinedColor.scale(brightness);
        }
    }
    finalDiffuse =
        typeof finalDiffuse === 'string' ?
            finalDiffuse :
            `rgba(${finalDiffuse.x}, ${finalDiffuse.y}, ${finalDiffuse.z}, ${material.faceColoring ? 1 : material.diffuse.w})`;

    let outlineColor = finalDiffuse;
    if (renderPrefs.outline) {
        outlineColor = "red";
    }

    const stencilId = renderPrefs.writeIdToStencil ? `rgba(${(entityId >> 16) & 0xFF}, ${(entityId >> 8) & 0xFF}, ${entityId & 0xFF}, 1)` : null;

    const result = {
        path: faceVerts,
        transform: modelMatrix,
        color: finalDiffuse,
        overrideFillWithWireframeValue: renderPrefs.wireframe,
        applyPerspectiveDivision: true,
        drawPoints: false,
        stencilID: stencilId,
        outlineColor: outlineColor
    };

    self.postMessage(result);
};