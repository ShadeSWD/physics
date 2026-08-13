/* Живая модель главы «Термодинамика»: цикл Карно.
   Цилиндр с поршнем синхронизирован с точкой на диаграммах p–V и T–S. */
'use strict';
(function () {
  var panel = document.getElementById('car-panel');
  if (!panel) return;
  var thIn = document.getElementById('car-th');
  var tcIn = document.getElementById('car-tc');
  var out = document.getElementById('car-out');
  var btn = document.getElementById('car-play');
  var pvPath = document.getElementById('car-pv');
  var pt = document.getElementById('car-pt');
  var pt2 = document.getElementById('car-pt2');
  var tsRect = document.getElementById('car-ts');
  var gas = document.getElementById('car-gas');
  var piston = document.getElementById('car-piston');
  var stage = document.getElementById('car-stage');
  var qin = document.getElementById('car-qin');
  var qlbl = document.getElementById('car-qlbl');
  var thLbl = document.getElementById('car-th-lbl');
  var tcLbl = document.getElementById('car-tc-lbl');
  if (!thIn || !tcIn || !out || !btn || !pvPath || !pt || !pt2 || !tsRect
    || !gas || !piston || !stage || !qin || !qlbl || !thLbl || !tcLbl) return;

  var GAM = 1.4;                       /* двухатомный газ */
  var PX0 = 235, PX1 = 415, PY0 = 215, PY1 = 50;      /* поле p–V */
  var SX0 = 470, SX1 = 610, SY0 = 200, SY1 = 55;      /* поле T–S */
  var T1 = 600, T2 = 300;
  var V1 = 1, V2 = 2, V3 = 1, V4 = 1;
  var vmin = 1, vmax = 2, pmin = 0, pmax = 1;
  var xyFn = null;

  function recalc() {
    T1 = parseFloat(thIn.value); T2 = parseFloat(tcIn.value);
    if (T2 >= T1 - 20) { T2 = T1 - 20; tcIn.value = T2; }
    var r = Math.pow(T1 / T2, 1 / (GAM - 1));
    V3 = V2 * r; V4 = V1 * r;
    vmin = V1; vmax = V3;
    pmax = T1 / V1; pmin = T2 / V3;
    /* контур цикла */
    var d = '', i, n = 40, V, p;
    function xy(V, p) {
      var x = PX0 + (PX1 - PX0) * (Math.log(V) - Math.log(vmin)) / (Math.log(vmax) - Math.log(vmin));
      var y = PY0 - (PY0 - PY1) * (Math.log(p) - Math.log(pmin)) / (Math.log(pmax) - Math.log(pmin));
      return [x, y];
    }
    xyFn = xy;
    for (i = 0; i <= n; i++) { V = V1 + (V2 - V1) * i / n; p = T1 / V; d += leg(i, xy(V, p)); }
    for (i = 0; i <= n; i++) { V = V2 + (V3 - V2) * i / n; p = T1 * Math.pow(V2, GAM - 1) / Math.pow(V, GAM); d += leg(1, xy(V, p)); }
    for (i = 0; i <= n; i++) { V = V3 + (V4 - V3) * i / n; p = T2 / V; d += leg(1, xy(V, p)); }
    for (i = 0; i <= n; i++) { V = V4 + (V1 - V4) * i / n; p = T2 * Math.pow(V4, GAM - 1) / Math.pow(V, GAM); d += leg(1, xy(V, p)); }
    d += ' Z';
    pvPath.setAttribute('d', d);
    /* прямоугольник T–S */
    var yTop = SY1, yBot = SY0;
    tsRect.setAttribute('x', SX0); tsRect.setAttribute('y', yTop);
    tsRect.setAttribute('width', SX1 - SX0);
    tsRect.setAttribute('height', yBot - yTop);
    thLbl.textContent = 'T₁ = ' + Math.round(T1) + ' К';
    tcLbl.textContent = 'T₂ = ' + Math.round(T2) + ' К';
    thLbl.setAttribute('y', yTop - 6); tcLbl.setAttribute('y', yBot + 16);
    var eta = 1 - T2 / T1;
    out.textContent = 'КПД цикла Карно η = 1 − T₂/T₁ = ' + (eta * 100).toFixed(1) + ' %';
  }
  function leg(i, q) { return (i ? ' L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }

  function state(u) {                  /* u ∈ [0,4): участок цикла */
    var k = Math.floor(u), f = u - k, V, p, T, s, name, q;
    if (k === 0) { V = V1 + (V2 - V1) * f; p = T1 / V; T = T1; s = f; name = 'изотермическое расширение при T₁'; q = 'Q₁'; }
    else if (k === 1) { V = V2 + (V3 - V2) * f; p = T1 * Math.pow(V2, GAM - 1) / Math.pow(V, GAM); T = T1 + (T2 - T1) * f; s = 1; name = 'адиабатическое расширение, газ остывает'; q = ''; }
    else if (k === 2) { V = V3 + (V4 - V3) * f; p = T2 / V; T = T2; s = 1 - f; name = 'изотермическое сжатие при T₂'; q = 'Q₂'; }
    else { V = V4 + (V1 - V4) * f; p = T2 * Math.pow(V4, GAM - 1) / Math.pow(V, GAM); T = T2 + (T1 - T2) * f; s = 0; name = 'адиабатическое сжатие, газ нагревается'; q = ''; }
    return { V: V, p: p, T: T, s: s, name: name, q: q };
  }

  recalc();
  thIn.addEventListener('input', recalc);
  tcIn.addEventListener('input', recalc);

  var running = true, raf = null, visible = true, t0 = performance.now();
  function frame(now) {
    raf = null;
    var u = ((now - t0) / 2500) % 4;
    var st = state(u);
    var xy = xyFn(st.V, st.p);
    pt.setAttribute('cx', xy[0].toFixed(1)); pt.setAttribute('cy', xy[1].toFixed(1));
    var x2 = SX0 + (SX1 - SX0) * st.s;
    var y2 = SY0 - (SY0 - SY1) * (st.T - parseFloat(tcIn.value)) /
      Math.max(1, parseFloat(thIn.value) - parseFloat(tcIn.value));
    pt2.setAttribute('cx', x2.toFixed(1)); pt2.setAttribute('cy', y2.toFixed(1));
    /* поршень: объём → положение */
    var rel = (Math.log(st.V) - Math.log(vmin)) / (Math.log(vmax) - Math.log(vmin));
    var yTop = 132 - 50 * rel;
    piston.setAttribute('y', yTop.toFixed(1));
    gas.setAttribute('y', (yTop + 8).toFixed(1));
    gas.setAttribute('height', Math.max(4, 209 - yTop - 8).toFixed(1));
    stage.textContent = st.name;
    if (st.q) {
      qin.setAttribute('d', st.q === 'Q₁' ? 'M14 190 H30' : 'M30 190 H14');
      qlbl.textContent = st.q === 'Q₁' ? 'Q₁ подводится' : 'Q₂ отводится';
    } else { qin.setAttribute('d', 'M20 190 H20'); qlbl.textContent = 'теплообмена нет'; }
    if (visible && running) raf = requestAnimationFrame(frame);
  }
  function start() { if (!raf && running && visible) { raf = requestAnimationFrame(frame); } }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (e) {
      visible = e[0].isIntersecting; if (visible) start(); else stop();
    }, { threshold: 0.01 }).observe(panel);
  }
  btn.addEventListener('click', function () {
    running = !running;
    btn.textContent = running ? 'Пауза' : 'Пуск';
    if (running) start(); else stop();
  });
  start();
})();
