import { createTransformationMatrix } from "./affine";

export class AABB {
    constructor(min, max) {
        this.min = min;
        this.max = max;
    }

    intersects(other) {
        return !(this.max.x < other.min.x || this.min.x > other.max.x ||
                 this.max.y < other.min.y || this.min.y > other.max.y);
    }

    contains(point) {
        return point.x >= this.min.x && point.x <= this.max.x &&
               point.y >= this.min.y && point.y <= this.max.y;
    }

    static fromOriginAndExtent(origin, extent) {
        return new AABB(origin.sub(extent), origin.add(extent));
    }

    getExtent() {
        return this.max.sub(this.min);
    }

    getOrigin() {
        return this.max.add(this.min).scale(1/2);
    }

    getModelMatrix() {
        return createTransformationMatrix(this.getOrigin(), 0, this.getExtent());
    }
}

export class Sphere {
    constructor(center, radius) {
        this.center = center;
        this.radius = radius;
    }

    intersects(other) {
        return this.center.distanceTo(other.center) < this.radius + other.radius;
    }

    contains(point) {
        return this.center.distanceTo(point) < this.radius;
    }
}