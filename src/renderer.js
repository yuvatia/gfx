import { Vector, Matrix } from "./math.js";
import { Camera } from "./camera.js";
import { createTranslationMatrix, createaAxisAngleRotationMatrix, CreatePerspectiveProjection, CreateSymmetricOrthographicProjection, invertTranslation } from "./affine.js";
import { DirectionalLight, Material, MeshFilter, MeshRenderer } from "./components.js";
import { Transform } from "./transform.js";
import { DCELRepresentation } from "./halfmesh.js";
import { Cube, Mesh } from "./geometry.js";
import { MeshAsset } from "../asset.js";

export class RendererPrefrences {
    constructor() {
        this.backfaceCulling = true;
        this.shadingEnabled = true;
        this.perspectiveClipEnabled = true;

        // this.clearColors = "rgba(0, 0, 255, 0.1)";
        this.clearColors = "transparent";

        this.wireframeMode = false;
    }

    static default = new RendererPrefrences();
}

export class Renderer {
    static BufferType = {
        COLOR: "color",
        STENCIL: "stencil",
        DEPTH: "depth"
    }

    constructor(
        colorCanvas, stencilCanvas, depthCanvas,
        preferences = RendererPrefrences.default,
        sceneCamera = new Camera()) {
        this.preferences = preferences;

        this.canvas = colorCanvas;
        this.ctx = this.canvas.getContext("2d");
        this.stencilBuffer = stencilCanvas;
        this.depthBuffer = depthCanvas;
        this.canvasTranslation = new Vector(0, 0, 0);

        this.camera = sceneCamera;

        // Stencil: set default value of rgba(0, 0, 255, 1) for all pixels, that way we pick the camera
        // when not picking an entity
        this.stencilClearColors = "rgba(0, 0, 255, 1)";

        this.onViewportResize();
    }

    getName() {
        return 'Renderer';
    }
    
    worldToEye(point) {
        // return point;
        const eyeSpace = this.camera.getViewMatrix().multiplyPoint(point);
        return eyeSpace;
    }

    eyeToClip(point) {
        return this.camera.getProjectionMatrix().multiplyPoint(point);
    }

    perspectiveDivision(point) {
        return point.multiply(1 / point.w);
    }

    tempIsPointInFrustum(clipSpacePoint) {
        return Math.abs(clipSpacePoint.x) <= clipSpacePoint.w &&
            Math.abs(clipSpacePoint.y) <= clipSpacePoint.w &&
            Math.abs(clipSpacePoint.z) <= clipSpacePoint.w;
    }

    project3Dto2D(point, applyPerspectiveDivision = true) {
        const eyeSpace = this.worldToEye(point);
        const clipSpace = this.eyeToClip(eyeSpace);

        // Apply clipping against all 6 planes
        var clipSpace3 = [clipSpace.x, clipSpace.y, clipSpace.z];
        var w = clipSpace.w;
        if (this.preferences.perspectiveClipEnabled) {
            // if -w <= x, y, z <= w and w > 0, then inside viewing volume
            // See https://registry.khronos.org/OpenGL/specs/gl/glspec46.core.pdf
            // TODO handedness
            // if(!this.tempIsPointInFrustum(clipSpace)) {
            //     return null
            // }
            // console.log('shiat');
            if (w < 0) return null;
        }

        const ndc = applyPerspectiveDivision ? this.perspectiveDivision(clipSpace) : clipSpace;
        return ndc;
    }

    screenToNDC(screenX, screenY) {
        var ndcX = 2 * screenX / this.canvas.width; // - 1
        var ndcY = 2 * screenY / this.canvas.height; // - 1
        var zSquared = 1 - (ndcX * ndcX + ndcY * ndcY);
        var ndcZ = (zSquared) < 0 ? 0 : Math.sqrt(zSquared);
        return new Vector(
            ndcX,
            ndcY,
            ndcZ
        );
    }

    getBufferContent(type, x, y, width, height) {
        const typeToContext = (type) => {
            switch (type) {
                case Renderer.BufferType.COLOR:
                    return this.ctx;
                case Renderer.BufferType.STENCIL:
                    return this.stencilBufferCtx;
                case Renderer.BufferType.DEPTH:
                    return this.depthBufferCtx;
            }
        }
        return typeToContext(type).getImageData(x, y, width, height).data;
    }

    pickBufferPixelAtPosition(type, clientX, clientY) {
        const { x, y } = this.mouseToCanvas(clientX, clientY).add(this.canvasTranslation);
        return this.getBufferContent(type, x, y, 1, 1);
    }

    doArcballPrep(screenStart, screenEnd) {
        // If screenStart is within epsilon equals to screenEnd, return identity
        if (screenStart.equals(screenEnd)) {
            return Matrix.identity;
        }
        let v0 = this.screenToNDC(screenStart.x, screenStart.y).normalize();
        let v1 = this.screenToNDC(screenEnd.x, screenEnd.y).normalize();
        let theta = Math.acos(v0.dotProduct(v1));
        let thetaDegrees = theta * 180 / Math.PI;

        // axis is defined by cross product
        let axis = v0.crossProduct(v1).normalize();

        // TODO negated due to handedness issue perhaps?
        thetaDegrees = -thetaDegrees;
        let rotationMat = createaAxisAngleRotationMatrix(axis, thetaDegrees);
        return rotationMat;
    }

    onViewportResize() {
        // const [newWidth, newHeight] = [window.innerWidth, window.innerHeight];
        const [newWidth, newHeight] = [this.canvas.parentNode.clientWidth, this.canvas.parentNode.clientHeight];
        this.canvas.width = newWidth;
        this.canvas.height = newHeight;

        // Translate so that origin is in the middle
        this.canvasTranslation.x = this.canvas.width * 0.5;
        this.canvasTranslation.y = this.canvas.height * 0.5;
        this.ctx.translate(this.canvasTranslation.x, this.canvasTranslation.y);
        this.ctx.imageSmoothingQuality = "high";

        this.stencilBuffer.width = newWidth;
        this.stencilBuffer.height = newHeight;
        this.stencilBufferCtx = this.stencilBuffer.getContext("2d", { willReadFrequently: true });
        this.stencilBufferCtx.translate(this.canvasTranslation.x, this.canvasTranslation.y);

        this.depthBuffer.width = newWidth;
        this.depthBuffer.height = newHeight;
        this.depthBufferCtx = this.depthBuffer.getContext("2d");
        this.depthBufferCtx.translate(this.canvasTranslation.x, this.canvasTranslation.y);

        // Propagate event to camera
        this.camera.onResize(this.canvas.width, this.canvas.height);
    }

    mouseToCanvas(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        var factorX = this.canvas.width / rect.width;
        var factorY = this.canvas.height / rect.height;
        const xOffset = clientX - rect.left;
        const yOffset = clientY - rect.top;
        return new Vector(
            factorX * xOffset - this.canvas.width / 2,
            factorY * yOffset - this.canvas.height / 2,
            0
        );
        // old: offset - width * 0.5
    }

    saveCanvasState() {
        this.ctx.save();
        this.stencilBufferCtx.save();
        this.depthBufferCtx.save();
    }

    resetCanvasTransform() {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.stencilBufferCtx.setTransform(1, 0, 0, 1, 0, 0);
        this.depthBufferCtx.setTransform(1, 0, 0, 1, 0, 0);
    }

    restoreCanvasState() {
        this.ctx.restore();
        this.stencilBufferCtx.restore();
        this.depthBufferCtx.restore();
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.stencilBufferCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.stencilBufferCtx.fillStyle = this.stencilClearColors;
        this.stencilBufferCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);


        this.depthBufferCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    start(dt) {
        // Discard transform, draw grid, framerate and background
        this.saveCanvasState();
        this.resetCanvasTransform();

        this.clearCanvas();
        this.ctx.fillStyle = this.preferences.clearColors;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw text "FPS: (x, y)" in upper right corner
        // this.ctx.font = "bold 10px Arial";
        this.ctx.fillStyle = "black";
        // Convert dt to frameRate
        const frameRate = (1000 / dt);

        // this.drawXYGrid2D();
        this.ctx.fillText(`FPS: ${frameRate.toFixed(0)}`, this.canvas.width * 0.8, 20);
        this.ctx.fillText(`Camera: ${this.camera.transform.position.toString()}`, this.canvas.width * 0.5, 40);
        this.restoreCanvasState();
    }

    drawXYGrid2D(cellWidth = 10) {
        // Draws XY grid. cellWidth in pixels
        let determinePos = (x, y) => {
            return [x, y];
        };

        this.ctx.beginPath();
        this.ctx.strokeStyle = "rgba(211, 211, 211, 0.2)";
        this.ctx.lineWidth = 1;
        // Draws y lines
        for (let i = 0; i < this.canvas.width; i += cellWidth) {
            this.ctx.moveTo(...determinePos(i, 0));
            this.ctx.lineTo(...determinePos(i, this.canvas.height));
            this.ctx.stroke();
        }
        // Draws x lines
        for (let i = 0; i < this.canvas.height; i += cellWidth) {
            this.ctx.moveTo(...determinePos(0, i));
            this.ctx.lineTo(...determinePos(this.canvas.width, i));
            this.ctx.stroke();
        }
    }

    determineXY(p, transform = new Matrix(), applyPerspectiveDivision = true) {
        const worldSpace = transform.multiplyPoint(p);
        const clipSpace = this.project3Dto2D(worldSpace, applyPerspectiveDivision);
        // return worldSpace;
        return clipSpace;
    }

    drawText(x, y, text, lineHeight = 10, style = "black", font = "12px arial") {
        const lines = text.split('\n');
        this.ctx.fillStyle = style;
        this.ctx.font = font;

        lines.forEach((line, index) => {
            this.ctx.fillText(line, x, y + index * lineHeight);
        });
    };

    drawPoint(p, debugDraw = false, transform = new Matrix(), color = "black") {
        let screenPoint = this.determineXY(p, transform);
        if (screenPoint === null) return;

        const [x, y, z] = screenPoint.toArray();
        this.ctx.beginPath();
        this.ctx.arc(x, y, 3, 0, Math.PI * 2);
        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.stroke();

        if (!debugDraw) return;
        this.drawText(x, y, `(${x}, ${y})`, 10, color);
        // this.drawText(x, y, transform.toString(), 10, color);
    }

    drawPath(
        path,
        transform = new Matrix(),
        color = "black",
        overrideFillWithWireframeValue = null,
        applyPerspectiveDivision = true,
        drawPoints = false,
        stencilID = null,
        outlineColor = null) {
        let fill = !this.preferences.wireframeMode;
        if (overrideFillWithWireframeValue === true || overrideFillWithWireframeValue === false) {
            fill = !overrideFillWithWireframeValue;
        }
        if (drawPoints) {
            path.forEach(p => {
                this.drawPoint(p, false, transform, color);
            });
        }

        let screenPath = [];
        path.forEach(p => {
            let screenPoint = this.determineXY(p, transform, applyPerspectiveDivision);
            screenPath.push(screenPoint);
        });

        // Perspective clipping application, check if any of screnPath is null and if so, return
        if (screenPath.some(p => p === null)) {
            return;
        }

        /*
        backface culling
        */
        if (screenPath.length >= 3) {
            let a = new Vector(...screenPath[0].toArray());
            let b = new Vector(...screenPath[1].toArray());
            let c = new Vector(...screenPath[2].toArray());
            let ab = b.sub(a);
            let ac = c.sub(b);
            // see if normal is facing in positive z or not
            // See https://gamedev.stackexchange.com/questions/203694/how-to-make-backface-culling-work-correctly-in-both-orthographic-and-perspective
            let sign = ab.x * ac.y - ac.x * ab.y;
            let isBackface = sign < 0;
            if (isBackface && this.preferences.backfaceCulling) {
                // Only backface is culled, keep rendering mesh
                return;
            }
        }

        this.ctx.beginPath();
        this.ctx.strokeStyle = outlineColor ? outlineColor : color;
        this.ctx.fillStyle = color;

        if (stencilID === "rgba(1, 1, 1, 1)") {
            // Draw entityID one's wireframe
            // The one we compare against
            // this.ctx.strokeStyle = "blue";
        }

        this.stencilBufferCtx.beginPath();
        // Store entity ID in red channel
        this.stencilBufferCtx.fillStyle = stencilID || this.stencilClearColors;
        this.stencilBufferCtx.strokeStyle = stencilID || this.stencilClearColors;
        this.depthBufferCtx.beginPath();
        this.depthBufferCtx.fillStyle = "black";

        if (screenPath[0] != null) {
            const pos = screenPath[0].toArray();
            this.ctx.moveTo(...pos);
            this.stencilBufferCtx.moveTo(...pos);
            this.depthBufferCtx.moveTo(...pos);

        }
        screenPath.forEach(p => {
            if (p === null) return;
            const [x, y, z] = p.toArray();
            this.ctx.lineTo(x, y);
            this.stencilBufferCtx.lineTo(x, y);
            this.depthBufferCtx.lineTo(x, y);
        });
        // Fill volume enclosed by path (if any)
        if (fill) {
            this.ctx.fill();
        }
        // Always fill stencil and depth
        this.stencilBufferCtx.fill();
        this.depthBufferCtx.fill();


        this.ctx.closePath();
        this.stencilBufferCtx.closePath();
        this.depthBufferCtx.closePath();
        this.ctx.stroke();
        // Don't stroke stencil, just fill
        this.stencilBufferCtx.stroke();
        this.depthBufferCtx.stroke();
    }

    drawPath2D(path, color = "black", debugDraw = false) {
        this.ctx.beginPath();
        this.ctx.strokeStyle = color;
        this.ctx.fillStyle = color;
        this.ctx.moveTo(...path[0].toArray());
        path.forEach(p => {
            const [x, y, z] = p.toArray();
            this.ctx.lineTo(x, y);
        });
        // Fill volume enclosed by path (if any)
        this.ctx.fill();
        this.ctx.closePath();
        this.ctx.stroke();

        path.forEach(p => {
            this.drawPoint2D(p, color, debugDraw);
        });
    }

    drawPoint2D(p, color = "black", debugDraw = false) {
        const [x, y, z] = p.toArray();
        this.ctx.beginPath();
        this.ctx.arc(x, y, 3, 0, Math.PI * 2);
        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.stroke();

        if (!debugDraw) return;
        this.drawText(x, y, `${this.screenToNDC(x, y)}`, 10, color);
        // this.drawText(x, y, `(${x}, ${y})`, 10, color);
    }

    drawColorGradient() {
        const w = 200;
        const h = 200;
        const imageData = this.ctx.createImageData(w, h);

        // Gradient from top left to bottom right
        for (let i = 0; i < w; i++) {
            for (let j = 0; j < h; j++) {
                const index = (i + j * w) * 4;
                imageData.data[index + 0] = 255 * (i / w); // r
                imageData.data[index + 1] = 255 * (j / h); // g
                imageData.data[index + 2] = 0; // b
                imageData.data[index + 3] = 255; // a
            }
        }

        const destLocal = new Vector(10, 10, 0);
        // Need to account for current translation
        const destCanvas = destLocal.add(this.canvasTranslation);
        this.ctx.putImageData(imageData, destCanvas.x, destCanvas.y);

    }
}

class BasicShader {
    constructor(renderer) {
        this.scene = null;
        this.renderer = renderer;
    }

    setActiveScene(scene) {
        this.scene = scene;
    }


    submitLights(directionalLightSources) {
        this.directionalLightSources = directionalLightSources;
    }


    drawMesh = (meshRef, modelMatrix, material, entityId) => {
        if (!meshRef || !meshRef.mesh) return;
        const mesh = meshRef.mesh;
        const renderPrefs = this.scene.getComponent(entityId, MeshRenderer) || MeshRenderer.default;
        if (!renderPrefs.visible) return;
        if (mesh.constructor === Mesh) {
            this.drawSimpleMesh(mesh, modelMatrix, material, entityId, renderPrefs);
        } else if (mesh.constructor === DCELRepresentation) {
            this.drawMeshDCEL(mesh, modelMatrix, material, entityId, renderPrefs)
        }
    }

    drawMeshDCEL = (mesh, modelMatrix, material, entityId, renderPrefs) => {
        const colorNames = [
            "blue",
            "red",
            "green",
            "yellow",
            "purple",
            "pink"
        ]

        const drawFace = (face, modelMatrix, i, entityId) => {
            const faceVerts = face.getVertices();
            const faceNormal = face.GetFaceNormal();
            // We now apply simple shading by taking faceNormal times directional light vector
            // We use Lamber's cosine law to calculate the color
            let worldNormal = modelMatrix.multiplyVector(faceNormal).normalize();

            // TOOD support multiple light sources
            let finalDiffuse =
                material.faceColoring ? colorNames[i % colorNames.length] : material.diffuse;
            if (this.renderer.preferences.shadingEnabled && renderPrefs.shading) {
                for (let directionalLight of this.directionalLightSources) {
                    const lightDirection = directionalLight.direction;
                    const lightColor = directionalLight.color;
                    const lightIntensity = directionalLight.intensity;

                    let brightness = lightIntensity * Math.max(lightDirection.dotProduct(worldNormal), 0);
                    const combinedColor = new Vector(
                        lightColor.x * material.diffuse.x,
                        lightColor.y * material.diffuse.y,
                        lightColor.z * material.diffuse.z);

                    // const diffuse = lightColor.multiply(brightness);
                    finalDiffuse = combinedColor.scale(brightness); // TODO: account for own color
                }
            }
            finalDiffuse =
                typeof finalDiffuse === 'string' ?
                    finalDiffuse :
                    `rgba(${finalDiffuse.x}, ${finalDiffuse.y}, ${finalDiffuse.z}, 1)`;

            let outlineColor = finalDiffuse;
            if (renderPrefs.outline) {
                outlineColor = "red";
                // Make outline wide
                this.renderer.ctx.lineWidth = 2;
            } else {
                this.renderer.ctx.lineWidth = 1;
            }

            return this.renderer.drawPath(
                faceVerts,
                modelMatrix,
                finalDiffuse,
                renderPrefs.wireframe,
                true,
                false,
                renderPrefs.writeIdToStencil ? `rgba(${(entityId >> 16) & 0xFF}, ${(entityId >> 8) & 0xFF}, ${entityId & 0xFF}, 1)` : null,
                outlineColor
            );
        };

        mesh.faces.forEach((face, i) => {
            drawFace(face, modelMatrix, i, entityId);
        });
    }

    // SimpleMesh rendering
    drawSimpleMesh = (mesh, modelMatrix, material, entityId, renderPrefs) => {
        const verts = mesh.getVertices();
        mesh.getFaces().forEach((indices, i) => {
            const faceVerts = indices.map((index) => new Vector(...verts[index]));
            const faceNormal = mesh.getFaceNormal(i);
            // We now apply simple shading by taking faceNormal times directional light vector
            // We use Lamber's cosine law to calculate the color
            let worldNormal = modelMatrix.multiplyVector(faceNormal).normalize();

            // let brightness = lightIntensity * Math.max(directionalLight.dotProduct(worldNormal), 0);
            // const combinedColor = new Vector(
            //     lightColor.x * cubeDiffuseColor.x,
            //     lightColor.y * cubeDiffuseColor.y,
            //     lightColor.z * cubeDiffuseColor.z);
            // // const diffuse = lightColor.multiply(brightness);
            // const diffuse = combinedColor.scale(brightness); // TODO: account for own color
            // const faceColor = renderer.shadingEnabled ? `rgba(${diffuse.x}, ${diffuse.y}, ${diffuse.z}, 1)` : colorNames[i % colorNames.length];
            const faceColor = "gray";
            const outlineColor = "gray";
            this.renderer.drawPath(
                faceVerts,
                modelMatrix,
                faceColor,
                renderPrefs.wireframe,
                true,
                false,
                renderPrefs.writeIdToStencil ? `rgba(${(entityId >> 16) & 0xFF}, ${(entityId >> 8) & 0xFF}, ${entityId & 0xFF}, 1)` : null,
                outlineColor
            );
        });
    }
}

const DefaultMeshAsset = MeshAsset.get('Cube');

export class RenderSystem {
    preferences = { zOrdering: true };
    constructor() {
        this.preferences = { zOrdering: true };
    }

    getName() {
        return 'Render System';
    }
    
    onFrameStart(scene, renderer, dt) {
        renderer.start(dt);
        renderer.camera.validateViewMatrix();
    }

    renderScene(scene, renderer, dt) {
        this.renderer = renderer;
        this.shader = new BasicShader(this.renderer);
        this.shader.setActiveScene(scene);

        const frameRenderInfo = scene.getView(Transform, MeshFilter, Material).map(entId => {
            const [transform, meshFilter, material] = [
                scene.getComponent(entId, Transform),
                scene.getComponent(entId, MeshFilter),
                scene.getComponent(entId, Material)];
            transform.validateWorldMatrix();
            return [transform.toWorldMatrix(), meshFilter.meshRef || DefaultMeshAsset, material, entId];
        });

        const directionalLightSources = scene.getView(DirectionalLight).map(entityId => scene.getComponent(entityId, DirectionalLight));
        this.shader.submitLights(directionalLightSources);

        // // Z-ordering in camera space
        if (this.preferences.zOrdering) {
            frameRenderInfo.sort((a, b) => {
                const [aModelMatrix, aMeshRef, aMaterial, aEntId] = a;
                const [bModelMatrix, bMeshRef, bMaterial, bEntId] = b;
                const aWorldPos = aModelMatrix.multiplyPoint(new Vector(0, 0, 0));
                const bWorldPos = bModelMatrix.multiplyPoint(new Vector(0, 0, 0));
                const aCameraSpace = renderer.worldToEye(aWorldPos);
                const bCameraSpace = renderer.worldToEye(bWorldPos);
                return aCameraSpace.z - bCameraSpace.z;
            });
        }

        frameRenderInfo.forEach((
            [modelMatrix, meshRef, material, entId]) => this.shader.drawMesh(meshRef, modelMatrix, material, entId)
        );
    }
}
