// Бордовый атласный шёлк: складки считаются из высоты поверхности,
// освещение — по нормали. Свет слегка следует за курсором.
precision highp float;

uniform vec2 uRes;
uniform vec2 uMouse;     // положение курсора, [-.5, .5]
uniform float uTime;
uniform float uScroll;   // сдвиг ткани при прокрутке страницы
uniform float uDark;     // 0..1 — затемнение к финальному экрану

// Высота ткани в точке: несколько наложенных волн с лёгким искажением.
float height(vec2 p) {
  float t = uTime * .055;
  vec2 q = p + .38 * vec2(sin(p.y * 1.6 + t * 2.0), cos(p.x * 1.2 - t * 1.6));
  float h = sin(q.x * 2.0 + q.y * 1.25 + t * 3.0) * .55;
  q += .26 * vec2(sin(q.y * 2.8 - t * 2.0), cos(q.x * 2.2 + t));
  h += sin(q.x * 3.6 - q.y * 2.1 - t * 2.0) * .28;
  h += sin(q.x * 6.3 + q.y * 5.1 + t * 4.0) * .07;
  return h;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (uv - .5) * vec2(uRes.x / uRes.y, 1.) * 2.7;
  p.y -= uScroll * 1.1;

  // Нормаль из разности высот соседних точек.
  float e = .01;
  float h  = height(p);
  float hx = height(p + vec2(e, 0.));
  float hy = height(p + vec2(0., e));
  vec3 n = normalize(vec3(-(hx - h) / e * .55, -(hy - h) / e * .55, 1.));

  vec3 L = normalize(vec3(-.45 + uMouse.x * .5, .55 + uMouse.y * .35, .75));
  vec3 H = normalize(L + vec3(0., 0., 1.));
  float diff = dot(n, L) * .5 + .5;
  float spec = pow(max(dot(n, H), 0.), 70.);
  float rim  = pow(1. - n.z, 1.6);

  // Палитра: тёмный бордо → бордо → тёплый розовый блик.
  vec3 deep  = vec3(.16, .02, .06);
  vec3 mid   = vec3(.46, .08, .17);
  vec3 light = vec3(.86, .46, .44);
  vec3 col = mix(deep, mid, smoothstep(.15, .62, diff));
  col = mix(col, light, smoothstep(.7, 1.0, diff));
  col += spec * .3 * vec3(1., .92, .62);
  col = mix(col, col * .9, smoothstep(.85, 1., diff) * .5);
  col += rim * .04 * vec3(1., .85, .5);

  col = mix(col, col * vec3(.55, .42, .45), uDark);

  // Виньетка и зерно, чтобы градиент не «полосил».
  float vignette = smoothstep(1.25, .25, length(uv - .5));
  col *= .86 + .14 * vignette;
  col += (hash(gl_FragCoord.xy + uTime) - .5) * .018;

  gl_FragColor = vec4(col, 1.);
}
