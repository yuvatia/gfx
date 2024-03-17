import { Vector, Matrix } from "./math.js";
import { Camera } from "./camera.js";
import { createTranslationMatrix, createaAxisAngleRotationMatrix, CreatePerspectiveProjection, CreateSymmetricOrthographicProjection, invertTranslation } from "./affine.js";

export class RendererPrefrences {
    constructor() {
        this.backfaceCulling = true;
        this.shadingEnabled = true;
        this.perspectiveClipEnabled = true;

        this.clearColors = "rgba(0, 0, 255, 0.1)";

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

        this.finalRotationMat = new Matrix();


        this.onResize();

        window.addEventListener("resize", this.onResize.bind(this));

        // Listen for scroll events
        this.canvas.addEventListener('wheel', this.camera.onScroll.bind(this.camera));

    }

    worldToEye(point) {
        // return point;
        const eyeSpace = this.camera.getViewMatrix().multiplyPoint(point);
        // Note: the actual finalRotationMat rotates around the origin so we need to use a similarity transform
        const camT = createTranslationMatrix(this.camera.transform.position);
        // Apply final rotation
        // TODO is this really how it's done?
        const camTInverse = invertTranslation(camT);
        const arcballRotation = camT.multiplyMatrix(this.finalRotationMat).multiplyMatrix(camTInverse); // T*R*T^-1
        return arcballRotation.multiplyPoint(eyeSpace);
    }

    eyeToClip(point) {
        return this.camera.getProjectionMatrix().multiplyPoint(point);
    }

    perspectiveDivision(point) {
        return point.multiply(1 / point.w);
    }

    project3Dto2D(point, applyPerspectiveDivision = true) {
        const eyeSpace = this.worldToEye(point);
        const clipSpace = this.eyeToClip(eyeSpace);

        // Apply clipping against all 6 planes
        var clipSpace3 = [clipSpace.x, clipSpace.y, clipSpace.z];
        var w = clipSpace.w;
        if (this.preferences.perspectiveClipEnabled) {
            // if -w <= x, y, z <= w and w > 0, then inside viewing volume
            if (w > 0) return null;
            for (var i = 0; i < clipSpace3.length; ++i) {
                const isInside = -w <= clipSpace3[i] && clipSpace3[i] <= w;
                if (isInside) {
                    return null;
                }
            }
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

    onResize() {
        // No need to resize canvas since responsiveness is guaranteed
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        // Translate so that origin is in the middle
        this.canvasTranslation.x = this.canvas.width * 0.5;
        this.canvasTranslation.y = this.canvas.height * 0.5;
        this.ctx.translate(this.canvasTranslation.x, this.canvasTranslation.y);

        this.stencilBuffer.width = window.innerWidth;
        this.stencilBuffer.height = window.innerHeight;
        this.stencilBufferCtx = this.stencilBuffer.getContext("2d", { willReadFrequently: true });
        this.stencilBufferCtx.translate(this.canvasTranslation.x, this.canvasTranslation.y);

        this.depthBuffer.width = window.innerWidth;
        this.depthBuffer.height = window.innerHeight;
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

        // Stencil: set default value of rgba(0, 0, 255, 1) for all pixels, that way we pick the camera
        // when not picking an entity
        this.stencilClearColors = "rgba(0, 0, 255, 1)";
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
        this.ctx.font = "bold 15px Arial";
        this.ctx.fillStyle = "black";
        // Convert dt to frameRate
        const frameRate = (1000 / dt);

        // this.drawXYGrid2D();
        this.ctx.fillText(`FPS: ${frameRate.toFixed(0)}`, this.canvas.width - 100, 20);
        this.ctx.fillText(`Camera: ${this.camera.transform.position.toString()}`, this.canvas.width - 250, 40);
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
        overrideFillWithValue = null,
        applyPerspectiveDivision = true,
        drawPoints = false,
        stencilID = this.stencilClearColors,
        outlineColor = null) {
        let fill = !this.preferences.wireframeMode;
        if (overrideFillWithValue === true || overrideFillWithValue === false) {
            fill = overrideFillWithValue;
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
            let isBackface = sign > 0; // Sign reversed due to handedness
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
        this.stencilBufferCtx.fillStyle = stencilID;
        this.stencilBufferCtx.strokeStyle = stencilID;
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

export class RenderSystem {
    constructor() {

    }
}