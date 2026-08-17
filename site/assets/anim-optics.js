/* Живая модель главы «Волновая оптика»: опыт Юнга.
   Волновые фронты от двух щелей + профиль интенсивности на экране. */
'use strict';
(function () {
  var panel = document.getElementById('opt-panel');
  if (!panel) return;
  var lIn = document.getElementById('opt-l');
  var dIn = document.getElementById('opt-d');
  var LIn = document.getElementById('opt-L');
  var out = document.getElementById('opt-out');
  var waves = document.getElementById('opt-waves');
  var s1 = document.getElementById('opt-s1');
  var s2 = document.getElementById('opt-s2');
  var screen = document.getElementById('opt-screen');
  var fringes = document.getElementById('opt-fringes');
  var profile = document.getElementById('opt-profile');
  if (!lIn || !dIn || !LIn || !out || !waves || !s1 || !s2 || !screen || !fringes || !profile) return;

  var SX = 70, CY = 150;            /* плоскость щелей */

  /* дуга радиуса r из точки (cx, cy), обрезанная прямоугольником
     [SX … xr] × [20 … 280]: точки вне рамки просто выбрасываются */
  function arc(cx, cy, r, xr, col) {
    var d = '', pen = false, n = 90;
    for (var i = 0; i <= n; i++) {
      var a = (-Math.PI / 2) + Math.PI * i / n;      /* правая полуокружность */
      var x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      if (x < cx - 1 || x > xr - 2 || y < 22 || y > 278) { pen = false; continue; }
      d += (pen ? ' L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      pen = true;
    }
    if (!d) return '';
    return '<path d="' + d + '" fill="none" stroke="' + col
      + '" stroke-width="0.8" opacity="0.55"/>';
  }

  function draw(t) {
    var nm = parseFloat(lIn.value);
    var d = parseFloat(dIn.value);         /* пиксели между щелями */
    var L = parseFloat(LIn.value);         /* «расстояние до экрана», условные */
    var col = colorOfWave(nm);
    var y1 = CY - d / 2, y2 = CY + d / 2;
    s1.setAttribute('cy', y1.toFixed(1));
    s2.setAttribute('cy', y2.toFixed(1));
    var xs = SX + 2.6 * L;                 /* положение экрана */
    if (xs > 500) xs = 500;
    screen.setAttribute('d', 'M' + xs.toFixed(1) + ' 20 V280');

    /* волновые фронты: дуги от каждой щели, обрезанные рамкой рисунка,
       чтобы ничего не выходило за viewBox */
    var lamPix = nm / 22;                  /* длина волны на экране модели */
    var ph = (t * 60 / lamPix) % 1;
    var s = '';
    for (var k = 0; k < 12; k++) {
      var r = lamPix * (k + ph);
      if (r < 4) continue;
      s += arc(SX, y1, r, xs, col) + arc(SX, y2, r, xs, col);
    }
    waves.innerHTML = s;

    /* профиль интенсивности I(x) = 4I0 cos²(π d x /(λ L)) */
    var dx = lamPix * (2.6 * L) / d;        /* ширина полосы в пикселях */
    var pd = '', fs = '', n = 120;
    for (var i = 0; i <= n; i++) {
      var y = 20 + (260) * i / n;
      var x = y - CY;
      var I = Math.pow(Math.cos(Math.PI * x / dx), 2);
      var px = 505 + 110 * I;
      pd += (i ? ' L' : 'M') + px.toFixed(1) + ' ' + y.toFixed(1);
    }
    profile.setAttribute('d', pd);
    /* полосы на экране */
    for (var m = -6; m <= 6; m++) {
      var yy = CY + m * dx;
      if (yy < 22 || yy > 278) continue;
      fs += '<rect x="' + (xs - 6).toFixed(1) + '" y="' + (yy - dx / 4).toFixed(1)
        + '" width="12" height="' + Math.max(2, dx / 2).toFixed(1)
        + '" fill="' + col + '" opacity="0.75"/>';
    }
    fringes.innerHTML = fs;

    out.textContent = 'λ = ' + nm.toFixed(0) + ' нм · d = ' + (d / 70).toFixed(2)
      + ' мм · L = ' + (L / 100).toFixed(2) + ' м · ширина полосы Δx = λL/d = '
      + (nm * 1e-9 * (L / 100) / (d / 70 * 1e-3) * 1e3).toFixed(2) + ' мм';
  }

  animLoop(panel, draw);
})();
