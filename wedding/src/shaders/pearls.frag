// Жемчужины — сферы. Пересечение луча со сферой считается аналитически,
// физика (положение каждой жемчужины) приходит из JS через uS[].
// Макрос N (число жемчужин) подставляется в начало файла из pearlHeart.ts.
precision highp float;

uniform vec2 uRes;
uniform vec4 uS[N];      // xyz — центр, w — радиус
uniform float uTime;

// Окружение, которое отражается в жемчуге: бордо снизу, масляный свет сверху.
vec3 environment(vec3 d) {
  vec3 c = mix(vec3(.32, .05, .11), vec3(1., .93, .68), smoothstep(-.6, .9, d.y));
  c += vec3(1., .94, .74) * smoothstep(.55, .96, dot(d, normalize(vec3(-.45, .75, -.5)))) * .9;
  c += vec3(.85, .35, .4) * smoothstep(.6, .98, dot(d, normalize(vec3(.85, .1, -.5)))) * .4;
  return c;
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2. - uRes) / uRes.y;
  vec3 ro = vec3(0., 0., -3.);
  vec3 rd = normalize(vec3(uv, 1.6));
  float pixelWorld = 3.75 / uRes.y;   // размер пикселя в мировых единицах — для сглаживания края

  float nearest = 1e9;
  float edge = 0., hitRadius = 1.;
  vec3 hitCenter = vec3(0.);
  float shadow = 0.;

  for (int i = 0; i < N; i++) {
    vec3 c = uS[i].xyz;
    float r = uS[i].w;
    vec3 oc = c - ro;
    float b = dot(oc, rd);
    if (b < 0.) continue;

    float h = r * r - (dot(oc, oc) - b * b);
    if (h > 0. && b - sqrt(h) < nearest) {
      nearest = b - sqrt(h);
      edge = h / (r * r);
      hitCenter = c;
      hitRadius = r;
    }

    // Мягкая тень на шёлк (смещена вниз-вправо).
    vec3 o2 = oc + vec3(.045, -.075, 0.);
    float b2 = dot(o2, rd);
    float d2 = sqrt(max(dot(o2, o2) - b2 * b2, 0.));
    shadow = max(shadow, smoothstep(r * 2.1, r * .2, d2) * .3);
  }

  float alpha = 0.;
  vec3 col = vec3(0.);
  if (nearest < 1e8) {
    vec3 p = ro + rd * nearest;
    vec3 n = normalize(p - hitCenter);
    vec3 v = -rd;
    float ndv = max(dot(n, v), 0.);
    float fresnel = pow(1. - ndv, 3.);
    vec3 L = normalize(vec3(-.45, .75, -.5));
    float diff = max(dot(n, L), 0.) * .55 + .45;

    vec3 base = vec3(.99, .95, .80);
    col = base * (.5 + .55 * diff);
    col = mix(col, col * vec3(.78, .55, .45), 1. - diff);

    // Жемчужный перелив.
    vec3 iridescence = .5 + .5 * cos(6.2832 * (vec3(0., .33, .67) + ndv * .9 + n.y * .2 + uTime * .02));
    col = mix(col, col * (.82 + .32 * iridescence), .55);

    col = mix(col, environment(reflect(rd, n)), .22 + fresnel * .55);
    col += pow(max(dot(reflect(-L, n), v), 0.), 90.) * .9;
    col = min(col, vec3(1.));
    alpha = smoothstep(0., 2. * pixelWorld / hitRadius, edge);
  }

  vec3 shadowColor = vec3(.10, .005, .03);
  gl_FragColor = vec4(col * alpha + shadowColor * shadow * (1. - alpha), alpha + (1. - alpha) * shadow);
}
