import * as THREE from 'three';

let sharedTexture = null;

function getZTexture() {
  if (sharedTexture) return sharedTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffe9c7';
  ctx.font = 'bold 46px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('z', size / 2, size / 2 + 2);
  sharedTexture = new THREE.CanvasTexture(canvas);
  return sharedTexture;
}

/**
 * Редкий вторичный акцент (разделы 5.1, 5.5): ZZZ-спрайт изредка всплывает
 * над крышей амбара и растворяется. Дёшево — один спрайт за раз, текстура
 * общая на все экземпляры.
 */
export class ZzzPulse {
  constructor(parent, origin) {
    this.parent = parent;
    this.origin = origin;
    this.active = [];
    this.cooldown = randomInterval();
  }

  update(dt) {
    this.cooldown -= dt;
    if (this.cooldown <= 0) {
      this._spawn();
      this.cooldown = randomInterval();
    }

    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.age += dt;
      const t = Math.min(p.age / p.life, 1);

      p.sprite.position.copy(this.origin).addScaledVector(p.drift, t);
      p.sprite.material.opacity = Math.sin(Math.PI * t) * 0.8;
      p.sprite.scale.setScalar(0.3 + t * 0.15);

      if (p.age >= p.life) {
        this.parent.remove(p.sprite);
        p.sprite.material.dispose();
        this.active.splice(i, 1);
      }
    }
  }

  _spawn() {
    const material = new THREE.SpriteMaterial({
      map: getZTexture(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(this.origin);
    sprite.scale.setScalar(0.3);
    this.parent.add(sprite);

    this.active.push({
      sprite,
      age: 0,
      life: 2.4,
      drift: new THREE.Vector3(0.12 + Math.random() * 0.1, 0.55 + Math.random() * 0.2, 0),
    });
  }
}

function randomInterval() {
  return 6 + Math.random() * 8; // "редкий" — раз в 6–14 сек
}
