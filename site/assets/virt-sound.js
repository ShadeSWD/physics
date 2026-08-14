/* Работа 1-8. Скорость звука методом стоячих волн.
 * Модель: v_t = v₀√(1+αt), λ = v_t/ν, λ_ст = λ/2; микрофон читает звуковое
 * давление U ∝ |cos(π(l−l₀)/λ_ст)|. По ряду разностей соседних максимумов
 * считается скорость звука, приведённая к 0 °C. */
'use strict';
(function () {
  const $ = id => document.getElementById(id);
  const svg = $('vs');
  if (!svg || !window.VL) return;

  const V0 = 331.5;          // истинная скорость звука при 0 °C, м/с
  const NU = 6300, D_NU = 100;
  const ALPHA = 0.004;
  const D_LAM = 0.5;         // приборная погрешность, мм
  const D_T = 0.25;          // приборная погрешность термометра, °C
  const SIG = 0.4;           // СКО поиска максимума на глаз, мм
  const L0 = 3;              // положение первого максимума, мм
  const X0 = 170, PXMM = 2.0, YC = 149;   // левый край трубы и масштаб

  let l = 3, temp = 20, tt = 0;
  const rows = [];           // отсчёты l_i, мм

  const lamST = () => 1000 * V0 * Math.sqrt(1 + ALPHA * temp) / NU / 2;   /* мм */
  const U = x => Math.abs(Math.cos(Math.PI * (x - L0) / lamST()));

  /* шкала трубы */
  {
    const g = $('vsscale');
    VL.el('line', { x1: X0, y1: 196, x2: X0 + 200 * PXMM, y2: 196, stroke: '#16161a', 'stroke-width': 1.2 }, g);
    for (let mm = 0; mm <= 200; mm += 10) {
      const x = X0 + mm * PXMM;
      VL.el('line', { x1: x, y1: 196, x2: x, y2: mm % 50 ? 201 : 206, stroke: '#6b6b74', 'stroke-width': 1 }, g);
      if (mm % 50 === 0) {
        const t = VL.el('text', { x: x, y: 220, 'text-anchor': 'middle' }, g);
        t.textContent = String(mm);
      }
    }
    const cap = VL.el('text', { x: X0 + 200 * PXMM, y: 236, 'text-anchor': 'end' }, g);
    cap.textContent = 'положение микрофона l, мм';
  }

  /* ---------- анимация ---------- */
  VL.loop(function (dt) {
    tt += dt;
    const lam = lamST();
    const ph = Math.sin(2 * Math.PI * 1.6 * tt);
    const w = [], e1 = [], e2 = [];
    for (let i = 0; i <= 160; i++) {
      const mm = 200 * i / 160;
      const x = X0 + mm * PXMM;
      /* смещение: узлы там, где давление максимально */
      const s = 24 * Math.sin(Math.PI * (mm - L0) / lam);
      w.push(x.toFixed(1) + ',' + (YC - s * ph).toFixed(1));
      e1.push(x.toFixed(1) + ',' + (YC - Math.abs(s)).toFixed(1));
      e2.push(x.toFixed(1) + ',' + (YC + Math.abs(s)).toFixed(1));
    }
    $('vswave').setAttribute('points', w.join(' '));
    $('vsenv1').setAttribute('points', e1.join(' '));
    $('vsenv2').setAttribute('points', e2.join(' '));
    /* узлы смещения = пучности давления */
    const g = $('vsnodes');
    while (g.firstChild) g.removeChild(g.firstChild);
    for (let k = 0; ; k++) {
      const mm = L0 + k * lam;
      if (mm > 200) break;
      VL.el('circle', {
        cx: (X0 + mm * PXMM).toFixed(1), cy: YC, r: 2.6, fill: '#16161a',
      }, g);
    }
    /* микрофон на штоке: ручка снаружи неподвижна, шток укорачивается */
    const xm = X0 + l * PXMM;
    $('vsmic').setAttribute('x', (xm - 6).toFixed(1));
    $('vsrod').setAttribute('x1', (xm + 6).toFixed(1));
    /* стрелка вольтметра */
    const u = U(l);
    const a = (-60 + 120 * u) * Math.PI / 180;
    $('vsneedle').setAttribute('x2', (82 + 38 * Math.sin(a)).toFixed(1));
    $('vsneedle').setAttribute('y2', (282 - 38 * Math.cos(a)).toFixed(1));
    $('vsread').textContent = 'l = ' + VL.fm(l, 1) + ' мм · U = ' + VL.fm(u * 100, 0) +
      ' % · ' + (u > 0.995 ? 'максимум' : u < 0.05 ? 'минимум' : 'между максимумами');
  });

  /* ---------- измерение ---------- */
  function snap() {
    const v = Math.round((l + VL.noise(0.3)) * 2) / 2;
    rows.push(v);
    const x = X0 + v * PXMM;
    VL.el('line', {
      x1: x.toFixed(1), y1: 182, x2: x.toFixed(1), y2: 193,
      stroke: '#b3382e', 'stroke-width': 1.6,
    }, $('vsmarks'));
    render();
  }

  /* ---------- обработка ---------- */
  function render() {
    const out = $('vsout');
    if (!rows.length) {
      out.innerHTML = '';
      $('vshint').textContent = 'Журнал пуст. Найдите максимум показаний вольтметра ' +
        'и снимите отсчёт; затем следующий максимум, и так не меньше семи раз.';
      return;
    }
    const sorted = rows.slice().sort((a, b) => a - b);
    const lam = [];
    for (let i = 1; i < sorted.length; i++) lam.push(sorted[i] - sorted[i - 1]);

    let html = '<h3>Журнал измерений</h3><table class="el"><tr><th class="num">№</th>' +
      '<th class="num">l, мм</th><th class="num">λ_ст = l<sub>i+1</sub> − l<sub>i</sub>, мм</th></tr>';
    sorted.forEach((v, i) => {
      html += `<tr><td class="num">${i + 1}</td><td class="num">${VL.fm(v, 1)}</td>` +
        `<td class="num">${i < lam.length ? '<b>' + VL.fm(lam[i], 1) + '</b>' : '—'}</td></tr>`;
    });
    html += '</table>';

    if (lam.length < 3) {
      html += '<p class="small">Разностей пока ' + lam.length + ': для статистической ' +
        'обработки нужно не меньше трёх, то есть четыре отсчёта.</p>';
      out.innerHTML = html; VL.mathify(out);
      $('vshint').textContent = 'Снято отсчётов: ' + rows.length + '.';
      return;
    }

    html += '<h3>Обработка ряда \\(\\lambda_{\\text{ст}}\\)</h3>';
    const pr = VL.processHtml({
      xs: lam, instr: D_LAM, sym: '\\lambda', unit: 'мм', dec: 1,
      trueVal: lamST(), trueName: 'длиной стоячей волны, заложенной в модель',
    });
    html += pr.html;

    const lm = pr.st.mean / 1000, dl = pr.st.d / 1000;      /* м */
    const v0 = 2 * lm * NU / Math.sqrt(1 + ALPHA * temp);
    const rel = Math.sqrt(Math.pow(dl / lm, 2) + Math.pow(D_NU / NU, 2)
      + Math.pow(ALPHA * D_T / (2 * (1 + ALPHA * temp)), 2));
    const dv = v0 * rel;

    html += '<h3>Скорость звука</h3><div class="panel steps">' +
      VL.step('\\(v_t = 2\\overline{\\lambda}_{\\text{ст}}\\nu\\)',
        `\\(2\\cdot ${VL.lm(lm * 1000, 1)}\\cdot 10^{-3}\\cdot 6300\\)`,
        `\\(${VL.lm(2 * lm * NU, 1)}\\) м/с`) +
      VL.step('\\(v_0 = \\dfrac{2\\overline{\\lambda}_{\\text{ст}}\\nu}{\\sqrt{1+\\alpha t}}\\)',
        `\\(${VL.lm(2 * lm * NU, 1)}/\\sqrt{1+0{,}004\\cdot ${VL.lm(temp, 1)}}\\)`,
        `\\(${VL.lm(v0, 1)}\\) м/с`) +
      VL.step('\\(\\dfrac{\\Delta v_0}{v_0}\\)',
        `\\(\\sqrt{${VL.lm(dl / lm, 4)}^2 + 0{,}0159^2 + ${VL.lm(ALPHA * D_T / (2 * (1 + ALPHA * temp)), 5)}^2}\\)`,
        `\\(${VL.lm(rel * 100, 1)}\\,\\%\\)`) +
      VL.step('\\(\\Delta v_0\\)', `\\(${VL.lm(v0, 1)}\\cdot ${VL.lm(rel, 4)}\\)`,
        `\\(${VL.lm(dv, 1)}\\) м/с`) + '</div>';
    const st = { mean: v0, d: dv, alpha: 0.95 };
    html += '<div class="ans"><b>Результат вашего опыта:</b> ' +
      VL.record('v_0', st, 'м/с') + '.</div>';
    html += VL.verdict(st, 331.8, 'табличным значением 331,8 м/с', 'м/с', 'v_0');
    html += '<p class="small">Вклад частоты в погрешность — 1,6 %, то есть около ' +
      '5 м/с; уменьшить его без более точного генератора нельзя. Температурный ' +
      'член — сотые доли процента: приведение к нулю градусов почти не добавляет ' +
      'погрешности, хотя саму поправку (около 4 % при комнатной температуре) ' +
      'игнорировать нельзя.</p>';

    out.innerHTML = html;
    VL.mathify(out);
    $('vshint').textContent = 'Снято отсчётов: ' + rows.length + ', разностей: ' + lam.length + '.';
  }

  /* ---------- органы управления ---------- */
  VL.slider('vsL', 'vsLv', v => VL.fm(v, 1) + ' мм', v => { l = v; });
  VL.slider('vsT', 'vsTv', v => VL.fm(v, 1) + ' °C', v => { temp = v; });

  $('vssnap').addEventListener('click', snap);
  $('vsreset').addEventListener('click', () => {
    rows.length = 0;
    const g = $('vsmarks');
    while (g.firstChild) g.removeChild(g.firstChild);
    render();
  });

  VL.auto({
    autoBtn: 'vsauto', stopBtn: 'vsstop',
    lockIds: ['vssnap', 'vsreset', 'vsL', 'vsT'],
    total: () => 7,
    progress: (i, n) => {
      const p = $('vsprog'); p.style.display = ''; p.textContent = `максимум ${i} из ${n}`;
    },
    step: async (i, ctl) => {
      if (i === 0) {
        rows.length = 0;
        const g = $('vsmarks');
        while (g.firstChild) g.removeChild(g.firstChild);
        render();
      }
      /* «лаборант» подводит микрофон к очередному максимуму с ошибкой на глаз */
      const target = VL.clamp(L0 + i * lamST() + VL.gauss(SIG), 0, 200);
      const s = $('vsL');
      s.value = Math.round(target * 2) / 2;
      s.dispatchEvent(new Event('input'));
      await ctl.sleep(320);
      if (!ctl.aborted()) snap();
    },
    onFinish: (aborted, done, n) => {
      $('vsprog').style.display = 'none';
      $('vshint').textContent = aborted
        ? `Прогон остановлен: снято ${done} из ${n} максимумов.`
        : 'Семь максимумов найдены — ниже обработка ряда и скорость звука.';
    },
  });

  render();
})();
