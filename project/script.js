(() => {
  'use strict';
  const C = window.WEDDING;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pad = n => String(n).padStart(2, '0');

  /* ------------------------------------------------------------------ */
  /* Контент из config.js                                                */
  /* ------------------------------------------------------------------ */
  const date = new Date(C.date);
  const fmt = (o) => new Intl.DateTimeFormat('ru-RU', o).format(date);
  const bind = {
    groom: C.groom,
    bride: C.bride,
    monogram: C.groom[0] + '&' + C.bride[0],
    dateLong: fmt({ weekday: 'long', day: 'numeric', month: 'long' }),
    dd: pad(date.getDate()),
    mm: pad(date.getMonth() + 1),
    yy: String(date.getFullYear()).slice(-2),
    timeAt: 'в ' + pad(date.getHours()) + ':' + pad(date.getMinutes()),
    dressText: C.dresscode.text,
    orgName: C.organizer.name,
    deadline: C.rsvp.deadline,
  };
  $$('[data-bind]').forEach(el => { el.textContent = bind[el.dataset.bind] ?? ''; });
  document.title = `${C.groom} & ${C.bride} — приглашение на свадьбу`;

  $('#timeline').innerHTML = C.timeline.map(t =>
    `<li class="rv"><time>${t.time}</time><strong>${t.title}</strong><p>${t.text}</p></li>`).join('');

  $('#swatches').innerHTML = C.dresscode.colors.map(([d, m, l]) =>
    `<span class="swatch" style="background:
      radial-gradient(circle at 30% 25%, ${l} 0, transparent 38%),
      linear-gradient(115deg, ${d} 0%, ${m} 22%, ${l} 38%, ${m} 52%, ${d} 66%, ${m} 82%, ${l} 100%)"></span>`).join('');

  const org = $('#orgLink');
  const tg = C.organizer.telegram, phone = C.organizer.phone;
  org.href = tg ? `https://t.me/${tg}` : 'tel:' + phone.replace(/[^+\d]/g, '');
  org.textContent = tg ? 'Написать в Telegram' : phone;
  if (tg) org.target = '_blank';

  /* ------------------------------------------------------------------ */
  /* Жемчужные нити                                                      */
  /* ------------------------------------------------------------------ */
  const NS = 'http://www.w3.org/2000/svg';
  function drawPearls(svg, pts, size, gap) {
    // pts: функция t -> {x, y}; нить раскладывается по равной длине дуги
    const samples = [];
    let len = 0, prev = pts(0);
    for (let i = 0; i <= 400; i++) {
      const p = pts(i / 400);
      len += Math.hypot(p.x - prev.x, p.y - prev.y);
      samples.push({ ...p, len });
      prev = p;
    }
    svg.textContent = '';
    for (let d = 0, k = 0; d <= len; d += size * gap) {
      while (k < samples.length - 1 && samples[k].len < d) k++;
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', samples[k].x.toFixed(1));
      c.setAttribute('cy', samples[k].y.toFixed(1));
      c.setAttribute('r', (size / 2).toFixed(1));
      c.setAttribute('fill', 'url(#pearl)');
      svg.appendChild(c);
    }
  }
  function renderStrands() {
    $$('[data-strand]').forEach(el => {
      let svg = $('svg', el);
      if (!svg) { svg = document.createElementNS(NS, 'svg'); el.appendChild(svg); }
      const w = el.clientWidth, h = el.clientHeight;
      if (el.dataset.strand === 'flap') {
        const size = Math.max(13, Math.min(w, 600) / 26);
        const draw = (x0) => (t) => ({ x: x0 + (w / 2 - x0) * t, y: h * t });
        const g1 = document.createElementNS(NS, 'g'), g2 = document.createElementNS(NS, 'g');
        svg.textContent = '';
        svg.append(g1, g2);
        drawPearls(g1, draw(-size), size, 0.95);
        drawPearls(g2, (t) => ({ x: w - draw(-size)(t).x, y: h * t }), size, 0.95);
        return;
      }
      const y0 = +el.dataset.y0 * h, y1 = +el.dataset.y1 * h, sag = +el.dataset.sag * h;
      drawPearls(svg, (t) => {
        const x = -10 + (w + 20) * t;
        // квадратичная кривая провисания + мягкая волна
        const y = y0 + (y1 - y0) * t + Math.sin(Math.PI * t) * sag - Math.sin(t * Math.PI * 2) * 6;
        return { x, y };
      }, 11, 0.9);
    });
  }

  /* разбросанные жемчужины с параллаксом */
  const floaters = [];
  function scatter() {
    $$('.scatter').forEach(host => {
      host.textContent = '';
      const n = +host.dataset.n || 6;
      for (let i = 0; i < n; i++) {
        const u = document.createElement('u');
        const s = 8 + Math.random() * Math.random() * 30;
        u.style.cssText = `left:${Math.random() * 94}%;top:${4 + Math.random() * 90}%;width:${s}px;height:${s}px`;
        const p = document.createElement('i');
        p.style.cssText = `width:100%;height:100%;animation-delay:${-Math.random() * 7}s;animation-duration:${6 + Math.random() * 5}s`;
        u.appendChild(p);
        host.appendChild(u);
        floaters.push({ el: u, speed: 0.03 + (s / 38) * 0.14 + Math.random() * 0.03 });
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* WebGL: шёлк                                                         */
  /* ------------------------------------------------------------------ */
  const silk = (() => {
    const canvas = $('#silk');
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return null;

    const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const fs = `
      precision highp float;
      uniform vec2 uRes; uniform float uTime, uScroll, uDark; uniform vec2 uMouse;

      float height(vec2 p){
        float t = uTime * .055;
        vec2 q = p + .38 * vec2(sin(p.y * 1.6 + t * 2.0), cos(p.x * 1.2 - t * 1.6));
        float h = sin(q.x * 2.0 + q.y * 1.25 + t * 3.0) * .55;
        q += .26 * vec2(sin(q.y * 2.8 - t * 2.0), cos(q.x * 2.2 + t));
        h += sin(q.x * 3.6 - q.y * 2.1 - t * 2.0) * .28;
        h += sin(q.x * 6.3 + q.y * 5.1 + t * 4.0) * .07;
        return h;
      }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

      void main(){
        vec2 uv = gl_FragCoord.xy / uRes;
        vec2 p = (uv - .5) * vec2(uRes.x / uRes.y, 1.) * 2.7;
        p.y -= uScroll * 1.1;
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

        vec3 deep  = vec3(.16, .02, .06);
        vec3 mid   = vec3(.46, .08, .17);
        vec3 light = vec3(.86, .46, .44);
        vec3 col = mix(deep, mid, smoothstep(.15, .62, diff));
        col = mix(col, light, smoothstep(.7, 1.0, diff));
        col += spec * .3 * vec3(1., .92, .62);
        col = mix(col, col * .9, smoothstep(.85, 1., diff) * .5);
        col += rim * .04 * vec3(1., .85, .5);

        col = mix(col, col * vec3(.55, .42, .45), uDark);
        float v = smoothstep(1.25, .25, length(uv - .5));
        col *= .86 + .14 * v;
        col += (hash(gl_FragCoord.xy + uTime) - .5) * .018;
        gl_FragColor = vec4(col, 1.);
      }`;

    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(prog)); return null; }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = n => gl.getUniformLocation(prog, n);
    const u = { res: U('uRes'), time: U('uTime'), scroll: U('uScroll'), dark: U('uDark'), mouse: U('uMouse') };

    // шёлк плавный — считаем в пониженном разрешении
    const resize = () => {
      const k = Math.min(devicePixelRatio || 1, 1.5) * 0.55;
      canvas.width = Math.max(2, Math.round(innerWidth * k));
      canvas.height = Math.max(2, Math.round(innerHeight * k));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    addEventListener('resize', resize);

    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    addEventListener('pointermove', e => {
      mouse.tx = e.clientX / innerWidth - .5;
      mouse.ty = .5 - e.clientY / innerHeight;
    }, { passive: true });

    let dark = 0, scroll = 0;
    const t0 = performance.now();
    const frame = (now) => {
      mouse.x += (mouse.tx - mouse.x) * .04;
      mouse.y += (mouse.ty - mouse.y) * .04;
      scroll += (scrollY / innerHeight - scroll) * .08;
      const fin = $('#finale').getBoundingClientRect();
      const targetDark = Math.min(1, Math.max(0, 1 - fin.top / innerHeight)) * .38;
      dark += (targetDark - dark) * .05;
      gl.uniform2f(u.res, canvas.width, canvas.height);
      gl.uniform1f(u.time, reduce ? 20 : (now - t0) / 1000);
      gl.uniform1f(u.scroll, scroll * .35);
      gl.uniform1f(u.dark, dark);
      gl.uniform2f(u.mouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    return gl;
  })();

  /* ------------------------------------------------------------------ */
  /* Параллакс и появление                                               */
  /* ------------------------------------------------------------------ */
  /* ------------------------------------------------------------------ */
  /* WebGL: жемчужное сердце на первом экране                            */
  /* Жемчужины — сферы, считаются в шейдере аналитически; физика на CPU: */
  /* нить течёт по контуру сердца, отталкивается от курсора/пальца,      */
  /* бьётся, а по клику рассыпается и собирается снова.                  */
  /* ------------------------------------------------------------------ */
  (() => {
    const canvas = $('#pearl3d'), hero = $('#hero');
    const gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true });
    if (!gl) return;

    const OUTER = 60, INNER = 26, N = OUTER + INNER;
    const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const fs = `
      precision highp float;
      #define N ${N}
      uniform vec2 uRes; uniform vec4 uS[N]; uniform float uTime;

      vec3 env(vec3 d){
        vec3 c = mix(vec3(.32,.05,.11), vec3(1.,.93,.68), smoothstep(-.6, .9, d.y));
        c += vec3(1., .94, .74) * smoothstep(.55, .96, dot(d, normalize(vec3(-.45, .75, -.5)))) * .9;
        c += vec3(.85, .35, .4) * smoothstep(.6, .98, dot(d, normalize(vec3(.85, .1, -.5)))) * .4;
        return c;
      }

      void main(){
        vec2 uv = (gl_FragCoord.xy * 2. - uRes) / uRes.y;
        vec3 ro = vec3(0., 0., -3.);
        vec3 rd = normalize(vec3(uv, 1.6));
        float pxW = 3.75 / uRes.y;

        float tmin = 1e9, hn = 0., hr = 1.;
        vec3 hc = vec3(0.);
        float sh = 0.;

        for (int i = 0; i < N; i++) {
          vec3 c = uS[i].xyz; float r = uS[i].w;
          vec3 oc = c - ro;
          float b = dot(oc, rd);
          if (b < 0.) continue;
          float h = r * r - (dot(oc, oc) - b * b);
          if (h > 0. && b - sqrt(h) < tmin) { tmin = b - sqrt(h); hn = h / (r * r); hc = c; hr = r; }

          // мягкая тень на шёлк (смещена вниз-вправо)
          vec3 o2 = oc + vec3(.045, -.075, 0.);
          float b2 = dot(o2, rd);
          float d2 = sqrt(max(dot(o2, o2) - b2 * b2, 0.));
          sh = max(sh, smoothstep(r * 2.1, r * .2, d2) * .3);
        }

        float a = 0.; vec3 col = vec3(0.);
        if (tmin < 1e8) {
          vec3 p = ro + rd * tmin;
          vec3 n = normalize(p - hc);
          vec3 v = -rd;
          float ndv = max(dot(n, v), 0.);
          float fres = pow(1. - ndv, 3.);
          vec3 L = normalize(vec3(-.45, .75, -.5));
          float diff = max(dot(n, L), 0.) * .55 + .45;

          vec3 base = vec3(.99, .95, .80);
          col = base * (.5 + .55 * diff);
          col = mix(col, col * vec3(.78, .55, .45), 1. - diff);
          // жемчужный перелив
          vec3 irid = .5 + .5 * cos(6.2832 * (vec3(0., .33, .67) + ndv * .9 + n.y * .2 + uTime * .02));
          col = mix(col, col * (.82 + .32 * irid), .55);
          col = mix(col, env(reflect(rd, n)), .22 + fres * .55);
          col += pow(max(dot(reflect(-L, n), v), 0.), 90.) * .9;
          col = min(col, vec3(1.));
          a = smoothstep(0., 2. * pxW / hr, hn);
        }
        vec3 shadowCol = vec3(.10, .005, .03);
        gl_FragColor = vec4(col * a + shadowCol * sh * (1. - a), a + (1. - a) * sh);
      }`;

    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(prog)); return; }
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, 'uRes'), uS = gl.getUniformLocation(prog, 'uS'), uTime = gl.getUniformLocation(prog, 'uTime');

    // Контур сердца, размеченный по длине дуги: s ∈ [0,1) -> точка
    const heart = [];
    {
      let prev, len = 0;
      for (let i = 0; i <= 600; i++) {
        const t = (i / 600) * Math.PI * 2;
        const x = 16 * Math.sin(t) ** 3 / 16;
        const y = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16 + .02;
        if (prev) len += Math.hypot(x - prev[0], y - prev[1]);
        heart.push([x, y, len]);
        prev = [x, y];
      }
      heart.forEach(h => h[2] /= len);
    }
    const onHeart = (s) => {
      s = ((s % 1) + 1) % 1;
      let lo = 0, hi = heart.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; heart[m][2] < s ? lo = m : hi = m; }
      const k = (s - heart[lo][2]) / (heart[hi][2] - heart[lo][2] || 1);
      return [heart[lo][0] + (heart[hi][0] - heart[lo][0]) * k, heart[lo][1] + (heart[hi][1] - heart[lo][1]) * k];
    };

    // состояние жемчужин
    const P = new Float32Array(N * 3), V = new Float32Array(N * 3), T = new Float32Array(N * 3);
    const radius = Array.from({ length: N }, (_, i) => i < OUTER ? .05 : .037);
    for (let i = 0; i < N; i++) {
      P[i * 3] = (Math.random() - .5) * 5; P[i * 3 + 1] = 2.2 + Math.random() * 2.5; P[i * 3 + 2] = (Math.random() - .5) * 2;
    }

    const world = { w: 1, h: 1, aspect: .5 };
    const ptr = { x: 0, y: 0, nx: 0, ny: 0, on: false };   // x,y — в мировых координатах, nx,ny — в [-.5,.5]
    const resize = () => {
      const r = hero.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.max(2, Math.round(r.width * dpr));
      canvas.height = Math.max(2, Math.round(r.height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      world.aspect = r.width / r.height;
    };
    resize();
    addEventListener('resize', resize);

    const setPtr = (e) => {
      const r = hero.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      ptr.x = ((px / r.height) * 2 - world.aspect) * 1.875;
      ptr.y = (1 - (py / r.height) * 2) * 1.875;
      ptr.nx = px / r.width - .5; ptr.ny = .5 - py / r.height;
      ptr.on = py > -40 && py < r.height + 40;
    };
    addEventListener('pointermove', setPtr, { passive: true });
    addEventListener('pointerdown', (e) => {
      setPtr(e);
      const r = hero.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom || e.target.closest('a, button')) return;
      for (let i = 0; i < N; i++) {           // рассыпаем жемчуг
        V[i * 3] += (Math.random() - .5) * 7; V[i * 3 + 1] += (Math.random() - .3) * 7; V[i * 3 + 2] += (Math.random() - .5) * 5;
      }
    }, { passive: true });
    document.addEventListener('pointerleave', () => { ptr.on = false; });

    let visible = true;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);

    const t0 = performance.now();
    let last = t0, openAt = null, yaw = 0, pitch = 0;
    const frame = (now) => {
      requestAnimationFrame(frame);
      if (!visible || document.hidden) { last = now; return; }
      const dt = Math.min(.033, (now - last) / 1000); last = now;
      const t = reduce ? 3 : (now - t0) / 1000;

      if (openAt === null && document.body.classList.contains('open')) openAt = now;
      const gather = openAt === null ? 0 : Math.min(1, (now - openAt) / 2200);
      const k = 16 * gather * gather;

      // размер сердца под экран и «удар сердца»
      const base = Math.min(world.aspect * 1.7, 1.42);
      const beat = 1 + .05 * Math.pow(Math.max(0, Math.sin(t * 2.6)), 10) * (reduce ? 0 : 1);
      const scale = base * beat;
      const ty = world.aspect < .8 ? .12 : .02;       // чуть выше центра, под имена

      const targetYaw = reduce ? 0 : .6 * Math.sin(t * .42) + (ptr.on ? ptr.nx * .55 : 0);
      const targetPitch = ptr.on ? -ptr.ny * .3 : .05 * Math.sin(t * .3);
      yaw += (targetYaw - yaw) * Math.min(1, dt * 3);
      pitch += (targetPitch - pitch) * Math.min(1, dt * 3);
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);

      const data = new Float32Array(N * 4);
      for (let i = 0; i < N; i++) {
        // целевая точка на контуре (внешняя нить течёт по часовой, внутренняя — навстречу)
        const outer = i < OUTER;
        const idx = outer ? i : i - OUTER;
        const cnt = outer ? OUTER : INNER;
        const s = outer ? idx / cnt + t * .018 : idx / cnt - t * .026;
        const [hx, hy] = onHeart(s);
        const sc = outer ? scale : scale * .6;
        let x = hx * sc, y = hy * sc + ty;
        let z = (outer ? .09 : .16) * Math.sin(s * Math.PI * 2 * (outer ? 5 : 3) + t * 1.4);
        // поворот: yaw вокруг Y, затем pitch вокруг X
        const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
        const y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
        T[i * 3] = x1; T[i * 3 + 1] = y1; T[i * 3 + 2] = z2;

        let px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2];
        let vx = V[i * 3], vy = V[i * 3 + 1], vz = V[i * 3 + 2];
        let ax = (x1 - px) * k - vx * (3 + 4 * gather), ay = (y1 - py) * k - vy * (3 + 4 * gather), az = (z2 - pz) * k - vz * (3 + 4 * gather);
        if (ptr.on) {                                  // курсор отталкивает жемчуг
          const dx = px - ptr.x, dy = py - ptr.y, d = Math.hypot(dx, dy) + 1e-4;
          if (d < .55) { const f = (.55 - d) * (.55 - d) * 90 / d; ax += dx * f; ay += dy * f; az -= f * .05; }
        }
        vx += ax * dt; vy += ay * dt; vz += az * dt;
        px += vx * dt; py += vy * dt; pz += vz * dt;
        P[i * 3] = px; P[i * 3 + 1] = py; P[i * 3 + 2] = pz;
        V[i * 3] = vx; V[i * 3 + 1] = vy; V[i * 3 + 2] = vz;
        data[i * 4] = px; data[i * 4 + 1] = py; data[i * 4 + 2] = pz; data[i * 4 + 3] = radius[i] * (.9 + .1 * Math.min(1, gather * 3));
      }

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, t);
      gl.uniform4fv(uS, data);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    requestAnimationFrame(frame);
  })();

  let ticking = false;
  function parallax() {
    ticking = false;
    const vh = innerHeight;
    for (const f of floaters) {
      const r = f.el.parentElement.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) continue;
      f.el.style.transform = `translate3d(0, ${((r.top + r.height / 2 - vh / 2) * -f.speed).toFixed(1)}px, 0)`;
    }
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(parallax); } }, { passive: true });

  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -10% 0px', threshold: .08 });
  $$('.rv').forEach(el => io.observe(el));

  /* ------------------------------------------------------------------ */
  /* Обратный отсчёт                                                     */
  /* ------------------------------------------------------------------ */
  function tick() {
    let s = Math.max(0, Math.floor((date - Date.now()) / 1000));
    const d = Math.floor(s / 86400); s %= 86400;
    const h = Math.floor(s / 3600); s %= 3600;
    const m = Math.floor(s / 60); s %= 60;
    $('#cd-d').textContent = d; $('#cd-h').textContent = pad(h);
    $('#cd-m').textContent = pad(m); $('#cd-s').textContent = pad(s);
    if (date <= Date.now()) $('.until').textContent = 'Этот день настал!';
  }
  tick(); setInterval(tick, 1000);

  /* ------------------------------------------------------------------ */
  /* Музыка (мягкий пэд + «жемчужные» колокольчики, без файлов)          */
  /* ------------------------------------------------------------------ */
  const sound = $('#sound');
  let actx, master, bellTimer, playing = false;
  function buildAudio() {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain(); master.gain.value = 0;
    const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    const delay = actx.createDelay(1.5); delay.delayTime.value = .55;
    const fb = actx.createGain(); fb.gain.value = .42;
    const wet = actx.createGain(); wet.gain.value = .5;
    master.connect(lp); lp.connect(actx.destination);
    lp.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(actx.destination);

    // Dmaj9: D3 A3 D4 F#4 A4 E5
    [146.83, 220, 293.66, 369.99, 440, 659.25].forEach((f, i) => {
      [-4, 4].forEach(det => {
        const o = actx.createOscillator(); o.type = i % 2 ? 'sine' : 'triangle';
        o.frequency.value = f; o.detune.value = det;
        const g = actx.createGain(); g.gain.value = .05;
        const lfo = actx.createOscillator(); lfo.frequency.value = .05 + Math.random() * .1;
        const lg = actx.createGain(); lg.gain.value = .035;
        lfo.connect(lg); lg.connect(g.gain);
        o.connect(g); g.connect(master);
        o.start(); lfo.start();
      });
    });
  }
  function bell() {
    const notes = [587.33, 659.25, 739.99, 880, 987.77, 1108.73, 1318.51]; // D-пентатоника
    const f = notes[Math.floor(Math.random() * notes.length)];
    const o = actx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const g = actx.createGain(), t = actx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(.12, t + .02);
    g.gain.exponentialRampToValueAtTime(.0005, t + 3.2);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 3.4);
  }
  function setSound(on) {
    if (on && !actx) buildAudio();
    if (!actx) return;
    playing = on;
    if (on) actx.resume();
    master.gain.cancelScheduledValues(actx.currentTime);
    master.gain.linearRampToValueAtTime(on ? .5 : 0, actx.currentTime + 1.5);
    clearInterval(bellTimer);
    if (on) bellTimer = setInterval(() => Math.random() < .75 && bell(), 2600);
    sound.setAttribute('aria-pressed', on);
    sound.setAttribute('aria-label', on ? 'Выключить музыку' : 'Включить музыку');
  }
  sound.addEventListener('click', () => setSound(!playing));
  document.addEventListener('visibilitychange', () => {
    if (!actx) return;
    document.hidden ? actx.suspend() : playing && actx.resume();
  });

  /* ------------------------------------------------------------------ */
  /* Интро-конверт                                                       */
  /* ------------------------------------------------------------------ */
  const intro = $('#intro');
  let opened = false;
  function openEnvelope() {
    if (opened) return;
    opened = true;
    intro.classList.add('opening');
    setTimeout(() => {
      document.body.classList.remove('locked');
      document.body.classList.add('open');
      intro.classList.add('done');
      scrollTo(0, 0);
    }, 1900);
    setTimeout(() => intro.remove(), 3300);
  }
  $('#seal').addEventListener('click', openEnvelope);
  intro.addEventListener('click', openEnvelope);

  // если пришли по якорю / перезагрузили страницу — сразу показываем сайт
  if (location.hash && location.hash !== '#') {
    document.body.classList.remove('locked');
    document.body.classList.add('open');
    intro.remove();
  }

  /* ------------------------------------------------------------------ */
  /* Анкета гостя                                                        */
  /* ------------------------------------------------------------------ */
  const form = $('#form'), err = $('#formError');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    const data = Object.fromEntries(new FormData(form));
    if (!data.name || data.name.trim().length < 2) { err.textContent = 'Пожалуйста, укажите имя и фамилию'; form.name.focus(); return; }
    if (!data.presence) { err.textContent = 'Пожалуйста, выберите вариант ответа'; return; }

    const payload = { ...data, name: data.name.trim(), sentAt: new Date().toISOString() };
    try { localStorage.setItem('wedding-rsvp', JSON.stringify(payload)); } catch (_) {}

    const text = `Свадьба ${C.groom} & ${C.bride}\n${payload.name}: ${payload.presence}` + (payload.note ? `\nПожелания: ${payload.note}` : '');
    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    try {
      if (C.rsvp.endpoint) {
        const r = await fetch(C.rsvp.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
        if (!r.ok) throw new Error('http ' + r.status);
      }
      if (C.rsvp.telegram) window.open(`https://t.me/${C.rsvp.telegram}?text=${encodeURIComponent(text)}`, '_blank');
      else if (C.rsvp.email) location.href = `mailto:${C.rsvp.email}?subject=${encodeURIComponent('Ответ на приглашение')}&body=${encodeURIComponent(text)}`;
      form.hidden = true;
      $('#thanks').hidden = false;
      $('#thanks').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (ex) {
      btn.disabled = false;
      err.textContent = 'Не удалось отправить. Попробуйте ещё раз или напишите нам напрямую.';
    }
  });

  /* ------------------------------------------------------------------ */
  scatter();
  renderStrands();
  parallax();
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(renderStrands, 120); });
  document.fonts?.ready.then(renderStrands);
})();
