import { Scene } from "./scene.js";


export class Director {
    constructor() {
        this.systems = [];
        this.scene = new Scene();
        this.renderer = null;
    }

    getScene() {
        return this.scene;
    }

    setRenderer(renderer) {
        this.renderer = renderer;
    }

    registerSystem(system) {
        this.systems.push(system);
    }

    onResize() {
        // Fire resize event   
    }

    onFrameStart(dt) {
        // Fire render signal
        for (let system of this.systems) {
            if (!system.onFrameStart) continue;
            system.onFrameStart(this.scene, this.renderer, dt);
        }
    }

    renderScene(dt) {
        for (let system of this.systems) {
            if (!system.renderScene) continue;
            system.renderScene(this.scene, this.renderer, dt);
        }

    }

    onFixedStep() {
        // Physics etc
        for (let system of this.systems) {
            if (!system.onFixedStep) continue;
            system.onFixedStep(this.scene, this.renderer);
        }
    }

    onKeyInput() {
    }

    onMouseInput() {
    }
}
