import { Vector, Matrix, Point } from './math.js';

export function createRotationMatrixX(angle) {
    const radians = angle * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    return new Matrix([
        1, 0, 0, 0,
        0, cos, sin, 0,
        0, -sin, cos, 0,
        0, 0, 0, 1
    ]);
}

export function createRotationMatrixY(angle) {
    const radians = angle * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    return new Matrix([
        cos, 0, -sin, 0,
        0, 1, 0, 0,
        sin, 0, cos, 0,
        0, 0, 0, 1
    ]);
}

export function createRotationMatrixZ(angle) {
    const radians = angle * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    return new Matrix([
        cos, sin, 0, 0,
        -sin, cos, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ]);
}

export function createTranslationMatrix(translationVector) {
    const [x, y, z] = translationVector.toArray();
    return new Matrix([
        1, 0, 0, x,
        0, 1, 0, y,
        0, 0, 1, z,
        0, 0, 0, 1
    ]);
}

export function createScaleMatrix(scaleVector) {
    const [x, y, z] = scaleVector.toArray();
    return new Matrix([
        x, 0, 0, 0,
        0, y, 0, 0,
        0, 0, z, 0,
        0, 0, 0, 1
    ]);
}

export function createRotationMatrixXYZ(xRot, yRot, zRot) {
    const rotationX = createRotationMatrixX(xRot);
    const rotationY = createRotationMatrixY(yRot);
    const rotationZ = createRotationMatrixZ(zRot);
    const rotationXYZ = rotationX.multiplyMatrix(rotationY).multiplyMatrix(rotationZ);
    return rotationXYZ;
}

export function createaAxisAngleRotationMatrix(axis, angle) {
    // Angle is in degrees
    const theta = angle * Math.PI / 180;
    // Get axis coords
    const [x, y, z] = axis.toArray();

    // Rodriguez' formula in column-major matrix form
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    const oneMinusCosTheta = 1 - cosTheta;

    const xx = x * x;
    const xy = x * y;
    const xz = x * z;
    const yy = y * y;
    const yz = y * z;
    const zz = z * z;

    const xSinTheta = x * sinTheta;
    const ySinTheta = y * sinTheta;
    const zSinTheta = z * sinTheta;

    const rotationMatrix = new Matrix([
        xx * oneMinusCosTheta + cosTheta, xy * oneMinusCosTheta - zSinTheta, xz * oneMinusCosTheta + ySinTheta, 0,
        xy * oneMinusCosTheta + zSinTheta, yy * oneMinusCosTheta + cosTheta, yz * oneMinusCosTheta - xSinTheta, 0,
        xz * oneMinusCosTheta - ySinTheta, yz * oneMinusCosTheta + xSinTheta, zz * oneMinusCosTheta + cosTheta, 0,
        0, 0, 0, 1
    ]);

    return rotationMatrix;
}

export function invertRotation(rotationMatrix) {
    return rotationMatrix.transpose();
}

export function invertScale(scaleMatrix) {
    const [x, y, z] = [1 / scaleMatrix[0], 1 / scaleMatrix[5], 1 / scaleMatrix[10]];
    return createScaleMatrix(new Vector(x, y, z));
}

export function invertTranslation(translationMatrix) {
    let inverted = new Matrix(translationMatrix.elements);
    inverted.elements[4] = -inverted.elements[4];
    inverted.elements[8] = -inverted.elements[8];
    inverted.elements[12] = -inverted.elements[12];
    return inverted;
}

export function createTransformationMatrix(translationVector, rotationEuler = new Point(0, 0, 0), scaleVector = new Point(1, 1, 1)) {
    const translation = createTranslationMatrix(translationVector);
    const rotationXYZ = createRotationMatrixXYZ(...rotationEuler.toArray());
    const scale = createScaleMatrix(scaleVector);
    // Note: order is important. First we scale, then rotate (still origin is preserved), only then do we translate.
    // Order of rotation/scale seems unimportant however order of translation vs rotation is important because
    // rotation is around the origin.
    // So we have T * R * S
    // To inverse: (TRS)^(-1) = S^(-1) * R^T * T^(-1)
    
    return translation.multiplyMatrix(rotationXYZ).multiplyMatrix(scale);
    return scale.multiplyMatrix(rotationXYZ).multiplyMatrix(translation);
}

export function rotationToEulerAngles(matrix) {
    // Assuming the angles are in radians
    let sy = Math.sqrt(matrix[0] * matrix[0] + matrix[4] * matrix[4]);
    let singular = sy < 1e-6;
    let x, y, z;
    if (!singular) {
        x = Math.atan2(matrix[9], matrix[10]);
        y = Math.atan2(-matrix[8], sy);
        z = Math.atan2(matrix[4], matrix[0]);
    } else {
        x = Math.atan2(-matrix[6], matrix[5]);
        y = Math.atan2(-matrix[8], sy);
        z = 0;
    }
    return new Point(x, y, z);
}

export function CreateOrthographicMatrix(left, right, bottom, top, near, far) {
    // Transform some box shape defined by A(left, bottom, near) and B(right, top, far) to a unit cube
    // We do this by applying a transformation + scale.
    // Also note that we look down on the Z axis which is why there is 
    // a minus in the Z column
    return new Matrix([
        2 / (right - left), 0, 0, -(right + left) / (right - left),
        0, 2 / (top - bottom), 0, -(top + bottom) / (top - bottom),
        0, 0, -2 / (far - near), -(far + near) / (far - near),
        0, 0, 0, 1
    ]);
}

export function CreatePerspectiveMatrix(near, far) {
    return new Matrix([
        near, 0, 0, 0,
        0, near, 0, 0,
        0, 0, far + near, - far * near,
        0, 0, -1, 0
    ]);
}

export function CreateSymmetricOrthographicProjection(fov, aspect, near, far) {
    // Assuming symmetry, we know that ortho is actually given by (left, -left, bottom, -bottom, near, far)
    // so we only need to find left and top
    const fovRadians = fov * Math.PI / 180;
    const top = near * Math.tan(fovRadians / 2);
    const bottom = -top;
    const left = bottom * aspect;
    const right = top * aspect;
    const ortho = CreateOrthographicMatrix(left, right, bottom, top, near, far);
    return ortho;
}

export function CreatePerspectiveProjection(fov, aspect, near, far) {
    /*
    Short path
    */
    // const fovRadians = fov * Math.PI / 180;
    // const f = 1 / Math.tan(fovRadians / 2);
    // return new Matrix([
    //     f / aspect, 0, 0, 0,
    //     0, f, 0, 0,
    //     0, 0, (far + near) / (near - far), (2 * far * near) / (near - far),
    //     0, 0, -1, 0
    // ]);

    /*
    Long path
    */
    const ortho = CreateSymmetricOrthographicProjection(fov, aspect, near, far);
    const persp = CreatePerspectiveMatrix(near, far);
    // row-major: First apply perspective, then ortho
    // however, since we use column-major, we do persp*ortho
    return persp.multiplyMatrix(ortho);
    return ortho.multiplyMatrix(persp);
}
