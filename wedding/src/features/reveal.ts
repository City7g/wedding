/**
 * Плавное появление блоков при прокрутке: как только элемент попадает в зону видимости,
 * ему добавляется класс `in`, а CSS делает остальное.
 */
import { $$ } from '../lib/dom';

const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    entry.target.classList.add('in');
    observer.unobserve(entry.target);
  }
}, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });

export function reveal(element: Element): void {
  observer.observe(element);
}

export function initReveal(): void {
  $$('.rv, .photo').forEach(reveal);
}
