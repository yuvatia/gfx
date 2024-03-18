import { Scene } from "./scene.js";


export class Director {
    constructor() {
        this.systems = [];
        this.scene = new Scene();
        this.renderer = null;

        window.addEventListener("resize", this.onViewportResize.bind(this));
    }

    getScene() {
        return this.scene;
    }

    setRenderer(renderer) {
        this.renderer = renderer;
        const targetCanvas = this.renderer.canvas;

        targetCanvas.addEventListener('wheel', this.onMouseScroll.bind(this));
        targetCanvas.addEventListener('keydown', this.onKeydownEvent.bind(this));
        targetCanvas.addEventListener('click', this.onMouseClick.bind(this));
        targetCanvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        targetCanvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        targetCanvas.addEventListener('mousemove', this.onMouseMove.bind(this));
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
}
