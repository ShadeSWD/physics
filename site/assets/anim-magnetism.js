/* Живая модель главы «Магнетизм»: движение заряда в однородном магнитном поле.
   Вид «на нас» — окружность; вид сбоку — винтовая линия при v∥ ≠ 0. */
'use strict';
(function () {
  var panel = document.getElementById('mag-panel');
  if (!panel) return;
  var bIn = document.getElementById('mag-b');
  var vIn = document.getElementById('mag-v');
  var aIn = document.getElementById('mag-a');
  var negIn = document.getElementById('mag-neg');
  var out = document.getElementById('mag-out');
  var field = document.getElementById('mag-field');
  var track = document.getElementById('mag-track');
  var q = document.getElementById('mag-q');
  var vvec = document.getElementById('mag-vvec');
  var fvec = document.getElementById('mag-fvec');
  var helix = document.getElementById('mag-helix');
  if (!bIn || !vIn || !aIn || !negIn || !out || !field || !track || !q || !vvec || !fvec || !helix) return;

  /* точки — линии поля «на нас» */
  (function () {
    var s = '';
    for (var i = 0; i < 8; i++) {
      for (var j = 0; j < 5; j++) {
        s += '<circle cx="' + (60 + i * 45) + '" cy="' + (55 + j * 45)
          + '" r="2" fill="#155e75"/>';
      }
    }
    field.innerHTML = s;
  })();

  var CX = 220, CY = 140;   /* центр области поля */
  var trail = [];

  function params() {
    var B = bIn.value / 100;                 /* условные единицы */
    var v = vIn.value / 100;
    var ang = aIn.value * Math.PI / 180;     /* угол между v и плоскостью */
    var sgn = negIn.checked ? -1 : 1;
    var vperp = v * Math.cos(ang), vpar = v * Math.sin(ang);
    var r = 70 * vperp / B;                   /* пиксели */
    if (r > 105) r = 105;
    if (r < 8) r = 8;
    var om = sgn * 1.6 * B;                   /* угловая скорость на экране */
    return { B: B, v: v, r: r, om: om, vpar: vpar, sgn: sgn };
  }

  /* физические величины для электрона: B в мТл, v в 10⁶ м/с */
  var ME = 9.109384e-31, QE = 1.602177e-19;
  function readout(p) {
    var B = p.B * 1e-3, v = p.v * 1e6;
    var r = ME * v / (QE * B);                 /* м */
    var T = 2 * Math.PI * ME / (QE * B);       /* с */
    out.textContent = 'электрон в поле B = ' + p.B.toFixed(2) + ' мТл при v = '
      + p.v.toFixed(2) + '·10⁶ м/с: радиус r = mv/(qB) = ' + (r * 1e3).toFixed(1)
      + ' мм, период T = 2πm/(qB) = ' + (T * 1e9).toFixed(1) + ' нс, частота '
      + (1 / T / 1e6).toFixed(1) + ' МГц · заряд '
      + (p.sgn < 0 ? 'отрицательный (вращение против часовой стрелки)'
        : 'положительный (вращение по часовой стрелке)');
  }

  [bIn, vIn, aIn].forEach(function (el) {
    el.addEventListener('input', function () { trail = []; });
  });
  negIn.addEventListener('change', function () { trail = []; });

  animLoop(panel, function (t) {
    var p = params();
    var ph = p.om * t;
    var x = CX + p.r * Math.cos(ph);
    var y = CY + p.r * Math.sin(ph);
    q.setAttribute('cx', x.toFixed(1)); q.setAttribute('cy', y.toFixed(1));
    /* скорость — касательная, сила — к центру */
    var vx = -Math.sin(ph) * p.om, vy = Math.cos(ph) * p.om;
    var vn = Math.sqrt(vx * vx + vy * vy) || 1;
    vvec.setAttribute('d', 'M' + x.toFixed(1) + ' ' + y.toFixed(1)
      + ' L' + (x + 34 * vx / vn).toFixed(1) + ' ' + (y + 34 * vy / vn).toFixed(1));
    var fx = CX - x, fy = CY - y, fn = Math.sqrt(fx * fx + fy * fy) || 1;
    fvec.setAttribute('d', 'M' + x.toFixed(1) + ' ' + y.toFixed(1)
      + ' L' + (x + 26 * fx / fn).toFixed(1) + ' ' + (y + 26 * fy / fn).toFixed(1));
    /* след */
    trail.push([x, y]);
    if (trail.length > 220) trail.shift();
    var d = '';
    for (var i = 0; i < trail.length; i++) {
      d += (i ? ' L' : 'M') + trail[i][0].toFixed(1) + ' ' + trail[i][1].toFixed(1);
    }
    track.setAttribute('d', d || 'M0 0');
    /* вид сбоку: винтовая линия */
    var hd = '', n = 90;
    for (var k = 0; k <= n; k++) {
      var u = k / n;
      var hx = 430 + 190 * u;
      var hy = 170 - 26 * Math.cos(ph + 8 * u * (0.3 + p.vpar));
      hd += (k ? ' L' : 'M') + hx.toFixed(1) + ' ' + hy.toFixed(1);
    }
    helix.setAttribute('d', hd);
    readout(p);
  });
})();
