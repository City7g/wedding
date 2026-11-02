/** Фон: живой бордовый шёлк на WebGL. */
import fragmentSource from '../shaders/silk.frag?raw';
import { $ } from '../lib/dom';
import { onFrame } from '../lib/frameLoop';
import { prefersReducedMotion } from '../lib/utils';
import { createFullscreenPass, drawFullscreen } from '../lib/webgl';

/** Шёлк плавный, поэтому считаем его в пониженном разрешении. */
const RESOLUTION_SCALE = 0.55;
/** Насколько шёлк темнеет к финальному экрану. */
const MAX_DARKNESS = 0.38;

export function startSilk(): void {
  const canvas = $<HTMLCanvasElement>('#silk');
  const finale = $('#finale');
  const pass = createFullscreenPass(canvas, fragmentSource, {
    antialias: false,
    alpha: false,
    powerPreference: 'low-power',
  });
  if (!pass) return;

  const { gl, uniform } = pass;
  const uRes = uniform('uRes');
  const uTime = uniform('uTime');
  const uScroll = uniform('uScroll');
  const uDark = uniform('uDark');
  const uMouse = uniform('uMouse');

  function resize(): void {
    const scale = Math.min(devicePixelRatio || 1, 1.5) * RESOLUTION_SCALE;
    canvas.width = Math.max(2, Math.round(innerWidth * scale));
    canvas.height = Math.max(2, Math.round(innerHeight * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  addEventListener('resize', resize);

  // Курсор: цель и плавно догоняющее её значение, оба в диапазоне [-.5, .5].
  const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
  addEventListener('pointermove', (event) => {
    mouse.targetX = event.clientX / innerWidth - 0.5;
    mouse.targetY = 0.5 - event.clientY / innerHeight;
  }, { passive: true });

  let scroll = 0;
  let darkness = 0;
  const startedAt = performance.now();

  onFrame((now) => {
    mouse.x += (mouse.targetX - mouse.x) * 0.04;
    mouse.y += (mouse.targetY - mouse.y) * 0.04;
    scroll += (scrollY / innerHeight - scroll) * 0.08;

    // Чем ближе финальный экран, тем темнее ткань.
    const finaleProgress = 1 - finale.getBoundingClientRect().top / innerHeight;
    const targetDarkness = Math.min(1, Math.max(0, finaleProgress)) * MAX_DARKNESS;
    darkness += (targetDarkness - darkness) * 0.05;

    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, prefersReducedMotion ? 20 : (now - startedAt) / 1000);
    gl.uniform1f(uScroll, scroll * 0.35);
    gl.uniform1f(uDark, darkness);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    drawFullscreen(gl);
  });
}
