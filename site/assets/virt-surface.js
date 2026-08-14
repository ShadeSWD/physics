/* Работа 1-7. Поверхностное натяжение способом отрыва кольца.
 * Модель: сила отрыва P = σ·2π(D − h); пружина с указателем — нуль-индикатор,
 * силу задают грузы. По ряду P_i выполняется обработка, размеры кольца
 * измеряются штангенциркулем, σ сравнивается с табличным значением. */
'use strict';
(function () {
  const $ = id => document.getElementById(id);
  const svg = $('vf');
  if (!svg || !window.VL) return;

  const G = 9.81;
  const LIQ = {
    water: { name: 'дистиллированная вода', s: 0.073, rho: 999 },
    alcohol: { name: 'метиловый спирт', s: 0.023, rho: 793 },
    oil: { name: 'касторовое масло', s: 0.035, rho: 961 },
  };
  const D_TRUE = 0.0600, H_TRUE = 0.00185;   // размеры кольца, м
  const D_CAL = 0.00005;                     // приборная погрешность штангенциркуля, м
  const SIG_D = 0.00012, SIG_H = 0.00012;    // разброс размеров по кольцу, м
  const QM = 0.02e-3;                        // наименьшая гиря, кг
  const D_M = 0.01e-3;                       // приборная погрешность массы, кг
  const SIG_P = 0.025;                       // относительный разброс силы отрыва
  const PXG = 12 / 1e-3;                     // растяжение пружины: px на кг
  const YN0 = 100, YR0 = 182, YSURF0 = 182;  // нулевые положения, px

  let liq = 'water', tt = 0;
  let phase = 'idle', pel = 0, stretch = 0, drop = 0, mark = 0, nw = 0, curP = 0;
  let mDone = null;
  const rows = [];      // опыты отрыва
  const dims = [];      // измерения кольца

  const Ptrue = () => LIQ[liq].s * 2 * Math.PI * (D_TRUE - H_TRUE);

  /* шкала стойки */
  {
    const g = $('vfscale');
    for (let i = 0; i <= 26; i++) {
      const y = YN0 + i * 6;
      VL.el('line', {
        x1: 134, y1: y, x2: i % 4 ? 142 : 148, y2: y, stroke: '#6b6b74', 'stroke-width': 1,
      }, g);
      if (i % 4 === 0) {
        const t = VL.el('text', { x: 130, y: y + 4, 'text-anchor': 'end' }, g);
        t.textContent = String(i * 5);
      }
    }
    const c = VL.el('text', { x: 96, y: 90, style: 'font:11px system-ui;fill:#6b6b74' }, g);
    c.textContent = 'шкала, мм';
  }

  /* ---------- рисование ---------- */
  function drawSpring(yEnd) {
    const y0 = 34, n = 12, w = 11;
    let d = `M 250 ${y0}`;
    for (let i = 1; i <= n; i++) {
      const y = y0 + (yEnd - y0) * i / n;
      d += ` L ${250 + (i % 2 ? w : -w)} ${y.toFixed(1)}`;
    }
    d += ` L 250 ${yEnd.toFixed(1)}`;
    $('vfspring').setAttribute('d', d);
  }

  function draw() {
    const yN = YN0 + stretch;
    const yR = YR0 + stretch;
    $('vfmove').setAttribute('transform', `translate(0,${stretch.toFixed(1)})`);
    drawSpring(yN);
    $('vftable').setAttribute('transform', `translate(0,${drop.toFixed(1)})`);
    /* поверхность жидкости с лёгкой рябью */
    const ys = YSURF0;
    let p = `M 198 ${ys}`;
    for (let i = 1; i <= 20; i++) {
      const x = 198 + 104 * i / 20;
      const y = ys + 1.2 * Math.sin(i * 0.9 + tt * 2.2);
      p += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    $('vfsurf').setAttribute('d', p);
    $('vfliq').setAttribute('d', p + ' L 302 276 L 198 276 Z');
    /* мениск между поверхностью и кольцом, пока плёнка цела */
    const film = (phase === 'pull');
    const gapTop = yR, gapBot = ys + drop;
    if (film && gapBot > gapTop + 1) {
      $('vfmen1').setAttribute('d',
        `M 205 ${gapTop.toFixed(1)} C 212 ${((gapTop + gapBot) / 2).toFixed(1)} 200 ${((gapTop + gapBot) / 2).toFixed(1)} 207 ${gapBot.toFixed(1)}`);
      $('vfmen2').setAttribute('d',
        `M 295 ${gapTop.toFixed(1)} C 288 ${((gapTop + gapBot) / 2).toFixed(1)} 300 ${((gapTop + gapBot) / 2).toFixed(1)} 293 ${gapBot.toFixed(1)}`);
    } else {
      $('vfmen1').setAttribute('d', '');
      $('vfmen2').setAttribute('d', '');
    }
    /* грузы на чашечке */
    const g = $('vfw');
    while (g.childNodes.length > nw) g.removeChild(g.lastChild);
    while (g.childNodes.length < nw) {
      const i = g.childNodes.length;
      VL.el('rect', {
        x: 236, y: 100 - 7 * (i + 1), width: 28, height: 6, rx: 1,
        fill: '#fff', stroke: '#16161a', 'stroke-width': 1.1,
      }, g);
    }
    $('vfscrew').setAttribute('x2', (340 + 11 * Math.sin(drop * 0.25)).toFixed(1));
    $('vfscrew').setAttribute('y2', (282 - 11 * Math.cos(drop * 0.25)).toFixed(1));
  }

  /* ---------- цикл ---------- */
  VL.loop(function (dt) {
    tt += dt;
    pel += dt;
    if (phase === 'pull') {
      const k = Math.min(1, pel / 1.1);
      drop = 42 * k;
      stretch = mark * k;
      $('vfst').textContent = 'столик опускается, плёнка тянется';
      if (k >= 1) { phase = 'snap'; pel = 0; }
    } else if (phase === 'snap') {
      const k = Math.min(1, pel / 0.4);
      stretch = mark * (1 - k) * Math.cos(k * 9) * Math.exp(-k * 3);
      $('vfst').textContent = 'плёнка разорвалась — отрыв!';
      $('vfmark').setAttribute('opacity', 1);
      $('vfmarkt').setAttribute('opacity', 1);
      $('vfmark').setAttribute('y1', (YN0 + mark).toFixed(1));
      $('vfmark').setAttribute('y2', (YN0 + mark).toFixed(1));
      $('vfmarkt').setAttribute('y', (YN0 + mark + 4).toFixed(1));
      if (k >= 1) { phase = 'weigh'; pel = 0; stretch = 0; }
    } else if (phase === 'weigh') {
      const k = Math.min(1, pel / 1.1);
      stretch = mark * k;
      nw = Math.min(6, Math.round(6 * k));
      $('vfst').textContent = 'подбор грузов до метки отрыва';
      $('vfm').textContent = 'm = ' + VL.fm(curP / G * 1000 * k, 2) + ' г';
      if (k >= 1) {
        phase = 'rest'; pel = 0;
        addRow();
      }
    } else if (phase === 'rest') {
      const k = Math.min(1, pel / 0.6);
      drop = 42 * (1 - k);
      stretch = mark * (1 - k);
      nw = Math.round(6 * (1 - k));
      $('vfst').textContent = 'возврат в исходное положение';
      if (k >= 1) {
        phase = 'idle'; pel = 0; stretch = 0; drop = 0; nw = 0;
        if (mDone) { const f = mDone; mDone = null; f(); }
      }
    } else {
      stretch = 0.4 * Math.sin(tt * 1.7);
      $('vfst').textContent = 'кольцо смочено, готов к опыту';
    }
    draw();
  });

  /* ---------- измерения ---------- */
  function measure() {
    if (phase !== 'idle') return Promise.resolve();
    let P = Ptrue() * (1 + VL.gauss(SIG_P));
    let m = Math.round(P / G / QM) * QM;        /* подбор набором разновесов */
    curP = m * G;
    mark = VL.clamp(curP * PXG, 4, 40);
    phase = 'pull'; pel = 0;
    return new Promise(r => { mDone = r; });
  }
  function addRow() {
    rows.push({ liq, P: curP, m: curP / G });
    $('vfm').textContent = 'm = ' + VL.fm(curP / G * 1000, 2) + ' г';
    render();
  }
  function caliper() {
    dims.push({
      D: Math.round((D_TRUE + VL.gauss(SIG_D)) / 1e-5) * 1e-5,
      h: Math.round((H_TRUE + VL.gauss(SIG_H)) / 1e-5) * 1e-5,
    });
    render();
  }

  /* ---------- обработка ---------- */
  function render() {
    const out = $('vfout');
    if (!rows.length && !dims.length) {
      out.innerHTML = '';
      $('vfhint').textContent = 'Журнал пуст. По методике опыт с отрыванием кольца ' +
        'выполняют шесть раз, диаметр и толщину кольца измеряют тоже по шесть раз.';
      return;
    }
    let html = '';
    const grp = rows.filter(r => r.liq === liq);

    if (rows.length) {
      html += '<h3>Журнал: опыты с отрыванием кольца</h3><table class="el">' +
        '<tr><th class="num">№</th><th class="num">жидкость</th>' +
        '<th class="num">m, г</th><th class="num">P = mg, мН</th></tr>';
      rows.forEach((r, i) => {
        html += `<tr><td class="num">${i + 1}</td><td class="num">${LIQ[r.liq].name}</td>` +
          `<td class="num">${VL.fm(r.m * 1000, 2)}</td>` +
          `<td class="num"><b>${VL.fm(r.P * 1000, 2)}</b></td></tr>`;
      });
      html += '</table>';
    }
    if (dims.length) {
      html += '<h3>Журнал: размеры кольца</h3><table class="el">' +
        '<tr><th class="num">№</th><th class="num">D, мм</th><th class="num">h, мм</th></tr>';
      dims.forEach((d, i) => {
        html += `<tr><td class="num">${i + 1}</td><td class="num">${VL.fm(d.D * 1000, 2)}</td>` +
          `<td class="num">${VL.fm(d.h * 1000, 2)}</td></tr>`;
      });
      html += '</table>';
    }

    if (grp.length < 3 || dims.length < 3) {
      html += '<p class="small">Для обработки нужно не меньше трёх опытов с ' +
        'отрыванием кольца в одной и той же жидкости и не меньше трёх измерений ' +
        'размеров кольца. Сейчас: опытов — ' + grp.length + ', измерений кольца — ' +
        dims.length + '.</p>';
      out.innerHTML = html; VL.mathify(out);
      $('vfhint').textContent = 'Опытов: ' + grp.length + ', измерений кольца: ' + dims.length + '.';
      return;
    }

    /* ряд сил отрыва */
    html += '<h3>Обработка ряда сил отрыва</h3>';
    const pr = VL.processHtml({
      xs: grp.map(r => r.P * 1000), instr: D_M * G * 1000, sym: 'P', unit: 'мН', dec: 2,
      trueVal: Ptrue() * 1000, trueName: 'силой отрыва, заложенной в модель',
    });
    html += pr.html;

    /* размеры кольца */
    const sD = VL.stats(dims.map(d => d.D * 1000), D_CAL * 1000);
    const sH = VL.stats(dims.map(d => d.h * 1000), D_CAL * 1000);
    html += '<h3>Размеры кольца</h3><div class="panel steps">' +
      VL.step('\\(\\langle D\\rangle\\pm\\Delta D\\)', 'по шести измерениям штангенциркулем',
        VL.record('D', sD, 'мм')) +
      VL.step('\\(\\langle h\\rangle\\pm\\Delta h\\)', 'по шести измерениям штангенциркулем',
        VL.record('h', sH, 'мм')) + '</div>';

    /* коэффициент поверхностного натяжения */
    const P = pr.st.mean / 1000, dP = pr.st.d / 1000;
    const D = sD.mean / 1000, dD = sD.d / 1000;
    const h = sH.mean / 1000, dh = sH.d / 1000;
    const s = P / (2 * Math.PI * (D - h));
    const rel = Math.sqrt(Math.pow(dP / P, 2) + Math.pow(dD / (D - h), 2)
      + Math.pow(dh / (D - h), 2));
    const ds = s * rel;

    html += '<h3>Коэффициент поверхностного натяжения</h3><div class="panel steps">' +
      VL.step('\\(\\sigma = \\dfrac{P}{2\\pi(D-h)}\\)',
        `\\(\\dfrac{${VL.lm(P * 1000, 2)}\\cdot 10^{-3}}{2\\pi(${VL.lm(D * 1000, 2)}-${VL.lm(h * 1000, 2)})\\cdot 10^{-3}}\\)`,
        `\\(${VL.lm(s, 4)}\\) Н/м`) +
      VL.step('\\(\\dfrac{\\Delta\\sigma}{\\sigma}=\\sqrt{\\left(\\dfrac{\\Delta P}{P}\\right)^2' +
        '+\\left(\\dfrac{\\Delta D}{D-h}\\right)^2+\\left(\\dfrac{\\Delta h}{D-h}\\right)^2}\\)',
        `\\(\\sqrt{${VL.lm(dP / P, 4)}^2 + ${VL.lm(dD / (D - h), 4)}^2 + ${VL.lm(dh / (D - h), 4)}^2}\\)`,
        `\\(${VL.lm(rel * 100, 1)}\\,\\%\\)`) +
      VL.step('\\(\\Delta\\sigma\\)', `\\(${VL.lm(s, 4)}\\cdot ${VL.lm(rel, 4)}\\)`,
        `\\(${VL.lm(ds, 4)}\\) Н/м`) + '</div>';
    const st = { mean: s, d: ds, alpha: 0.95 };
    html += '<div class="ans"><b>Результат вашего опыта:</b> ' +
      VL.record('\\sigma', st, 'Н/м') + '.</div>';
    html += VL.verdict(st, LIQ[liq].s,
      'табличным значением для жидкости «' + LIQ[liq].name + '» при 18 °C',
      'Н/м', '\\sigma');
    html += '<p class="small">Основной вклад в погрешность даёт подбор грузов: ' +
      'относительная погрешность силы — ' + VL.fm(dP / P * 100, 1) + ' %, тогда как ' +
      'вклад размеров кольца — доли процента. Чтобы повысить точность, нужен не ' +
      'более точный штангенциркуль, а более мелкий набор разновесов.</p>';

    out.innerHTML = html;
    VL.mathify(out);
    $('vfhint').textContent = 'Опытов в текущей жидкости: ' + grp.length +
      ', измерений кольца: ' + dims.length + '.';
  }

  /* ---------- органы управления ---------- */
  $('vfliqsel').addEventListener('change', function () {
    liq = this.value;
    $('vfl').textContent = 'жидкость: ' + LIQ[liq].name;
    render();
  });
  $('vfsnap').addEventListener('click', () => { measure(); });
  $('vfmic').addEventListener('click', caliper);
  $('vfreset').addEventListener('click', () => {
    rows.length = 0; dims.length = 0;
    $('vfmark').setAttribute('opacity', 0);
    $('vfmarkt').setAttribute('opacity', 0);
    $('vfm').textContent = 'm = 0,00 г';
    render();
  });

  VL.auto({
    autoBtn: 'vfauto', stopBtn: 'vfstop',
    lockIds: ['vfsnap', 'vfmic', 'vfreset', 'vfliqsel'],
    total: () => 12,
    progress: (i, n) => {
      const p = $('vfprog'); p.style.display = '';
      p.textContent = i <= 6 ? `опыт ${i} из 6` : `размер ${i - 6} из 6`;
    },
    step: async (i, ctl) => {
      if (i === 0) { rows.length = 0; dims.length = 0; render(); }
      if (i < 6) { await measure(); return; }
      caliper();
      await ctl.sleep(180);
    },
    onFinish: (aborted, done, n) => {
      $('vfprog').style.display = 'none';
      $('vfhint').textContent = aborted
        ? `Прогон остановлен: выполнено ${done} из ${n} шагов.`
        : 'Полный прогон выполнен: шесть отрывов кольца и шесть измерений размеров.';
    },
  });

  render();
})();
