/**
 * Надписи, которые «пишутся пером».
 *
 * В разметке это элементы `<span class="draw name" data-src="groomLat">`: класс задаёт вид надписи
 * (см. DrawKind), data-src — что писать (ключ из Bindings или готовый текст), data-delay — пауза в секундах.
 *
 * Как это работает: текст настоящим шрифтом Great Vibes закрыт маской из центральных линий букв.
 * Линии вычерчиваются слева направо, и буквы проявляются ровно там, где прошло «перо».
 * В конце проявляется весь текст целиком — на случай тонких волосков, которые маска не покрыла.
 */
import type { Bindings } from '../content';
import { $$ } from '../lib/dom';
import { type Point, simplify, strokeLength, thin, toSmoothPath, traceStrokes } from '../lib/skeleton';
import { escapeHtml, sleep } from '../lib/utils';
import { reveal } from './reveal';

type DrawKind = 'name' | 'amp' | 'num' | 'small';

interface KindSettings {
  fontFamily: string;
  /** Размер шрифта в «внутренних» единицах SVG; на экране масштабируется CSS (--fs). */
  fontSize: number;
  /** Скорость пера относительно размера шрифта. */
  speed: number;
}

const KINDS: Record<DrawKind, KindSettings> = {
  name: { fontFamily: 'Great Vibes', fontSize: 230, speed: 4.0 },
  amp: { fontFamily: 'Great Vibes', fontSize: 200, speed: 4.0 },
  num: { fontFamily: 'Great Vibes', fontSize: 240, speed: 3.8 },
  small: { fontFamily: 'Great Vibes', fontSize: 170, speed: 6.5 },
};

/** Пиксель текста считается «чернилами», если он плотнее этого порога (0–255). */
const INK_THRESHOLD = 55;
/** Допуск упрощения линии штриха, в пикселях. */
const SIMPLIFY_TOLERANCE = 1.3;
/** Символы, которые нужно заранее загрузить в шрифт. */
const PRELOAD_TEXT = 'DimaNatali 0123456789 &:.';

let maskCounter = 0;

function fontOf({ fontFamily, fontSize }: KindSettings): string {
  return `${fontSize}px "${fontFamily}"`;
}

/** Собирает SVG надписи; `delay` — когда (в секундах) перо начнёт писать. */
function buildPenText(text: string, kind: KindSettings, delay: number, context: CanvasRenderingContext2D): string {
  const { fontSize, fontFamily, speed } = kind;
  const padding = Math.round(fontSize * 0.2);
  const baseline = Math.round(fontSize * 1.1);

  context.font = fontOf(kind);
  const width = Math.ceil(context.measureText(text).width + padding * 2);
  const height = Math.ceil(fontSize * 1.6);

  // 1. Рисуем текст на скрытом холсте и превращаем его в битовую карту.
  const canvas = context.canvas;
  canvas.width = width;
  canvas.height = height;
  context.font = fontOf(kind);
  context.fillStyle = '#000';
  context.textBaseline = 'alphabetic';
  context.clearRect(0, 0, width, height);
  context.fillText(text, padding, baseline);

  const pixels = context.getImageData(0, 0, width, height).data;
  const bitmap = new Uint8Array(width * height);
  for (let i = 0; i < bitmap.length; i++) bitmap[i] = pixels[i * 4 + 3] > INK_THRESHOLD ? 1 : 0;

  // 2. Сводим буквы к линиям и делим на штрихи.
  thin(bitmap, width, height);
  const strokes = traceStrokes(bitmap, width, height).map((stroke) => ({
    ...stroke,
    length: strokeLength(stroke.points),
  }));

  // Совсем короткие обрывки отбрасываем, но одиночные точки (двоеточие, точка) оставляем.
  const minLength = fontSize * 0.07;
  const dots = strokes.filter((s) => s.length < minLength && !s.touched);
  const lines = strokes.filter((s) => s.length >= minLength);

  // Перо идёт слева направо.
  for (const line of lines) {
    const start = line.points[0];
    const end = line.points[line.points.length - 1];
    if (start[0] > end[0] + 2) line.points.reverse();
  }

  // 3. Расписываем по времени: каждый штрих начинается, когда перо закончило предыдущий.
  type Mark = { kind: 'line'; points: Point[]; length: number } | { kind: 'dot'; center: Point };
  const marks: { x: number; mark: Mark }[] = [
    ...lines.map((l) => ({ x: l.points[0][0], mark: { kind: 'line', points: l.points, length: l.length } satisfies Mark })),
    ...dots.map((d) => ({ x: d.points[0][0], mark: { kind: 'dot', center: d.points[Math.floor(d.points.length / 2)] } satisfies Mark })),
  ].sort((a, b) => a.x - b.x);

  const penSpeed = fontSize * speed;
  let time = delay;
  let maskContent = '';

  for (const { mark } of marks) {
    if (mark.kind === 'dot') {
      const [cx, cy] = mark.center;
      maskContent += `<circle class="dot" fill="#fff" cx="${cx}" cy="${cy}" r="${(fontSize * 0.045).toFixed(1)}" style="--d:${time.toFixed(2)}s"/>`;
      time += 0.06;
    } else {
      const duration = Math.max(0.12, mark.length / penSpeed);
      const path = toSmoothPath(simplify(mark.points, SIMPLIFY_TOLERANCE));
      maskContent += `<path class="st" pathLength="1" d="${path}" style="--d:${time.toFixed(2)}s;--t:${duration.toFixed(2)}s"/>`;
      time += duration * 0.8 + 0.02;
    }
  }

  // 4. Настоящий текст под маской + такой же полный, который проявляется в конце.
  const maskId = `pen-mask-${++maskCounter}`;
  const strokeWidth = (fontSize * 0.13).toFixed(1);
  const label = escapeHtml(text);
  const textAttributes = `x="${padding}" y="${baseline}" font-family="${fontFamily}" font-size="${fontSize}" fill="currentColor"`;

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}">` +
    `<defs><mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}">` +
    `<g fill="none" stroke="#fff" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${maskContent}</g>` +
    `</mask></defs>` +
    `<text ${textAttributes} mask="url(#${maskId})">${label}</text>` +
    `<text class="full" ${textAttributes} style="--te:${(time + 0.1).toFixed(2)}s">${label}</text>` +
    `</svg>`;
}

function kindOf(element: Element): KindSettings {
  const name = (Object.keys(KINDS) as DrawKind[]).find((k) => element.classList.contains(k));
  if (!name) throw new Error(`У надписи .draw не указан вид (name/amp/num/small): ${element.outerHTML}`);
  return KINDS[name];
}

export async function initDrawnText(bindings: Bindings): Promise<void> {
  // Расчёт идёт по скелету букв, поэтому шрифт должен быть загружен заранее.
  await Promise.all(Object.values(KINDS).map((kind) =>
    document.fonts.load(fontOf(kind), PRELOAD_TEXT).catch(() => [])));

  const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;

  for (const element of $$('.draw')) {
    const source = element.dataset.src ?? '';
    const text = bindings[source] ?? source;
    const delay = Number(element.dataset.delay ?? 0);

    element.innerHTML = buildPenText(text, kindOf(element), delay, context);
    reveal(element); // начнёт писать, когда блок появится на экране

    await sleep(0); // отдаём управление браузеру, чтобы страница не подвисала
  }
}
