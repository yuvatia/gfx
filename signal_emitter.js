export class SignalEmitter {
    constructor() {
        this.listeners = [];
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
