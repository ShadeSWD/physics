/* Живая модель главы «Молекулярно-кинетическая теория»:
   газ из 140 частиц + мгновенная гистограмма скоростей и кривая Максвелла. */
'use strict';
(function () {
  var panel = document.getElementById('mol-panel');
  if (!panel) return;
  var tIn = document.getElementById('mol-t');
  var gasIn = document.getElementById('mol-gas');
  var out = document.getElementById('mol-out');
  var dots = document.getElementById('mol-dots');
  var hist = document.getElementById('mol-hist');
  var curve = document.getElementById('mol-curve');
  var vpLine = document.getElementById('mol-vp');
  var vpLbl = document.getElementById('mol-vplbl');
  var scaleLbl = document.getElementById('mol-scale');
  if (!tIn || !gasIn || !out || !dots || !hist || !curve || !vpLine || !vpLbl || !scaleLbl) return;

  var R = 8.314;
  var BOX = { x: 20, y: 40, w: 240, h: 200 };
  var GX0 = 320, GX1 = 615, GY0 = 240, GYT = 45;
  var N = 140, PIX = 1 / 26;      /* пикселей экрана на 1 м/с (масштаб движения) */
  var parts = [], svgns = 'http://www.w3.org/2000/svg';

  /* нормально распределённое число (Бокс — Мюллер) */
  function gauss() {
    var u = 1 - Math.random(), v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function sigma(T, M) { return Math.sqrt(R * T / M); }   /* СКО компоненты скорости */

  function build() {
    var frag = '';
    for (var i = 0; i < N; i++) {
      parts.push({ x: BOX.x + Math.random() * BOX.w, y: BOX.y + Math.random() * BOX.h, vx: 0, vy: 0 });
      frag += '<circle r="2.6" fill="#155e75" cx="0" cy="0"/>';
    }
    dots.innerHTML = frag;
  }
  function reseed(T, M) {
    var s = sigma(T, M);
    for (var i = 0; i < N; i++) { parts[i].vx = gauss() * s; parts[i].vy = gauss() * s; }
  }
  build();

  var M = parseFloat(gasIn.value) / 1000, T = parseFloat(tIn.value);
  reseed(T, M);

  function maxwell(v, T, M) {              /* f(v), 2D-совместимая 3D-форма */
    var a = M / (2 * R * T);
    return 4 * Math.PI * Math.pow(a / Math.PI, 1.5) * v * v * Math.exp(-a * v * v);
  }

  var vMax = 1, BINS = 26;
  function rescale() {
    vMax = 3.2 * Math.sqrt(2 * R * T / M);          /* верх шкалы графика */
    scaleLbl.textContent = '0 … ' + Math.round(vMax) + ' м/с';
  }
  rescale();

  function drawCurve() {
    var top = 0, i, v, f;
    for (i = 0; i <= 200; i++) { top = Math.max(top, maxwell(i / 200 * vMax, T, M)); }
    var d = '';
    for (i = 0; i <= 200; i++) {
      v = i / 200 * vMax; f = maxwell(v, T, M);
      var x = GX0 + (GX1 - GX0) * v / vMax;
      var y = GY0 - (GY0 - GYT) * f / top;
      d += (i ? ' L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    curve.setAttribute('d', d);
    var vp = Math.sqrt(2 * R * T / M);
    var xp = GX0 + (GX1 - GX0) * vp / vMax;
    vpLine.setAttribute('d', 'M' + xp.toFixed(1) + ' ' + GY0 + ' V' + GYT);
    vpLbl.setAttribute('x', (xp + 5).toFixed(1));
    return top;
  }
  var curveTop = drawCurve();

  function drawHist() {
    var bins = new Array(BINS), i;
    for (i = 0; i < BINS; i++) bins[i] = 0;
    for (i = 0; i < N; i++) {
      var v = Math.sqrt(parts[i].vx * parts[i].vx + parts[i].vy * parts[i].vy);
      var b = Math.floor(v / vMax * BINS);
      if (b >= 0 && b < BINS) bins[b]++;
    }
    /* нормируем так, чтобы гистограмма сравнивалась с кривой */
    var dv = vMax / BINS, s = '';
    for (i = 0; i < BINS; i++) {
      var f = bins[i] / (N * dv);
      var h = (GY0 - GYT) * f / curveTop;
      if (h > GY0 - GYT) h = GY0 - GYT;
      var x = GX0 + (GX1 - GX0) * i / BINS;
      var w = (GX1 - GX0) / BINS - 1.5;
      s += '<rect x="' + x.toFixed(1) + '" y="' + (GY0 - h).toFixed(1)
        + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1)
        + '" fill="rgba(26,127,55,.35)" stroke="#1a7f37" stroke-width="0.8"/>';
    }
    hist.innerHTML = s;
  }

  function step(dt) {
    var nodes = dots.childNodes;
    for (var i = 0; i < N; i++) {
      var p = parts[i];
      p.x += p.vx * PIX * dt; p.y += p.vy * PIX * dt;
      if (p.x < BOX.x + 3) { p.x = BOX.x + 3; p.vx = -p.vx; }
      if (p.x > BOX.x + BOX.w - 3) { p.x = BOX.x + BOX.w - 3; p.vx = -p.vx; }
      if (p.y < BOX.y + 3) { p.y = BOX.y + 3; p.vy = -p.vy; }
      if (p.y > BOX.y + BOX.h - 3) { p.y = BOX.y + BOX.h - 3; p.vy = -p.vy; }
      nodes[i].setAttribute('cx', p.x.toFixed(1));
      nodes[i].setAttribute('cy', p.y.toFixed(1));
    }
  }

  function readout() {
    var vp = Math.sqrt(2 * R * T / M);
    var vm = Math.sqrt(8 * R * T / (Math.PI * M));
    var vk = Math.sqrt(3 * R * T / M);
    out.textContent = 'T = ' + Math.round(T) + ' К · v_в = ' + Math.round(vp)
      + ' · ⟨v⟩ = ' + Math.round(vm) + ' · v_кв = ' + Math.round(vk) + ' м/с';
  }
  readout();

  function onChange() {
    T = parseFloat(tIn.value); M = parseFloat(gasIn.value) / 1000;
    reseed(T, M); rescale(); curveTop = drawCurve(); readout();
  }
  tIn.addEventListener('input', onChange);
  gasIn.addEventListener('change', onChange);

  var visible = true, raf = null, last = performance.now();
  function frame(now) {
    raf = null;
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    step(dt); drawHist();
    if (visible) raf = requestAnimationFrame(frame);
  }
  function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (e) {
      visible = e[0].isIntersecting; if (visible) start(); else stop();
    }, { threshold: 0.01 }).observe(panel);
  }
  start();
})();
