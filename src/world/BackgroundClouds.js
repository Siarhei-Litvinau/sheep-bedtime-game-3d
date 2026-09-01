import * as THREE from 'three';

const DAY_CLOUD_COLOR = 0xfaf3e6; // светлый нейтральный
const NIGHT_CLOUD_COLOR = 0xcdb9a6; // на тёмной половине неба чуть теплее звёзд вокруг

/**
 * Декоративные облака фона (раздел 5.8) — та же сборка, что у NPC-облака
 * (5.4: несколько пересекающихся сфер), но без лица и интерактивности,
 * статичные, инстансированные для заполнения неба. Все "блобы" одной
 * стороны — один InstancedMesh, один draw call.
 */
export class BackgroundClouds {
  constructor(clusters) {
    this.group = new THREE.Group();

    this._buildSide(
      clusters.filter((c) => c.day),
      DAY_CLOUD_COLOR
    );
    this._buildSide(
      clusters.filter((c) => !c.day),
      NIGHT_CLOUD_COLOR
    );
  }

  _buildSide(clusters, color) {
    const blobs = [];
    for (const cluster of clusters) {
      const blobCount = 4 + Math.floor(Math.random() * 3); // 4–6 сфер на облако
      for (let i = 0; i < blobCount; i++) {
        blobs.push({
          x: cluster.x + (Math.random() * 2 - 1) * cluster.spread,
          y: cluster.y + (Math.random() * 2 - 1) * cluster.spread * 0.35,
          z: cluster.z + (Math.random() * 2 - 1) * cluster.spread,
          scale: cluster.scale * (0.55 + Math.random() * 0.6),
        });
      }
    }
    if (blobs.length === 0) return;

    const geometry = new THREE.SphereGeometry(1, 6, 5);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, blobs.length);

    const dummy = new THREE.Object3D();
    blobs.forEach((b, i) => {
      dummy.position.set(b.x, b.y, b.z);
      dummy.scale.setScalar(b.scale);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;

    this.group.add(mesh);
  }

  addTo(scene) {
    scene.add(this.group);
    return this;
  }
}
