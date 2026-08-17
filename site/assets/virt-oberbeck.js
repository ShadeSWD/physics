/* Работа 1-16. Законы вращательного движения (маятник Обербека).
 * Модель: Iε = M − M_тр, a = εr, h = at²/2; I(R) = 4m₂ℓ²/3 + 4m₁R².
 * Измеряется время падения груза; по ряду I_i выполняется обработка,
 * по точкам ε(M) строится прямая, наклон которой даёт I без вклада трения. */
'use strict';
(function () {
  const svg = $('vo');
  if (!svg || !window.VL) return;

  const M1 = 0.193;            // масса груза на стержне, кг
  const M2 = 0.05181;          // масса стержня, кг
  const ELL = 0.22;            // длина стержня, м
  const DSH = 0.0836;          // диаметр шкива, м
  const R_SH = DSH / 2;
  const M_FR = 8e-4;           // момент сил трения в оси, Н·м
  const D_H = 0.001;           // приборная погрешность шкалы пути, м
  const D_D = 0.0005;          // приборная погрешность штангенциркуля, м
  const SIG = 0.008;           // относительное СКО времени (намотка, старт)
  const QT = 0.001;            // цена деления миллисекундомера, с
  const CX = 185, CY = 200, S = 400;   // ось крестовины и масштаб, px на метр
  const Y_TOP = 100, LX = 345;         // старт груза и путь нити

  let R = 0.18, mL = 0.057, h = 0.40;
  let ang = 0, tPulse = 0;
  let mode = 'idle', mEl = 0, mDur = 2.2, mTime = 0, mDone = null, mProg = 0;
  const rows = [];

  const Ith = R2 => 4 * M2 * ELL * ELL / 3 + 4 * M1 * R2 * R2;
  /* линейное ускорение груза с учётом трения */
  function accel(R2, m) {
    const I = Ith(R2);
    return (m * G - M_FR / R_SH) / (m + I / (R_SH * R_SH));
  }

  /* ---------- статическая разметка ---------- */
  {
    const g = $('voscale');
    for (let i = 0; i <= 6; i++) {
      const y = Y_TOP + i * 40;
      VL.el('line', { x1: 172, y1: y, x2: 180, y2: y, stroke: '#6b6b74', 'stroke-width': 1 }, g);
      if (i % 2 === 0) {
        const t = VL.el('text', { x: 168, y: y + 4, 'text-anchor': 'end' }, g);
        t.textContent = VL.fm(i * 0.1, 1);
      }
    }
    VL.label(g, 120, 84, '#6b6b74', 'шкала, м');
    for (let i = 0; i < 4; i++) VL.el('line', {}, $('vorods'));
    for (let i = 0; i < 4; i++) {
      const w = VL.el('rect', {
        width: 15, height: 11, rx: 2, fill: '#fff', stroke: '#16161a', 'stroke-width': 1.4,
      }, $('voweights'));
      w.setAttribute('x', 0); w.setAttribute('y', 0);
    }
  }

  /* ---------- перерисовка, зависящая от параметров ---------- */
  function layout() {
    const yb = Y_TOP + h * S;
    $('vobot').setAttribute('transform', 'translate(0,' + (yb - 260).toFixed(1) + ')');
    $('vohdim').setAttribute('y2', yb.toFixed(1));
    $('voht').setAttribute('y', (Y_TOP + (yb - Y_TOP) / 2 + 4).toFixed(1));
    $('voht').textContent = 'h = ' + VL.fm(h, 2) + ' м';
    $('volm').textContent = VL.fm(mL * 1000, 0) + ' г';
    $('vorlab').textContent = 'R = ' + VL.fm(R, 3) + ' м — грузы от оси';
    $('voi').textContent = 'I расчётное = ' + VL.fm(Ith(R), 4) + ' кг·м²';
  }

  function drawCross() {
    const rods = $('vorods').children, ws = $('voweights').children;
    const rpx = R * S, lpx = ELL * S;
    for (let i = 0; i < 4; i++) {
      const a = ang + i * Math.PI / 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      rods[i].setAttribute('x1', CX); rods[i].setAttribute('y1', CY);
      rods[i].setAttribute('x2', (CX + lpx * ca).toFixed(1));
      rods[i].setAttribute('y2', (CY + lpx * sa).toFixed(1));
      ws[i].setAttribute('x', (CX + rpx * ca - 7.5).toFixed(1));
      ws[i].setAttribute('y', (CY + rpx * sa - 5.5).toFixed(1));
      ws[i].setAttribute('transform',
        `rotate(${(a * 180 / Math.PI).toFixed(1)} ${(CX + rpx * ca).toFixed(1)} ${(CY + rpx * sa).toFixed(1)})`);
    }
  }

  function drawLoad(s) {           /* s — пройденный путь, м */
    const y = Y_TOP + s * S;
    $('voload').setAttribute('transform', 'translate(0,' + (s * S).toFixed(1) + ')');
    $('vothr').setAttribute('d',
      `M 202 200 L 202 56 L 331 56 A 14 14 0 0 1 345 70 L 345 ${y.toFixed(1)}`);
  }

  /* ---------- главный цикл ---------- */
  VL.loop(function (dt) {
    tPulse += dt;
    if (mode === 'run') {
      mEl += dt;
      const k = Math.min(1, mEl / mDur);
      const s = h * k * k;                       /* путь при равноускоренном движении */
      ang = s / R_SH;
      drawLoad(s);
      $('vot').textContent = VL.fm(k * mTime, 3) + ' с';
      $('vost').textContent = 'опыт идёт, ×' + Math.max(1, Math.round(mTime / mDur));
      $('voled').setAttribute('fill', '#b3382e');
      if (k >= 1) {
        mode = 'back'; mEl = 0;
        $('vost').textContent = 'время снято, груз наверх';
        addRow();
      }
    } else if (mode === 'back') {
      mEl += dt;
      const k = Math.min(1, mEl / 0.8);
      const s = h * (1 - k);
      ang -= dt * 3;
      drawLoad(s);
      $('voled').setAttribute('fill', '#6b6b74');
      if (k >= 1) {
        mode = 'idle';
        $('vost').textContent = 'тормоз включён, готов';
        if (mDone) { const f = mDone; mDone = null; f(); }
      }
    } else {
      drawLoad(0);
      $('voled').setAttribute('opacity', (0.45 + 0.55 * Math.abs(Math.sin(tPulse * 2))).toFixed(3));
      $('voled').setAttribute('fill', '#1a7f37');
    }
    drawCross();
  });

  /* ---------- измерение ---------- */
  function measure() {
    if (mode !== 'idle') return Promise.resolve();
    const a = accel(R, mL);
    let t = Math.sqrt(2 * h / a) * (1 + VL.gauss(SIG));
    mTime = Math.round(t / QT) * QT;
    mEl = 0; mode = 'run';
    $('voled').setAttribute('opacity', 1);
    return new Promise(r => { mDone = r; });
  }

  function addRow() {
    const t = mTime;
    const a = 2 * h / (t * t);
    const eps = a / R_SH;
    const M = mL * (G - a) * R_SH;
    const I = mL * R_SH * R_SH * (G * t * t / (2 * h) - 1);
    rows.push({ R, m: mL, h, t, a, eps, M, I });
    render();
  }

  /* ---------- обработка ---------- */
  function render() {
    const out = $('voout');
    if (!rows.length) {
      out.innerHTML = '';
      $('vohint').textContent = 'Журнал пуст. Снимите отсчёты при разных массах ' +
        'падающего груза, не трогая положение грузов на стержнях.';
      return;
    }
    let html = '<h3>Журнал измерений</h3><table class="el"><tr><th class="num">№</th>' +
      '<th class="num">R, м</th><th class="num">m, г</th><th class="num">h, м</th>' +
      '<th class="num">t, с</th><th class="num">a, м/с²</th><th class="num">ε, с⁻²</th>' +
      '<th class="num">M, Н·м</th><th class="num">I, кг·м²</th></tr>';
    rows.forEach((r, i) => {
      html += `<tr><td class="num">${i + 1}</td><td class="num">${VL.fm(r.R, 3)}</td>` +
        `<td class="num">${VL.fm(r.m * 1000, 0)}</td><td class="num">${VL.fm(r.h, 2)}</td>` +
        `<td class="num">${VL.fm(r.t, 3)}</td><td class="num">${VL.fm(r.a, 4)}</td>` +
        `<td class="num">${VL.fm(r.eps, 3)}</td><td class="num">${VL.fm(r.M, 5)}</td>` +
        `<td class="num"><b>${VL.fm(r.I, 4)}</b></td></tr>`;
    });
    html += '</table>';

    /* самая многочисленная группа с одинаковым R */
    const byR = {};
    rows.forEach(r => { (byR[r.R.toFixed(3)] = byR[r.R.toFixed(3)] || []).push(r); });
    let grp = [], key = '';
    Object.keys(byR).forEach(k => { if (byR[k].length > grp.length) { grp = byR[k]; key = k; } });
    const Rg = parseFloat(key);

    if (grp.length < 3) {
      html += '<p class="small">Для обработки нужно не меньше трёх отсчётов при ' +
        'одном и том же положении грузов на стержнях: момент инерции при разных ' +
        '\\(R\\) разный, и усреднять такие значения нельзя.</p>';
      out.innerHTML = html; VL.mathify(out);
      $('vohint').textContent = 'Снято отсчётов: ' + rows.length +
        '; при R = ' + VL.fm(Rg, 3) + ' м — ' + grp.length + '.';
      return;
    }

    const Ig = Ith(Rg);
    const tm = grp.reduce((s, r) => s + r.t, 0) / grp.length;
    const hm = grp.reduce((s, r) => s + r.h, 0) / grp.length;
    const Im = grp.reduce((s, r) => s + r.I, 0) / grp.length;
    const dt = Math.max(2e-4 * tm, QT);
    const instr = Im * Math.sqrt(Math.pow(2 * D_D / DSH, 2) + Math.pow(2 * dt / tm, 2)
      + Math.pow(D_H / hm, 2));

    html += `<h3>Обработка ряда \\(I_i\\) при \\(R = ${VL.lm(Rg, 3)}\\) м</h3>`;
    const pr = VL.processHtml({
      xs: grp.map(r => r.I), instr, sym: 'I', unit: 'кг·м²', dec: 4,
      trueVal: Ig, trueName: 'расчётным значением \\(I_{\\text{т}}\\)',
    });
    html += pr.html;
    html += '<div class="note tip"><b>Небольшое превышение над расчётным значением ' +
      'здесь закономерно.</b> Рабочая формула ничего не знает о трении в оси и ' +
      'блоке: часть движущего момента уходит на его преодоление, крестовина ' +
      'раскручивается медленнее, и формула списывает это на «лишний» момент ' +
      'инерции. Признак именно этой причины — превышение тем больше, чем легче ' +
      'падающий груз. Оценить трение и получить несмещённое \\(I\\) позволяет ' +
      'график \\(\\varepsilon(M)\\) ниже.</div>';
    html += '<div class="panel steps">' +
      VL.step('\\(I_{\\text{т}} = \\dfrac{4m_2\\ell^2}{3} + 4m_1R^2\\)',
        `\\(\\dfrac{4\\cdot 0{,}05181\\cdot ${VL.lm(ELL, 2)}^2}{3} + 4\\cdot 0{,}193\\cdot ${VL.lm(Rg, 3)}^2\\)`,
        `\\(${VL.lm(Ig, 4)}\\) кг·м²`) + '</div>';

    /* график ε(M) */
    if (grp.length >= 3) {
      const ms = grp.map(r => r.m);
      if (Math.max.apply(null, ms) - Math.min.apply(null, ms) > 1e-6) {
        html += '<h3>Проверка линейности \\(\\varepsilon(M)\\)</h3><div id="vochart"></div>';
      }
    }
    out.innerHTML = html;
    if ($('vochart')) drawChart(grp, Ig);
    VL.mathify(out);
    $('vohint').textContent = 'Снято отсчётов: ' + rows.length + '; в обработку вошли ' +
      grp.length + ' при R = ' + VL.fm(Rg, 3) + ' м.';
  }

  function drawChart(grp, Ig) {
    const pts = grp.map(r => [r.M, r.eps]);
    const { k, b } = VL.fit(pts);
    const Ik = 1 / k;
    const Mfr = -b / k;

    const mmax = Math.max.apply(null, pts.map(p => p[0])) * 1.15;
    const emax = Math.max.apply(null, pts.map(p => p[1])) * 1.15;
    const chart = VL.chart('vochart', '0 0 640 300');
    const ax = VL.axes(chart, {
      x0: 74, y0: 250, x1: 596, y1: 40, xmin: 0, xmax: mmax, ymin: 0, ymax: emax,
      xticks: VL.ticks(0, mmax, 5).map(v => ({ v, label: VL.fm(v * 1000, 0) })),
      yticks: VL.ticks(0, emax, 4).map(v => ({ v, label: VL.fm(v, 1) })),
      xlab: 'M, мН·м', ylab: 'ε, с⁻²',
    });
    VL.series(chart, [[ax.X(0), ax.Y(b)], [ax.X(mmax), ax.Y(k * mmax + b)]], '#6b6b74',
      null, { dash: '6 5', width: 1.4, noPoints: true });
    VL.series(chart, pts.map(p => [ax.X(p[0]), ax.Y(p[1])]), '#155e75',
      pts.map(p => `M = ${VL.fm(p[0] * 1000, 2)} мН·м, ε = ${VL.fm(p[1], 2)} с⁻²`), { nolines: true });
    VL.label(chart, 190, 70, '#1a7f37',
      'наклон 1/I = ' + VL.fm(k, 1) + ' → I = ' + VL.fm(Ik, 4) + ' кг·м²');
    VL.label(chart, 190, 86, '#b3382e', Mfr > 0
      ? 'отсечка по моменту M_тр = ' + VL.fm(Mfr * 1000, 2) + ' мН·м (оценка грубая)'
      : 'отсечка вышла отрицательной: трение по этим точкам не разрешается');
    VL.label(chart, 190, 102, '#6b6b74', 'расчётное I = ' + VL.fm(Ig, 4) + ' кг·м²');

    const p = document.createElement('p');
    p.className = 'small';
    p.innerHTML = 'Прямая \\(\\varepsilon=(M-M_{\\text{тр}})/I\\) не проходит через ' +
      'начало координат: пока момент силы не превысит момент трения, крестовина ' +
      'не тронется. Момент инерции по наклону — <b>' + VL.fm(Ik, 4) + '</b> кг·м², ' +
      'расчётное — ' + VL.fm(Ig, 4) + ' кг·м², среднее по столбцу \\(I_i\\) — ' +
      VL.fm(rows.reduce((s2, r) => s2 + r.I, 0) / rows.length, 4) + ' кг·м². ' +
      'Два способа дополняют друг друга: столбец \\(I_i\\) даёт узкий, но ' +
      'смещённый трением интервал, а наклон от трения не зависит (оно ушло в ' +
      'свободный член), зато сам определяется по нескольким точкам и потому ' +
      'имеет бо́льшую случайную погрешность — особенно свободный член, который ' +
      'получается далёкой экстраполяцией к нулю.';
    $('vochart').appendChild(p);
  }

  /* ---------- органы управления ---------- */
  VL.slider('voR', 'voRv', v => VL.fm(v, 3) + ' м', v => { R = v; layout(); });
  VL.slider('voM', 'voMv', v => VL.fm(v, 0) + ' г', v => { mL = v / 1000; layout(); });
  VL.slider('voH', 'voHv', v => VL.fm(v, 2) + ' м', v => { h = v; layout(); });
  layout();

  $('vosnap').addEventListener('click', () => { measure(); });
  $('voreset').addEventListener('click', () => { rows.length = 0; render(); });

  VL.auto({
    autoBtn: 'voauto', stopBtn: 'vostop',
    lockIds: ['vosnap', 'voreset', 'voR', 'voM', 'voH'],
    total: () => 6,
    progress: (i, n) => {
      const p = $('voprog'); p.style.display = ''; p.textContent = `опыт ${i} из ${n}`;
    },
    step: async (i, ctl) => {
      if (i === 0) { rows.length = 0; render(); }
      const ms = [57, 77, 97, 117, 137, 157];
      const s = $('voM'); s.value = ms[i]; s.dispatchEvent(new Event('input'));
      await ctl.sleep(300);
      if (ctl.aborted()) return;
      await measure();
    },
    onFinish: (aborted, done, n) => {
      $('voprog').style.display = 'none';
      $('vohint').textContent = aborted
        ? `Прогон остановлен: снято ${done} из ${n} опытов.`
        : 'Серия из шести опытов с разными массами снята — ниже обработка и график ε(M).';
    },
  });

  render();
})();
