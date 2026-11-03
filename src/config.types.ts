export interface TimelineItem {
  time: string;
  title: string;
  text: string;
}

export interface Venue {
  name: string;
  /** Улица и дом, вторая строка — город. */
  address: string;
  city: string;
  /** Фото места. Файл лежит в public/. Пустая строка — фото не показывается. */
  photo: string;
}

export interface PaletteColor {
  name: string;
  /** Пояснение мелким шрифтом под названием (необязательно). */
  note?: string;
  /** Основной оттенок в CSS-формате, например '#6b1426'. */
  color: string;
}

export interface Organizer {
  name: string;
  phone: string;
  /** Ник в Telegram без @. Если указан, кнопка «Детали» ведёт в Telegram, а не на звонок. */
  telegram: string;
}

export interface RsvpSettings {
  /** Крайний срок ответа — показывается над анкетой. */
  deadline: string;
  /** Адрес веб-приложения Google Apps Script (apps-script/Code.gs): ответы попадут в таблицу. */
  endpoint: string;
  /** Ник в Telegram без @: откроется чат с готовым текстом ответа. */
  telegram: string;
  /** Почта: откроется письмо с готовым текстом ответа. */
  email: string;
}

export interface WeddingConfig {
  groom: string;
  bride: string;
  /** Дата и время начала, местное время гостей (ISO без часового пояса). */
  date: string;
  venue: Venue;
  /** Цвета дресс-кода. */
  palette: PaletteColor[];
  timeline: TimelineItem[];
  /** Фото на втором экране. Файл лежит в public/. Пустая строка — блок скрывается. */
  photo: string;
  organizer: Organizer;
  rsvp: RsvpSettings;
}
