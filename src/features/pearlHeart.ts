/**
 * Жемчужное сердце на первом экране.
 *
 * Движение каждой жемчужины считается здесь, на CPU: нить течёт по контуру сердца,
 * отталкивается от курсора или пальца, «бьётся», а по клику рассыпается и собирается снова.
 * Рисуется это дёшево: одна заранее нарисованная «спрайтовая» жемчужина и её тень
 * масштабируются в 2D-канвасе по перспективе — без шейдеров и без расчёта по каждому пикселю.
 */
import { $ } from '../lib/dom';
import { onFrame } from '../lib/frameLoop';
import { prefersReducedMotion } from '../lib/utils';
import { siteOpened } from './intro';

const OUTER_COUNT = 60;
const INNER_COUNT = 26;
const PEARL_COUNT = OUTER_COUNT + INNER_COUNT;
const OUTER_RADIUS = 0.05;
const INNER_RADIUS = 0.037;

/** Камера стоит в z = -3, фокус 1.6: половина высоты видимой области на плоскости z = 0 — 3 / 1.6. */
const CAMERA_Z = 3;
const FOCAL = 1.6;
const VIEW_HALF_HEIGHT = CAMERA_Z / FOCAL;
/** Размер спрайта жемчужины в пикселях (с запасом под retina). */
const SPRITE_SIZE = 96;
/** Смещение тени жемчужины на «шёлк» (в мировых единицах: вправо и вниз). */
const SHADOW_OFFSET: Point = [0.045, 0.075];
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
// Спрайты: жемчужина и мягкая тень рисуются один раз.
// ---------------------------------------------------------------------------

function makeSprite(size: number, paint: (context: CanvasRenderingContext2D, size: number) => void): HTMLCanvasElement {
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = size;
  paint(sprite.getContext('2d')!, size);
  return sprite;
}

function makePearlSprite(): HTMLCanvasElement {
  return makeSprite(SPRITE_SIZE, (context, size) => {
    const radius = size / 2;
    context.beginPath();
    context.arc(radius, radius, radius - 0.5, 0, Math.PI * 2);
    context.clip();

    // Основной цвет: свет падает сверху-слева (те же оттенки, что у жемчужин на конверте).
    const body = context.createRadialGradient(size * 0.34, size * 0.3, 0, size * 0.34, size * 0.3, size * 0.78);
    body.addColorStop(0, '#fffdf0');
    body.addColorStop(0.28, '#fbf0cc');
    body.addColorStop(0.65, '#ead29a');
    body.addColorStop(1, '#b8975a');
    context.fillStyle = body;
    context.fillRect(0, 0, size, size);

    // Розоватый отсвет «шёлка» снизу-справа.
    const bounce = context.createRadialGradient(size * 0.72, size * 0.86, 0, size * 0.72, size * 0.86, size * 0.5);
    bounce.addColorStop(0, 'rgba(217, 110, 120, .4)');
    bounce.addColorStop(1, 'rgba(217, 110, 120, 0)');
    context.fillStyle = bounce;
    context.fillRect(0, 0, size, size);

    // Блик.
    const glint = context.createRadialGradient(size * 0.33, size * 0.27, 0, size * 0.33, size * 0.27, size * 0.14);
    glint.addColorStop(0, 'rgba(255, 255, 255, .95)');
    glint.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = glint;
    context.fillRect(0, 0, size, size);
  });
}

function makeShadowSprite(): HTMLCanvasElement {
  return makeSprite(SPRITE_SIZE, (context, size) => {
    const shadow = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    shadow.addColorStop(0, 'rgba(26, 1, 8, .34)');
    shadow.addColorStop(0.45, 'rgba(26, 1, 8, .2)');
    shadow.addColorStop(1, 'rgba(26, 1, 8, 0)');
    context.fillStyle = shadow;
    context.fillRect(0, 0, size, size);
  });
}

// ---------------------------------------------------------------------------

export function startPearlHeart(): void {
  const canvas = $<HTMLCanvasElement>('#pearl3d');
  const hero = $('#hero');
  const context = canvas.getContext('2d');
  if (!context) return;

  const pearlSprite = makePearlSprite();
  const shadowSprite = makeShadowSprite();

  // Положение и скорость каждой жемчужины (x, y, z подряд). Сначала они разбросаны
  // над экраном и ждут, пока откроется конверт.
  const position = new Float32Array(PEARL_COUNT * 3);
  const velocity = new Float32Array(PEARL_COUNT * 3);
  const radii = new Float32Array(PEARL_COUNT);
  const order = Array.from({ length: PEARL_COUNT }, (_, i) => i);
  for (let i = 0; i < PEARL_COUNT; i++) {
    position[i * 3] = (Math.random() - 0.5) * 5;
    position[i * 3 + 1] = 2.2 + Math.random() * 2.5;
    position[i * 3 + 2] = (Math.random() - 0.5) * 2;
  }

  let aspect = 0.5;
  function resize(): void {
    // Холст — на всю ширину страницы, а по высоте равен первому экрану (который уже, чем страница).
    const height = hero.offsetHeight;
    canvas.style.height = `${height}px`;
    const width = canvas.clientWidth;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(2, Math.round(width * dpr));
    canvas.height = Math.max(2, Math.round(height * dpr));
    aspect = width / height;
  }
  resize();
  new ResizeObserver(resize).observe(hero);
  addEventListener('resize', resize);

  // Указатель: x, y — в мировых координатах сцены, nx, ny — в долях экрана [-.5, .5].
  const pointer = { x: 0, y: 0, nx: 0, ny: 0, active: false };

  function trackPointer(event: PointerEvent): void {
    const rect = canvas.getBoundingClientRect();
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

  // Не считаем и не рисуем, пока первый экран не виден или конверт ещё закрыт.
  let heroVisible = true;
  new IntersectionObserver(([entry]) => { heroVisible = entry.isIntersecting; }).observe(hero);
  let opened = false;
  void siteOpened.then(() => { opened = true; });

  const startedAt = performance.now();
  let lastFrame = startedAt;
  let openedAt: number | null = null;
  let yaw = 0;
  let pitch = 0;

  onFrame((now) => {
    if (!opened || !heroVisible || document.hidden) {
      lastFrame = now;
      return;
    }
    const dt = Math.min(0.033, (now - lastFrame) / 1000);
    lastFrame = now;
    const t = prefersReducedMotion ? 3 : (now - startedAt) / 1000;

    // Пока конверт закрыт, жемчуг «заморожен»; после открытия плавно собирается.
    if (openedAt === null) openedAt = now;
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

      radii[i] = (outer ? OUTER_RADIUS : INNER_RADIUS) * (0.9 + 0.1 * Math.min(1, gather * 3));
    }

    draw();
  });

  /** Перспективная проекция: мировая точка → пиксели холста (так же, как считала камера шейдера). */
  function draw(): void {
    const { width, height } = canvas;
    context!.clearRect(0, 0, width, height);

    // Сначала все тени, потом жемчужины от дальних к ближним.
    order.sort((a, b) => position[b * 3 + 2] - position[a * 3 + 2]);
    const pixelsPerUnit = height / 2 * FOCAL;

    for (const i of order) {
      const depth = position[i * 3 + 2] + CAMERA_Z;
      const k = pixelsPerUnit / depth;
      const x = width / 2 + position[i * 3] * k;
      const y = height / 2 - position[i * 3 + 1] * k;
      const size = radii[i] * k * 2;
      if (x < -size || x > width + size || y < -size || y > height + size) continue;
      context!.drawImage(shadowSprite, x + SHADOW_OFFSET[0] * k - size * 1.05, y + SHADOW_OFFSET[1] * k - size * 1.05, size * 2.1, size * 2.1);
    }
    for (const i of order) {
      const depth = position[i * 3 + 2] + CAMERA_Z;
      const k = pixelsPerUnit / depth;
      const x = width / 2 + position[i * 3] * k;
      const y = height / 2 - position[i * 3 + 1] * k;
      const size = radii[i] * k * 2;
      if (x < -size || x > width + size || y < -size || y > height + size) continue;
      context!.drawImage(pearlSprite, x - size / 2, y - size / 2, size, size);
    }
  }
}
