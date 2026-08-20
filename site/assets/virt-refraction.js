/* Работа «Определение показателя преломления стекла и проверка закона
 * преломления».
 *
 * Модель: оптический диск (лимб гониометра) с полуцилиндром из стекла К8 в
 * центре. Луч всегда входит в полуцилиндр или выходит из него через
 * цилиндрическую поверхность по радиусу — там он не преломляется, поэтому
 * весь эффект собран на плоской грани в центре диска. Ход лучей и предельный
 * угол считает PHYS.refraction, доли отражённой и прошедшей энергии — формулы
 * Френеля (усреднение по поляризациям).
 *
 * Зашито: n = 1,516 (крон К8, n_D = 1,5163), цена деления лимба 0,5°,
 * случайная ошибка наведения на луч 0,25°. Ряд обрабатывается двумя
 * способами — усреднением отношений синусов и МНК через начало координат, —
 * и работа как раз про то, почему второй способ лучше. */
'use strict';
(function () {
  const svg = $('vr');
  if (!svg || !window.VL) return;
  const P = window.PHYS;
  const M = window.METRO;
  const refraction = (P && P.refraction) || function (n1, n2, a1) {
    const s = n1 * Math.sin(a1 * Math.PI / 180) / n2;
    return { sin2: s, angle2Deg: Math.abs(s) <= 1 ? Math.asin(s) * 180 / Math.PI : null,
      critDeg: n1 > n2 ? Math.asin(n2 / n1) * 180 / Math.PI : null };
  };

  /* ---------- паспорт установки ---------- */
  const N_TRUE = 1.516;    // стекло К8 (крон), n_D = 1,5163
  const DIV = 0.5;         // цена деления лимба, градус
  const D_A = 0.25;        // приборная погрешность отсчёта — половина деления
  const SIG_A = 0.25;      // СКО наведения перекрестия на луч, градус
  const SIG_C = 0.5;       // СКО «поимки» момента исчезновения луча, градус
  const rad = d => d * Math.PI / 180;

  /* ---------- геометрия схемы ---------- */
  const OX = 270, OY = 190, RL = 140, RS = 95;

  let ang = 40, mode = 'ag';
  const rows = [], crits = [];

  /* доля отражённой энергии (естественный свет: среднее s- и p-поляризаций) */
  function fresnel(n1, n2, a1, a2) {
    if (a2 == null) return 1;
    const c1 = Math.cos(a1), c2 = Math.cos(a2);
    const rs = (n1 * c1 - n2 * c2) / (n1 * c1 + n2 * c2);
    const rp = (n1 * c2 - n2 * c1) / (n1 * c2 + n2 * c1);
    return (rs * rs + rp * rp) / 2;
  }

  /* текущий ход лучей */
  function optics() {
    const air = mode === 'ag';
    const n1 = air ? 1 : N_TRUE, n2 = air ? N_TRUE : 1;
    const r = refraction(n1, n2, ang);
    return {
      air, n1, n2, aIn: ang, aOut: r.angle2Deg, crit: r.critDeg,
      R: fresnel(n1, n2, rad(ang), r.angle2Deg == null ? null : rad(r.angle2Deg)),
    };
  }

  /* ---------- разметка лимба ---------- */
  {
    const g = $('vrlimb');
    for (let t = 0; t < 360; t += 2) {
      const c = Math.cos(rad(t)), s = Math.sin(rad(t));
      const h = t % 180, v = h > 90 ? 180 - h : h;
      const r0 = v % 10 === 0 ? 126 : 132;
      VL.el('line', {
        x1: (OX + r0 * c).toFixed(1), y1: (OY + r0 * s).toFixed(1),
        x2: (OX + RL * c).toFixed(1), y2: (OY + RL * s).toFixed(1),
        stroke: '#6b6b74', 'stroke-width': v % 10 === 0 ? 1.1 : 0.7,
      }, g);
      if (v % 20 === 0) {
        const tx = VL.el('text', {
          x: (OX + 152 * c).toFixed(1), y: (OY + 152 * s + 4).toFixed(1),
          'text-anchor': 'middle',
        }, g);
        tx.textContent = String(v);
      }
    }
  }

  /* ---------- живая схема ---------- */
  function ray(id, x1, y1, x2, y2, op) {
    const e = $(id);
    e.setAttribute('x1', x1.toFixed(1)); e.setAttribute('y1', y1.toFixed(1));
    e.setAttribute('x2', x2.toFixed(1)); e.setAttribute('y2', y2.toFixed(1));
    e.setAttribute('stroke-opacity', op.toFixed(2));
  }
  /* дуга угла между направлением d1 и d2 (единичные векторы) радиуса r */
  function arc(id, a1, a2, r) {
    const p1x = OX + r * Math.cos(a1), p1y = OY + r * Math.sin(a1);
    const p2x = OX + r * Math.cos(a2), p2y = OY + r * Math.sin(a2);
    let d = a2 - a1;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    $(id).setAttribute('d', `M ${p1x.toFixed(1)} ${p1y.toFixed(1)} A ${r} ${r} 0 0 `
      + `${d > 0 ? 1 : 0} ${p2x.toFixed(1)} ${p2y.toFixed(1)}`);
    return a1 + d / 2;
  }

  VL.loop(function () {
    const o = optics();
    const sx = o.air ? 1 : -1;
    const ci = Math.cos(rad(o.aIn)), si = Math.sin(rad(o.aIn));
    /* падающий луч и лазер на рычаге */
    const px = OX - sx * RL * ci, py = OY - RL * si;
    ray('vrin', px, py, OX, OY, 1);
    const la = Math.atan2(-si, -sx * ci) * 180 / Math.PI;
    $('vrlaser').setAttribute('transform',
      `translate(${(OX - sx * 126 * ci).toFixed(1)},${(OY - 126 * si).toFixed(1)}) rotate(${la.toFixed(1)})`);
    /* отражённый */
    ray('vrrefl', OX, OY, OX - sx * RL * ci, OY + RL * si, Math.max(0.12, Math.min(1, o.R * 3)));
    /* преломлённый */
    if (o.aOut == null) {
      $('vrrefr').setAttribute('stroke-opacity', '0');
    } else {
      const co = Math.cos(rad(o.aOut)), so = Math.sin(rad(o.aOut));
      ray('vrrefr', OX, OY, OX + sx * RL * co, OY + RL * so, Math.max(0.15, 1 - o.R));
    }
    /* дуги углов */
    const mid1 = arc('vrarc1', Math.atan2(0, -sx), Math.atan2(-si, -sx * ci), 40);
    $('vrlab1').setAttribute('x', (OX + 52 * Math.cos(mid1)).toFixed(1));
    $('vrlab1').setAttribute('y', (OY + 52 * Math.sin(mid1) + 4).toFixed(1));
    $('vrlab1').textContent = o.air ? 'ε' : 'φ';
    if (o.aOut == null) {
      $('vrarc2').setAttribute('d', 'M 0 0');
      $('vrlab2').textContent = '';
    } else {
      const mid2 = arc('vrarc2', Math.atan2(0, sx),
        Math.atan2(Math.sin(rad(o.aOut)), sx * Math.cos(rad(o.aOut))), 58);
      $('vrlab2').setAttribute('x', (OX + 70 * Math.cos(mid2)).toFixed(1));
      $('vrlab2').setAttribute('y', (OY + 70 * Math.sin(mid2) + 4).toFixed(1));
      $('vrlab2').textContent = o.air ? 'φ' : 'ε';
    }
    /* панель показаний */
    $('vrr1').textContent = o.air ? 'воздух → стекло' : 'стекло → воздух';
    $('vrr2').textContent = (o.air ? 'угол падения ε = ' : 'угол падения φ = ')
      + VL.fm(o.aIn, 1) + '°';
    $('vrr3').textContent = o.aOut == null
      ? 'преломлённого луча нет'
      : (o.air ? 'по лимбу φ = ' : 'по лимбу ε = ') + VL.fm(o.aOut, 1) + '°';
    $('vrr4').textContent = o.aOut == null
      ? 'полное внутреннее отражение'
      : 'sin ε / sin φ = ' + VL.fm(o.air
        ? Math.sin(rad(o.aIn)) / Math.sin(rad(o.aOut))
        : Math.sin(rad(o.aOut)) / Math.sin(rad(o.aIn)), 3);
    $('vrr5').textContent = 'отражается ' + VL.fm(o.R * 100, 0) + ' % энергии';
  });

  /* ---------- измерение ---------- */
  function snap() {
    const o = optics(), hint = $('vrhint');
    hint.classList.remove('alert');
    if (o.aOut == null) {
      hint.classList.add('alert');
      hint.textContent = 'Преломлённого луча нет — это полное внутреннее отражение. '
        + 'Уменьшите угол или воспользуйтесь кнопкой «снять предельный угол».';
      return;
    }
    /* по лимбу отсчитывается тот луч, который не задан рычагом */
    const meas = Math.round((o.aOut + VL.gauss(SIG_A)) / DIV) * DIV;
    if (meas < 0.4) {
      hint.classList.add('alert');
      hint.textContent = 'Отсчёт меньше деления лимба — при таком угле измерять нечего.';
      return;
    }
    const eps = o.air ? o.aIn : meas, phi = o.air ? meas : o.aIn;
    const f = a => Math.sin(a[0]) / Math.sin(a[1]);
    const ind = M.indirect(f, [rad(eps), rad(phi)], [rad(D_A), rad(D_A)]);
    rows.push({ air: o.air, eps, phi, n: Math.sin(rad(eps)) / Math.sin(rad(phi)), d: ind.d });
    render();
  }

  function snapCrit() {
    const o = optics(), hint = $('vrhint');
    hint.classList.remove('alert');
    if (o.air) {
      hint.classList.add('alert');
      hint.textContent = 'Полное внутреннее отражение возможно только при переходе из '
        + 'оптически более плотной среды: переключите ход луча на «стекло → воздух».';
      return;
    }
    if (Math.abs(o.aIn - o.crit) > 1.5) {
      hint.classList.add('alert');
      hint.textContent = o.aIn < o.crit
        ? 'Преломлённый луч ещё уверенно виден — увеличивайте угол, пока он не ляжет '
          + 'вдоль границы и не погаснет.'
        : 'Луч погас уже давно: вы проскочили предельный угол. Вернитесь назад до '
          + 'момента, когда преломлённый луч только-только исчезает.';
      return;
    }
    crits.push(Math.round((o.aIn + VL.gauss(SIG_C)) / DIV) * DIV);
    render();
  }

  /* ---------- обработка ---------- */
  function render() {
    const out = $('vrout'), hint = $('vrhint');
    let h = '';
    if (rows.length) {
      h += '<h3>Журнал измерений</h3><table class="el"><tr><th class="num">№</th>'
        + '<th>ход луча</th><th class="num">ε, °</th><th class="num">φ, °</th>'
        + '<th class="num">sin ε</th><th class="num">sin φ</th>'
        + '<th class="num">n = sin ε/sin φ</th><th class="num">Δn<sub>приб</sub></th></tr>';
      rows.forEach((r, i) => {
        const bad = Math.min(r.eps, r.phi) < 12;
        h += `<tr><td class="num">${i + 1}</td><td>${r.air ? 'воздух → стекло' : 'стекло → воздух'}</td>`
          + `<td class="num">${VL.fm(r.eps, 1)}</td><td class="num">${VL.fm(r.phi, 1)}</td>`
          + `<td class="num">${VL.fm(Math.sin(rad(r.eps)), 4)}</td>`
          + `<td class="num">${VL.fm(Math.sin(rad(r.phi)), 4)}</td>`
          + `<td class="num"${bad ? ' style="color:#b3382e"' : ''}><b>${VL.fm(r.n, 3)}</b></td>`
          + `<td class="num">${VL.fm(r.d, 3)}</td></tr>`;
      });
      h += '</table>';
    }
    if (rows.length && rows.length < 3) {
      h += '<p class="small">Отсчётов пока ' + rows.length + ': для обработки нужно не '
        + 'меньше трёх, а для сравнения двух способов — пять-восемь при разных углах.</p>';
    }

    let stA = null, fitB = null;
    if (rows.length >= 3) {
      const instr = rows.reduce((s, r) => s + r.d, 0) / rows.length;
      h += '<h3>Способ А: обработка ряда \\(n_i\\)</h3>';
      const pr = VL.processHtml({
        xs: rows.map(r => r.n), instr, sym: 'n', unit: '', dec: 3,
        trueVal: N_TRUE, trueName: 'показателем преломления стекла К8, заложенным в модель',
      });
      h += pr.html;
      stA = pr.st;

      /* способ Б: МНК через начало координат */
      const pts = rows.map(r => [Math.sin(rad(r.phi)), Math.sin(rad(r.eps))]);
      fitB = M.lsqThroughOrigin(pts);
      h += '<h3>Способ Б: МНК по точкам \\((\\sin\\varphi,\\ \\sin\\varepsilon)\\)</h3>'
        + '<p>Закон преломления \\(\\sin\\varepsilon = n\\sin\\varphi\\) — это прямая, '
        + 'обязанная пройти через начало координат: нулевому углу падения отвечает '
        + 'нулевой угол преломления. Наклон такой прямой и есть показатель преломления, '
        + 'а считается он по всем точкам сразу: \\(n=\\sum x_iy_i/\\sum x_i^2\\).</p>'
        + '<div id="vrchart"></div><div class="panel steps">'
        + VL.step('\\(n = \\dfrac{\\sum \\sin\\varphi_i\\sin\\varepsilon_i}{\\sum \\sin^2\\varphi_i}\\)',
          'МНК через начало координат по ' + rows.length + ' точкам', `\\(${VL.lm(fitB.k, 4)}\\)`)
        + VL.step('\\(S_n = S_y/\\sqrt{\\sum x_i^2}\\)',
          `\\(${VL.lm(fitB.Sy, 4)}/\\sqrt{${VL.lm(pts.reduce((s, p) => s + p[0] * p[0], 0), 3)}}\\)`,
          `\\(${VL.lm(fitB.Sk, 4)}\\)`)
        + VL.step('\\(\\Delta n = t_{\\alpha,n}S_n\\)',
          `\\(${VL.lm(fitB.t, 1)}\\cdot ${VL.lm(fitB.Sk, 4)}\\)`, `\\(${VL.lm(fitB.dk, 4)}\\)`)
        + '</div>';
      const stB = { mean: fitB.k, d: fitB.dk, alpha: 0.95 };
      h += '<div class="ans"><b>Результат по наклону прямой:</b> '
        + VL.record('n', stB, '') + '.</div>'
        + VL.verdict(stB, N_TRUE, 'показателем преломления стекла К8, заложенным в модель', '', 'n');

      /* сравнение способов */
      const relA = stA.d / stA.mean * 100, relB = fitB.dk / fitB.k * 100;
      h += '<h3>Какой способ точнее</h3><table class="el">'
        + '<tr><th>способ</th><th class="num">n</th><th class="num">Δn</th>'
        + '<th class="num">Δn/n, %</th><th class="num">отклонение от 1,516</th></tr>'
        + `<tr><td>А — среднее отношений синусов</td><td class="num">${VL.fm(stA.mean, 3)}</td>`
        + `<td class="num">${VL.fm(stA.d, 3)}</td><td class="num">${VL.fm(relA, 2)}</td>`
        + `<td class="num">${VL.fm(stA.mean - N_TRUE, 3)}</td></tr>`
        + `<tr><td>Б — МНК через начало координат</td><td class="num">${VL.fm(fitB.k, 3)}</td>`
        + `<td class="num">${VL.fm(fitB.dk, 3)}</td><td class="num">${VL.fm(relB, 2)}</td>`
        + `<td class="num">${VL.fm(fitB.k - N_TRUE, 3)}</td></tr></table>`
        + '<p class="small">Оба способа обрабатывают один и тот же журнал, но способ А '
        + 'даёт каждому отсчёту одинаковый вес, а в способе Б вес точки пропорционален '
        + '\\(\\sin^2\\varphi\\) — сама формула МНК отодвигает на второй план точки при '
        + 'малых углах, где отношение синусов считается плохо. Именно поэтому наклон '
        + 'прямой обычно выходит и точнее, и ближе к табличному значению.</p>';

      const small = rows.filter(r => Math.min(r.eps, r.phi) < 12);
      if (small.length) {
        h += '<div class="note"><b>Взгляните на строки, отмеченные красным.</b> '
          + small.length + ' отсчёт(а/ов) сняты при угле меньше 12°, и приборная '
          + 'погрешность отношения там \\(\\Delta n/n\\approx\\Delta\\varphi\\,\\mathrm{ctg}\\,\\varphi\\) '
          + 'достигает ' + VL.fm(100 * Math.max.apply(null, small.map(r => r.d / r.n)), 1)
          + ' %. В способе А такой отсчёт равноправен с хорошим и портит среднее; '
          + 'в способе Б он почти не влияет. Уберите его из ряда и сравните.</div>';
      }
    }

    /* предельный угол */
    if (crits.length) {
      h += '<h3>Предельный угол полного внутреннего отражения</h3>';
      h += '<p>Отсчёты \\(\\varphi_{\\text{пр}}\\), °: ' + crits.map(c => VL.fm(c, 1)).join('; ') + '.</p>';
      if (crits.length >= 2) {
        const st = VL.stats(crits, D_A, 0.95);
        const nc = 1 / Math.sin(rad(st.mean));
        const ind = M.indirect(a => 1 / Math.sin(a[0]), [rad(st.mean)], [rad(st.d)]);
        h += '<div class="panel steps">'
          + VL.step('\\(\\langle\\varphi_{\\text{пр}}\\rangle\\)',
            `среднее по ${st.n} отсчётам`, `\\(${VL.lm(st.mean, 2)}°\\)`)
          + VL.step('\\(\\Delta\\varphi_{\\text{пр}}\\)',
            `\\(\\sqrt{(${VL.lm(st.dRand, 2)})^2+(${VL.lm(D_A, 2)})^2}\\)`,
            `\\(${VL.lm(st.d, 2)}°\\)`)
          + VL.step('\\(n = 1/\\sin\\varphi_{\\text{пр}}\\)',
            `\\(1/\\sin ${VL.lm(st.mean, 2)}°\\)`, `\\(${VL.lm(nc, 3)}\\)`)
          + VL.step('\\(\\Delta n = n\\,\\mathrm{ctg}\\,\\varphi_{\\text{пр}}\\cdot\\Delta\\varphi\\)',
            `\\(${VL.lm(nc, 3)}\\cdot ${VL.lm(1 / Math.tan(rad(st.mean)), 3)}\\cdot ${VL.lm(rad(st.d), 4)}\\)`,
            `\\(${VL.lm(ind.d, 3)}\\)`)
          + '</div>'
          + VL.verdict({ mean: nc, d: ind.d, alpha: 0.95 }, N_TRUE,
            'показателем преломления стекла К8', '', 'n');
      } else {
        h += '<p class="small">Снимите предельный угол ещё раз-другой: по одному отсчёту '
          + 'погрешность не оценить.</p>';
      }
    }

    if (!h) {
      out.innerHTML = '';
      hint.textContent = 'Журнал пуст. Задайте угол падения, снимите отсчёт преломлённого '
        + 'луча по лимбу — и так при 6–8 разных углах, от малых до больших.';
      return;
    }
    out.innerHTML = h;
    if ($('vrchart') && fitB) drawFit(fitB);
    VL.mathify(out);
    hint.textContent = 'Отсчётов в журнале: ' + rows.length
      + (crits.length ? ', отсчётов предельного угла: ' + crits.length : '') + '.';
  }

  /* график sin ε (sin φ) с прямой МНК через начало координат */
  function drawFit(f) {
    const pts = rows.map(r => [Math.sin(rad(r.phi)), Math.sin(rad(r.eps))]);
    const xmax = 0.7, ymax = 1.05;
    const c = VL.chart('vrchart', '0 0 640 300');
    const ax = VL.axes(c, {
      x0: 62, y0: 250, x1: 600, y1: 40, xmin: 0, xmax, ymin: 0, ymax,
      xticks: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7].map(v => ({ v, label: VL.fm(v, 1) })),
      yticks: [0, 0.2, 0.4, 0.6, 0.8, 1].map(v => ({ v, label: VL.fm(v, 1) })),
      xlab: 'sin φ', ylab: 'sin ε',
    });
    const xe = Math.min(xmax, ymax / f.k);
    VL.series(c, [[ax.X(0), ax.Y(0)], [ax.X(xe), ax.Y(f.k * xe)]], '#6b6b74',
      null, { dash: '6 5', width: 1.4, noPoints: true });
    VL.series(c, pts.map(p => [ax.X(p[0]), ax.Y(p[1])]), '#155e75',
      rows.map(r => `ε = ${VL.fm(r.eps, 1)}°, φ = ${VL.fm(r.phi, 1)}°, n = ${VL.fm(r.n, 3)}`),
      { nolines: true });
    VL.label(c, 300, 72, '#1a7f37',
      'наклон n = ' + VL.fm(f.k, 3) + ' ± ' + VL.fm(f.dk, 3));
    VL.label(c, 300, 88, '#6b6b74',
      'прямая закреплена в начале координат: при φ = 0 и ε = 0');
  }

  /* ---------- органы управления ---------- */
  VL.slider('vrA', 'vrAv', v => VL.fm(v, 1) + '°', v => { ang = v; });
  $('vrmode').addEventListener('change', function () {
    mode = this.value;
  });
  $('vrsnap').addEventListener('click', snap);
  $('vrcrit').addEventListener('click', snapCrit);
  $('vrreset').addEventListener('click', () => {
    rows.length = 0; crits.length = 0; render();
  });

  VL.auto({
    autoBtn: 'vrauto', stopBtn: 'vrstop',
    lockIds: ['vrsnap', 'vrcrit', 'vrreset', 'vrA', 'vrmode'],
    total: () => 8,
    progress: (i, n) => {
      const p = $('vrprog'); p.style.display = ''; p.textContent = `угол ${i} из ${n}`;
    },
    step: async (i, ctl) => {
      if (i === 0) {
        rows.length = 0; crits.length = 0;
        mode = 'ag'; $('vrmode').value = 'ag';
        render();
      }
      const list = [5, 10, 20, 30, 40, 50, 60, 70];
      const s = $('vrA');
      s.value = list[i];
      s.dispatchEvent(new Event('input'));
      await ctl.sleep(340);
      if (!ctl.aborted()) snap();
    },
    onFinish: (aborted, done, n) => {
      $('vrprog').style.display = 'none';
      $('vrhint').textContent = aborted
        ? `Прогон остановлен: снято ${done} из ${n} отсчётов.`
        : 'Серия от 5° до 70° снята — сравните два способа обработки ниже.';
    },
  });

  render();
})();
