/**
 * Фото на втором экране: круглое «раскрытие», золотой контур с уголками и подпись.
 * Начальное состояние выставляется сразу (под клипом ничего не видно), а сама анимация играет, когда фото попадает в кадр.
 */
import { gsap } from 'gsap';
import { $, $$, maybe } from '../lib/dom';
import { play, reveal } from './reveal';

export function initPhoto(): void {
  $$('.photo').forEach(initFigure);
}

function initFigure(figure: HTMLElement): void {
  if (figure.hidden) return;

  const frame = $('.photo-frame', figure);
  const caption = maybe('figcaption', figure);
  const timeline = gsap.timeline({ paused: true })
    .fromTo(frame,
      { clipPath: 'circle(0% at 50% 58%)' },
      { clipPath: 'circle(100% at 50% 50%)', duration: 2.2, ease: 'power3.out' }, 0.15)
    .fromTo($('img', frame),
      { scale: 1.4 },
      { scale: 1, duration: 3, ease: 'power2.out' }, 0.15)
    .fromTo($('.photo-ring', figure),
      { opacity: 0, scale: 0.93 },
      { opacity: 1, scale: 1, duration: 1.8, ease: 'power3.out' }, 1.1)
    .fromTo($$('.photo-corner', figure),
      { opacity: 0, scale: 0.7 },
      { opacity: 1, scale: 1, duration: 1.2, ease: 'power3.out', stagger: 0.1 }, 1.6);

  // Подпись есть не у каждого фото (у зала её нет).
  if (caption) {
    timeline.fromTo(caption,
      { opacity: 0, y: 26 },
      { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out' }, 1.9);
  }

  reveal(figure, () => play(timeline));
}
