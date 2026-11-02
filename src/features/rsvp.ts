/** Анкета гостя: проверка, отправка (в таблицу / Telegram / почту) и благодарность. */
import type { WeddingConfig } from '../config.types';
import { $ } from '../lib/dom';

interface Answer {
  name: string;
  presence: string;
  note: string;
  sentAt: string;
}

/** Ответ сохраняется и в браузере гостя — на случай, если отправка не удалась. */
function saveLocally(answer: Answer): void {
  try {
    localStorage.setItem('wedding-rsvp', JSON.stringify(answer));
  } catch {
    // хранилище недоступно (например, приватный режим) — не страшно
  }
}

/** Текст сообщения для Telegram / письма. */
function messageText(config: WeddingConfig, answer: Answer): string {
  const lines = [`Свадьба ${config.groom} & ${config.bride}`, `${answer.name}: ${answer.presence}`];
  if (answer.note) lines.push(`Пожелания: ${answer.note}`);
  return lines.join('\n');
}

/**
 * Google Apps Script не отдаёт CORS-заголовки, поэтому шлём «простой» запрос
 * и ответа не читаем: если сеть доступна, запись дойдёт.
 */
async function sendToSheet(endpoint: string, answer: Answer): Promise<void> {
  await fetch(endpoint, { method: 'POST', mode: 'no-cors', body: new URLSearchParams({ ...answer }) });
}

function openMessenger(config: WeddingConfig, text: string): void {
  const { telegram, email } = config.rsvp;
  if (telegram) {
    window.open(`https://t.me/${telegram}?text=${encodeURIComponent(text)}`, '_blank');
  } else if (email) {
    const subject = encodeURIComponent('Ответ на приглашение');
    location.href = `mailto:${email}?subject=${subject}&body=${encodeURIComponent(text)}`;
  }
}

export function initRsvpForm(config: WeddingConfig): void {
  const form = $<HTMLFormElement>('#form');
  const nameField = $<HTMLInputElement>('input[name="name"]', form);
  const submitButton = $<HTMLButtonElement>('button[type="submit"]', form);
  const errorBox = $('#formError');
  const thanks = $('#thanks');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.textContent = '';

    const data = new FormData(form);
    const answer: Answer = {
      name: String(data.get('name') ?? '').trim(),
      presence: String(data.get('presence') ?? ''),
      note: String(data.get('note') ?? '').trim(),
      sentAt: new Date().toISOString(),
    };

    if (answer.name.length < 2) {
      errorBox.textContent = 'Пожалуйста, укажите имя и фамилию';
      nameField.focus();
      return;
    }
    if (!answer.presence) {
      errorBox.textContent = 'Пожалуйста, выберите вариант ответа';
      return;
    }

    saveLocally(answer);
    submitButton.disabled = true;

    try {
      if (config.rsvp.endpoint) await sendToSheet(config.rsvp.endpoint, answer);
      openMessenger(config, messageText(config, answer));

      form.hidden = true;
      thanks.hidden = false;
      thanks.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {
      submitButton.disabled = false;
      errorBox.textContent = 'Не удалось отправить. Попробуйте ещё раз или напишите нам напрямую.';
    }
  });
}
