import * as THREE from 'three';
import { createRenderer } from './core/renderer.js';
import { createCamera, updateCameraAspect } from './core/camera.js';
import { createLighting } from './core/lighting.js';
import { Planet } from './world/Planet.js';
import { Fence } from './world/Fence.js';
import { Barn } from './world/Barn.js';
import { createSurfaceSampler } from './world/surface.js';
import { SheepQueue } from './game/SheepQueue.js';
import { CameraRig, cameraStateForSheepPhase } from './game/CameraRig.js';
import { sheepCountForSession } from './game/sheepCount.js';
import { BreathingCycle } from './game/BreathingCycle.js';
import { SessionColorCurve } from './game/SessionColorCurve.js';
import { responseIntensityAt } from './game/responseIntensity.js';
import { SessionFade } from './game/SessionFade.js';
import { Vegetation } from './world/Vegetation.js';
import { Stars } from './world/Stars.js';
import { BackgroundClouds } from './world/BackgroundClouds.js';
import { OwlFirefly } from './world/OwlFirefly.js';
import { Cat } from './world/Cat.js';
import { CloudNpc } from './world/CloudNpc.js';
import { SparkleBurst } from './effects/SparkleBurst.js';
import { AudioManager } from './audio/AudioManager.js';
import { notifyGameReady, getPlayerName, showStickyBanner } from './platform/yandex.js';

/**
 * Собирает и запускает сессию (раздел 9: экран выбора длительности перед
 * стартом). Ничего не создаётся, пока игрок не выбрал короткую/полную
 * сессию на стартовом экране — см. wireStartScreen() в конце файла.
 */
function startGame(sessionDurationMinutes) {
  const canvas = document.getElementById('scene');
  const { renderer, resize } = createRenderer(canvas);

  // Звук (audio-download-prompt.md): startGame() сама вызывается из обработчика
  // клика по кнопке старта сессии (wireStartScreen → begin()) — это и есть тот
  // самый пользовательский жест, без которого браузер не разрешит AudioContext.
  const audio = new AudioManager();
  audio.unlock();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e0b16);
  scene.fog = new THREE.Fog(0x0e0b16, 30, 95); // ↑ было 25/70 — сцена раздвинута (раздел 2 ревизии)

  const camera = createCamera(window.innerWidth / window.innerHeight);
  const { sun, moon, fill } = createLighting(scene);

  const planet = new Planet().addTo(scene);
  // Ориентация зафиксирована (camera-and-layout-revision.md, раздел 1):
  // слева тёплая (светлая) половина, справа — ночь. Забор по центру (x=0).
  // Точный угол на старте сессии задаёт SessionColorCurve ниже.
  planet.setTerminatorAngle(Math.PI);

  const surfacePoint = createSurfaceSampler(planet);

  // Забор идёт поперёк экрана и пересекает границу день/ночь по центру —
  // овцы прыгают по диагонали со светлой стороны (x<0) в тёмную (x>0).
  // Забор раздвинут шире (было ±6.5) под увеличенный радиус планеты
  // (раздел 2 ревизии) — сцена в целом просторнее.
  const fence = new Fence(surfacePoint, { z: 5, xFrom: -10, xTo: 10, spacing: 1.0 });
  fence.addTo(scene);

  // Число овец сессии (раздел 3) — окон в амбаре ровно столько же, по одному
  // на каждую заснувшую овцу (раздел 5.5).
  const sheepCount = sheepCountForSession(sessionDurationMinutes);

  // Амбар стоит глубже в тёмной половине (x>0), дверью к забору/овцам (раздел 5.5).
  // Отодвинут заметно дальше от забора (было 5.0/-1.0) — раздел 2 ревизии:
  // амбар не должен читаться крупным планом в общем виде, к нему должен
  // быть заметный отрезок пути после прыжка.
  const barn = new Barn({ windowCount: sheepCount });
  barn.placeOnSurface(surfacePoint, 10.5, -5.0, new THREE.Vector3(-1, 0, 1));
  barn.addTo(scene);

  // Звёзды, деревья, трава и фоновые облака (раздел 5.7–5.9, п.8) —
  // низкополигональный, инстансированный фон; растительность и мерцание
  // звёзд синхронизированы с текущей скоростью дыхательного цикла.
  const stars = new Stars().addTo(scene);

  // Координаты раздвинуты (раздел 2 ревизии) под увеличенный радиус планеты
  // и перенесённый дальше амбар — деревья тёмной стороны теперь тянутся
  // вдоль более длинного пути овцы к амбару, а не толпятся у забора.
  const trees = [
    { x: -8.1, z: 1.9, day: true, scale: 1.0 },
    { x: -10.0, z: 8.4, day: true, scale: 1.1 },
    { x: -5.8, z: 12.2, day: true, scale: 0.9 },
    { x: -10.7, z: -2.3, day: true, scale: 1.0 },
    { x: 10.4, z: 3.5, day: false, scale: 1.1 },
    { x: 3.2, z: -5.5, day: false, scale: 0.95 },
    { x: 11.5, z: -2.6, day: false, scale: 1.0 },
    { x: 2.6, z: 9.0, day: false, scale: 1.0 },
  ];
  const grassTufts = [
    ...generateGrassTufts(12, -10.5, -1.4, 2.1, 11.2, true),
    ...generateGrassTufts(12, 1.5, 10.5, -4.5, 7, false),
  ];
  const vegetation = new Vegetation(surfacePoint, trees, grassTufts).addTo(scene);

  // Слегка раздвинуты вслед за общим масштабом сцены (раздел 2 ревизии).
  const backgroundClouds = new BackgroundClouds([
    { x: -8, y: 12, z: -8, spread: 1.1, scale: 1.3, day: true },
    { x: 4, y: 14, z: -13, spread: 1.0, scale: 1.1, day: true },
    { x: -4, y: 16, z: -18, spread: 1.3, scale: 1.5, day: true },
    { x: 13, y: 13, z: -10, spread: 1.2, scale: 1.4, day: false },
    { x: 19, y: 10, z: 3, spread: 1.0, scale: 1.1, day: false },
    { x: 9, y: 17, z: -15, spread: 1.1, scale: 1.2, day: false },
  ]).addTo(scene);

  function generateGrassTufts(count, xMin, xMax, zMin, zMax, day) {
    const tufts = [];
    for (let i = 0; i < count; i++) {
      tufts.push({
        x: xMin + Math.random() * (xMax - xMin),
        z: zMin + Math.random() * (zMax - zMin),
        day,
        scale: 0.7 + Math.random() * 0.6,
      });
    }
    return tufts;
  }

  // Три фоновых NPC (раздел 5.2–5.4, п.9) — опциональны, реагируют на тап,
  // без завязки на основной таймер сессии.
  // Раздвинуты вслед за более длинным путём овцы к амбару (раздел 2 ревизии).
  const owl = new OwlFirefly();
  owl.placeOnSurface(surfacePoint, 9.5, 2.7, new THREE.Vector3(0, 0, 1));
  owl.addTo(scene);

  const cat = new Cat();
  cat.placeOnSurface(surfacePoint, 5.0, -3.0, new THREE.Vector3(-0.3, 0, 1));
  cat.addTo(scene);

  const cloudNpc = new CloudNpc(new THREE.Vector3(2, 12, -9));
  cloudNpc.addTo(scene);

  const tappableMeshes = [];
  function registerTappable(group, onTap) {
    group.traverse((obj) => {
      if (obj.isMesh) {
        obj.userData.onTap = onTap;
        tappableMeshes.push(obj);
      }
    });
  }
  // Звук на тап по NPC (audio-download-prompt.md, раздел 3).
  registerTappable(owl.group, () => {
    owl.onTap();
    audio.play('owlHoot', { volume: 0.7 });
  });
  registerTappable(cat.group, () => {
    cat.onTap();
    audio.playLooped('catPurr', { volume: 0.55, durationSec: 2.5 });
  });
  registerTappable(cloudNpc.group, () => {
    cloudNpc.onTap();
    audio.play('tapGentle', { volume: 0.5 });
  });

  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  function tryTapNpc(event) {
    const rect = canvas.getBoundingClientRect();
    pointerNDC.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObjects(tappableMeshes, false);
    if (hits.length > 0) {
      hits[0].object.userData.onTap();
      return true;
    }
    return false;
  }

  const effects = { sparkles: new SparkleBurst(scene) };

  // SDK Яндекс Игр (раздел 10): липкий баннер — самый ненавязчивый формат
  // рекламы; полноэкранная между сессиями сюда намеренно не подключается
  // (см. комментарий в src/platform/yandex.js). Имя игрока получаем без
  // принудительного логина — сейчас только для отладки, задел под сейвы.
  showStickyBanner();
  getPlayerName().then((name) => {
    if (import.meta.env.DEV && window.__debug) window.__debug.playerName = name;
  });

  // Автозавершение сессии (раздел 11, п.11): после последней овцы сцена
  // сама плавно гаснет до чёрного, без ожидания игрока.
  const sessionFade = new SessionFade(document.getElementById('fade-overlay'));

  // Точки маршрута овцы (раздел 4): пасётся на светлой стороне (x<0) в
  // стороне от забора (`graze`), сама медленно подходит к нему (`start`,
  // фаза SheepAnimator 'approach') — тап работает только после этого,
  // приземляется сразу за забором на тёмной (x>0), затем сонно уходит
  // к двери амбара.
  // Раздвинуты (раздел 2 ревизии): дистанция прыжка (start→land) и особенно
  // путь после приземления (land→walkTo) заметно длиннее — амбар теперь
  // далеко в глубине тёмной половины, а не сразу за забором.
  const waypoints = {
    graze: { x: -4.0, z: 10.5 },
    start: { x: -4.0, z: 7.0 },
    land: { x: 2.4, z: 3.6 },
    walkTo: { x: 8.5, z: -3.5 },
  };

  // Камера как конечный автомат из 5 состояний (camera-and-layout-revision.md,
  // раздел 4) — сама камера в core/camera.js теперь лишь задаёт стартовую/
  // "общую" позицию (FLOCK_VIEW), а переходы между состояниями и слежение
  // за активной овцой ведёт CameraRig, дёргается каждый кадр из tick().
  const cameraRig = new CameraRig(camera, {
    flockPosition: camera.position.clone(),
    flockLookAt: new THREE.Vector3(0, 2.6, -1),
    forwardDir: new THREE.Vector3(waypoints.land.x - waypoints.start.x, 0, waypoints.land.z - waypoints.start.z),
  });

  // Очередь овец у забора (раздел 3, п.11.6): активна всегда только первая,
  // остальные ждут позади компактным строем; по завершении цикла активной
  // очередь подтягивается сама.
  const sheepQueue = new SheepQueue(scene, surfacePoint, waypoints, effects, {
    count: sheepCount,
    onWindowLit: () => {
      barn.lightNextWindow();
      // Тише и мягче — переиспользуем tap_soft.mp3 с приглушённой громкостью (раздел 3).
      audio.play('tapSoft', { volume: 0.3, rate: 0.85 });
    },
    onLand: () => audio.play('sheepBleat', { volume: 0.8 }),
    onSessionComplete: () => {
      // Последняя овца ушла спать — облако останавливается над амбаром (раздел 5.4)
      // и сцена сама плавно гаснет (раздел 11, п.11), не дожидаясь игрока.
      cloudNpc.restOverBarn(new THREE.Vector3(barn.group.position.x, 6.0, barn.group.position.z));
      sessionFade.start();
      audio.fadeOut(6); // раздел 3: "тишина + затухание фоновой музыки"
    },
  });

  // Кривая замедления дыхательного цикла (раздел 3) — управляющий параметр
  // темпа: скорость цикла монотонно снижается с 12–15 до 6 циклов/мин по
  // ходу сессии, задавая, насколько быстро/медленно проходят фазы прыжка.
  const breathingCycle = new BreathingCycle({ sessionDurationSec: sessionDurationMinutes * 60 });
  let sessionElapsed = 0;

  // Цветовая/световая кривая сессии (раздел 6): яркость, насыщенность,
  // цветовая температура и позиция границы день-ночь — функция прогресса
  // сессии (0..1), синхронизирована с той же кривой дыхательного цикла.
  const colorCurve = new SessionColorCurve({ planet, scene, sun, moon, fill });
  colorCurve.update(0);

  // Пока активная овца сама идёт от точки выпаса к забору (SheepAnimator
  // 'approach'), тап по ней не должен запускать заряд — сначала она должна
  // дойти и встать (state === 'idle', см. guard в startCharge()). Помимо
  // этого, тап должен попадать в неё саму или в область рядом с ней, а не в
  // любую точку канваса — иначе не читалось бы, что действие адресовано
  // конкретной овце.
  const SHEEP_TAP_RADIUS_PX = 100;
  function isNearActiveSheep(event) {
    const sheep = sheepQueue.activeSheep;
    if (!sheep || sheepQueue.animator?.state !== 'idle') return false;
    const screenPos = sheep.group.position.clone().project(camera);
    const rect = canvas.getBoundingClientRect();
    const screenX = (screenPos.x * 0.5 + 0.5) * rect.width + rect.left;
    const screenY = (-screenPos.y * 0.5 + 0.5) * rect.height + rect.top;
    const dx = event.clientX - screenX;
    const dy = event.clientY - screenY;
    return Math.sqrt(dx * dx + dy * dy) <= SHEEP_TAP_RADIUS_PX;
  }

  // Тап по NPC не должен также запускать заряд прыжка овцы — если тап
  // попал по NPC, заряд для этого касания не стартует.
  let npcConsumedPointer = false;
  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    npcConsumedPointer = tryTapNpc(event);
    if (!npcConsumedPointer && isNearActiveSheep(event)) {
      sheepQueue.startCharge();
      audio.play('tapSoft', { volume: 0.8 });
    }
  });
  window.addEventListener('pointerup', () => {
    if (!npcConsumedPointer) {
      // Питч чуть выше исходного тапа — та же audio-download-prompt.md,
      // раздел 3 ("можно слегка повысить тон программно для разнообразия"),
      // звук только если реально был заряд (release() иначе no-op, см. её guard).
      const wasCharging = sheepQueue.animator?.state === 'charge';
      sheepQueue.release();
      if (wasCharging) audio.play('tapSoft', { volume: 0.9, rate: 1.3 });
    }
  });
  window.addEventListener('pointercancel', () => {
    if (!npcConsumedPointer) sheepQueue.release();
  });

  window.addEventListener('resize', () => {
    const { width, height } = resize();
    updateCameraAspect(camera, width, height);
  });

  // Едва заметная кнопка паузы в углу (раздел 9) — единственный HUD поверх
  // игрового процесса. Пауза останавливает продвижение сессии/анимаций.
  let isPaused = false;
  const pauseButton = document.getElementById('pause-button');
  pauseButton.hidden = false;
  pauseButton.textContent = '⏸';
  pauseButton.addEventListener('click', () => {
    isPaused = !isPaused;
    pauseButton.textContent = isPaused ? '▶' : '⏸';
  });

  const clock = new THREE.Clock();

  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05);

    if (!isPaused) {
      sessionElapsed += dt;

      const cpm = breathingCycle.cpmAt(sessionElapsed);
      const progress = breathingCycle.progressAt(sessionElapsed);
      sheepQueue.setBreathingCpm(cpm);
      sheepQueue.setCyclePace(breathingCycle.paceAt(sessionElapsed));
      sheepQueue.setResponseIntensity(responseIntensityAt(progress));
      sheepQueue.update(dt);
      effects.sparkles.update(dt);
      barn.update(dt);
      colorCurve.update(progress);
      // sfx-громкость — та же угасающая кривая отклика, что и свечение/искры
      // (раздел 4); музыка — прогресс сессии, та же кривая яркости (раздел 6).
      audio.setSfxIntensity(responseIntensityAt(progress));
      audio.setSessionProgress(progress);

      stars.setBreathingCpm(cpm);
      stars.update(dt);
      vegetation.setBreathingCpm(cpm);
      vegetation.update(dt);

      owl.update(dt);
      cat.update(dt);
      cloudNpc.update(dt);
      sessionFade.update(dt);

      const animator = sheepQueue.animator;
      if (animator && sheepQueue.activeSheep) {
        cameraRig.setState(cameraStateForSheepPhase(animator.state));
        cameraRig.update(dt, {
          sheepPosition: sheepQueue.activeSheep.group.position,
          sheepNormal: animator.surfaceNormal,
          jumpProgress: animator.jumpProgress,
          breathingCpm: cpm,
        });
      } else {
        cameraRig.setState('FLOCK_VIEW');
        cameraRig.update(dt, { breathingCpm: cpm });
      }
    }

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  if (import.meta.env.DEV) {
    window.__debug = {
      sheepQueue,
      effects,
      scene,
      breathingCycle,
      colorCurve,
      barn,
      sheepCount,
      stars,
      vegetation,
      backgroundClouds,
      owl,
      cat,
      cloudNpc,
      tryTapNpc,
      sessionFade,
      getSessionElapsed: () => sessionElapsed,
      renderer,
      camera,
      cameraRig,
      audio,
      forceRender: () => renderer.render(scene, camera),
    };
  }
}

/** Экран выбора длительности сессии (раздел 9) — до этого игра не запускается. */
function wireStartScreen() {
  const startScreen = document.getElementById('start-screen');
  const btnShort = document.getElementById('btn-short');
  const btnFull = document.getElementById('btn-full');

  function begin(minMinutes, maxMinutes) {
    const minutes = minMinutes + Math.random() * (maxMinutes - minMinutes);
    startScreen.classList.add('hidden');
    startGame(minutes);
  }

  btnShort.addEventListener('click', () => begin(5, 10));
  btnFull.addEventListener('click', () => begin(12, 18));
}

wireStartScreen();

// SDK Яндекс Игр (раздел 10): стартовый экран уже отрисован и интерактивен —
// сигнализируем платформе, что можно скрывать её лоадер.
notifyGameReady();
