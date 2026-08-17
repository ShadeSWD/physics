/* Работа 1-18. Ускорение свободного падения математическим маятником.
 * Модель: T = 2π√(L/g)(1 + θ₀²/16); измеряется время t полных N колебаний
 * с ошибкой реакции наблюдателя. По ряду g_i выполняется обработка по
 * методике практикума. */
'use strict';
(function () {
  const svg = $('vp');
  if (!svg || !window.VL) return;

  const G_SPB = 9.8191;    // истинное значение, заложенное в модель (широта СПб)
  const D_L = 0.001;       // приборная погрешность шкалы штанги, м
  /* режимы отсчёта времени: цена деления, СКО случайной ошибки момента
   * пуска/останова, приборная погрешность */
  const MODE = {
    photo: { q: 0.001, sig: 0.012, instr: t => Math.max(2e-4 * t, 0.001) },
    hand: { q: 0.01, sig: 0.16, instr: () => 0.01 },
  };
  const X0 = 250, Y0 = 62, PX = 230, BASE = 238;   // подвес и масштаб (px на метр)

  let L = 0.50, A0 = 6, N = 10, md = 'photo';
  let phase = 0;
  let mode = 'idle', mEl = 0, mDur = 2.2, mTime = 0, mDone = null;
  const rows = [];

  /* период с поправкой на конечную амплитуду */
  function period(l, a0) {
    const th = a0 * Math.PI / 180;
    return 2 * Math.PI * Math.sqrt(l / G_SPB) * (1 + th * th / 16);
  }

  /* ---------- геометрия, зависящая от длины ---------- */
  function layout() {
    const lpx = PX * L;
    const a = A0 * Math.PI / 180;
    const xa = lpx * Math.sin(a), ya = lpx * Math.cos(a);
    $('vpvert').setAttribute('y2', (Y0 + lpx + 26).toFixed(1));
    $('vparc').setAttribute('d',
      `M ${(X0 - xa).toFixed(1)} ${(Y0 + ya).toFixed(1)} A ${lpx.toFixed(1)} ${lpx.toFixed(1)} 0 0 0 ` +
      `${(X0 + xa).toFixed(1)} ${(Y0 + ya).toFixed(1)}`);
    $('vpang').textContent = 'θ₀ = ' + VL.fm(A0, 0) + '°';
    $('vpd1').setAttribute('y1', Y0); $('vpd1').setAttribute('y2', Y0);
    $('vpd2').setAttribute('y1', (Y0 + lpx).toFixed(1));
    $('vpd2').setAttribute('y2', (Y0 + lpx).toFixed(1));
    $('vpdim').setAttribute('y1', Y0);
    $('vpdim').setAttribute('y2', (Y0 + lpx).toFixed(1));
    $('vpdimt').setAttribute('y', (Y0 + lpx / 2 + 4).toFixed(1));
    $('vpdimt').textContent = 'L = ' + VL.fm(L, 2) + ' м';
    $('vpsens').setAttribute('transform', 'translate(0,' + (lpx - BASE).toFixed(1) + ')');
    $('vpcnt').textContent = 'колебаний: 0 из ' + N;
  }

  /* ---------- главный цикл ---------- */
  VL.loop(function (dt) {
    const T = period(L, A0);
    if (mode === 'run') {
      mEl += dt;
      const k = Math.min(1, mEl / mDur);
      phase = 2 * Math.PI * N * k;
      $('vptime').textContent = VL.fm(k * mTime, 2) + ' с';
      $('vpcnt').textContent = 'колебаний: ' + Math.min(N, Math.floor(k * N)) + ' из ' + N;
      $('vpst').textContent = 'идёт отсчёт, перемотка ×' + Math.round(N * T / mDur);
      if (k >= 1) {
        mode = 'idle';
        $('vpst').textContent = 'секундомер остановлен';
        addRow();
        if (mDone) { const f = mDone; mDone = null; f(); }
      }
    } else {
      phase += 2 * Math.PI * dt / T;
    }
    const th = (A0 * Math.PI / 180) * Math.sin(phase);
    const lpx = PX * L;
    const bx = X0 + lpx * Math.sin(th), by = Y0 + lpx * Math.cos(th);
    $('vpstr').setAttribute('x2', bx.toFixed(1));
    $('vpstr').setAttribute('y2', by.toFixed(1));
    $('vpbob').setAttribute('cx', bx.toFixed(1));
    $('vpbob').setAttribute('cy', by.toFixed(1));
    /* сектор текущего угла */
    const rr = 46;
    $('vpsc').setAttribute('d',
      `M ${X0} ${Y0 + rr} A ${rr} ${rr} 0 0 ${th < 0 ? 1 : 0} ` +
      `${(X0 + rr * Math.sin(th)).toFixed(1)} ${(Y0 + rr * Math.cos(th)).toFixed(1)}`);
    $('vpled').setAttribute('fill',
      md === 'photo' && Math.abs(th) < 0.15 * A0 * Math.PI / 180 ? '#1a7f37' : '#6b6b74');
  });

  /* ---------- измерение ---------- */
  function measure() {
    if (mode !== 'idle') return Promise.resolve();
    const m = MODE[md];
    mTime = N * period(L, A0) + VL.gauss(m.sig);
    mTime = Math.round(mTime / m.q) * m.q;      /* цена деления прибора */
    mEl = 0; mode = 'run'; phase = 0;
    return new Promise(r => { mDone = r; });
  }

  function addRow() {
    const t = mTime;
    rows.push({ L, N, t, md, T: t / N, g: 4 * Math.PI * Math.PI * L * N * N / (t * t) });
    render();
  }

  /* ---------- обработка и вывод ---------- */
  function render() {
    const out = $('vpout');
    if (!rows.length) {
      out.innerHTML = '';
      $('vphint').textContent = 'Журнал пуст. Задайте длину и нажмите «снять отсчёт»; ' +
        'для обработки нужно не меньше трёх измерений, по методике практикума — пять-семь.';
      return;
    }
    let h = '<h3>Журнал измерений</h3><table class="el"><tr><th class="num">№</th>' +
      '<th class="num">L, м</th><th class="num">N</th><th class="num">t, с</th>' +
      '<th class="num">T = t/N, с</th><th class="num">g = 4π²LN²/t², м/с²</th></tr>';
    rows.forEach((r, i) => {
      h += `<tr><td class="num">${i + 1}</td><td class="num">${VL.fm(r.L, 2)}</td>` +
        `<td class="num">${r.N}</td><td class="num">${VL.fm(r.t, 2)}</td>` +
        `<td class="num">${VL.fm(r.T, 3)}</td><td class="num"><b>${VL.fm(r.g, 3)}</b></td></tr>`;
    });
    h += '</table>';

    if (rows.length < 3) {
      h += '<p class="small">Для статистической обработки нужно не меньше трёх ' +
        'отсчётов: при \\(n=2\\) коэффициент Стьюдента равен 12,7 и доверительный ' +
        'интервал становится бессмысленно широким.</p>';
      out.innerHTML = h;
      VL.mathify(out);
      $('vphint').textContent = 'Снято отсчётов: ' + rows.length + '. Нужно ещё ' + (3 - rows.length) + '.';
      return;
    }

    /* приборная составляющая: логарифмическое дифференцирование рабочей формулы */
    const gm = rows.reduce((s, r) => s + r.g, 0) / rows.length;
    const Lm = rows.reduce((s, r) => s + r.L, 0) / rows.length;
    const tm = rows.reduce((s, r) => s + r.t, 0) / rows.length;
    const dt = MODE[rows[rows.length - 1].md].instr(tm);
    const instr = gm * Math.sqrt(Math.pow(D_L / Lm, 2) + Math.pow(2 * dt / tm, 2));

    h += '<h3>Обработка ряда \\(g_i\\)</h3>';
    const pr = VL.processHtml({
      xs: rows.map(r => r.g), instr, sym: 'g', unit: 'м/с²', dec: 3,
      trueVal: G_SPB, trueName: 'табличным значением для широты Санкт-Петербурга (9,819 м/с²)',
    });
    h += pr.html;

    /* предупреждение о систематике большой амплитуды */
    const amax = Math.max.apply(null, rows.map(() => A0));
    if (amax >= 11) {
      h += '<div class="note tip"><b>Обратите внимание на амплитуду.</b> При ' +
        `\\(\\theta_0 = ${amax}°\\) период больше «малоколебательного» на ` +
        `\\(\\theta_0^2/16 = ${VL.fm(Math.pow(amax * Math.PI / 180, 2) / 16 * 100, 2)}\\,\\%\\), ` +
        'а значит, \\(g\\) занижается вдвое сильнее. Это систематическая ошибка: ' +
        'сколько отсчётов ни делай, она не уйдёт. Повторите серию при амплитуде 5–6°.</div>';
    }

    /* график T²(L), если длины менялись */
    const Ls = rows.map(r => r.L);
    if (Math.max.apply(null, Ls) - Math.min.apply(null, Ls) > 0.1) {
      h += '<h3>Проверка линейности \\(T^2(L)\\)</h3>' +
        '<div id="vpchart"></div>' +
        '<p class="small">Зависимость квадрата периода от длины должна быть прямой, ' +
        'проходящей через начало координат, с угловым коэффициентом \\(k=4\\pi^2/g\\). ' +
        'Наклон прямой даёт независимую оценку \\(g=4\\pi^2/k\\), не требующую ' +
        'знания нуля шкалы длины.</p>';
    }
    out.innerHTML = h;

    if ($('vpchart')) drawChart();
    VL.mathify(out);
    $('vphint').textContent = 'Снято отсчётов: ' + rows.length +
      '. Результат пересчитывается после каждого нового отсчёта.';
  }

  function drawChart() {
    const pts = rows.map(r => [r.L, r.T * r.T]);
    const { k, b } = VL.fit(pts);
    const gk = 4 * Math.PI * Math.PI / k;

    const chart = VL.chart('vpchart', '0 0 640 300');
    const ax = VL.axes(chart, {
      x0: 66, y0: 250, x1: 596, y1: 40, xmin: 0, xmax: 1.2, ymin: 0, ymax: 5,
      xticks: [0.2, 0.4, 0.6, 0.8, 1.0, 1.2].map(v => ({ v, label: VL.fm(v, 1) })),
      yticks: [1, 2, 3, 4, 5].map(v => ({ v, label: String(v) })),
      xlab: 'L, м', ylab: 'T², с²',
    });
    VL.series(chart, [[ax.X(0), ax.Y(b)], [ax.X(1.2), ax.Y(k * 1.2 + b)]], '#6b6b74',
      null, { dash: '6 5', width: 1.4, noPoints: true });
    VL.series(chart, pts.map(p => [ax.X(p[0]), ax.Y(p[1])]), '#155e75',
      pts.map(p => `L = ${VL.fm(p[0], 2)} м, T² = ${VL.fm(p[1], 3)} с²`), { nolines: true });
    VL.label(chart, 300, 70, '#1a7f37',
      'наклон k = ' + VL.fm(k, 3) + ' с²/м → g = 4π²/k = ' + VL.fm(gk, 2) + ' м/с²');
    VL.label(chart, 300, 86, '#6b6b74', 'отсечка b = ' + VL.fm(b, 3) + ' с² (в идеале ноль)');
  }

  /* ---------- органы управления ---------- */
  VL.slider('vpL', 'vpLv', v => VL.fm(v, 2) + ' м', v => { L = v; layout(); });
  $('vpmode').addEventListener('change', function () {
    md = this.value;
    $('vpmt').textContent = md === 'photo'
      ? 'фотодатчик считает проходы шарика' : 'пуск и останов — вручную,';
    $('vpmt2').textContent = md === 'photo'
      ? 'через положение равновесия' : 'с реакцией наблюдателя ≈ 0,2 с';
  });
  VL.slider('vpA', 'vpAv', v => VL.fm(v, 0) + '°', v => { A0 = v; layout(); });
  VL.slider('vpN', 'vpNv', v => String(v), v => { N = v; layout(); });
  layout();

  $('vpsnap').addEventListener('click', () => { measure(); });
  $('vpreset').addEventListener('click', () => {
    rows.length = 0; render();
  });

  VL.auto({
    autoBtn: 'vpauto', stopBtn: 'vpstop',
    lockIds: ['vpsnap', 'vpreset', 'vpL', 'vpA', 'vpN', 'vpmode'],
    total: () => 6,
    progress: (i, n) => {
      const p = $('vpprog'); p.style.display = ''; p.textContent = `измерение ${i} из ${n}`;
    },
    step: async (i, ctl) => {
      if (i === 0) { rows.length = 0; render(); }
      const lens = [0.40, 0.55, 0.70, 0.85, 1.00, 1.10];
      const s = $('vpL'); s.value = lens[i]; s.dispatchEvent(new Event('input'));
      await ctl.sleep(350);
      if (ctl.aborted()) return;
      await measure();
    },
    onFinish: (aborted, done, n) => {
      $('vpprog').style.display = 'none';
      $('vphint').textContent = aborted
        ? `Прогон остановлен: снято ${done} из ${n} измерений.`
        : 'Серия из шести измерений при разных длинах снята — ниже обработка и график T²(L).';
    },
  });

  render();
})();
