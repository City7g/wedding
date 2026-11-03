/** Заставка: закрытый конверт с печатью. По нажатию клапан откидывается и открывается сайт. */
import { $ } from '../lib/dom';

/** Через сколько после нажатия конверт исчезает и страница оживает. */
const OPEN_AFTER_MS = 1900;
/** Через сколько заставка удаляется из DOM (после затухания). */
const REMOVE_AFTER_MS = 3300;

let markOpened!: () => void;
/** Выполняется, когда сайт открыт: анимации появления ждут именно этого момента. */
export const siteOpened = new Promise<void>((resolve) => { markOpened = resolve; });

function showSite(): void {
  document.body.classList.remove('locked');
  document.body.classList.add('open');
  markOpened();
}

export function initIntro(): void {
  const intro = $('#intro');

  // Пришли по ссылке с якорем (#top и т. п.) — конверт не нужен, сразу показываем сайт.
  if (location.hash && location.hash !== '#') {
    showSite();
    intro.remove();
    return;
  }

  let opened = false;
  function openEnvelope(): void {
    if (opened) return;
    opened = true;

    intro.classList.add('opening');
    setTimeout(() => {
      showSite();
      intro.classList.add('done');
      scrollTo(0, 0);
    }, OPEN_AFTER_MS);
    setTimeout(() => intro.remove(), REMOVE_AFTER_MS);
  }

  $('#seal').addEventListener('click', openEnvelope);
  intro.addEventListener('click', openEnvelope);
}
