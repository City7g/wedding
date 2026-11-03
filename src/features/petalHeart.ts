/**
 * Сердце из лепестков роз на первом экране.
 *
 * Движение каждого лепестка считается здесь, на CPU: гирлянда течёт по контуру сердца,
 * лепестки трепещут, отлетают от курсора или пальца, «бьются» вместе с сердцем, а по клику
 * рассыпаются, кувыркаясь, и собираются снова. Рисуется это дёшево: несколько заранее
 * нарисованных спрайтов лепестка и мягкая тень масштабируются и поворачиваются
 * в 2D-канвасе по перспективе — без шейдеров.
 */
import { $ } from '../lib/dom';
import { onFrame } from '../lib/frameLoop';
import { prefersReducedMotion } from '../lib/utils';
import { siteOpened } from './intro';

const OUTER_COUNT = 56;
const INNER_COUNT = 24;
const PETAL_COUNT = OUTER_COUNT + INNER_COUNT;
/** «Радиус» лепестка: длина лепестка — примерно 1.7 диаметра. */
const OUTER_RADIUS = 0.05;
const INNER_RADIUS = 0.038;
const PETAL_LENGTH = 1.7;

/** Камера стоит в z = -3, фокус 1.6: половина высоты видимой области на плоскости z = 0 — 3 / 1.6. */
const CAMERA_Z = 3;
const FOCAL = 1.6;
const VIEW_HALF_HEIGHT = CAMERA_Z / FOCAL;
/** Размер спрайта лепестка в пикселях (с запасом под retina). */
const SPRITE_SIZE = 96;
/** Смещение тени лепестка на «шёлк» (в мировых единицах: вправо и вниз). */
const SHADOW_OFFSET: Point = [0.045, 0.075];
/** Лепестки собираются в сердце за столько миллисекунд после открытия конверта. */
const GATHER_MS = 2200;
/** Радиус, в котором курсор отталкивает лепестки. */
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
// Спрайты: лепестки и мягкая тень рисуются один раз.
// ---------------------------------------------------------------------------

/** Оттенки лепестков: от тёмной бордовой розы до бледно-розового. */
const PETAL_COLORS = ['#b8344f', '#cf566e', '#df7a8c', '#ecabb6', '#f6d0d6', '#9c2442', '#d9667c'];

function makeSprite(size: number, paint: (context: CanvasRenderingContext2D, size: number) => void): HTMLCanvasElement {
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = size;
  paint(sprite.getContext('2d')!, size);
  return sprite;
}

/** Лепесток лежит вдоль оси X: узкое основание слева, широкий закруглённый край справа. */
function makePetalSprite(color: string): HTMLCanvasElement {
  return makeSprite(SPRITE_SIZE, (context, size) => {
    const k = size / 96;
    context.scale(k, k);

    context.beginPath();
    context.moveTo(4, 48);
    context.bezierCurveTo(20, 22, 56, 12, 82, 24);
    context.bezierCurveTo(96, 32, 96, 64, 82, 72);
    context.bezierCurveTo(56, 84, 20, 74, 4, 48);
    context.closePath();
    context.save();
    context.clip();

    context.fillStyle = color;
    context.fillRect(0, 0, 96, 96);

    // Основание темнее, а край светлее и прозрачнее, как у настоящего лепестка.
    const shade = context.createLinearGradient(4, 0, 92, 0);
    shade.addColorStop(0, 'rgba(70, 6, 24, .55)');
    shade.addColorStop(0.45, 'rgba(70, 6, 24, 0)');
    shade.addColorStop(0.8, 'rgba(255, 228, 234, .1)');
    shade.addColorStop(1, 'rgba(255, 228, 234, .6)');
    context.fillStyle = shade;
    context.fillRect(0, 0, 96, 96);

    // Мягкий блик сверху.
    const glint = context.createRadialGradient(58, 32, 0, 58, 32, 26);
    glint.addColorStop(0, 'rgba(255, 255, 255, .45)');
    glint.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = glint;
    context.fillRect(0, 0, 96, 96);

    // Прожилка посередине.
    context.strokeStyle = 'rgba(110, 14, 40, .22)';
    context.lineWidth = 1.2;
    context.beginPath();
    context.moveTo(8, 48);
    context.quadraticCurveTo(46, 46, 76, 48);
    context.stroke();
    context.restore();
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

export function startPetalHeart(): void {
  const canvas = $<HTMLCanvasElement>('#petals');
  const hero = $('#hero');
  const context = canvas.getContext('2d');
  if (!context) return;

  const petalSprites = PETAL_COLORS.map(makePetalSprite);
  const shadowSprite = makeShadowSprite();

  // Положение и скорость каждого лепестка (x, y, z подряд). Сначала они разбросаны
  // над экраном и ждут, пока откроется конверт.
  const position = new Float32Array(PETAL_COUNT * 3);
  const velocity = new Float32Array(PETAL_COUNT * 3);
  const radii = new Float32Array(PETAL_COUNT);
  /** Угол поворота лепестка на экране; кувырок после рассыпания: скорость вращения и накопленный угол (оба затухают). */
  const angle = new Float32Array(PETAL_COUNT);
  const tumble = new Float32Array(PETAL_COUNT);
  const spin = new Float32Array(PETAL_COUNT);
  /** Постоянные особенности лепестка: наклон относительно нити, оттенок, фаза трепета. */
  const tilt = Float32Array.from({ length: PETAL_COUNT }, () => (Math.random() - 0.5) * 1.2);
  const colorOf = Array.from({ length: PETAL_COUNT }, () => Math.floor(Math.random() * PETAL_COLORS.length));
  const phase = Float32Array.from({ length: PETAL_COUNT }, () => Math.random() * Math.PI * 2);
  const order = Array.from({ length: PETAL_COUNT }, (_, i) => i);
  for (let i = 0; i < PETAL_COUNT; i++) {
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
    scatterPetals();
  }, { passive: true });
  document.addEventListener('pointerleave', () => { pointer.active = false; });

  /** Клик по первому экрану рассыпает лепестки, и они собираются обратно. */
  function scatterPetals(): void {
    for (let i = 0; i < PETAL_COUNT; i++) {
      velocity[i * 3] += (Math.random() - 0.5) * 7;
      velocity[i * 3 + 1] += (Math.random() - 0.3) * 7;
      velocity[i * 3 + 2] += (Math.random() - 0.5) * 5;
      tumble[i] += (Math.random() - 0.5) * 9;
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

    // Пока конверт закрыт, лепестки ждут над экраном; после открытия плавно собираются.
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

    for (let i = 0; i < PETAL_COUNT; i++) {
      // Внешняя гирлянда течёт по часовой стрелке, внутренняя — навстречу.
      const outer = i < OUTER_COUNT;
      const index = outer ? i : i - OUTER_COUNT;
      const count = outer ? OUTER_COUNT : INNER_COUNT;
      const progress = outer ? index / count + t * 0.018 : index / count - t * 0.026;
      const [heartX, heartY] = pointOnHeart(progress);
      const [nextX, nextY] = pointOnHeart(progress + (outer ? 0.004 : -0.004));
      const petalScale = outer ? scale : scale * 0.6;

      const x = heartX * petalScale;
      const y = heartY * petalScale + offsetY;
      const z = (outer ? 0.09 : 0.16) * Math.sin(progress * Math.PI * 2 * (outer ? 5 : 3) + t * 1.4);

      // Лепесток лежит вдоль нити: угол — направление течения плюс собственный наклон.
      angle[i] = Math.atan2(-(nextY - heartY), nextX - heartX) + tilt[i];

      // Целевая точка: поворот вокруг оси Y, затем вокруг оси X.
      const xTurned = x * cosYaw + z * sinYaw;
      const zTurned = -x * sinYaw + z * cosYaw;
      const targetX = xTurned;
      const targetY = y * cosPitch - zTurned * sinPitch;
      const targetZ = y * sinPitch + zTurned * cosPitch;

      // Пружина тянет лепесток к цели, трение гасит скорость.
      let vx = velocity[i * 3], vy = velocity[i * 3 + 1], vz = velocity[i * 3 + 2];
      let px = position[i * 3], py = position[i * 3 + 1], pz = position[i * 3 + 2];
      let ax = (targetX - px) * spring - vx * damping;
      let ay = (targetY - py) * spring - vy * damping;
      let az = (targetZ - pz) * spring - vz * damping;

      if (pointer.active) { // курсор отталкивает лепестки и слегка их закручивает
        const dx = px - pointer.x;
        const dy = py - pointer.y;
        const distance = Math.hypot(dx, dy) + 1e-4;
        if (distance < REPEL_RADIUS) {
          const push = (REPEL_RADIUS - distance) ** 2 * 90 / distance;
          ax += dx * push;
          ay += dy * push;
          az -= push * 0.05;
          tumble[i] += push * dx * dt * 6;
        }
      }

      vx += ax * dt; vy += ay * dt; vz += az * dt;
      px += vx * dt; py += vy * dt; pz += vz * dt;

      position[i * 3] = px; position[i * 3 + 1] = py; position[i * 3 + 2] = pz;
      velocity[i * 3] = vx; velocity[i * 3 + 1] = vy; velocity[i * 3 + 2] = vz;

      // Кувырок затухает, и лепесток снова ложится вдоль нити.
      tumble[i] = Math.max(-14, Math.min(14, tumble[i])) * Math.max(0, 1 - dt * 1.6);
      spin[i] = (spin[i] + tumble[i] * dt) * Math.max(0, 1 - dt * 1.2);
      angle[i] += spin[i];

      radii[i] = (outer ? OUTER_RADIUS : INNER_RADIUS) * (0.9 + 0.1 * Math.min(1, gather * 3));
    }

    draw(t);
  });

  /** Перспективная проекция: мировая точка → пиксели холста (так же, как считала камера шейдера). */
  function draw(t: number): void {
    const { width, height } = canvas;
    context!.setTransform(1, 0, 0, 1, 0, 0);
    context!.clearRect(0, 0, width, height);

    // Сначала все тени, потом лепестки от дальних к ближним.
    order.sort((a, b) => position[b * 3 + 2] - position[a * 3 + 2]);
    const pixelsPerUnit = height / 2 * FOCAL;

    for (const i of order) {
      const depth = position[i * 3 + 2] + CAMERA_Z;
      const k = pixelsPerUnit / depth;
      const x = width / 2 + position[i * 3] * k;
      const y = height / 2 - position[i * 3 + 1] * k;
      const size = radii[i] * k * 2;
      if (x < -size * 2 || x > width + size * 2 || y < -size * 2 || y > height + size * 2) continue;
      const shadowSize = size * 1.9;
      context!.drawImage(shadowSprite, x + SHADOW_OFFSET[0] * k - shadowSize / 2, y + SHADOW_OFFSET[1] * k - shadowSize / 2, shadowSize, shadowSize);
    }
    for (const i of order) {
      const depth = position[i * 3 + 2] + CAMERA_Z;
      const k = pixelsPerUnit / depth;
      const x = width / 2 + position[i * 3] * k;
      const y = height / 2 - position[i * 3 + 1] * k;
      const size = radii[i] * k * 2;
      if (x < -size * 2 || x > width + size * 2 || y < -size * 2 || y > height + size * 2) continue;

      // Лепесток трепещет: его «ширина» то сжимается, то растёт, будто он поворачивается к свету.
      const flutter = prefersReducedMotion ? 1 : 0.8 + 0.2 * Math.cos(t * 1.7 + phase[i]);
      const length = size * PETAL_LENGTH;
      const cos = Math.cos(angle[i]), sin = Math.sin(angle[i]);
      context!.setTransform(cos, sin, -sin * flutter, cos * flutter, x, y);
      context!.drawImage(petalSprites[colorOf[i]], -length / 2, -length / 2, length, length);
    }
    context!.setTransform(1, 0, 0, 1, 0, 0);
  }
}
