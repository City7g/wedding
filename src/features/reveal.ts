/**
 * Появление блоков при прокрутке (GSAP): как только элемент попадает в зону видимости, запускается его анимация.
 *
 * Обычные блоки (`.rv`) плавно всплывают; те, что попали в кадр одновременно, идут «волной» с небольшой паузой.
 * Особые блоки (надписи пером, фото, календарь) передают в `reveal` свою анимацию.
 * Пока конверт закрыт, ничего не играет — всё начнётся, когда сайт откроется.
 */
import { gsap } from 'gsap';
import { $$ } from '../lib/dom';
import { prefersReducedMotion } from '../lib/utils';
import { siteOpened } from './intro';

/** Пауза между блоками, которые появляются одновременно. */
const STAGGER = 0.12;

const handlers = new WeakMap<Element, () => void>();

/** Запускает анимацию; гостю с отключёнными анимациями сразу показывает конец. */
export function play(animation: gsap.core.Animation): void {
  if (prefersReducedMotion) animation.progress(1);
  else animation.play();
}

/** Стандартное появление: поднимается снизу и проявляется (без blur — он тяжёлый для видеокарты). */
function riseIn(elements: Element[]): void {
  const tween = gsap.fromTo(elements,
    { opacity: 0, y: 26 },
    {
      opacity: 1, y: 0, duration: 1.1, ease: 'power3.out',
      stagger: STAGGER,
      // Своя пауза у блока — в data-delay (секунды).
      delay: (_, element: HTMLElement) => Number(element.dataset.delay ?? 0),
      onComplete: () => {
        // После показа убираем всё лишнее: дальше блок оформляет только CSS (например, :hover у кнопки).
        for (const element of elements) {
          gsap.set(element, { clearProps: 'all' });
          element.classList.add('in');
        }
      },
    });
  if (prefersReducedMotion) tween.progress(1);
}

const observer = new IntersectionObserver((entries) => {
  const visible = entries.filter((entry) => entry.isIntersecting);
  for (const entry of visible) observer.unobserve(entry.target);

  // Порядок — как в документе, чтобы «волна» шла сверху вниз.
  const targets = visible
    .map((entry) => entry.target)
    .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

  void siteOpened.then(() => {
    const plain: Element[] = [];
    for (const target of targets) {
      handlers.get(target)?.();
      if (target.classList.contains('rv')) plain.push(target);
    }
    if (plain.length) riseIn(plain);
  });
}, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });

/** Следит за элементом: `.rv` всплывает сам, а `animation` (если есть) играет поверх — для особых блоков. */
export function reveal(element: Element, animation?: () => void): void {
  if (animation) handlers.set(element, animation);
  observer.observe(element);
}

export function initReveal(): void {
  $$('.rv').forEach((element) => reveal(element));
}
