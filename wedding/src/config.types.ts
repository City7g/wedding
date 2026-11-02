export interface TimelineItem {
  time: string;
  title: string;
  text: string;
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
  /** Имена для надписей шрифтом Great Vibes — в нём нет кириллицы. */
  groomLatin: string;
  brideLatin: string;
  /** Дата и время начала, местное время гостей (ISO без часового пояса). */
  date: string;
  timeline: TimelineItem[];
  /** Фото на втором экране. Файл лежит в public/. Пустая строка — блок скрывается. */
  photo: string;
  organizer: Organizer;
  rsvp: RsvpSettings;
}
