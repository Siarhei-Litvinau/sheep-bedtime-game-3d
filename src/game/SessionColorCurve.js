import * as THREE from 'three';

// Раздел 6: цветовая/световая кривая сессии — функция прогресса 0..1.
// Красный спектр исключён полностью; на светлой стороне остаётся только
// тёплый оранжево-персиковый закат, на тёмной — приглушённый холодный
// без яркого синего.
const BRIGHTNESS_START = 1.0;
const BRIGHTNESS_END = 0.5;

const DAY_COLOR_START = new THREE.Color(0xf2b98a);
const DAY_COLOR_END = new THREE.Color(0xe0895a); // ниже цветовая температура — глубже, теплее заката

const NIGHT_COLOR_START = new THREE.Color(0x2e3050);
const NIGHT_COLOR_END = new THREE.Color(0x1b1c30); // приглушённее, но не ярко-синее

const SKY_COLOR_START = new THREE.Color(0x0e0b16);
const SKY_COLOR_END = new THREE.Color(0x07060d);

const SUN_COLOR_START = new THREE.Color(0xffd9a8);
const SUN_COLOR_END = new THREE.Color(0xffb489);
const SUN_INTENSITY_START = 1.2;
const SUN_INTENSITY_END = 0.5;

// Луна (раздел 3 ревизии) — приглушённый холодный боковой свет тёмной
// половины, отдельный от тёплого sun-света. Не насыщенно-синий.
const MOON_COLOR_START = new THREE.Color(0x8a97b8);
const MOON_COLOR_END = new THREE.Color(0x6c7896);
const MOON_INTENSITY_START = 0.4;
const MOON_INTENSITY_END = 0.22;

const FILL_INTENSITY_START = 0.55;
const FILL_INTENSITY_END = 0.28;

// Граница день/ночь медленно смещается по дуге планеты синхронно с
// прогрессом сессии — лёгкий дрейф "солнца", а не полный оборот.
// Ориентация зафиксирована (camera-and-layout-revision.md, раздел 1):
// светлая половина — слева от камеры (x<0), тёмная — справа (x>0).
// uDayDir = (cosθ, sinθ) — угол PI даёт (-1,0), т.е. день на x<0.
const TERMINATOR_ANGLE_START = Math.PI;
const TERMINATOR_ANGLE_END = Math.PI + 0.3;

// Положение "солнца" — независимый угол поворота вокруг Y для того же
// базового вектора (уже отражённого по X, чтобы солнце висело над
// светлой половиной): вращение здесь не обязано совпадать по знаку с
// TERMINATOR_ANGLE выше, это разные параметризации (прямое direction
// vs. поворот фиксированного вектора).
const SUN_ANGLE_START = 0;
const SUN_ANGLE_END = -0.3;

const SUN_BASE_DIR = new THREE.Vector3(-14, 16, 6);

/**
 * Обновляет яркость/насыщенность/цветовую температуру сцены и позицию
 * границы день-ночь по прогрессу сессии (раздел 6). Вызывается каждый
 * кадр из main.js с текущим breathingCycle.progressAt(elapsed).
 */
export class SessionColorCurve {
  constructor({ planet, scene, sun, moon, fill }) {
    this.planet = planet;
    this.scene = scene;
    this.sun = sun;
    this.moon = moon;
    this.fill = fill;
    this._day = new THREE.Color();
    this._night = new THREE.Color();
    this._sky = new THREE.Color();
    this._sunColor = new THREE.Color();
    this._moonColor = new THREE.Color();
  }

  update(progress) {
    const p = THREE.MathUtils.clamp(progress, 0, 1);
    const brightness = THREE.MathUtils.lerp(BRIGHTNESS_START, BRIGHTNESS_END, p);

    this._day.copy(DAY_COLOR_START).lerp(DAY_COLOR_END, p).multiplyScalar(brightness);
    this._night.copy(NIGHT_COLOR_START).lerp(NIGHT_COLOR_END, p).multiplyScalar(brightness);
    this.planet.setColors(this._day, this._night);

    const terminatorAngle = THREE.MathUtils.lerp(TERMINATOR_ANGLE_START, TERMINATOR_ANGLE_END, p);
    this.planet.setTerminatorAngle(terminatorAngle);

    this._sky.copy(SKY_COLOR_START).lerp(SKY_COLOR_END, p);
    this.scene.background.copy(this._sky);
    if (this.scene.fog) this.scene.fog.color.copy(this._sky);

    // Позиция "солнца" следует за той же дугой смещения, что и терминатор
    // планеты, но собственным углом (см. комментарий у SUN_ANGLE_* выше).
    const sunAngle = THREE.MathUtils.lerp(SUN_ANGLE_START, SUN_ANGLE_END, p);
    this.sun.position.copy(SUN_BASE_DIR).applyAxisAngle(new THREE.Vector3(0, 1, 0), sunAngle);
    this._sunColor.copy(SUN_COLOR_START).lerp(SUN_COLOR_END, p);
    this.sun.color.copy(this._sunColor);
    this.sun.intensity = THREE.MathUtils.lerp(SUN_INTENSITY_START, SUN_INTENSITY_END, p);

    // Луна — статична по позиции (боковая, тёмная половина не имеет своей
    // "дуги дня"), меняется только по цвету/интенсивности вместе с общей
    // яркостью сессии, синхронно с sun/fill.
    this._moonColor.copy(MOON_COLOR_START).lerp(MOON_COLOR_END, p);
    this.moon.color.copy(this._moonColor);
    this.moon.intensity = THREE.MathUtils.lerp(MOON_INTENSITY_START, MOON_INTENSITY_END, p);

    this.fill.intensity = THREE.MathUtils.lerp(FILL_INTENSITY_START, FILL_INTENSITY_END, p);
  }
}
