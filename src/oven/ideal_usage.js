class Application {
    constructor(engineRef) {
        this.engine = engineRef;
    }

    start() {
        const cubeA = new Entity();
        cubeA
    }

    tick() {

    }
}

const main = () => {
    const engineInstance = new Engine();
    engineInstance.addSystem(new RenderSystem());
    engineInstance.addSystem(new CameraController());
    engineInstance.addSystem(new PhysicsSystem());
    engineInstance.addSystem(new Mousepicker());
    engineInstance.setApplication(new Application(engineInstance));
}

document.addEventListener('DOMContentLoaded', main);