/**
 * Один общий requestAnimationFrame на всё приложение:
 * шёлк, сердце из лепестков и прочие анимации подписываются на кадры здесь.
 */
type FrameCallback = (now: number) => void;

const callbacks: FrameCallback[] = [];
let running = false;

function tick(now: number): void {
  requestAnimationFrame(tick);
  for (const callback of callbacks) callback(now);
}

export function onFrame(callback: FrameCallback): void {
  callbacks.push(callback);
  if (running) return;
  running = true;
  requestAnimationFrame(tick);
}
