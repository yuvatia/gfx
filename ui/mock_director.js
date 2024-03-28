import { html, createYoffeeElement, YoffeeElement } from "./yoffee/yoffee.min.js"

class Tag {
    name = "Empty";
}

class Vector {
    x = 0;
    y = 0;
    z = 0;
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
    static zero = new Vector(0, 0, 0);
    static one = new Vector(1, 1, 1);

    clone() {
        return new Vector(this.x, this.y, this.z);
    }
}

class Transform {
    position = Vector.zero.clone();
    rotation = Vector.zero.clone();
    scale = Vector.one.clone();
}

class Rigidbody {
    velocity = Vector.zero.clone();
    mass = 1;
    transform = null;
}

class RenderFilter {
    wireframe = false;
}

class Entity {
    id = 0;
    components = {};
}

class Scene {
    entities = [];

    newEntity(name = "Empty") {
        let entity = new Entity();
        entity.id = this.entities.length;
        this.entities.push(entity);

        this.addComponent(entity.id, Tag).name = name;
        this.addComponent(entity.id, Transform);

        return entity.id;
    }

    getEntityByID(id) {
        return this.entities[id];
    }

    destroyEntity(id) {
        this.entities[id] = null;
    }

    addComponent(entityId, type) {
        const comp = new type();
        this.entities[entityId].components[type.name] = comp;
        return comp;
    }

    getComponent(entityId, type) {
        if (!this.hasComponent(entityId, type)) return undefined;
        return this.entities[entityId].components[type.name];
    }

    removeComponent(entityId, type) {
        this.entities[entityId].components[type.name] = undefined;
    }

    hasComponent(entityId, type) {
        return this.entities[entityId].components[type.name] != undefined;
    }

    getEntities() {
        return this.entities.filter(e => e != null);
    }
}

class PhysicsPreferences {
    gravity = Vector.zero;
    timeStep = 0.1;
}

class PhysicsSystem {
    preferences = new PhysicsPreferences();
}

class RendererPreferences {
    clearColor = new Vector(0, 0, 0);
    wireframeMode = false;
}

class RenderSystem {
    preferences = new RendererPreferences();
}

class Director {
    systems = [];
    scene = null;
    static instance = null;
    constructor() {
        this.systems = [new RenderSystem(), new PhysicsSystem()];
        this.scene = new Scene();
        Director.instance = this;
    }

    static getInstance() {
        return Director.instance;
    }

    getSystems() {
        return this.systems;
    }

    getActiveScene() {
        return this.scene;
    }
}

const doWhatever = (key, value, cannonicalPath) => {
    let newDiv = document.createElement("div"); // Create a new div element
    newDiv.textContent = `${key}: ${value} [${value.constructor.name}]`; // Set the content of the div

    // Add the new div as the first child of the body
    document.body.insertBefore(newDiv, document.body.firstChild);
}

const hasNestedProperty = (object, path) => {
    return path.split('.').every(function (x) {
        if (typeof object != 'object' || object === null || !(x in object))
            return false;
        object = object[x];
        return true;
    });
}

const getNestedProperty = (object, path) => {
    return path.split('.').reduce((o, i) => o[i], object);
}

const setNestedProperty = (object, path, value) => {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const lastObj = keys.reduce((o, i) => o[i], object);
    lastObj[lastKey] = value;
}

const onValueChanged = (value, cannonicalPath, entityId) => {
    const entity = scene.getEntityByID(entityId);
    setNestedProperty(entity.components, cannonicalPath, value);
    console.log(entity.components);
}

const knownProcessors = {
    "Vector": (key, value, cannonicalPath, entityId) => {
        const coords = ['x', 'y', 'z'];

        // Create a table
        const table = document.createElement('table');
        table.style.width = '100%';
        table.setAttribute('border', '1');

        // Create table header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        const header = document.createElement('th');
        header.setAttribute('colspan', '6');
        header.textContent = cannonicalPath;
        headerRow.appendChild(header);
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create table body
        const tbody = document.createElement('tbody');

        // Create new table row
        const row = document.createElement('tr');

        coords.forEach(coord => {
            // Create new table data for label
            const labelData = document.createElement('td');
            // Create new label element
            const label = document.createElement('label');
            label.textContent = `${key}.${coord}`;
            labelData.appendChild(label);
            label.className = 'component-label';

            // Create new table data for input
            const inputData = document.createElement('td');
            // Create new input element
            const input = document.createElement('input');
            // Set type to number
            input.type = 'number';
            // set value
            input.value = value[coord];
            // Set id
            input.id = `${entityId}.${cannonicalPath}:${coord}`;
            // Set onChange event
            input.onchange = function (event) {
                onValueChanged(parseFloat(event.target.value), cannonicalPath, entityId);
            };
            inputData.appendChild(input);

            // Append label and input to row
            row.appendChild(labelData);
            row.appendChild(inputData);
        });

        // Append row to table body
        tbody.appendChild(row);

        // Append table body to table
        table.appendChild(tbody);

        // Append table to body
        document.body.appendChild(table);
    }
};

const drillDown = (obj, cannonicalPath, entityId) => {
    if (obj === null || obj === undefined) return;
    if (obj instanceof Object) {
        Object.entries(obj).forEach(([key, value]) => {
            const newCannonicalPath = `${cannonicalPath}.${key}`;
            const typename = value.constructor.name;
            if (knownProcessors[typename] !== undefined) {
                knownProcessors[typename](key, value, newCannonicalPath, entityId);
            } else {
                doWhatever(key, value, newCannonicalPath);
                drillDown(value, newCannonicalPath, entityId);

            }
        });
    }
}

const process = (scene, entityId) => {
    const comps = scene.getEntityByID(entityId).components;
    Object.entries(comps).forEach(([key, value]) => {
        drillDown(value, key, entityId);
    });
}

// scene.getEntities().forEach(({ id }) => process(scene, id));

const director = new Director();
const scene = director.getActiveScene();
const cube = scene.newEntity("Cube");
scene.getComponent(cube, Transform).position.x = 132;
scene.addComponent(cube, Rigidbody).transform = scene.getComponent(cube, Transform);
scene.addComponent(cube, RenderFilter).wireframe = false;

const sphere = scene.newEntity("Sphere");

const state = {
    x: 0,
    y: 0,
    z: 0,
    t: new Transform(),
    c: { "a": 0 }
}

createYoffeeElement("vector-controller", (props) => {
    // Expects vec to be a Vector
    // fieldkey to be string
    const myState = props.vec;
    if (myState.constructor.name !== "Vector") return html()``;

    return html(myState)`
    <div style="display: flex; justify-content: space-between; overflow-x: auto;">
        ${() => Object.entries(myState).map(([key, value]) => {
        if (key.startsWith("_")) return;
        const inputState = { value };
        return html()`
            <div style="">
                <div>${key}</div>
                <input type="number" style="width: 80%;" ${inputState} onchange=${({ currentTarget }) => myState[key] = Number(currentTarget.value)}>
            </div>`
    })}
    </div>`;
});

createYoffeeElement("transform-controller", (props) => {
    const t = scene.getComponent(props.entity, Transform);
    if (t === undefined) return html`<div>Transform not found</div>`;
    return html(props)`
    <div>
    <p>Transform</p>
    ${() => ["position", "rotation", "scale"].map(key => {
        let t = scene.getComponent(props.entity, Transform);
        return html(t)`
        <generic-controller fieldkey=${key} value=${t[key]}></generic-controller>
    `}
    )}
    </div>
    `;
});

const getValueName = o => {
    // Primitive types are:
    //  - string
    //  - bool
    //  - number
    // We also have Array (object types)
    return o instanceof Object ? o.constructor.name : typeof (o);
}

createYoffeeElement("generic-controller", (props) => {
    if (props.fieldkey.startsWith("_") || props.value === undefined || props.value.constructor === undefined) return html()``;
    if (props.value instanceof Vector) {
        return html(props)`
        <div>
            <vector-controller fieldkey=${props.key} vec=${props.value}></vector-controller>
        </div>
        `
    }
    const inputState = { value: props.value };
    if (props.type === "Number") {
        return html(props, inputState)`
        <div style="display: flex; align-items: center;">
            <div>${props.fieldkey}</div>
            <input 
                type="number" 
                ${() => inputState} 
                onchange=${({ currentTarget }) => props.onfatherupdate(Number(currentTarget.value))}>
        </div>`
    }

    if (props.type === "String") {
        return html(props, inputState)`
        <div style="display: flex; align-items: center;">
            <div>${props.fieldkey}</div>
            <input type="text" ${() => inputState} onchange=${({ currentTarget }) => props.value = Number(currentTarget.value)}>
        </div>`
    }

    if (props.type === "Transform") {
        return html()`Ohhh shit!!`;
    }

    return html()`${props.fieldkey} ${JSON.stringify(props)}`;
});

createYoffeeElement("rigidbody-controller", (props) => {
    const tO = scene.getComponent(props.entity, Rigidbody);
    if (tO === undefined) return html`<div>Rigidbody not found</div>`;
    return html(props)`
    <div>
        <p>Rigidbody</p>
        ${() => ["velocity", "mass"].map(key => {
        let t = scene.getComponent(props.entity, Rigidbody);
        return html(props)`
                <generic-controller 
                    fieldkey=${() => key} 
                    value=${() => t[key]} 
                    type=${() => t[key].constructor.name}
                    onfatherupdate=${(v) => t[key] = v}}>
                </generic-controller>`
    })
        }
    </div>
    `
});

createYoffeeElement("tag-controller", (props) => {
    const t = scene.getComponent(props.entity, Tag);
    if (t === undefined) return html`<div>Tag not found</div>`;
    return html(props)`
    <div>
        <p>Tag</p>
        ${() => ["name"].map(key => {
        let t = scene.getComponent(props.entity, Tag);
        return html(t)`
                <generic-controller 
                    fieldkey=${() => key} 
                    value=${() => t.name} 
                    type=${() => t.name.constructor.name}>
                </generic-controller>`
    })
        }
    </div>
    `
});


createYoffeeElement("entity-controller", (props) => {
    return html(props)`
    <div class="right">
    <tag-controller entity=${() => props.entity}></tag-controller>
    <transform-controller entity=${() => props.entity}></transform-controller>
    <rigidbody-controller entity=${() => props.entity}></rigidbody-controller>
    </div
    `;
});

const AppState = {
    selectedEntity: 0
};

createYoffeeElement('component-view', () => {
    return html(AppState)`
    <div>
        <entity-controller entity=${() => AppState.selectedEntity}></entity-controller>
    </div>
    `;
})

createYoffeeElement('scene-view', () => {
    return html()`
    <div>
        ${() => scene.getEntities().map(({ id }) => html()`
            <div onclick=${() => AppState.selectedEntity = id}>
                ${scene.getComponent(id, Tag).name}
            </div>
        `)}
    </div>
    `;
})

const main = async () => {
    // scene.getEntities().forEach(({ id }) => {
    //     const entityController = document.createElement("entity-controller");
    //     entityController.entity = id;
    //     document.body.appendChild(entityController);
    // });

    await new Promise(r => setTimeout(r, 3000));
    scene.getComponent(0, Transform).position.x = 1337;
    state.x = 1221321;
    scene.getComponent(0, Tag).name = "Brutha";
    scene.getComponent(0, Rigidbody).mass += 11;
}

document.addEventListener("DOMContentLoaded", main);