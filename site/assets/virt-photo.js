/* Работа. Определение постоянной Планка методом задерживающего потенциала.
 *
 * Модель: вакуумный фотоэлемент с сурьмяно-цезиевым катодом, набор
 * светофильтров из линий ртутной лампы и плавно регулируемое задерживающее
 * напряжение. Запирающее напряжение считает PHYS.photoeffect(λ, A):
 *   eU_з = hc/λ − A,
 * поэтому «истинная» постоянная Планка модели — это h из PHYS.C, то есть
 * табличные 6,626·10⁻³⁴ Дж·с, а работа выхода задана явно: A = 2,20 эВ
 * (красная граница 563,6 нм — светофильтр 578 нм фототока уже не даёт).
 *
 * Вольт-амперная характеристика взята в виде I = I_нас(1 − U/U_з)^1,2:
 * электроны выходят с разбросом энергий, поэтому ток спадает не скачком.
 * Показатель подобран так, чтобы порог чувствительности микроамперметра
 * (0,01 мкА) занижал отсчёт U_з на 0,4 % — систематика есть, но она заведомо
 * меньше доверительного интервала наклона.
 * Интенсивность света входит только в I_нас и НЕ входит в U_з — это главный
 * эффект работы, его и надо пощупать ползунком.
 */
'use strict';
(function () {
  const svg = $('vf');
  if (!svg || !window.VL || !window.PHYS || !window.METRO) return;
  const P = window.PHYS, M = window.METRO, C = P.C;

  /* ---------- параметры установки ---------- */
  const A_OUT = 2.20;              /* работа выхода катода, эВ (истинное значение) */
  const H_TAB = 6.626;             /* табличная h, ×10⁻³⁴ Дж·с */
  const FILT = [                   /* светофильтры: линии ртутной лампы */
    { lam: 365.0, S: 1.00, col: '#7b3fbf', name: 'УФ' },
    { lam: 404.7, S: 0.95, col: '#5b47c8', name: 'фиолетовый' },
    { lam: 435.8, S: 0.85, col: '#2f5fd0', name: 'синий' },
    { lam: 546.1, S: 0.35, col: '#1a7f37', name: 'зелёный' },
    { lam: 578.0, S: 0.20, col: '#c08a00', name: 'жёлтый' },
  ];
  const I0 = 8.2;                  /* ток насыщения при 100 % и λ = 365 нм, мкА */
  const P_VAX = 1.2;               /* показатель спада ВАХ */
  const SIG_U = 0.004;             /* СКО отсчёта по цифровому вольтметру, В */
  const DIG = 0.01;                /* единица младшего разряда вольтметра, В */
  const NOISE_I = 0.005;           /* шум показаний микроамперметра, мкА */
  const UMAX = 2.0;

  let fi = 2, inten = 100, U = 0;
  const rows = [];
  let ax = null, gGhost = null, gTrace = null, gDot = null, gMark = null;
  let trace = { key: '', umax: 0, lam: 0, inten: 0 };
  const ghosts = [];
  const meterI = VL.meter(0.12, 0.06);
  const parts = [];
  for (let i = 0; i < 26; i++) {
    parts.push({ t: Math.random(), e: 0.05 + 0.95 * Math.random(), y: 60 + 60 * Math.random() });
  }

  const F = () => FILT[fi];
  const nu14 = lam => C.c / (lam * 1e-9) / 1e14;          /* частота, 10¹⁴ Гц */
  const Uz = lam => P.photoeffect(lam, A_OUT).Uzap;        /* запирающее, В */
  const Isat = () => I0 * F().S * inten / 100;
  function cur(u) {
    const uz = Uz(F().lam);
    if (uz <= 0 || u >= uz) return 0;
    return Isat() * Math.pow(1 - u / uz, P_VAX);
  }

  /* ---------- ось ВАХ рисуется один раз ---------- */
  {
    ax = VL.axes(svg, {
      x0: 70, y0: 418, x1: 612, y1: 300, xmin: 0, xmax: UMAX, ymin: 0, ymax: 10,
      xticks: [0, 0.4, 0.8, 1.2, 1.6, 2.0].map(v => ({ v: v, label: VL.fm(v, 1) })),
      yticks: [0, 2, 4, 6, 8, 10].map(v => ({ v: v, label: String(v) })),
      xlab: 'задерживающее напряжение U, В', ylab: 'I, мкА',
    });
    gGhost = VL.el('g', {}, svg);
    gTrace = VL.el('g', {}, svg);
    gMark = VL.el('g', {}, svg);
    gDot = VL.el('circle', { r: 4.5, fill: '#b3382e', cx: ax.X(0), cy: ax.Y(0) }, svg);
  }

  /* ---------- вольт-амперная характеристика ---------- */
  function tracePts(lam, it, umax) {
    const uz = P.photoeffect(lam, A_OUT).Uzap;
    const sat = I0 * (FILT.filter(f => f.lam === lam)[0] || F()).S * it / 100;
    const out = [];
    for (let u = 0; u <= umax + 1e-9; u += 0.01) {
      const i = (uz <= 0 || u >= uz) ? 0 : sat * Math.pow(1 - u / uz, P_VAX);
      out.push(ax.X(Math.min(u, UMAX)).toFixed(1) + ',' + ax.Y(i).toFixed(1));
    }
    return out.join(' ');
  }

  function drawTraces() {
    VL.clear(gGhost); VL.clear(gTrace);
    ghosts.forEach(g => {
      VL.el('polyline', {
        points: tracePts(g.lam, g.inten, g.umax), fill: 'none',
        stroke: g.col, 'stroke-width': 1.2, 'stroke-dasharray': '5 4', opacity: 0.6,
      }, gGhost);
    });
    if (trace.umax > 0.005) {
      VL.el('polyline', {
        points: tracePts(F().lam, inten, trace.umax), fill: 'none',
        stroke: F().col, 'stroke-width': 2,
      }, gTrace);
    }
  }

  function newTrace() {
    if (trace.umax > 0.05) {
      ghosts.push({ lam: trace.lam, inten: trace.inten, umax: trace.umax, col: trace.col });
      while (ghosts.length > 2) ghosts.shift();
    }
    trace = { key: F().lam + '/' + inten, umax: U, lam: F().lam, inten: inten, col: F().col };
    drawTraces();
  }

  /* ---------- живая схема ---------- */
  function layout() {
    const f = F();
    $('vffilt').setAttribute('fill', f.col);
    $('vfbeam1').setAttribute('stroke', f.col);
    $('vfbeam2').setAttribute('stroke', f.col);
    $('vfbeam3').setAttribute('stroke', f.col);
    const xs = 300 + 140 * VL.clamp(U / UMAX, 0, 1);
    $('vfsl').setAttribute('x1', xs.toFixed(1));
    $('vfsl').setAttribute('x2', xs.toFixed(1));
    $('vfsl2').setAttribute('points',
      `${(xs - 4).toFixed(1)},190 ${(xs + 4).toFixed(1)},190 ${xs.toFixed(1)},200`);
    $('vfwire').setAttribute('x2', xs.toFixed(1));
    $('vfr1').textContent = 'светофильтр ' + VL.fm(f.lam, 1) + ' нм (' + f.name + ')';
    $('vfr1').setAttribute('style', 'font:11px system-ui;fill:' + f.col);
    $('vfr2').textContent = 'ν = ' + VL.fm(nu14(f.lam), 3) + '·10¹⁴ Гц';
    $('vfr5').textContent = 'интенсивность ' + inten + ' %';
  }

  VL.loop(function (dt) {
    const uz = Uz(F().lam), i = cur(U);
    const shown = meterI.tick(dt, i, v => Math.max(0, v + VL.gauss(NOISE_I)));
    $('vfr3').textContent = 'U = ' + VL.fm(U, 2) + ' В';
    $('vfr4').textContent = 'I = ' + VL.fm(shown, 2) + ' мкА';
    if (uz <= 0) {
      $('vfr6').textContent = 'фототока нет ни при каком U';
      $('vfr6').setAttribute('style', 'font:11px system-ui;fill:#b3382e');
    } else if (i <= 0.005) {
      $('vfr6').textContent = 'ток заперт: U ≥ U_з';
      $('vfr6').setAttribute('style', 'font:11px system-ui;fill:#b3382e');
    } else {
      $('vfr6').textContent = 'ток идёт';
      $('vfr6').setAttribute('style', 'font:11px system-ui;fill:#1a7f37');
    }
    /* стрелка микроамперметра */
    const a = (-52 + 104 * VL.clamp(shown / 10, 0, 1)) * Math.PI / 180;
    $('vfneed').setAttribute('x2', (262 + 15 * Math.sin(a)).toFixed(1));
    $('vfneed').setAttribute('y2', (100 - 15 * Math.cos(a)).toFixed(1));
    /* электроны: часть возвращается, не долетев до анода */
    const g = $('vfels');
    VL.clear(g);
    const u = uz > 0 ? U / uz : 2;
    const n = uz > 0 ? Math.max(3, Math.round(26 * F().S * inten / 100)) : 0;
    for (let k = 0; k < n; k++) {
      const p = parts[k];
      p.t += dt * (0.55 + 0.5 * p.e);
      if (p.t > 1) { p.t -= 1; p.y = 60 + 60 * Math.random(); p.e = 0.05 + 0.95 * Math.random(); }
      const reach = u <= 0 ? 1 : (p.e > u ? 1 : p.e / u);
      const s = reach >= 1 ? p.t : reach * Math.sin(Math.PI * p.t);
      VL.el('circle', {
        cx: (128 + 42 * s).toFixed(1),
        cy: (p.y + (90 - p.y) * s * 0.85).toFixed(1),
        r: 2, fill: reach >= 1 ? '#155e75' : '#b3382e',
      }, g);
    }
    gDot.setAttribute('cx', ax.X(Math.min(U, UMAX)).toFixed(1));
    gDot.setAttribute('cy', ax.Y(Math.min(shown, 10)).toFixed(1));
  });

  /* ---------- снятие отсчёта ---------- */
  function snap() {
    const hint = $('vfhint');
    const uz = Uz(F().lam);
    if (uz <= 0) {
      hint.className = 'virt-hint alert';
      hint.textContent = 'При λ = ' + VL.fm(F().lam, 1) + ' нм фототока нет ни при каком ' +
        'напряжении и ни при какой интенсивности: это за красной границей. ' +
        'Запирающее напряжение здесь не существует, отсчёт снимать нечего.';
      return;
    }
    if (cur(U) > 0.01) {
      hint.className = 'virt-hint alert';
      hint.textContent = 'Ток ещё идёт (' + VL.fm(cur(U), 2) + ' мкА). Запирающее ' +
        'напряжение — то, при котором ток обращается в нуль: увеличивайте U, пока ' +
        'показание микроамперметра не перестанет отличаться от нуля.';
      return;
    }
    const u = Math.round((U + VL.gauss(SIG_U)) / DIG) * DIG;
    rows.push({ lam: F().lam, nu: nu14(F().lam), U: u, inten: inten, Isat: Isat() });
    VL.el('line', {
      x1: ax.X(u).toFixed(1), y1: ax.Y(0), x2: ax.X(u).toFixed(1), y2: (ax.Y(0) + 7).toFixed(1),
      stroke: '#b3382e', 'stroke-width': 2,
    }, gMark);
    render();
  }

  /* ---------- обработка ---------- */
  function render() {
    const out = $('vfout');
    const hint = $('vfhint');
    hint.className = 'virt-hint';
    if (!rows.length) {
      out.innerHTML = '';
      hint.textContent = 'Журнал пуст. Поставьте светофильтр, увеличивайте задерживающее ' +
        'напряжение до исчезновения тока и снимите отсчёт. Нужно не меньше трёх ' +
        'разных фильтров, а лучше — по три отсчёта на каждый.';
      return;
    }
    let h = '<h3>Журнал измерений</h3><table class="el"><tr><th class="num">№</th>' +
      '<th class="num">λ, нм</th><th class="num">ν, 10¹⁴ Гц</th>' +
      '<th class="num">интенсивность, %</th><th class="num">I(0), мкА</th>' +
      '<th class="num">U<sub>з</sub>, В</th></tr>';
    rows.forEach((r, i) => {
      h += `<tr><td class="num">${i + 1}</td><td class="num">${VL.fm(r.lam, 1)}</td>` +
        `<td class="num">${VL.fm(r.nu, 3)}</td><td class="num">${r.inten}</td>` +
        `<td class="num">${VL.fm(r.Isat, 2)}</td><td class="num"><b>${VL.fm(r.U, 2)}</b></td></tr>`;
    });
    h += '</table>';

    /* группировка по фильтрам */
    const keys = [];
    const grp = {};
    rows.forEach(r => {
      if (!grp[r.lam]) { grp[r.lam] = []; keys.push(r.lam); }
      grp[r.lam].push(r);
    });
    keys.sort((a, b) => a - b);

    /* --- интенсивность не влияет на U_з --- */
    let shown = false;
    keys.forEach(k => {
      if (shown) return;
      const its = {};
      grp[k].forEach(r => { its[r.inten] = 1; });
      if (Object.keys(its).length < 2) return;
      shown = true;
      h += '<h3>Что делает интенсивность</h3><table class="el"><tr>' +
        '<th class="num">интенсивность, %</th><th class="num">ток при U = 0, мкА</th>' +
        '<th class="num">U<sub>з</sub>, В</th></tr>';
      grp[k].slice().sort((a, b) => b.inten - a.inten).forEach(r => {
        h += `<tr><td class="num">${r.inten}</td><td class="num">${VL.fm(r.Isat, 2)}</td>` +
          `<td class="num">${VL.fm(r.U, 2)}</td></tr>`;
      });
      h += '</table><p>Свет ослаблен в несколько раз, ток упал во столько же раз — ' +
        'а запирающее напряжение осталось прежним, с точностью до разброса отсчёта. ' +
        'Волновая теория такого объяснить не может: в ней энергия, передаваемая ' +
        'электрону, должна расти с амплитудой волны, и при сильном свете электроны ' +
        'обязаны были бы вылетать более быстрыми. Опыт говорит другое: интенсивность — ' +
        'это <b>число</b> фотонов, а энергия каждого равна \\(h\\nu\\) и от числа не ' +
        'зависит.</p>';
    });

    /* --- обработка ряда для одного фильтра --- */
    const cg = grp[F().lam] || [];
    if (cg.length >= 3) {
      const instr = cg.reduce((s, r) => s + (0.005 * r.U + DIG), 0) / cg.length;
      h += '<h3>Обработка ряда \\(U_{\\text{з}}\\) при λ = ' + VL.fm(F().lam, 1) + ' нм</h3>' +
        '<p>Приборная составляющая цифрового вольтметра — ' +
        '\\(\\pm(0{,}5\\,\\%\\ \\text{показания} + 1\\ \\text{ед. мл. разряда})\\), ' +
        'то есть \\(' + VL.lm(instr, 3) + '\\) В.</p>';
      h += VL.processHtml({
        xs: cg.map(r => r.U), instr: instr, sym: 'U_{\\text{з}}', unit: 'В', dec: 3,
        trueVal: Uz(F().lam), trueName: 'значением, заложенным в модель для этой линии',
      }).html;
    } else {
      h += '<p class="small">Чтобы обработать ряд по методике практикума, снимите ' +
        'не меньше трёх отсчётов при одном светофильтре (сейчас при выбранном — ' +
        cg.length + ').</p>';
    }

    /* --- прямая U_з(ν) --- */
    const pts = keys.map(k => {
      const g = grp[k];
      return [nu14(k), g.reduce((s, r) => s + r.U, 0) / g.length, k, g.length];
    });
    if (pts.length >= 3) {
      const fit = M.lsq(pts.map(p => [p[0], p[1]]));
      const h34 = fit.k * C.e * 1e20, dh34 = fit.dk * C.e * 1e20;
      const Aev = -fit.b, dAev = fit.db;
      const nu0 = -fit.b / fit.k, lam0 = C.c / (nu0 * 1e14) * 1e9;
      h += '<h3>Постоянная Планка по наклону прямой</h3>' +
        '<p>Уравнение Эйнштейна, поделённое на заряд электрона, — это прямая ' +
        '\\(U_{\\text{з}} = \\dfrac{h}{e}\\nu - \\dfrac{A}{e}\\): по наклону находится ' +
        '\\(h\\), по отрезку на оси ординат — работа выхода, по точке пересечения ' +
        'с осью частот — красная граница.</p><div id="vfchart"></div>' +
        '<div class="panel steps">' +
        VL.step('\\(k = h/e\\)', 'МНК по ' + pts.length + ' точкам',
          `\\((${VL.lm(fit.k, 4)}\\pm${VL.lm(fit.dk, 4)})\\)&nbsp;В/(10^{14} Гц)`) +
        VL.step('\\(r\\)', 'коэффициент корреляции', `\\(${VL.lm(fit.r, 4)}\\)`) +
        VL.step('\\(h = k\\,e\\)',
          `\\(${VL.lm(fit.k, 4)}\\cdot 10^{-14}\\cdot 1{,}602\\cdot10^{-19}\\)`,
          `\\(${VL.lm(h34, 3)}\\cdot10^{-34}\\)&nbsp;Дж·с`) +
        VL.step('\\(\\Delta h = \\Delta k\\,e\\)',
          `\\(${VL.lm(fit.dk, 4)}\\cdot 1{,}602\\cdot10^{-33}\\)`,
          `\\(${VL.lm(dh34, 3)}\\cdot10^{-34}\\)&nbsp;Дж·с`) +
        VL.step('\\(A = -b\\,e\\)', `\\(${VL.lm(-fit.b, 3)}\\) эВ`,
          `\\((${VL.lm(Aev, 2)}\\pm${VL.lm(dAev, 2)})\\)&nbsp;эВ`) +
        VL.step('\\(\\nu_0 = A/h = -b/k\\)', `\\(${VL.lm(-fit.b, 3)}/${VL.lm(fit.k, 4)}\\)`,
          `\\(${VL.lm(nu0, 2)}\\cdot10^{14}\\)&nbsp;Гц`) +
        VL.step('\\(\\lambda_0 = c/\\nu_0\\)',
          `\\(2{,}998\\cdot10^{8}/(${VL.lm(nu0, 2)}\\cdot10^{14})\\)`,
          `\\(${VL.lm(lam0, 0)}\\)&nbsp;нм`) +
        '</div>';
      const st = { mean: h34, d: dh34, alpha: 0.95 };
      h += '<div class="ans"><b>Результат вашего опыта:</b> ' +
        VL.record('h', st, '·10⁻³⁴ Дж·с') + '.</div>';
      h += VL.verdict(st, H_TAB, 'табличным значением 6,626·10⁻³⁴ Дж·с',
        '·10⁻³⁴ Дж·с', 'h');
      const ag = M.agrees(Aev, dAev, A_OUT);
      h += '<div class="check"><b>Работа выхода.</b> В модель заложен ' +
        'сурьмяно-цезиевый катод с \\(A = 2{,}20\\) эВ (красная граница 564 нм). ' +
        'У вас получилось \\(' + VL.lm(Aev, 2) + '\\pm' + VL.lm(dAev, 2) + '\\) эВ, ' +
        'расхождение ' + VL.fm(ag.dev, 3) + ' эВ — ' +
        (ag.ok ? 'меньше доверительного интервала, согласуется.'
          : ag.near ? 'чуть больше интервала: добавьте отсчётов, особенно на длинноволновых фильтрах.'
            : 'заметно больше интервала: скорее всего, часть отсчётов снята при ещё не запертом токе.') +
        ' Отрезок прямой — величина «дальней» экстраполяции к \\(\\nu=0\\), поэтому его ' +
        'погрешность всегда больше, чем у наклона.</div>';
    } else {
      h += '<p class="small">Прямая \\(U_{\\text{з}}(\\nu)\\) строится не меньше чем по ' +
        'трём разным светофильтрам: сейчас в журнале ' + pts.length + '.</p>';
    }

    out.innerHTML = h;
    if ($('vfchart')) drawChart(pts);
    VL.mathify(out);
    hint.textContent = 'Снято отсчётов: ' + rows.length + ' на ' + keys.length + ' фильтрах.';
  }

  function drawChart(pts) {
    const fit = M.lsq(pts.map(p => [p[0], p[1]]));
    const ch = VL.chart('vfchart', '0 0 640 320');
    const a = VL.axes(ch, {
      x0: 74, y0: 250, x1: 600, y1: 34, xmin: 0, xmax: 9, ymin: -2.6, ymax: 1.6,
      xticks: [0, 2, 4, 6, 8].map(v => ({ v: v, label: String(v) })),
      yticks: [-2.5, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5].map(v => ({ v: v, label: VL.fm(v, 1) })),
      xlab: 'ν, 10¹⁴ Гц', ylab: 'U_з, В',
    });
    VL.el('line', { x1: a.X(0), y1: a.Y(0), x2: a.X(9), y2: a.Y(0),
      stroke: '#16161a', 'stroke-width': 1 }, ch);
    VL.series(ch, [[a.X(0), a.Y(fit.b)], [a.X(9), a.Y(fit.k * 9 + fit.b)]], '#6b6b74',
      null, { dash: '6 5', width: 1.4, noPoints: true });
    VL.series(ch, pts.map(p => [a.X(p[0]), a.Y(p[1])]), '#155e75',
      pts.map(p => `λ = ${VL.fm(p[2], 1)} нм, ν = ${VL.fm(p[0], 3)}·10¹⁴ Гц, ` +
        `⟨U_з⟩ = ${VL.fm(p[1], 3)} В (${p[3]} отсчётов)`), { nolines: true });
    const nu0 = -fit.b / fit.k;
    if (nu0 > 0 && nu0 < 9) {
      VL.el('circle', { cx: a.X(nu0), cy: a.Y(0), r: 4, fill: '#b3382e' }, ch);
      VL.label(ch, a.X(nu0) + 8, a.Y(0) - 8, '#b3382e',
        'ν₀ = ' + VL.fm(nu0, 2) + '·10¹⁴ Гц');
    }
    VL.label(ch, 340, 56, '#1a7f37', 'наклон k = h/e = ' + VL.fm(fit.k, 4) +
      ' В/(10¹⁴ Гц) → h = ' + VL.fm(fit.k * C.e * 1e20, 3) + '·10⁻³⁴ Дж·с',
    { 'text-anchor': 'middle' });
    VL.label(ch, 340, 72, '#6b6b74', 'отрезок b = −A/e = ' + VL.fm(fit.b, 3) +
      ' В → A = ' + VL.fm(-fit.b, 2) + ' эВ', { 'text-anchor': 'middle' });
  }

  /* ---------- органы управления ---------- */
  VL.slider('vfU', 'vfUv', v => VL.fm(v, 2) + ' В', v => {
    U = v;
    if (U > trace.umax) { trace.umax = U; drawTraces(); }
    layout();
  });
  VL.slider('vfI', 'vfIv', v => VL.fm(v, 0) + ' %', v => {
    if (v !== inten) { inten = v; newTrace(); }
    layout();
  });
  $('vffi').addEventListener('change', function () {
    fi = FILT.map(f => String(f.lam)).indexOf(this.value);
    newTrace();
    layout();
    render();
  });

  $('vfsnap').addEventListener('click', snap);
  $('vfreset').addEventListener('click', () => {
    rows.length = 0;
    ghosts.length = 0;
    VL.clear(gMark);
    drawTraces();
    render();
  });

  /* ---------- авто-опыт: 4 фильтра × 3 интенсивности ---------- */
  const PLAN = [];
  [0, 1, 2, 3].forEach(k => [100, 60, 30].forEach(it => PLAN.push([k, it])));

  VL.auto({
    autoBtn: 'vfauto', stopBtn: 'vfstop',
    lockIds: ['vfsnap', 'vfreset', 'vfU', 'vfI', 'vffi'],
    total: () => PLAN.length,
    progress: (i, n) => {
      const p = $('vfprog'); p.style.display = ''; p.textContent = `отсчёт ${i} из ${n}`;
    },
    step: async (i, ctl) => {
      if (i === 0) {
        rows.length = 0; ghosts.length = 0; VL.clear(gMark); render();
      }
      const sf = $('vffi'), su = $('vfU'), si = $('vfI');
      sf.value = String(FILT[PLAN[i][0]].lam);
      sf.dispatchEvent(new Event('change'));
      si.value = PLAN[i][1];
      si.dispatchEvent(new Event('input'));
      const uz = Uz(FILT[PLAN[i][0]].lam);
      /* «лаборант» плавно поднимает напряжение и ловит исчезновение тока */
      for (const frac of [0.3, 0.7, 0.92]) {
        su.value = (uz * frac).toFixed(2);
        su.dispatchEvent(new Event('input'));
        await ctl.sleep(110);
        if (ctl.aborted()) return;
      }
      /* критерий тот же, что у студента: первое деление, на котором ток уже не
         отличим от нуля; промахнуться можно только в большую сторону */
      let u = 0;
      while (u < UMAX && cur(u) > 0.01) u = Math.round((u + DIG) * 100) / 100;
      const stop = VL.clamp(Math.max(u, Math.round((u + VL.gauss(DIG)) / DIG) * DIG), 0, UMAX);
      su.value = stop.toFixed(2);
      su.dispatchEvent(new Event('input'));
      await ctl.sleep(160);
      if (!ctl.aborted()) snap();
    },
    onFinish: (aborted, done, n) => {
      $('vfprog').style.display = 'none';
      $('vfhint').textContent = aborted
        ? `Прогон остановлен: снято ${done} из ${n} отсчётов.`
        : 'Четыре светофильтра, по три отсчёта при разной интенсивности — ниже ' +
          'обработка ряда, таблица «интенсивность против запирающего напряжения» и прямая U_з(ν).';
    },
  });

  layout();
  newTrace();
  render();
})();
