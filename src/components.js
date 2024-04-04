import { MeshAsset } from "../asset.js";
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

    static get typename() {
        return 'Tag';
    }
    
    get typename() {
        return Tag.typename;
    }

    toString() {
        return this.name;
    }
}

export class UUID extends Serializable {
    value = null;

    constructor() {
        super();
    }

    get typename() {
        return UUID.typename;
    }

    static get typename() {
        return 'UUID';
    }

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

    static get typename() {
        return 'UUIDComponent';
    }

    get typename() {
        return UUIDComponent.typename;
    }

    toString() {
        return this.value;
    }
}
export class MeshFilter extends Component {
    meshRef = MeshAsset.empty;

    constructor() {
        super();
    }

    static get typename() {
        return 'MeshFilter';
    }

    get typename() {
        return MeshFilter.typename;
    }
}
export class Material extends Component {
    diffuse = "white";
    faceColoring = false;

    constructor() {
        super();
    }

    static get typename() {
        return 'Material';
    }

    get typename() {
        return Material.typename;
    }
}
export class MeshRenderer extends Component {
    visible = true;
    shading = true;
    outline = false;
    wireframe = null; // Default to global settings
    writeIdToStencil = true; // Writes entityId to stencil for mousepicking
    static default = new MeshRenderer();

    constructor() {
        super();
    }

    static get typename() {
        return 'MeshRenderer';
    }

    get typename() {
        return MeshRenderer.typename;
    }
}
export class DirectionalLight extends Component {
    color = new Vector(255, 255, 255, 255);
    intensity = 0.02;
    direction = new Vector(0, 0.5, -1).normalize();

    constructor() {
        super();
    }

    static get typename() {
        return 'DirectionalLight';
    }

    get typename() {
        return DirectionalLight.typename;
    }
}
