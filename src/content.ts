/** Подставляет в разметку тексты, фото и контакты из config.ts. */
import type { WeddingConfig } from './config.types';
import { $, $$ } from './lib/dom';
import { escapeHtml, pad2 } from './lib/utils';

/** Значения для атрибутов data-bind / data-src в index.html. */
export type Bindings = Record<string, string>;

export function buildBindings(config: WeddingConfig): Bindings {
  const date = new Date(config.date);
  const day = pad2(date.getDate());
  const month = pad2(date.getMonth() + 1);
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());

  return {
    groom: config.groom,
    bride: config.bride,
    monogram: `${config.groom[0]}&${config.bride[0]}`,
    orgName: config.organizer.name,
    deadline: config.rsvp.deadline,

    // Для надписей, которые «рисуются» пером:
    groomLat: config.groomLatin || config.groom,
    brideLat: config.brideLatin || config.bride,
    dateShort: `${day}.${month}.${String(date.getFullYear()).slice(-2)}`,
    dateDots: `${day} . ${month} . ${date.getFullYear()}`,
    timeOnly: `${hours} : ${minutes}`,
  };
}

export function fillContent(config: WeddingConfig, bindings: Bindings): void {
  for (const element of $$('[data-bind]')) {
    element.textContent = bindings[element.dataset.bind ?? ''] ?? '';
  }
  document.title = `${config.groom} & ${config.bride} — приглашение на свадьбу`;

  fillTimeline(config);
  fillPhoto(config);
  fillContactLink(config);
}

function fillTimeline({ timeline }: WeddingConfig): void {
  $('#timeline').innerHTML = timeline
    .map(({ time, title, text }) => `
      <li class="rv">
        <time>${escapeHtml(time)}</time>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(text)}</p>
      </li>`)
    .join('');
}

/** Если фото не задано или не загрузилось — блок просто скрывается. */
function fillPhoto({ photo }: WeddingConfig): void {
  const figure = $('#photo');
  const image = $<HTMLImageElement>('#photoImg');
  if (!photo) {
    figure.hidden = true;
    return;
  }
  image.onerror = () => { figure.hidden = true; };
  image.src = photo;
}

/** Кнопка в «Деталях»: звонок на телефон или чат в Telegram. */
function fillContactLink({ organizer }: WeddingConfig): void {
  const link = $<HTMLAnchorElement>('#orgLink');
  if (organizer.telegram) {
    link.href = `https://t.me/${organizer.telegram}`;
    link.target = '_blank';
    link.textContent = 'Написать в Telegram';
  } else {
    link.href = `tel:${organizer.phone.replace(/[^+\d]/g, '')}`;
    link.textContent = organizer.phone;
  }
}
