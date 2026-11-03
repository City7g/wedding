/**
 * Точка входа. Тексты и настройки — в config.ts, разметка — в index.html,
 * оформление — в style.css, а каждая «фишка» страницы живёт в своём модуле из features/.
 */
import { config } from './config';
import { buildBindings, fillContent } from './content';
import { startCountdown } from './features/countdown';
import { initDrawnText } from './features/drawText';
import { initIntro } from './features/intro';
import { initPhoto } from './features/photo';
import { initReveal } from './features/reveal';
import { initRsvpForm } from './features/rsvp';
import { initSectionReveal } from './features/sectionReveal';
import { startSilk } from './features/silk';

const bindings = buildBindings(config);
fillContent(config, bindings);

// Фон
startSilk();

// Появление блоков и «рисованные» надписи
initReveal();
initPhoto();
initSectionReveal();
void initDrawnText(bindings);

// Живые части страницы
startCountdown(new Date(config.date));
initIntro();
initRsvpForm(config);
