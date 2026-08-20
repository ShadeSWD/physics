/* phys.js — расчётное ядро разобранных задач сайта «Физика».
 *
 * Здесь собраны формулы, по которым посчитаны числа на страницах p-*.html.
 * Страница печатает результат и подстановку, а сама арифметика живёт тут:
 * иначе опечатка в разметке не ловится ничем — HTML останется валидным, а
 * ответ станет неверным. Тесты (tests/test_phys.py) пересчитывают ключевые
 * величины на Python независимо, по формулам, выписанным заново из
 * задачников, поэтому опечатка в этом файле не может «подтвердить сама
 * себя».
 *
 * Модуль чистый: не трогает DOM, не читает глобальные переменные.
 * В браузере доступен как window.PHYS, в node — как module.exports.
 * Обработка погрешностей — в отдельном модуле metro.js.
 *
 * Разделы соответствуют главам курса:
 *   1  кинематика                     7  свойства тел и жидкостей
 *   2  динамика точки                 8  электростатика
 *   3  законы сохранения              9  постоянный ток
 *   4  динамика твёрдого тела        10  магнетизм и индукция
 *   5  колебания и волны             11  оптика
 *   6  молекулярная физика и         12  квантовая и ядерная физика
 *      термодинамика
 *
 * Самопроверка: PHYS.selftest() возвращает массив расхождений (пустой —
 * все контрольные точки сошлись).
 */
'use strict';
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PHYS = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  /* ==================================================================
   *  ПОСТОЯННЫЕ (значения — со страницы constants.html)
   * ================================================================== */
  var C = {
    g: 9.81,               // м/с², стандартное ускорение свободного падения
    G: 6.674e-11,          // Н·м²/кг²
    R: 8.314,              // Дж/(моль·К), универсальная газовая постоянная
    NA: 6.022e23,          // 1/моль
    k: 1.380649e-23,       // Дж/К, постоянная Больцмана
    e: 1.602e-19,          // Кл, элементарный заряд
    me: 9.109e-31,         // кг, масса электрона
    mp: 1.673e-27,         // кг, масса протона
    mn: 1.675e-27,         // кг, масса нейтрона
    u: 1.6605e-27,         // кг, атомная единица массы
    h: 6.626e-34,          // Дж·с, постоянная Планка
    hbar: 1.0546e-34,      // Дж·с
    c: 2.998e8,            // м/с
    eps0: 8.854e-12,       // Ф/м
    kC: 8.988e9,           // Н·м²/Кл², коэффициент в законе Кулона 1/(4πε₀)
    mu0: 4e-7 * Math.PI,   // Гн/м
    sigma: 5.67e-8,        // Вт/(м²·К⁴), постоянная Стефана — Больцмана
    bWien: 2.898e-3,       // м·К, постоянная смещения Вина
    rhoSea: 1025,          // кг/м³, плотность морской воды
    rhoFresh: 1000,        // кг/м³, плотность пресной воды
    patm: 101325,          // Па
  };

  var sq = function (x) { return x * x; };
  var deg = function (a) { return a * Math.PI / 180; };
  var toDeg = function (a) { return a * 180 / Math.PI; };

  /* ==================================================================
   *  1. КИНЕМАТИКА
   * ================================================================== */

  /* Движение по окружности с постоянным тангенциальным ускорением из покоя.
     Возвращает скорость, нормальное и полное ускорения, угол между полным
     ускорением и скоростью, повёрнутый угол и момент, когда нормальное
     ускорение сравняется с тангенциальным. */
  function circular(R, at, t) {
    var v = at * t;
    var an = v * v / R;
    var a = Math.hypot(at, an);
    return {
      v: v, an: an, a: a,
      beta: toDeg(Math.atan2(an, at)),
      phi: at * t * t / (2 * R),
      tEq: Math.sqrt(R / at),
    };
  }

  /* Тело, брошенное под углом к горизонту (без сопротивления). */
  function projectile(v0, alphaDeg, g) {
    var gg = g || C.g;
    var a = deg(alphaDeg);
    var vx = v0 * Math.cos(a), vy = v0 * Math.sin(a);
    return {
      vx: vx, vy: vy,
      T: 2 * vy / gg,
      H: vy * vy / (2 * gg),
      L: v0 * v0 * Math.sin(2 * a) / gg,
      tTop: vy / gg,
      vTop: vx,
      Rcurv: v0 * v0 / (gg * Math.cos(a)),   // радиус кривизны в точке броска
    };
  }

  /* Равнопеременное движение: тормозной путь и время до остановки при
     заданном замедлении (выбег судна на «стоп машина» в грубой модели). */
  function brake(v0, a) {
    return { s: v0 * v0 / (2 * a), t: v0 / a };
  }

  /* Снос судна течением (обратная задача навигации): известно направление
     суммарной скорости — линия пути trackDeg, известны модуль собственной
     скорости v (относительно воды) и вектор течения u в сторону dirDeg.
     Все углы круговые: от севера по часовой стрелке, в градусах; v и u —
     в одинаковых единицах (узлы или м/с).
       theta   — угол между направлением течения и линией пути;
       uPerp   — составляющая течения поперёк пути (>0 — сносит вправо);
       uAlong  — составляющая вдоль пути (>0 — попутная);
       beta    — угол сноса, он же угол упреждения (в градусах);
       heading — истинный курс, который надо держать: ИК = ПУ − beta;
       V       — путевая скорость (относительно грунта);
       ok      — false, если |uPerp| > v: удержаться на линии пути нельзя.
     Контрольная точка: течение точно поперёк пути при u/v = 1/2 даёт снос
     ровно 30° и путевую скорость v·cos30° = v√3/2 (см. selftest ниже). */
  function drift(v, u, trackDeg, dirDeg) {
    var th = deg(dirDeg - trackDeg);
    var uPerp = u * Math.sin(th);
    var uAlong = u * Math.cos(th);
    var s = uPerp / v;
    var ok = Math.abs(s) <= 1;
    var b = ok ? Math.asin(s) : NaN;
    return {
      theta: dirDeg - trackDeg, uPerp: uPerp, uAlong: uAlong, ok: ok,
      beta: toDeg(b),
      heading: trackDeg - toDeg(b),
      V: ok ? v * Math.cos(b) + uAlong : NaN,
    };
  }

  /* Перегон из трёх участков: равноускоренный разгон с a1 до скорости v,
     равномерный ход, равнозамедленное торможение с a2 до остановки; полная
     длина перегона S. Возвращает пути и времена участков, полное время и
     среднюю путевую скорость. Если разгон и торможение не помещаются в S
     (s1 + s3 > S), ok = false — маршевая скорость недостижима.
     Контрольная точка: если равномерного участка нет (S = s1 + s3), средняя
     скорость равна ровно v/2 при любых a1 и a2. */
  function twoStage(v, a1, a2, S) {
    var s1 = v * v / (2 * a1), t1 = v / a1;
    var s3 = v * v / (2 * a2), t3 = v / a2;
    var s2 = S - s1 - s3;
    var t2 = s2 / v;
    var T = t1 + t2 + t3;
    return { s1: s1, t1: t1, s2: s2, t2: t2, s3: s3, t3: t3,
      T: T, vAvg: S / T, ok: s2 >= 0 };
  }

  /* ==================================================================
   *  2. ДИНАМИКА ТОЧКИ
   * ================================================================== */

  /* Два связанных тела: груз m1 висит, груз m2 лежит на столе с трением,
     нить через невесомый блок. Возвращает ускорение и натяжение. */
  function connected(m1, m2, mu, g) {
    var gg = g || C.g;
    var a = (m1 - mu * m2) * gg / (m1 + m2);
    return { a: a, T: m1 * (gg - a) };
  }

  /* Тело на наклонной плоскости: ускорение при скольжении вниз и условие
     самоторможения (угол трения). */
  function incline(alphaDeg, mu, g) {
    var gg = g || C.g;
    var a = deg(alphaDeg);
    return {
      a: gg * (Math.sin(a) - mu * Math.cos(a)),
      angleFriction: toDeg(Math.atan(mu)),
      N: Math.cos(a),                   // в долях mg
    };
  }

  /* Разгон судна при квадратичном сопротивлении: установившаяся скорость и
     время выхода на долю q от неё. Модель m dv/dt = P/v − k v² здесь
     упрощена до m dv/dt = F − k v² с постоянной тягой F. */
  function shipAccel(m, F, k, q) {
    var vInf = Math.sqrt(F / k);
    var tau = m * vInf / (2 * F);            // постоянная времени разгона
    var qq = q || 0.9;
    return { vInf: vInf, tau: tau, t: tau * Math.log((1 + qq) / (1 - qq)) };
  }

  /* Путь, пройденный за время разгона при квадратичном сопротивлении
     (дополнение к shipAccel). Из m dv/dt = F − k v² следует
     v = v∞·th(t/2τ), значит s = ∫v dt = 2τ v∞ · ln ch(t/2τ).
     q — доля установившейся скорости (по умолчанию 0,9).
     Контрольная точка: путь всегда меньше v∞·t (скорость меньше предельной)
     и больше v∞·t/2 при q = 0,9. */
  function shipAccelPath(m, F, k, q) {
    var vInf = Math.sqrt(F / k);
    var tau = m * vInf / (2 * F);
    var qq = q == null ? 0.9 : q;
    var x = 0.5 * Math.log((1 + qq) / (1 - qq));   // artanh(q)
    return { vInf: vInf, tau: tau, t: 2 * tau * x,
      s: 2 * tau * vInf * Math.log(Math.cosh(x)) };
  }

  /* ==================================================================
   *  3. ЗАКОНЫ СОХРАНЕНИЯ
   * ================================================================== */

  /* Абсолютно упругий центральный удар двух шаров (движение по одной
     прямой, проекции со знаком). Из сохранения импульса и энергии:
     u1 = ((m1−m2)v1 + 2m2v2)/(m1+m2), u2 = ((m2−m1)v2 + 2m1v1)/(m1+m2).
     transfer — доля энергии, переданная покоящейся мишени, 4m1m2/(m1+m2)²
     (имеет смысл только при v2 = 0); зависит лишь от отношения масс и
     симметрична относительно его обращения.
     Контрольные точки: при равных массах шары обмениваются скоростями и
     transfer = 1; импульс и энергия сохраняются при любых массах. */
  function elastic(m1, v1, m2, v2) {
    var vv2 = v2 || 0;
    var M = m1 + m2;
    var u1 = ((m1 - m2) * v1 + 2 * m2 * vv2) / M;
    var u2 = ((m2 - m1) * vv2 + 2 * m1 * v1) / M;
    return { u1: u1, u2: u2,
      transfer: 4 * m1 * m2 / (M * M),
      E0: m1 * v1 * v1 / 2 + m2 * vv2 * vv2 / 2,
      dvRel: (u2 - u1) - (v1 - vv2) };     // должен быть нулём (контроль)
  }

  /* Абсолютно неупругий удар: скорость после удара и потерянная энергия. */
  function inelastic(m1, v1, m2, v2) {
    var u = (m1 * v1 + m2 * v2) / (m1 + m2);
    var e0 = m1 * v1 * v1 / 2 + m2 * v2 * v2 / 2;
    var e1 = (m1 + m2) * u * u / 2;
    return { u: u, E0: e0, E1: e1, dE: e0 - e1, frac: e0 ? (e0 - e1) / e0 : 0 };
  }

  /* Баллистический маятник: пуля m застревает в грузе M, система
     поднимается на высоту h. Восстанавливаем скорость пули. */
  function ballistic(m, M, h, g) {
    var gg = g || C.g;
    var u = Math.sqrt(2 * gg * h);
    var v = (m + M) / m * u;
    return { u: u, v: v, dE: m * v * v / 2 - (m + M) * u * u / 2 };
  }

  /* Работа и энергия на наклонной плоскости с трением: тело пущено вверх
     со скоростью v0, находим путь до остановки и скорость возврата. */
  function slideUp(v0, alphaDeg, mu, g) {
    var gg = g || C.g;
    var a = deg(alphaDeg);
    var up = gg * (Math.sin(a) + mu * Math.cos(a));
    var s = v0 * v0 / (2 * up);
    var down = gg * (Math.sin(a) - mu * Math.cos(a));
    var back = down > 0 ? Math.sqrt(2 * down * s) : 0;
    return { aUp: up, s: s, aDown: down, vBack: back,
      Afr: mu * Math.cos(a) * gg * s };        // на единицу массы, Дж/кг
  }

  /* Реактивная тяга водомёта: забор Q м³/с забортной воды, ускорение потока
     от скорости хода v до скорости струи vj. */
  function waterJet(Q, v, vj, rho) {
    var r = rho || C.rhoSea;
    var mdot = r * Q;
    var thrust = mdot * (vj - v);
    var Pjet = mdot * (vj * vj - v * v) / 2;   // прирост кинетической энергии
    return { mdot: mdot, thrust: thrust, Puse: thrust * v, Pjet: Pjet,
      eta: Pjet > 0 ? thrust * v / Pjet : 0 };
  }

  /* Пружинный отбойник причала: судно массой m наваливается со скоростью v
     на линейный амортизатор жёсткости kSpring. Вся кинетическая энергия
     переходит в потенциальную энергию пружины: mv²/2 = kx²/2.
     Сжатие x = v√(m/k), максимальная сила F = kx = v√(km), торможение
     длится четверть периода T/4 = (π/2)√(m/k) и от скорости не зависит.
     Контрольная точка: средняя сила ⟨F⟩ = p/t = (2/π)·F — прямое следствие
     того, что за четверть периода косинус даёт множитель 2/π. */
  function bumper(m, v, kSpring) {
    var x = v * Math.sqrt(m / kSpring);
    var F = kSpring * x;
    var t = Math.PI / 2 * Math.sqrt(m / kSpring);
    return { E: m * v * v / 2, x: x, F: F, a: F / m, t: t,
      p: m * v, Fmean: m * v / t };
  }

  /* ==================================================================
   *  4. ДИНАМИКА ТВЁРДОГО ТЕЛА
   * ================================================================== */

  /* Моменты инерции однородных тел относительно оси симметрии, кг·м². */
  var inertia = {
    disk: function (m, R) { return m * R * R / 2; },
    ring: function (m, R) { return m * R * R; },
    sphere: function (m, R) { return 2 * m * R * R / 5; },
    shell: function (m, R) { return 2 * m * R * R / 3; },
    rodCenter: function (m, L) { return m * L * L / 12; },
    rodEnd: function (m, L) { return m * L * L / 3; },
    /* теорема Штейнера */
    steiner: function (I0, m, d) { return I0 + m * d * d; },
  };

  /* Груз m на нити, намотанной на блок (диск) массы M радиуса R. */
  function pulleyLoad(m, M, R, g) {
    var gg = g || C.g;
    var I = inertia.disk(M, R);
    var a = m * gg / (m + I / (R * R));
    return { I: I, a: a, T: m * (gg - a), eps: a / R };
  }

  /* Скамья Жуковского: сохранение момента импульса при изменении момента
     инерции. Возвращает новую угловую скорость и работу человека. */
  function zhukovsky(I1, n1, I2) {
    var w1 = 2 * Math.PI * n1;
    var w2 = I1 * w1 / I2;
    var E1 = I1 * w1 * w1 / 2, E2 = I2 * w2 * w2 / 2;
    return { w1: w1, w2: w2, n2: w2 / (2 * Math.PI), E1: E1, E2: E2, A: E2 - E1 };
  }

  /* Скатывание тела с наклонной плоскости без проскальзывания.
     kappa — безразмерный множитель в I = κ m R² (диск 1/2, шар 2/5,
     обруч 1, труба ≈1). */
  function rolling(kappa, hOrL, alphaDeg, isHeight, g) {
    var gg = g || C.g;
    var a = deg(alphaDeg);
    var h = isHeight ? hOrL : hOrL * Math.sin(a);
    var v = Math.sqrt(2 * gg * h / (1 + kappa));
    var acc = gg * Math.sin(a) / (1 + kappa);
    var L = h / Math.sin(a);
    return { v: v, a: acc, t: Math.sqrt(2 * L / acc), h: h,
      fracRot: kappa / (1 + kappa) };
  }

  /* Гироскопический момент вращающегося вала при рыскании судна:
     M = I ω Ω (векторы взаимно перпендикулярны). */
  function gyroMoment(I, nRpm, OmegaRadS) {
    var w = 2 * Math.PI * nRpm / 60;
    return { omega: w, M: I * w * OmegaRadS, L: I * w };
  }

  /* Раскрутка вала (маховика, валопровода) постоянным избыточным моментом M
     из состояния покоя до угловой скорости omega. Возвращает угловое
     ускорение, время разгона, повёрнутый угол (в радианах и оборотах) и
     запасённую кинетическую энергию вращения.
     Модель: M = I·eps = const, то есть момент сопротивления уже вычтен из M. */
  function spinUp(I, M, omega) {
    var eps = M / I;
    var t = omega / eps;
    var phi = omega * omega / (2 * eps);
    return {
      eps: eps, t: t, phi: phi,
      rev: phi / (2 * Math.PI),
      Ek: I * omega * omega / 2,
      /* момент, нужный чтобы за время tRev перевести вращение из +omega в
         −omega (экстренный реверс): изменение момента импульса 2·I·omega */
      Mreverse: function (tRev) { return 2 * I * omega / tRev; },
    };
  }

  /* Гироскопическая нагрузка на подшипники: пара сил, которой опоры на
     расстоянии span уравновешивают гироскопический момент M = I·omega·Omega.
     Возвращает сам момент и силу в каждой опоре (в одной вверх, в другой вниз),
     а также её отношение к статической нагрузке от веса ротора. */
  function gyroBearingForce(I, omega, Omega, span, mRotor, g) {
    var M = I * omega * Omega;
    var F = M / span;
    var Fstat = mRotor * (g || C.g) / 2;
    return { M: M, F: F, Fstat: Fstat, ratio: F / Fstat };
  }

  /* ==================================================================
   *  5. КОЛЕБАНИЯ И ВОЛНЫ
   * ================================================================== */

  function springPeriod(m, kSpring) { return 2 * Math.PI * Math.sqrt(m / kSpring); }
  function mathPendulum(L, g) { return 2 * Math.PI * Math.sqrt(L / (g || C.g)); }

  /* Физический маятник: I — момент инерции относительно оси подвеса,
     d — расстояние от оси до центра масс. Приведённая длина Lпр = I/(md). */
  function physPendulum(I, m, d, g) {
    var gg = g || C.g;
    return { T: 2 * Math.PI * Math.sqrt(I / (m * gg * d)), Lred: I / (m * d) };
  }

  /* Затухающие колебания: β — коэффициент затухания, ω₀ — собственная
     частота. Логарифмический декремент λ = βT, добротность Q = π/λ. */
  function damped(w0, beta) {
    var w = Math.sqrt(w0 * w0 - beta * beta);
    var T = 2 * Math.PI / w;
    var lam = beta * T;
    return { w: w, T: T, lambda: lam, Q: Math.PI / lam, tau: 1 / beta,
      nHalf: Math.log(2) / lam };            // число колебаний до убывания вдвое
  }

  /* Вынужденные колебания: амплитуда установившихся колебаний и резонансная
     частота. f0 = F0/m — приведённая амплитуда вынуждающей силы. */
  function forced(f0, w0, beta, w) {
    var den = Math.sqrt(sq(w0 * w0 - w * w) + 4 * beta * beta * w * w);
    return {
      A: f0 / den,
      wRes: Math.sqrt(Math.max(0, w0 * w0 - 2 * beta * beta)),
      Ares: f0 / (2 * beta * Math.sqrt(Math.max(1e-30, w0 * w0 - beta * beta))),
      A0: f0 / (w0 * w0),                    // статическое отклонение
    };
  }

  /* Бортовая качка судна как физический маятник: период качки через
     метацентрическую высоту h и радиус инерции масс относительно продольной
     оси (обычно ix ≈ 0,35…0,40 B). Формула T = 2π ix/√(g h) — стандартная
     формула Дуайра, ix = c·B. */
  function rollPeriod(B, h, cCoef, g) {
    var c = cCoef || 0.38;
    var ix = c * B;
    return { ix: ix, T: 2 * Math.PI * ix / Math.sqrt((g || C.g) * h) };
  }

  /* Волна: связь длины волны, скорости и частоты; разность фаз двух точек. */
  function wave(v, nu, dx) {
    var lam = v / nu;
    return { lambda: lam, k: 2 * Math.PI / lam, T: 1 / nu,
      dphi: dx != null ? 2 * Math.PI * dx / lam : null };
  }

  /* Эффект Доплера в среде (гидроакустика): источник и приёмник движутся
     вдоль линии наблюдения, скорость звука c. Знаки: vObs > 0 — приёмник
     приближается, vSrc > 0 — источник приближается. */
  function doppler(nu0, cSound, vObs, vSrc) {
    return nu0 * (cSound + vObs) / (cSound - vSrc);
  }

  /* Гравитационная волна на глубокой воде (глубина много больше длины волны):
     дисперсионное соотношение omega² = g·k даёт lambda = g·tau²/(2π) и
     фазовую скорость c = g·tau/(2π) = lambda/tau. Групповая скорость вдвое
     меньше фазовой — группа волн отстаёт от отдельных гребней. */
  function waveDeep(tau, g) {
    var gg = g || C.g;
    var lam = gg * tau * tau / (2 * Math.PI);
    return { lambda: lam, c: lam / tau, cGroup: lam / (2 * tau), k: 2 * Math.PI / lam };
  }

  /* Кажущийся период встречи с волной для судна, идущего со скоростью v под
     углом mu между вектором скорости судна и направлением БЕГА волны
     (mu = 0 — попутное волнение, догоняющее судно; mu = 180° — встречное;
     mu = 90° — траверзное). Из omega_встр = omega − k·v·cos mu следует
     tau_встр = tau / (1 − (v/c)·cos mu). Отрицательный знаменатель означает,
     что судно обгоняет волну, — период берём по модулю. */
  function encounterPeriod(tau, v, muDeg, g) {
    var c = waveDeep(tau, g).c;
    var denom = 1 - (v / c) * Math.cos(muDeg * Math.PI / 180);
    return { c: c, denom: denom,
      tauE: denom === 0 ? Infinity : Math.abs(tau / denom) };
  }

  /* Обратная задача: при каком курсовом угле судно попадает в резонанс
     бортовой качки, то есть кажущийся период равен собственному Troll.
     cos mu = (1 − tau/Troll)·c/v. Если |cos mu| > 1, резонанс на этой волне
     при данной скорости недостижим — возвращается mu = null. */
  function rollResonanceCourse(tau, Troll, v, g) {
    var c = waveDeep(tau, g).c;
    var cosMu = (1 - tau / Troll) * c / v;
    return {
      cosMu: cosMu,
      muDeg: Math.abs(cosMu) <= 1 ? Math.acos(cosMu) * 180 / Math.PI : null,
      /* курсовой угол волны отсчитывают от направления НА волну: q = 180° − mu */
      qDeg: Math.abs(cosMu) <= 1 ? 180 - Math.acos(cosMu) * 180 / Math.PI : null,
    };
  }

  /* Скорость звука в идеальном газе: v = sqrt(gamma·R·T/M).
     Для воздуха (gamma = 1,4, M = 0,029 кг/моль) при 20 °C даёт 343 м/с. */
  function soundSpeedGas(T, M, gamma) {
    return Math.sqrt((gamma || 1.4) * C.R * T / (M || 0.029));
  }

  /* Собственные частоты столба воздуха длиной l и резонансные длины столба
     для заданной частоты. Труба, открытая с обоих концов: nu_n = n·v/(2l);
     труба, закрытая с одного конца: nu_n = (2n−1)·v/(4l) — только нечётные
     гармоники. Соседние резонансные длины отличаются на lambda/2 — на этом
     построено измерение скорости звука методом стоячих волн. */
  function pipeMode(l, v, n, closedOneEnd) {
    return closedOneEnd ? (2 * n - 1) * v / (4 * l) : n * v / (2 * l);
  }

  function pipeLength(nu, v, n, closedOneEnd) {
    var lam = v / nu;
    return closedOneEnd ? (2 * n - 1) * lam / 4 : n * lam / 2;
  }

  /* Двойной эффект Доплера: эхолокация неподвижным излучателем цели, которая
     движется вдоль линии визирования со скоростью u (u > 0 — сближение).
     Цель сначала принимает как движущийся приёмник, затем переизлучает как
     движущийся источник, поэтому сдвиг удваивается:
     nu_эхо = nu0·(c + u)/(c − u) ≈ nu0·(1 + 2u/c). */
  function dopplerEcho(nu0, c, u) {
    var nu = nu0 * (c + u) / (c - u);
    return { nu: nu, dnu: nu - nu0, dnuApprox: 2 * nu0 * u / c };
  }

  /* Обратная задача: радиальная скорость цели по измеренному сдвигу.
     u = c·(nu − nu0)/(nu + nu0). */
  function dopplerSpeed(nu0, nu, c) { return c * (nu - nu0) / (nu + nu0); }

  /* ==================================================================
   *  6. МОЛЕКУЛЯРНАЯ ФИЗИКА И ТЕРМОДИНАМИКА
   * ================================================================== */

  /* Уравнение Менделеева — Клапейрона: масса газа и его плотность. */
  function idealGas(p, V, T, M) {
    var nu = p * V / (C.R * T);
    return { nu: nu, m: nu * M, rho: p * M / (C.R * T), N: nu * C.NA };
  }

  /* Основное уравнение МКТ и характерные скорости распределения Максвелла. */
  function mkt(T, M) {
    return {
      eKin: 1.5 * C.k * T,                       // средняя энергия поступательного движения
      vProb: Math.sqrt(2 * C.R * T / M),
      vMean: Math.sqrt(8 * C.R * T / (Math.PI * M)),
      vRms: Math.sqrt(3 * C.R * T / M),
    };
  }

  /* Явления переноса: длина свободного пробега, число столкновений,
     коэффициенты диффузии и вязкости. d — эффективный диаметр молекулы. */
  function transport(p, T, M, d) {
    var n = p / (C.k * T);
    var vMean = Math.sqrt(8 * C.R * T / (Math.PI * M));
    var lam = 1 / (Math.SQRT2 * Math.PI * d * d * n);
    var rho = p * M / (C.R * T);
    return { n: n, vMean: vMean, lambda: lam, nu: vMean / lam,
      D: vMean * lam / 3, eta: rho * vMean * lam / 3 };
  }

  /* Молярные теплоёмкости идеального газа по числу степеней свободы i. */
  function heatCap(i) {
    return { Cv: i / 2 * C.R, Cp: (i + 2) / 2 * C.R, gamma: (i + 2) / i };
  }

  /* Изопроцессы: работа и теплота для ν молей, i степеней свободы. */
  var proc = {
    isotherm: function (nu, T, V1, V2) {
      var A = nu * C.R * T * Math.log(V2 / V1);
      return { A: A, Q: A, dU: 0 };
    },
    isobar: function (nu, i, T1, T2) {
      var A = nu * C.R * (T2 - T1);
      var dU = nu * i / 2 * C.R * (T2 - T1);
      return { A: A, dU: dU, Q: A + dU };
    },
    isochor: function (nu, i, T1, T2) {
      var dU = nu * i / 2 * C.R * (T2 - T1);
      return { A: 0, dU: dU, Q: dU };
    },
    /* Адиабата: по заданной степени сжатия находим конечные T и p и работу. */
    adiabat: function (nu, i, T1, p1, ratioV) {
      var g = (i + 2) / i;
      var T2 = T1 * Math.pow(ratioV, g - 1);
      var p2 = p1 * Math.pow(ratioV, g);
      var dU = nu * i / 2 * C.R * (T2 - T1);
      return { gamma: g, T2: T2, p2: p2, dU: dU, A: -dU, Q: 0 };
    },
  };

  /* Цикл Карно: КПД, теплоты и работа. */
  function carnot(T1, T2, Q1) {
    var eta = 1 - T2 / T1;
    return { eta: eta, Q1: Q1, A: eta * Q1, Q2: Q1 * (1 - eta) };
  }

  /* Изменение энтропии при нагреве и фазовом переходе. */
  function entropy(m, c, T1, T2, lambdaMelt, Tmelt) {
    var dS = 0, parts = {};
    if (lambdaMelt && Tmelt) { parts.melt = m * lambdaMelt / Tmelt; dS += parts.melt; }
    if (c && T1 && T2) { parts.heat = m * c * Math.log(T2 / T1); dS += parts.heat; }
    return { dS: dS, parts: parts };
  }

  /* Теплопередача через многослойную стенку (борт с изоляцией):
     layers — [{delta, lambda}]; alphaIn, alphaOut — коэффициенты
     теплоотдачи. Возвращает термическое сопротивление, коэффициент
     теплопередачи, плотность потока и температуры на границах слоёв. */
  function wall(layers, alphaIn, alphaOut, tIn, tOut) {
    var Rw = 1 / alphaIn + 1 / alphaOut, i;
    for (i = 0; i < layers.length; i++) Rw += layers[i].delta / layers[i].lambda;
    var K = 1 / Rw;
    var q = K * (tIn - tOut);
    var temps = [tIn - q / alphaIn];
    for (i = 0; i < layers.length; i++) {
      temps.push(temps[temps.length - 1] - q * layers[i].delta / layers[i].lambda);
    }
    return { R: Rw, K: K, q: q, temps: temps, tSurfOut: temps[temps.length - 1] };
  }

  /* Барометрическая формула для изотермической атмосферы и распределение
     Больцмана в поле тяжести. H = RT/(Mg) — характеристическая высота, на
     которой давление падает в e раз; p(h) = p0·exp(−h/H) = p0·exp(−Mgh/RT).
     Возвращает также плотность (у поверхности и на высоте), высоту
     половинного давления, чувствительность барометрического высотомера
     |dp/dh| у поверхности и относительную концентрацию n/n0 на высоте h. */
  function barometric(p0, T, M, h, g) {
    var gg = g || C.g;
    var H = C.R * T / (M * gg);
    var k = Math.exp(-h / H);
    return {
      H: H,                        // м, характеристическая высота
      p: p0 * k,                   // Па, давление на высоте h
      rho0: p0 * M / (C.R * T),    // кг/м³ у поверхности
      rho: p0 * k * M / (C.R * T), // кг/м³ на высоте h
      nRatio: k,                   // n/n0 — множитель Больцмана exp(−m0gh/kT)
      halfHeight: H * Math.LN2,    // м, высота, где давление вдвое меньше
      gradient: p0 / H,            // Па/м, |dp/dh| у поверхности
    };
  }

  /* Водолазный колокол (или отсек-«воздушная подушка»): цилиндр высотой L и
     площадью S, открытый снизу, опускают крышкой на глубину depthTop.
     Воздух сжимается изотермически, вода поднимается внутри. Давление
     запертого воздуха равно гидростатическому на уровне воды ВНУТРИ
     колокола, поэтому высота воздушного столба l — корень квадратного
     уравнения ρg·l² + (patm + ρg·depthTop)·l − patm·L = 0.
     partials — парциальные давления по закону Дальтона: доли задаются
     объектом mix вида {O2: 0.21, N2: 0.78, Ar: 0.01}. */
  function divingBell(L, S, depthTop, T, mix, rho, g) {
    var r = rho || C.rhoSea, gg = g || C.g, rg = r * gg;
    var b = C.patm + rg * depthTop;
    var l = (-b + Math.sqrt(b * b + 4 * rg * C.patm * L)) / (2 * rg);
    var p = C.patm + rg * (depthTop + l);
    var nu = p * l * S / (C.R * T);
    var pFull = C.patm + rg * (depthTop + L);   // давление у нижней кромки
    var partials = {}, key;
    for (key in (mix || {})) partials[key] = mix[key] * p;
    return {
      l: l,                       // м, высота оставшегося воздушного столба
      rise: L - l,                // м, на сколько поднялась вода
      p: p,                       // Па, давление воздуха в колоколе
      ratio: p / C.patm,          // во сколько раз сжат воздух
      nu: nu,                     // моль воздуха в колоколе
      partials: partials,         // Па, парциальные давления компонент
      nuBlow: pFull * L * S / (C.R * T) - nu,  // моль, добавить для продувки
    };
  }

  /* Точка росы влажного воздуха: температура, при которой парциальное
     давление пара φ·pSat(t) станет насыщающим. Обращение аппроксимации
     Антуана из pSat() (та же пара коэффициентов, поэтому dewPoint(t, 1) === t).
     Нужна для проверки ограждающей конструкции на выпадение конденсата:
     конденсата нет, пока температура внутренней поверхности выше точки росы. */
  function dewPoint(tC, phi) {
    var pv = phi * pSat(tC);
    return 1730.63 / (8.07131 - Math.log10(pv / 133.322)) - 233.426;
  }

  /* Теплообмен двух тел в теплоизолированной системе: конечная температура,
     переданная теплота и приращение энтропии (второе начало — сумма должна
     быть положительной). Дополнительно — предельный обратимый вариант: если
     между телами поставить идеальную тепловую машину, она уравняет их при
     температуре √(T1·T2) (условие ΔS = 0) и отдаст работу Amax. Разность
     между Tmix и Trev — цена необратимости. */
  function heatExchange(m1, c1, T1, m2, c2, T2) {
    var C1 = m1 * c1, C2 = m2 * c2;
    var Tmix = (C1 * T1 + C2 * T2) / (C1 + C2);
    var dS1 = C1 * Math.log(Tmix / T1), dS2 = C2 * Math.log(Tmix / T2);
    /* условие ΔS = 0 даёт средневзвешенное геометрическое; считаем через
       логарифмы, иначе T^C переполняет double уже при C ~ 10³ */
    var Trev = Math.exp((C1 * Math.log(T1) + C2 * Math.log(T2)) / (C1 + C2));
    return {
      Tmix: Tmix, Q: C1 * (T1 - Tmix),
      dS1: dS1, dS2: dS2, dS: dS1 + dS2,
      Trev: Trev,                                  // при C1 = C2 это √(T1T2)
      Amax: C1 * (T1 - Trev) - C2 * (Trev - T2),   // работа обратимой машины
    };
  }

  /* Тепловой баланс отапливаемого помещения и расход топлива за рейс:
     потери через ограждения (плотность потока q из wall(), площадь S) плюс
     нагрев приточного воздуха (объёмный расход Lvent, м³/с, при наружной
     температуре tOut). Топливо — по низшей теплоте сгорания qFuel и КПД
     котла etaBoiler; recup — доля тепла, возвращаемая рекуператором. */
  function heatingFuel(q, S, Lvent, tIn, tOut, tau, etaBoiler, qFuel, recup) {
    var Qwall = q * S;
    var rhoAir = C.patm * 0.029 / (C.R * (273 + tOut));
    var Qvent = rhoAir * 1005 * Lvent * (tIn - tOut) * (1 - (recup || 0));
    var Q = Qwall + Qvent, W = Q * tau;
    return { Qwall: Qwall, Qvent: Qvent, Q: Q, W: W,
      mFuel: W / (etaBoiler * qFuel) };
  }

  /* ==================================================================
   *  7. СВОЙСТВА ТВЁРДЫХ ТЕЛ И ЖИДКОСТЕЙ
   * ================================================================== */

  /* Закон Гука при растяжении: напряжение, удлинение, запасённая энергия. */
  function hooke(F, A, L, E) {
    var sigma = F / A;
    var dL = sigma * L / E;
    return { sigma: sigma, eps: sigma / E, dL: dL, W: F * dL / 2,
      kStiff: E * A / L };
  }

  /* Тепловое расширение: удлинение и термическое напряжение при жёстком
     закреплении (зазор в палубном настиле, температурные компенсаторы). */
  function expansion(L, alpha, dT, E) {
    return { dL: alpha * L * dT, sigmaBlocked: E ? E * alpha * dT : null };
  }

  /* Поверхностное натяжение: высота подъёма в капилляре и избыточное
     давление под сферической поверхностью (формула Лапласа). */
  function capillary(sigma, r, rho, thetaDeg, g) {
    var th = thetaDeg == null ? 0 : deg(thetaDeg);
    return {
      h: 2 * sigma * Math.cos(th) / ((rho || C.rhoFresh) * (g || C.g) * r),
      dpSphere: 2 * sigma / r,
      dpBubble: 4 * sigma / r,               // мыльный пузырь: две поверхности
    };
  }

  /* Гидростатика и плавучесть: давление на глубине, водоизмещение,
     осадка прямобортного понтона, запас плавучести. */
  function hydrostatics(depth, rho, g) {
    var r = rho || C.rhoSea;
    return { pGauge: r * (g || C.g) * depth,
      pAbs: C.patm + r * (g || C.g) * depth };
  }
  function buoyancy(L, B, T, rho, delta) {
    var r = rho || C.rhoSea;
    var cb = delta == null ? 1 : delta;
    var V = L * B * T * cb;
    return { V: V, D: r * V, Dweight: r * V * C.g };
  }
  function draftChange(dMass, L, B, rho, alphaWl) {
    var r = rho || C.rhoSea;
    var Aw = L * B * (alphaWl == null ? 1 : alphaWl);
    return { Aw: Aw, dT: dMass / (r * Aw), TPC: r * Aw * 0.01 };
  }

  /* Кавитация: число кавитации и запас до вскипания. Давление насыщенного
     пара воды по аппроксимации Антуана (Па, t в °C) — вторичный источник,
     точность около 1 % в диапазоне 0…100 °C. */
  function pSat(tC) {
    return 133.322 * Math.pow(10, 8.07131 - 1730.63 / (233.426 + tC));
  }
  function cavitation(depth, v, tC, rho) {
    var r = rho || C.rhoSea;
    var p = C.patm + r * C.g * depth;
    var pv = pSat(tC);
    return { p: p, pv: pv, sigma: (p - pv) / (r * v * v / 2),
      vCrit: Math.sqrt(2 * (p - pv) / r) };
  }

  /* Вязкость: закон Стокса — установившаяся скорость шарика в жидкости. */
  function stokes(r, rhoBall, rhoLiq, eta, g) {
    var gg = g || C.g;
    return { v: 2 * r * r * (rhoBall - rhoLiq) * gg / (9 * eta),
      Fres: function (v) { return 6 * Math.PI * eta * r * v; } };
  }

  /* Изгиб балки на двух опорах, груз посередине пролёта (схема лабораторной
     работы 1-1 «Определение модуля Юнга по стреле прогиба»).
     Прямоугольное сечение b×h: момент инерции сечения I = b·h³/12,
     стрела прогиба f = F·L³/(48·E·I), наибольшее нормальное напряжение
     в среднем сечении σ = M·h/(2I) при M = F·L/4, то есть σ = F·L·h/(8I).
     E не задан → возвращается только I (для обратной задачи).
     F — Н, L, b, h — м, E — Па. */
  function beamCenterLoad(F, L, b, h, E) {
    var I = b * h * h * h / 12;
    return {
      I: I,
      f: E ? F * L * L * L / (48 * E * I) : null,
      sigmaMax: F * L * h / (8 * I),
      kStiff: E ? 48 * E * I / (L * L * L) : null,
    };
  }

  /* Обратная задача той же лабораторной: модуль Юнга по измеренной
     стреле прогиба f. E = F·L³/(48·I·f), I = b·h³/12.
     Видно, что толщина h входит в третьей степени, поэтому её погрешность
     утраивается — это главный источник ошибки в работе 1-1. */
  function youngFromDeflection(F, L, b, h, f) {
    var I = b * h * h * h / 12;
    return { I: I, E: F * L * L * L / (48 * I * f) };
  }

  /* Ареометр: глубина погружения и цена деления шкалы.
     Плавающий ареометр массой m вытесняет объём V = m/ρ; при переходе из
     жидкости плотности rho1 в жидкость rho2 разность объёмов набирается
     тонким штоком сечением A = πd²/4, поэтому шток «выходит» на
     Δl = m·(1/rho1 − 1/rho2)/A. Чувствительность dl/dρ = m/(A·ρ²):
     чем тоньше шток, тем крупнее деления шкалы.
     m — кг, d — м, rho1, rho2 — кг/м³. */
  function hydrometer(m, d, rho1, rho2) {
    var A = Math.PI * d * d / 4;
    return {
      A: A,
      V1: m / rho1,
      V2: m / rho2,
      dl: m * (1 / rho1 - 1 / rho2) / A,
      sens: m / (A * rho1 * rho1),        // м на 1 кг/м³
    };
  }

  /* ==================================================================
   *  8. ЭЛЕКТРОСТАТИКА
   * ================================================================== */

  /* Поле и потенциал точечного заряда. */
  function pointCharge(q, r, eps) {
    var e = eps || 1;
    return { E: C.kC * Math.abs(q) / (e * r * r), phi: C.kC * q / (e * r) };
  }

  /* Суперпозиция полей двух зарядов в точке, заданной расстояниями r1, r2
     и углом между направлениями на заряды. */
  function twoCharges(q1, r1, q2, r2, angleDeg, eps) {
    var e = eps || 1;
    var E1 = C.kC * Math.abs(q1) / (e * r1 * r1);
    var E2 = C.kC * Math.abs(q2) / (e * r2 * r2);
    var a = deg(angleDeg);
    var E = Math.sqrt(E1 * E1 + E2 * E2 + 2 * E1 * E2 * Math.cos(a));
    return { E1: E1, E2: E2, E: E,
      phi: C.kC * (q1 / r1 + q2 / r2) / e };
  }

  /* Заряженный шар радиуса R: поле и потенциал внутри и снаружи. */
  function chargedSphere(q, R, r, eps) {
    var e = eps || 1;
    return {
      E: r >= R ? C.kC * q / (e * r * r) : 0,
      phi: r >= R ? C.kC * q / (e * r) : C.kC * q / (e * R),
      sigma: q / (4 * Math.PI * R * R),
    };
  }

  /* Плоский конденсатор с диэлектриком. */
  function capacitor(S, d, epsR, U) {
    var Cf = C.eps0 * (epsR || 1) * S / d;
    return { C: Cf, q: Cf * U, E: U / d, W: Cf * U * U / 2,
      w: C.eps0 * (epsR || 1) * sq(U / d) / 2 };
  }

  /* Батарея конденсаторов: список ёмкостей caps (Ф) под напряжением U (В).
     Возвращает ёмкость, заряд и энергию для параллельного и последовательного
     соединения, а для последовательного — ещё и распределение напряжений и
     энергий по конденсаторам (заряд у всех одинаков, напряжение делится
     обратно пропорционально ёмкости). */
  function capBattery(caps, U) {
    var i, Cpar = 0, inv = 0;
    for (i = 0; i < caps.length; i++) { Cpar += caps[i]; inv += 1 / caps[i]; }
    var Cser = 1 / inv;
    var qSer = Cser * U;                      // общий заряд последовательной цепи
    var Uk = [], Wk = [];
    for (i = 0; i < caps.length; i++) {
      Uk.push(qSer / caps[i]);
      Wk.push(qSer * qSer / (2 * caps[i]));
    }
    return {
      Cpar: Cpar, qPar: Cpar * U, Wpar: Cpar * U * U / 2,
      Cser: Cser, qSer: qSer, Wser: Cser * U * U / 2,
      Uk: Uk, Wk: Wk,
      ratio: Cpar / Cser,                     // во сколько раз параллельное «ёмче»
    };
  }

  /* Перезарядка: конденсатор C1, заряженный до U0, подключают параллельно
     незаряженному C2. Заряд сохраняется, энергия — нет: часть неизбежно
     уходит в тепло проводов и излучение, причём доля потерь не зависит от
     сопротивления цепи. */
  function capRecharge(C1, U0, C2) {
    var q = C1 * U0;
    var U = q / (C1 + C2);
    var W0 = C1 * U0 * U0 / 2;
    var W = (C1 + C2) * U * U / 2;
    return { U: U, q: q, W0: W0, W: W, loss: W0 - W, lossFrac: (W0 - W) / W0 };
  }

  /* Электризация при наливе диэлектрической жидкости (нефтепродукта) в танк.
     Схема расчёта:
       I  = kI · v · d²      — эмпирическая оценка тока заряжания струи
                               (kI ≈ 3,75·10⁻⁶ А·с/м³ для нефтепродуктов);
       τ  = ε₀ε/γ            — время релаксации заряда в жидкости;
       Q  = I·τ              — установившийся заряд (накопление = стекание);
       σ  = Q/S, E = σ/ε₀    — поле над зеркалом (модель плоского конденсатора
                               «заряженное зеркало — заземлённая палуба»);
       U  = E·h              — потенциал зеркала относительно палубы;
       W  = C_об U²/2        — энергия искры с незаземлённого проводника.
     d — диаметр наливной трубы, v — скорость в ней, gamma — удельная
     проводимость жидкости, S — площадь зеркала, h — высота газового
     пространства, Cobj — ёмкость незаземлённого предмета. */
  function tankStatic(d, v, gamma, epsR, S, h, Cobj, kI) {
    var k = kI == null ? 3.75e-6 : kI;
    var I = k * v * d * d;
    var tau = C.eps0 * epsR / gamma;
    var Q = I * tau;
    var sigma = Q / S;
    var E = sigma / C.eps0;
    var U = E * h;
    return {
      Qv: v * Math.PI * d * d / 4,            // объёмная подача, м³/с
      I: I, tau: tau, Q: Q, sigma: sigma, E: E, U: U,
      W: Cobj ? Cobj * U * U / 2 : null,
      margin: 3e6 / E,                        // во сколько раз до пробоя воздуха
    };
  }

  /* ==================================================================
   *  9. ПОСТОЯННЫЙ ТОК
   * ================================================================== */

  /* Источник с ЭДС и внутренним сопротивлением на нагрузку R. */
  function source(emf, rInt, R) {
    var I = emf / (R + rInt);
    return { I: I, U: I * R, Pfull: emf * I, Puse: I * I * R,
      eta: R / (R + rInt), Pmax: emf * emf / (4 * rInt) };
  }

  /* Разветвлённая цепь: два источника и три ветви (классическая задача на
     правила Кирхгофа). Ветви 1 и 2 — с источниками, ветвь 3 — общая.
     Решение системы методом определителей. */
  function kirchhoff2(e1, r1, e2, r2, R3) {
    /* I1 + I2 = I3;  e1 = I1 r1 + I3 R3;  e2 = I2 r2 + I3 R3 */
    var det = r1 * r2 + R3 * (r1 + r2);
    var I1 = (e1 * (r2 + R3) - e2 * R3) / det;
    var I2 = (e2 * (r1 + R3) - e1 * R3) / det;
    return { I1: I1, I2: I2, I3: I1 + I2, U3: (I1 + I2) * R3 };
  }

  /* Судовой кабель: падение напряжения и потери в двухпроводной линии
     длиной L (ток идёт туда и обратно, поэтому 2L). */
  function cable(I, L, S, rhoRes, U0) {
    var Rline = rhoRes * 2 * L / S;
    var dU = I * Rline;
    return { R: Rline, dU: dU, rel: U0 ? dU / U0 : null, P: I * I * Rline };
  }

  /* Мост Уитстона: условие равновесия и чувствительность.
     Неизвестное Rx по трём известным плечам. */
  function bridge(R1, R2, R3) { return R2 * R3 / R1; }
  /* Реохордный мост: Rx = R·l2/l1 (плечи — участки проволоки). */
  function slideBridge(R, l1, l2) { return R * l2 / l1; }

  /* Джоуль — Ленц для нагревателя: время нагрева массы m вещества с
     теплоёмкостью c на ΔT при КПД eta и питании напряжением U прибора,
     рассчитанного на мощность Pnom при номинальном напряжении Unom.
     Сопротивление спирали считаем постоянным, поэтому при просадке
     напряжения мощность падает как U². */
  function heater(Pnom, Unom, c, m, dT, eta, U) {
    var R = Unom * Unom / Pnom;
    var Uw = U == null ? Unom : U;
    var P = Uw * Uw / R;
    var Q = c * m * dT;
    var e = eta == null ? 1 : eta;
    return { R: R, I: Uw / R, P: P, Q: Q, t: Q / (e * P) };
  }

  /* Температура обмотки по методу сопротивления: обмотка сама себе термометр.
     k — постоянная материала (медь 235, алюминий 245): она равна обратному
     температурному коэффициенту, отнесённому к 0 °C. */
  function windingTemp(R1, t1, R2, k) {
    var kk = k == null ? 235 : k;
    var t2 = R2 / R1 * (kk + t1) - kk;
    return { t2: t2, rise: t2 - t1, alpha20: 1 / (kk + 20) };
  }

  /* Полупроводниковый терморезистор (NTC): R = R0·exp(B(1/T − 1/T0)),
     температуры в кельвинах. Возвращает сопротивление и относительную
     чувствительность dR/(R dT) = −B/T², которую удобно сравнивать с
     температурным коэффициентом металла. */
  function thermistorNTC(R0, B, T0, T) {
    return { R: R0 * Math.exp(B * (1 / T - 1 / T0)), sens: -B / (T * T) };
  }

  /* ==================================================================
   *  10. МАГНЕТИЗМ И ИНДУКЦИЯ
   * ================================================================== */

  function wireField(I, r) { return C.mu0 * I / (2 * Math.PI * r); }
  function loopField(I, R) { return C.mu0 * I / (2 * R); }
  function solenoidField(I, n) { return C.mu0 * n * I; }        // n — витков на метр

  /* Заряженная частица в магнитном поле. */
  function lorentz(m, q, v, B) {
    return { r: m * v / (Math.abs(q) * B), T: 2 * Math.PI * m / (Math.abs(q) * B),
      F: Math.abs(q) * v * B };
  }
  /* Электрон, ускоренный разностью потенциалов U (нерелятивистски). */
  function accelerated(U, m, q) {
    var mm = m || C.me, qq = q || C.e;
    return { v: Math.sqrt(2 * qq * U / mm), E: qq * U };
  }

  /* ЭДС индукции: стержень в поле, вращающаяся рамка, изменение потока. */
  function inductionRod(B, L, v) { return B * L * v; }
  function inductionFrame(B, S, N, nRps) {
    var w = 2 * Math.PI * nRps;
    return { emfMax: N * B * S * w, omega: w };
  }
  function fluxEmf(N, dPhi, dt) { return N * dPhi / dt; }

  /* Соленоид: индуктивность и энергия магнитного поля. */
  function solenoid(N, S, l, mu) {
    var n = N / l;
    var L = (mu || 1) * C.mu0 * n * n * S * l;
    return { n: n, L: L, energy: function (I) { return L * I * I / 2; },
      B: function (I) { return (mu || 1) * C.mu0 * n * I; } };
  }

  /* Девиация магнитного компаса: судовое (корпусное) поле H' складывается с
     горизонтальной составляющей земного H. Полукруговая девиация
     δ = arctg(H'/H · sin(курс)) — приближение первого порядка; при малых
     углах δ ≈ (H'/H)·sin(курс) в радианах. */
  function deviation(Hship, Hearth, courseDeg) {
    var ratio = Hship / Hearth;
    return {
      ratio: ratio,
      deltaDeg: toDeg(Math.atan(ratio * Math.sin(deg(courseDeg)))),
      maxDeg: toDeg(Math.atan(ratio)),
    };
  }

  /* Цепь RL: установление тока и бросок ЭДС самоиндукции при размыкании.
     L — индуктивность, Гн; R — сопротивление цепи, Ом; I0 — установившийся
     ток, А; dt — время разрыва контактов, с.
     tau = L/R — постоянная времени нарастания I(t) = I0(1 − e^{−t/tau});
     emf = L·I0/dt — средняя ЭДС самоиндукции за время разрыва (правило Ленца:
     она поддерживает прежний ток и потому «выталкивает» искру на контакты);
     W = L·I0²/2 — энергия магнитного поля, которой надо куда-то деться. */
  function rlBreak(L, R, I0, dt) {
    return {
      tau: L / R,
      t99: (L / R) * Math.log(100),      // время выхода на 99 % тока
      emf: L * I0 / dt,
      W: L * I0 * I0 / 2,
    };
  }

  /* ==================================================================
   *  11. ОПТИКА
   * ================================================================== */

  /* Опыт Юнга: ширина полосы и длина волны по картине. */
  function young(lam, d, L) { return { dx: lam * L / d }; }
  function youngLambda(dx, d, L) { return dx * d / L; }

  /* Кольца Ньютона в отражённом свете: радиусы тёмных и светлых колец. */
  function newtonRings(m, lam, R) {
    return { rDark: Math.sqrt(m * lam * R),
      rLight: Math.sqrt((m - 0.5) * lam * R) };
  }
  /* Просветляющее покрытие: минимальная толщина при показателе n. */
  function coating(lam, n) { return lam / (4 * n); }

  /* Дифракционная решётка: угол максимума, число максимумов, разрешающая
     способность. */
  function grating(d, lam, m) {
    var s = m * lam / d;
    return { sin: s, ok: Math.abs(s) <= 1, angleDeg: Math.abs(s) <= 1 ? toDeg(Math.asin(s)) : null,
      mMax: Math.floor(d / lam), Rres: function (N) { return m * N; } };
  }

  /* Поляризация: закон Малюса и угол Брюстера. */
  function malus(I0, angleDeg) { return I0 * sq(Math.cos(deg(angleDeg))); }
  function brewster(n2, n1) { return toDeg(Math.atan(n2 / (n1 || 1))); }

  /* Преломление и полное внутреннее отражение. */
  function refraction(n1, n2, angle1Deg) {
    var s = n1 * Math.sin(deg(angle1Deg)) / n2;
    return { sin2: s, angle2Deg: Math.abs(s) <= 1 ? toDeg(Math.asin(s)) : null,
      critDeg: n1 > n2 ? toDeg(Math.asin(n2 / n1)) : null };
  }

  /* Дальность видимости навигационного огня. Геометрическая дальность —
     по высоте глаза и высоте огня (МТ-2000, коэффициент 2,08 при высотах
     в метрах и результате в милях). Оптическая — по закону Аллара:
     E = I·exp(−q·d)/d², где q = 3/Vмет — показатель ослабления, порог
     освещённости 2·10⁻⁷ лк для ночного зрения. */
  function lightRange(Ical, hEye, hLight, Vmet, Ethr) {
    var geo = 2.08 * (Math.sqrt(hEye) + Math.sqrt(hLight));   // мили
    var q = 3 / (Vmet * 1852);                                 // 1/м, метеодальность в милях
    var E = Ethr || 2e-7;
    /* решаем I e^{−q d}/d² = E численно (уравнение трансцендентное) */
    var lo = 1, hi = 200000, mid, f, i;
    for (i = 0; i < 200; i++) {
      mid = (lo + hi) / 2;
      f = Ical * Math.exp(-q * mid) / (mid * mid) - E;
      if (f > 0) lo = mid; else hi = mid;
    }
    return { geoNm: geo, optM: lo, optNm: lo / 1852,
      rangeNm: Math.min(geo, lo / 1852) };
  }

  /* Тонкая линза: формула 1/f = 1/d + 1/d′ и линейное увеличение.
     f — фокусное расстояние, м (для рассеивающей задавать отрицательным);
     d — расстояние от предмета до линзы, м.
     d′ > 0 — изображение действительное (за линзой), d′ < 0 — мнимое;
     Г = |d′/d|; D = 1/f — оптическая сила, дптр.
     При d = f знаменатель обращается в нуль: изображение уходит в
     бесконечность, из линзы выходит параллельный пучок. */
  function thinLens(f, d) {
    var inv = 1 / f - 1 / d;
    var dImg = inv === 0 ? Infinity : 1 / inv;
    return {
      D: 1 / f,
      dImg: dImg,
      magn: Math.abs(dImg / d),
      real: dImg > 0,
    };
  }

  /* Прожектор (маячный аппарат): источник конечного размера в фокусе линзы.
     a — размер светящегося тела, м; f — фокусное расстояние, м;
     flux — световой поток, собираемый линзой, лм.
     Каждая точка источника, смещённая на x от оси, даёт параллельный пучок под
     углом x/f, поэтому полная расходимость пучка равна a/f, полуугол a/(2f).
     Телесный угол конуса Ω = 2π(1 − cos θ), сила света I = Φ/Ω.
     gain — во сколько раз линза увеличила силу света по сравнению с той же
     лампой, светящей во все стороны (Φ/4π). */
  function beamFromSource(a, f, flux) {
    var theta = a / (2 * f);                       // полуугол, рад
    var omega = 2 * Math.PI * (1 - Math.cos(theta));
    return {
      thetaRad: theta,
      fullDeg: (a / f) * 180 / Math.PI,
      omega: omega,
      I: flux / omega,
      gain: 4 * Math.PI / omega,
    };
  }

  /* ==================================================================
   *  12. КВАНТОВАЯ И ЯДЕРНАЯ ФИЗИКА
   * ================================================================== */

  /* Тепловое излучение: закон Стефана — Больцмана и смещения Вина. */
  function blackbody(T, S) {
    return { Me: C.sigma * sq(sq(T)), P: S ? C.sigma * sq(sq(T)) * S : null,
      lamMax: C.bWien / T };
  }

  /* Фотоэффект: энергия кванта, красная граница, запирающее напряжение. */
  function photoeffect(lamNm, AoutEv) {
    var lam = lamNm * 1e-9;
    var Eph = C.h * C.c / lam;
    var A = AoutEv * C.e;
    var Ek = Eph - A;
    return {
      Eph: Eph, EphEv: Eph / C.e, A: A,
      Ek: Ek, EkEv: Ek / C.e,
      Uzap: Ek > 0 ? Ek / C.e : 0,
      lam0nm: C.h * C.c / A * 1e9,
      vMax: Ek > 0 ? Math.sqrt(2 * Ek / C.me) : 0,
    };
  }

  /* Волна де Бройля и соотношение неопределённостей. */
  function deBroglie(m, v) { return C.h / (m * v); }
  function uncertainty(dx) { return C.hbar / (2 * dx); }

  /* Атом водорода по Бору. Уровень n получается из условия квантования момента
     импульса m v r = nħ вместе с законом Кулона, поэтому и энергию, и радиус, и
     скорость считаем из фундаментальных постоянных, а не берём табличные
     «13,6 эВ» и «0,0529 нм» готовыми:
       E_n = −m e⁴/(8 ε₀² h² n²),  r_n = n² ε₀ h²/(π m e²),  v_n = e²/(2 ε₀ h n).
     Знак минус означает связанное состояние: чтобы оторвать электрон с уровня n,
     нужно сообщить ему |E_n|. */
  function bohr(n) {
    var E1 = -C.me * Math.pow(C.e, 4) / (8 * C.eps0 * C.eps0 * C.h * C.h);  // Дж
    var a0 = C.eps0 * C.h * C.h / (Math.PI * C.me * C.e * C.e);             // м
    var E = E1 / (n * n);
    return {
      E: E, EeV: E / C.e,               // энергия уровня, Дж и эВ
      r: a0 * n * n, rNm: a0 * n * n * 1e9,
      v: C.e * C.e / (2 * C.eps0 * C.h * n),
      a0: a0, E1eV: E1 / C.e,
    };
  }

  /* Спектральная линия водорода при переходе n2 → n1 (n2 > n1).
     Энергия фотона равна разности уровней, длина волны — hc/ΔE. Серия Лаймана —
     это n1 = 1 (ультрафиолет), Бальмера — n1 = 2 (видимый свет), Пашена —
     n1 = 3 (инфракрасный). Формула эквивалентна сериальной формуле Бальмера
     1/λ = R(1/n1² − 1/n2²), причём постоянная Ридберга здесь не подставляется
     извне, а получается как R = |E₁|/(hc). */
  function hydrogenLine(n1, n2) {
    var dE = bohr(n1).E - bohr(n2).E;         // > 0: излучается фотон
    return {
      dE: Math.abs(dE), dEeV: Math.abs(dE) / C.e,
      lam: C.h * C.c / Math.abs(dE), lamNm: C.h * C.c / Math.abs(dE) * 1e9,
      Rydberg: -bohr(1).E / (C.h * C.c),      // м⁻¹
    };
  }

  /* Эффект Комптона: рассеяние фотона на свободном электроне.
     Δλ = λ_C (1 − cos θ), где λ_C = h/(m_e c) = 2,43 пм — комптоновская длина
     волны электрона. Сдвиг НЕ зависит от исходной длины волны, поэтому в
     видимом свете (λ ~ 500 нм) он теряется, а в рентгене (λ ~ 50 пм) заметен.
     Отданная электрону энергия — просто разность энергий фотона до и после. */
  function compton(lamPm, thetaDeg) {
    var lamC = C.h / (C.me * C.c);                       // м
    var lam = lamPm * 1e-12;
    var dLam = lamC * (1 - Math.cos(thetaDeg * Math.PI / 180));
    var lam2 = lam + dLam;
    var E1 = C.h * C.c / lam, E2 = C.h * C.c / lam2;
    return {
      lamCpm: lamC * 1e12, dLamPm: dLam * 1e12, lam2pm: lam2 * 1e12,
      EphEv: E1 / C.e, Eph2Ev: E2 / C.e,
      EkEv: (E1 - E2) / C.e, frac: (E1 - E2) / E1,
    };
  }

  /* Энергия связи ядра. По таблицам даются массы АТОМОВ, а не ядер, поэтому
     дефект массы считают через массу атома водорода m(¹H) = 1,00783 а.е.м.:
     Δm = Z·m(¹H) + N·m_n − M_атома. Электроны при этом сокращаются
     (их Z слева и Z справа), а разница в энергии связи электронных оболочек
     на пять порядков меньше ядерной и в расчёт не идёт. Если подставить
     массу голого протона к массе атома, ответ занизится примерно на 3,5 % —
     это самая частая ошибка в этой задаче. */
  var M_H = 1.00783, M_N = 1.00866;         // а.е.м., атом водорода и нейтрон
  function bindingEnergy(Z, N, massAmu) {
    var dm = (Z * M_H + N * M_N - massAmu) * C.u;
    var E = dm * C.c * C.c;
    return { dmAmu: dm / C.u, E: E, EMeV: E / C.e / 1e6,
      perNucleon: E / C.e / 1e6 / (Z + N) };
  }

  /* Радиоактивный распад: постоянная распада, активность, доля оставшихся. */
  function decay(halfLife, N0, t) {
    var lam = Math.LN2 / halfLife;
    return { lambda: lam, A0: lam * N0, A: lam * N0 * Math.exp(-lam * t),
      N: N0 * Math.exp(-lam * t), frac: Math.exp(-lam * t),
      tau: 1 / lam };
  }

  /* Доза от точечного источника гамма-излучения за защитой:
     мощность дозы падает как 1/r² и ослабляется экраном exp(−μd);
     Gamma — гамма-постоянная источника, (аГр·м²)/(с·Бк) в СИ или в
     практических единицах — тогда результат в тех же практических.
     Возвращает мощность дозы и накопленную дозу за время t. */
  function doseRate(Gamma, A, r, mu, d, t) {
    var k = Gamma * A / (r * r) * Math.exp(-(mu || 0) * (d || 0));
    return { rate: k, dose: t != null ? k * t : null,
      shieldFactor: Math.exp(-(mu || 0) * (d || 0)),
      halfValue: mu ? Math.LN2 / mu : null };
  }

  /* Толщина защиты, нужная для снижения мощности дозы в n раз. */
  function shieldThickness(mu, n) { return Math.log(n) / mu; }

  /* Энергетика деления ядерного топлива. При делении одного ядра урана-235
     выделяется около 200 МэВ (осколки, нейтроны, гамма-кванты, бета-распады
     осколков); QMeV — эта величина, Mmol — молярная масса нуклида, г/моль.
     Считаем: сколько энергии даёт килограмм топлива, сколько килограммов нужно
     на выработку P·t и во сколько раз это меньше массы органического топлива с
     удельной теплотой сгорания qFuel (Дж/кг). Обе энергии тепловые, поэтому
     сравнение честное. */
  function fission(QMeV, Mmol, Pwatt, tSec, qFuel) {
    var Q = QMeV * 1e6 * C.e;                            // Дж на одно деление
    var nPerKg = C.NA * 1000 / Mmol;                     // ядер в килограмме
    var ePerKg = Q * nPerKg;                             // Дж/кг
    var W = Pwatt * tSec;                                // выработка, Дж
    var mNuc = W / ePerKg;                               // кг делящегося нуклида
    var mOrg = qFuel ? W / qFuel : null;                 // кг органического топлива
    return {
      Q: Q, QMeV: QMeV, nPerKg: nPerKg, ePerKg: ePerKg,
      W: W, mNuc: mNuc, mOrg: mOrg,
      ratio: mOrg ? mOrg / mNuc : null,
    };
  }

  /* ==================================================================
   *  САМОПРОВЕРКА
   * ================================================================== */

  function selftest() {
    var bad = [];
    function chk(name, got, want, tol) {
      var t = tol == null ? 1e-6 : tol;
      if (!(Math.abs(got - want) <= t * Math.max(1, Math.abs(want)))) {
        bad.push(name + ': получено ' + got + ', ожидалось ' + want);
      }
    }

    /* Кинематика: при a_n = a_τ полное ускорение больше в √2 раз, а угол 45°. */
    var cr = circular(0.20, 0.050, Math.sqrt(0.20 / 0.050));
    chk('окружность: a_n = a_τ в момент t₁', cr.an, 0.050, 1e-9);
    chk('окружность: угол 45° в этот момент', cr.beta, 45, 1e-9);

    /* Бросок под 45° даёт максимальную дальность; дальность вдвое больше
       учетверённой высоты подъёма при 45°: L = 4H при α = 45°. */
    var pr = projectile(20, 45);
    chk('бросок: L = 4H при 45°', pr.L, 4 * pr.H, 1e-9);
    chk('бросок: дальность 20 м/с под 45°', pr.L, 400 / C.g, 1e-9);
    if (projectile(20, 40).L >= pr.L) bad.push('бросок: 45° должен давать максимум дальности');
    if (projectile(20, 50).L >= pr.L) bad.push('бросок: 45° должен давать максимум дальности');

    /* Связанные тела: без трения и при m2 = 0 ускорение равно g. */
    chk('связанные тела: m2 = 0 → a = g', connected(1, 0, 0.3).a, C.g, 1e-9);
    /* при равных массах и μ = 0 ускорение вдвое меньше g */
    chk('связанные тела: равные массы без трения', connected(1, 1, 0).a, C.g / 2, 1e-9);

    /* Неупругий удар: при равных массах и встречных равных скоростях всё
       останавливается, вся энергия переходит в тепло. */
    var ie = inelastic(2, 5, 2, -5);
    chk('неупругий удар: скорость после', ie.u, 0, 1e-12);
    chk('неупругий удар: доля потерь', ie.frac, 1, 1e-12);

    /* Баллистический маятник: обращение формулы. */
    var bl = ballistic(0.010, 2.0, 0.10);
    chk('баллистический маятник: скорость пули',
      bl.v, (0.010 + 2.0) / 0.010 * Math.sqrt(2 * C.g * 0.10), 1e-9);

    /* Скатывание: обруч (κ = 1) отстаёт от шара (κ = 2/5), и порядок
       не зависит от массы и радиуса — это классический результат. */
    var hoop = rolling(1, 1.0, 30, true), ball = rolling(0.4, 1.0, 30, true);
    if (!(ball.v > hoop.v)) bad.push('скатывание: шар должен обгонять обруч');
    chk('скатывание: скорость шара с высоты 1 м',
      ball.v, Math.sqrt(2 * C.g * 1.0 / 1.4), 1e-9);
    chk('скатывание: доля вращательной энергии обруча', hoop.fracRot, 0.5, 1e-12);

    /* Скамья Жуковского: момент импульса сохраняется, энергия растёт. */
    var zh = zhukovsky(2.5, 1.0, 1.0);
    chk('скамья: сохранение момента импульса', 1.0 * zh.w2, 2.5 * zh.w1, 1e-9);
    if (!(zh.A > 0)) bad.push('скамья: при сближении рук человек должен совершать положительную работу');

    /* Маятники: период пружинного не зависит от g, математического — от массы. */
    chk('математический маятник L = 1 м', mathPendulum(1.0), 2 * Math.PI / Math.sqrt(C.g), 1e-9);
    /* физический маятник в виде стержня, подвешенного за конец:
       T = 2π√(2L/3g), приведённая длина 2L/3 */
    var ph = physPendulum(inertia.rodEnd(1, 1.2), 1, 0.6);
    chk('физический маятник: приведённая длина стержня', ph.Lred, 2 * 1.2 / 3, 1e-9);

    /* Затухание: при β → 0 декремент → 0, добротность → ∞;
       Q = π/λ по определению. */
    var dm = damped(10, 0.1);
    chk('затухание: добротность через декремент', dm.Q, Math.PI / dm.lambda, 1e-12);
    if (!(dm.w < 10)) bad.push('затухание: частота затухающих колебаний должна быть меньше собственной');

    /* Резонанс: при малом затухании амплитуда на резонансе примерно
       в Q раз больше статического отклонения. */
    var fr = forced(1, 10, 0.1, 10);
    chk('резонанс: A(ω₀) = f₀/(2βω₀)', fr.A, 1 / (2 * 0.1 * 10), 1e-9);

    /* Качка: период растёт при уменьшении метацентрической высоты —
       «валкое» судно качается медленно, «остойчивое» — резко. */
    var r1 = rollPeriod(18, 0.6), r2 = rollPeriod(18, 1.2);
    if (!(r1.T > r2.T)) bad.push('качка: при меньшей метацентрической высоте период должен быть больше');
    chk('качка: период при B = 18 м, h = 0,6 м',
      r1.T, 2 * Math.PI * 0.38 * 18 / Math.sqrt(C.g * 0.6), 1e-9);

    /* Идеальный газ: при нормальных условиях молярный объём 22,4 л/моль. */
    var ig = idealGas(101325, 0.0224, 273.15, 0.029);
    chk('идеальный газ: молярный объём при н.у.', ig.nu, 1, 2e-3);

    /* Скорости Максвелла идут в порядке v_вер < ⟨v⟩ < v_кв
       с точными отношениями √2 : √(8/π) : √3. */
    var mx = mkt(300, 0.029);
    if (!(mx.vProb < mx.vMean && mx.vMean < mx.vRms)) {
      bad.push('скорости Максвелла: нарушен порядок v_вер < ⟨v⟩ < v_кв');
    }
    chk('отношение v_кв/v_вер', mx.vRms / mx.vProb, Math.sqrt(1.5), 1e-12);

    /* Теплоёмкости: для двухатомного газа γ = 1,4, Cp − Cv = R (Майер). */
    var hc = heatCap(5);
    chk('двухатомный газ: показатель адиабаты', hc.gamma, 1.4, 1e-12);
    chk('уравнение Майера', hc.Cp - hc.Cv, C.R, 1e-12);

    /* Адиабата: сжатие нагревает; при γ = 1,4 и степени сжатия 10
       температура растёт в 10^0,4 = 2,512 раза. */
    var ad = proc.adiabat(1, 5, 300, 1e5, 10);
    chk('адиабата: рост температуры', ad.T2 / 300, Math.pow(10, 0.4), 1e-12);
    chk('адиабата: A = −ΔU', ad.A, -ad.dU, 1e-12);

    /* Карно: КПД между 400 и 300 К равен ровно 25 %. */
    var ca = carnot(400, 300, 1000);
    chk('Карно: КПД', ca.eta, 0.25, 1e-12);
    chk('Карно: баланс энергии', ca.A + ca.Q2, ca.Q1, 1e-9);

    /* Стенка: сумма перепадов равна полному перепаду температур. */
    var w = wall([{ delta: 0.012, lambda: 45 }, { delta: 0.05, lambda: 0.04 }], 8, 23, 20, -20);
    chk('стенка: перепад по слоям сходится', w.temps[0] - w.temps[2], w.q * (0.012 / 45 + 0.05 / 0.04), 1e-9);
    if (!(w.K < 1)) bad.push('стенка с изоляцией 50 мм должна иметь K < 1 Вт/(м²·К)');

    /* Плавучесть: понтон 10×3×0,5 в пресной воде вытесняет 15 т. */
    var bu = buoyancy(10, 3, 0.5, 1000, 1);
    chk('плавучесть: водоизмещение понтона', bu.D, 15000, 1e-9);
    /* давление на 100 м в морской воде ≈ 1,0 МПа сверх атмосферного */
    chk('гидростатика: 100 м морской воды', hydrostatics(100).pGauge, 1025 * C.g * 100, 1e-9);

    /* Кавитация: давление насыщенного пара при 100 °C равно атмосферному. */
    chk('давление насыщенного пара при 100 °C', pSat(100), 101325, 0.01);
    chk('давление насыщенного пара при 20 °C', pSat(20), 2339, 0.02);

    /* Капилляр: подъём обратно пропорционален радиусу. */
    var cap1 = capillary(0.0728, 0.0005, 1000), cap2 = capillary(0.0728, 0.001, 1000);
    chk('капилляр: h ~ 1/r', cap1.h / cap2.h, 2, 1e-12);

    /* Конденсатор: диэлектрик увеличивает ёмкость в ε раз. */
    var c1 = capacitor(0.01, 1e-3, 1, 100), c2 = capacitor(0.01, 1e-3, 6, 100);
    chk('конденсатор: рост ёмкости с диэлектриком', c2.C / c1.C, 6, 1e-12);

    /* Заряженный шар: на поверхности потенциал непрерывен. */
    var s1 = chargedSphere(1e-8, 0.1, 0.1), s2 = chargedSphere(1e-8, 0.1, 0.0999999);
    chk('шар: непрерывность потенциала на поверхности', s1.phi, s2.phi, 1e-5);

    /* Источник: максимум полезной мощности при R = r, КПД при этом 50 %. */
    var so = source(12, 2, 2);
    chk('источник: максимум полезной мощности', so.Puse, so.Pmax, 1e-9);
    chk('источник: КПД в согласованном режиме', so.eta, 0.5, 1e-12);

    /* Кирхгоф: при равных источниках токи ветвей равны; закон узла. */
    var kk = kirchhoff2(12, 1, 12, 1, 5);
    chk('Кирхгоф: симметричные ветви', kk.I1, kk.I2, 1e-12);
    chk('Кирхгоф: закон узла', kk.I3, kk.I1 + kk.I2, 1e-12);
    /* и второй закон для первого контура */
    chk('Кирхгоф: второй закон', 12, kk.I1 * 1 + kk.I3 * 5, 1e-9);

    /* Мост: в равновесии показания не зависят от питания. */
    chk('мост Уитстона', bridge(100, 200, 150), 300, 1e-12);
    chk('реохордный мост: середина', slideBridge(50, 50, 50), 50, 1e-12);

    /* Магнитное поле: соленоид — суперпозиция витков; электрон в поле. */
    var lo = lorentz(C.me, C.e, 1e7, 0.01);
    chk('период обращения не зависит от скорости',
      lorentz(C.me, C.e, 2e7, 0.01).T, lo.T, 1e-12);
    chk('радиус пропорционален скорости',
      lorentz(C.me, C.e, 2e7, 0.01).r / lo.r, 2, 1e-12);

    /* Соленоид: энергия магнитного поля квадратична по току. */
    var sol = solenoid(1000, 1e-3, 0.5);
    chk('соленоид: энергия ~ I²', sol.energy(2) / sol.energy(1), 4, 1e-12);

    /* Девиация: на курсах 0° и 180° полукруговая девиация равна нулю,
       максимум — на 90°. */
    chk('девиация на курсе 0°', deviation(2e-6, 1.6e-5, 0).deltaDeg, 0, 1e-12);
    chk('девиация максимальна на курсе 90°',
      deviation(2e-6, 1.6e-5, 90).deltaDeg, deviation(2e-6, 1.6e-5, 90).maxDeg, 1e-12);

    /* Юнг: обращение формулы. */
    chk('Юнг: обращение', youngLambda(young(550e-9, 1e-3, 2).dx, 1e-3, 2), 550e-9, 1e-12);

    /* Решётка: при d = 2λ существует только первый порядок. */
    var gr = grating(1.2e-6, 600e-9, 2);
    chk('решётка: sin θ для второго порядка', gr.sin, 1, 1e-12);
    if (grating(1.2e-6, 600e-9, 3).ok) bad.push('решётка: третий порядок при d = 2λ невозможен');

    /* Малюс: при 0° проходит всё, при 90° — ничего, при 45° — половина. */
    chk('Малюс 45°', malus(100, 45), 50, 1e-12);
    chk('Малюс 90°', malus(100, 90), 0, 1e-12);
    /* Брюстер для стекла n = 1,5 → 56,3° */
    chk('угол Брюстера для стекла', brewster(1.5), 56.31, 1e-3);
    /* при угле Брюстера отражённый и преломлённый лучи перпендикулярны */
    var br = brewster(1.5);
    chk('Брюстер: сумма углов 90°', br + refraction(1, 1.5, br).angle2Deg, 90, 1e-6);

    /* Полное внутреннее отражение вода → воздух: 48,6°. */
    chk('предельный угол вода-воздух', refraction(1.333, 1, 0).critDeg, 48.61, 1e-3);

    /* Тепловое излучение: закон смещения Вина и Стефана — Больцмана. */
    var bb = blackbody(5800, 1);
    chk('Вин: максимум Солнца', bb.lamMax, 2.898e-3 / 5800, 1e-12);
    chk('Стефан — Больцман: удвоение T даёт 16-кратный поток',
      blackbody(11600).Me / bb.Me, 16, 1e-12);

    /* Фотоэффект: на красной границе кинетическая энергия равна нулю. */
    var pe0 = photoeffect(photoeffect(300, 2.0).lam0nm, 2.0);
    chk('фотоэффект: на красной границе Ek = 0', pe0.EkEv, 0, 1e-6);
    var pe = photoeffect(300, 2.0);
    chk('фотоэффект: уравнение Эйнштейна', pe.EphEv, pe.EkEv + 2.0, 1e-9);

    /* Де Бройль: у электрона, ускоренного 100 В, λ ≈ 0,123 нм. */
    var vv = accelerated(100).v;
    chk('де Бройль для электрона при 100 В', deBroglie(C.me, vv), 1.226e-10, 2e-3);

    /* Распад: за один период полураспада остаётся ровно половина. */
    var dc = decay(5730, 1e12, 5730);
    chk('распад: половина за период полураспада', dc.frac, 0.5, 1e-12);
    chk('распад: связь λ и T½', dc.lambda * 5730, Math.LN2, 1e-12);

    /* Энергия связи: у гелия-4 около 7,07 МэВ на нуклон. */
    var be = bindingEnergy(2, 2, 4.00260);
    chk('энергия связи гелия-4 на нуклон', be.perNucleon, 7.07, 5e-3);

    /* Защита: слой половинного ослабления вдвое уменьшает дозу. */
    var dr1 = doseRate(1, 1e10, 1, 0.1, 0), dr2 = doseRate(1, 1e10, 1, 0.1, Math.LN2 / 0.1);
    chk('защита: слой половинного ослабления', dr2.rate / dr1.rate, 0.5, 1e-12);
    chk('толщина защиты для ослабления в 10 раз',
      shieldThickness(0.1, 10), Math.log(10) / 0.1, 1e-12);
    /* мощность дозы падает как 1/r² */
    chk('доза: закон обратных квадратов',
      doseRate(1, 1e10, 2).rate / doseRate(1, 1e10, 1).rate, 0.25, 1e-12);

    /* Дальность огня: оптическая дальность растёт с силой света, но
       медленнее чем линейно, и ограничивается геометрией. */
    var lr = lightRange(1000, 5, 12, 10);
    if (!(lightRange(4000, 5, 12, 10).optNm > lr.optNm)) {
      bad.push('дальность огня: более сильный огонь должен быть виден дальше');
    }
    /* проверка обратной подстановкой в уравнение Аллара */
    var q = 3 / (10 * 1852);
    chk('Аллар: подстановка корня', 1000 * Math.exp(-q * lr.optM) / sq(lr.optM), 2e-7, 1e-4);

    /* Водомёт: КПД струи равен 2v/(v+vj) — классическая формула. */
    var wj = waterJet(5, 8, 16);
    chk('водомёт: КПД струи', wj.eta, 2 * 8 / (8 + 16), 1e-9);

    /* ---- добавленное при разборе задач: контрольные точки ---------------- */

    /* Снос течением: течение точно поперёк линии пути при u/v = 1/2 даёт
       угол сноса ровно 30°, путевую скорость v·cos30° и курс, отвёрнутый
       навстречу сносу. */
    var dr = drift(12, 6, 90, 180);
    chk('снос: угол при u/v = 1/2 поперёк пути', dr.beta, 30, 1e-9);
    chk('снос: путевая скорость', dr.V, 12 * Math.sqrt(3) / 2, 1e-9);
    chk('снос: курс отвёрнут против сноса', dr.heading, 60, 1e-9);
    var dr0 = drift(12, 3, 90, 90);
    chk('снос: попутное течение не сносит', dr0.beta, 0, 1e-12);
    chk('снос: попутное течение прибавляется', dr0.V, 15, 1e-12);
    if (drift(6, 8, 90, 0).ok) bad.push('снос: при поперечном течении больше собственной скорости решения быть не должно');

    /* Перегон из трёх участков: без равномерного участка средняя скорость
       равна ровно половине маршевой при любых ускорениях. */
    var ts = twoStage(20, 0.6, 1.0, 20 * 20 / 2 * (1 / 0.6 + 1 / 1.0));
    chk('перегон: без равномерного участка ⟨v⟩ = v/2', ts.vAvg, 10, 1e-9);
    var ts2 = twoStage(20, 0.6, 1.0, 2000);
    chk('перегон: сумма путей', ts2.s1 + ts2.s2 + ts2.s3, 2000, 1e-9);
    if (!(ts2.vAvg > 10 && ts2.vAvg < 20)) bad.push('перегон: средняя скорость обязана лежать между v/2 и v');

    /* Разгон с сопротивлением: время совпадает с shipAccel, а путь лежит
       между v∞t/2 и v∞t — скорость всё время меньше предельной. */
    var sp = shipAccelPath(1.5e6, 1.5e5, 4.2e3, 0.9);
    chk('разгон: время совпадает с shipAccel', sp.t, shipAccel(1.5e6, 1.5e5, 4.2e3, 0.9).t, 1e-9);
    if (!(sp.s < sp.vInf * sp.t && sp.s > sp.vInf * sp.t / 2)) bad.push('разгон: путь должен быть между v∞t/2 и v∞t');

    /* Упругий удар: равные массы обмениваются скоростями, законы сохранения
       выполняются точно, от тяжёлой стенки тело отскакивает. */
    var el = elastic(1, 5, 1, 0);
    chk('упругий удар: обмен скоростями при равных массах', el.u1, 0, 1e-12);
    chk('упругий удар: обмен скоростями при равных массах (2)', el.u2, 5, 1e-12);
    chk('упругий удар: вся энергия переходит', el.transfer, 1, 1e-12);
    var el2 = elastic(0.2, 5, 0.6, 0);
    chk('упругий удар: сохранение импульса', 0.2 * el2.u1 + 0.6 * el2.u2, 0.2 * 5, 1e-12);
    chk('упругий удар: сохранение энергии',
      0.2 * el2.u1 * el2.u1 / 2 + 0.6 * el2.u2 * el2.u2 / 2, el2.E0, 1e-12);
    chk('упругий удар: скорость разлёта равна скорости сближения', el2.dvRel, 0, 1e-12);
    chk('упругий удар: доля энергии при m2 = 3m1', el2.transfer, 0.75, 1e-12);
    chk('упругий удар: отскок от тяжёлой стенки', elastic(1, 5, 1e9, 0).u1, -5, 1e-6);

    /* Отбойник причала: средняя сила составляет 2/π от максимальной, а время
       торможения не зависит от скорости навала. */
    var bp = bumper(8e5, 0.25, 2e6);
    chk('отбойник: средняя сила = (2/π)·F', bp.Fmean, 2 / Math.PI * bp.F, 1e-9);
    chk('отбойник: время не зависит от скорости', bumper(8e5, 1.0, 2e6).t, bp.t, 1e-12);
    chk('отбойник: энергия равна работе пружины', bp.E, 2e6 * bp.x * bp.x / 2, 1e-9);

    /* Раскрутка вала: угол равен половине произведения конечной скорости на
       время, а реверс за то же время требует вдвое большего момента. */
    var su = spinUp(30963, 40000, 4 * Math.PI);
    chk('раскрутка: угол = ω t/2', su.phi, 4 * Math.PI * su.t / 2, 1e-9);
    chk('раскрутка: энергия', su.Ek, 30963 * sq(4 * Math.PI) / 2, 1e-9);
    chk('реверс: вдвое больший момент', su.Mreverse(su.t), 2 * 40000, 1e-9);
    chk('гироскоп: без поворота момент нулевой', gyroBearingForce(360, 314.16, 0, 2, 2000).M, 0, 1e-12);

    /* Волна на глубокой воде: групповая скорость вдвое меньше фазовой. */
    var wd = waveDeep(10);
    chk('волна: групповая скорость вдвое меньше фазовой', wd.cGroup, wd.c / 2, 1e-12);
    chk('волна: длина при периоде 10 с', wd.lambda, C.g * 100 / (2 * Math.PI), 1e-9);

    /* Период встречи: на траверзе равен периоду волны, на попутном курсе
       больше, на встречном меньше; обратная задача согласована с прямой. */
    chk('встреча: траверз не меняет период', encounterPeriod(7, 6.17, 90).tauE, 7, 1e-12);
    if (!(encounterPeriod(7, 6.17, 0).tauE > 7)) bad.push('встреча: на попутном волнении период должен расти');
    if (!(encounterPeriod(7, 6.17, 180).tauE < 7)) bad.push('встреча: на встречном волнении период должен падать');
    var rr = rollResonanceCourse(7, 9.6425, 6.1728);
    chk('резонанс качки: обратная задача', encounterPeriod(7, 6.1728, rr.muDeg).tauE, 9.6425, 1e-6);

    /* Звук в воздухе при 20 °C — 343 м/с; закрытая труба даёт только
       нечётные гармоники, а соседние резонансные длины отличаются на λ/2. */
    chk('скорость звука в воздухе', soundSpeedGas(293.15, 0.029, 1.4), 343, 2e-3);
    chk('труба: вторая мода втрое выше первой', pipeMode(0.6, 343, 2, true), 3 * pipeMode(0.6, 343, 1, true), 1e-12);
    chk('труба: резонансные длины через λ/2',
      pipeLength(440, 343, 2, true) - pipeLength(440, 343, 1, true), 343 / 440 / 2, 1e-12);

    /* Эхо: сдвиг удваивается, и обратная задача возвращает ту же скорость. */
    var de = dopplerEcho(30000, 1500, 8);
    chk('эхо: приближение 2ν₀u/c', de.dnu, de.dnuApprox, 1e-2);
    chk('эхо: обратная задача', dopplerSpeed(30000, de.nu, 1500), 8, 1e-9);

    /* Барометрическая формула: на характеристической высоте давление падает
       ровно в e раз, плотность — в том же отношении. */
    var ba = barometric(101325, 273, 0.029, C.R * 273 / (0.029 * C.g));
    chk('барометрическая: на высоте H давление в e раз меньше', ba.p, 101325 / Math.E, 1e-12);
    chk('барометрическая: на h½ давление вдвое меньше',
      barometric(101325, 273, 0.029, ba.halfHeight).p, 101325 / 2, 1e-12);
    chk('барометрическая: ρ/ρ₀ = p/p₀', ba.rho / ba.rho0, ba.p / 101325, 1e-12);

    /* Колокол: закон Бойля и закон Дальтона выполняются точно. */
    var db = divingBell(2.0, 3.0, 18, 283, { O2: 0.21, N2: 0.78, Ar: 0.01 });
    chk('колокол: закон Бойля', db.p * db.l, C.patm * 2.0, 1e-9);
    chk('колокол: закон Дальтона', db.partials.O2 + db.partials.N2 + db.partials.Ar, db.p, 1e-9);
    if (!(db.l > 0 && db.l < 2.0)) bad.push('колокол: воздушный столб должен укоротиться');

    /* Точка росы обращает pSat: при стопроцентной влажности совпадает с
       температурой воздуха, при меньшей — всегда ниже. */
    chk('точка росы при φ = 1', dewPoint(20, 1), 20, 1e-6);
    if (!(dewPoint(20, 0.6) < 20)) bad.push('точка росы: при φ < 1 должна быть ниже температуры воздуха');

    /* Теплообмен двух тел: энтропия растёт, обратимая машина уравняла бы их
       при среднем геометрическом — оно всегда ниже среднего арифметического. */
    var he = heatExchange(2.0, 4190, 353.15, 2.0, 4190, 293.15);
    chk('теплообмен: конечная температура', he.Tmix, (353.15 + 293.15) / 2, 1e-12);
    chk('теплообмен: обратимая температура', he.Trev, Math.sqrt(353.15 * 293.15), 1e-9);
    if (!(he.dS > 0)) bad.push('теплообмен: энтропия изолированной системы обязана расти');
    if (!(he.Amax > 0 && he.Trev < he.Tmix)) bad.push('теплообмен: обратимая машина должна давать работу');
    chk('теплообмен: равные температуры', heatExchange(1, 4190, 300, 1, 4190, 300).dS, 0, 1e-12);

    /* Отопление: без вентиляции топливо пропорционально потоку через
       ограждение, идеальный рекуператор снимает вентиляционную часть. */
    var hf = heatingFuel(27.7471, 850, 0, 20, -20, 1728000, 0.85, 42.7e6);
    chk('отопление: топливо без вентиляции', hf.mFuel, 27.7471 * 850 * 1728000 / (0.85 * 42.7e6), 1e-9);
    chk('отопление: идеальный рекуператор',
      heatingFuel(27.7471, 850, 0.5, 20, -20, 1728000, 0.85, 42.7e6, 1).Qvent, 0, 1e-12);

    /* Изгиб балки: обратная задача возвращает исходный модуль Юнга. */
    var bm = beamCenterLoad(9.81, 0.60, 0.020, 0.003, 2.0e11);
    chk('изгиб: момент инерции сечения 20×3 мм', bm.I, 4.5e-11, 1e-9);
    chk('изгиб: обращение задачи даёт исходный E',
      youngFromDeflection(9.81, 0.60, 0.020, 0.003, bm.f).E, 2.0e11, 1e-9);
    chk('изгиб: жёсткость связывает силу и прогиб', bm.kStiff * bm.f, 9.81, 1e-9);

    /* Ареометр: выход штока обратно пропорционален его сечению. */
    var hy = hydrometer(0.030, 0.005, 1000, 1025);
    chk('ареометр: вдвое тоньше шток — вдвое длиннее шкала',
      hydrometer(0.030, 0.005 / Math.SQRT2, 1000, 1025).dl, 2 * hy.dl, 1e-9);
    chk('ареометр: объёмы вытеснения', hy.V1 - hy.V2, hy.dl * hy.A, 1e-15);

    /* Батарея конденсаторов: у n равных ёмкостей отношение соединений n²;
       сумма напряжений и энергий сходится. */
    var cb = capBattery([2e-6, 3e-6, 6e-6], 100);
    chk('батарея: последовательная ёмкость 2-3-6 мкФ', cb.Cser, 1e-6, 1e-9);
    chk('батарея: сумма напряжений равна приложенному', cb.Uk[0] + cb.Uk[1] + cb.Uk[2], 100, 1e-9);
    chk('батарея: сумма энергий равна энергии цепи', cb.Wk[0] + cb.Wk[1] + cb.Wk[2], cb.Wser, 1e-12);
    chk('батарея: три равные — отношение n² = 9', capBattery([1e-6, 1e-6, 1e-6], 10).ratio, 9, 1e-9);

    /* Перезарядка: при равных ёмкостях теряется ровно половина энергии,
       и это не зависит от сопротивления проводов. */
    var cr2 = capRecharge(2e-6, 100, 2e-6);
    chk('перезарядка: при C1 = C2 теряется половина энергии', cr2.lossFrac, 0.5, 1e-12);
    chk('перезарядка: заряд сохраняется', cr2.U * 4e-6, 2e-6 * 100, 1e-12);

    /* Налив: поле линейно по скорости налива, энергия искры — квадратично. */
    var t1s = tankStatic(0.20, 4.0, 1e-12, 2.1, 120, 8.0, 20e-12);
    var t2s = tankStatic(0.20, 8.0, 1e-12, 2.1, 120, 8.0, 20e-12);
    chk('налив: время релаксации ε₀ε/γ', t1s.tau, C.eps0 * 2.1 / 1e-12, 1e-9);
    chk('налив: поле линейно по скорости', t2s.E, 2 * t1s.E, 1e-9);
    chk('налив: энергия искры квадратична по скорости', t2s.W, 4 * t1s.W, 1e-9);

    /* Нагреватель: просадка напряжения вдвое учетверяет время нагрева. */
    var h1 = heater(2000, 220, 4200, 1.7, 85, 0.90);
    chk('нагреватель: мощность при номинале', h1.P, 2000, 1e-9);
    chk('нагреватель: половина напряжения — вчетверо дольше',
      heater(2000, 220, 4200, 1.7, 85, 0.90, 110).t, 4 * h1.t, 1e-9);

    /* Обмотка как термометр: неизменное сопротивление — неизменная температура. */
    chk('обмотка: R не изменилось — температура прежняя', windingTemp(0.50, 20, 0.50).t2, 20, 1e-9);
    chk('обмотка: 0,50 → 0,62 Ом от 20 °C', windingTemp(0.50, 20, 0.62).t2, 81.2, 1e-3);

    /* Терморезистор: в опорной точке даёт номинал, чувствительность отрицательна. */
    chk('терморезистор: R(T₀) = R₀', thermistorNTC(1e4, 3435, 298.15, 298.15).R, 1e4, 1e-9);
    if (!(thermistorNTC(1e4, 3435, 298.15, 298.15).sens < 0)) bad.push('терморезистор: сопротивление обязано падать с нагревом');

    /* Цепь RL: энергия поля равна LI²/2, бросок ЭДС обратно пропорционален
       времени разрыва — потому размыкание индуктивности и даёт искру. */
    var rl = rlBreak(2.5133e-3, 5, 2, 1e-5);
    chk('RL: энергия поля равна LI²/2', rl.W, 2.5133e-3 * 4 / 2, 1e-9);
    chk('RL: вдвое быстрее разрыв — вдвое больше ЭДС',
      rlBreak(2.5133e-3, 5, 2, 5e-6).emf, 2 * rl.emf, 1e-9);
    chk('RL: постоянная времени L/R', rl.tau, 2.5133e-3 / 5, 1e-12);

    /* Тонкая линза: предмет в двойном фокусе даёт увеличение 1, внутри
       фокуса — мнимое изображение. */
    chk('линза: предмет в двойном фокусе даёт Г = 1', thinLens(0.15, 0.30).magn, 1, 1e-12);
    chk('линза: d = 0,20 м при f = 0,15 м', thinLens(0.15, 0.20).dImg, 0.60, 1e-9);
    if (thinLens(0.15, 0.10).real) bad.push('линза: предмет внутри фокуса даёт мнимое изображение');

    /* Прожектор: выигрыш в силе света равен отношению полного телесного угла
       к телесному углу пучка. */
    var bf = beamFromSource(0.010, 0.15, 14);
    chk('прожектор: выигрыш = 4π/Ω', bf.gain, 4 * Math.PI / bf.omega, 1e-12);
    chk('прожектор: сила света = поток / телесный угол', bf.I, 14 / bf.omega, 1e-12);

    /* Атом Бора: основной уровень −13,6 эВ, боровский радиус 0,0529 нм,
       скорость на первой орбите c/137, уровни падают как 1/n². */
    chk('Бор: энергия основного уровня', bohr(1).EeV, -13.6, 1e-3);
    chk('Бор: боровский радиус', bohr(1).rNm, 0.0529, 2e-3);
    chk('Бор: v₁ = c/137', bohr(1).v / C.c * 137, 1, 2e-3);
    chk('Бор: уровни падают как 1/n²', bohr(2).EeV / bohr(1).EeV, 0.25, 1e-12);
    chk('водород: линия Hα 3→2', hydrogenLine(2, 3).lamNm, 656.3, 2e-3);
    chk('водород: первая линия Лаймана 2→1', hydrogenLine(1, 2).lamNm, 121.6, 2e-3);
    chk('водород: постоянная Ридберга', hydrogenLine(2, 3).Rydberg, 1.097e7, 2e-3);

    /* Комптон: сдвиг не зависит от исходной длины волны и максимален при
       рассеянии назад. */
    chk('Комптон: комптоновская длина волны электрона', compton(50, 90).lamCpm, 2.426, 2e-3);
    chk('Комптон: сдвиг при 90° равен λ_C', compton(50, 90).dLamPm, compton(50, 90).lamCpm, 1e-9);
    chk('Комптон: при 180° сдвиг вдвое больше', compton(50, 180).dLamPm, 2 * compton(50, 90).dLamPm, 1e-9);
    chk('Комптон: при 0° сдвига нет', compton(50, 0).dLamPm, 0, 1e-12);
    chk('Комптон: сдвиг не зависит от λ₀', compton(500, 90).dLamPm, compton(50, 90).dLamPm, 1e-12);

    /* Деление: килограмм урана-235 даёт около 8,2·10¹³ Дж — привычная мера
       «мегаватт-сутки с грамма». */
    var fs = fission(200, 235, 350e6, 60 * 86400, 40e6);
    chk('деление: энергия килограмма U-235', fs.ePerKg, 8.21e13, 3e-3);
    chk('деление: около 1 МВт·сут с грамма', fs.ePerKg / 1e3 / 86400 / 1e6, 0.95, 1e-2);
    chk('деление: выработка = P·t', fs.W, 350e6 * 60 * 86400, 1e-12);

    return bad;
  }

  return {
    C: C,
    circular: circular, projectile: projectile, brake: brake,
    connected: connected, incline: incline, shipAccel: shipAccel,
    inelastic: inelastic, ballistic: ballistic, slideUp: slideUp, waterJet: waterJet,
    inertia: inertia, pulleyLoad: pulleyLoad, zhukovsky: zhukovsky,
    rolling: rolling, gyroMoment: gyroMoment,
    springPeriod: springPeriod, mathPendulum: mathPendulum, physPendulum: physPendulum,
    damped: damped, forced: forced, rollPeriod: rollPeriod, wave: wave, doppler: doppler,
    idealGas: idealGas, mkt: mkt, transport: transport, heatCap: heatCap,
    proc: proc, carnot: carnot, entropy: entropy, wall: wall,
    hooke: hooke, expansion: expansion, capillary: capillary,
    hydrostatics: hydrostatics, buoyancy: buoyancy, draftChange: draftChange,
    pSat: pSat, cavitation: cavitation, stokes: stokes,
    pointCharge: pointCharge, twoCharges: twoCharges, chargedSphere: chargedSphere,
    capacitor: capacitor,
    source: source, kirchhoff2: kirchhoff2, cable: cable,
    bridge: bridge, slideBridge: slideBridge,
    wireField: wireField, loopField: loopField, solenoidField: solenoidField,
    lorentz: lorentz, accelerated: accelerated,
    inductionRod: inductionRod, inductionFrame: inductionFrame, fluxEmf: fluxEmf,
    solenoid: solenoid, deviation: deviation,
    young: young, youngLambda: youngLambda, newtonRings: newtonRings,
    coating: coating, grating: grating, malus: malus, brewster: brewster,
    refraction: refraction, lightRange: lightRange,
    blackbody: blackbody, photoeffect: photoeffect, deBroglie: deBroglie,
    uncertainty: uncertainty, bindingEnergy: bindingEnergy, decay: decay,
    doseRate: doseRate, shieldThickness: shieldThickness,
    drift: drift, twoStage: twoStage, shipAccelPath: shipAccelPath,
    elastic: elastic, bumper: bumper,
    spinUp: spinUp, gyroBearingForce: gyroBearingForce,
    waveDeep: waveDeep, encounterPeriod: encounterPeriod,
    rollResonanceCourse: rollResonanceCourse, soundSpeedGas: soundSpeedGas,
    pipeMode: pipeMode, pipeLength: pipeLength,
    dopplerEcho: dopplerEcho, dopplerSpeed: dopplerSpeed,
    barometric: barometric, divingBell: divingBell, dewPoint: dewPoint,
    heatExchange: heatExchange, heatingFuel: heatingFuel,
    beamCenterLoad: beamCenterLoad, youngFromDeflection: youngFromDeflection,
    hydrometer: hydrometer,
    capBattery: capBattery, capRecharge: capRecharge, tankStatic: tankStatic,
    heater: heater, windingTemp: windingTemp, thermistorNTC: thermistorNTC,
    rlBreak: rlBreak, thinLens: thinLens, beamFromSource: beamFromSource,
    bohr: bohr, hydrogenLine: hydrogenLine, compton: compton, fission: fission,
    selftest: selftest,
  };
}));
