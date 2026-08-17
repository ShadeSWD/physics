/* Работа 1-3. Исследование механического резонанса.
 * Модель: собственная частота струны ν₀ = (1/2ℓ)√(T/m_l), T ∝ делениям шкалы;
 * амплитуда вынужденных колебаний A = A_max/(Q√((u²−1)² + (u/Q)²)), u = ν₀/ν.
 * По снятым точкам строится резонансная кривая, по её ширине — добротность;
 * по ряду измерений диаметра — напряжение в струне с доверительным интервалом. */
'use strict';
(function () {
  const svg = $('vr');
  if (!svg || !window.VL) return;

  const NU = 100, D_NU = 1;              // частота вынуждающей силы, Гц
  const ELL = 0.700, D_ELL = 0.0005;     // длина струны, м
  const ML = 0.58e-3, D_ML = 0.01e-3;    // погонная масса, кг/м
  const D_TRUE = 0.375e-3;               // истинный диаметр струны, м
  const D_MIC = 0.005e-3;                // приборная погрешность микрометра, м
  const SIG_D = 0.02e-3;                 // разброс диаметра по длине струны, м
  const Q_TRUE = 25;                     // добротность, заложенная в модель
  const A_MAX = 2.5;                     // амплитуда в резонансе, мм
  const E_RES = 1.90;                    // резонансное деление шкалы натяжения
  const X0 = 78, X1 = 430, YS = 150, APX = 22 / A_MAX;   // струна на схеме

  let E = 0.60, t = 0;
  const pts = [];     /* точки резонансной кривой */
  const ds = [];      /* измерения диаметра, м */

  const nu0 = e => NU * Math.sqrt(Math.max(e, 0) / E_RES);
  function amp(e) {                      /* амплитуда, мм */
    const u = nu0(e) / NU;
    return A_MAX / (Q_TRUE * Math.sqrt(Math.pow(u * u - 1, 2) + Math.pow(u / Q_TRUE, 2)));
  }
  /* напряжение в струне в момент резонанса, Па */
  const eps = D => 16 * NU * NU * ELL * ELL * ML / (Math.PI * D * D);

  /* ---------- статическая разметка ---------- */
  {
    const g = $('vrsc');
    for (let i = -4; i <= 4; i++) {
      const y = YS + i * 9;
      VL.el('line', {
        x1: 244, y1: y, x2: i % 2 ? 250 : 256, y2: y, stroke: '#6b6b74', 'stroke-width': 1,
      }, g);
    }
    VL.el('line', { x1: 244, y1: YS - 40, x2: 244, y2: YS + 40, stroke: '#6b6b74', 'stroke-width': 1.2 }, g);
    const tk = $('vrticks');
    for (let i = 0; i <= 3; i++) {
      const a = (-120 + i * 80) * Math.PI / 180;
      const x1 = 575 + 30 * Math.sin(a), y1 = 64 - 30 * Math.cos(a);
      const x2 = 575 + 38 * Math.sin(a), y2 = 64 - 38 * Math.cos(a);
      VL.el('line', { x1: x1.toFixed(1), y1: y1.toFixed(1), x2: x2.toFixed(1), y2: y2.toFixed(1),
        stroke: '#6b6b74', 'stroke-width': 1 }, tk);
      const lb = VL.el('text', {
        x: (575 + 22 * Math.sin(a)).toFixed(1), y: (68 - 22 * Math.cos(a)).toFixed(1),
        'text-anchor': 'middle',
      }, tk);
      lb.textContent = String(i);
    }
    $('vrarc').setAttribute('d',
      `M ${(575 + 34 * Math.sin(-120 * Math.PI / 180)).toFixed(1)} ${(64 - 34 * Math.cos(-120 * Math.PI / 180)).toFixed(1)}` +
      ` A 34 34 0 1 1 ${(575 + 34 * Math.sin(120 * Math.PI / 180)).toFixed(1)} ${(64 - 34 * Math.cos(120 * Math.PI / 180)).toFixed(1)}`);
  }

  /* ---------- анимация ---------- */
  VL.loop(function (dt) {
    t += dt;
    const a = amp(E) * APX;
    const ph = Math.sin(2 * Math.PI * 2.2 * t);
    const p = [], e1 = [], e2 = [];
    for (let i = 0; i <= 48; i++) {
      const x = X0 + (X1 - X0) * i / 48;
      const s = Math.sin(Math.PI * i / 48);
      p.push(x.toFixed(1) + ',' + (YS - a * s * ph).toFixed(1));
      e1.push(x.toFixed(1) + ',' + (YS - a * s).toFixed(1));
      e2.push(x.toFixed(1) + ',' + (YS + a * s).toFixed(1));
    }
    $('vrstr').setAttribute('points', p.join(' '));
    $('vrenv').setAttribute('points', e1.join(' '));
    $('vrenv2').setAttribute('points', e2.join(' '));
    /* якорь электромагнита подрагивает */
    $('vrspr').setAttribute('transform', `translate(${(ph * 1.5).toFixed(2)},0)`);
    /* стрелка прибора */
    const ang = (-120 + 80 * E) * Math.PI / 180;
    $('vrneedle').setAttribute('x2', (575 + 36 * Math.sin(ang)).toFixed(1));
    $('vrneedle').setAttribute('y2', (64 - 36 * Math.cos(ang)).toFixed(1));
    $('vrscrewl').setAttribute('x2', (556 + 12 * Math.sin(E * 4)).toFixed(1));
    $('vrscrewl').setAttribute('y2', (259 - 12 * Math.cos(E * 4)).toFixed(1));
    $('vrread').textContent = 'E = ' + VL.fm(E, 2) + ' дел · ν₀ = ' + VL.fm(nu0(E), 1) +
      ' Гц · размах ≈ ' + VL.fm(2 * amp(E), 1) + ' мм';
  });

  /* ---------- измерения ---------- */
  function snap() {
    const A = amp(E);
    let B = 2 * A + VL.noise(0.25);          /* размах с ошибкой глазомера */
    B = Math.max(0, Math.round(B * 2) / 2);  /* отсчёт по шкале до 0,5 мм */
    pts.push({ E, B, A: B / 2 });
    render();
  }
  function micro() {
    let d = D_TRUE + VL.gauss(SIG_D);
    d = Math.round(d / 1e-5) * 1e-5;          /* микрометр: цена деления 0,01 мм */
    ds.push(d);
    render();
  }

  /* ---------- обработка ---------- */
  function render() {
    const out = $('vrout');
    if (!pts.length && !ds.length) {
      out.innerHTML = '';
      $('vrhint').textContent = 'Журнал пуст. Пройдите шкалу натяжения от нуля до ' +
        'трёх делений, снимая отсчёты; вблизи максимума — через 0,02–0,05 деления.';
      return;
    }
    let html = '';

    /* --- резонансная кривая --- */
    if (pts.length) {
      const sorted = pts.slice().sort((a, b) => a.E - b.E);
      html += '<h3>Журнал: резонансная кривая</h3><table class="el"><tr><th class="num">№</th>' +
        '<th class="num">E, дел</th><th class="num">ν₀, Гц</th><th class="num">размах B, мм</th>' +
        '<th class="num">амплитуда A = B/2, мм</th></tr>';
      sorted.forEach((r, i) => {
        html += `<tr><td class="num">${i + 1}</td><td class="num">${VL.fm(r.E, 2)}</td>` +
          `<td class="num">${VL.fm(nu0(r.E), 1)}</td><td class="num">${VL.fm(r.B, 1)}</td>` +
          `<td class="num"><b>${VL.fm(r.A, 2)}</b></td></tr>`;
      });
      html += '</table>';
      if (sorted.length >= 5) html += '<h3>Резонансная кривая</h3><div id="vrchart"></div>';
      else html += '<p class="small">Для построения кривой нужно не меньше пяти точек.</p>';
    }

    /* --- диаметр и напряжение --- */
    if (ds.length >= 3) {
      html += '<h3>Обработка ряда измерений диаметра</h3>';
      const pr = VL.processHtml({
        xs: ds.map(d => d * 1000), instr: D_MIC * 1000, sym: 'D', unit: 'мм', dec: 3,
        trueVal: D_TRUE * 1000, trueName: 'диаметром, заложенным в модель',
      });
      html += pr.html;
      const Dm = pr.st.mean / 1000, dD = pr.st.d / 1000;
      const ev = eps(Dm);
      const rel = Math.sqrt(Math.pow(2 * D_NU / NU, 2) + Math.pow(2 * D_ELL / ELL, 2)
        + Math.pow(D_ML / ML, 2) + Math.pow(2 * dD / Dm, 2));
      const de = ev * rel;
      html += '<h3>Механическое напряжение в струне</h3><div class="panel steps">' +
        VL.step('\\(\\varepsilon = \\dfrac{16\\nu^2\\ell^2m_l}{\\pi D^2}\\)',
          `\\(\\dfrac{16\\cdot 100^2\\cdot 0{,}700^2\\cdot 0{,}58\\cdot 10^{-3}}` +
          `{\\pi\\cdot (${VL.lm(Dm * 1000, 3)}\\cdot 10^{-3})^2}\\)`,
          `\\(${VL.lm(ev / 1e6, 1)}\\) МПа`) +
        VL.step('\\(\\dfrac{\\Delta\\varepsilon}{\\varepsilon}=\\sqrt{\\left(2\\dfrac{\\Delta\\nu}{\\nu}\\right)^2' +
          '+\\left(2\\dfrac{\\Delta\\ell}{\\ell}\\right)^2+\\left(\\dfrac{\\Delta m_l}{m_l}\\right)^2' +
          '+\\left(2\\dfrac{\\Delta D}{D}\\right)^2}\\)',
          `\\(\\sqrt{0{,}02^2 + 0{,}0014^2 + 0{,}0172^2 + ${VL.lm(2 * dD / Dm, 4)}^2}\\)`,
          `\\(${VL.lm(rel * 100, 1)}\\,\\%\\)`) +
        VL.step('\\(\\Delta\\varepsilon\\)', `\\(${VL.lm(ev / 1e6, 1)}\\cdot ${VL.lm(rel, 4)}\\)`,
          `\\(${VL.lm(de / 1e6, 1)}\\) МПа`) + '</div>';
      const st = { mean: ev / 1e6, d: de / 1e6, alpha: 0.95 };
      html += '<div class="ans"><b>Результат вашего опыта:</b> ' +
        VL.record('\\varepsilon', st, 'МПа') + '.</div>';
      html += VL.verdict(st, eps(D_TRUE) / 1e6, 'значением, заложенным в модель',
        'МПа', '\\varepsilon');
      html += '<p class="small">Для стальной струны это около четверти предела ' +
        'текучести — натяжение большое, но безопасное. Обратите внимание, какой ' +
        'вклад в погрешность даёт диаметр: он входит в квадрате и измеряется всего ' +
        'с точностью около полутора процентов.</p>';
    } else if (ds.length) {
      html += '<h3>Измерения диаметра</h3><p class="small">Снято ' + ds.length +
        ' из шести измерений микрометром: ' +
        ds.map(d => VL.fm(d * 1000, 3)).join('; ') + ' мм.</p>';
    }

    out.innerHTML = html;
    if ($('vrchart')) drawChart(pts.slice().sort((a, b) => a.E - b.E));
    VL.mathify(out);
    $('vrhint').textContent = 'Точек кривой: ' + pts.length + '; измерений диаметра: ' + ds.length + '.';
  }

  function drawChart(sorted) {
    const amax = Math.max.apply(null, sorted.map(p => p.A));
    const lvl = amax / Math.SQRT2;
    /* положение максимума с параболической интерполяцией по соседям */
    let im = 0;
    sorted.forEach((p, i) => { if (p.A > sorted[im].A) im = i; });
    let Eres = sorted[im].E;
    if (im > 0 && im < sorted.length - 1) {
      const x1 = sorted[im - 1].E, x2 = sorted[im].E, x3 = sorted[im + 1].E;
      const y1 = sorted[im - 1].A, y2 = sorted[im].A, y3 = sorted[im + 1].A;
      const d = (x1 - x2) * (x1 - x3) * (x2 - x3);
      if (Math.abs(d) > 1e-9) {
        const a = (x3 * (y2 - y1) + x2 * (y1 - y3) + x1 * (y3 - y2)) / d;
        const b = (x3 * x3 * (y1 - y2) + x2 * x2 * (y3 - y1) + x1 * x1 * (y2 - y3)) / d;
        if (a < 0) Eres = VL.clamp(-b / (2 * a), x1, x3);
      }
    }
    /* ширина на уровне A_max/√2 */
    const cross = (i0, dir) => {
      for (let i = i0; dir > 0 ? i < sorted.length - 1 : i > 0; i += dir) {
        const p1 = sorted[i], p2 = sorted[i + dir];
        if ((p1.A - lvl) * (p2.A - lvl) <= 0 && p1.A !== p2.A)
          return p1.E + (lvl - p1.A) * (p2.E - p1.E) / (p2.A - p1.A);
      }
      return null;
    };
    const eL = cross(im, -1), eR = cross(im, 1);
    const dE = (eL != null && eR != null) ? eR - eL : null;
    const Q = dE ? 2 * Eres / dE : null;

    const chart = VL.chart('vrchart', '0 0 640 320');
    const ax = VL.axes(chart, {
      x0: 66, y0: 262, x1: 596, y1: 46, xmin: 0, xmax: 3, ymin: 0, ymax: Math.max(0.5, amax * 1.2),
      xticks: [0.5, 1.0, 1.5, 2.0, 2.5, 3.0].map(v => ({ v, label: VL.fm(v, 1) })),
      yticks: [1, 2, 3].filter(v => v < amax * 1.2).map(v => ({ v, label: String(v) })),
      xlab: 'E, деления шкалы натяжения', ylab: 'A, мм',
    });
    /* теоретическая кривая модели */
    const th = [];
    for (let i = 0; i <= 300; i++) {
      const e = 3 * i / 300;
      th.push([ax.X(e), ax.Y(Math.min(amp(e), amax * 1.2))]);
    }
    VL.series(chart, th, '#6b6b74', null, { dash: '5 4', width: 1.2, noPoints: true });
    VL.series(chart, sorted.map(p => [ax.X(p.E), ax.Y(p.A)]), '#155e75',
      sorted.map(p => `E = ${VL.fm(p.E, 2)}, A = ${VL.fm(p.A, 2)} мм`), { width: 1.6 });
    VL.el('line', {
      x1: ax.X(0), y1: ax.Y(lvl), x2: ax.X(3), y2: ax.Y(lvl),
      stroke: '#b3382e', 'stroke-width': 1, 'stroke-dasharray': '4 4',
    }, chart);
    VL.label(chart, ax.X(3), ax.Y(lvl) - 5, '#b3382e',
      'уровень A_max/√2 = ' + VL.fm(lvl, 2) + ' мм', { 'text-anchor': 'end' });
    VL.label(chart, 90, 70, '#1a7f37',
      'резонанс при E = ' + VL.fm(Eres, 2) + ' дел (ν₀ = ν = 100 Гц)');
    VL.label(chart, 90, 86, '#6b6b74', dE
      ? 'ширина ΔE = ' + VL.fm(dE, 3) + ' дел'
      : 'ширина не определяется: мало точек на склонах');

    const p = document.createElement('div');
    if (Q) {
      p.innerHTML = '<div class="panel steps">' +
        VL.step('\\(Q = \\dfrac{\\nu}{\\Delta\\nu} = \\dfrac{2E_{\\text{рез}}}{\\Delta E}\\)',
          `\\(2\\cdot ${VL.lm(Eres, 2)}/${VL.lm(dE, 3)}\\)`, `\\(${VL.lm(Q, 1)}\\)`) +
        VL.step('\\(\\Delta\\nu = \\nu/Q\\)', `\\(100/${VL.lm(Q, 1)}\\)`,
          `\\(${VL.lm(NU / Q, 1)}\\) Гц`) + '</div>' +
        '<p class="small">В модель заложена добротность ' + Q_TRUE + '. ' +
        (Math.abs(Q - Q_TRUE) < 0.25 * Q_TRUE
          ? 'Ваша оценка близка к ней — точки на склонах сняты достаточно часто.'
          : 'Ваша оценка заметно отличается: пик снят слишком редкими точками, ' +
            'максимум срезан, а ширина завышена. Добавьте отсчёты вблизи резонанса.') +
        '</p>';
    } else {
      p.innerHTML = '<p class="small">Чтобы определить добротность, нужны точки по ' +
        'обе стороны пика на уровне \\(A_{\\max}/\\sqrt2\\). Снимите отсчёты чаще ' +
        'вблизи максимума.</p>';
    }
    $('vrchart').appendChild(p);
    VL.mathify(p);
  }

  /* ---------- органы управления ---------- */
  VL.slider('vrE', 'vrEv', v => VL.fm(v, 2) + ' дел', v => { E = v; });

  $('vrsnap').addEventListener('click', snap);
  $('vrmic').addEventListener('click', micro);
  $('vrreset').addEventListener('click', () => { pts.length = 0; ds.length = 0; render(); });

  const SCAN = [0, 0.4, 0.8, 1.1, 1.3, 1.5, 1.65, 1.75, 1.82, 1.86, 1.90, 1.94,
    1.98, 2.06, 2.16, 2.3, 2.5, 2.8, 3.0];
  VL.auto({
    autoBtn: 'vrauto', stopBtn: 'vrstop',
    lockIds: ['vrsnap', 'vrmic', 'vrreset', 'vrE'],
    total: () => SCAN.length + 6,
    progress: (i, n) => {
      const p = $('vrprog'); p.style.display = '';
      p.textContent = i <= 6 ? `диаметр ${i} из 6` : `точка ${i - 6} из ${n - 6}`;
    },
    step: async (i, ctl) => {
      if (i === 0) { pts.length = 0; ds.length = 0; render(); }
      if (i < 6) { micro(); await ctl.sleep(160); return; }
      const e = SCAN[i - 6];
      const s = $('vrE'); s.value = e; s.dispatchEvent(new Event('input'));
      await ctl.sleep(210);
      if (!ctl.aborted()) snap();
    },
    onFinish: (aborted, done, n) => {
      $('vrprog').style.display = 'none';
      $('vrhint').textContent = aborted
        ? `Прогон остановлен: выполнено ${done} из ${n} шагов.`
        : 'Полный прогон выполнен: шесть измерений диаметра и обход шкалы натяжения.';
    },
  });

  render();
})();
