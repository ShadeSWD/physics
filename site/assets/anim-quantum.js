/* Живая модель главы «Квантовая физика»: внешний фотоэффект.
   Фотоны падают на катод; электроны вылетают, только если hν > A_вых. */
'use strict';
(function () {
  var panel = document.getElementById('pht-panel');
  if (!panel) return;
  var lIn = document.getElementById('pht-l');
  var iIn = document.getElementById('pht-i');
  var uIn = document.getElementById('pht-u');
  var matIn = document.getElementById('pht-mat');
  var out = document.getElementById('pht-out');
  var gPh = document.getElementById('pht-photons');
  var gEl = document.getElementById('pht-electrons');
  var line = document.getElementById('pht-line');
  var dot = document.getElementById('pht-dot');
  var nu0 = document.getElementById('pht-nu0');
  var nu0lbl = document.getElementById('pht-nu0lbl');
  if (!lIn || !iIn || !uIn || !matIn || !out || !gPh || !gEl || !line || !dot || !nu0 || !nu0lbl) return;

  var H = 6.626e-34, C = 2.998e8, E = 1.602e-19;
  var GX0 = 340, GX1 = 615, GY0 = 210, GY1 = 50;
  var NUMAX = 2.0e15;              /* верх шкалы частот на графике */
  var photons = [], electrons = [];

  function colorOf(nm) {
    if (nm < 400) return '#155e75';
    if (nm < 500) return '#155e75';
    if (nm < 570) return '#1a7f37';
    if (nm < 620) return '#6b6b74';
    return '#b3382e';
  }
  function nuOf(nm) { return C / (nm * 1e-9); }

  function drawGraph(A) {
    var nu0v = A * E / H;
    /* прямая E_max = hν − A, начиная от ν0 */
    var emax = H * NUMAX - A * E;
    var x0 = GX0 + (GX1 - GX0) * nu0v / NUMAX;
    var y1 = GY0 - (GY0 - GY1) * (H * NUMAX - A * E) / Math.max(1e-30, emax);
    line.setAttribute('d', 'M' + x0.toFixed(1) + ' ' + GY0 + ' L' + GX1 + ' ' + GY1);
    nu0.setAttribute('d', 'M' + x0.toFixed(1) + ' ' + GY0 + ' V' + GY1);
    nu0lbl.setAttribute('x', (x0 + 4).toFixed(1));
    return { nu0: nu0v, emaxTop: emax, y1: y1 };
  }

  var visible = true, raf = null, last = performance.now(), acc = 0;

  function frame(now) {
    raf = null;
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    var nm = parseFloat(lIn.value);
    var A = parseFloat(matIn.value);
    var inten = parseFloat(iIn.value);
    var U = parseFloat(uIn.value) / 10;          /* В */
    var nu = nuOf(nm);
    var Emax = H * nu - A * E;                    /* Дж */
    var g = drawGraph(A);
    var col = colorOf(nm);

    /* точка на графике */
    var xd = GX0 + (GX1 - GX0) * nu / NUMAX;
    var yd = Emax > 0 ? GY0 - (GY0 - GY1) * Emax / g.emaxTop : GY0;
    dot.setAttribute('cx', Math.min(GX1, xd).toFixed(1));
    dot.setAttribute('cy', Math.max(GY1, yd).toFixed(1));

    /* рождение фотонов */
    acc += dt * inten * 3;
    while (acc >= 1) {
      acc -= 1;
      photons.push({ x: 250, y: 50 + Math.random() * 160 });
    }
    var s = '', i, p;
    for (i = photons.length - 1; i >= 0; i--) {
      p = photons[i];
      p.x -= 260 * dt;
      if (p.x < 56) {
        photons.splice(i, 1);
        /* выбивание электрона */
        var Ue = Emax / E;                        /* эВ = запирающее напряжение */
        if (Emax > 0 && Ue > U) {
          electrons.push({ x: 56, y: p.y, v: 60 + 240 * Math.min(1, (Ue - U) / 3) });
        }
        continue;
      }
      s += '<path d="M' + p.x.toFixed(1) + ' ' + p.y.toFixed(1)
        + ' q 5 -6 10 0 q 5 6 10 0" fill="none" stroke="' + col + '" stroke-width="1.6"/>';
    }
    gPh.innerHTML = s;

    var se = '';
    for (i = electrons.length - 1; i >= 0; i--) {
      var e = electrons[i];
      e.x += e.v * dt;
      if (e.x > 252) { electrons.splice(i, 1); continue; }
      se += '<circle cx="' + e.x.toFixed(1) + '" cy="' + e.y.toFixed(1)
        + '" r="3.4" fill="#b3382e"/>';
    }
    gEl.innerHTML = se;

    var UzV = Emax > 0 ? Emax / E : 0;
    out.textContent = 'λ = ' + nm.toFixed(0) + ' нм · hν = '
      + (H * nu / E).toFixed(2) + ' эВ · A = ' + A.toFixed(1) + ' эВ · '
      + (Emax > 0
        ? ('E_max = ' + UzV.toFixed(2) + ' эВ, запирающее U₃ = ' + UzV.toFixed(2) + ' В'
          + (UzV > U ? ' · ток идёт' : ' · ток заперт'))
        : 'hν < A — фотоэффекта нет')
      + ' · λ_кр = ' + (H * C / (A * E) * 1e9).toFixed(0) + ' нм';
    if (visible) raf = requestAnimationFrame(frame);
  }
  function start() { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (ev) {
      visible = ev[0].isIntersecting; if (visible) start(); else stop();
    }, { threshold: 0.01 }).observe(panel);
  }
  start();
})();
