/* Работа «Отношение теплоёмкостей Cp/Cv методом Клемана — Дезорма».
 *
 * Модель баллона с воздухом:
 *   1) накачка до избыточного давления h₁ (мм вод. ст.) и выдержка до
 *      комнатной температуры — состояние 1 (p₁ = p_a + ρg h₁, T₀);
 *   2) кран открыт время τ: давление стравливается к атмосферному по закону
 *      p(τ) = p_a + ρg h₁ e^{−τ/τ_p}, оставшийся газ при этом расширяется
 *      адиабатически и охлаждается, T_ад/T₀ = (p/p₁)^{(γ−1)/γ};
 *      одновременно через стенки натекает тепло с постоянной времени τ_T,
 *      и доля f = 1 − e^{−τ/τ_T} охлаждения успевает «рассосаться» — это и
 *      есть главная систематическая ошибка работы;
 *   3) кран закрыт, изохорный нагрев до T₀: p₂ = p(τ)·T₀/T_откр, отсчёт h₂.
 * Рабочая формула: γ = h₁/(h₁ − h₂).
 *
 * «Истина» модели — γ = 1,40 (воздух, i = 5, PHYS.heatCap(5).gamma). При
 * правильной работе (кран закрывают в момент выравнивания уровней) модель
 * даёт 1,40; при затянутом открытии крана γ систематически занижается. */
'use strict';
(function () {
  const svg = $('vh');
  if (!svg || !window.VL || !window.METRO) return;

  const PH = window.PHYS;
  const GAMMA = PH ? PH.heatCap(5).gamma : 1.4;      // истинное значение модели
  const P_A = PH ? PH.C.patm : 101325;               // Па
  const RHO_G = (PH ? PH.C.rhoFresh * PH.C.g : 1000 * 9.81) / 1000;  // Па на 1 мм вод. ст.
  const R_GAS = PH ? PH.C.R : 8.314;
  const T_ROOM = 293;                                // К

  const TAU_P = 0.35;      // постоянная времени истечения через кран, с
  const TAU_T = 70;        // постоянная времени теплообмена со стенками, с
  const SIG_H = 1.2;       // СКО отсчёта уровня по мениску, мм
  const D_H = 1.0;         // приборная погрешность отсчёта разности уровней, мм
  const SIG_PUMP = 6;      // разброс накачки грушей, мм

  /* установившееся избыточное давление после цикла, мм вод. ст. */
  function h2of(h1, tau) {
    const p1 = P_A + RHO_G * h1;
    const p = P_A + RHO_G * h1 * Math.exp(-tau / TAU_P);
    const tad = Math.pow(p / p1, (GAMMA - 1) / GAMMA);     // T_ад/T₀
    const f = 1 - Math.exp(-tau / TAU_T);                  // доля натёкшего тепла
    const top = tad + (1 - tad) * f;                       // T_откр/T₀
    return { h2: (p / top - P_A) / RHO_G, tRel: top };
  }

  /* ---------- состояние установки ---------- */
  let hTarget = 200, tau = 1.5;
  let h1 = 0, h2 = 0, hCur = 0, hRead1 = 0, hRead2 = 0;
  let dT = 0;                    // насколько газ холоднее комнаты, К
  let st = 'atm', pel = 0, vel = 0, fast = false;
  const rows = [];

  /* ---------- геометрия манометра ---------- */
  const Y0 = 244, K = 0.36, BOT = 320;

  /* шкала разности уровней */
  {
    const g = $('vhscale');
    for (let v = 0; v <= 320; v += 20) {
      const y = Y0 - v * K / 2;
      VL.el('line', {
        x1: 522, y1: y.toFixed(1), x2: v % 100 ? 528 : 534, y2: y.toFixed(1),
        stroke: '#6b6b74', 'stroke-width': 1,
      }, g);
      if (v % 100 === 0) {
        const t = VL.el('text', { x: 538, y: (y + 4).toFixed(1) }, g);
        t.textContent = String(v);
      }
    }
  }

  /* ---------- анимация ---------- */
  VL.loop(function (dt2) {
    if (st === 'pump') {
      pel += dt2;
      const dur = fast ? 0.35 : 1.1;
      const k = Math.min(1, pel / dur);
      hCur = h1 * 1.08 * k;
      dT = -3.2 * k;                       /* газ нагрелся при сжатии */
      if (k >= 1) st = 'settle1';
    } else if (st === 'settle1') {
      hCur += (h1 - hCur) * (1 - Math.exp(-dt2 / 2.2));
      dT += (0 - dT) * (1 - Math.exp(-dt2 / 2.2));
      if (Math.abs(hCur - h1) < 0.4) finishSettle();
    } else if (st === 'vent') {
      vel += dt2 * (fast ? 6 : (tau > 4 ? 3 : 1));
      const s = Math.min(vel, tau);
      hCur = h1 * Math.exp(-s / TAU_P);
      const p = P_A + RHO_G * hCur;
      const tad = Math.pow(p / (P_A + RHO_G * h1), (GAMMA - 1) / GAMMA);
      const f = 1 - Math.exp(-s / TAU_T);
      dT = (1 - (tad + (1 - tad) * f)) * T_ROOM;
      if (vel >= tau) {
        h2 = h2of(h1, tau).h2;
        st = 'settle2';
      }
    } else if (st === 'settle2') {
      hCur += (h2 - hCur) * (1 - Math.exp(-dt2 / 2.2));
      dT += (0 - dT) * (1 - Math.exp(-dt2 / 2.2));
      if (Math.abs(hCur - h2) < 0.4) finishSettle();
    }
    draw();
  });

  function draw() {
    const half = hCur * K / 2;
    const yL = Y0 + half, yR = Y0 - half;
    $('vhwL').setAttribute('y', yL.toFixed(1));
    $('vhwL').setAttribute('height', Math.max(0, BOT - yL).toFixed(1));
    $('vhwR').setAttribute('y', yR.toFixed(1));
    $('vhwR').setAttribute('height', Math.max(0, BOT - yR).toFixed(1));
    $('vhmen').setAttribute('y1', yR.toFixed(1));
    $('vhmen').setAttribute('y2', yR.toFixed(1));

    const open = st === 'vent';
    $('vhhandle').setAttribute('transform', 'rotate(' + (open ? 90 : 0) + ' 330 78)');
    $('vhjet').setAttribute('opacity', open ? 1 : 0);

    const shown = st === 'ready1' ? hRead1 : st === 'ready2' ? hRead2 : hCur;
    $('vhread').textContent = 'отсчёт h = ' + VL.fm(shown, 0) + ' мм вод. ст.';
    $('vhtemp').textContent = Math.abs(dT) < 0.05 ? 'газ: температура комнатная'
      : dT > 0 ? 'газ холоднее комнаты на ' + VL.fm(dT, 2) + ' К'
        : 'газ теплее комнаты на ' + VL.fm(-dT, 2) + ' К';
    $('vhvalvest').textContent = open
      ? 'кран открыт: ' + VL.fm(Math.min(vel, tau), 1) + ' с' : 'кран закрыт';
    $('vhstate').textContent = ({
      atm: 'баллон сообщён с атмосферой — можно накачивать',
      pump: 'идёт накачка грушей',
      settle1: 'сжатый газ остывает до комнатной температуры — «ждать выравнивания»',
      ready1: 'состояние 1: отсчёт h₁ снят, можно открывать кран',
      vent: 'адиабатное расширение: газ выходит и охлаждается',
      settle2: 'изохорный нагрев до комнатной температуры — «ждать выравнивания»',
      ready2: 'состояние 3: отсчёт h₂ снят, запишите опыт в журнал',
    })[st] || '';
  }

  /* ---------- действия ---------- */
  function startPump() {
    if (st !== 'atm') return;
    h1 = VL.clamp(hTarget + VL.gauss(SIG_PUMP), 60, 330);
    pel = 0; st = 'pump'; syncBtns();
  }
  function finishSettle() {
    if (st === 'settle1') {
      hCur = h1; dT = 0;
      hRead1 = Math.round(h1 + VL.gauss(SIG_H));
      st = 'ready1';
    } else if (st === 'settle2') {
      hCur = h2; dT = 0;
      hRead2 = Math.round(h2 + VL.gauss(SIG_H));
      st = 'ready2';
    } else return;
    syncBtns();
  }
  function openValve() {
    if (st !== 'ready1') return;
    vel = 0; st = 'vent'; syncBtns();
  }
  function snap() {
    if (st !== 'ready2') return;
    if (hRead1 - hRead2 < 1) hRead2 = hRead1 - 1;      /* защита от деления на ноль */
    rows.push({ tau: tau, h1: hRead1, h2: hRead2, g: hRead1 / (hRead1 - hRead2) });
    st = 'atm'; hCur = 0; dT = 0;
    syncBtns(); render();
  }

  let AUTO = null;
  function syncBtns() {
    if (AUTO && AUTO.running()) return;      /* во время авто-опыта кнопки заперты */
    $('vhpump').disabled = st !== 'atm';
    $('vhwait').disabled = !(st === 'settle1' || st === 'settle2');
    $('vhopen').disabled = st !== 'ready1';
    $('vhsnap').disabled = st !== 'ready2';
  }

  /* ---------- обработка ---------- */
  function render() {
    const out = $('vhout');
    if (!rows.length) {
      out.innerHTML = '';
      $('vhhint').textContent = 'Журнал пуст. Накачайте баллон, дождитесь выравнивания ' +
        'температуры, откройте кран и снова дождитесь выравнивания — получится один опыт.';
      return;
    }
    let h = '<h3>Журнал измерений</h3><table class="el"><tr><th class="num">№</th>' +
      '<th class="num">τ, с</th><th class="num">h₁, мм</th><th class="num">h₂, мм</th>' +
      '<th class="num">h₁ − h₂, мм</th><th class="num">γ = h₁/(h₁−h₂)</th></tr>';
    rows.forEach(function (r, i) {
      h += `<tr><td class="num">${i + 1}</td><td class="num">${VL.fm(r.tau, 1)}</td>` +
        `<td class="num">${r.h1}</td><td class="num">${r.h2}</td>` +
        `<td class="num">${r.h1 - r.h2}</td><td class="num"><b>${VL.fm(r.g, 3)}</b></td></tr>`;
    });
    h += '</table>';

    if (rows.length < 3) {
      h += '<p class="small">Опытов пока ' + rows.length + ': для статистической ' +
        'обработки нужно не меньше трёх, по методике практикума — пять-семь.</p>';
      out.innerHTML = h; VL.mathify(out);
      $('vhhint').textContent = 'Опытов в журнале: ' + rows.length + '.';
      return;
    }

    const h1m = rows.reduce((s, r) => s + r.h1, 0) / rows.length;
    const h2m = rows.reduce((s, r) => s + r.h2, 0) / rows.length;
    const taum = rows.reduce((s, r) => s + r.tau, 0) / rows.length;
    const fG = v => v[0] / (v[0] - v[1]);
    const instr = METRO.indirect(fG, [h1m, h2m], [D_H, D_H]).d;

    h += '<h3>Обработка ряда \\(\\gamma\\)</h3>' +
      '<p class="small">Приборная составляющая одного опыта считается переносом ' +
      'погрешности отсчёта уровней: ' +
      '\\(\\Delta\\gamma_{\\text{приб}}=\\dfrac{\\Delta h\\sqrt{h_1^2+h_2^2}}{(h_1-h_2)^2}=' +
      `${VL.lm(instr, 4)}\\) при \\(\\Delta h = 1\\) мм.</p>`;
    const pr = VL.processHtml({
      xs: rows.map(r => r.g), instr: instr, sym: '\\gamma', unit: '', dec: 3,
      trueVal: GAMMA, trueName: 'табличным значением \\(\\gamma=1{,}40\\) для двухатомного газа',
    });
    h += pr.html;

    /* число степеней свободы и молярные теплоёмкости */
    const gm = pr.st.mean, dg = pr.st.d;
    const iDeg = 2 / (gm - 1), dIdeg = 2 * dg / ((gm - 1) * (gm - 1));
    const Cv = R_GAS / (gm - 1), Cp = gm * Cv;
    h += '<h3>Что отсюда следует</h3><div class="panel steps">' +
      VL.step('\\(i = \\dfrac{2}{\\gamma-1}\\)',
        `\\(2/(${VL.lm(gm, 3)}-1)\\)`, `\\(${VL.lm(iDeg, 2)}\\pm${VL.lm(dIdeg, 2)}\\)`) +
      VL.step('\\(C_V = \\dfrac{R}{\\gamma-1}\\)',
        `\\(8{,}314/(${VL.lm(gm, 3)}-1)\\)`, `\\(${VL.lm(Cv, 1)}\\) Дж/(моль·К)`) +
      VL.step('\\(C_p = \\gamma C_V = C_V + R\\)',
        `\\(${VL.lm(gm, 3)}\\cdot ${VL.lm(Cv, 1)}\\)`, `\\(${VL.lm(Cp, 1)}\\) Дж/(моль·К)`) +
      '</div><p class="small">Для воздуха (азот и кислород — двухатомные молекулы) ' +
      'классическая теория даёт \\(i=5\\): три поступательные и две вращательные ' +
      `степени свободы, \\(C_V=${VL.lm(PH ? PH.heatCap(5).Cv : 20.8, 1)}\\), ` +
      `\\(C_p=${VL.lm(PH ? PH.heatCap(5).Cp : 29.1, 1)}\\) Дж/(моль·К). ` +
      'Колебательная степень свободы при комнатной температуре «заморожена» — ' +
      'это чисто квантовый эффект, и опыт Клемана — Дезорма его подтверждает.</p>';

    /* предупреждение о систематике */
    if (taum > 2.5) {
      h += '<div class="note tip"><b>Кран держали открытым слишком долго.</b> ' +
        `Среднее время открытия \\(\\tau = ${VL.fm(taum, 1)}\\) с. За это время в баллон ` +
        'успевает натечь тепло, охлаждение частично «рассасывается», давление после ' +
        'закрытия крана поднимается меньше, чем должно, — \\(h_2\\) занижено, а вместе ' +
        'с ним занижено и \\(\\gamma\\). Это <b>систематическая</b> ошибка: сколько опытов ' +
        'ни делай, среднее сместится не к 1,40, а к своему смещённому значению, зато ' +
        'доверительный интервал будет исправно сужаться и вердикт станет «не согласуется». ' +
        'Повторите серию, закрывая кран сразу после выравнивания уровней (≈1,5 с).</div>';
    } else if (taum < 1.0) {
      h += '<div class="note tip"><b>Кран закрывали слишком рано.</b> ' +
        `При \\(\\tau = ${VL.fm(taum, 1)}\\) с давление не успевает упасть до атмосферного: ` +
        'в баллоне остаётся избыток, адиабата обрывается на полпути, \\(h_2\\) завышено — ' +
        'и \\(\\gamma\\) получается сильно завышенным. Закрывайте кран в тот момент, когда ' +
        'уровни в манометре сравняются.</div>';
    }

    /* график γ(τ), если время открытия крана менялось */
    const set = {};
    rows.forEach(r => { set[r.tau.toFixed(1)] = 1; });
    if (Object.keys(set).length >= 3) {
      h += '<h3>Систематическая ошибка своими глазами</h3><div id="vhchart"></div>' +
        '<p class="small">Каждая точка — отдельный опыт. Случайный разброс точек мал ' +
        'по сравнению с тем, как «уезжает» результат при увеличении времени открытия ' +
        'крана: это и есть разница между случайной и систематической погрешностью. ' +
        'Правильное значение получается только у левого края — там, где кран закрывают ' +
        'сразу после выравнивания уровней.</p>';
    }

    out.innerHTML = h;
    if ($('vhchart')) drawChart();
    VL.mathify(out);
    $('vhhint').textContent = 'Опытов в журнале: ' + rows.length +
      '; среднее время открытия крана ' + VL.fm(taum, 1) + ' с.';
  }

  function drawChart() {
    const gs = rows.map(r => r.g);
    const ymin = Math.min(1.25, Math.floor(Math.min.apply(null, gs) * 10) / 10);
    const ymax = Math.max(1.5, Math.ceil(Math.max.apply(null, gs) * 10) / 10);
    const xmax = Math.max(4, Math.ceil(Math.max.apply(null, rows.map(r => r.tau))));
    const ch = VL.chart('vhchart', '0 0 640 300');
    const ax = VL.axes(ch, {
      x0: 66, y0: 250, x1: 596, y1: 40, xmin: 0, xmax: xmax, ymin: ymin, ymax: ymax,
      xticks: VL.ticks(0, xmax, 6).map(v => ({ v: v, label: VL.fm(v, 0) })),
      yticks: VL.ticks(ymin, ymax, 6).map(v => ({ v: v, label: VL.fm(v, 2) })),
      xlab: 'время открытия крана τ, с', ylab: 'γ',
    });
    VL.series(ch, [[ax.X(0), ax.Y(GAMMA)], [ax.X(xmax), ax.Y(GAMMA)]], '#1a7f37',
      null, { dash: '6 5', width: 1.4, noPoints: true });
    VL.label(ch, ax.X(xmax) - 4, ax.Y(GAMMA) - 8, '#1a7f37', 'γ = 1,40 (теория)',
      { 'text-anchor': 'end' });
    VL.series(ch, rows.map(r => [ax.X(r.tau), ax.Y(VL.clamp(r.g, ymin, ymax))]), '#b3382e',
      rows.map(r => `τ = ${VL.fm(r.tau, 1)} с, γ = ${VL.fm(r.g, 3)}`), { nolines: true });
  }

  /* ---------- органы управления ---------- */
  VL.slider('vhH', 'vhHv', v => VL.fm(v, 0) + ' мм', v => { hTarget = v; });
  VL.slider('vhTau', 'vhTauv', v => VL.fm(v, 1) + ' с', v => { tau = v; });

  $('vhpump').addEventListener('click', startPump);
  $('vhwait').addEventListener('click', finishSettle);
  $('vhopen').addEventListener('click', openValve);
  $('vhsnap').addEventListener('click', snap);
  $('vhreset').addEventListener('click', function () {
    rows.length = 0;
    st = 'atm'; hCur = 0; dT = 0;
    syncBtns(); render();
  });
  syncBtns();

  const waitFor = (cond, ms) => new Promise(function (res) {
    const t0 = Date.now();
    const id = setInterval(function () {
      if (cond() || Date.now() - t0 > (ms || 5000)) { clearInterval(id); res(); }
    }, 50);
  });

  AUTO = VL.auto({
    autoBtn: 'vhauto', stopBtn: 'vhstop',
    lockIds: ['vhpump', 'vhwait', 'vhopen', 'vhsnap', 'vhreset', 'vhH', 'vhTau'],
    total: () => 6,
    progress: (i, n) => {
      const p = $('vhprog'); p.style.display = ''; p.textContent = `опыт ${i} из ${n}`;
    },
    step: async (i, ctl) => {
      if (i === 0) { rows.length = 0; st = 'atm'; hCur = 0; render(); }
      fast = true;
      startPump();
      await waitFor(() => st === 'settle1' || ctl.aborted());
      finishSettle();
      await ctl.sleep(150);
      if (ctl.aborted()) { fast = false; return; }
      openValve();
      await waitFor(() => st === 'settle2' || ctl.aborted());
      finishSettle();
      await ctl.sleep(150);
      if (!ctl.aborted()) snap();
      fast = false;
    },
    onFinish: (aborted, done, n) => {
      fast = false;
      syncBtns();
      $('vhprog').style.display = 'none';
      $('vhhint').textContent = aborted
        ? `Прогон остановлен: снято ${done} опытов из ${n}.`
        : 'Серия из шести опытов снята. Поменяйте время открытия крана и снимите ' +
          'ещё серию — сравните средние.';
    },
  });

  render();
  draw();
})();
