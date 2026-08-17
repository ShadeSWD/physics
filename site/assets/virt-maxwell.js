/* Работа 1-13. Момент инерции маятника Максвелла.
 * Модель: a = g(1 − η)/(1 + I/(mR²)), h = at²/2; подъём на h₂ = k·h.
 * По ряду I_i выполняется обработка, отдельно считаются потери энергии. */
'use strict';
(function () {
  const svg = $('vm');
  if (!svg || !window.VL) return;

  const M0 = 0.033, MD = 0.1255, MK = 0.3871;        // массы оси, диска, кольца, кг
  const R0 = 0.005, RN = 0.0002, RD = 0.043, RK = 0.053;
  const R = R0 + 2 * RN;                              // эффективный радиус, м
  const D_R = Math.sqrt(0.0005 * 0.0005 + Math.pow(2 * 0.00005, 2));
  const D_H = 0.001;
  const ETA = 0.02;          // доля момента, съедаемая трением
  const K_UP = 0.90;         // высота подъёма относительно высоты старта
  const SIG = 0.012;         // относительное СКО времени
  const QT = 0.001;
  const CX = 210, Y0 = 150, S = 400;   // центр маятника вверху и масштаб, px на метр

  let hSet = 0.30, withRing = true;
  let hc = 0.30, pos = 0, ph = 'down', pel = 0, ang = 0, hStart = 0;
  let measuring = false, mTime = 0, mDone = null, lastH2 = 0;
  const rows = [];

  const mass = () => M0 + MD + (withRing ? MK : 0);
  const Ith = () => M0 * R0 * R0 / 2 + MD * (RD * RD + R0 * R0) / 2
    + (withRing ? MK * (RK * RK + RD * RD) / 2 : 0);
  const accel = () => G * (1 - ETA) / (1 + Ith() / (mass() * R * R));

  /* спицы диска для наглядного вращения */
  {
    const g = $('vmspokes');
    for (let i = 0; i < 6; i++) VL.el('line', {}, g);
    const sc = $('vmscale');
    for (let i = 0; i <= 8; i++) {
      const y = Y0 + i * 20;
      VL.el('line', { x1: 98, y1: y, x2: 106, y2: y, stroke: '#6b6b74', 'stroke-width': 1 }, sc);
      if (i % 2 === 0) {
        const t = VL.el('text', { x: 94, y: y + 4, 'text-anchor': 'end' }, sc);
        t.textContent = VL.fm(i * 0.05, 2);
      }
    }
    VL.label(sc, 60, Y0 - 10, '#6b6b74', 'шкала, м');
  }

  function layout() {
    const yb = Y0 + hSet * S;
    $('vmgate').setAttribute('transform', 'translate(0,' + (yb - 270).toFixed(1) + ')');
    $('vmdim').setAttribute('y2', yb.toFixed(1));
    $('vmht').setAttribute('y', (Y0 + hSet * S / 2 + 4).toFixed(1));
    $('vmht').textContent = 'h = ' + VL.fm(hSet, 2) + ' м';
    $('vmring').setAttribute('opacity', withRing ? 1 : 0);
    $('vminfo').textContent = 'I расчётное = ' + VL.fm(Ith() * 1000, 3) + '·10⁻³ кг·м²';
  }

  function draw() {
    const y = Y0 + pos * S;
    $('vmpend').setAttribute('transform', `translate(0,${(pos * S).toFixed(1)})`);
    const sp = $('vmspokes').children;
    for (let i = 0; i < 6; i++) {
      const a = ang + i * Math.PI / 3;
      sp[i].setAttribute('x1', CX); sp[i].setAttribute('y1', Y0);
      sp[i].setAttribute('x2', (CX + 32 * Math.cos(a)).toFixed(1));
      sp[i].setAttribute('y2', (Y0 + 32 * Math.sin(a)).toFixed(1));
    }
    $('vmt1').setAttribute('y2', y.toFixed(1));
    $('vmt2').setAttribute('y2', y.toFixed(1));
  }

  /* ---------- цикл ---------- */
  VL.loop(function (dt) {
    const dur = 1.4;
    pel += dt;
    const k = Math.min(1, pel / dur);
    if (ph === 'down') {
      pos = hStart + hc * k * k;
      ang += dt * 9 * k;
      if (measuring) {
        $('vmt').textContent = VL.fm(k * mTime, 3) + ' с';
        $('vmst').textContent = 'опускается, отсчёт идёт';
        $('vmled').setAttribute('fill', '#b3382e');
      } else {
        $('vmst').textContent = 'свободный ход: опускается';
      }
      if (k >= 1) {
        const h2 = hc * K_UP * (1 + VL.gauss(0.02));
        lastH2 = Math.round(h2 * 1000) / 1000;
        if (measuring) { addRow(); measuring = false; }
        hStart = pos - lastH2;
        hc = lastH2;
        ph = 'up'; pel = 0;
      }
    } else {
      pos = hStart + hc * (1 - k) * (1 - k);
      ang -= dt * 9 * (1 - k);
      if (k >= 1) {
        ph = 'down'; pel = 0;
        if (hc < 0.4 * hSet) { hc = hSet; hStart = 0; }
        $('vmst').textContent = 'свободный ход: поднялся';
        $('vmled').setAttribute('fill', '#1a7f37');
        if (mDone) { const f = mDone; mDone = null; f(); }
      }
    }
    if (!measuring && ph === 'up') {
      $('vmled').setAttribute('opacity', (0.5 + 0.5 * Math.abs(Math.sin(pel * 3))).toFixed(3));
    } else {
      $('vmled').setAttribute('opacity', 1);
    }
    draw();
  });

  /* ---------- измерение ---------- */
  function measure() {
    if (measuring) return Promise.resolve();
    hStart = 0; hc = hSet; pos = 0; ph = 'down'; pel = 0;
    mTime = Math.sqrt(2 * hSet / accel()) * (1 + VL.gauss(SIG));
    mTime = Math.round(mTime / QT) * QT;
    measuring = true;
    return new Promise(r => { mDone = r; });
  }

  function addRow() {
    const m = mass(), t = mTime, h = hSet;
    const I = m * R * R * (G * t * t / (2 * h) - 1);
    const E = m * G * h, dE = m * G * (h - lastH2);
    rows.push({ h, t, h2: lastH2, m, ring: withRing, I, E, dE });
    $('vmen').textContent = 'ΔE = ' + VL.fm(dE * 1000, 0) + ' мДж ('
      + VL.fm(dE / E * 100, 1) + ' %) за цикл';
    $('vmh2').setAttribute('opacity', 1);
    $('vmh2t').setAttribute('opacity', 1);
    const y = Y0 + (h - lastH2) * S;
    $('vmh2').setAttribute('y1', y.toFixed(1));
    $('vmh2').setAttribute('y2', y.toFixed(1));
    $('vmh2t').setAttribute('y', (y + 14).toFixed(1));
    $('vmh2t').textContent = 'h₂ = ' + VL.fm(lastH2, 3) + ' м';
    render();
  }

  /* ---------- обработка ---------- */
  function render() {
    const out = $('vmout');
    if (!rows.length) {
      out.innerHTML = '';
      $('vmhint').textContent = 'Журнал пуст. По методике время опускания измеряют не меньше шести раз.';
      return;
    }
    let html = '<h3>Журнал измерений</h3><table class="el"><tr><th class="num">№</th>' +
      '<th class="num">кольцо</th><th class="num">h, м</th><th class="num">t, с</th>' +
      '<th class="num">h₂, м</th><th class="num">I, 10⁻³ кг·м²</th>' +
      '<th class="num">ΔE, мДж</th><th class="num">ΔE/E, %</th></tr>';
    rows.forEach((r, i) => {
      html += `<tr><td class="num">${i + 1}</td><td class="num">${r.ring ? 'есть' : 'нет'}</td>` +
        `<td class="num">${VL.fm(r.h, 2)}</td><td class="num">${VL.fm(r.t, 3)}</td>` +
        `<td class="num">${VL.fm(r.h2, 3)}</td>` +
        `<td class="num"><b>${VL.fm(r.I * 1000, 3)}</b></td>` +
        `<td class="num">${VL.fm(r.dE * 1000, 0)}</td>` +
        `<td class="num">${VL.fm(r.dE / r.E * 100, 1)}</td></tr>`;
    });
    html += '</table>';

    /* обработке подлежат отсчёты с одинаковой комплектацией маятника */
    const grp = rows.filter(r => r.ring === withRing);
    if (grp.length < 3) {
      html += '<p class="small">Для обработки нужно не меньше трёх отсчётов с ' +
        'одинаковой комплектацией маятника: со снятым кольцом момент инерции ' +
        'другой, и усреднять такие значения нельзя.</p>';
      out.innerHTML = html; VL.mathify(out);
      $('vmhint').textContent = 'Снято отсчётов: ' + rows.length + ', в текущей комплектации — ' + grp.length + '.';
      return;
    }
    const Im = grp.reduce((s, r) => s + r.I, 0) / grp.length;
    const tm = grp.reduce((s, r) => s + r.t, 0) / grp.length;
    const hm = grp.reduce((s, r) => s + r.h, 0) / grp.length;
    const dt = Math.max(2e-4 * tm, QT);
    const instr = Im * Math.sqrt(Math.pow(2 * D_R / R, 2) + Math.pow(2 * dt / tm, 2)
      + Math.pow(D_H / hm, 2));

    html += '<h3>Обработка ряда \\(I_i\\)</h3>';
    const pr = VL.processHtml({
      xs: grp.map(r => r.I * 1000), instr: instr * 1000, sym: 'I', unit: '10⁻³ кг·м²', dec: 3,
      trueVal: Ith() * 1000, trueName: 'расчётным значением \\(I_{\\text{т}}\\)',
    });
    html += pr.html;
    html += '<div class="panel steps">' + VL.step(
      '\\(I_{\\text{т}} = \\dfrac{m_0R_0^2}{2}+\\dfrac{m_{\\text{д}}(R_{\\text{д}}^2+R_0^2)}{2}' +
      (withRing ? '+\\dfrac{m_{\\text{к}}(R_{\\text{к}}^2+R_{\\text{д}}^2)}{2}' : '') + '\\)',
      '\\((' + VL.lm(M0 * R0 * R0 / 2 * 1e6, 2) + ' + ' + VL.lm(MD * (RD * RD + R0 * R0) / 2 * 1e6, 1)
      + (withRing ? ' + ' + VL.lm(MK * (RK * RK + RD * RD) / 2 * 1e6, 1) : '')
      + ')\\cdot 10^{-6}\\)',
      '\\(' + VL.lm(Ith() * 1000, 3) + '\\cdot 10^{-3}\\) кг·м²') + '</div>';

    /* энергетика */
    const dEm = grp.reduce((s, r) => s + r.dE, 0) / grp.length;
    const Em = grp.reduce((s, r) => s + r.E, 0) / grp.length;
    html += '<h3>Потери энергии за цикл</h3><div class="panel steps">' +
      VL.step('\\(E = mgh\\)',
        `\\(${VL.lm(grp[0].m, 4)}\\cdot 9{,}81\\cdot ${VL.lm(hm, 2)}\\)`,
        `\\(${VL.lm(Em, 3)}\\) Дж`) +
      VL.step('\\(\\Delta E = mg(h-h_2)\\)',
        `\\(${VL.lm(grp[0].m, 4)}\\cdot 9{,}81\\cdot ${VL.lm(dEm / (grp[0].m * G), 3)}\\)`,
        `\\(${VL.lm(dEm, 3)}\\) Дж`) +
      VL.step('\\(\\Delta E/E\\)', `\\(${VL.lm(dEm, 3)}/${VL.lm(Em, 3)}\\)`,
        `\\(${VL.lm(dEm / Em * 100, 1)}\\,\\%\\)`) + '</div>' +
      '<p class="small">Доля потерь почти не зависит от высоты старта: основная ' +
      'их часть возникает в нижней точке, при перемотке нитей. Проверьте это ' +
      'сами — снимите отсчёты при разных \\(h\\) и сравните столбец \\(\\Delta E/E\\).</p>';

    out.innerHTML = html;
    VL.mathify(out);
    $('vmhint').textContent = 'Снято отсчётов: ' + rows.length + ', в обработку вошли ' + grp.length + '.';
  }

  /* ---------- органы управления ---------- */
  VL.slider('vmH', 'vmHv', v => VL.fm(v, 2) + ' м', v => { hSet = v; layout(); });
  $('vmring2').addEventListener('change', function () {
    withRing = this.value === '1';
    layout();
    render();
  });
  layout();

  $('vmsnap').addEventListener('click', () => { measure(); });
  $('vmreset').addEventListener('click', () => {
    rows.length = 0;
    $('vmh2').setAttribute('opacity', 0);
    $('vmh2t').setAttribute('opacity', 0);
    $('vmen').textContent = 'потери за цикл — после опыта';
    render();
  });

  VL.auto({
    autoBtn: 'vmauto', stopBtn: 'vmstop',
    lockIds: ['vmsnap', 'vmreset', 'vmH', 'vmring2'],
    total: () => 6,
    progress: (i, n) => {
      const p = $('vmprog'); p.style.display = ''; p.textContent = `опыт ${i} из ${n}`;
    },
    step: async (i, ctl) => {
      if (i === 0) { rows.length = 0; render(); }
      if (ctl.aborted()) return;
      await measure();
    },
    onFinish: (aborted, done, n) => {
      $('vmprog').style.display = 'none';
      $('vmhint').textContent = aborted
        ? `Прогон остановлен: снято ${done} из ${n} опытов.`
        : 'Серия из шести опусканий снята — ниже обработка ряда и энергетический баланс.';
    },
  });

  render();
})();
