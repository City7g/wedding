/**
 * Заставка: письмо посреди экрана. По нажатию сперва открывается конверт (клапан разворачивается на 180° и остаётся открытым, из конверта выезжает открытка),
 * а чуть позже письмо сильно увеличивается и растворяется — под ним уже оживает сайт.
 */
import { gsap } from 'gsap';
import { $, $$ } from '../lib/dom';
import { prefersReducedMotion } from '../lib/utils';

let markOpened!: () => void;
/** Выполняется, когда сайт открыт: анимации появления ждут именно этого момента. */
export const siteOpened = new Promise<void>((resolve) => { markOpened = resolve; });

function showSite(): void {
  document.body.classList.remove('locked');
  document.body.classList.add('open');
  markOpened();
}

/** Во сколько раз письмо вырастает, пока улетает на зрителя. */
const ZOOM = 7;
/** Через сколько секунд после нажатия (когда клапан уже открылся) письмо начинает улетать. */
const OPEN_DURATION = 1.25;

export function initIntro(): void {
  const intro = $('#intro');

  // Пришли по ссылке с якорем (#top и т. п.) — письмо не нужно, сразу показываем сайт.
  if (location.hash && location.hash !== '#') {
    showSite();
    intro.remove();
    return;
  }

  const letter = $('#letter');
  const hint = $('.env-hint', intro);

  const flap = $('.letter-flap', letter);
  const flapShadows = $$('.flap-shadow', flap);
  const flapInner = $('.flap-inner', flap);
  const card = $('.letter-card', letter);
  const seal = $('.seal', letter);

  // Письмо мягко появляется при загрузке.
  if (!prefersReducedMotion) {
    gsap.from(letter, { opacity: 0, y: 36, scale: 0.94, duration: 1.1, ease: 'power3.out' });
    gsap.from(hint, { opacity: 0, duration: 1, delay: 0.8 });
  }

  let opened = false;
  letter.addEventListener('click', () => {
    if (opened) return;
    opened = true;
    intro.classList.add('opening');

    if (prefersReducedMotion) {
      showSite();
      intro.remove();
      return;
    }

    gsap.timeline({ onComplete: () => intro.remove() })
      .to(hint, { opacity: 0, duration: 0.3, overwrite: true }, 0)
      // 1. Открытие: печать отпускает письмо, клапан разворачивается на 180°, из конверта выезжает открытка.
      .to(seal, { scale: 0.7, opacity: 0, duration: 0.35, ease: 'power2.in' }, 0)
      // Клапан разворачивается на 180° вокруг верхнего края и остаётся открытым (за открыткой).
      .to(flap, { rotationX: -180, transformPerspective: 900, duration: 0.85, ease: 'power2.inOut' }, 0.1)
      .set(flap, { zIndex: 0 }, 0.52)
      .to(flapShadows, { opacity: 0, duration: 0.3 }, 0.1)
      .to(flapInner, { opacity: 1, duration: 0.3 }, 0.5)
      // Из конверта выезжает открытка.
      .to(card, { yPercent: -50, duration: 0.8, ease: 'power2.out' }, 0.5)
      // 2. Письмо разгоняется на зрителя; прозрачность уходит чуть позже, когда оно уже заполнило экран.
      .to(letter, { scale: ZOOM, duration: 1.5, ease: 'power3.in' }, OPEN_DURATION)
      .to(letter, { opacity: 0, duration: 0.9, ease: 'power1.in' }, OPEN_DURATION + 0.55)
      // Сайт начинает появляться ещё под письмом.
      .add(showSite, OPEN_DURATION + 0.7);
  });
}
