/* Работа. Дифракционная решётка: длина волны и разрешающая способность.
 *
 * Модель установки — гониометр: коллиматор со щелью, решётка на столике,
 * поворотная зрительная труба и лимб с нониусом (цена деления нониуса 1′).
 * Углы главных максимумов считает PHYS.grating: d sinφ = mλ. Профиль линии в
 * поле зрения трубы — интерференционная функция решётки вблизи максимума,
 * I ∝ sinc²(πΔφ/δ), где δ = λ/(N d cos φ) — угловое расстояние от максимума
 * до первого нуля, N — число освещённых штрихов. Отсюда сама собой получается
 * разрешающая способность: жёлтый дублет ртути 576,96/579,07 нм разделяется,
 * когда mN ≥ λ/Δλ ≈ 274.
 *
 * Что «истинно» и спрятано от студента: длина волны лазера LASER = 650,3 нм.
 * Линии ртути известны (это эталон), поэтому по ним проверяют методику.
 */
'use strict';
(function () {
  const svg = $('vg');
  if (!svg || !window.VL || !window.PHYS || !window.METRO) return;
  const P = window.PHYS, M = window.METRO;

  /* ---------- параметры установки ---------- */
  const RAD = Math.PI / 180, MINUTE = 1 / 60;    /* угловая минута в градусах */
  const GR = [100, 300, 600, 1200];              /* штрихов на миллиметр */
  const LASER = 650.3;                           /* истинная λ лазера, нм */
  const HG = [                                   /* линии ртутной лампы, нм */
    { lam: 404.66, name: 'фиолетовая', I: 0.45, col: '#7b3fbf' },
    { lam: 435.83, name: 'синяя', I: 0.85, col: '#2f5fd0' },
    { lam: 546.07, name: 'зелёная', I: 1.00, col: '#1a7f37' },
    { lam: 576.96, name: 'жёлтая I', I: 0.70, col: '#b8860b' },
    { lam: 579.07, name: 'жёлтая II', I: 0.62, col: '#c8791a' },
  ];
  const DUB = [576.96, 579.07];
  const R_REQ = (DUB[0] + DUB[1]) / 2 / (DUB[1] - DUB[0]);   /* ≈ 274 */
  const DPHI = 1 * MINUTE;        /* приборная погрешность лимба, градусы */
  const SIG_AIM = 1.2 * MINUTE;   /* СКО наведения на линию, градусы */
  const SLIT = 0.012;             /* аппаратная ширина линии (щель коллиматора) */
  const MMAXDRAW = 5;             /* сколько порядков рисуем */
  const CX = 260, CY = 140, RD = 100;             /* центр лимба и радиус */
  const FX0 = 40, FX1 = 600, FY0 = 404, FY1 = 306; /* поле зрения трубы */

  let gi = 2, src = 'hg', beam = 1.0, phi = 0;
  const rows = [];

  const dNow = () => 1e6 / GR[gi];                 /* период решётки, нм */
  const Nlines = () => Math.max(1, Math.round(beam * GR[gi]));
  const lines = () => (src === 'laser'
    ? [{ lam: LASER, name: 'лазер', I: 1, col: '#b3382e' }] : HG);

  /* ---------- геометрия дифракции ---------- */

  /* все главные максимумы в поле лимба: PHYS.grating даёт sin φ = mλ/d */
  function peaks() {
    const d = dNow(), out = [];
    lines().forEach(L => {
      for (let m = -MMAXDRAW; m <= MMAXDRAW; m++) {
        const a = P.grating(d, L.lam, m).angleDeg;
        if (a == null || Math.abs(a) > 82) continue;
        out.push({ lam: L.lam, name: L.name, col: L.col, m: m, phi: a,
          I: L.I / (1 + 0.18 * m * m) });
      }
    });
    return out;
  }

  /* полуширина линии (до первого нуля) в градусах с учётом ширины щели */
  function width(p) {
    const dif = p.lam / (Nlines() * dNow() * Math.cos(p.phi * RAD)) / RAD;
    return Math.sqrt(dif * dif + SLIT * SLIT);
  }

  /* суммарная интенсивность в направлении x (градусы) */
  function inten(ps, x) {
    let s = 0;
    for (let i = 0; i < ps.length; i++) {
      const u = Math.PI * (x - ps[i].phi) / width(ps[i]);
      s += ps[i].I * (Math.abs(u) < 1e-7 ? 1 : Math.pow(Math.sin(u) / u, 2));
    }
    return s;
  }

  function nearest(ps, x) {
    let b = null;
    ps.forEach(p => { if (!b || Math.abs(p.phi - x) < Math.abs(b.phi - x)) b = p; });
    return b;
  }

  /* угол в градусах и минутах со знаком */
  function fmAng(a) {
    const s = a < -1e-9 ? '−' : '+';
    let x = Math.abs(a);
    let dg = Math.floor(x + 1e-9), mn = Math.round((x - dg) * 60);
    if (mn >= 60) { mn -= 60; dg += 1; }
    return s + dg + '°' + (mn < 10 ? '0' : '') + mn + '′';
  }

  /* ---------- статические части схемы ---------- */
  {
    const g = $('vgdial');
    for (let a = -80; a <= 80; a += 2) {
      const big = a % 10 === 0;
      const c = Math.cos(a * RAD), s = Math.sin(a * RAD);
      VL.el('line', {
        x1: (CX + RD * c).toFixed(1), y1: (CY - RD * s).toFixed(1),
        x2: (CX + (RD + (big ? 8 : 4)) * c).toFixed(1),
        y2: (CY - (RD + (big ? 8 : 4)) * s).toFixed(1),
        stroke: big ? '#16161a' : '#6b6b74', 'stroke-width': big ? 1.2 : 0.8,
      }, g);
      if (a % 20 === 0) {
        const t = VL.el('text', {
          x: (CX + (RD + 14) * c).toFixed(1), y: (CY - (RD + 14) * s + 4).toFixed(1),
          'text-anchor': 'middle', style: 'font:10px system-ui;fill:#6b6b74',
        }, g);
        t.textContent = (a > 0 ? '+' : '') + a + '°';
      }
    }
    VL.el('path', {
      d: `M ${CX + RD * Math.cos(80 * RAD)} ${CY - RD * Math.sin(80 * RAD)} ` +
         `A ${RD} ${RD} 0 0 0 ${CX + RD * Math.cos(-80 * RAD)} ${CY + RD * Math.sin(80 * RAD)}`,
      fill: 'none', stroke: '#6b6b74', 'stroke-width': 1,
    }, g);
  }

  /* ---------- перерисовка ---------- */
  function draw() {
    const d = dNow(), N = Nlines(), ps = peaks();

    /* падающий пучок: его высота — ширина пучка на решётке */
    const h = VL.clamp(2 + beam * 1.6, 2.5, 22);
    $('vgbeam').setAttribute('y', (CY - h / 2).toFixed(1));
    $('vgbeam').setAttribute('height', h.toFixed(1));
    $('vgbeam').setAttribute('fill', src === 'laser' ? 'rgba(179,56,46,.35)' : 'rgba(21,94,117,.25)');
    $('vglamp').setAttribute('fill', src === 'laser' ? '#fdeeee' : '#eef6ef');
    $('vglampt').textContent = src === 'laser' ? 'лазер 650 нм' : 'ртутная лампа ДРШ';

    /* лучи порядков */
    const rg = $('vgrays');
    VL.clear(rg);
    ps.forEach(p => {
      const c = Math.cos(p.phi * RAD), s = Math.sin(p.phi * RAD);
      VL.el('line', {
        x1: CX, y1: CY, x2: (CX + RD * c).toFixed(1), y2: (CY - RD * s).toFixed(1),
        stroke: p.m === 0 ? '#16161a' : p.col, 'stroke-width': p.m === 0 ? 2 : 1.4,
        opacity: (0.35 + 0.6 * p.I).toFixed(2),
      }, rg);
    });

    /* зрительная труба */
    $('vgtube').setAttribute('transform', `rotate(${(-phi).toFixed(2)} ${CX} ${CY})`);

    /* поле зрения */
    const p0 = nearest(ps, phi);
    let sep = 0;
    ps.forEach(p => {
      if (p === p0) return;
      const s = Math.abs(p.phi - p0.phi);
      if (s > 1e-9 && s < 0.6 && (sep === 0 || s < sep)) sep = s;
    });
    const half = VL.clamp(Math.max(3 * width(p0), 1.7 * sep), 0.01, 2);
    const fg = $('vgfield');
    VL.clear(fg);
    const near = ps.filter(p => Math.abs(p.phi - phi) < half * 1.2);
    const XF = x => FX0 + (x - (phi - half)) / (2 * half) * (FX1 - FX0);
    let top = 0;
    const prof = [];
    for (let i = 0; i <= 300; i++) {
      const x = phi - half + 2 * half * i / 300;
      const v = inten(ps, x);
      if (v > top) top = v;
      prof.push([x, v]);
    }
    const scale = 1 / Math.max(top, 0.02);
    const YF = v => FY0 - VL.clamp(v * scale, 0, 1.02) * (FY0 - FY1);
    /* составляющие: видно, из чего складывается контур дублета */
    if (near.length > 1) {
      near.forEach(p => {
        const pts = prof.map(q => {
          const u = Math.PI * (q[0] - p.phi) / width(p);
          const v = p.I * (Math.abs(u) < 1e-7 ? 1 : Math.pow(Math.sin(u) / u, 2));
          return XF(q[0]).toFixed(1) + ',' + YF(v).toFixed(1);
        }).join(' ');
        VL.el('polyline', { points: pts, fill: 'none', stroke: p.col,
          'stroke-width': 1, 'stroke-dasharray': '4 3', opacity: 0.85 }, fg);
      });
    }
    VL.el('polyline', {
      points: prof.map(q => XF(q[0]).toFixed(1) + ',' + YF(q[1]).toFixed(1)).join(' '),
      fill: 'none', stroke: near.length ? (near[0].col) : '#6b6b74', 'stroke-width': 1.8,
    }, fg);
    /* шкала поля зрения в угловых минутах от креста нитей */
    [-1, -0.5, 0, 0.5, 1].forEach(k => {
      const x = XF(phi + k * half);
      VL.el('line', { x1: x.toFixed(1), y1: FY0, x2: x.toFixed(1), y2: FY0 + 5,
        stroke: '#6b6b74', 'stroke-width': 1 }, fg);
      const t = VL.el('text', { x: x.toFixed(1), y: FY0 + 17, 'text-anchor': 'middle',
        style: 'font:10px system-ui;fill:#6b6b74' }, fg);
      t.textContent = VL.fm(k * half * 60, 1);
    });

    /* показания: яркость — доля от максимума той линии, на которую наведена труба */
    const I0 = inten(ps, phi), Imax = inten(ps, p0.phi);
    const onLine = Math.abs(phi - p0.phi) <= Math.max(0.06, 2 * width(p0));
    const R = Math.abs(p0.m) * N;
    $('vgi1').textContent = 'решётка ' + GR[gi] + ' штр/мм, d = ' + VL.fm(d / 1000, 3) + ' мкм';
    $('vgi2').textContent = 'источник: ' + (src === 'laser' ? 'лазер' : 'ртутная лампа');
    $('vgi3').textContent = 'пучок ' + VL.fm(beam, 1) + ' мм → N = ' + N + ' штрихов';
    $('vgi4').textContent = 'труба: φ = ' + fmAng(phi);
    $('vgi5').textContent = onLine
      ? 'линия: ' + p0.name + ' ' + VL.fm(p0.lam, 2) + ' нм, m = ' + (p0.m > 0 ? '+' : '') + p0.m
      : 'крест нитей вне линии';
    $('vgi6').textContent = 'яркость ' + VL.fm(VL.clamp(100 * I0 / Imax, 0, 100), 0) +
      ' % · ширина линии ' +
      VL.fm(width(p0) * 60, 2) + '′';
    const mMax = P.grating(d, src === 'laser' ? LASER : 546.07, 1).mMax;
    $('vgi7').textContent = 'наибольший порядок m = ' + mMax +
      (mMax < 2 ? ' (второго порядка нет: d < 2λ)' : '');
    const col = c => $('vgi9').setAttribute('style', 'font:11px system-ui;fill:' + c);
    if (src === 'laser') {
      $('vgi8').textContent = 'R = mN = ' + R + ' — разрешающая способность';
      $('vgi9').textContent = 'у лазера одна линия: дублет смотрите на лампе';
      col('#6b6b74');
    } else {
      $('vgi8').textContent = 'R = mN = ' + R + ' (для дублета нужно ' + Math.round(R_REQ) + ')';
      $('vgi9').textContent = R >= R_REQ ? 'жёлтый дублет разрешается' : 'жёлтый дублет сливается';
      col(R >= R_REQ ? '#1a7f37' : '#b3382e');
    }
  }

  /* ---------- снятие отсчёта ---------- */
  function snap() {
    const ps = peaks(), p0 = nearest(ps, phi);
    if (Math.abs(phi - p0.phi) > Math.max(0.06, 2 * width(p0))) {
      $('vghint').textContent = 'Крест нитей не на линии: подведите трубу к максимуму ' +
        '(яркость должна быть близка к 100 %) и повторите отсчёт.';
      $('vghint').className = 'virt-hint alert';
      return;
    }
    if (p0.m === 0) {
      $('vghint').textContent = 'Это центральный максимум: при m = 0 равенство ' +
        'd sinφ = mλ выполняется для любой длины волны, определить λ по нему нельзя. ' +
        'По нему устанавливают нуль лимба.';
      $('vghint').className = 'virt-hint alert';
      return;
    }
    /* нониус лимба: отсчёт округляется до угловой минуты */
    const a = Math.round((phi + VL.gauss(0.4 * MINUTE)) / MINUTE) * MINUTE;
    rows.push({
      src: src, n: GR[gi], d: dNow(), m: p0.m, phi: a, name: p0.name,
      lamTrue: p0.lam, lam: dNow() * Math.sin(a * RAD) / p0.m,
    });
    const c = Math.cos(a * RAD), s = Math.sin(a * RAD);
    VL.el('line', {
      x1: (CX + (RD - 9) * c).toFixed(1), y1: (CY - (RD - 9) * s).toFixed(1),
      x2: (CX + RD * c).toFixed(1), y2: (CY - RD * s).toFixed(1),
      stroke: '#b3382e', 'stroke-width': 2,
    }, $('vgmarks'));
    render();
  }

  /* ---------- обработка ---------- */
  function render() {
    const out = $('vgout');
    const hint = $('vghint');
    hint.className = 'virt-hint';
    const cur = rows.filter(r => r.src === src && r.n === GR[gi]);
    if (!cur.length) {
      out.innerHTML = '';
      hint.textContent = 'Журнал для этой решётки и этого источника пуст. Наведите ' +
        'трубу на максимум и нажмите «снять отсчёт»; для обработки нужно не меньше ' +
        'трёх отсчётов одной линии.';
      return;
    }

    let h = '<h3>Журнал измерений</h3><p class="small">Показаны отсчёты для решётки ' +
      GR[gi] + ' штр/мм и выбранного источника: смешивать в одном ряду разные решётки ' +
      'и разные линии нельзя.</p>' +
      '<table class="el"><tr><th class="num">№</th><th class="num">m</th>' +
      '<th class="num">φ</th><th class="num">sin φ</th><th>линия</th>' +
      '<th class="num">λ = d sin φ / m, нм</th></tr>';
    cur.forEach((r, i) => {
      h += `<tr><td class="num">${i + 1}</td><td class="num">${r.m > 0 ? '+' : ''}${r.m}</td>` +
        `<td class="num">${fmAng(r.phi)}</td><td class="num">${VL.fm(Math.sin(r.phi * RAD), 4)}</td>` +
        `<td>${r.name}</td><td class="num"><b>${VL.fm(r.lam, 2)}</b></td></tr>`;
    });
    h += '</table>';

    /* рабочая линия — та, по которой снято больше всего отсчётов */
    const groups = {};
    cur.forEach(r => { (groups[r.lamTrue] = groups[r.lamTrue] || []).push(r); });
    let grp = null;
    Object.keys(groups).forEach(k => {
      if (!grp || groups[k].length > grp.length) grp = groups[k];
    });

    if (grp.length < 3) {
      h += '<p class="small">По одной линии снято пока ' + grp.length + ' отсчётов: ' +
        'для статистической обработки нужно не меньше трёх, а по методике практикума — ' +
        'пять-шесть, желательно в разных порядках и по обе стороны от центра.</p>';
      out.innerHTML = h;
      VL.mathify(out);
      hint.textContent = 'Снято отсчётов: ' + cur.length + '.';
      return;
    }

    /* приборная составляющая: Δλ = (d cos φ / m)·Δφ */
    const instr = grp.reduce((s, r) => s + r.d * Math.cos(r.phi * RAD) /
      Math.abs(r.m) * DPHI * RAD, 0) / grp.length;

    h += '<h3>Обработка ряда \\(\\lambda_i\\)</h3>' +
      '<p>Рабочая линия — <b>' + grp[0].name + '</b>; приборная составляющая ' +
      'получена логарифмическим дифференцированием рабочей формулы: ' +
      '\\(\\Delta\\lambda_{\\text{приб}} = \\dfrac{d\\cos\\varphi}{m}\\Delta\\varphi = ' +
      VL.lm(instr, 2) + '\\) нм при \\(\\Delta\\varphi = 1\' = 2{,}91\\cdot10^{-4}\\) рад.</p>';
    const pr = VL.processHtml({
      xs: grp.map(r => r.lam), instr: instr, sym: '\\lambda', unit: 'нм', dec: 2,
      trueVal: grp[0].lamTrue,
      trueName: (src === 'laser'
        ? 'длиной волны лазера, заложенной в модель'
        : 'табличным значением линии ртути'),
    });
    h += pr.html;

    /* систематика неразрешённого дублета */
    const N = Nlines();
    if (DUB.indexOf(grp[0].lamTrue) >= 0) {
      const mAv = grp.reduce((s, r) => s + Math.abs(r.m), 0) / grp.length;
      if (mAv * N < R_REQ) {
        h += '<div class="note warn"><b>Осторожно: дублет не разрешён.</b> При ' +
          `\\(mN \\approx ${Math.round(mAv * N)} < ${Math.round(R_REQ)}\\) труба видит не две линии, ` +
          'а одну размытую полосу, и крест нитей наводится на её середину — около 578,0 нм. ' +
          'Поэтому ряд систематически «промахивается» мимо каждой из компонент примерно ' +
          'на 1 нм: это не случайная ошибка, её не уменьшить числом отсчётов. Расширьте ' +
          'пучок или возьмите более частую решётку.</div>';
      }
    }

    /* --- МНК: sin φ = (λ/d)·m --- */
    const ms = {};
    grp.forEach(r => { ms[r.m] = 1; });
    if (Object.keys(ms).length >= 2) {
      const pts = grp.map(r => [r.m, Math.sin(r.phi * RAD)]);
      const o = M.lsqThroughOrigin(pts);
      const lamK = o.k * grp[0].d, dLamK = o.dk * grp[0].d;
      h += '<h3>Все порядки сразу: метод наименьших квадратов</h3>' +
        '<p>Рабочую формулу удобно переписать как \\(\\sin\\varphi = \\dfrac{\\lambda}{d}\\,m\\): ' +
        'точки \\((m,\\ \\sin\\varphi)\\) обязаны лечь на прямую, проходящую <b>через начало ' +
        'координат</b> (при \\(m=0\\) максимум ровно на оси при любой длине волны). ' +
        'Наклон этой прямой равен \\(\\lambda/d\\), и он использует все отсчёты сразу — ' +
        'в том числе отрицательные порядки, что автоматически исключает ошибку нуля лимба.</p>' +
        '<div id="vgmnk"></div><div class="panel steps">' +
        VL.step('\\(k = \\dfrac{\\sum m_i \\sin\\varphi_i}{\\sum m_i^2}\\)',
          'МНК через начало координат, ' + pts.length + ' точек',
          `\\(${VL.lm(o.k, 5)}\\)`) +
        VL.step('\\(\\Delta k = t_{\\alpha,n} S_k\\)',
          `\\(${VL.lm(o.t, 1)}\\cdot ${VL.lm(o.Sk, 6)}\\)`, `\\(${VL.lm(o.dk, 5)}\\)`) +
        VL.step('\\(\\lambda = k\\,d\\)',
          `\\(${VL.lm(o.k, 5)}\\cdot ${VL.lm(grp[0].d, 1)}\\)`, `\\(${VL.lm(lamK, 2)}\\) нм`) +
        VL.step('\\(\\Delta\\lambda = \\Delta k\\,d\\)',
          `\\(${VL.lm(o.dk, 5)}\\cdot ${VL.lm(grp[0].d, 1)}\\)`, `\\(${VL.lm(dLamK, 2)}\\) нм`) +
        '</div>';
      h += '<div class="ans"><b>Результат по МНК:</b> ' +
        VL.record('\\lambda', { mean: lamK, d: dLamK, alpha: 0.95 }, 'нм') + '.</div>';
      h += VL.verdict({ mean: lamK, d: dLamK, alpha: 0.95 }, grp[0].lamTrue,
        'заложенным в модель значением', 'нм', '\\lambda');
    } else {
      h += '<p class="small">Чтобы построить прямую \\(\\sin\\varphi(m)\\), снимите ' +
        'отсчёты хотя бы в двух разных порядках — например, \\(m=+1\\) и \\(m=-1\\).</p>';
    }

    /* --- разрешающая способность --- */
    const mView = Math.max.apply(null, grp.map(r => Math.abs(r.m)));
    h += '<h3>Разрешающая способность</h3><div class="panel steps">' +
      VL.step('\\(N = b\\,n\\)',
        `\\(${VL.lm(beam, 1)}\\) мм \\(\\cdot\\ ${GR[gi]}\\) штр/мм`, `\\(${N}\\) штрихов`) +
      VL.step('\\(R = mN\\)', `\\(${mView}\\cdot ${N}\\)`, `\\(${mView * N}\\)`) +
      VL.step('\\(R_{\\text{нужн}} = \\dfrac{\\lambda}{\\Delta\\lambda}\\)',
        '\\(578{,}0/2{,}11\\)', `\\(${Math.round(R_REQ)}\\)`) +
      VL.step('\\(\\delta\\lambda = \\dfrac{\\lambda}{mN}\\)',
        `\\(578{,}0/${mView * N}\\)`, `\\(${VL.lm(578 / (mView * N), 3)}\\) нм`) +
      '</div>' +
      '<p class="small">Наименьшая различимая разность длин волн \\(\\delta\\lambda\\) — ' +
      'это и есть «предел» вашей установки в данном опыте. ' +
      (mView * N >= R_REQ
        ? 'Он меньше расстояния между компонентами жёлтого дублета (2,11 нм), поэтому дублет виден раздельно.'
        : 'Он больше расстояния между компонентами жёлтого дублета (2,11 нм), поэтому дублет сливается в одну полосу.') +
      '</p>';

    out.innerHTML = h;
    if ($('vgmnk')) drawMnk(grp);
    VL.mathify(out);
    hint.textContent = 'Снято отсчётов: ' + cur.length + ' (по рабочей линии ' + grp.length + ').';
  }

  function drawMnk(grp) {
    const pts = grp.map(r => [r.m, Math.sin(r.phi * RAD)]);
    const o = M.lsqThroughOrigin(pts);
    const mm = Math.max.apply(null, pts.map(p => Math.abs(p[0]))) + 0.6;
    const sm = Math.max.apply(null, pts.map(p => Math.abs(p[1]))) * 1.25 + 0.02;
    const ch = VL.chart('vgmnk', '0 0 640 300');
    const ax = VL.axes(ch, {
      x0: 66, y0: 260, x1: 596, y1: 30, xmin: -mm, xmax: mm, ymin: -sm, ymax: sm,
      xticks: VL.ticks(-mm, mm, 6).map(v => ({ v: v, label: VL.fm(v, 0) })),
      yticks: VL.ticks(-sm, sm, 6).map(v => ({ v: v, label: VL.fm(v, 2) })),
      xlab: 'порядок m', ylab: 'sin φ',
    });
    VL.series(ch, [[ax.X(-mm), ax.Y(-o.k * mm)], [ax.X(mm), ax.Y(o.k * mm)]],
      '#6b6b74', null, { dash: '6 5', width: 1.4, noPoints: true });
    VL.series(ch, pts.map(p => [ax.X(p[0]), ax.Y(p[1])]), '#155e75',
      pts.map(p => `m = ${p[0]}, sin φ = ${VL.fm(p[1], 4)}`), { nolines: true });
    VL.label(ch, 330, 50, '#1a7f37',
      'наклон k = λ/d = ' + VL.fm(o.k, 5) + ' → λ = ' + VL.fm(o.k * grp[0].d, 2) + ' нм',
    { 'text-anchor': 'middle' });
    VL.label(ch, 330, 66, '#6b6b74',
      'прямая закреплена в начале координат: свободного члена нет',
      { 'text-anchor': 'middle' });
  }

  /* ---------- органы управления ---------- */
  VL.slider('vgphi', 'vgphiv', v => fmAng(v), v => { phi = v; draw(); });
  VL.slider('vgb', 'vgbv', v => VL.fm(v, 1) + ' мм', v => { beam = v; draw(); render(); });
  $('vggr').addEventListener('change', function () {
    gi = GR.indexOf(parseInt(this.value, 10));
    VL.clear($('vgmarks'));
    rows.filter(r => r.n === GR[gi] && r.src === src).forEach(r => {
      const c = Math.cos(r.phi * RAD), s = Math.sin(r.phi * RAD);
      VL.el('line', {
        x1: (CX + (RD - 9) * c).toFixed(1), y1: (CY - (RD - 9) * s).toFixed(1),
        x2: (CX + RD * c).toFixed(1), y2: (CY - RD * s).toFixed(1),
        stroke: '#b3382e', 'stroke-width': 2,
      }, $('vgmarks'));
    });
    draw(); render();
  });
  $('vgsrc').addEventListener('change', function () {
    src = this.value;
    $('vggr').dispatchEvent(new Event('change'));
  });

  $('vgsnap').addEventListener('click', snap);
  $('vgreset').addEventListener('click', () => {
    rows.length = 0;
    VL.clear($('vgmarks'));
    render();
  });

  /* ---------- авто-опыт ---------- */
  function targets() {
    const line = src === 'laser' ? LASER : 546.07;
    const base = [];
    [1, -1, 2, -2, 3, -3].forEach(m => {
      const a = P.grating(dNow(), line, m).angleDeg;
      if (a != null && Math.abs(a) <= 80) base.push(m);
    });
    if (!base.length) return [];
    const out = [];
    while (out.length < 6) {
      for (let i = 0; i < base.length && out.length < 8; i++) out.push(base[i]);
    }
    return out;
  }

  VL.auto({
    autoBtn: 'vgauto', stopBtn: 'vgstop',
    lockIds: ['vgsnap', 'vgreset', 'vgphi', 'vgb', 'vggr', 'vgsrc'],
    total: () => targets().length,
    progress: (i, n) => {
      const p = $('vgprog'); p.style.display = ''; p.textContent = `отсчёт ${i} из ${n}`;
    },
    step: async (i, ctl) => {
      const list = targets();
      const line = src === 'laser' ? LASER : 546.07;
      const a = P.grating(dNow(), line, list[i]).angleDeg + VL.gauss(SIG_AIM);
      const s = $('vgphi');
      s.value = a.toFixed(2);
      s.dispatchEvent(new Event('input'));
      await ctl.sleep(320);
      if (!ctl.aborted()) snap();
    },
    onFinish: (aborted, done, n) => {
      $('vgprog').style.display = 'none';
      $('vghint').textContent = aborted
        ? `Прогон остановлен: снято ${done} из ${n} отсчётов.`
        : 'Робот навёл трубу на ' + (src === 'laser' ? 'линию лазера' : 'зелёную линию 546,07 нм') +
          ' во всех доступных порядках по обе стороны от центра — ниже обработка ряда и МНК.';
    },
  });

  draw();
  render();
})();
