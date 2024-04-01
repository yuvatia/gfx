import { Tag, UUID, UUIDComponent } from "./components.js";
import { Reviver, Serializable } from "./reviver.js";
import { Transform } from "./transform.js";

class Entity extends Serializable {
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

    getValuesDict() {
        // Discard ID, we have UUID component for this
        return { components: { ...this.components } };
    }

    get uuid() {
        return this.components[UUIDComponent.name].uuid;
    }

}

export class Scene extends Serializable {
    uuid = UUID.create();
    entities = [];
    name = "Scene";
    #freelist = [];

    constructor(name = "Scene") {
        super();
        this.uuid = UUID.create();
        this.name = name;
        this.entities = []
        this.#freelist = []
    }

    equals(other) {
        return this.uuid.equals(other.uuid);
    }

    deepEquals(other) {
        // JSON stringify then compare
        return JSON.stringify(this) === JSON.stringify(other);
    }

    getValuesDict() {
        // Discard all invalid entities
        return { entities: this.getEntities(), name: this.name, uuid: this.uuid };
    }

    initialize() {
        // The entity IDs should be fixed after deserialization
        // Each ID is 1st generation and the index matches the index into entities, so
        // we can just set the ID to the index
        this.entities.forEach((entity, index) => {
            entity.id = this.createNewEntityId(index, 0);
        });
    }

    newEntity(name = "Empty", transform = new Transform()) {
        const newIndex = this.#getNextAvailableEntityIndex();
        const currentGeneration = this.#entityIdToGeneration(this.entities[newIndex].id);
        const newId = this.createNewEntityId(newIndex, currentGeneration);
        const entity = this.entities[newIndex];

        entity.id = newId;
        // Always assign uuid
        this.addComponent(newId, UUIDComponent);
        this.addComponent(newId, Tag).name = name;
        const t = this.addComponent(newId, Transform, transform.position, transform.rotation, transform.scale);

        return newId;
    }

    serializeEntity(entityId) {
        if (!this.isEntityValid(entityId)) return null;
        const entity = this.entityIdToEntity(entityId);
        return JSON.stringify(entity);
    }

    clear() {
        this.getEntities().map(entity => this.destroyEntity(entity.id));
    }

    getName(entityId) {
        const tag = this.getComponent(entityId, Tag);
        return tag.name;
    }


    getFirstByName(name) {
        return this.getEntities().find(entity => this.getName(entity.id) === name).id;
    }

    getAllByName(name) {
        return this.getEntities().filter(entity => this.getName(entity.id) === name).map(entity => entity.id);
    }

    getByUUID(uuid) {
        if (!uuid || uuid === UUID.empty || uuid.value === null) return null;
        const entity = this.getEntities().find(entity => UUID.equals(entity.uuid, uuid));
        if (!entity) {
            return null;
        }
        return entity.id;
    }

    getUUID(entityID) {
        return this.getComponent(entityID, UUIDComponent).uuid;
    }

    getComponentByUUID(uuid, type) {
        const entityID = this.getByUUID(uuid);
        return this.getComponent(entityID, type);
    }

    #InvalidEntityIndex = 0xFFFF;

    #getNextAvailableEntityIndex() {
        // first, exhaust freelist
        if (this.#freelist.length > 0) {
            return this.#freelist.pop();
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
        return index !== this.#InvalidEntityIndex && index < this.entities.length;
    }

    createNewEntityId(index, generation) {
        return (generation << 16) | index;
    }

    entityIdToEntity(entityId) {
        if (!this.isEntityIdValid(entityId)) {
            return null;
        }
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
        this.#freelist.push(index);
    }

    cloneEntity(entityId) {
        if (!this.isEntityValid(entityId)) return null;

        // Serialize, then deserialize
        const entity = this.entityIdToEntity(entityId);
        const serialized = JSON.stringify(entity);
        const deserialized = JSON.parse(serialized, Reviver.parse);

        // Assign new UUID
        deserialized.components[UUIDComponent.name].uuid = UUID.create();

        // Clone into next entity
        const newEntityId = this.newEntity();
        const newEntity = this.entityIdToEntity(newEntityId);
        newEntity.components = deserialized.components;
        newEntity.components[Tag.name].name += ' (Clone)';

        return newEntityId;
    }

    deepCopy(cloneName = null) {
        const serialized = JSON.stringify(this);
        const deserialized = JSON.parse(serialized, Reviver.parse);
        deserialized.name = cloneName ? cloneName : this.name + ' (Clone)';
        return deserialized;
    }

    addComponent(entityId, type, ...args) {
        if (!this.isEntityValid(entityId)) return null;
        const component = new type(...args);
        this.entityIdToEntity(entityId).components[type.name] = component;
        return component;
    }

    removeComponent(entityId, type) {
        if (!this.isEntityValid(entityId)) return;
        this.entityIdToEntity(entityId).components[type.name] = undefined;
    }

    getComponent(entityId, type) {
        if (!this.isEntityValid(entityId)) return null;
        return this.entityIdToEntity(entityId).components[type.name];
    }

    forceGetComponent(entityId, type) {
        if (!this.isEntityValid(entityId)) {
            return null;
        }
        if (!this.hasComponent(entityId, type)) {
            return this.addComponent(entityId, type);
        }
        return this.getComponent(entityId, type);
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
        if (!this.isEntityValid(entityId)) return false;
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
