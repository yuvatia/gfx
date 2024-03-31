import { Serializable } from "./reviver.js";

export class Point extends Serializable {
    constructor(x, y, z = 0, w = 1) {
        super();
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

export class Vector extends Serializable {
    constructor(x, y, z) {
        super();
        this.x = x;
        this.y = y;
        this.z = z;
    }

    static zero = new Vector(0, 0, 0);
    static one = new Vector(1, 1, 1);

    isNaN() {
        return isNaN(this.x) || isNaN(this.y) || isNaN(this.z);
    }

    toPoint() {
        return new Point(this.x, this.y, this.z);
    }

    clone() {
        return new Vector(this.x, this.y, this.z);
    }

    distance(p2) {
        // as points
        return this.sub(p2).magnitude();
    }

    distance2(p2) {
        return this.sub(p2).magnitude2();
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

    mod(scalar) {
        return new Vector(this.x % scalar, this.y % scalar, this.z % scalar);
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
        if (mag === 0) { return new Vector(0, 0, 0); };
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

    equals(other, epsilon = 0.0001) {
        return (
            Math.abs(this.x - other.x) < epsilon &&
            Math.abs(this.y - other.y) < epsilon &&
            Math.abs(this.z - other.z) < epsilon
        );
    }
}

// Column major
export class Matrix extends Serializable {
    constructor(elements, inverted = null) {
        super();
        this.elements = elements || Array.from({ length: 16 }, (_, i) => (i % 5 === 0 ? 1 : 0)); // Identity matrix
    }

    static identity = new Matrix();

    clone() {
        return new Matrix(this.elements.slice());
    }

    isIdentity() {
        return this.equals(Matrix.identity);
    }

    isNaN() {
        return this.elements.some(isNaN);
    }

    static inverseMatrix3x3(matrix) {
        // https://ardoris.wordpress.com/2008/07/18/general-formula-for-the-inverse-of-a-3x3-matrix/
        const m = matrix.elements;

        // Extract the upper-left 3x3 portion of the matrix
        const a00 = m[0], a01 = m[1], a02 = m[2];
        const a10 = m[4], a11 = m[5], a12 = m[6];
        const a20 = m[8], a21 = m[9], a22 = m[10];

        // Calculate determinant
        const det = matrix.determinant();

        if (det === 0) {
            return null;
        }

        // Calculate inverse determinant
        const invDet = 1.0 / det;

        // Calculate the inverse 3x3 matrix
        const b00 = (a11 * a22 - a12 * a21) * invDet;
        const b01 = (a02 * a21 - a01 * a22) * invDet;
        const b02 = (a01 * a12 - a02 * a11) * invDet;
        const b10 = (a12 * a20 - a10 * a22) * invDet;
        const b11 = (a00 * a22 - a02 * a20) * invDet;
        const b12 = (a02 * a10 - a00 * a12) * invDet;
        const b20 = (a10 * a21 - a11 * a20) * invDet;
        const b21 = (a01 * a20 - a00 * a21) * invDet;
        const b22 = (a00 * a11 - a01 * a10) * invDet;

        return new Matrix([
            b00, b01, b02, 0,
            b10, b11, b12, 0,
            b20, b21, b22, 0,
            0, 0, 0, 1
        ]);
    }

    static createFromDirections(forward, up, right) {
        // return this.createFromAxes(forward, up, right);
        return this.createFromAxes(right, up, forward);
    }

    static createFromAxes(xAxis, yAxis, zAxis) {
        const [xx, xy, xz] = xAxis.toArray();
        const [yx, yy, yz] = yAxis.toArray();
        const [zx, zy, zz] = zAxis.toArray();
        return new Matrix([
            xx, xy, xz, 0,
            yx, yy, yz, 0,
            zx, zy, zz, 0,
            0, 0, 0, 1
        ]);
    }

    static createDiagonal(vec) {
        const [x, y, z] = vec.toArray();
        return new Matrix([
            x, 0, 0, 0,
            0, y, 0, 0,
            0, 0, z, 0,
            0, 0, 0, 1
        ]);
    }

    static createSkewSymmetric(vector) {
        // Column-major
        const [x, y, z] = vector.toArray();
        return new Matrix([
            0, -z, y, 0,
            z, 0, -x, 0,
            -y, x, 0, 0,
            0, 0, 0, 1
        ]);
    }

    static createCrossMatrix(vector) {
        return this.createSkewSymmetric(vector);
    }

    determinant() {
        // Column-major
        const e = this.elements;
        return (
            e[0] * e[5] * e[10] * e[15] + e[0] * e[9] * e[14] * e[7] + e[0] * e[13] * e[6] * e[11] +
            e[4] * e[1] * e[14] * e[11] + e[4] * e[9] * e[2] * e[15] + e[4] * e[13] * e[10] * e[3] +
            e[8] * e[1] * e[6] * e[15] + e[8] * e[5] * e[14] * e[3] + e[8] * e[13] * e[2] * e[7] +
            e[12] * e[1] * e[10] * e[7] + e[12] * e[5] * e[2] * e[11] + e[12] * e[9] * e[6] * e[3] -
            e[0] * e[5] * e[14] * e[11] - e[0] * e[9] * e[6] * e[15] - e[0] * e[13] * e[10] * e[7] -
            e[4] * e[1] * e[10] * e[15] - e[4] * e[9] * e[14] * e[3] - e[4] * e[13] * e[2] * e[11] -
            e[8] * e[1] * e[14] * e[7] - e[8] * e[5] * e[2] * e[15] - e[8] * e[13] * e[6] * e[3] -
            e[12] * e[1] * e[6] * e[11] - e[12] * e[5] * e[10] * e[3] - e[12] * e[9] * e[2] * e[7]
        );
    }

    inverseDiagonal() {
        const elements = this.elements.map((el, i) => ((i % 5 === 0 && el !== 0) ? 1.0 / el : el));
        return new Matrix(elements);
    }

    scaleBy(scalar) {
        return new Matrix(this.elements.map(el => el * scalar));
    }

    multiplyPoint(point) {
        // TODO performance!!
        // ensure it really is a point then convert to array
        const [x, y, z, w] = new Point(...point.toArray()).toArray();
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

    addMatrix(other) {
        const result = new Array(16);
        for (let i = 0; i < 16; i++) {
            result[i] = this.elements[i] + other.elements[i];
        }
        // Make sure W remains 1
        result[15] = 1;
        return new Matrix(result);
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

    equals(other, epsilon = 0.0001) {
        return this.elements.every((el, i) => Math.abs(el - other.elements[i]) < epsilon);
    }
}

export const lerp = (v1, v2, t) => {
    return v1.add(v2.sub(v1).scale(t));
}
