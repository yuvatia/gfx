import { Vector } from "./math.js";
import { Serializable } from "./reviver.js";

export class Component extends Serializable {
    constructor() {
        super();
    }
}
export class Tag extends Component {
    name = "Empty";
    constructor() {
        super();
    }

    toString() {
        return this.name;
    }
}

export class UUID extends Serializable {
    value = null;

    static create() {
        const instance = new UUID();
        const value = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
        instance.value = value;
        return instance;
    }

    static equals(a, b) {
        return a.value === b.value;
    }

    toString() {
        return this.value;
    }

    static empty = new UUID();
}

export class UUIDComponent extends Component {
    uuid = UUID.empty;

    constructor() {
        super();
        this.uuid = UUID.create();
    }

    toString() {
        return this.value;
    }
}
export class MeshFilter extends Component {
    meshRef = null;

    constructor() {
        super();
    }
}
export class Material extends Component {
    diffuseColor = "white";
    faceColoring = false;

    constructor() {
        super();
    }
}
export class MeshRenderer extends Component {
    shading = true;
    wireframe = null; // Default to global settings
    writeIdToStencil = true; // Writes entityId to stencil for mousepicking
    static default = new MeshRenderer();

    constructor() {
        super();
    }
}
export class DirectionalLight extends Component {
    color = "white";
    intensity = 0.02;
    direction = new Vector(0, 0.5, -1).normalize();

    constructor() {
        super();
    }
}
