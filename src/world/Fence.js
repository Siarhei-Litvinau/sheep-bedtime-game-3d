import * as THREE from 'three';
import { orientAlongTangent } from './surface.js';

const WOOD_COLOR = 0x2a2019;

const POST_HEIGHT = 0.9;
const POST_RADIUS = 0.045;
const RAIL_THICKNESS = 0.06;
const RAIL_DEPTH = 0.05;
const RAIL_HEIGHTS = [0.35, 0.68]; // нижняя и верхняя жердь над поверхностью

/**
 * Забор (раздел 5.6) — статичный композиционный якорь, задаёт линию
 * горизонта поперёк экрана (вдоль X), пересекая границу день/ночь
 * планеты по центру. Столбы и жерди инстансированы (InstancedMesh),
 * геометрия переиспользуется — весь забор укладывается в два draw call'а.
 */
export class Fence {
  constructor(surfacePoint, { z = 4, xFrom = -6.5, xTo = 6.5, spacing = 1.0 } = {}) {
    const postCount = Math.floor((xTo - xFrom) / spacing) + 1;

    const postGeometry = new THREE.CylinderGeometry(POST_RADIUS * 0.8, POST_RADIUS, POST_HEIGHT, 6);
    const railGeometry = new THREE.BoxGeometry(1, RAIL_THICKNESS, RAIL_DEPTH);
    const material = new THREE.MeshLambertMaterial({ color: WOOD_COLOR });

    const postMesh = new THREE.InstancedMesh(postGeometry, material, postCount);
    const railMesh = new THREE.InstancedMesh(railGeometry, material, (postCount - 1) * RAIL_HEIGHTS.length);

    const dummy = new THREE.Object3D();
    const points = [];
    const tangentHint = new THREE.Vector3(0, 0, 1);

    for (let i = 0; i < postCount; i++) {
      const x = xFrom + i * spacing;
      const { position, normal } = surfacePoint(x, z);
      points.push({ position, normal });

      dummy.position.copy(position).addScaledVector(normal, POST_HEIGHT / 2);
      dummy.quaternion.copy(orientAlongTangent(normal, tangentHint));
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      postMesh.setMatrixAt(i, dummy.matrix);
    }

    let railIndex = 0;
    for (let i = 0; i < postCount - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const tangent = b.position.clone().sub(a.position);
      const length = tangent.length();
      const midNormal = a.normal.clone().add(b.normal).normalize();
      const midPos = a.position.clone().add(b.position).multiplyScalar(0.5);

      for (const height of RAIL_HEIGHTS) {
        dummy.position.copy(midPos).addScaledVector(midNormal, height);
        dummy.quaternion.copy(orientAlongTangent(midNormal, tangent));
        dummy.scale.set(length, 1, 1);
        dummy.updateMatrix();
        railMesh.setMatrixAt(railIndex, dummy.matrix);
        railIndex += 1;
      }
    }

    postMesh.instanceMatrix.needsUpdate = true;
    railMesh.instanceMatrix.needsUpdate = true;

    this.group = new THREE.Group();
    this.group.add(postMesh, railMesh);
  }

  addTo(scene) {
    scene.add(this.group);
    return this;
  }
}
