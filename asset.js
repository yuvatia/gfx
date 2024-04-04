import { UUID } from "./src/components";
import { Cube, makeIcosphere } from "./src/geometry";
import { DCELRepresentation } from "./src/halfmesh";
import { Serializable } from "./src/reviver";

export class Asset extends Serializable {
    static registry = {}; // Maps asset names to asset objects

    name = '';
    // uuid = UUID.empty;

    static get(name) {
        if (Asset.registry.hasOwnProperty(name)) {
            return Asset.registry[name];
        }
        return null;
    }

    static filter(predicate) {
        return Object.values(Asset.registry).filter(predicate);
    }

    static empty = new Asset('Empty');

    static isEquals(other) {
        // return this.uuid = other.uuid;
    }

    static register(asset) {
        Asset.registry[asset.name] = asset;
    }

    static unregister(asset) {
        if (Asset.registry.hasOwnProperty(asset.name)) {
            delete Asset.registry[asset.name];
        }
    }

    constructor(name) {
        super();
        // this.uuid = UUID.create();
        this.name = name;
        Asset.register(this);
    }

    get typename() {
        return Asset.typename;
    }

    static get typename() {
        return 'Asset';
    }


    getValuesDict() {
        return { ...this };
    }

    fromJSON(dict) {
        return Asset.get(dict.name);
        // Default implementation
        Object.assign(this, dict);
        this.initialize(dict);
        return this;
    }
}

export class MeshAsset extends Asset {
    #meshHandle = null;

    constructor(name, handle = null) {
        super(name);
        this.#meshHandle = handle;
    }

    get typename() {
        return MeshAsset.typename;
    }

    static get typename() {
        return 'MeshAsset';
    }

    static empty = new MeshAsset('EmptyMesh');

    get mesh() {
        return this.#meshHandle;
    }

    getValuesDict() {
        return { ...this };
    }

    initialize(name) {

    }
}

let isInitialized = false;
const initializeAssets = () => {
    if (isInitialized) return;
    isInitialized = true;
    new MeshAsset('Cube', DCELRepresentation.fromSimpleMesh(new Cube()));
    new MeshAsset('Sphere', DCELRepresentation.fromSimpleMesh(makeIcosphere(3)));
}
initializeAssets();