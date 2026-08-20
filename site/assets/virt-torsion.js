/* Работа 1-10. Момент инерции тела методом крутильных колебаний.
 *
 * Модель: тело подвешено на упругой проволоке, момент упругих сил
 * M = −Dφ, уравнение Iφ¨ + Dφ = 0, период T = 2π√(I/D).
 * Подвес калибруется эталонным диском (I = mR²/2):
 *      D = 4π²I_эт/(T₂² − T₁²),   I_x = I_эт(T₃² − T₁²)/(T₂² − T₁²),
 * где T₁ — период пустой платформы. Модуль кручения из формулы I_x
 * выпадает — знать материал и диаметр проволоки не требуется.
 * Штанга с двумя подвижными грузами демонстрирует теорему Штейнера:
 *      T² = 4π²(I₀ + 2mr²)/D — прямая по r² с наклоном k = 8π²m/D,
 * по которому находится масса грузов.
 *
 * Измеряется только время t полных N колебаний: случайная ошибка —
 * реакция наблюдателя, приборная — цена деления секундомера. */
'use strict';
(function () {
  const svg = $('vt');
  if (!svg || !window.VL || !window.METRO) return;

  /* моменты инерции берём из расчётного ядра сайта, если оно подключено */
  const PI = (window.PHYS && window.PHYS.inertia) || {
    disk: (m, R) => m * R * R / 2,
    rodCenter: (m, L) => m * L * L / 12,
    steiner: (I0, m, d) => I0 + m * d * d,
  };

  /* ---------- «истина», зашитая в модель ---------- */
  const D_TRUE = 8.04e-3;        // модуль кручения проволоки, Н·м/рад
  const I_PLATE = 3.20e-4;       // момент инерции пустой платформы, кг·м²
  const M_REF = 0.5400, R_REF = 0.0500;          // эталонный диск
  const I_REF = PI.disk(M_REF, R_REF);           // 6,75·10⁻⁴ кг·м²
  const I_TEST = 1.150e-3;       // исследуемое тело (форма нерасчётная)
  const M_BAR = 0.1200, L_BAR = 0.300;           // штанга
  const M_W = 0.2500, R_W = 0.0150;              // грузы на штанге
  const I_BAR0 = I_PLATE + PI.rodCenter(M_BAR, L_BAR);

  /* ---------- приборы и их погрешности ---------- */
  const Q_T = 0.01;              // цена деления секундомера, с
  const D_T = 0.01;              // приборная погрешность секундомера, с
  const SIG_T = 0.15;            // СКО реакции наблюдателя (пуск + останов), с
  const D_M = 0.0005;            // технические весы, кг
  const D_R = 0.000025;          // штангенциркуль: половина 0,05 мм на радиус, м

  /* относительная погрешность эталона: I = mR²/2 */
  const REL_REF = Math.sqrt(Math.pow(D_M / M_REF, 2) + Math.pow(2 * D_R / R_REF, 2));
  const D_IREF = I_REF * REL_REF;

  const NAME = {
    plate: 'пустая платформа', ref: 'эталонный диск',
    test: 'исследуемое тело', bar: 'штанга с грузами',
  };

  /* ---------- состояние ---------- */
  let body = 'plate', R = 0.080, N = 10;
  let phase = 0, th = 0;
  let mode = 'idle', mEl = 0, mDur = 1.8, mTime = 0, mDone = null;
  const rows = [];

  function inertiaOf(b, r) {
    if (b === 'plate') return I_PLATE;
    if (b === 'ref') return I_PLATE + I_REF;
    if (b === 'test') return I_PLATE + I_TEST;
    /* штанга: собственный момент каждого груза + перенос по Штейнеру */
    return I_BAR0 + 2 * PI.steiner(PI.disk(M_W, R_W), M_W, r);
  }
  const periodOf = (b, r) => 2 * Math.PI * Math.sqrt(inertiaOf(b, r) / D_TRUE);

  /* ---------- проекция «вид сверху под углом» ---------- */
  const CX = 300, CY = 222, KX = 560, KY = 0.29;
  const pp = (rho, a, cy) => [CX + rho * KX * Math.cos(a),
    (cy === undefined ? CY : cy) - rho * KX * KY * Math.sin(a)];

  /* ---------- отрисовка сменного тела ---------- */
  function drawBody() {
    const g = $('vtbody');
    VL.clear(g);
    if (body === 'bar') {
      const a = th, cy = 212;
      const p1 = pp(L_BAR / 2, a, cy), p2 = pp(L_BAR / 2, a + Math.PI, cy);
      VL.el('line', {
        x1: p1[0].toFixed(1), y1: p1[1].toFixed(1),
        x2: p2[0].toFixed(1), y2: p2[1].toFixed(1),
        stroke: '#16161a', 'stroke-width': 4, 'stroke-linecap': 'round',
      }, g);
      [a, a + Math.PI].forEach(function (ang) {
        const q = pp(R, ang, cy), x = q[0], y = q[1];
        VL.el('rect', { x: (x - 10).toFixed(1), y: (y - 8).toFixed(1), width: 20, height: 16, fill: '#fff' }, g);
        VL.el('ellipse', { cx: x.toFixed(1), cy: (y + 8).toFixed(1), rx: 10, ry: 4, fill: '#fff', stroke: '#b3382e', 'stroke-width': 1.4 }, g);
        VL.el('line', { x1: (x - 10).toFixed(1), y1: (y - 8).toFixed(1), x2: (x - 10).toFixed(1), y2: (y + 8).toFixed(1), stroke: '#b3382e', 'stroke-width': 1.4 }, g);
        VL.el('line', { x1: (x + 10).toFixed(1), y1: (y - 8).toFixed(1), x2: (x + 10).toFixed(1), y2: (y + 8).toFixed(1), stroke: '#b3382e', 'stroke-width': 1.4 }, g);
        VL.el('ellipse', { cx: x.toFixed(1), cy: (y - 8).toFixed(1), rx: 10, ry: 4, fill: '#fff', stroke: '#b3382e', 'stroke-width': 1.4 }, g);
      });
    } else if (body !== 'plate') {
      /* сменное тело в обойме под платформой */
      const isRef = body === 'ref';
      const rx = isRef ? 52 : 60, ry = isRef ? 15 : 17;
      const top = 250, h = isRef ? 26 : 34;
      VL.el('rect', { x: CX - rx, y: top, width: 2 * rx, height: h, fill: '#fff' }, g);
      VL.el('line', { x1: CX - rx, y1: top, x2: CX - rx, y2: top + h, stroke: '#16161a', 'stroke-width': 1.6 }, g);
      VL.el('line', { x1: CX + rx, y1: top, x2: CX + rx, y2: top + h, stroke: '#16161a', 'stroke-width': 1.6 }, g);
      VL.el('ellipse', {
        cx: CX, cy: top + h, rx: rx, ry: ry, fill: '#fff',
        stroke: '#16161a', 'stroke-width': 1.6,
      }, g);
      if (!isRef) {
        VL.el('ellipse', {
          cx: CX, cy: top + h, rx: rx * 0.62, ry: ry * 0.62, fill: 'rgba(21,94,117,.08)',
          stroke: '#6b6b74', 'stroke-width': 1,
        }, g);
      }
    }
  }

  /* ---------- главный цикл ---------- */
  VL.loop(function (dt) {
    const T = periodOf(body, R);
    if (mode === 'run') {
      mEl += dt;
      const k = Math.min(1, mEl / mDur);
      phase = 2 * Math.PI * N * k;
      $('vttime').textContent = VL.fm(k * mTime, 2) + ' с';
      $('vtcnt').textContent = 'колебаний: ' + Math.min(N, Math.floor(k * N)) + ' из ' + N;
      $('vtst').textContent = 'идёт отсчёт, перемотка ×' + Math.round(N * T / mDur);
      if (k >= 1) {
        mode = 'idle';
        $('vtst').textContent = 'секундомер остановлен';
        rows.push({ body: body, r: R, N: N, t: mTime, T: mTime / N });
        render();
        if (mDone) { const f = mDone; mDone = null; f(); }
      }
    } else {
      phase += 2 * Math.PI * dt / T;
    }
    th = 1.0 * Math.cos(phase);          /* амплитуда закручивания ≈ 57° */

    /* риска на платформе и флажок на её ободе */
    const m1 = pp(0.150, th), m2 = pp(0.160, th);
    $('vtmark').setAttribute('x2', m1[0].toFixed(1));
    $('vtmark').setAttribute('y2', m1[1].toFixed(1));
    $('vtflag').setAttribute('cx', m2[0].toFixed(1));
    $('vtflag').setAttribute('cy', m2[1].toFixed(1));
    drawBody();

    $('vtread').textContent = 'на подвесе: ' + NAME[body] +
      (body === 'bar' ? ', r = ' + VL.fm(R * 1000, 0) + ' мм' : '') +
      ' · закручивание φ = ' + VL.fm(th * 180 / Math.PI, 0) + '°' +
      ' · отсчитывается N = ' + N + ' полных колебаний';
    $('vtbodylab').textContent = NAME[body] +
      (body === 'bar' ? ' (r = ' + VL.fm(R * 1000, 0) + ' мм)' : body === 'ref'
        ? ' (m = 540,0 г, d = 100,00 мм)' : body === 'test' ? ' (масса и форма неизвестны)' : '');
  });

  /* ---------- измерение ---------- */
  function measure() {
    if (mode !== 'idle') return Promise.resolve();
    mTime = N * periodOf(body, R) + VL.gauss(SIG_T);
    if (mTime < Q_T) mTime = Q_T;
    mTime = Math.round(mTime / Q_T) * Q_T;
    mEl = 0; phase = 0; mode = 'run';
    return new Promise(function (res) { mDone = res; });
  }

  /* ---------- обработка ---------- */
  const meanN = a => a.reduce((s, x) => s + x.N, 0) / a.length;

  function render() {
    const out = $('vtout');
    if (!rows.length) {
      out.innerHTML = '';
      $('vthint').textContent = 'Журнал пуст. Начните с пустой платформы (2–3 отсчёта), ' +
        'затем эталонный диск (2–3 отсчёта), затем исследуемое тело (5 отсчётов).';
      return;
    }

    let h = '<h3>Журнал измерений</h3><table class="el"><tr><th class="num">№</th>' +
      '<th>тело</th><th class="num">r, мм</th><th class="num">N</th>' +
      '<th class="num">t, с</th><th class="num">T = t/N, с</th></tr>';
    rows.forEach(function (x, i) {
      h += `<tr><td class="num">${i + 1}</td><td>${NAME[x.body]}</td>` +
        `<td class="num">${x.body === 'bar' ? VL.fm(x.r * 1000, 0) : '—'}</td>` +
        `<td class="num">${x.N}</td><td class="num">${VL.fm(x.t, 2)}</td>` +
        `<td class="num"><b>${VL.fm(x.T, 3)}</b></td></tr>`;
    });
    h += '</table>';

    const g1 = rows.filter(x => x.body === 'plate');
    const g2 = rows.filter(x => x.body === 'ref');
    const g3 = rows.filter(x => x.body === 'test');
    const gb = rows.filter(x => x.body === 'bar');

    let st1 = null, st2 = null, Dm = 0, dD = 0;

    /* --- 1. калибровка подвеса --- */
    if (g1.length >= 2 && g2.length >= 2) {
      st1 = VL.stats(g1.map(x => x.T), D_T / meanN(g1));
      st2 = VL.stats(g2.map(x => x.T), D_T / meanN(g2));
      const fD = v => 4 * Math.PI * Math.PI * v[0] / (v[1] * v[1] - v[2] * v[2]);
      Dm = fD([I_REF, st2.mean, st1.mean]);
      dD = METRO.indirect(fD, [I_REF, st2.mean, st1.mean], [D_IREF, st2.d, st1.d]).d;

      h += '<h3>1. Модуль кручения подвеса</h3><div class="panel steps">' +
        VL.step('\\(\\overline{T}_1\\) (платформа)',
          `среднее по ${st1.n} отсчётам`, `\\(${VL.lm(st1.mean, 3)}\\pm${VL.lm(st1.d, 3)}\\) с`) +
        VL.step('\\(\\overline{T}_2\\) (платформа + эталон)',
          `среднее по ${st2.n} отсчётам`, `\\(${VL.lm(st2.mean, 3)}\\pm${VL.lm(st2.d, 3)}\\) с`) +
        VL.step('\\(I_{\\text{эт}} = \\dfrac{mR^2}{2}\\)',
          `\\(0{,}5400\\cdot 0{,}0500^2/2\\)`,
          `\\(${VL.lm(I_REF * 1e3, 4)}\\cdot10^{-3}\\) кг·м²`) +
        VL.step('\\(D = \\dfrac{4\\pi^2 I_{\\text{эт}}}{\\overline{T}_2^2-\\overline{T}_1^2}\\)',
          `\\(4\\pi^2\\cdot ${VL.lm(I_REF * 1e3, 4)}\\cdot10^{-3}/(${VL.lm(st2.mean * st2.mean - st1.mean * st1.mean, 3)})\\)`,
          `\\(${VL.lm(Dm * 1e3, 3)}\\cdot10^{-3}\\) Н·м/рад`) +
        VL.step('\\(\\Delta D\\)', 'перенос погрешностей \\(I_{\\text{эт}},\\ \\overline{T}_1,\\ \\overline{T}_2\\)',
          `\\(${VL.lm(dD * 1e3, 3)}\\cdot10^{-3}\\) Н·м/рад`) + '</div>';
      const stD = { mean: Dm * 1e3, d: dD * 1e3, alpha: 0.95 };
      h += '<div class="ans"><b>Модуль кручения:</b> ' + VL.record('D', stD, '10⁻³ Н·м/рад') + '.</div>';
      h += VL.verdict(stD, D_TRUE * 1e3,
        'модулем кручения проволоки, заложенным в модель', '10⁻³ Н·м/рад', 'D');
    } else {
      h += '<p class="small">Для калибровки подвеса нужно не меньше двух отсчётов ' +
        'с пустой платформой и двух с эталонным диском: пока их ' +
        `${g1.length} и ${g2.length}.</p>`;
    }

    /* --- 2. момент инерции исследуемого тела --- */
    if (st1 && st2 && g3.length >= 3) {
      const T1 = st1.mean, T2 = st2.mean;
      const xs = g3.map(x => I_REF * (x.T * x.T - T1 * T1) / (T2 * T2 - T1 * T1) * 1e3);
      const T3m = g3.reduce((s, x) => s + x.T, 0) / g3.length;
      const fI = v => v[0] * (v[3] * v[3] - v[1] * v[1]) / (v[2] * v[2] - v[1] * v[1]);
      const instr = METRO.indirect(fI, [I_REF, T1, T2, T3m],
        [D_IREF, st1.d, st2.d, D_T / meanN(g3)]).d * 1e3;

      h += '<h3>2. Момент инерции исследуемого тела</h3>' +
        '<p class="small">Каждый отсчёт \\(T_3\\) даёт своё значение ' +
        '\\(I_x = I_{\\text{эт}}\\dfrac{T_3^2-\\overline{T}_1^2}{\\overline{T}_2^2-\\overline{T}_1^2}\\); ' +
        'разброс этого ряда — случайная погрешность, а неточность калибровки ' +
        '(\\(\\overline{T}_1,\\ \\overline{T}_2,\\ I_{\\text{эт}}\\)) входит как приборная ' +
        `составляющая \\(\\Delta I_{\\text{приб}} = ${VL.lm(instr, 4)}\\cdot10^{-3}\\) кг·м², ` +
        'одинаковая для всех отсчётов.</p>';
      const pr = VL.processHtml({
        xs: xs, instr: instr, sym: 'I_x', unit: '10⁻³ кг·м²', dec: 3,
        trueVal: I_TEST * 1e3, trueName: 'моментом инерции, заложенным в модель',
      });
      h += pr.html;
      h += '<p class="small">Обратите внимание: модуль кручения \\(D\\) в рабочую формулу ' +
        'не входит — он сократился. Материал, длина и диаметр проволоки остались ' +
        'неизвестными, а момент инерции измерен.</p>';
    } else if (g3.length) {
      h += '<p class="small">Отсчётов с исследуемым телом: ' + g3.length +
        '. Для обработки ряда нужно не меньше трёх, а также законченная калибровка подвеса.</p>';
    }

    /* --- 3. теорема Штейнера --- */
    const rs = {};
    gb.forEach(x => { rs[Math.round(x.r * 1e4)] = 1; });
    const nr = Object.keys(rs).length;
    if (gb.length >= 3 && nr >= 3) {
      h += '<h3>3. Штанга с грузами: проверка теоремы Штейнера</h3>' +
        '<div id="vtchart"></div><div id="vtsteiner"></div>';
    } else if (gb.length) {
      h += '<p class="small">Точек на штанге: ' + gb.length + ' при ' + nr +
        ' различных положениях грузов. Для прямой \\(T^2(r^2)\\) нужно не меньше ' +
        'трёх разных \\(r\\).</p>';
    }

    out.innerHTML = h;
    if ($('vtchart')) drawSteiner(gb, Dm, dD);
    VL.mathify(out);
    $('vthint').textContent = 'Отсчётов в журнале: ' + rows.length +
      ' (платформа ' + g1.length + ', эталон ' + g2.length +
      ', тело ' + g3.length + ', штанга ' + gb.length + ').';
  }

  /* ---------- график T²(r²) и масса грузов по наклону ---------- */
  function drawSteiner(gb, Dm, dD) {
    const pts = gb.map(x => [x.r * x.r, x.T * x.T]);
    const f = VL.fit(pts);
    const ymax = Math.max(20, Math.ceil(Math.max.apply(null, pts.map(p => p[1])) / 10) * 10 + 10);

    const ch = VL.chart('vtchart', '0 0 640 300');
    const ax = VL.axes(ch, {
      x0: 70, y0: 250, x1: 596, y1: 40, xmin: 0, xmax: 0.0225, ymin: 0, ymax: ymax,
      xticks: [0.005, 0.010, 0.015, 0.020].map(v => ({ v: v, label: VL.fm(v, 3) })),
      yticks: VL.ticks(0, ymax, 6).map(v => ({ v: v, label: VL.fm(v, 0) })),
      xlab: 'r², м²', ylab: 'T², с²',
    });
    VL.series(ch, [[ax.X(0), ax.Y(f.b)], [ax.X(0.0225), ax.Y(f.k * 0.0225 + f.b)]],
      '#6b6b74', null, { dash: '6 5', width: 1.4, noPoints: true });
    VL.series(ch, pts.map(p => [ax.X(p[0]), ax.Y(p[1])]), '#155e75',
      pts.map(p => `r² = ${VL.fm(p[0], 4)} м², T² = ${VL.fm(p[1], 2)} с²`), { nolines: true });
    VL.label(ch, 150, 64, '#1a7f37', 'наклон k = ' + VL.fm(f.k, 0) + ' ± ' + VL.fm(f.dk, 0) + ' с²/м²');
    VL.label(ch, 150, 80, '#6b6b74', 'отсечка b = ' + VL.fm(f.b, 2) + ' с² (момент инерции штанги с платформой)');
    VL.label(ch, 150, 96, '#6b6b74', 'коэффициент корреляции r = ' + VL.fm(f.r, 4));

    let h = '<div class="panel steps">' +
      VL.step('\\(T^2 = \\dfrac{4\\pi^2}{D}\\left(I_0 + 2mr^2\\right)\\)',
        'прямая по \\(r^2\\)', `\\(k = ${VL.lm(f.k, 0)}\\pm${VL.lm(f.dk, 0)}\\) с²/м²`);
    if (Dm > 0) {
      const mw = f.k * Dm / (8 * Math.PI * Math.PI);
      const rel = Math.sqrt(Math.pow(f.dk / f.k, 2) + Math.pow(dD / Dm, 2));
      h += VL.step('\\(m = \\dfrac{kD}{8\\pi^2}\\)',
        `\\(${VL.lm(f.k, 0)}\\cdot ${VL.lm(Dm * 1e3, 3)}\\cdot10^{-3}/(8\\pi^2)\\)`,
        `\\(${VL.lm(mw * 1000, 1)}\\) г`) +
        VL.step('\\(\\dfrac{\\Delta m}{m} = \\sqrt{\\left(\\dfrac{\\Delta k}{k}\\right)^2+\\left(\\dfrac{\\Delta D}{D}\\right)^2}\\)',
          `\\(\\sqrt{${VL.lm(f.dk / f.k, 4)}^2+${VL.lm(dD / Dm, 4)}^2}\\)`,
          `\\(${VL.lm(rel * 100, 1)}\\,\\%\\)`) +
        VL.step('\\(I_0 = \\dfrac{bD}{4\\pi^2}\\)',
          `\\(${VL.lm(f.b, 2)}\\cdot ${VL.lm(Dm * 1e3, 3)}\\cdot10^{-3}/(4\\pi^2)\\)`,
          `\\(${VL.lm(f.b * Dm / (4 * Math.PI * Math.PI) * 1e3, 3)}\\cdot10^{-3}\\) кг·м²`) + '</div>';
      const stM = { mean: mw * 1000, d: mw * 1000 * rel, alpha: 0.95 };
      h += '<div class="ans"><b>Масса одного груза по наклону прямой:</b> ' +
        VL.record('m', stM, 'г') + '.</div>';
      h += VL.verdict(stM, M_W * 1000, 'массой грузов, заложенной в модель', 'г', 'm');
      h += '<p class="small">Прямая \\(T^2(r^2)\\) — это и есть теорема Штейнера, ' +
        'увиденная глазами: перенос оси на \\(r\\) добавляет к моменту инерции ровно ' +
        '\\(mr^2\\), поэтому квадрат периода растёт линейно по квадрату расстояния. ' +
        'Отсечка \\(b\\) даёт момент инерции штанги с платформой и собственные моменты ' +
        `грузов — по модели ${VL.fm(4 * Math.PI * Math.PI * (I_BAR0 + 2 * PI.disk(M_W, R_W)) / D_TRUE, 2)} с².</p>`;
    } else {
      h += '</div><p class="small">Чтобы перевести наклон в массу грузов, нужен модуль ' +
        'кручения \\(D\\): снимите отсчёты с пустой платформой и эталонным диском.</p>';
    }
    $('vtsteiner').innerHTML = h;
  }

  /* ---------- органы управления ---------- */
  function syncBody() {
    $('vtR').disabled = body !== 'bar';
    drawBody();
  }
  $('vtbodysel').addEventListener('change', function () {
    body = this.value;
    syncBody();
  });
  VL.slider('vtR', 'vtRv', v => VL.fm(v, 0) + ' мм', v => { R = v / 1000; });
  VL.slider('vtN', 'vtNv', v => String(v), v => { N = v; $('vtcnt').textContent = 'колебаний: 0 из ' + v; });
  syncBody();

  $('vtsnap').addEventListener('click', function () { measure(); });
  $('vtreset').addEventListener('click', function () {
    rows.length = 0;
    render();
  });

  /* программа авто-опыта: калибровка, тело, затем серия по r */
  const PROG = [
    { b: 'plate' }, { b: 'plate' }, { b: 'plate' },
    { b: 'ref' }, { b: 'ref' }, { b: 'ref' },
    { b: 'test' }, { b: 'test' }, { b: 'test' }, { b: 'test' }, { b: 'test' },
    { b: 'bar', r: 30 }, { b: 'bar', r: 55 }, { b: 'bar', r: 80 },
    { b: 'bar', r: 110 }, { b: 'bar', r: 140 },
  ];

  VL.auto({
    autoBtn: 'vtauto', stopBtn: 'vtstop',
    lockIds: ['vtsnap', 'vtreset', 'vtbodysel', 'vtR', 'vtN'],
    total: () => PROG.length,
    progress: (i, n) => {
      const p = $('vtprog'); p.style.display = '';
      p.textContent = `отсчёт ${i} из ${n}: ` + NAME[PROG[i - 1].b];
    },
    step: async (i, ctl) => {
      if (i === 0) { rows.length = 0; render(); mDur = 0.7; }
      const s = PROG[i];
      const sel = $('vtbodysel');
      sel.value = s.b; body = s.b; syncBody();
      if (s.r) { const sr = $('vtR'); sr.value = s.r; sr.dispatchEvent(new Event('input')); }
      await ctl.sleep(200);
      if (ctl.aborted()) return;
      await measure();
    },
    onFinish: (aborted, done, n) => {
      mDur = 1.8;
      syncBody();
      $('vtprog').style.display = 'none';
      $('vthint').textContent = aborted
        ? `Прогон остановлен: снято ${done} из ${n} отсчётов.`
        : 'Полная программа снята: калибровка подвеса, момент инерции тела и прямая T²(r²).';
    },
  });

  render();
})();
