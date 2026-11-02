/** Короткие помощники для работы с DOM. */

/** Находит элемент по селектору. Если его нет в разметке — сразу понятная ошибка. */
export function $<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Не найден элемент: ${selector}`);
  return element;
}

/** То же, но элемент может отсутствовать. */
export function maybe<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T | null {
  return root.querySelector<T>(selector);
}

/** Все элементы по селектору — обычным массивом, а не NodeList. */
export function $$<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T[] {
  return [...root.querySelectorAll<T>(selector)];
}
