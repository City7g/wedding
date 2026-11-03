/*
 * Всё, что нужно поменять под себя, — здесь.
 * Остальные файлы трогать не нужно.
 */
import type { WeddingConfig } from './config.types';

export const config: WeddingConfig = {
  groom: 'Дима',
  bride: 'Натали',

  // Для надписей шрифтом Great Vibes (в нём нет кириллицы — имена пишутся латиницей)
  groomLatin: 'Dima',
  brideLatin: 'Natali',

  // Дата и время начала (местное время гостей)
  date: '2026-12-12T16:30:00',

  timeline: [
    { time: '12:30', title: 'Церемония в ЗАГСе', text: 'Торжественная регистрация брака' },
    { time: '14:00', title: 'Свадебная речь', text: 'Тёплые слова, поздравления и первые тосты' },
    { time: '16:30', title: 'Праздничный банкет', text: 'Тосты, танцы и сюрпризы' },
  ],

  // Ваше фото на втором экране: файл лежит в public/photo.jpg
  photo: '/photo.jpg',

  organizer: {
    name: 'Дима',
    phone: '+380 97 956 13 09',
    telegram: '', // например 'alena_wed' (без @), можно оставить пустым
  },

  rsvp: {
    deadline: '1 декабря',
    // Куда приходят ответы гостей (любой из вариантов, можно несколько):
    endpoint: 'https://script.google.com/macros/s/AKfycbxwx_4QQu421uEHQLed5aBJ_gtBBa0EAIRne7-nkxkyga2FPMrFrANLUVRlY6oRq45vBA/exec', // URL веб-приложения Google Apps Script (см. apps-script/Code.gs) — ответы пойдут в таблицу
    telegram: '', // ваш ник в Telegram без @ — откроется чат с готовым ответом
    email: '',    // почта — откроется письмо с готовым ответом
  },
};
