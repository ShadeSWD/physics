/* Общий слой клиентских скриптов сайта «Физика»: то, что нужно сразу нескольким
 * страницам, — выборка элемента по id, ускорение свободного падения, нормальный
 * шум, палитра по длине волны и цикл анимации, который сам замирает, когда
 * схема уходит с экрана.
 *
 * Подключается ПЕРЕД зависящими файлами: к главам с живыми моделями (anim-*.js)
 * — с атрибутом defer, к виртуальным работам — обычным тегом перед
 * virt-common.js. Помощники объявлены на верхнем уровне, без IIFE, поэтому
 * видны остальным скриптам страницы. */
'use strict';

/* элемент по id */
const $ = id => document.getElementById(id);

/* ускорение свободного падения, принятое в лабораторных работах, м/с² */
const G = 9.81;

/* нормальный шум со среднеквадратичным отклонением s (метод Бокса — Мюллера) */
function gauss(s) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* цвет по длине волны в пределах палитры схем — от синего к красному.
 * blueMax — верхняя граница синего участка: по умолчанию 480 нм (опыт Юнга),
 * в модели фотоэффекта — 500 нм, там ползунок захватывает и ультрафиолет. */
function colorOfWave(nm, blueMax) {
  if (nm < (blueMax || 480)) return '#155e75';
  if (nm < 570) return '#1a7f37';
  if (nm < 620) return '#6b6b74';
  return '#b3382e';
}

/* Цикл анимации главы на requestAnimationFrame. draw получает время в секундах:
 * animLoop — от запуска модели, animLoopStep — с прошлого кадра (не больше
 * 0,05 с, чтобы после возврата на вкладку модель не «прыгала»). Цикл замирает,
 * когда панель panel уходит с экрана, и просыпается, когда возвращается;
 * кнопка «Пуск/Пауза» останавливает его через setRunning.
 * Возвращает { setRunning }. */
function animLoop(panel, draw) { return animEngine(panel, draw, false); }
function animLoopStep(panel, draw) { return animEngine(panel, draw, true); }

function animEngine(panel, draw, byStep) {
  const t0 = performance.now();
  let last = t0, raf = null, visible = true, running = true;
  function frame(now) {
    raf = null;
    if (byStep) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      draw(dt);
    } else {
      draw((now - t0) / 1000);
    }
    if (visible && running) raf = requestAnimationFrame(frame);
  }
  function start() {
    if (raf || !visible || !running) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (e) {
      visible = e[0].isIntersecting;
      if (visible) start(); else stop();
    }, { threshold: 0.01 }).observe(panel);
  }
  start();
  return { setRunning: function (on) { running = on; if (on) start(); else stop(); } };
}
