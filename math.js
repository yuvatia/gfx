export class Point {
    constructor(x, y, z = 0, w = 1) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
    }

    toArray() {
        return [this.x, this.y, this.z, this.w];
    }

    toString() {
        return `(${this.x.toFixed(2)}, ${this.y.toFixed(2)}, ${this.z.toFixed(2)}, ${this.w.toFixed(2)})`;
    }

    multiply(scalar) {
        return new Point(this.x * scalar, this.y * scalar, this.z * scalar, this.w * scalar);
    }

    toVector() {
        return new Vector(this.x, this.y, this.z);
    }
}

export class Vector {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    static zero = new Vector(0, 0, 0);

    toPoint() {
        return new Point(this.x, this.y, this.z);
    }

    add(vector) {
        return new Vector(
            this.x + vector.x,
            this.y + vector.y,
            this.z + vector.z
        );
    }

    neg() {
        return new Vector(-this.x, -this.y, -this.z);
    }

    scale(scalar) {
        return new Vector(this.x * scalar, this.y * scalar, this.z * scalar);
    }

    divide(scalar) {
        return this.scale(1 / scalar);
    }

    sub(vector) {
        return this.add(vector.neg());
    }

    crossProduct(vector) {
        return new Vector(
            this.y * vector.z - this.z * vector.y,
            this.z * vector.x - this.x * vector.z,
            this.x * vector.y - this.y * vector.x
        );
    }

    magnitude() {
        return Math.sqrt(this.magnitude2());
    }

    magnitude2() {
        return this.dotProduct(this);
    }

    normalize() {
        let mag = this.magnitude();
        // Avoid zero division
        if (mag === 0) { return new Vector(0, 0, 0);  };
        return new Vector(
            this.x / mag,
            this.y / mag,
            this.z / mag
        );
    }

    dotProduct(vector) {
        return this.x * vector.x + this.y * vector.y + this.z * vector.z;
    }

    toArray() {
        return [this.x, this.y, this.z];
    }

    toString() {
        return `(${this.x.toFixed(2)}, ${this.y.toFixed(2)}, ${this.z.toFixed(2)})`;
    }
}

// Column major
export class Matrix {
    constructor(elements) {
        this.elements = elements || Array.from({ length: 16 }, (_, i) => (i % 5 === 0 ? 1 : 0)); // Identity matrix
    }

    static identity = new Matrix();

    multiplyPoint(point) {
        const [x, y, z, w] = point.toArray();
        // const w = 1;
        const e = this.elements;
        const newX = e[0] * x + e[1] * y + e[2] * z + e[3] * w;
        const newY = e[4] * x + e[5] * y + e[6] * z + e[7] * w;
        const newZ = e[8] * x + e[9] * y + e[10] * z + e[11] * w;
        const newW = e[12] * x + e[13] * y + e[14] * z + e[15] * w;
        return new Point(newX, newY, newZ, newW);
    }

    multiplyVector(vector) {
        const [x, y, z] = vector.toArray();
        const e = this.elements;
        const newX = e[0] * x + e[1] * y + e[2] * z;
        const newY = e[4] * x + e[5] * y + e[6] * z;
        const newZ = e[8] * x + e[9] * y + e[10] * z;
        return new Vector(newX, newY, newZ);
    }

    // if this=A and matrix=B, returns A*B
    multiplyMatrix(other) {
        const matrix = other.elements;
        const result = new Array(16).fill(0);

        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                result[j * 4 + i] =
                    this.elements[j * 4] * matrix[i] +
                    this.elements[j * 4 + 1] * matrix[i + 4] +
                    this.elements[j * 4 + 2] * matrix[i + 8] +
                    this.elements[j * 4 + 3] * matrix[i + 12];
            }
        }

        return new Matrix(result);
    }

    // Transpose column major matrix
    transpose() {
        const transposed = new Array(16);
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                transposed[i * 4 + j] = this.elements[j * 4 + i];
            }
        }
        return new Matrix(transposed);
    }

    toString() {
        let str = "{";
        for (let i = 0; i < 4; i++) {
            //str += "{";
            for (let j = 0; j < 4; j++) {
                str += this.elements[i * 4 + j].toFixed(2);
                if (j < 3) str += ", ";
            }
            // str += "}";
            str += "\n";
            if (i < 3) str += ", ";
        }
        return str;
    }
}
