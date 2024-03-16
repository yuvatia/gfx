export class SignalEmitter {
    constructor(name = "emitter") {
        this.listeners = [];
        // Name is here for debug purposes
        this.name = name;
    }

    waitForSignal() {
        return new Promise(resolve => {
            this.listeners.push(resolve);
        });
    }

    signalAll() {
        for (const listener of this.listeners) {
            listener();
        }
        this.listeners = []; // Clear listeners
    }
}
