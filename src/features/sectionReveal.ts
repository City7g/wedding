/**
 * Дополнительные появления внутри блоков: календарь «набирается» по клеточкам и сердечко вспыхивает,
 * а у цветов дресс-кода второй круг выезжает из-под первого.
 */
import { gsap } from 'gsap';
import { $, $$ } from '../lib/dom';
import { play, reveal } from './reveal';

/** Масштаб сердечка в календаре в покое (см. .cal-grid .day.on::before). */
const HEART_SCALE = 0.82;
/** На сколько второй круг палитры сдвинут под первый. */
const SWATCH_SHIFT = 48;

function initCalendar(): void {
  const calendar = $('#calendar');
  const cells = $$('.wd, .day', calendar);
  const heart = $('.day.on', calendar);

  const timeline = gsap.timeline({ paused: true })
    .fromTo(cells,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out', stagger: { each: 0.018, from: 'start' }, clearProps: 'transform' }, 0.2)
    .fromTo(heart,
      { '--heart': 0 },
      { '--heart': HEART_SCALE, duration: 1.1, ease: 'back.out(2.4)' }, '>-0.2');

  reveal(calendar, () => play(timeline));
}

function initPalette(): void {
  for (const item of $$('#palette li')) {
    const timeline = gsap.timeline({ paused: true })
      .fromTo($('.flat', item),
        { x: -SWATCH_SHIFT, opacity: 0 },
        { x: 0, opacity: 0.92, duration: 1.1, ease: 'power3.out' }, 0.35);
    reveal(item, () => play(timeline));
  }
}

export function initSectionReveal(): void {
  initCalendar();
  initPalette();
}
