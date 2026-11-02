/**
 * Жемчужное сердце на первом экране.
 *
 * Жемчужины рисует шейдер (pearls.frag), а их движение считается здесь, на CPU:
 * нить течёт по контуру сердца, отталкивается от курсора или пальца,
 * «бьётся», а по клику рассыпается и собирается снова.
 */
import fragmentSource from '../shaders/pearls.frag?raw';
import { $ } from '../lib/dom';
import { onFrame } from '../lib/frameLoop';
import { prefersReducedMotion } from '../lib/utils';
import { createFullscreenPass, drawFullscreen } from '../lib/webgl';

const OUTER_COUNT = 60;
const INNER_COUNT = 26;
const PEARL_COUNT = OUTER_COUNT + INNER_COUNT;
const OUTER_RADIUS = 0.05;
const INNER_RADIUS = 0.037;

/** Половина высоты видимой области на плоскости z = 0 (камера в z = -3, фокус 1.6). */
const VIEW_HALF_HEIGHT = 1.875;
/** Жемчужины собираются в сердце за столько миллисекунд после открытия конверта. */
const GATHER_MS = 2200;
/** Радиус, в котором курсор отталкивает жемчужины. */
const REPEL_RADIUS = 0.55;

type Point = [number, number];

// ---------------------------------------------------------------------------
// Контур сердца, размеченный по длине дуги: доля пути s ∈ [0, 1) → точка.
// ---------------------------------------------------------------------------

interface HeartSample {
  x: number;
  y: number;
  /** Какая доля длины контура пройдена к этой точке. */
  at: number;
}

function buildHeartTable(): HeartSample[] {
  const table: HeartSample[] = [];
  let length = 0;
  let previous: Point | null = null;

  for (let i = 0; i <= 600; i++) {
    const t = (i / 600) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3 / 16;
    const y = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16 + 0.02;
    if (previous) length += Math.hypot(x - previous[0], y - previous[1]);
    table.push({ x, y, at: length });
    previous = [x, y];
  }
  for (const sample of table) sample.at /= length;
  return table;
}

const heartTable = buildHeartTable();

function pointOnHeart(progress: number): Point {
  const s = ((progress % 1) + 1) % 1;
  let low = 0;
  let high = heartTable.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (heartTable[middle].at < s) low = middle; else high = middle;
  }
  const a = heartTable[low];
  const b = heartTable[high];
  const k = (s - a.at) / (b.at - a.at || 1);
  return [a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k];
}

// ---------------------------------------------------------------------------

export function startPearlHeart(): void {
  const canvas = $<HTMLCanvasElement>('#pearl3d');
  const hero = $('#hero');
  const pass = createFullscreenPass(canvas, `#define N ${PEARL_COUNT}\n${fragmentSource}`, {
    antialias: false,
    alpha: true,
    premultipliedAlpha: true,
  });
  if (!pass) return;

  const { gl, uniform } = pass;
  const uRes = uniform('uRes');
  const uPearls = uniform('uS');
  const uTime = uniform('uTime');

  // Положение и скорость каждой жемчужины (x, y, z подряд). Сначала они разбросаны
  // над экраном и ждут, пока откроется конверт.
  const position = new Float32Array(PEARL_COUNT * 3);
  const velocity = new Float32Array(PEARL_COUNT * 3);
  const shaderData = new Float32Array(PEARL_COUNT * 4);
  for (let i = 0; i < PEARL_COUNT; i++) {
    position[i * 3] = (Math.random() - 0.5) * 5;
    position[i * 3 + 1] = 2.2 + Math.random() * 2.5;
    position[i * 3 + 2] = (Math.random() - 0.5) * 2;
  }

  let aspect = 0.5;
  function resize(): void {
    const rect = hero.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(2, Math.round(rect.width * dpr));
    canvas.height = Math.max(2, Math.round(rect.height * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    aspect = rect.width / rect.height;
  }
  resize();
  addEventListener('resize', resize);

  // Указатель: x, y — в мировых координатах сцены, nx, ny — в долях экрана [-.5, .5].
  const pointer = { x: 0, y: 0, nx: 0, ny: 0, active: false };

  function trackPointer(event: PointerEvent): void {
    const rect = hero.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    pointer.x = ((px / rect.height) * 2 - aspect) * VIEW_HALF_HEIGHT;
    pointer.y = (1 - (py / rect.height) * 2) * VIEW_HALF_HEIGHT;
    pointer.nx = px / rect.width - 0.5;
    pointer.ny = 0.5 - py / rect.height;
    pointer.active = py > -40 && py < rect.height + 40;
  }

  addEventListener('pointermove', trackPointer, { passive: true });
  addEventListener('pointerdown', (event) => {
    trackPointer(event);
    const rect = hero.getBoundingClientRect();
    const inHero = event.clientY >= rect.top && event.clientY <= rect.bottom;
    const onControl = event.target instanceof Element && event.target.closest('a, button');
    if (!inHero || onControl) return;
    scatterPearls();
  }, { passive: true });
  document.addEventListener('pointerleave', () => { pointer.active = false; });

  /** Клик по первому экрану рассыпает жемчуг, и он собирается обратно. */
  function scatterPearls(): void {
    for (let i = 0; i < PEARL_COUNT; i++) {
      velocity[i * 3] += (Math.random() - 0.5) * 7;
      velocity[i * 3 + 1] += (Math.random() - 0.3) * 7;
      velocity[i * 3 + 2] += (Math.random() - 0.5) * 5;
    }
  }

  // Не считаем и не рисуем, пока первый экран не виден.
  let heroVisible = true;
  new IntersectionObserver(([entry]) => { heroVisible = entry.isIntersecting; }).observe(hero);

  const startedAt = performance.now();
  let lastFrame = startedAt;
  let openedAt: number | null = null;
  let yaw = 0;
  let pitch = 0;

  onFrame((now) => {
    if (!heroVisible || document.hidden) {
      lastFrame = now;
      return;
    }
    const dt = Math.min(0.033, (now - lastFrame) / 1000);
    lastFrame = now;
    const t = prefersReducedMotion ? 3 : (now - startedAt) / 1000;

    // Пока конверт закрыт, жемчуг «заморожен»; после открытия плавно собирается.
    if (openedAt === null && document.body.classList.contains('open')) openedAt = now;
    const gather = openedAt === null ? 0 : Math.min(1, (now - openedAt) / GATHER_MS);
    const spring = 16 * gather * gather;
    const damping = 3 + 4 * gather;

    // Размер сердца под экран и «удар сердца».
    const baseScale = Math.min(aspect * 1.7, 1.42);
    const beat = prefersReducedMotion ? 1 : 1 + 0.05 * Math.max(0, Math.sin(t * 2.6)) ** 10;
    const scale = baseScale * beat;
    const offsetY = aspect < 0.8 ? 0.12 : 0.02; // чуть выше центра, над именами

    // Поворот сердца: покачивается само и следует за курсором.
    const targetYaw = prefersReducedMotion ? 0 : 0.6 * Math.sin(t * 0.42) + (pointer.active ? pointer.nx * 0.55 : 0);
    const targetPitch = pointer.active ? -pointer.ny * 0.3 : 0.05 * Math.sin(t * 0.3);
    yaw += (targetYaw - yaw) * Math.min(1, dt * 3);
    pitch += (targetPitch - pitch) * Math.min(1, dt * 3);
    const cosYaw = Math.cos(yaw), sinYaw = Math.sin(yaw);
    const cosPitch = Math.cos(pitch), sinPitch = Math.sin(pitch);

    for (let i = 0; i < PEARL_COUNT; i++) {
      // Внешняя нить течёт по часовой стрелке, внутренняя — навстречу.
      const outer = i < OUTER_COUNT;
      const index = outer ? i : i - OUTER_COUNT;
      const count = outer ? OUTER_COUNT : INNER_COUNT;
      const progress = outer ? index / count + t * 0.018 : index / count - t * 0.026;
      const [heartX, heartY] = pointOnHeart(progress);
      const pearlScale = outer ? scale : scale * 0.6;

      const x = heartX * pearlScale;
      const y = heartY * pearlScale + offsetY;
      const z = (outer ? 0.09 : 0.16) * Math.sin(progress * Math.PI * 2 * (outer ? 5 : 3) + t * 1.4);

      // Целевая точка: поворот вокруг оси Y, затем вокруг оси X.
      const xTurned = x * cosYaw + z * sinYaw;
      const zTurned = -x * sinYaw + z * cosYaw;
      const targetX = xTurned;
      const targetY = y * cosPitch - zTurned * sinPitch;
      const targetZ = y * sinPitch + zTurned * cosPitch;

      // Пружина тянет жемчужину к цели, трение гасит скорость.
      let vx = velocity[i * 3], vy = velocity[i * 3 + 1], vz = velocity[i * 3 + 2];
      let px = position[i * 3], py = position[i * 3 + 1], pz = position[i * 3 + 2];
      let ax = (targetX - px) * spring - vx * damping;
      let ay = (targetY - py) * spring - vy * damping;
      let az = (targetZ - pz) * spring - vz * damping;

      if (pointer.active) { // курсор отталкивает жемчуг
        const dx = px - pointer.x;
        const dy = py - pointer.y;
        const distance = Math.hypot(dx, dy) + 1e-4;
        if (distance < REPEL_RADIUS) {
          const push = (REPEL_RADIUS - distance) ** 2 * 90 / distance;
          ax += dx * push;
          ay += dy * push;
          az -= push * 0.05;
        }
      }

      vx += ax * dt; vy += ay * dt; vz += az * dt;
      px += vx * dt; py += vy * dt; pz += vz * dt;

      position[i * 3] = px; position[i * 3 + 1] = py; position[i * 3 + 2] = pz;
      velocity[i * 3] = vx; velocity[i * 3 + 1] = vy; velocity[i * 3 + 2] = vz;

      const radius = outer ? OUTER_RADIUS : INNER_RADIUS;
      shaderData[i * 4] = px;
      shaderData[i * 4 + 1] = py;
      shaderData[i * 4 + 2] = pz;
      shaderData[i * 4 + 3] = radius * (0.9 + 0.1 * Math.min(1, gather * 3));
    }

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, t);
    gl.uniform4fv(uPearls, shaderData);
    drawFullscreen(gl);
  });
}
