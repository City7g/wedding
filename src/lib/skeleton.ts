/**
 * Превращает закрашенные буквы в линии, по которым может «идти перо».
 *
 * Конвейер: растровая картинка текста → утончение до «скелета» шириной в один пиксель
 * (Zhang–Suen) → обход скелета в отдельные штрихи → упрощение и сглаживание штрихов.
 */

export type Point = [number, number];

export interface Stroke {
  points: Point[];
  /** Штрих касается другого штриха (то есть это ветка буквы, а не отдельная точка). */
  touched: boolean;
}

const NEIGHBORS: Point[] = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];

/**
 * Утончение Zhang–Suen: по очереди срезает «лишние» пиксели с краёв, пока не останется
 * линия в один пиксель. `bitmap` — массив нулей и единиц размером width × height; меняется на месте.
 */
export function thin(bitmap: Uint8Array, width: number, height: number): void {
  const toRemove: number[] = [];
  let changed = true;

  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      toRemove.length = 0;
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const i = y * width + x;
          if (!bitmap[i]) continue;

          // Восемь соседей по часовой стрелке, начиная с верхнего.
          const p2 = bitmap[i - width], p3 = bitmap[i - width + 1], p4 = bitmap[i + 1], p5 = bitmap[i + width + 1];
          const p6 = bitmap[i + width], p7 = bitmap[i + width - 1], p8 = bitmap[i - 1], p9 = bitmap[i - width - 1];

          const neighborCount = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (neighborCount < 2 || neighborCount > 6) continue;

          const transitions =
            Number(!p2 && !!p3) + Number(!p3 && !!p4) + Number(!p4 && !!p5) + Number(!p5 && !!p6) +
            Number(!p6 && !!p7) + Number(!p7 && !!p8) + Number(!p8 && !!p9) + Number(!p9 && !!p2);
          if (transitions !== 1) continue;

          const blocked = pass === 0
            ? p2 * p4 * p6 || p4 * p6 * p8
            : p2 * p4 * p8 || p2 * p6 * p8;
          if (blocked) continue;

          toRemove.push(i);
        }
      }
      for (const i of toRemove) bitmap[i] = 0;
      if (toRemove.length) changed = true;
    }
  }
}

/**
 * Обходит скелет и режет его на штрихи. Начинает с концов линий (слева направо),
 * потом добирает оставшееся — замкнутые петли, вроде «о».
 */
export function traceStrokes(bitmap: Uint8Array, width: number, height: number): Stroke[] {
  const owner = new Uint16Array(width * height); // номер штриха, которому принадлежит пиксель
  const xOf = (i: number) => i % width;
  const yOf = (i: number) => (i / width) | 0;

  const skeleton: number[] = [];
  for (let i = 0; i < width * height; i++) if (bitmap[i]) skeleton.push(i);

  const neighborsOf = (i: number): number[] => {
    const result: number[] = [];
    for (const [dx, dy] of NEIGHBORS) {
      const nx = xOf(i) + dx;
      const ny = yOf(i) + dy;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height && bitmap[ny * width + nx]) result.push(ny * width + nx);
    }
    return result;
  };
  const areAdjacent = (a: number, b: number) => Math.abs(xOf(a) - xOf(b)) <= 1 && Math.abs(yOf(a) - yOf(b)) <= 1;

  const byX = (a: number, b: number) => xOf(a) - xOf(b);
  const endpoints = skeleton.filter((i) => neighborsOf(i).length <= 1).sort(byX);
  const leftToRight = [...skeleton].sort(byX);

  const strokes: Stroke[] = [];
  let strokeId = 0;

  function walk(start: number): void {
    strokeId++;
    const path = [start];
    owner[start] = strokeId;
    let current = start;
    let directionX = 0;
    let directionY = 0;

    for (;;) {
      const candidates = neighborsOf(current).filter((j) => !owner[j]);
      if (!candidates.length) break;

      // Идём туда, куда уже двигались: выбираем соседа, лучше всего совпадающего с направлением.
      let best = candidates[0];
      let bestScore = -9;
      for (const candidate of candidates) {
        const dx = xOf(candidate) - xOf(current);
        const dy = yOf(candidate) - yOf(current);
        const length = Math.hypot(dx, dy);
        const score = path.length > 1 ? (dx * directionX + dy * directionY) / length : (dx ? 1 : 0.5) / length;
        if (score > bestScore) { bestScore = score; best = candidate; }
      }
      // Соседи, прилегающие к выбранному, — «угловые» дубли толстой линии; пропускаем их.
      for (const candidate of candidates) {
        if (candidate !== best && areAdjacent(candidate, best)) owner[candidate] = strokeId;
      }

      const dx = xOf(best) - xOf(current);
      const dy = yOf(best) - yOf(current);
      const length = Math.hypot(dx, dy);
      directionX = directionX * 0.55 + (dx / length) * 0.45;
      directionY = directionY * 0.55 + (dy / length) * 0.45;

      owner[best] = strokeId;
      path.push(best);
      current = best;
    }

    const touched = [path[0], path[path.length - 1]]
      .some((end) => neighborsOf(end).some((j) => owner[j] && owner[j] !== strokeId));
    strokes.push({ points: path.map((i): Point => [xOf(i), yOf(i)]), touched });
  }

  for (const start of endpoints) if (!owner[start]) walk(start);
  for (const start of leftToRight) if (!owner[start]) walk(start);
  return strokes;
}

export function strokeLength(points: Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return length;
}

/** Упрощение ломаной (Рамера — Дугласа — Пекера): выбрасывает точки, не отклоняющиеся больше epsilon. */
export function simplify(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points;

  const first = points[0];
  const last = points[points.length - 1];
  const dx = last[0] - first[0];
  const dy = last[1] - first[1];
  const chord = Math.hypot(dx, dy);

  let farthest = 0;
  let farthestIndex = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const distance = chord < 1e-6
      ? Math.hypot(x - first[0], y - first[1])
      : Math.abs(dy * (x - first[0]) - dx * (y - first[1])) / chord;
    if (distance > farthest) { farthest = distance; farthestIndex = i; }
  }

  if (farthest <= epsilon) return [first, last];
  const left = simplify(points.slice(0, farthestIndex + 1), epsilon);
  const right = simplify(points.slice(farthestIndex), epsilon);
  return left.slice(0, -1).concat(right);
}

const fmt = (n: number) => n.toFixed(1);

/** Плавная кривая через точки: сплайн Катмулла — Рома, переведённый в кубические кривые Безье. */
export function toSmoothPath(points: Point[]): string {
  const [first, second] = points;
  if (points.length === 2) return `M${fmt(first[0])} ${fmt(first[1])}L${fmt(second[0])} ${fmt(second[1])}`;

  let path = `M${fmt(first[0])} ${fmt(first[1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    path += `C${fmt(p1[0] + (p2[0] - p0[0]) / 6)} ${fmt(p1[1] + (p2[1] - p0[1]) / 6)} ` +
      `${fmt(p2[0] - (p3[0] - p1[0]) / 6)} ${fmt(p2[1] - (p3[1] - p1[1]) / 6)} ${fmt(p2[0])} ${fmt(p2[1])}`;
  }
  return path;
}
