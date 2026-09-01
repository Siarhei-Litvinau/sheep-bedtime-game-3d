import * as THREE from 'three';
import { createRenderer } from './core/renderer.js';
import { createCamera, updateCameraAspect } from './core/camera.js';
import { createLighting } from './core/lighting.js';
import { Planet } from './world/Planet.js';
import { Fence } from './world/Fence.js';
import { Barn } from './world/Barn.js';
import { createSurfaceSampler } from './world/surface.js';
import { SheepQueue } from './game/SheepQueue.js';
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
import { notifyGameReady, getPlayerName, showStickyBanner } from './platform/yandex.js';

/**
 * Собирает и запускает сессию (раздел 9: экран выбора длительности перед
 * стартом). Ничего не создаётся, пока игрок не выбрал короткую/полную
 * сессию на стартовом экране — см. wireStartScreen() в конце файла.
 */
function startGame(sessionDurationMinutes) {
  const canvas = document.getElementById('scene');
  const { renderer, resize } = createRenderer(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e0b16);
  scene.fog = new THREE.Fog(0x0e0b16, 25, 70);

  const camera = createCamera(window.innerWidth / window.innerHeight);
  const { sun, fill } = createLighting(scene);

  const planet = new Planet().addTo(scene);
  // Терминатор развёрнут вдоль линии обзора камеры: справа тёплая половина, слева — ночь.
  // Точный угол на старте сессии задаёт SessionColorCurve ниже.
  planet.setTerminatorAngle(0);

  const surfacePoint = createSurfaceSampler(planet);

  // Забор идёт поперёк экрана и пересекает границу день/ночь по центру —
  // овцы прыгают по диагонали со светлой стороны (x>0) в тёмную (x<0).
  const fence = new Fence(surfacePoint, { z: 4, xFrom: -6.5, xTo: 6.5, spacing: 1.0 });
  fence.addTo(scene);

  // Число овец сессии (раздел 3) — окон в амбаре ровно столько же, по одному
  // на каждую заснувшую овцу (раздел 5.5).
  const sheepCount = sheepCountForSession(sessionDurationMinutes);

  // Амбар стоит глубже в тёмной половине, дверью к забору/овцам (раздел 5.5).
  const barn = new Barn({ windowCount: sheepCount });
  barn.placeOnSurface(surfacePoint, -5.0, -1.0, new THREE.Vector3(1, 0, 1));
  barn.addTo(scene);

  // Звёзды, деревья, трава и фоновые облака (раздел 5.7–5.9, п.8) —
  // низкополигональный, инстансированный фон; растительность и мерцание
  // звёзд синхронизированы с текущей скоростью дыхательного цикла.
  const stars = new Stars().addTo(scene);

  const trees = [
    { x: 5.6, z: 1.3, day: true, scale: 1.0 },
    { x: 6.9, z: 5.8, day: true, scale: 1.1 },
    { x: 4.0, z: 8.4, day: true, scale: 0.9 },
    { x: 7.4, z: -1.6, day: true, scale: 1.0 },
    { x: -7.2, z: 2.4, day: false, scale: 1.1 },
    { x: -2.2, z: -3.8, day: false, scale: 0.95 },
    { x: -7.6, z: -1.8, day: false, scale: 1.0 },
    { x: -1.8, z: 6.2, day: false, scale: 1.0 },
  ];
  const grassTufts = [
    ...generateGrassTufts(12, 1, 7.5, 1.5, 8, true),
    ...generateGrassTufts(12, -7.5, -1, -3, 5, false),
  ];
  const vegetation = new Vegetation(surfacePoint, trees, grassTufts).addTo(scene);

  const backgroundClouds = new BackgroundClouds([
    { x: 6, y: 11, z: -6, spread: 1.1, scale: 1.3, day: true },
    { x: -3, y: 13, z: -10, spread: 1.0, scale: 1.1, day: true },
    { x: 3, y: 15, z: -14, spread: 1.3, scale: 1.5, day: true },
    { x: -9, y: 12, z: -8, spread: 1.2, scale: 1.4, day: false },
    { x: -14, y: 9, z: 2, spread: 1.0, scale: 1.1, day: false },
    { x: -6, y: 16, z: -12, spread: 1.1, scale: 1.2, day: false },
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
  const owl = new OwlFirefly();
  owl.placeOnSurface(surfacePoint, -6.8, 1.9, new THREE.Vector3(0, 0, 1));
  owl.addTo(scene);

  const cat = new Cat();
  cat.placeOnSurface(surfacePoint, -3.0, -2.1, new THREE.Vector3(0.3, 0, 1));
  cat.addTo(scene);

  const cloudNpc = new CloudNpc(new THREE.Vector3(-2, 12, -9));
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
  registerTappable(owl.group, () => owl.onTap());
  registerTappable(cat.group, () => cat.onTap());
  registerTappable(cloudNpc.group, () => cloudNpc.onTap());

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

  // Точки маршрута овцы (раздел 4): ждёт на светлой стороне перед забором,
  // приземляется сразу за ним на тёмной, затем сонно уходит к двери амбара.
  const waypoints = {
    start: { x: 2.6, z: 5.4 },
    land: { x: -1.4, z: 2.6 },
    walkTo: { x: -4.2, z: -0.3 },
  };

  // Очередь овец у забора (раздел 3, п.11.6): активна всегда только первая,
  // остальные ждут позади компактным строем; по завершении цикла активной
  // очередь подтягивается сама.
  const sheepQueue = new SheepQueue(scene, surfacePoint, waypoints, effects, {
    count: sheepCount,
    onWindowLit: () => barn.lightNextWindow(),
    onSessionComplete: () => {
      // Последняя овца ушла спать — облако останавливается над амбаром (раздел 5.4)
      // и сцена сама плавно гаснет (раздел 11, п.11), не дожидаясь игрока.
      cloudNpc.restOverBarn(new THREE.Vector3(barn.group.position.x, 6.0, barn.group.position.z));
      sessionFade.start();
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
  const colorCurve = new SessionColorCurve({ planet, scene, sun, fill });
  colorCurve.update(0);

  // Тап по NPC не должен также запускать заряд прыжка овцы — если тап
  // попал по NPC, заряд для этого касания не стартует.
  let npcConsumedPointer = false;
  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    npcConsumedPointer = tryTapNpc(event);
    if (!npcConsumedPointer) {
      sheepQueue.startCharge();
    }
  });
  window.addEventListener('pointerup', () => {
    if (!npcConsumedPointer) sheepQueue.release();
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

      stars.setBreathingCpm(cpm);
      stars.update(dt);
      vegetation.setBreathingCpm(cpm);
      vegetation.update(dt);

      owl.update(dt);
      cat.update(dt);
      cloudNpc.update(dt);
      sessionFade.update(dt);
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
