/**
 * Прелоадер: разметка и стили лежат прямо в index.html и видны сразу, ещё до основных стилей.
 * Здесь мы только ждём, пока загрузятся стили, шрифты и фотографии, двигаем полоску прогресса
 * и плавно убираем заставку, чтобы сайт не показывался «голым».
 */
import type { WeddingConfig } from '../config.types';
import { prefersReducedMotion } from '../lib/utils';

/** Минимум показа, чтобы анимация колец успела отыграть, а не мигнула. */
const MIN_DURATION_MS = prefersReducedMotion ? 0 : 2000;
/** Если что-то грузится слишком долго (плохая сеть), всё равно пускаем на сайт. */
const MAX_DURATION_MS = 8000;
const FADE_MS = 900;

const FONTS = [
  '300 1em "Cormorant Garamond"',
  '400 1em "Cormorant Garamond"',
  'italic 400 1em "Cormorant Garamond"',
  '300 1em "Montserrat"',
  '1em "Great Vibes"',
];
const SAMPLE_TEXT = 'Дима Наталья АБВ абв 0123456789 Abc';

const pageLoaded = () => document.readyState === 'complete'
  ? Promise.resolve()
  : new Promise<void>((resolve) => addEventListener('load', () => resolve(), { once: true }));

const fontsLoaded = () => Promise.all(FONTS.map((font) => document.fonts.load(font, SAMPLE_TEXT)))
  .then(() => document.fonts.ready)
  .then(() => undefined);

const imageLoaded = (src: string) => {
  const image = new Image();
  image.src = src;
  return image.decode();
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Ждёт загрузки всего нужного, показывая прогресс. Не падает на ошибках — просто идёт дальше. */
export async function waitForAssets(config: WeddingConfig): Promise<void> {
  const preloader = document.getElementById('preloader');
  const bar = document.getElementById('plBar');
  if (!preloader) return;

  const photos = [config.photo, config.venue.photo].filter(Boolean) as string[];
  const tasks = [pageLoaded(), fontsLoaded(), ...photos.map(imageLoaded)];

  let finished = 0;
  const setProgress = (value: number) => bar?.style.setProperty('--p', String(Math.min(1, value)));
  setProgress(0.12);

  const everything = Promise.all(tasks.map((task) =>
    task.catch(() => undefined).then(() => setProgress(0.12 + (++finished / tasks.length) * 0.88))));

  await Promise.all([
    Promise.race([everything, wait(MAX_DURATION_MS)]),
    wait(MIN_DURATION_MS),
  ]);
  setProgress(1);
  await wait(250);
}

/** Плавно убирает заставку и удаляет её из DOM. */
export function hidePreloader(): void {
  const preloader = document.getElementById('preloader');
  if (!preloader) return;
  preloader.classList.add('done');
  setTimeout(() => preloader.remove(), FADE_MS + 100);
}
