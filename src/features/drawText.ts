/**
 * Надписи, которые «пишутся пером».
 *
 * В разметке это элементы `<span class="draw name" data-src="groom">`: класс задаёт вид надписи
 * (см. DrawKind), data-src — что писать (ключ из Bindings или готовый текст), data-delay — пауза в секундах.
 *
 * Как это работает: настоящий шрифт Great Vibes закрыт маской из центральных линий букв. Каждая линия вычерчивается
 * (stroke-dasharray / stroke-dashoffset), и буква проявляется ровно там, где прошло перо. Впереди бежит светящаяся
 * точка с мерцающим хвостом, поэтому письмо выглядит как живой росчерк. Маска шире самой буквы, так что к концу
 * проявляется всё без «добавки»; финальное мягкое проявление лишь подстраховывает самые тонкие волоски.
 */
import { gsap } from 'gsap';
import type { Bindings } from '../content';
import { $, $$ } from '../lib/dom';
import { type Point, simplify, strokeLength, thin, toSmoothPath, traceStrokes } from '../lib/skeleton';
import { escapeHtml, sleep } from '../lib/utils';
import { play, reveal } from './reveal';

type DrawKind = 'name' | 'amp' | 'num' | 'small';

interface KindSettings {
  fontFamily: string;
  /** Размер шрифта в «внутренних» единицах SVG; на экране масштабируется CSS (--fs). */
  fontSize: number;
  /** Скорость пера относительно размера шрифта. */
  speed: number;
}

const KINDS: Record<DrawKind, KindSettings> = {
  name: { fontFamily: 'Great Vibes', fontSize: 230, speed: 5.0 },
  amp: { fontFamily: 'Great Vibes', fontSize: 200, speed: 4.5 },
  num: { fontFamily: 'Great Vibes', fontSize: 240, speed: 4.4 },
  small: { fontFamily: 'Great Vibes', fontSize: 170, speed: 8 },
};

/** Пиксель текста считается «чернилами», если он плотнее этого порога (0–255). */
const INK_THRESHOLD = 55;
/** Толщина маски относительно размера шрифта: с запасом покрывает самую жирную часть буквы. */
const MASK_WIDTH = 0.17;
/** Светящееся перо: радиус ядра и ореола относительно размера шрифта. */
const PEN_CORE = 0.04;
const PEN_GLOW = 0.2;
/** Сколько светящихся «искорок» тянется за пером и как быстро они уменьшаются. */
const TRAIL_LENGTH = 9;
/** Допуск упрощения линии штриха, в пикселях. */
const SIMPLIFY_TOLERANCE = 1.3;
/** Символы, которые нужно заранее загрузить в шрифт, помимо самих надписей. */
const PRELOAD_TEXT = '0123456789 &:.';

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
      maskContent += `<circle class="dot" fill="#fff" cx="${cx}" cy="${cy}" r="${(fontSize * 0.045).toFixed(1)}" data-d="${time.toFixed(2)}"/>`;
      time += 0.06;
    } else {
      const duration = Math.max(0.12, mark.length / penSpeed);
      const path = toSmoothPath(simplify(mark.points, SIMPLIFY_TOLERANCE));
      maskContent += `<path class="st" pathLength="1" d="${path}" data-d="${time.toFixed(2)}" data-t="${duration.toFixed(2)}"/>`;
      time += duration * 0.96; // следующий штрих начинается почти сразу: перо не «спотыкается» между буквами
    }
  }

  // 4. Настоящий текст под маской + такой же полный, который проявляется в конце.
  const maskId = `pen-mask-${++maskCounter}`;
  const strokeWidth = (fontSize * MASK_WIDTH).toFixed(1);
  const label = escapeHtml(text);
  const textAttributes = `x="${padding}" y="${baseline}" font-family="${fontFamily}" font-size="${fontSize}" fill="currentColor"`;

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}">` +
    `<defs><mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}">` +
    `<g fill="none" stroke="#fff" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${maskContent}</g>` +
    `</mask></defs>` +
    `<text ${textAttributes} mask="url(#${maskId})">${label}</text>` +
    `<text class="full" ${textAttributes} data-d="${time.toFixed(2)}">${label}</text>` +
    `<g class="pen" data-core="${(fontSize * PEN_CORE).toFixed(1)}" data-glow="${(fontSize * PEN_GLOW).toFixed(1)}"></g>` +
    `</svg>`;
}

/** Светящееся перо: ядро, ореол и хвост из искорок. Возвращает функцию, переносящую перо в точку. */
function createPen(group: SVGGElement): (x: number, y: number, restart?: boolean) => void {
  const core = Number(group.dataset.core);
  const glow = Number(group.dataset.glow);
  const circle = (r: number, fill: string, opacity: number) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    node.setAttribute('r', r.toFixed(1));
    node.setAttribute('fill', fill);
    node.setAttribute('opacity', opacity.toFixed(2));
    group.appendChild(node);
    return node;
  };

  // Хвост рисуем первым (он под ядром): чем старее искорка, тем она меньше и прозрачнее.
  const trail = Array.from({ length: TRAIL_LENGTH }, (_, i) => {
    const k = 1 - (i + 1) / (TRAIL_LENGTH + 1);
    return circle(core * (0.3 + 0.7 * k), '#fff3cf', 0.85 * k);
  });
  const halo = circle(glow, 'url(#penGlow)', 1);
  const tip = circle(core, '#fffdf5', 1);
  const history: { x: number; y: number }[] = [];

  return (x, y, restart = false) => {
    if (restart) history.length = 0;
    history.unshift({ x, y });
    history.length = Math.min(history.length, TRAIL_LENGTH + 1);
    for (const node of [halo, tip]) {
      node.setAttribute('cx', x.toFixed(1));
      node.setAttribute('cy', y.toFixed(1));
    }
    trail.forEach((node, i) => {
      const point = history[Math.min(i + 1, history.length - 1)];
      node.setAttribute('cx', point.x.toFixed(1));
      node.setAttribute('cy', point.y.toFixed(1));
    });
  };
}

/** Расписание надписи: перо вычерчивает штрихи, точки появляются, в конце мягко проявляется весь текст. */
function buildPenTimeline(element: Element): gsap.core.Timeline {
  const at = (target: Element) => Number(target.getAttribute('data-d'));
  const timeline = gsap.timeline({ paused: true, onComplete: () => element.classList.add('done') });
  const pen = $<SVGGElement>('.pen', element);
  const movePen = createPen(pen);

  for (const stroke of $$<SVGPathElement>('.st', element)) {
    const length = stroke.getTotalLength();
    timeline.fromTo(stroke, { strokeDashoffset: 1 }, {
      strokeDashoffset: 0, duration: Number(stroke.getAttribute('data-t')), ease: 'none', // ровный ход пера
      onStart: () => { gsap.set(pen, { opacity: 1 }); },
      onUpdate() {
        const point = stroke.getPointAtLength(length * this.ratio);
        movePen(point.x, point.y, this.ratio < 0.02);
      },
    }, at(stroke));
  }
  for (const dot of $$('.dot', element)) {
    timeline.fromTo(dot, { opacity: 0, scale: 0.2, transformOrigin: '50% 50%' }, {
      opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out',
    }, at(dot));
  }

  // Перо гаснет, а текст целиком мягко «подтягивает» то, что маска могла не накрыть.
  const end = at($('.full', element));
  timeline
    .to(pen, { opacity: 0, duration: 0.5, ease: 'power1.out' }, end)
    .fromTo($('.full', element), { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'sine.inOut' }, end);

  return timeline;
}

function kindOf(element: Element): KindSettings {
  const name = (Object.keys(KINDS) as DrawKind[]).find((k) => element.classList.contains(k));
  if (!name) throw new Error(`У надписи .draw не указан вид (name/amp/num/small): ${element.outerHTML}`);
  return KINDS[name];
}

export async function initDrawnText(bindings: Bindings): Promise<void> {
  const elements = $$('.draw');
  const textOf = (element: HTMLElement) => bindings[element.dataset.src ?? ''] ?? element.dataset.src ?? '';

  // Расчёт идёт по скелету букв, поэтому шрифт должен быть загружен заранее — вместе с нужными алфавитами (кириллица и т. п.).
  const preload = PRELOAD_TEXT + elements.map(textOf).join('');
  await Promise.all(Object.values(KINDS).map((kind) =>
    document.fonts.load(fontOf(kind), preload).catch(() => [])));

  const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;

  for (const element of elements) {
    const text = textOf(element);
    const delay = Number(element.dataset.delay ?? 0);

    element.innerHTML = buildPenText(text, kindOf(element), delay, context);
    const timeline = buildPenTimeline(element);
    reveal(element, () => play(timeline)); // начнёт писать, когда блок появится на экране

    await sleep(0); // отдаём управление браузеру, чтобы страница не подвисала
  }
}
