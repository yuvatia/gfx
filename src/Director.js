import { Asset, MeshAsset } from "../asset.js";
import { MouseController } from "./MouseController.js";
import { Camera } from "./camera.js";
import { DirectionalLight, Material, MeshFilter, MeshRenderer, Tag, UUID, UUIDComponent } from "./components.js";
import { Mesh } from "./geometry.js";
import { DCELRepresentation } from "./halfmesh.js";
import { FollowConstraint, Rigidbody } from "./kinematics.js";
import { Matrix, Point, Vector } from "./math.js";
import { PhysicsSystem } from "./physics.js";
import { RenderSystem, Renderer, RendererPrefrences } from "./renderer.js";
import { Entity, Scene } from "./scene.js";
import { SignalEmitter } from "./signal_emitter.js";
import { Transform } from "./transform.js";


export const SetupSerialization = () => {
    // Instantiate a new instance of all serialzable classes.
    // This is necessary to register all classes with the reviver
    new Point();
    new Vector();
    new Matrix();

    new Entity();
    new Scene();

    new UUID();

    new DCELRepresentation();
    new Mesh();

    new UUIDComponent();
    new Tag();
    new Transform();
    new MeshRenderer();
    new Material();
    new DirectionalLight();
    new MeshFilter();
    new Rigidbody();
    new FollowConstraint();

    new Asset();
    new MeshAsset();
}

export class Director {
    #stopRequested = false;

    constructor() {
        SetupSerialization();

        this.systems = [];
        this.systemStates = {};  // Name to state, state is either true or false (on or off)
        this.scene = new Scene();
        this.renderer = null;

        this.fpsTarget = 60;
        this.lastFrameTime = null;

        this.RenderSignalEmitter = new SignalEmitter();
    }

    unsubscribeFromEvents() {
        document.removeEventListener('keydown', this.onKeydownEvent.bind(this));

        const targetCanvas = this.renderer.canvas;

        if (!this.renderer || !targetCanvas) return;

        window.removeEventListener("resize", this.onViewportResize.bind(this));
        targetCanvas.removeEventListener("resize", this.onViewportResize.bind(this));

        targetCanvas.removeEventListener('wheel', this.onMouseScroll.bind(this));
        targetCanvas.removeEventListener('click', this.onMouseClick.bind(this));

        targetCanvas.removeEventListener('mouseup', this.onMouseUp.bind(this));
        targetCanvas.removeEventListener('mousedown', this.onMouseDown.bind(this));
        targetCanvas.removeEventListener('mousemove', this.onMouseMove.bind(this));

        targetCanvas.removeEventListener('touchend', this.onMouseUp.bind(this));
        targetCanvas.removeEventListener('touchstart', this.onMouseDown.bind(this));
        targetCanvas.removeEventListener('touchmove', this.onMouseMove.bind(this));
    }


    getScene() {
        return this.scene;
    }

    setActiveScene(scene) {
        if (this.scene) this.raiseOnSceneUnload(this.scene);
        this.scene = scene;
        this.raiseOnSetActiveScene();
    }

    setSystemState(systemName, enabled) {
        this.systemStates[systemName] = enabled;
    }

    toggleSystemState(systemName) {
        this.setSystemState(systemName, !this.getSystemState(systemName));
    }

    getSystemState(systemName) {
        return this.systemStates[systemName];
    }

    setRenderer(renderer) {
        this.renderer = renderer;
        const targetCanvas = this.renderer.canvas;

        window.addEventListener("resize", this.onViewportResize.bind(this));
        targetCanvas.addEventListener("resize", this.onViewportResize.bind(this));

        targetCanvas.addEventListener('wheel', this.onMouseScroll.bind(this));
        document.addEventListener('keydown', this.onKeydownEvent.bind(this));
        targetCanvas.addEventListener('click', this.onMouseClick.bind(this));

        targetCanvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        targetCanvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        targetCanvas.addEventListener('mousemove', this.onMouseMove.bind(this));

        targetCanvas.addEventListener('touchend', this.onMouseUp.bind(this));
        targetCanvas.addEventListener('touchstart', this.onMouseDown.bind(this));
        targetCanvas.addEventListener('touchmove', this.onMouseMove.bind(this));

        // Renderer is also treated as a system
        this.registerSystem(renderer);
    }

    raiseOnSceneUnload(scene) {
        this.#invokeAllRegisteredSystemCallbacks("onSceneUnload", scene);
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

    registerSystem(system, enable = true) {
        this.systems.push(system);
        this.setSystemState(this.getSystemName(system), enable);
        // raise onSetActiveScene event for system
        if (system.onSetActiveScene !== undefined) {
            system.onSetActiveScene(this.scene);
        }
    }

    // Either by name or ref
    removeSystem(system) {
        const systemRef = (typeof system === "string") ? this.getSystemByName(system) : system;
        this.systems = this.systems.filter((sys) => sys !== systemRef);
        delete this.systemStates[this.getSystemName(systemRef)];
    }

    getSystemByName(name) {
        return this.systems.find((sys) => this.getSystemName(sys) === name);
    }

    getSystemName(system) {
        return system.getName();
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

    #invokeAllRegisteredSystemCallbacks(eventName, ...args) {
        for (let system of this.systems) {
            if (!this.getSystemState(this.getSystemName(system))) continue;
            if (!system[eventName]) continue;
            system[eventName](...args);
        }
    }

    #animationTickHandler = (timestamp) => {
        if (this.#stopRequested) return;

        if (!this.lastFrameTime) this.lastFrameTime = timestamp;
        const elapsed = timestamp - this.lastFrameTime;

        if (elapsed >= this.fpsInterval && this.isVisibile()) {
            this.RenderSignalEmitter.signalAll();
            this.onFrameStart(elapsed);
            this.onFixedStep(elapsed);
            this.renderScene(elapsed);
            this.lastFrameTime = timestamp - (elapsed % this.fpsInterval);
        }

        // Keep scheduling next animation frame
        requestAnimationFrame(this.#animationTickHandler.bind(this));
    }

    isVisibile() {
        if (!this.renderer || !this.renderer.canvas) return false;
        const element = this.renderer.canvas;
        const visible = element.checkVisibility();
        if (!visible) return false;
        return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
    }


    setFpsTarget(fpsTarget) {
        this.fpsTarget = fpsTarget;
        this.fpsInterval = 1000 / this.fpsTarget;
    }

    start = () => {
        // Requests first animation frame
        requestAnimationFrame(this.#animationTickHandler.bind(this));
    }

    stop = () => {
        this.#stopRequested = true;
    }
}

export const SimpleDirector = (color, stencil, depth, autoEnablePhysics = true) => {
    const sceneCamera = new Camera();
    const renderer = new Renderer(
        color, stencil, depth, RendererPrefrences.default, sceneCamera
    );
    // renderer.preferences.wireframeMode = true;

    const director = new Director();
    director.setRenderer(renderer);
    director.registerSystem(new PhysicsSystem(), autoEnablePhysics);
    director.registerSystem(sceneCamera);
    director.registerSystem(new RenderSystem(renderer));
    director.registerSystem(new MouseController(renderer));

    return director;
}
