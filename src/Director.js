import { Camera } from "./camera.js";
import { PhysicsSystem } from "./physics.js";
import { RenderSystem, Renderer, RendererPrefrences } from "./renderer.js";
import { Scene } from "./scene.js";
import { SignalEmitter } from "./signal_emitter.js";


export class Director {
    constructor() {
        this.systems = [];
        this.scene = new Scene();
        this.renderer = null;

        this.fpsTarget = 60;
        this.lastFrameTime = null;

        this.RenderSignalEmitter = new SignalEmitter();

        window.addEventListener("resize", this.onViewportResize.bind(this));
    }

    getScene() {
        return this.scene;
    }

    setRenderer(renderer) {
        this.renderer = renderer;
        const targetCanvas = this.renderer.canvas;

        targetCanvas.addEventListener('wheel', this.onMouseScroll.bind(this));
        document.addEventListener('keydown', this.onKeydownEvent.bind(this));
        targetCanvas.addEventListener('click', this.onMouseClick.bind(this));
        targetCanvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        targetCanvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        targetCanvas.addEventListener('mousemove', this.onMouseMove.bind(this))


        // Renderer is also treated as a system
        this.registerSystem(renderer);
    }

    raiseOnSetActiveScene() {
        this.#invokeAllRegisteredSystemCallbacks("onSetActiveScene", this.scene);
    }

    onMouseClick(event) {
        this.#invokeAllRegisteredSystemCallbacks("onMouseClick", event);
    }

    onMouseUp(event) {
        this.#invokeAllRegisteredSystemCallbacks("onMouseUp", event);
    }

    onMouseDown(event) {
        this.#invokeAllRegisteredSystemCallbacks("onMouseDown", event);
    }

    onMouseMove(event) {
        this.#invokeAllRegisteredSystemCallbacks("onMouseMove", event);
    }

    registerSystem(system) {
        this.systems.push(system);
        // raise onSetActiveScene event for system
        if (system.onSetActiveScene !== undefined) {
            system.onSetActiveScene(this.scene);
        }
    }

    onViewportResize() {
        // Fire resize event  
        // Fire renderer first
        if (this.renderer) {
            this.renderer.onViewportResize();
        }
        this.#invokeAllRegisteredSystemCallbacks("onViewportResize");
    }

    onFrameStart(dt) {
        this.#invokeAllRegisteredSystemCallbacks("onFrameStart", this.scene, this.renderer, dt);
    }

    renderScene(dt) {
        this.#invokeAllRegisteredSystemCallbacks("renderScene", this.scene, this.renderer, dt);
    }

    onFixedStep() {
        this.#invokeAllRegisteredSystemCallbacks("onFixedStep", this.scene, this.renderer);
    }

    onKeydownEvent(event) {
        this.#invokeAllRegisteredSystemCallbacks("onKeydownEvent", event);
    }

    onMouseScroll(event) {
        this.#invokeAllRegisteredSystemCallbacks("onMouseScroll", event);
    }

    #invokeAllRegisteredSystemCallbacks(name, ...args) {
        for (let system of this.systems) {
            if (!system[name]) continue;
            system[name](...args);
        }
    }

    #animationTickHandler = (timestamp) => {
        if (!this.lastFrameTime) this.lastFrameTime = timestamp;
        const elapsed = timestamp - this.lastFrameTime;

        if (elapsed >= this.fpsInterval) {
            this.RenderSignalEmitter.signalAll();
            this.onFrameStart(elapsed);
            this.onFixedStep(elapsed);
            this.renderScene(elapsed);
            this.lastFrameTime = timestamp - (elapsed % this.fpsInterval);
        }

        // Keep scheduling next animation frame
        requestAnimationFrame(this.#animationTickHandler.bind(this));
    }


    setFpsTarget(fpsTarget) {
        this.fpsTarget = fpsTarget;
        this.fpsInterval = 1000 / this.fpsTarget;
    }

    start = () => {
        // Requests first animation frame
        requestAnimationFrame(this.#animationTickHandler.bind(this));
    }
}

export const SimpleDirector = (color, stencil, depth) => {
    const sceneCamera = new Camera();
    const renderer = new Renderer(
        color, stencil, depth, RendererPrefrences.default, sceneCamera
    );
    // renderer.preferences.wireframeMode = true;

    const director = new Director();
    director.setRenderer(renderer);
    director.registerSystem(new PhysicsSystem());
    director.registerSystem(sceneCamera);
    director.registerSystem(new RenderSystem(renderer));

    return director;
}