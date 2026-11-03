/** Парящие лепестки роз: плавают на месте и смещаются при прокрутке (параллакс). */
import { $$ } from '../lib/dom';

interface Floater {
  element: HTMLElement;
  /** Чем крупнее лепесток, тем «ближе» он и тем быстрее смещается. */
  speed: number;
}

const floaters: Floater[] = [];

function scatterPetals(): void {
  for (const host of $$('.scatter')) {
    host.textContent = '';
    const count = Number(host.dataset.n) || 6;
    for (let i = 0; i < count; i++) {
      const size = 12 + Math.random() * Math.random() * 34;

      const wrapper = document.createElement('u');
      wrapper.style.cssText =
        `left:${Math.random() * 94}%;top:${4 + Math.random() * 90}%;width:${size}px;height:${size}px`;

      const petal = document.createElement('i');
      petal.style.cssText =
        `--r:${Math.round(Math.random() * 360)}deg;` +
        `animation-delay:${-Math.random() * 7}s;animation-duration:${6 + Math.random() * 5}s`;

      wrapper.appendChild(petal);
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

export function initPetalDecor(): void {
  scatterPetals();
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
}
