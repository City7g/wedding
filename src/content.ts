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
    orgName: config.organizer.name,
    deadline: config.rsvp.deadline,
    venueName: config.venue.name,
    venueAddress: config.venue.address,
    venueCity: config.venue.city,

    // Для надписей, которые «рисуются» пером:
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

  fillCalendar(config);
  fillVenue(config);
  fillPalette(config);
  fillTimeline(config);
  fillPhoto(config);
  fillContactLink(config);
}

/** Адрес ведёт на карту; без фото блок обходится без картинки. */
function fillVenue({ venue }: WeddingConfig): void {
  const query = encodeURIComponent(`${venue.name}, ${venue.address}, ${venue.city}`);
  $<HTMLAnchorElement>('#venueAddress').href = `https://www.google.com/maps/search/?api=1&query=${query}`;

  const figure = $('#venueFigure');
  const image = $<HTMLImageElement>('#venuePhoto');
  if (!venue.photo) {
    figure.hidden = true;
    return;
  }
  image.onerror = () => { figure.hidden = true; };
  image.src = venue.photo;
}

/** Каждый цвет — пара пересекающихся кругов: «шёлк» с переливом и ровная заливка. */
function fillPalette({ palette }: WeddingConfig): void {
  $('#palette').innerHTML = palette
    .map(({ name, note, color }) => `
      <li class="rv" style="--c: ${escapeHtml(color)}">
        <span class="swatch"><i class="silk"></i><i class="flat"></i></span>
        <strong>${escapeHtml(name)}</strong>
        ${note ? `<em>${escapeHtml(note)}</em>` : ''}
      </li>`)
    .join('');
}

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

/** Календарь месяца свадьбы (неделя с понедельника), день свадьбы — в сердечке. */
function fillCalendar({ date }: WeddingConfig): void {
  const wedding = new Date(date);
  const year = wedding.getFullYear();
  const month = wedding.getMonth();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const blanks = Array.from({ length: offset }, () => '<span></span>');
  const days = Array.from({ length: daysInMonth }, (_, i) =>
    i + 1 === wedding.getDate() ? `<span class="day on"><b>${i + 1}</b></span>` : `<span class="day">${i + 1}</span>`);

  $('#calendar').innerHTML = `
    <h3 class="cal-month">${MONTHS[month]}</h3>
    <div class="cal-grid">
      ${WEEKDAYS.map((d) => `<span class="wd">${d}</span>`).join('')}
      ${[...blanks, ...days].join('')}
    </div>`;
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
