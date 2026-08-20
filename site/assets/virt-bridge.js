/* Работа «Измерение сопротивлений мостом постоянного тока».
 *
 * Модель: реохордный мост Уитстона. Четырёхугольник ACBD: в верхних плечах
 * магазин R (A–C) и неизвестное Rx (C–B), в нижних — участки реохордной
 * проволоки l1 (A–D) и l2 (D–B); в диагонали C–D гальванометр, в диагонали
 * A–B источник. Ток гальванометра считается точно — узловым методом для всей
 * цепи (система 3×3), поэтому стрелка ведёт себя так же, как в железе:
 * положение нуля не зависит ни от ЭДС, ни от сопротивления гальванометра, а
 * вот КРУТИЗНА подхода к нулю — зависит.
 *
 * Что зашито: истинные сопротивления трёх «неизвестных» резисторов, разброс
 * посадки скользящего контакта и порог различения отклонения стрелки глазом.
 * Рабочая формула равновесия берётся из PHYS.slideBridge. */
'use strict';
(function () {
  const svg = $('vb');
  if (!svg || !window.VL) return;
  const P = window.PHYS;
  /* физика — из общего ядра; локальная копия только на случай, если phys.js
     почему-либо не подключён (страница всё равно должна работать) */
  const slideBridge = (P && P.slideBridge) || function (R, l1, l2) { return R * l2 / l1; };

  /* ---------- паспорт установки ---------- */
  const L = 1000;          // длина реохорда, мм
  const RW = 15.0;         // полное сопротивление проволоки реохорда, Ом
  const RC = 0.03;         // переходное сопротивление контактов плеча, Ом (≈2 мм проволоки)
  const RG = 100;          // сопротивление гальванометра, Ом
  const RS = 11.5;         // внутреннее + ограничительное сопротивление источника, Ом
  const I_DEL = 7e-6;      // ток на одно деление гальванометра, А
  const A_THR = 1.0;       // порог: отклонение меньше деления глазом не различается
  const A_MAX = 22;        // упор стрелки, делений
  const D_L = 0.5;         // приборная погрешность отсчёта по шкале реохорда, мм
  const SIG_C = 0.35;      // разброс посадки скользящего контакта, мм
  const MAG = [10, 20, 50, 100, 200, 500, 1000];      // декады магазина Р33, Ом
  const UNK = [
    { mark: 'Rx₁ (маркировка 51 Ом ±5 %)', val: 52.4 },
    { mark: 'Rx₂ (маркировка 150 Ом ±5 %)', val: 146.2 },
    { mark: 'Rx₃ (маркировка 470 Ом ±5 %)', val: 483.0 },
  ];
  /* магазин Р33: класс точности 0,05 плюс остаточное сопротивление 0,02 Ом */
  const dMag = R => 0.0005 * R + 0.02;

  /* ---------- геометрия схемы ---------- */
  const X0 = 80, X1 = 560, YW = 230, PX = (X1 - X0) / L;

  let l = 500, E = 2, Rm = 100, ui = 0, bias = 0, needle = 0;
  const rows = [];
  const Rx = () => UNK[ui].val;
  const lbal = () => L * Rm / (Rm + Rx());          // точка равновесия, мм

  /* ---------- расчёт цепи ---------- */
  /* узловые потенциалы (V_B = 0): решаем систему 3×3 методом Гаусса */
  function solve(pos) {
    const l1 = VL.clamp(pos, 1, L - 1), l2 = L - l1;
    const R3 = RW * l1 / L + RC, R4 = RW * l2 / L + RC;
    const gs = 1 / RS, g1 = 1 / Rm, g2 = 1 / Rx(), g3 = 1 / R3, g4 = 1 / R4, gg = 1 / RG;
    const M = [
      [gs + g1 + g3, -g1, -g3, gs * E],
      [-g1, g1 + g2 + gg, -gg, 0],
      [-g3, -gg, g3 + g4 + gg, 0],
    ];
    for (let i = 0; i < 3; i++) {
      let p = i;
      for (let j = i + 1; j < 3; j++) if (Math.abs(M[j][i]) > Math.abs(M[p][i])) p = j;
      const t = M[i]; M[i] = M[p]; M[p] = t;
      for (let j = i + 1; j < 3; j++) {
        const f = M[j][i] / M[i][i];
        for (let k = i; k < 4; k++) M[j][k] -= f * M[i][k];
      }
    }
    const v = [0, 0, 0];
    for (let i = 2; i >= 0; i--) {
      let s = M[i][3];
      for (let k = i + 1; k < 3; k++) s -= M[i][k] * v[k];
      v[i] = s / M[i][i];
    }
    return (v[1] - v[2]) / RG;                       // ток гальванометра, А
  }
  /* отклонение стрелки в делениях; движок «садится» на проволоку с люфтом */
  const defl = pos => solve(pos + bias) / I_DEL;
  /* крутизна: делений на миллиметр перемещения движка */
  const sens = pos => Math.abs(defl(pos + 1) - defl(pos - 1)) / 2;

  /* приборная погрешность одного отсчёта Rx: косвенное измерение
     Rx = R(L − l1)/l1, где погрешности R и l1 независимы, а l2 = L − l1
     связано с l1 — численное дифференцирование учитывает это само */
  function instrOf(R, l1) {
    const f = a => a[0] * (L - a[1]) / a[1];
    return window.METRO.indirect(f, [R, l1], [dMag(R), D_L]);
  }

  /* ---------- разметка шкалы реохорда ---------- */
  {
    const g = $('vbscale');
    for (let mm = 0; mm <= L; mm += 20) {
      const x = X0 + mm * PX;
      VL.el('line', {
        x1: x.toFixed(1), y1: YW, x2: x.toFixed(1), y2: mm % 100 ? 236 : 241,
        stroke: '#6b6b74', 'stroke-width': 1,
      }, g);
      if (mm % 100 === 0) {
        const t = VL.el('text', { x: x.toFixed(1), y: 254, 'text-anchor': 'middle' }, g);
        t.textContent = mm === L ? '1000 мм' : String(mm);
      }
    }
  }

  /* ---------- живая схема ---------- */
  VL.loop(function (dt) {
    const xd = X0 + l * PX;
    $('vbslid').setAttribute('transform', 'translate(' + (xd - 320).toFixed(1) + ',0)');
    $('vblead').setAttribute('points',
      `320,206 320,212 ${xd.toFixed(1)},212 ${xd.toFixed(1)},214`);
    /* стрелка с инерцией */
    const a = VL.clamp(defl(l), -A_MAX, A_MAX);
    needle += (a - needle) * (1 - Math.exp(-dt / 0.12));
    const ang = needle / A_MAX * 60 * Math.PI / 180;
    $('vbneedle').setAttribute('x2', (320 + 24 * Math.sin(ang)).toFixed(1));
    $('vbneedle').setAttribute('y2', (163 - 24 * Math.cos(ang)).toFixed(1));
    /* размерные линии плеч */
    $('vbd1').setAttribute('x2', xd.toFixed(1));
    $('vbd2').setAttribute('x1', xd.toFixed(1));
    $('vbt1').setAttribute('x', ((X0 + xd) / 2).toFixed(1));
    $('vbt1').textContent = l >= 190 ? 'l₁ = ' + VL.fm(l, 1) + ' мм' : '';
    $('vbt2').setAttribute('x', ((xd + X1) / 2).toFixed(1));
    $('vbt2').textContent = (L - l) >= 190 ? 'l₂ = ' + VL.fm(L - l, 1) + ' мм' : '';
    /* показания */
    const s = sens(l);
    $('vbread').textContent = 'гальванометр: ' + VL.fm(needle, 1) + ' дел'
      + (Math.abs(a) >= A_MAX ? ' (упор)' : '')
      + ' · крутизна ' + VL.fm(s, 2) + ' дел/мм'
      + (Math.abs(a) <= A_THR ? ' · мост уравновешен' : '');
    $('vbread2').textContent = 'по шкале: Rx = R·l₂/l₁ = ' + VL.fm(Rm, 0) + '·'
      + VL.fm(L - l, 1) + '/' + VL.fm(l, 1) + ' = ' + VL.fm(slideBridge(Rm, l, L - l), 2) + ' Ом';
  });

  /* ---------- измерение ---------- */
  function newBias() { bias = VL.gauss(SIG_C); }

  function snap(force) {
    const a = defl(l);
    if (!force && Math.abs(a) > A_THR) {
      const h = $('vbhint');
      h.classList.add('alert');
      h.textContent = 'Стрелка отклонена на ' + VL.fm(a, 1) + ' дел — мост не уравновешен, '
        + 'отсчёт не засчитан. Двигайте движок ' + (a > 0 ? 'влево' : 'вправо')
        + ', пока стрелка не встанет на ноль.';
      return;
    }
    const l1 = Math.round(l * 2) / 2, l2 = L - l1;
    rows.push({ E, R: Rm, l1, l2, Rx: slideBridge(Rm, l1, l2), d: instrOf(Rm, l1).d });
    VL.el('circle', { cx: (X0 + l1 * PX).toFixed(1), cy: YW, r: 2.6, fill: '#b3382e' }, $('vbmarks'));
    newBias();
    render();
  }

  /* ---------- обработка ---------- */
  function render() {
    const out = $('vbout'), hint = $('vbhint');
    hint.classList.remove('alert');
    if (!rows.length) {
      out.innerHTML = '';
      hint.textContent = 'Журнал пуст. Подберите магазин так, чтобы движок встал в средней '
        + 'трети реохорда, поймайте ноль гальванометра и снимите отсчёт — и так 5–7 раз.';
      return;
    }
    let h = '<h3>Журнал измерений</h3><table class="el"><tr><th class="num">№</th>'
      + '<th class="num">U, В</th><th class="num">R, Ом</th><th class="num">l₁, мм</th>'
      + '<th class="num">l₂, мм</th><th class="num">Rx = R·l₂/l₁, Ом</th>'
      + '<th class="num">Δ<sub>приб</sub>, Ом</th></tr>';
    rows.forEach((r, i) => {
      const edge = r.l1 < L / 3 || r.l1 > 2 * L / 3;
      h += `<tr><td class="num">${i + 1}</td><td class="num">${VL.fm(r.E, 1)}</td>`
        + `<td class="num">${VL.fm(r.R, 0)}</td>`
        + `<td class="num"${edge ? ' style="color:#b3382e"' : ''}>${VL.fm(r.l1, 1)}</td>`
        + `<td class="num">${VL.fm(r.l2, 1)}</td>`
        + `<td class="num"><b>${VL.fm(r.Rx, 2)}</b></td>`
        + `<td class="num">${VL.fm(r.d, 2)}</td></tr>`;
    });
    h += '</table>';

    if (rows.length < 3) {
      h += '<p class="small">Отсчётов пока ' + rows.length + ': для статистической обработки '
        + 'нужно не меньше трёх, а по методике практикума — пять-семь.</p>';
      out.innerHTML = h; VL.mathify(out);
      hint.textContent = 'Снято отсчётов: ' + rows.length + '.';
      return;
    }

    /* приборная составляющая ряда — средняя по отсчётам */
    const instr = rows.reduce((s, r) => s + r.d, 0) / rows.length;
    h += '<h3>Обработка ряда \\({R_x}_i\\)</h3>';
    const pr = VL.processHtml({
      xs: rows.map(r => r.Rx), instr, sym: 'R_x', unit: 'Ом', dec: 2,
      trueVal: Rx(), trueName: 'сопротивлением резистора, заложенным в модель',
    });
    h += pr.html;

    /* откуда взялась приборная погрешность: разбор одного отсчёта */
    const last = rows[rows.length - 1];
    const ind = instrOf(last.R, last.l1);
    h += '<h3>Откуда приборная погрешность</h3><div class="panel steps">'
      + VL.step('\\(\\dfrac{\\Delta R}{R}\\) (магазин Р33, класс 0,05)',
        `\\(${VL.lm(dMag(last.R), 3)}/${VL.lm(last.R, 0)}\\)`,
        `\\(${VL.lm(100 * dMag(last.R) / last.R, 3)}\\,\\%\\)`)
      + VL.step('\\(\\dfrac{\\Delta l\\,L}{l_1 l_2}\\) (отсчёт по шкале реохорда)',
        `\\(${VL.lm(D_L, 1)}\\cdot 1000/(${VL.lm(last.l1, 1)}\\cdot ${VL.lm(last.l2, 1)})\\)`,
        `\\(${VL.lm(100 * D_L * L / (last.l1 * last.l2), 2)}\\,\\%\\)`)
      + VL.step('\\(\\Delta {R_x}_{\\text{приб}}\\) (последний отсчёт)',
        `\\(${VL.lm(last.Rx, 2)}\\cdot ${VL.lm(ind.rel, 4)}\\)`,
        `\\(${VL.lm(ind.d, 2)}\\) Ом`)
      + '</div><p class="small">Вклад магазина — сотые доли процента: эталонные резисторы '
      + 'здесь ни при чём. Всё решает отсчёт длины, причём не сам по себе, а с множителем '
      + '\\(L/(l_1l_2)\\), который и «наказывает» за работу у края реохорда.</p>';

    /* график чувствительности */
    h += '<h3>Почему движок держат в средней трети</h3><div id="vbchart"></div>'
      + '<p class="small">Кривая — относительная приборная погрешность '
      + '\\(\\Delta l\\,L/(l_1l_2)\\) в зависимости от положения движка; точками '
      + 'отмечены ваши отсчёты. В середине она минимальна (0,2 %), на границах средней '
      + 'трети хуже всего на 12 %, а у самого края реохорда растёт в разы.</p>';

    /* сравнение по напряжению питания */
    const byE = {};
    rows.forEach(r => { (byE[r.E] = byE[r.E] || []).push(r.Rx); });
    const keys = Object.keys(byE).filter(k => byE[k].length >= 2);
    if (keys.length >= 2) {
      h += '<div class="note tip"><b>Нулевой метод в действии.</b> Средние по группам '
        + 'отсчётов, снятым при разном напряжении питания: '
        + keys.map(k => `\\(U = ${VL.lm(parseFloat(k), 1)}\\) В → \\(\\langle R_x\\rangle = `
          + `${VL.lm(byE[k].reduce((s, x) => s + x, 0) / byE[k].length, 2)}\\) Ом`).join('; ')
        + '. Они отличаются только на величину разброса: ЭДС источника в условие равновесия '
        + 'не входит вовсе. Меняется другое — крутизна подхода к нулю, а значит, и то, '
        + 'насколько точно ловится сам ноль.</div>';
    }
    const edges = rows.filter(r => r.l1 < L / 3 || r.l1 > 2 * L / 3).length;
    if (edges) {
      h += '<div class="note"><b>Отсчёты у края.</b> ' + edges + ' из ' + rows.length
        + ' отсчётов сняты вне средней трети реохорда (в таблице отмечены красным). '
        + 'Их приборная погрешность заметно больше остальных, и они портят весь ряд. '
        + 'Хуже того, у края вылезает систематика: сопротивление контактов и подводящих '
        + 'проводов (около 0,03 Ом, то есть 2 мм проволоки) входит в оба нижних плеча и '
        + 'сокращается только при \\(l_1=l_2\\). Возьмите магазин, близкий по номиналу к '
        + 'неизвестному сопротивлению, — движок сам придёт к середине, и обе беды уйдут '
        + 'разом.</div>';
    }

    out.innerHTML = h;
    if ($('vbchart')) drawSens();
    VL.mathify(out);
    hint.textContent = 'Снято отсчётов: ' + rows.length
      + '; обработка пересчитывается после каждого нового отсчёта.';
  }

  /* график относительной приборной погрешности по длине реохорда */
  function drawSens() {
    const c = VL.chart('vbchart', '0 0 640 280');
    const ax = VL.axes(c, {
      x0: 62, y0: 232, x1: 600, y1: 36, xmin: 0, xmax: 1000, ymin: 0, ymax: 2,
      xticks: [0, 200, 400, 600, 800, 1000].map(v => ({ v, label: String(v) })),
      yticks: [0, 0.5, 1, 1.5, 2].map(v => ({ v, label: VL.fm(v, 1) })),
      xlab: 'положение движка l₁, мм', ylab: 'Δ Rx / Rx от отсчёта длины, %',
    });
    VL.el('rect', {
      x: ax.X(L / 3).toFixed(1), y: 36,
      width: (ax.X(2 * L / 3) - ax.X(L / 3)).toFixed(1), height: (232 - 36).toFixed(1),
      fill: 'rgba(26,127,55,.10)',
    }, c);
    VL.label(c, ax.X(L / 2), 52, '#1a7f37', 'средняя треть', { 'text-anchor': 'middle' });
    const curve = [];
    for (let x = 30; x <= L - 30; x += 5) {
      curve.push([ax.X(x), ax.Y(Math.min(2, 100 * D_L * L / (x * (L - x))))]);
    }
    VL.series(c, curve, '#155e75', null, { noPoints: true, width: 1.8 });
    const pts = rows.map(r => [ax.X(r.l1),
      ax.Y(Math.min(2, 100 * D_L * L / (r.l1 * r.l2)))]);
    VL.series(c, pts, '#b3382e',
      rows.map(r => 'l₁ = ' + VL.fm(r.l1, 1) + ' мм'), { nolines: true, r: 3.5 });
  }

  /* ---------- органы управления ---------- */
  VL.slider('vbL', 'vbLv', v => VL.fm(v, 1) + ' мм', v => { l = v; newBias(); });
  VL.slider('vbE', 'vbEv', v => VL.fm(v, 1) + ' В', v => { E = v; });

  {
    const sel = $('vbR');
    MAG.forEach(v => {
      const o = document.createElement('option');
      o.value = String(v); o.textContent = v + ' Ом';
      if (v === Rm) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () {
      Rm = parseFloat(this.value);
      $('vbrv').textContent = 'R = ' + VL.fm(Rm, 0) + ' Ом';
    });
    $('vbrv').textContent = 'R = ' + VL.fm(Rm, 0) + ' Ом';
  }
  {
    const sel = $('vbX');
    UNK.forEach((u, i) => {
      const o = document.createElement('option');
      o.value = String(i); o.textContent = u.mark;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () {
      ui = parseInt(this.value, 10);
      $('vbxv').textContent = 'Rx' + (ui + 1);
      rows.length = 0;
      VL.clear($('vbmarks'));
      render();
      $('vbhint').textContent = 'Поставлен другой резистор — журнал очищен: '
        + 'смешивать в одном ряду отсчёты для разных сопротивлений нельзя.';
    });
  }

  $('vbsnap').addEventListener('click', () => snap(false));
  $('vbreset').addEventListener('click', () => {
    rows.length = 0;
    VL.clear($('vbmarks'));
    render();
  });

  VL.auto({
    autoBtn: 'vbauto', stopBtn: 'vbstop',
    lockIds: ['vbsnap', 'vbreset', 'vbL', 'vbE', 'vbR', 'vbX'],
    total: () => 6,
    progress: (i, n) => {
      const p = $('vbprog'); p.style.display = ''; p.textContent = `уравновешивание ${i} из ${n}`;
    },
    step: async (i, ctl) => {
      if (i === 0) {
        rows.length = 0;
        VL.clear($('vbmarks'));
        /* лаборант сначала подбирает плечо: магазин, ближайший к Rx */
        const best = MAG.reduce((a, b) =>
          Math.abs(Math.log(b / Rx())) < Math.abs(Math.log(a / Rx())) ? b : a);
        Rm = best;
        $('vbR').value = String(best);
        $('vbrv').textContent = 'R = ' + VL.fm(Rm, 0) + ' Ом';
        render();
      }
      /* половину серии лаборант снимает при другом напряжении питания —
         чтобы стало видно, что среднее от него не зависит */
      if (i === 0 || i === 3) {
        const se = $('vbE');
        se.value = i === 0 ? '2' : '3.5';
        se.dispatchEvent(new Event('input'));
      }
      /* грубая прикидка, затем подход к нулю «по стрелке» */
      let x = VL.clamp(lbal() + VL.gauss(12), 20, L - 20);
      const s = $('vbL');
      for (let k = 0; k < 9; k++) {
        s.value = Math.round(x * 2) / 2;
        s.dispatchEvent(new Event('input'));
        await ctl.sleep(110);
        if (ctl.aborted()) return;
        const a = defl(l);
        if (Math.abs(a) <= A_THR) break;
        const g = sens(l);
        x = VL.clamp(l - (g > 1e-6 ? a / g : 0), 20, L - 20);
      }
      if (!ctl.aborted()) snap(true);
    },
    onFinish: (aborted, done, n) => {
      $('vbprog').style.display = 'none';
      $('vbhint').textContent = aborted
        ? `Прогон остановлен: снято ${done} из ${n} отсчётов.`
        : 'Шесть уравновешиваний выполнены — ниже обработка ряда и разбор погрешности.';
    },
  });

  newBias();
  render();
})();
