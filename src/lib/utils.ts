/** Гость отключил анимации в системе — их надо упростить или не показывать. */
export const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 5 → «05». */
export const pad2 = (n: number): string => String(n).padStart(2, '0');

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Экранирует текст для вставки в HTML/SVG-разметку (в том числе в атрибуты). */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
