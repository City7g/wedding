/** Жемчужные украшения: нити на клапане конверта и парящие жемчужины с параллаксом. */
import { $$, maybe } from '../lib/dom';

const SVG_NS = 'http://www.w3.org/2000/svg';

type PathFunction = (t: number) => { x: number; y: number };

// ---------------------------------------------------------------------------
// Нити: жемчужины раскладываются вдоль кривой на равных расстояниях.
// ---------------------------------------------------------------------------

function layPearls(container: SVGElement, path: PathFunction, size: number, spacing: number): void {
  // Сначала считаем накопленную длину кривой, чтобы расставить жемчужины по длине дуги.
  const samples: { x: number; y: number; length: number }[] = [];
  let length = 0;
  let previous = path(0);
  for (let i = 0; i <= 400; i++) {
    const point = path(i / 400);
    length += Math.hypot(point.x - previous.x, point.y - previous.y);
    samples.push({ ...point, length });
    previous = point;
  }

  container.textContent = '';
  let sampleIndex = 0;
  for (let distance = 0; distance <= length; distance += size * spacing) {
    while (sampleIndex < samples.length - 1 && samples[sampleIndex].length < distance) sampleIndex++;
    const pearl = document.createElementNS(SVG_NS, 'circle');
    pearl.setAttribute('cx', samples[sampleIndex].x.toFixed(1));
    pearl.setAttribute('cy', samples[sampleIndex].y.toFixed(1));
    pearl.setAttribute('r', (size / 2).toFixed(1));
    pearl.setAttribute('fill', 'url(#pearl)');
    container.appendChild(pearl);
  }
}

/** Две нити «галочкой» от верхних углов клапана к его кончику. */
function renderFlapStrands(svg: SVGSVGElement, width: number, height: number): void {
  const size = Math.max(13, Math.min(width, 600) / 26);
  const leftEdge: PathFunction = (t) => ({ x: -size + (width / 2 + size) * t, y: height * t });
  const rightEdge: PathFunction = (t) => ({ x: width - leftEdge(t).x, y: height * t });

  const left = document.createElementNS(SVG_NS, 'g');
  const right = document.createElementNS(SVG_NS, 'g');
  svg.textContent = '';
  svg.append(left, right);
  layPearls(left, leftEdge, size, 0.95);
  layPearls(right, rightEdge, size, 0.95);
}

/** Провисающая нить поперёк блока; форма задаётся data-y0, data-y1 и data-sag. */
function renderWaveStrand(svg: SVGSVGElement, element: HTMLElement, width: number, height: number): void {
  const startY = Number(element.dataset.y0) * height;
  const endY = Number(element.dataset.y1) * height;
  const sag = Number(element.dataset.sag) * height;

  layPearls(svg, (t) => ({
    x: -10 + (width + 20) * t,
    // линия от начала к концу + провисание + мягкая волна
    y: startY + (endY - startY) * t + Math.sin(Math.PI * t) * sag - Math.sin(t * Math.PI * 2) * 6,
  }), 11, 0.9);
}

function renderStrands(): void {
  for (const element of $$('[data-strand]')) {
    let svg = maybe<SVGSVGElement>('svg', element);
    if (!svg) {
      svg = document.createElementNS(SVG_NS, 'svg');
      element.appendChild(svg);
    }
    const { clientWidth: width, clientHeight: height } = element;
    if (element.dataset.strand === 'flap') renderFlapStrands(svg, width, height);
    else renderWaveStrand(svg, element, width, height);
  }
}

// ---------------------------------------------------------------------------
// Парящие жемчужины: плавают на месте и смещаются при прокрутке (параллакс).
// ---------------------------------------------------------------------------

interface Floater {
  element: HTMLElement;
  /** Чем крупнее жемчужина, тем «ближе» она и тем быстрее смещается. */
  speed: number;
}

const floaters: Floater[] = [];

function scatterPearls(): void {
  for (const host of $$('.scatter')) {
    host.textContent = '';
    const count = Number(host.dataset.n) || 6;
    for (let i = 0; i < count; i++) {
      const size = 8 + Math.random() * Math.random() * 30;

      const wrapper = document.createElement('u');
      wrapper.style.cssText =
        `left:${Math.random() * 94}%;top:${4 + Math.random() * 90}%;width:${size}px;height:${size}px`;

      const pearl = document.createElement('i');
      pearl.style.cssText =
        `width:100%;height:100%;animation-delay:${-Math.random() * 7}s;animation-duration:${6 + Math.random() * 5}s`;

      wrapper.appendChild(pearl);
      host.appendChild(wrapper);
      floaters.push({ element: wrapper, speed: 0.03 + (size / 38) * 0.14 + Math.random() * 0.03 });
    }
  }
}

function applyParallax(): void {
  const viewportHeight = innerHeight;
  for (const { element, speed } of floaters) {
    const rect = element.parentElement!.getBoundingClientRect();
    if (rect.bottom < -100 || rect.top > viewportHeight + 100) continue; // вне экрана
    const offset = (rect.top + rect.height / 2 - viewportHeight / 2) * -speed;
    element.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
  }
}

export function initPearlDecor(): void {
  scatterPearls();
  renderStrands();
  applyParallax();

  // Параллакс обновляем не чаще одного раза за кадр.
  let parallaxQueued = false;
  addEventListener('scroll', () => {
    if (parallaxQueued) return;
    parallaxQueued = true;
    requestAnimationFrame(() => {
      parallaxQueued = false;
      applyParallax();
    });
  }, { passive: true });

  // Нити зависят от размеров блоков — перерисовываем при изменении окна и после загрузки шрифтов.
  let resizeTimer: number | undefined;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(renderStrands, 120);
  });
  document.fonts?.ready.then(renderStrands);
}
