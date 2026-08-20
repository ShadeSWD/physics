/* Виртуальный лабораторный практикум — общий движок (vanilla JS, без внешних
 * зависимостей). Каждая работа подключает свой assets/virt-<имя>.js и
 * пользуется этим пространством имён VL.
 *
 * Движок даёт три вещи:
 *   1) рисование и анимацию SVG-установки (el, label, chart, loop, meter,
 *      axes, series, fit);
 *   2) ВЁРСТКУ обработки ряда измерений — таблицу отклонений, шаги расчёта,
 *      запись результата и вердикт о согласии с эталоном; сама арифметика
 *      (среднее, СКО, Стьюдент, суммирование, округление, МНК) живёт в
 *      чистом модуле assets/metro.js и здесь только вызывается;
 *   3) авто-опыт (auto) — робот-лаборант прогоняет серию сам.
 *
 * Загружается после assets/common.js и assets/metro.js и пользуется их
 * помощниками ($, G, gauss) и расчётами (METRO).
 */
'use strict';
window.VL = (function () {
  const SVGNS = 'http://www.w3.org/2000/svg';

  /* ---------- рисование ---------- */

  /* создать SVG-элемент с атрибутами */
  function el(tag, attrs, parent) {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  /* убрать всё содержимое узла */
  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  /* подпись на схеме шрифтом 11 px заданного цвета */
  function label(svg, x, y, color, text, attrs) {
    const t = el('text', Object.assign({ x, y, style: `font:11px system-ui;fill:${color}` },
      attrs || {}), svg);
    t.textContent = text;
    return t;
  }

  /* поле графика: SVG-рамка внутри блока с идентификатором hostId */
  function chart(hostId, viewBox) {
    const svg = el('svg', { viewBox, class: 'geo-board', style: 'max-width:640px' });
    document.getElementById(hostId).appendChild(svg);
    return svg;
  }

  /* ---------- числа ---------- */

  /* число по-русски: запятая вместо точки */
  function fm(x, d) {
    const s = (Math.abs(x) < 5e-15 ? 0 : x).toFixed(d).replace('.', ',');
    return s.replace('-', '−');
  }
  /* число для LaTeX: 4,25 → 4{,}25 */
  function lm(x, d) {
    return x.toFixed(d).replace('.', '{,}');
  }
  /* равномерный шум ±a; нормальный шум gauss(s) взят из common.js */
  function noise(a) { return (Math.random() * 2 - 1) * a; }
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }

  /* ---------- KaTeX и вёрстка ---------- */

  /* дорисовать формулы в динамическом фрагменте (mathfmt.js подгружает
   * рендерер при загрузке страницы; если его нет — просто снять скобки) */
  function mathify(root) {
    if (window.renderMathInElement) {
      window.renderMathInElement(root, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\(', right: '\\)', display: false },
        ],
        throwOnError: false,
      });
    } else {
      root.innerHTML = root.innerHTML.replace(/\\\(|\\\)|\$\$/g, '');
    }
  }

  /* строка «решения по шагам»: формула = серым подстановка = жирным результат */
  function step(formula, subst, result) {
    return `<div>${formula} = <span style="color:#6b6b74">${subst}</span> = <b>${result}</b></div>`;
  }

  /* ---------- анимация ---------- */

  /* главный цикл на requestAnimationFrame; fn(dt, t) в секундах */
  function loop(fn) {
    let last = performance.now();
    function tick(now) {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      fn(dt, now / 1000);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* «шумящий» отсчёт прибора: значение обновляется не каждый кадр, а с
   * периодом period (как настоящий АЦП), сглаживание к цели с постоянной tau */
  function meter(period, tau) {
    return {
      smooth: 0, out: 0, _acc: 1e9, started: false,
      tick(dt, target, noiseFn) {
        if (!this.started) { this.smooth = target; this.started = true; }
        this.smooth += (target - this.smooth) * (1 - Math.exp(-dt / tau));
        this._acc += dt;
        if (this._acc >= period) { this._acc = 0; this.out = noiseFn(this.smooth); }
        return this.out;
      },
    };
  }

  /* ползунок: связать input[type=range] с подписью и обработчиком */
  function slider(id, labelId, fmt, onInput) {
    const inp = document.getElementById(id);
    const lab = labelId ? document.getElementById(labelId) : null;
    if (!inp) return null;
    const upd = () => {
      const v = parseFloat(inp.value);
      if (lab) lab.textContent = fmt(v);
      if (onInput) onInput(v);
    };
    inp.addEventListener('input', upd);
    upd();
    return { inp, set(v) { inp.value = v; upd(); }, get() { return parseFloat(inp.value); } };
  }

  /* ---------- графики ---------- */

  /* оси и сетка; возвращает функции X(v), Y(v).
   * cfg: {x0,y0,x1,y1 — рамка в px (y0 низ), xmin,xmax,ymin,ymax,
   *       xticks:[{v,label}], yticks:[{v,label}], xlab, ylab} */
  function axes(svg, cfg) {
    const X = v => cfg.x0 + (v - cfg.xmin) / (cfg.xmax - cfg.xmin) * (cfg.x1 - cfg.x0);
    const Y = v => cfg.y0 - (v - cfg.ymin) / (cfg.ymax - cfg.ymin) * (cfg.y0 - cfg.y1);
    const grid = el('g', { stroke: '#eceae3', 'stroke-width': 1 }, svg);
    (cfg.yticks || []).forEach(t => {
      if (Math.abs(t.v - cfg.ymin) > 1e-9)
        el('line', { x1: cfg.x0, y1: Y(t.v), x2: cfg.x1, y2: Y(t.v) }, grid);
    });
    (cfg.xticks || []).forEach(t => {
      if (Math.abs(t.v - cfg.xmin) > 1e-9)
        el('line', { x1: X(t.v), y1: cfg.y1, x2: X(t.v), y2: cfg.y0 }, grid);
    });
    el('line', { x1: cfg.x0, y1: cfg.y0, x2: cfg.x1 + 6, y2: cfg.y0, stroke: '#16161a', 'stroke-width': 1.6 }, svg);
    el('line', { x1: cfg.x0, y1: cfg.y0, x2: cfg.x0, y2: cfg.y1 - 6, stroke: '#16161a', 'stroke-width': 1.6 }, svg);
    const lab = el('g', { style: 'font:11px system-ui;fill:#6b6b74' }, svg);
    (cfg.xticks || []).forEach(t => {
      const tx = el('text', { x: X(t.v), y: cfg.y0 + 14, 'text-anchor': 'middle' }, lab);
      tx.textContent = t.label;
    });
    (cfg.yticks || []).forEach(t => {
      const tx = el('text', { x: cfg.x0 - 6, y: Y(t.v) + 4, 'text-anchor': 'end' }, lab);
      tx.textContent = t.label;
    });
    if (cfg.xlab) {
      const tx = el('text', { x: cfg.x1, y: cfg.y0 + 30, 'text-anchor': 'end' }, lab);
      tx.textContent = cfg.xlab;
    }
    if (cfg.ylab) {
      const tx = el('text', { x: cfg.x0 + 6, y: cfg.y1 + 2 }, lab);
      tx.textContent = cfg.ylab;
    }
    return { X, Y };
  }

  /* «круглые» деления шкалы: шаг 1, 2, 2,5 или 5 на порядок */
  function ticks(min, max, n) {
    const raw = (max - min) / Math.max(1, n);
    if (!(raw > 0)) return [];
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const q = raw / mag;
    const step = (q <= 1 ? 1 : q <= 2 ? 2 : q <= 2.5 ? 2.5 : q <= 5 ? 5 : 10) * mag;
    const out = [];
    for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + 1e-9; v += step) {
      out.push(Math.round(v / step) * step);
    }
    return out;
  }

  /* ломаная и точки со всплывающими подсказками */
  function series(svg, pts, color, titles, opts) {
    const o = opts || {};
    if (pts.length > 1 && !o.nolines)
      el('polyline', {
        points: pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '),
        fill: 'none', stroke: color, 'stroke-width': o.width || 2,
        'stroke-dasharray': o.dash || 'none',
      }, svg);
    if (o.noPoints) return;
    const g = el('g', { fill: color }, svg);
    pts.forEach((p, i) => {
      const c = el('circle', { cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: o.r || 3.5 }, g);
      if (titles && titles[i]) {
        const t = el('title', {}, c);
        t.textContent = titles[i];
      }
    });
  }

  /* ---------- статистика практикума: тонкие обёртки над METRO ----------
   *
   * Раньше здесь лежали свои копии среднего, СКО, таблицы Стьюдента и
   * округления. Копии нельзя было ни проверить тестом (файл трогает DOM и
   * в node не грузится), ни переиспользовать на статической странице
   * errors.html. Теперь расчёт один — в assets/metro.js, а тут остались
   * только имена, к которым привыкли двенадцать работ. */
  const M = (typeof window !== 'undefined' && window.METRO) || null;

  /* прямая y = kx + b по методу наименьших квадратов; pts — массив [x, y].
     Отдаёт заодно погрешности коэффициентов — работы, которые определяют
     величину по наклону прямой, берут Δk прямо отсюда. */
  function fit(pts) { return M.lsq(pts); }

  const tstud = (n, alpha) => M.tStudent(n, alpha);
  const stats = (xs, instr, alpha) => M.series(xs, instr, alpha);

  /* округление по правилам практикума (METRO.roundPair) плюс готовые строки
   * с запятой-разделителем — их печатают журнал и запись результата */
  function roundPair(x, d) {
    const r = M.roundPair(x, d);
    return { x: r.x, d: r.d, dec: r.dec, sx: fm(r.x, r.dec), sd: fm(r.d, r.dec) };
  }

  /* запись результата в виде «⟨x⟩ ± Δx, единицы (α = 0,95)» */
  function record(sym, st, unit) {
    const r = roundPair(st.mean, st.d);
    return `\\(${sym} = (${r.sx.replace(',', '{,}')} \\pm ${r.sd.replace(',', '{,}')})\\)&nbsp;${unit}` +
      ` при \\(\\alpha = ${lm(st.alpha, 2)}\\)`;
  }

  /* таблица отклонений: строки — величина, отклонение, квадрат отклонения */
  function devTable(xs, mean, dec, sym, unit) {
    let h = '<table class="el"><tr><th class="num">№</th>';
    xs.forEach((_, i) => { h += `<th class="num">${i + 1}</th>`; });
    h += '</tr><tr><td>' + sym + (unit ? ', ' + unit : '') + '</td>';
    xs.forEach(x => { h += `<td class="num">${fm(x, dec)}</td>`; });
    h += '</tr><tr><td>отклонение от среднего</td>';
    xs.forEach(x => { h += `<td class="num">${fm(x - mean, dec + 1)}</td>`; });
    h += '</tr></table>';
    return h;
  }

  /* полный блок обработки ряда: таблица отклонений, шаги, результат, вердикт.
   * cfg: {xs, instr, alpha, sym (LaTeX без скобок), unit, dec,
   *       trueVal, trueName, relDec} */
  function processHtml(cfg) {
    const xs = cfg.xs;
    const st = stats(xs, cfg.instr, cfg.alpha);
    const dec = cfg.dec != null ? cfg.dec : 3;
    const sym = cfg.sym;
    const unit = cfg.unit || '';
    let h = devTable(xs, st.mean, dec, `\\({${sym}}_i\\)`, unit);
    h += '<div class="panel steps">';
    h += step(`\\(\\langle ${sym}\\rangle = \\dfrac1n\\sum {${sym}}_i\\)`,
      `\\(${lm(xs.reduce((s, x) => s + x, 0), dec)}/${st.n}\\)`,
      `\\(${lm(st.mean, dec)}\\)&nbsp;${unit}`);
    h += step(`\\(\\sum({${sym}}_i-\\langle ${sym}\\rangle)^2\\)`, 'сумма квадратов отклонений',
      `\\(${st.ss.toExponential(2).replace('.', '{,}').replace('e', '\\cdot 10^{') + '}'}\\)`);
    h += step(`\\(S_{\\langle ${sym}\\rangle} = \\sqrt{\\dfrac{\\sum({${sym}}_i-\\langle ${sym}\\rangle)^2}{n(n-1)}}\\)`,
      `\\(\\sqrt{${st.ss.toExponential(2).replace('.', '{,}').replace('e', '\\cdot 10^{') + '}'}/(${st.n}\\cdot ${st.n - 1})}\\)`,
      `\\(${lm(st.Sm, dec + 1)}\\)&nbsp;${unit}`);
    h += step(`\\(\\Delta {${sym}}_{\\text{сл}} = t_{\\alpha,n}S_{\\langle ${sym}\\rangle}\\)`,
      `\\(${lm(st.t, 1)}\\cdot ${lm(st.Sm, dec + 1)}\\)`,
      `\\(${lm(st.dRand, dec + 1)}\\)&nbsp;${unit}`);
    if (st.dInstr > 0) {
      h += step(`\\(\\Delta ${sym} = \\sqrt{\\Delta {${sym}}_{\\text{сл}}^2 + \\Delta {${sym}}_{\\text{приб}}^2}\\)`,
        `\\(\\sqrt{${lm(st.dRand, dec + 1)}^2 + ${lm(st.dInstr, dec + 1)}^2}\\)`,
        `\\(${lm(st.d, dec + 1)}\\)&nbsp;${unit}`);
    }
    h += step('относительная погрешность \\(\\Delta ' + sym + '/' + sym + '\\)',
      `\\(${lm(st.d, dec + 1)}/${lm(st.mean, dec)}\\)`,
      `\\(${lm(st.rel * 100, 1)}\\,\\%\\)`);
    h += '</div>';
    h += `<div class="ans"><b>Результат вашего опыта:</b> ${record(sym, st, unit)}.</div>`;
    if (cfg.trueVal != null) h += verdict(st, cfg.trueVal, cfg.trueName, unit, sym);
    return { html: h, st };
  }

  /* вердикт: согласуется ли результат с истинным значением модели */
  function verdict(st, trueVal, trueName, unit, sym) {
    const r = roundPair(st.mean, st.d);
    const dev = Math.abs(st.mean - trueVal);
    const ok = dev <= st.d;
    const near = dev <= 2 * st.d;
    const name = trueName || 'заложенное в модель значение';
    let txt;
    if (ok) {
      txt = `Расхождение со значением, заложенным в модель, составляет ${fm(dev, r.dec)}&nbsp;${unit} — ` +
        'оно <b>меньше</b> доверительного интервала, то есть результат ' +
        `<b>согласуется с ${name}</b> в пределах погрешности. Именно такую формулировку и пишут в выводе отчёта.`;
    } else if (near) {
      txt = `Расхождение ${fm(dev, r.dec)}&nbsp;${unit} немного превышает доверительный интервал ` +
        `(${fm(st.d, r.dec)}&nbsp;${unit}). Так бывает при малом числе отсчётов: интервал ещё «не поймал» ` +
        'истинное значение. Добавьте измерений — вывод должен сойтись.';
    } else {
      txt = `Расхождение ${fm(dev, r.dec)}&nbsp;${unit} заметно больше доверительного интервала ` +
        `(${fm(st.d, r.dec)}&nbsp;${unit}): скорее всего, в ряду есть промах либо систематическая ошибка ` +
        '(например, отсчёты сняты не в том режиме). Проверьте журнал и повторите серию.';
    }
    return `<div class="check"><b>Сравнение с истинным значением.</b> В модель заложено ` +
      `\\({${sym}}_{\\text{ист}} = ${lm(trueVal, r.dec)}\\)&nbsp;${unit}, у вас получилось ` +
      `\\(${r.sx.replace(',', '{,}')} \\pm ${r.sd.replace(',', '{,}')}\\)&nbsp;${unit}. ${txt}</div>`;
  }

  /* ---------- авто-опыт ---------- */

  /* робот-лаборант прогоняет серию измерений сам.
   * cfg: {autoBtn, stopBtn — id кнопок; lockIds — id блокируемых элементов;
   * total() — число измерений; step(i, api) — асинхронный шаг;
   * progress(i, n); onFinish(aborted, done, n)}.
   * Возвращает {running()} — страницы блокируют ручные действия на время прогона. */
  function auto(cfg) {
    const a = document.getElementById(cfg.autoBtn);
    const s = document.getElementById(cfg.stopBtn);
    let stop = false, running = false;
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    function lock(on) {
      (cfg.lockIds || []).forEach(id => {
        const e = document.getElementById(id);
        if (e) e.disabled = on;
      });
      a.style.display = on ? 'none' : '';
      s.style.display = on ? '' : 'none';
    }
    a.addEventListener('click', async () => {
      if (running) return;
      running = true; stop = false; lock(true);
      const n = cfg.total();
      let done = 0;
      for (let i = 0; i < n; i++) {
        if (stop) break;
        cfg.progress(i + 1, n);
        await cfg.step(i, { sleep, aborted: () => stop });
        done++;
      }
      lock(false); running = false;
      cfg.onFinish(stop, done, n);
    });
    s.addEventListener('click', () => { stop = true; });
    return { running: () => running };
  }

  return {
    el, clear, label, chart, fm, lm, noise, gauss, clamp, mathify, step, loop,
    meter, slider, axes, series, ticks, fit, tstud, stats, roundPair, record,
    devTable, processHtml, verdict, auto,
  };
})();
