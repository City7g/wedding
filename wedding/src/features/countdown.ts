/** Обратный отсчёт до свадьбы. Цифры «перекатываются» сверху вниз. */
import { $, maybe } from '../lib/dom';
import { pad2 } from '../lib/utils';

/** Сколько длится анимация смены цифры — должно совпадать с rollIn/rollOut в style.css. */
const ROLL_MS = 560;

const shown = new WeakMap<HTMLElement, string>();

/**
 * Показывает `value` в элементе. При смене цифры старая уходит вниз, а новая заезжает сверху;
 * анимируется только та цифра, которая действительно изменилась.
 */
function setRolling(element: HTMLElement, value: string): void {
  const previous = shown.get(element);
  shown.set(element, value);

  // Первый показ или изменилось число цифр (например, 100 → 99): перестраиваем без анимации.
  if (previous === undefined || previous.length !== value.length) {
    element.innerHTML = [...value].map((digit) => `<span class="dg"><span class="cur">${digit}</span></span>`).join('');
    return;
  }

  [...value].forEach((digit, index) => {
    if (previous[index] === digit) return;
    const cell = element.children[index];
    const current = cell.querySelector('.cur');
    if (!current) return; // предыдущая анимация этой цифры ещё не закончилась

    const incoming = document.createElement('span');
    incoming.className = 'in';
    incoming.textContent = digit;
    cell.appendChild(incoming);
    current.className = 'out';

    setTimeout(() => {
      current.remove();
      incoming.className = 'cur';
    }, ROLL_MS);
  });
}

export function startCountdown(target: Date): void {
  const days = $('#cd-d');
  const hours = $('#cd-h');
  const minutes = $('#cd-m');
  const seconds = $('#cd-s');
  const caption = maybe('.until');

  function update(): void {
    let left = Math.max(0, Math.floor((target.getTime() - Date.now()) / 1000));
    const d = Math.floor(left / 86400); left %= 86400;
    const h = Math.floor(left / 3600); left %= 3600;
    const m = Math.floor(left / 60);
    const s = left % 60;

    setRolling(days, String(d));
    setRolling(hours, pad2(h));
    setRolling(minutes, pad2(m));
    setRolling(seconds, pad2(s));

    if (caption && target.getTime() <= Date.now()) caption.textContent = 'Этот день настал!';
  }

  update();
  setInterval(update, 1000);
}
