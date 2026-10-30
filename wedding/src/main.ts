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
  const dayMonth = fmt({ day: 'numeric', month: 'long' });
  const cel = C.celebration || {};
  const bind = {
    groom: C.groom,
    bride: C.bride,
    signature: `${C.groom} и ${C.bride}`,
    dd: date.getDate(),
    yyyy: date.getFullYear(),
    monthName: fmt({ month: 'long' }),
    weekdayName: fmt({ weekday: 'long' }),
    timeLine: 'Начало в ' + pad(date.getHours()) + ':' + pad(date.getMinutes()),
    untilLine: 'До ' + fmt({ day: 'numeric', month: 'long', year: 'numeric' }).replace(/\s*г\.$/, ''),
    programSub: fmt({ weekday: 'long' }) + ', ' + dayMonth,
    celSubtitle: cel.subtitle || '',
    celText: cel.text || '',
    dressSub: C.dresscode.subtitle || '',
    dressText: C.dresscode.text,
    winterNote: C.winterNote || '',
    orgName: C.organizer.name,
    deadline: C.rsvp.deadline,
  };
  $$('[data-bind]').forEach(el => { el.textContent = bind[el.dataset.bind] ?? ''; });
  document.title = `${C.groom} & ${C.bride} — приглашение на свадьбу`;

  const photo = $('#photo'), photoImg = $('#photoImg');
  if (C.photo) {
    photoImg.onload = () => photo.classList.add('loaded');
    photoImg.onerror = () => photo.classList.add('empty');
    photoImg.src = C.photo;
  } else photo.classList.add('empty');

  $('#storyText').innerHTML = (C.story || []).map(p => `<p class="rv">${p}</p>`).join('');

  const place = [cel.place, cel.address].filter(Boolean);
  $('#celPlace').innerHTML = place.length ? place.map((t, i) => i ? `<small style="display:block;margin-top:6px;font-size:14px;opacity:.8">${t}</small>` : t).join('') : '';
  if (cel.link) { const a = $('#celLink'); a.href = cel.link; a.hidden = false; }

  const org = $('#orgLink');
  const tg = C.organizer.telegram, phone = C.organizer.phone;
  org.href = tg ? `https://t.me/${tg}` : 'tel:' + phone.replace(/[^+\d]/g, '');
  org.textContent = tg ? 'Написать в Telegram' : phone;
  if (tg) org.target = '_blank';

  $('#swatches').innerHTML = C.dresscode.colors.map(([d, m, l]) =>
    `<span class="swatch" style="background:
      radial-gradient(circle at 30% 25%, ${l} 0, transparent 38%),
      linear-gradient(115deg, ${d} 0%, ${m} 22%, ${l} 38%, ${m} 52%, ${d} 66%, ${m} 82%, ${l} 100%)"></span>`).join('');

  /* полоска дат: за два дня до и после праздника */
  const HEART = '<svg viewBox="0 0 24 22"><path d="M12 21C3 14 2 8 6 5.500 8.800 3.500 11 5 12 7 13 5 15.200 3.500 18 5.500 22 8 21 14 12 21Z" fill="#6d1a2c"/></svg>';
  $('#datestrip').innerHTML = [-2, -1, 0, 1, 2].map(k => {
    const n = new Date(date.getTime() + k * 86400000).getDate();
    return k ? `<span>${n}</span>` : `<span class="on">${HEART}<span>${n}</span></span>`;
  }).join('');

  /* ------------------------------------------------------------------ */
  /* «Живопись»: процедурные иллюстрации в SVG                           */
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
  const f1 = n => +n.toFixed(1);
  const INK = '#2b141b';
  const FIR = ['#2f4f3a', '#3d6048', '#55775a', '#6e9070'];
  const PINKS = [['#f4b6c2', '#c4546b', '#f1dc98'], ['#f9d4da', '#d98a9b', '#f1dc98'], ['#e9a0ae', '#a8475c', '#f1dc98']];

  const blossom = (x, y, s, cols, rot) => {
    let p = '';
    for (let i = 0; i < 5; i++) p += `<ellipse cx="0" cy="${f1(-s * .58)}" rx="${f1(s * .4)}" ry="${f1(s * .6)}" transform="rotate(${i * 72})" fill="${cols[0]}" stroke="${cols[1]}" stroke-width="${f1(s * .06)}"/>`;
    for (let i = 0; i < 5; i++) p += `<ellipse cx="0" cy="${f1(-s * .66)}" rx="${f1(s * .16)}" ry="${f1(s * .3)}" transform="rotate(${i * 72})" fill="#fff" opacity=".3"/>`;
    p += `<circle r="${f1(s * .24)}" fill="${cols[2]}"/>`;
    return `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(rot)})">${p}</g>`;
  };

  /* зимние элементы: хвоя, ягоды, звёздочки */
  const needles = (x, y, ang, len, r) => {
    let s = '';
    for (let i = 0; i < 7; i++) {
      const a = (ang - 64 + i * (128 / 6) + (r() - .5) * 10) * Math.PI / 180, l = len * (.7 + r() * .5);
      const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l;
      s += `<path d="M${f1(x)} ${f1(y)}L${f1(x2)} ${f1(y2)}" stroke="${FIR[Math.floor(r() * 4)]}" stroke-width="2.4" stroke-linecap="round"/>`;
      if (r() < .4) s += `<circle cx="${f1(x2)}" cy="${f1(y2)}" r="1.7" fill="#fff" opacity=".9"/>`;
    }
    return s;
  };
  const berries = (x, y, s = 1) => [[0, 0], [7, -3], [-6, -4], [2, -9]].map(([dx, dy]) =>
    `<circle cx="${f1(x + dx * s)}" cy="${f1(y + dy * s)}" r="${f1(4.2 * s)}" fill="#8c1f38"/><circle cx="${f1(x + dx * s - 1.2 * s)}" cy="${f1(y + dy * s - 1.4 * s)}" r="${f1(1.2 * s)}" fill="#fff" opacity=".75"/>`).join('');
  const star = (x, y, s, fill = '#e6c765') =>
    `<path transform="translate(${f1(x)} ${f1(y)}) scale(${s})" d="M0-10L2.6-2.6 10 0 2.6 2.6 0 10-2.6 2.6-10 0-2.6-2.6Z" fill="${fill}"/>`;

  function firSVG({ w, h, p0, p1, p2, n, len, seed }) {
    const r = rng(seed);
    const Q = (t, a, b, c) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
    const pt = t => [Q(t, p0[0], p1[0], p2[0]), Q(t, p0[1], p1[1], p2[1])];
    const dr = t => [2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]), 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1])];
    let g = `<path d="M${p0}Q${p1} ${p2}" fill="none" stroke="#5a4a2a" stroke-width="3.2" stroke-linecap="round"/>`;
    for (let i = 0; i < n; i++) {
      const t = (i + .5) / n, [x, y] = pt(t), [dx, dy] = dr(t), ang = Math.atan2(dy, dx) * 180 / Math.PI;
      for (const side of [-1, 1]) {
        const ta = ang + side * (48 + r() * 18), l = len * (.7 + r() * .5) * (1 - .3 * t), rad = ta * Math.PI / 180;
        const x2 = x + Math.cos(rad) * l, y2 = y + Math.sin(rad) * l;
        g += `<path d="M${f1(x)} ${f1(y)}L${f1(x2)} ${f1(y2)}" stroke="#5a4a2a" stroke-width="2" stroke-linecap="round"/>`;
        g += needles(x + (x2 - x) * .45, y + (y2 - y) * .45, ta, l * .38, r) + needles(x2, y2, ta, l * .42, r);
        if (r() < .4) g += `<ellipse cx="${f1(x + (x2 - x) * .6)}" cy="${f1(y + (y2 - y) * .6 - 3)}" rx="7" ry="2.2" fill="#fff" opacity=".9" transform="rotate(${f1(ta)} ${f1(x + (x2 - x) * .6)} ${f1(y + (y2 - y) * .6 - 3)})"/>`;
      }
    }
    { const [x, y] = pt(1), [dx, dy] = dr(1); g += needles(x, y, Math.atan2(dy, dx) * 180 / Math.PI, len * .55, r); }
    for (let k = 0; k < 4; k++) {
      const t = .2 + .65 * r(), [x, y] = pt(t), [dx, dy] = dr(t), m = Math.hypot(dx, dy) || 1, off = (r() < .5 ? -1 : 1) * (12 + r() * 14);
      g += berries(x - dy / m * off, y + dx / m * off, 1 + r() * .4);
    }
    g += star(pt(.55)[0] + 14, pt(.55)[1] - 18, .9);
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${g}</svg>`;
  }

  const berrySVG = (seed) => {
    const r = rng(seed);
    let g = '';
    for (let i = 0; i < 7; i++) g += needles(44, 44, 4 + i * 52, 30 + r() * 12, r) + needles(44 + Math.cos((4 + i * 52) * .01745) * 18, 44 + Math.sin((4 + i * 52) * .01745) * 18, 4 + i * 52, 18, r);
    g += berries(46, 48, 1.5) + berries(84, 34, 1) + berries(34, 86, 1) + star(92, 90, 1.1);
    return `<svg viewBox="0 0 120 120" aria-hidden="true">${g}</svg>`;
  };

  const garlandSVG = (seed) => {
    const r = rng(seed), W = 520, H = 96, y0 = H / 2, A = 20;
    const Y = x => y0 + Math.sin(x / 38) * A;
    let d = `M-10 ${f1(Y(-10))}`;
    for (let x = -4; x <= W + 10; x += 6) d += `L${x} ${f1(Y(x))}`;
    let g = `<path d="${d}" fill="none" stroke="#5a4a2a" stroke-width="2.600" stroke-linecap="round"/>`;
    for (let x = 4, i = 0; x < W; x += 22, i++) {
      const ang = Math.atan2(Math.cos(x / 38) * A / 38, 1) * 180 / Math.PI;
      g += needles(x, Y(x), ang + (i % 2 ? 90 : -90), 20 + r() * 6, r);
    }
    for (let x = 40, i = 0; x < W; x += 86, i++) g += berries(x, Y(x) + (i % 2 ? 8 : -6), 1.1) + star(x + 43, Y(x + 43) + (i % 2 ? -8 : 8), .9);
    g += `<path d="M0 4H${W}M0 ${H - 4}H${W}" stroke="${INK}" stroke-opacity=".45" stroke-width=".8"/>`;
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${g}</svg>`;
  };

  const cloudsSVG = () => {
    const blobs = [
      [60, 70, 78, 32, '#d9c7dc', .9], [330, 56, 86, 30, '#e8c3cc', .85], [200, 24, 100, 22, '#fbf1d6', .95],
      [24, 150, 54, 26, '#fbf1d6', .9], [372, 150, 56, 28, '#d9c7dc', .85], [120, 40, 70, 24, '#fff8ea', .95],
      [290, 100, 66, 22, '#f6e9d6', .85], [86, 118, 60, 20, '#fff8ea', .9], [206, 70, 90, 20, '#fbf6e6', .55],
      [348, 22, 56, 18, '#c9b4d1', .6], [40, 34, 52, 16, '#c9b4d1', .55],
    ];
    const g = blobs.map(([x, y, rx, ry, c, o], i) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c}" opacity="${o}" transform="rotate(${(i % 3 - 1) * 5} ${x} ${y})"/>`).join('');
    return `<svg viewBox="0 0 400 180" preserveAspectRatio="xMidYMin slice" aria-hidden="true">${g}</svg>`;
  };

  /* зимний пейзаж: вилла в снегу с тёплыми огоньками, ели, ягоды падуба */
  const landscapeSVG = (id, mode) => {
    const withSky = mode === 'full', far = mode !== 'villa';
    const r = rng(42);
    let g = '';
    if (withSky) {
      g += `<defs><linearGradient id="sk-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9b6c6"/><stop offset=".55" stop-color="#f6dfae"/><stop offset="1" stop-color="#fbf1dc"/></linearGradient></defs>`;
      g += `<rect width="420" height="300" fill="url(#sk-${id})"/>`;
      g += `<circle cx="300" cy="100" r="64" fill="#fff3c8" opacity=".55"/>`;
      g += `<ellipse cx="90" cy="58" rx="70" ry="14" fill="#fff8ea" opacity=".8"/><ellipse cx="320" cy="36" rx="60" ry="11" fill="#fbf1d6" opacity=".85"/><ellipse cx="220" cy="84" rx="54" ry="9" fill="#fff8ea" opacity=".65"/>`;
    }
    if (far) {
      g += `<path d="M0 176L46 142 82 164 130 120 176 160 214 146 262 112 316 158 352 136 420 170V224H0Z" fill="#c9b4d1"/>`;
      [[130, 120], [262, 112], [46, 142], [352, 136]].forEach(([x, y]) => { g += `<path d="M${x} ${y}L${x - 14} ${y + 20}L${x - 5} ${y + 16}L${x} ${y + 24}L${x + 6} ${y + 16}L${x + 15} ${y + 20}Z" fill="#fff" opacity=".95"/>`; });
      g += `<rect y="194" width="420" height="36" fill="#d3d9ec"/><path d="M20 202h60M120 210h80M250 200h70M330 212h60" stroke="#fff" stroke-opacity=".6" stroke-width="2" stroke-linecap="round"/>`;
    }
    g += `<path d="M0 218C60 190 140 198 200 212 270 228 340 194 420 208V300H0Z" fill="#f4eef0"/><path d="M0 244C80 228 150 240 220 248 300 256 360 236 420 244V300H0Z" fill="#e8dde9"/>`;
    const win = (x, y) => `<path d="M${x} ${y + 14}V${y + 5}a5 5 0 0 1 10 0V${y + 14}Z" fill="#f4bd5e" stroke="#6d1a2c" stroke-width="1"/><path d="M${x + 5} ${y}V${y + 14}" stroke="#6d1a2c" stroke-width=".8"/>`;
    const cap = (x, y, w) => `<rect x="${x}" y="${y - 3}" width="${w}" height="5" rx="2.500" fill="#fff"/>`;
    g += `<rect x="20" y="238" width="270" height="16" fill="#d8cbb0"/>` + cap(20, 238, 270);
    g += `<rect x="34" y="118" width="46" height="124" fill="#e8c88e"/><rect x="68" y="118" width="12" height="124" fill="#6d1a2c" opacity=".16"/>`;
    for (let i = 0; i < 5; i++) g += `<rect x="${34 + i * 10}" y="109" width="7" height="10" fill="#e8c88e"/><rect x="${34 + i * 10}" y="106" width="7" height="4" rx="2" fill="#fff"/>`;
    g += win(52, 136) + win(52, 172) + win(52, 206);
    g += `<rect x="80" y="170" width="150" height="70" fill="#f3dcaa"/><path d="M70 172L155 138 240 172Z" fill="#b95a43"/><path d="M74 170L155 141 236 170 226 171 155 150 84 171Z" fill="#fff"/>`;
    [92, 124, 170, 202].forEach(x => { g += win(x, 190); });
    g += `<rect x="150" y="204" width="14" height="36" rx="7" fill="#5a1424"/>`;
    g += `<rect x="196" y="150" width="68" height="94" fill="#ecd09a"/><path d="M188 152L230 124 272 152Z" fill="#a8503b"/><path d="M192 150L230 128 268 150 260 151 230 134 200 151Z" fill="#fff"/>`;
    g += win(206, 166) + win(236, 166) + win(206, 200) + win(236, 200);
    g += `<rect x="252" y="150" width="12" height="94" fill="#6d1a2c" opacity=".14"/>`;
    g += `<rect x="212" y="118" width="9" height="20" fill="#c9a37a"/><rect x="210" y="115" width="13" height="5" rx="2" fill="#fff"/>`;
    const spruce = (x, y, h, col) => {
      let s = `<rect x="${x - 2}" y="${y - 6}" width="4" height="8" fill="#4a3526"/>`;
      for (let k = 0; k < 4; k++) {
        const yb = y - 6 - k * h * .2, wk = h * .3 * (1 - k * .18), top = yb - h * .38;
        s += `<path d="M${f1(x - wk)} ${f1(yb)}L${x} ${f1(top)}L${f1(x + wk)} ${f1(yb)}Z" fill="${col}"/>`;
        s += `<path d="M${f1(x - wk * .62)} ${f1(yb - h * .14)}L${x} ${f1(top)}L${f1(x + wk * .62)} ${f1(yb - h * .14)}Q${x} ${f1(yb - h * .2)} ${f1(x - wk * .62)} ${f1(yb - h * .14)}Z" fill="#fff" opacity=".93"/>`;
      }
      return s;
    };
    [[308, 266, 122, '#2f4f3a'], [336, 270, 92, '#3d6048'], [364, 264, 132, '#2f4f3a'], [394, 270, 100, '#3d6048'], [12, 270, 106, '#3d6048']].forEach(([x, y, h, c]) => { g += spruce(x, y, h, c); });
    g += `<path d="M0 270C40 254 90 262 130 270 170 258 230 262 270 272 310 260 370 264 420 270V300H0Z" fill="#fbf8f6"/><rect y="276" width="420" height="24" fill="#f1e9f0"/>`;
    [[60, 272], [150, 276], [250, 274]].forEach(([x, y]) => {
      g += `<ellipse cx="${x - 8}" cy="${y}" rx="11" ry="5" fill="#3d6048" transform="rotate(-20 ${x - 8} ${y})"/><ellipse cx="${x + 8}" cy="${y}" rx="11" ry="5" fill="#2f4f3a" transform="rotate(20 ${x + 8} ${y})"/>` + berries(x, y - 1, .8);
    });
    for (let i = 0; i < 22; i++) {
      const x = r() * 420, y = 262 + r() * 34, s = 1.5 + r() * 2.5;
      g += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(s)}" fill="${['#fff', '#fff', '#8c1f38', '#f1dc98'][i % 4]}"/>`;
    }
    return `<svg viewBox="0 0 420 300" preserveAspectRatio="xMidYMax ${mode === 'full' ? 'slice' : 'meet'}" aria-hidden="true">${g}</svg>`;
  };

  
/* иконки программы */
  const ICONS = {
    glasses: `<g transform="rotate(-14 22 34)"><path d="M14 10h16l-2 20c-.5 5-3 7-6 7s-5.500-2-6-7z" fill="#f1dc98" stroke="${INK}" stroke-width="1.600"/><path d="M22 37v15M15 53h14" stroke="${INK}" stroke-width="1.600" stroke-linecap="round"/></g><g transform="rotate(14 42 34)"><path d="M34 10h16l-2 20c-.5 5-3 7-6 7s-5.500-2-6-7z" fill="#f9d4da" stroke="${INK}" stroke-width="1.600"/><path d="M42 37v15M35 53h14" stroke="${INK}" stroke-width="1.600" stroke-linecap="round"/></g><path d="M32 6v6M29 9h6" stroke="#6d1a2c" stroke-width="1.600" stroke-linecap="round"/>`,
    rings: `<circle cx="24" cy="38" r="14" fill="none" stroke="#c79f4f" stroke-width="4"/><circle cx="40" cy="38" r="14" fill="none" stroke="#e0bf6a" stroke-width="4"/><path d="M32 8l6 7-6 9-6-9z" fill="#f9d4da" stroke="${INK}" stroke-width="1.500" stroke-linejoin="round"/>`,
    dinner: `<path d="M8 42a24 22 0 0 1 48 0z" fill="#f1dc98" stroke="${INK}" stroke-width="1.600"/><circle cx="32" cy="17" r="3.500" fill="#6d1a2c"/><path d="M4 47h56" stroke="${INK}" stroke-width="2" stroke-linecap="round"/><path d="M14 36a18 16 0 0 1 14-14" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2" stroke-linecap="round"/>`,
    cake: `<rect x="12" y="40" width="40" height="14" rx="3" fill="#fbf6e6" stroke="${INK}" stroke-width="1.600"/><rect x="18" y="28" width="28" height="12" rx="3" fill="#f9d4da" stroke="${INK}" stroke-width="1.600"/><rect x="25" y="18" width="14" height="10" rx="2" fill="#fbf6e6" stroke="${INK}" stroke-width="1.600"/><path d="M32 18v-6" stroke="${INK}" stroke-width="1.600"/><path d="M32 4c4 3 3 7 0 8-3-1-4-5 0-8z" fill="#e9a23a"/><circle cx="20" cy="40" r="2.200" fill="#6d1a2c"/><circle cx="32" cy="40" r="2.200" fill="#6d1a2c"/><circle cx="44" cy="40" r="2.200" fill="#6d1a2c"/>`,
    moon: `<path d="M40 8a24 24 0 1 0 16 36A20 20 0 0 1 40 8z" fill="#f1dc98" stroke="${INK}" stroke-width="1.600" stroke-linejoin="round"/><path d="M50 12l1.800 4.200 4.200 1.800-4.200 1.800L50 24l-1.800-4.200-4.200-1.800 4.200-1.800z" fill="#6d1a2c"/><circle cx="54" cy="34" r="2" fill="#6d1a2c"/>`,
    flowers: `<path d="M32 58V30" stroke="#5b6b36" stroke-width="3" stroke-linecap="round"/>${blossom(32, 24, 22, PINKS[0], 0)}${blossom(16, 40, 13, PINKS[1], 20)}${blossom(48, 40, 13, PINKS[2], 40)}`,
  };

  const ART = {
    branch: (d) => firSVG({ w: 300, h: 300, p0: [-10, 36], p1: [150, 14], p2: [270, 210], n: 9, len: 52, seed: +d.seed || 1 }),
    bloom: (d) => berrySVG(+d.seed || 1),
    vine: (d) => garlandSVG(+d.seed || 1),
    clouds: () => cloudsSVG(),
    landscape: (d) => landscapeSVG(d.id || 'x', d.mode || (d.id === 'villa' ? 'villa' : 'full')),
  };
  $$('[data-art]').forEach(el => { el.innerHTML = ART[el.dataset.art](el.dataset); });

  /* таймлайн (после иконок: иконки подставляются вручную) */
  $('#timeline').innerHTML = C.timeline.map((t, i) => `
    <li class="tl-item rv${i % 2 ? ' alt' : ''}">
      <div class="txt"><span class="time">${t.time}</span><div class="name">${t.title}</div><div class="desc">${t.text}</div></div>
      <div class="dot">${HEART}</div>
      <div class="ico art"><svg viewBox="0 0 64 64" aria-hidden="true">${ICONS[t.icon] || ICONS.flowers}</svg></div>
    </li>`).join('');

  /* ------------------------------------------------------------------ */
  /* WebGL: небо, написанное мазками масла                               */
  /* ------------------------------------------------------------------ */
  (() => {
    const canvas = $('#paint-sky');
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return;
    const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const fs = `
      precision highp float;
      uniform vec2 uRes, uMouse; uniform float uTime, uScroll, uPush;

      float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
      }
      float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + vec2(17.1, 3.7); a *= .5; } return v; }

      // высота «краски»: облака + направленные мазки кисти
      float field(vec2 p, out float cloud){
        float t = uTime * .025;
        vec2 q = p + vec2(t * 3., 0.);
        vec2 w = vec2(fbm(q * .55 + vec2(0., t)), fbm(q * .55 + vec2(5.2, 1.3) - t));
        q += (w - .5) * 1.8;
        float a = fbm(q * .4) * 6.2832;
        vec2 d = vec2(cos(a), sin(a)), o = vec2(-d.y, d.x);
        float s1 = noise(vec2(dot(q, d) * .8, dot(q, o) * 8.));
        float s2 = noise(vec2(dot(q, d) * 2.1, dot(q, o) * 19.));
        cloud = smoothstep(.36, .7, fbm(q * .75 + 3.));
        return cloud * .75 + s1 * .24 + s2 * .1;
      }

      void main(){
        vec2 uv = gl_FragCoord.xy / uRes; float asp = uRes.x / uRes.y;
        vec2 p = uv * vec2(asp, 1.) * 2.6 + vec2(0., uScroll);

        // курсор «размазывает» краску
        vec2 d = (uv - uMouse) * vec2(asp, 1.);
        float r = exp(-dot(d, d) * 14.);
        p += r * uPush * vec2(-d.y, d.x) * 4.;

        float cl, c2; float e = .012;
        float h = field(p, cl);
        float hx = field(p + vec2(e, 0.), c2), hy = field(p + vec2(0., e), c2);
        vec3 n = normalize(vec3((h - hx) / e * .9, (h - hy) / e * .9, 1.));
        vec3 L = normalize(vec3(-.5, .6, .65));
        float diff = dot(n, L) * .5 + .5;
        float spec = pow(max(dot(reflect(-L, n), vec3(0., 0., 1.)), 0.), 22.);

        vec3 top = vec3(.80, .64, .72), mid = vec3(.97, .87, .64), low = vec3(.99, .95, .86);
        vec3 sky = mix(low, mid, smoothstep(.08, .5, uv.y));
        sky = mix(sky, top, smoothstep(.5, 1., uv.y));
        vec3 cloudLit = vec3(1., .98, .94), cloudShade = vec3(.64, .48, .62);
        vec3 col = mix(sky, mix(cloudShade, cloudLit, smoothstep(.25, .85, diff)), cl);
        col *= .8 + .4 * diff;
        col += spec * .22 * vec3(1., .94, .78);
        col += (noise(gl_FragCoord.xy * .9) - .5) * .03;   // зерно холста
        gl_FragColor = vec4(col, 1.);
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
    const U = n => gl.getUniformLocation(prog, n);
    const u = { res: U('uRes'), time: U('uTime'), scroll: U('uScroll'), push: U('uPush'), mouse: U('uMouse') };

    const resize = () => {
      const k = Math.min(devicePixelRatio || 1, 1.5) * 0.5;
      canvas.width = Math.max(2, Math.round(innerWidth * k));
      canvas.height = Math.max(2, Math.round(innerHeight * k));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    addEventListener('resize', resize);

    const m = { x: .5, y: .5, tx: .5, ty: .5, push: 0 };
    const onMove = (e) => { m.tx = e.clientX / innerWidth; m.ty = 1 - e.clientY / innerHeight; };
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('pointerdown', onMove, { passive: true });

    const t0 = performance.now();
    let scroll = 0;
    const frame = (now) => {
      requestAnimationFrame(frame);
      if (document.hidden) return;
      const dx = m.tx - m.x, dy = m.ty - m.y;
      m.x += dx * .12; m.y += dy * .12;
      m.push += (Math.min(1.6, Math.hypot(dx, dy) * 14) - m.push) * .08;
      scroll += (scrollY / innerHeight - scroll) * .08;
      gl.uniform2f(u.res, canvas.width, canvas.height);
      gl.uniform1f(u.time, reduce ? 12 : (now - t0) / 1000);
      gl.uniform1f(u.scroll, scroll * .6);
      gl.uniform1f(u.push, m.push);
      gl.uniform2f(u.mouse, m.x, m.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    requestAnimationFrame(frame);
  })();

  /* ------------------------------------------------------------------ */
  /* Снегопад                                                            */
  /* ------------------------------------------------------------------ */
  (() => {
    const host = $('#petals');
    const n = innerWidth < 600 ? 26 : 44;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      const size = 3 + Math.random() * Math.random() * 9;
      p.style.cssText = `--x:${(Math.random() * 100).toFixed(1)}%;--s:${size.toFixed(1)}px;--b:${(size > 8 ? 1.2 : 0).toFixed(1)}px;` +
        `--dur:${(11 + (14 - size) * 1.1 + Math.random() * 8).toFixed(1)}s;--delay:${(-Math.random() * 26).toFixed(1)}s;` +
        `--drift:${Math.round((Math.random() - .5) * 200)}px;--sway:${Math.round(20 + Math.random() * 40)}px`;
      host.appendChild(p);
    }
  })();

  /* ------------------------------------------------------------------ */
  /* Появление: «рукописные» строки, поочерёдные дети                    */
  /* ------------------------------------------------------------------ */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -10% 0px', threshold: .08 });

  $$('.write').forEach(el => {
    el.style.setProperty('--dur', Math.min(3.4, Math.max(.9, .45 + el.textContent.trim().length * .13)).toFixed(2) + 's');
  });
  $$('section').forEach(sec => {
    let t = sec.id === 'cover' ? 1.5 : .15;
    $$('.write', sec).forEach((el, i) => {
      if (i < 3) {
        el.style.setProperty('--delay', t.toFixed(2) + 's');
        t += parseFloat(el.style.getPropertyValue('--dur')) * .8 + .1;
      } else el.style.setProperty('--delay', '.3s');
    });
  });
  $$('.stagger').forEach(p => [...p.children].forEach((c, i) => c.style.setProperty('--i', i)));
  $$('.rv, .write, .stagger, .timeline').forEach(el => io.observe(el));

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
  /* Музыка (мягкий пэд + колокольчики, без файлов)                      */
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
  /* Интро: развязываем бант, открываем конверт                          */
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
    }, 2800);
    setTimeout(() => intro.remove(), 4200);
  }
  $('#bow').addEventListener('click', (e) => { e.stopPropagation(); openEnvelope(); });
  intro.addEventListener('click', openEnvelope);

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
})();
