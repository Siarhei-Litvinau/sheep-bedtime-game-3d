import * as THREE from 'three';

/**
 * Даёт точку на поверхности планеты по локальным (x, z) — используется для
 * расстановки объектов (забор, овцы, амбар, деревья) так, чтобы они стояли
 * на изогнутой поверхности планеты (раздел 5.10), а не на плоской земле.
 */
export function createSurfaceSampler(planet) {
  const radius = planet.radius;
  const center = planet.mesh.position;

  return function surfacePoint(x, z) {
    const clampedSq = Math.min(x * x + z * z, radius * radius * 0.98);
    const y = Math.sqrt(radius * radius - clampedSq);
    const local = new THREE.Vector3(x, y, z);
    const normal = local.clone().normalize();
    const position = local.add(center);
    return { position, normal };
  };
}

/**
 * Ортонормированный базис в точке поверхности: up = нормаль поверхности,
 * forward = проекция forwardHint на касательную плоскость, right = forward × up.
 */
function tangentFrame(up, forwardHint) {
  const u = up.clone().normalize();
  let f = forwardHint.clone();
  f.sub(u.clone().multiplyScalar(f.dot(u)));

  if (f.lengthSq() < 1e-8) {
    const fallback = Math.abs(u.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
    f = fallback.sub(u.clone().multiplyScalar(fallback.dot(u)));
  }
  f.normalize();

  const right = new THREE.Vector3().crossVectors(f, u).normalize();
  return { right, up: u, forward: f };
}

/** Кватернион для объектов с локальным +Y = "верх" и локальным -Z = "перёд" (овца, NPC). */
export function orientUpForward(up, forwardHint) {
  const { right, up: u, forward } = tangentFrame(up, forwardHint);
  const back = forward.clone().negate();
  const m = new THREE.Matrix4().makeBasis(right, u, back);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

/** Кватернион для объектов, вытянутых вдоль локального +X (жерди, столбы забора). */
export function orientAlongTangent(up, tangentHint) {
  const { right, up: u, forward } = tangentFrame(up, tangentHint);
  const m = new THREE.Matrix4().makeBasis(forward, u, right);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}
