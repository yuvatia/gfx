export class Serializable {
    constructor() {
        // All serializables auto-subscribe to Reviver
        Reviever.register(this.constructor);
    }

    // Should be overriden by subclasses
    getValuesDict() {
        return { ...this };
    }

    toJSON() {
        return {
            type: this.constructor.name,
            value: this.getValuesDict()
        };
    }

    // Should be overriden by subclasses
    initialize() { }

    fromJSON(dict) {
        // Default implementation
        Object.assign(this, dict);
        this.initialize();
        return this;
    }
}


export class Reviever {
    // When encoutering a type key, reviver will first
    // opt for instantiating a specialization
    static #specializations = {};

    static register(type) {
        this.#specializations[type.name] = type;
    }

    static get specializations() {
        return this.#specializations;
    }

    // This is a reviver which can be passed to JSON.parse
    static parse(key, value) {
        // Value will be {"type": "Type", "value": {...}}
        // First try to load value if it is a string
        if (value && value.type in Reviever.#specializations) {
            const type = Reviever.#specializations[value.type];
            const instance = new type().fromJSON(value.value);
            return instance;
        }

        // If key is not in specialization, return the value as is, before parsing
        return value;
    }
};