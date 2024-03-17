import { Transform } from "./transform.js";

class Tag {
    name = "Empty";
}

class Entity {
    id = 0;  // Default to id: 0 generation: 0
    components = {};  // c.constructor.name: c

    hasComponent(type) {
        const name = type.name;
        return this.components[name] !== undefined;
    }

    hasAllOf(...types) {
        for (const type of types) {
            if (!this.hasComponent(type)) {
                return false;
            }
        }
        return true;
    }

    hasAnyOf(...types) {
        for (const type of types) {
            if (this.hasComponent(type)) {
                return true;
            }
        }
        return false;
    }
}

export class Scene {
    constructor() {
        this.entities = []
        this.freelist = []
    }

    newEntity(name = "Empty", transform = new Transform()) {
        const newIndex = this.#getNextAvailableEntityIndex();
        const currentGeneration = this.#entityIdToGeneration(this.entities[newIndex].id);
        const newId = this.createNewEntityId(newIndex, currentGeneration);
        const entity = this.entities[newIndex];

        entity.id = newId;

        this.addComponent(newId, Tag).name = name;
        const t = this.addComponent(newId, Transform, transform.position, transform.rotation, transform.scale);

        return newId;
    }

    clear() {
        this.getEntities().map(entity => this.destroyEntity(entity.id));
    }

    getFirstByName(name) {
        return this.getEntities().find(entity => entity.components.Tag.name === name).id;
    }

    getAllByName(name) {
        return this.getEntities().filter(entity => entity.components.Tag.name === name).map(entity => entity.id);
    }

    #InvalidEntityIndex = 0xFFFF;

    #getNextAvailableEntityIndex() {
        // first, exhaust freelist
        if (this.freelist.length > 0) {
            return this.freelist.pop();
        }
        // Empty freelist, add new entity
        const index = this.entities.length;
        this.entities.push(new Entity());
        return index;
    }

    #entityIdToIndex(entityId) {
        return entityId & 0xFFFF;
    }

    #entityIdToGeneration(entityId) {
        return entityId >> 16;
    }

    isEntityValid(entityId) {
        const index = this.#entityIdToIndex(entityId);
        if (index === this.#InvalidEntityIndex) {
            return false;
        }
        const entity = this.entities[index];
        return entity && entity.id === entityId;
    }

    isEntityIdValid(entityId) {
        const index = this.#entityIdToIndex(entityId);
        return index !== this.#InvalidEntityIndex;
    }

    createNewEntityId(index, generation) {
        return (generation << 16) | index;
    }

    entityIdToEntity(entityId) {
        const index = this.#entityIdToIndex(entityId);
        const generation = this.#entityIdToGeneration(entityId);
        const entity = this.entities[index];
        if (this.#entityIdToGeneration(entity.id) !== generation) {
            return null;
        }
        return entity;
    }

    destroyEntity(entityId) {
        const index = this.#entityIdToIndex(entityId);
        const generation = this.#entityIdToGeneration(entityId);
        const entity = this.entities[index];
        if (this.#entityIdToGeneration(entity.id) !== generation) {
            return;
        }
        // Clear entity mask and assign new generation
        entity.id = this.createNewEntityId(this.#InvalidEntityIndex, generation + 1);
        entity.components = {};
        // Add to list of free entities
        this.freelist.push(index);
    }

    addComponent(entityId, type, ...args) {
        const component = new type(...args);
        this.entityIdToEntity(entityId).components[type.name] = component;
        return component;
    }

    removeComponent(entityId, type) {
        this.entityIdToEntity(entityId).components[type.name] = undefined;
    }

    getComponent(entityId, type) {
        return this.entityIdToEntity(entityId).components[type.name];
    }

    getAllComponents(entityId, ...types) {
        const typeKeys = types.forEach(t => t.name);
        const components = this.entityIdToEntity(entityId).components;
        return Object.keys(components).reduce((returnValue, compName) => {
            if (typeKeys.includes(compName)) {
                returnValue.push(components[compName]);
            }
        }, []);
    }

    hasComponent(entityId, type) {
        return this.entityIdToEntity(entityId).hasComponent(type);
    }

    getEntities() {
        return this.entities.filter(entity => this.isEntityValid(entity.id));
    }

    getView(...components) {
        return this.getEntities().filter(entity => entity.hasAllOf(...components)).map(ent => ent.id);
    }

    getComponentView(...components) {
        return this.getEntities().filter(entity => entity.hasAllOf(...components)).map(ent => {
            return [ent.id, components.map(comp => ent.components[comp.name])];
        });
    
    }
}

const example = () => {
    class ExampleComponent { };
    const scene = new Scene();
    const cubeA = scene.newEntity("CubeA");
    const comp = scene.addComponent(cubeA, ExampleComponent);
    scene.removeComponent(cubeA, ExampleComponent);
    scene.destroyEntity(cubeA);
    const sphere = scene.newEntity("Sphere");

    const subView = scene.getView(ExampleComponent);
    for (const entity of subView) {
        console.log(entity.id);
    }

    class MeshFilter { meshRef; };
    const rendererView = scene.getView(Transform, MeshFilter);
    for (const entity of rendererView) {
        // Do render stuff
    }

    const phyicsView = scene.getView(Rigidbody);
    // then collect contact constraints
}
