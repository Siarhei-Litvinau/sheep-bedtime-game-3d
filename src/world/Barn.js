import * as THREE from 'three';
import { orientUpForward } from './surface.js';
import { ZzzPulse } from '../effects/ZzzPulse.js';

const BODY_COLOR = 0x5c3a30; // приглушённый коричнево-красный, не насыщенный
const ROOF_COLOR = 0x3a2620; // темнее корпуса
const DOOR_COLOR = 0x281a14;
const WINDOW_BASE_COLOR = 0x1c130d; // тёмное стекло — как обычная (освещённая сценой) поверхность
const BLACK = new THREE.Color(0x000000);
const WINDOW_GLOW = new THREE.Color(0xffcf8e); // emissive — светится поверх ночного затемнения
const WINDOW_TRANSITION = 0.7; // сек на плавное разгорание окна

const BODY_WIDTH = 2.6;
const BODY_HEIGHT = 1.6;
const BODY_DEPTH = 2.0;
const ROOF_HEIGHT = 1.1;

/**
 * Амбар (раздел 5.5) — конечная точка, индикатор прогресса сессии. Окна
 * зажигаются по одному тёплым светом на каждую заснувшую овцу; редкий
 * ZZZ-спрайт всплывает над крышей как вторичный акцент.
 */
export class Barn {
  constructor({ windowCount = 8 } = {}) {
    this.group = new THREE.Group();
    this.windows = [];
    this.litCount = 0;

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(BODY_WIDTH, BODY_HEIGHT, BODY_DEPTH),
      new THREE.MeshLambertMaterial({ color: BODY_COLOR })
    );
    body.position.y = BODY_HEIGHT / 2;
    this.group.add(body);

    // 4-сегментный конус даёт форму двускатной/шатровой крыши (раздел 5.5).
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(1, ROOF_HEIGHT, 4),
      new THREE.MeshLambertMaterial({ color: ROOF_COLOR })
    );
    roof.rotation.y = Math.PI / 4;
    roof.scale.set((BODY_WIDTH * 0.8) / Math.SQRT2, 1, (BODY_DEPTH * 0.8) / Math.SQRT2);
    roof.position.y = BODY_HEIGHT + ROOF_HEIGHT / 2 - 0.05;
    this.group.add(roof);

    // Дверь и окна — на "переднем" фасаде (локальный -Z, куда смотрит forwardHint).
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.9, 0.06),
      new THREE.MeshLambertMaterial({ color: DOOR_COLOR })
    );
    door.position.set(0, 0.45, -(BODY_DEPTH / 2 + 0.01));
    this.group.add(door);
    this.door = door;

    this._buildWindows(windowCount);

    this.zzz = new ZzzPulse(this.group, new THREE.Vector3(0, BODY_HEIGHT + ROOF_HEIGHT + 0.15, 0));
  }

  _buildWindows(windowCount) {
    const cols = Math.min(4, windowCount);
    const rows = Math.ceil(windowCount / cols);
    const winSize = 0.28;
    const marginX = 0.35;
    const marginTop = 0.3;
    const gapY = 0.2;

    const usableWidth = BODY_WIDTH - marginX * 2;
    const stepX = cols > 1 ? usableWidth / (cols - 1) : 0;

    let placed = 0;
    for (let r = 0; r < rows && placed < windowCount; r++) {
      for (let c = 0; c < cols && placed < windowCount; c++) {
        const material = new THREE.MeshLambertMaterial({ color: WINDOW_BASE_COLOR, emissive: 0x000000 });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(winSize, winSize, 0.04), material);
        const x = cols > 1 ? -usableWidth / 2 + c * stepX : 0;
        const y = BODY_HEIGHT - marginTop - r * (winSize + gapY);
        mesh.position.set(x, y, -(BODY_DEPTH / 2 + 0.01));
        this.group.add(mesh);
        this.windows.push({ material, value: 0, target: 0 });
        placed += 1;
      }
    }
  }

  /** Зажигает следующее тёмное окно. Возвращает false, если все уже горят. */
  lightNextWindow() {
    const next = this.windows[this.litCount];
    if (!next) return false;
    next.target = 1;
    this.litCount += 1;
    return true;
  }

  reset() {
    this.litCount = 0;
    for (const w of this.windows) {
      w.target = 0;
      w.value = 0;
      w.material.emissive.copy(BLACK);
    }
  }

  update(dt) {
    for (const w of this.windows) {
      if (w.value !== w.target) {
        const step = dt / WINDOW_TRANSITION;
        w.value = w.target > w.value ? Math.min(w.value + step, 1) : Math.max(w.value - step, 0);
        w.material.emissive.copy(BLACK).lerp(WINDOW_GLOW, w.value);
      }
    }
    this.zzz.update(dt);
  }

  /** Ставит амбар на поверхность планеты, дверью к forwardHint. */
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
}
