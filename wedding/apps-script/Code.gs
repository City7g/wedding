/**
 * Принимает ответы гостей с сайта и дописывает их в таблицу.
 * Вставьте этот код в таблице: Расширения → Apps Script, затем
 * Развернуть → Новое развертывание → Веб-приложение:
 *   «Выполнять от имени» — Я, «У кого есть доступ» — Все.
 * Полученный URL (…/exec) вставьте в wedding/src/config.js → rsvp.endpoint.
 */
const SHEET_NAME = 'Ответы на форму';

// По желанию: мгновенные уведомления в Telegram (создайте бота у @BotFather,
// напишите ему любое сообщение и вставьте токен и свой chat id). Пусто — не отправлять.
const TG_TOKEN = '';
const TG_CHAT = '';

function doPost(e) {
  const p = (e && e.parameter) || {};
  const name = String(p.name || '').slice(0, 200);
  const presence = String(p.presence || '').slice(0, 100);
  const note = String(p.note || '').slice(0, 1000);
  if (!name || !presence) return ContentService.createTextOutput('bad request');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    // следующая строка — по колонке A (справа лежит «Сводка», appendRow её бы пропустил)
    const last = sh.getRange(1, 1, sh.getMaxRows(), 1).getValues().filter(r => r[0] !== '').length;
    sh.getRange(last + 1, 1, 1, 4).setValues([[new Date(), name, presence, note]]);
  } finally {
    lock.releaseLock();
  }

  if (TG_TOKEN && TG_CHAT) {
    try {
      UrlFetchApp.fetch('https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage', {
        method: 'post',
        payload: { chat_id: TG_CHAT, text: '💌 ' + name + '\n' + presence + (note ? '\n' + note : '') },
        muteHttpExceptions: true,
      });
    } catch (err) {}
  }
  return ContentService.createTextOutput('ok');
}

function doGet() {
  return ContentService.createTextOutput('ok');
}
