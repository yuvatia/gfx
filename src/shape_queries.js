import { createTransformationMatrix } from "./affine.js";

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
        return this.max.add(this.min).scale(1 / 2);
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
        return this.center.distance(other.center) < this.radius + other.radius;
    }

    contains(point) {
        return this.center.distance(point) < this.radius;
    }

    distanceToPoint(point) {
        const d = this.center.distance(point) - this.radius;
        // if d < 0 then we have a penetration
        return d;
    }

    distanceToSphere(other) {
        return this.center.distance(other.center) - (this.radius + other.radius);
    }

    projectUnto(point) {
        // Connect line between center to point then scale to radius
        const direction = this.getDirectionToPoint(point);
        return this.center.add(direction.scale(this.radius));
    }

    getDirectionToPoint(point) {
        const direction = point.sub(this.center).normalize();
        return direction;
    }

    static getSphereSphereManifold(s1, s2) {
        if (!s1.intersects(s2)) {
            return null;
        }
        const d = s1.distanceToSphere(s2);
        const normal = s1.getDirectionToPoint(s2.center);
        const s1Contact = s1.projectUnto(s2.center);
        const s2Contact = s2.projectUnto(s1.center);

        return {
            depth: -d,
            normal,  // a -> b
            contactA: s1Contact,
            contactB: s2Contact
        };
    }

    static getSphereBoxContactPoints(sphere, box) {
        const closestPoint = box.getClosestPoint(sphere.center);
        const normal = sphere.getDirectionToPoint(closestPoint);
        const depth = sphere.distanceToPoint(closestPoint);
        return {
            depth,
            normal,
            contactA: sphere.projectUnto(closestPoint),
            contactB: closestPoint
        };
    }
}
