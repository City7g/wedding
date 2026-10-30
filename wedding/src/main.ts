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
    dateBar: `${pad(date.getDate())} | ${pad(date.getMonth() + 1)} | ${date.getFullYear()}`,
    dateLong: fmt({ day: 'numeric', month: 'long', year: 'numeric' }).replace(/\s*г\.$/, ''),
    timeAt: 'в ' + pad(date.getHours()) + ':' + pad(date.getMinutes()),
    untilLine: 'до ' + fmt({ day: 'numeric', month: 'long' }),
    dressSub: C.dresscode.subtitle || '',
    dressText: C.dresscode.text,
    winterNote: C.winterNote || '',
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

  const photo = $('#photo'), photoImg = $('#photoImg');
  if (C.photo) {
    photoImg.onload = () => photo.classList.add('loaded');
    photoImg.onerror = () => photo.classList.add('empty');
    photoImg.src = C.photo;
  } else photo.classList.add('empty');

  /* ------------------------------------------------------------------ */
  /* WebGL: мягкие тени сухоцветов, колышущиеся на ветру                 */
  /* Силуэты рисуются один раз в 2D-холсте → текстура → шейдер          */
  /* добавляет ветер, размытие «не в фокусе» и плавающий свет.           */
  /* ------------------------------------------------------------------ */
  const rng = (seed) => {
    let a = (seed * 2654435761) >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  function plantTexture() {
    const W = 512, H = 768, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d'), r = rng(7);
    x.fillStyle = '#000'; x.strokeStyle = '#000'; x.lineCap = 'round';
    const Q = (a, b, d, t) => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * b[0] + t * t * d[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * b[1] + t * t * d[1]];
    const stem = (a, b, d, w0, w1) => {
      let prev = a;
      for (let i = 1; i <= 36; i++) {
        const p = Q(a, b, d, i / 36);
        x.lineWidth = w0 + (w1 - w0) * (i / 36);
        x.beginPath(); x.moveTo(prev[0], prev[1]); x.lineTo(p[0], p[1]); x.stroke();
        prev = p;
      }
      return (t) => Q(a, b, d, t);
    };
    const umbel = (cx, cy, R, n) => {
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i / (n - 1) - .5) * Math.PI * 1.35 + (r() - .5) * .18, l = R * (.55 + .5 * r());
        const ex = cx + Math.cos(a) * l, ey = cy + Math.sin(a) * l;
        x.lineWidth = 1.8;
        x.beginPath(); x.moveTo(cx, cy); x.quadraticCurveTo((cx + ex) / 2 + (r() - .5) * 8, (cy + ey) / 2 - 4, ex, ey); x.stroke();
        for (let j = 0; j < 9; j++) {
          const rr = R * .17 * Math.sqrt(r()), aa = r() * 6.283;
          x.beginPath(); x.arc(ex + Math.cos(aa) * rr, ey + Math.sin(aa) * rr, 1.8 + r() * 3.6, 0, 6.283); x.fill();
        }
      }
      x.beginPath(); x.arc(cx, cy, 3.4, 0, 6.283); x.fill();
    };
    const leaf = (px, py, ang, len, wid) => {
      x.save(); x.translate(px, py); x.rotate(ang);
      x.beginPath(); x.ellipse(len / 2, 0, len / 2, wid / 2, 0, 0, 6.283); x.fill(); x.restore();
    };
    // растение слева — крупный зонтик с боковыми ветками
    const A = stem([W * .16, H * 1.04], [W * .2, H * .66], [W * .31, H * .34], 6.5, 2.6);
    umbel(W * .31, H * .32, W * .2, 30);
    let p = A(.55); stem(p, [p[0] - 34, p[1] - 40], [W * .09, H * .47], 3.6, 1.8); umbel(W * .09, H * .45, W * .11, 20);
    p = A(.74); stem(p, [p[0] + 32, p[1] - 34], [W * .47, H * .5], 3.6, 1.8); umbel(W * .47, H * .48, W * .11, 20);
    for (let k = 0; k < 7; k++) { const q = A(.08 + .55 * r()); leaf(q[0], q[1], -Math.PI / 2 + (r() < .5 ? -1 : 1) * (.55 + r() * .6), 70 + r() * 50, 11 + r() * 5); }
    // растение справа
    const B = stem([W * .88, H * 1.04], [W * .86, H * .8], [W * .73, H * .54], 5.5, 2.4);
    umbel(W * .73, H * .52, W * .16, 24);
    p = B(.6); stem(p, [p[0] + 26, p[1] - 30], [W * .93, H * .66], 3.2, 1.7); umbel(W * .93, H * .64, W * .09, 16);
    for (let k = 0; k < 5; k++) { const q = B(.1 + .5 * r()); leaf(q[0], q[1], -Math.PI / 2 + (r() < .5 ? -1 : 1) * (.5 + r() * .6), 60 + r() * 40, 10 + r() * 5); }
    // травинки
    [[.02, .62], [.07, .7], [.5, .8], [.58, .74], [.64, .86], [.97, .78]].forEach(([bx, top]) => {
      stem([W * bx, H * 1.03], [W * (bx + (r() - .5) * .1), H * (1 - (1 - top) * .6)], [W * (bx + (r() - .5) * .16), H * top], 3.6, .8);
    });
    return c;
  }

  (() => {
    const canvas = $('#shadows');
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return;
    const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const fs = `
      precision highp float;
      uniform sampler2D uTex; uniform vec2 uRes; uniform float uTime, uScroll, uTA;
      float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      void main(){
        vec2 uv = gl_FragCoord.xy / uRes; float asp = uRes.x / uRes.y;
        vec2 t = uv;
        if (asp > uTA) t.y = .5 + (uv.y - .5) * (uTA / asp); else t.x = .5 + (uv.x - .5) * (asp / uTA);

        // ветер: качается сильнее к верхушкам, порывами
        float h = clamp(t.y, 0., 1.);
        float gust = .65 + .35 * sin(uTime * .21) + .15 * sin(uTime * .53 + 1.3);
        float sway = sin(uTime * .8 + t.y * 4.) * .007 + sin(uTime * 1.5 + t.y * 9. + t.x * 3.) * .0035;
        t.x += sway * h * h * 2.2 * gust;
        t.y += sin(uTime * .55 + t.x * 5.) * .0025 * h - clamp(uScroll * .012, 0., .06);

        // размытие «не в фокусе»: 14 точек по спирали
        float a = 0.;
        for (int i = 0; i < 14; i++) {
          float ang = float(i) * 2.39996, rr = sqrt((float(i) + .5) / 14.);
          vec2 o = vec2(cos(ang), sin(ang)) * rr * vec2(.017, .017 * asp * 0.8);
          a += texture2D(uTex, t + o).a;
        }
        a /= 14.;

        // тёплая серо-бежевая основа и медленно плывущий свет
        vec3 base = mix(vec3(.955, .95, .94), vec3(1., 1., .997), smoothstep(-.1, 1.1, uv.y * .55 + uv.x * .45));
        float light = sin(uTime * .09 + uv.x * 2.1 + uv.y * 1.4) * .5 + sin(uTime * .07 - uv.x * 1.3 + uv.y * 2.6) * .5;
        base += light * .008;
        vec3 shadow = vec3(.60, .58, .56);
        vec3 col = mix(base, shadow, a * .34);
        col += (hash(gl_FragCoord.xy + uTime) - .5) * .008;
        gl_FragColor = vec4(col, 1.);
      }`;
    const sh = (ty, s) => { const o = gl.createShader(ty); gl.shaderSource(o, s); gl.compileShader(o); return o; };
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

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    const src = plantTexture();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const U = n => gl.getUniformLocation(prog, n);
    const u = { res: U('uRes'), time: U('uTime'), scroll: U('uScroll'), ta: U('uTA'), tex: U('uTex') };
    gl.uniform1i(u.tex, 0);
    gl.uniform1f(u.ta, src.width / src.height);

    const resize = () => {
      const k = Math.min(devicePixelRatio || 1, 1.5) * 0.6;
      canvas.width = Math.max(2, Math.round(innerWidth * k));
      canvas.height = Math.max(2, Math.round(innerHeight * k));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    addEventListener('resize', resize);

    const t0 = performance.now();
    let scroll = 0;
    const frame = (now) => {
      requestAnimationFrame(frame);
      if (document.hidden) return;
      scroll += (scrollY / innerHeight - scroll) * .08;
      gl.uniform2f(u.res, canvas.width, canvas.height);
      gl.uniform1f(u.time, reduce ? 6 : (now - t0) / 1000);
      gl.uniform1f(u.scroll, scroll);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    requestAnimationFrame(frame);
  })();

  /* ------------------------------------------------------------------ */
  /* Большие падающие снежинки                                           */
  /* ------------------------------------------------------------------ */
  (() => {
    const host = $('#flakes'), mobile = innerWidth < 600;
    const n = mobile ? 14 : 22;
    for (let i = 0; i < n; i++) {
      const near = Math.random();                       // 0 — далёкая, 1 — ближняя
      const size = 22 + near * near * 84 + Math.random() * 12;
      const el = document.createElement('i');
      el.className = 'flake';
      el.style.cssText =
        `--x:${(Math.random() * 100).toFixed(1)}%;--s:${size.toFixed(0)}px;--o:${(.55 + near * .4).toFixed(2)};` +
        `--b:${(near > .8 ? 2.4 : near < .25 ? 1.2 : 0).toFixed(1)}px;` +
        `--dur:${(30 - near * 14 + Math.random() * 8).toFixed(1)}s;--delay:${(-Math.random() * 34).toFixed(1)}s;` +
        `--sw:${Math.round((Math.random() - .5) * 120)}px;--dr:${Math.round((Math.random() - .5) * 200)}px;` +
        `--spin:${(14 + Math.random() * 22).toFixed(1)}s`;
      el.innerHTML = `<svg viewBox="-30 -30 60 60"><use href="#flake-${i % 3 ? 'a' : 'b'}"/></svg>`;
      if (Math.random() < .5) el.firstChild.style.animationDirection = 'reverse';
      host.appendChild(el);
    }
  })();

  /* ------------------------------------------------------------------ */
  /* Появление                                                           */
  /* ------------------------------------------------------------------ */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -10% 0px', threshold: .08 });

  $$('.write').forEach(el => {
    el.style.setProperty('--dur', Math.min(3, Math.max(.9, .5 + el.textContent.trim().length * .14)).toFixed(2) + 's');
  });
  // на обложке: «wedding day», затем «&»; в остальных разделах — сразу
  $('.cover .wd').style.setProperty('--delay', '.4s');
  $('.cover .amp').style.setProperty('--delay', '2.1s');
  $('.cover .amp').style.setProperty('--dur', '.9s');
  $$('.write').filter(el => !el.closest('.cover')).forEach(el => el.style.setProperty('--delay', '.15s'));
  $$('.stagger').forEach(p => [...p.children].forEach((c, i) => c.style.setProperty('--i', i)));
  $$('.rv, .write, .stagger, .timeline li').forEach(el => io.observe(el));

  const start = () => requestAnimationFrame(() => document.body.classList.add('open'));
  let started = false;
  const go = () => { if (!started) { started = true; start(); } };
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(go);
  setTimeout(go, 1500);

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
  }
  tick(); setInterval(tick, 1000);

  /* ------------------------------------------------------------------ */
  /* Музыка: мягкий пэд + колокольчики. Стартует при первом касании,     */
  /* пока гость сам её не выключил.                                      */
  /* ------------------------------------------------------------------ */
  const sound = $('#sound');
  let actx, master, bellTimer, playing = false, userChose = false;
  function buildAudio() {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain(); master.gain.value = 0;
    const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    const delay = actx.createDelay(1.5); delay.delayTime.value = .55;
    const fb = actx.createGain(); fb.gain.value = .42;
    const wet = actx.createGain(); wet.gain.value = .5;
    master.connect(lp); lp.connect(actx.destination);
    lp.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(actx.destination);
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
    const notes = [587.33, 659.25, 739.99, 880, 987.77, 1108.73, 1318.51];
    const o = actx.createOscillator(); o.type = 'sine'; o.frequency.value = notes[Math.floor(Math.random() * notes.length)];
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
    master.gain.linearRampToValueAtTime(on ? .5 : 0, actx.currentTime + 2);
    clearInterval(bellTimer);
    if (on) bellTimer = setInterval(() => Math.random() < .75 && bell(), 2600);
    sound.setAttribute('aria-pressed', on);
    sound.setAttribute('aria-label', on ? 'Выключить музыку' : 'Включить музыку');
  }
  sound.addEventListener('click', () => { userChose = true; setSound(!playing); });
  const autoStart = (e) => {
    if (userChose || (e.target.closest && e.target.closest('#sound'))) return;
    removeEventListener('pointerdown', autoStart); removeEventListener('keydown', autoStart);
    if (!playing) setSound(true);
  };
  addEventListener('pointerdown', autoStart); addEventListener('keydown', autoStart);
  document.addEventListener('visibilitychange', () => {
    if (!actx) return;
    document.hidden ? actx.suspend() : playing && actx.resume();
  });

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
})();
