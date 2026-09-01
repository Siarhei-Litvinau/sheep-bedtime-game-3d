import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { orientUpForward } from './surface.js';

const BODY_COLOR = 0xe8ddc8; // тёплый кремовый, низкая насыщенность
const DARK_COLOR = 0x3c332c; // морда/ноги — графитово-коричневый

/**
 * Овца (раздел 5.1) — главный объект сцены. Собирает силуэт/палитру и
 * выставляет наружу ссылки на тело/голову/материалы, которыми управляет
 * SheepAnimator (п.3: idle/charge/jump/land/walk_sleepy/yawn).
 *
 * Производительность (раздел 8): анимируются только тело (squash/stretch)
 * и голова (наклон/зевок) — уши и ноги статичны и склеены в один меш,
 * хвост склеен прямо с телом. Вместо 8 draw call'ов на овцу — 3, что
 * ощутимо при очереди из 12–15 овец одновременно на сцене.
 */
export class Sheep {
  constructor() {
    this.group = new THREE.Group();

    this.bodyMaterial = new THREE.MeshLambertMaterial({
      color: BODY_COLOR,
      transparent: true,
      emissive: 0x000000,
    });
    this.darkMaterial = new THREE.MeshLambertMaterial({
      color: DARK_COLOR,
      transparent: true,
    });

    // Тело + хвост — общая геометрия (хвост тянется вместе с телом при
    // squash/stretch, что естественно смотрится на прыжке/приземлении).
    const bodyGeo = new THREE.SphereGeometry(0.5, 14, 10);
    bodyGeo.scale(1.05, 0.85, 1.0);
    bodyGeo.translate(0, 0.5, 0);

    const tailGeo = new THREE.SphereGeometry(0.09, 8, 6);
    tailGeo.translate(0, 0.55, 0.5);

    this.body = new THREE.Mesh(mergeGeometries([bodyGeo, tailGeo]), this.bodyMaterial);
    this.group.add(this.body);

    // Голова — отдельный меш: анимируется независимо (наклон при ходьбе, зевок).
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8), this.darkMaterial);
    this.head.position.set(0, 0.62, -0.52);
    this.group.add(this.head);

    // Уши и ноги — статичны (SheepAnimator их не трогает), склеены в один draw call.
    const staticParts = [];

    const earGeometry = new THREE.ConeGeometry(0.09, 0.2, 6);
    for (const side of [-1, 1]) {
      const ear = earGeometry.clone();
      ear.scale(1, 1, 0.4);
      ear.rotateX(-0.3);
      ear.rotateZ(side * 0.9);
      ear.translate(side * 0.2, 0.75, -0.48);
      staticParts.push(ear);
    }

    const legGeometry = new THREE.CylinderGeometry(0.045, 0.05, 0.42, 6);
    const legOffsets = [
      [0.22, -0.32],
      [-0.22, -0.32],
      [0.22, 0.28],
      [-0.22, 0.28],
    ];
    for (const [x, z] of legOffsets) {
      const leg = legGeometry.clone();
      leg.translate(x, 0.21, z);
      staticParts.push(leg);
    }

    this.staticDark = new THREE.Mesh(mergeGeometries(staticParts), this.darkMaterial);
    this.group.add(this.staticDark);
  }

  /** Ставит овцу на поверхность планеты в точке (x, z), лицом к forwardHint. */
  placeOnSurface(surfacePoint, x, z, forwardHint) {
    const { position, normal } = surfacePoint(x, z);
    this.group.position.copy(position);
    this.group.quaternion.copy(orientUpForward(normal, forwardHint));
    return this;
  }

  addTo(scene) {
    scene.add(this.group);
    return this;
  }

  removeFrom(scene) {
    scene.remove(this.group);
    return this;
  }

  /** Освобождает геометрии/материалы — вызывать при выбытии овцы из очереди (раздел 3/11.6). */
  dispose() {
    const disposedGeometries = new Set();
    const disposedMaterials = new Set();
    this.group.traverse((obj) => {
      if (obj.geometry && !disposedGeometries.has(obj.geometry)) {
        obj.geometry.dispose();
        disposedGeometries.add(obj.geometry);
      }
      if (obj.material && !disposedMaterials.has(obj.material)) {
        obj.material.dispose();
        disposedMaterials.add(obj.material);
      }
    });
  }
}
