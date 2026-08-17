/* Живые модели главы «Колебания и волны»: резонанс и сложение волн.
   Чистый ES5-стиль, без модулей; рисование — обновление атрибутов SVG. */
'use strict';
(function () {
  /* ================= 1. Резонанс ================= */
  (function () {
    var panel = document.getElementById('osc-res-panel');
    if (!panel) return;
    var wIn = document.getElementById('osc-w');
    var qIn = document.getElementById('osc-q');
    var out = document.getElementById('osc-out');
    var box = document.getElementById('osc-box');
    var spring = document.getElementById('osc-spring');
    var force = document.getElementById('osc-force');
    var afc = document.getElementById('osc-afc');
    var dot = document.getElementById('osc-dot');
    var btn = document.getElementById('osc-play');
    if (!wIn || !qIn || !out || !box || !spring || !force || !afc || !dot || !btn) return;

    var X0 = 250, X1 = 620, Y0 = 210, YTOP = 40;   /* поле графика АЧХ */
    var WMAX = 2.5;                                 /* макс. ω/ω₀ на графике */
    var running = true;

    function amp(r, Q) {          /* безразмерная амплитуда A/A_стат */
      var d = (1 - r * r), b = r / Q;
      return 1 / Math.sqrt(d * d + b * b);
    }
    function phase(r, Q) {        /* сдвиг фазы, рад (отставание) */
      return -Math.atan2(r / Q, 1 - r * r);
    }
    function drawAfc(Q) {
      var top = 1;
      for (var i = 0; i <= 120; i++) top = Math.max(top, amp(i / 120 * WMAX, Q));
      var d = '', n = 240;
      for (var j = 0; j <= n; j++) {
        var r = j / n * WMAX;
        var x = X0 + (X1 - X0) * r / WMAX;
        var y = Y0 - (Y0 - YTOP) * amp(r, Q) / top;
        d += (j ? ' L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      }
      afc.setAttribute('d', d);
      return top;
    }

    var topA = drawAfc(8);
    var lastQ = -1;
    var eng = animLoop(panel, function (t) {
      var r = Math.max(0.01, wIn.value / 100);          /* ω/ω₀ */
      var Q = qIn.value / 10;                            /* добротность */
      if (Q !== lastQ) { topA = drawAfc(Q); lastQ = Q; }
      var A = amp(r, Q), ph = phase(r, Q);
      var x = X0 + (X1 - X0) * Math.min(r, WMAX) / WMAX;
      var y = Y0 - (Y0 - YTOP) * A / topA;
      dot.setAttribute('cx', x.toFixed(1));
      dot.setAttribute('cy', y.toFixed(1));
      /* маятник: смещение относительно равновесия y=105 */
      var om = 2 * Math.PI * 0.5 * r;                    /* «медленное» время */
      var disp = 26 * Math.min(A / topA * 2.2, 1.6) * Math.cos(om * t + ph);
      var yb = 90 + disp;
      box.setAttribute('y', yb.toFixed(1));
      spring.setAttribute('d', 'M110 30 V' + yb.toFixed(1));
      var f = 16 * Math.cos(om * t);
      force.setAttribute('d', 'M110 ' + (190 + 0).toFixed(1) + ' V' + (194 + f).toFixed(1));
      out.textContent = 'A/Aст = ' + A.toFixed(2)
        + ' · сдвиг фазы ' + Math.round(ph * 180 / Math.PI) + '°'
        + ' · Q = ' + Q.toFixed(1) + ' · ω/ω₀ = ' + r.toFixed(2);
    });
    btn.addEventListener('click', function () {
      running = !running;
      eng.setRunning(running);
      btn.textContent = running ? 'Пауза' : 'Пуск';
    });
  })();

  /* ================= 2. Волны и интерференция ================= */
  (function () {
    var panel = document.getElementById('osc-wave-panel');
    if (!panel) return;
    var mode = document.getElementById('osc-mode');
    var pIn = document.getElementById('osc-p');
    var out = document.getElementById('osc-wout');
    var w1 = document.getElementById('osc-w1');
    var w2 = document.getElementById('osc-w2');
    var sum = document.getElementById('osc-sum');
    var nodes = document.getElementById('osc-nodes');
    if (!mode || !pIn || !out || !w1 || !w2 || !sum || !nodes) return;

    var X0 = 30, X1 = 610, N = 145, AMP = 22;
    function path(baseY, f) {
      var d = '';
      for (var i = 0; i <= N; i++) {
        var x = X0 + (X1 - X0) * i / N;
        var y = baseY - AMP * f(i / N);
        d += (i ? ' L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      }
      return d;
    }
    function setNodes(list) {
      var s = '';
      for (var i = 0; i < list.length; i++) {
        var x = (X0 + (X1 - X0) * list[i]).toFixed(1);
        s += '<circle cx="' + x + '" cy="220" r="3.5" fill="#b3382e"/>';
      }
      nodes.innerHTML = s;
    }

    animLoop(panel, function (t) {
      var m = mode.value, p = pIn.value / 100;   /* 0…2 */
      var k = 2 * Math.PI * 2.5, om = 2 * Math.PI * 0.5;
      var f1, f2, label;
      if (m === 'std') {
        f1 = function (u) { return Math.cos(k * u - om * t); };
        f2 = function (u) { return Math.cos(k * u + om * t); };
        label = 'встречные волны: узлы через λ/2';
        var list = [];
        for (var i = 0; i < 6; i++) {
          var u = (Math.PI / 2 + Math.PI * i) / k;
          if (u <= 1) list.push(u);
        }
        setNodes(list);
      } else if (m === 'beat') {
        var d = 0.12 * p;
        f1 = function (u) { return Math.cos(k * u - om * t); };
        f2 = function (u) { return Math.cos(k * (1 + d) * u - om * (1 + d) * t); };
        label = 'расстройка частот ' + (d * 100).toFixed(0) + ' %';
        setNodes([]);
      } else {
        var dphi = p * Math.PI;
        f1 = function (u) { return Math.cos(k * u - om * t); };
        f2 = function (u) { return Math.cos(k * u - om * t + dphi); };
        label = 'разность фаз ' + Math.round(dphi * 180 / Math.PI)
          + '° → амплитуда суммы '
          + (2 * Math.abs(Math.cos(dphi / 2))).toFixed(2) + ' A';
        setNodes([]);
      }
      w1.setAttribute('d', path(60, f1));
      w2.setAttribute('d', path(140, f2));
      sum.setAttribute('d', path(220, function (u) { return (f1(u) + f2(u)) / 2; }));
      out.textContent = label;
    });
  })();
})();
