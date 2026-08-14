/* Каркас страниц учебного сайта «Физика» (общий курс СПбГМТУ). */
'use strict';
(function () {
  const me = document.currentScript;
  const root = (me && me.dataset.root) || './';
  const page = (me && me.dataset.page) || '';
  const logoSvg = `
  <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
    <rect x="1" y="1" width="28" height="28" rx="6" fill="#4338ca"/>
    <text x="15" y="22" text-anchor="middle" font-size="16">⚛️</text>
  </svg>`;
  const nav = [
    { h: '', k: 'index', t: 'Обзор' },
    { t: 'Теория', h: 'theory', drop: [
      { h: 'theory', k: 'theory', t: 'Оглавление курса' },
      { h: 't-kinematics', k: 'theory', t: '1. Кинематика' },
      { h: 't-dynamics', k: 'theory', t: '2. Динамика точки' },
      { h: 't-rigid', k: 'theory', t: '3. Динамика вращения' },
      { h: 't-oscillations', k: 'theory', t: '4. Колебания и волны' },
      { h: 't-molecular', k: 'theory', t: '5. Молекулярная физика' },
      { h: 't-thermo', k: 'theory', t: '6. Термодинамика' },
      { h: 't-electrostatics', k: 'theory', t: '7. Электростатика' },
      { h: 't-current', k: 'theory', t: '8. Постоянный ток' },
      { h: 't-magnetism', k: 'theory', t: '9. Магнетизм и индукция' },
      { h: 't-optics', k: 'theory', t: '10. Оптика и излучение' },
      { h: 't-quantum', k: 'theory', t: '11. Квантовая физика' },
      { h: 't-solid', k: 'theory', t: '12. Твёрдое тело и ядро' },
    ] },
    { t: 'Задачи', h: 'problems', drop: [
      { h: 'problems', k: 'problems', t: 'Все задачи' },
      { h: 'p-mechanics', k: 'problems', t: 'Механика' },
      { h: 'p-thermo', k: 'problems', t: 'Молекулярная физика и термодинамика' },
      { h: 'p-electro', k: 'problems', t: 'Электричество и магнетизм' },
      { h: 'p-quantum', k: 'problems', t: 'Оптика и квантовая физика' },
    ] },
    { h: 'lab', k: 'lab', t: 'Практикум' },
    { t: 'Источники', h: 'sources', drop: [
      { h: 'sources', k: 'sources', t: 'Литература курса' },
      { h: 'constants', k: 'sources', t: 'Справочник постоянных' },
    ] },
  ];
  const navLink = (it) =>
    `<a href="${root}${it.h}" class="${page === it.k ? 'on' : ''}">${it.t}</a>`;
  const navHtml = nav.map((g) => {
    if (!g.drop) return navLink(g);
    const on = g.drop.some((it) => page === it.k) ? 'on' : '';
    return `<span class="nav-drop"><a href="${root}${g.h}" class="${on}">${g.t} ▾</a>`
      + `<span class="drop">${g.drop.map(navLink).join('')}</span></span>`;
  }).join('');
  const header = document.createElement('header');
  header.className = 'site';
  header.innerHTML = `<div class="wrap">
    <a class="logo" href="${root}">${logoSvg}<span>Физика</span></a>
    <nav class="top">${navHtml}</nav>
  </div>`;
  document.body.prepend(header);
  const onReady = (fn) => (document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', fn) : fn());
  const footer = document.createElement('footer');
  footer.className = 'site';
  footer.innerHTML = `<div class="wrap">
    <div>Учебный сайт по курсу общей физики (540 ч, экзамены в 1–4 семестрах) ·
    теория, схемы, живые модели и разобранные задачи</div>
    <div><a href="${root}constants">Справочник постоянных</a> ·
    <a href="${root}sources">Источники</a></div>
  </div>`;
  onReady(() => document.body.appendChild(footer));
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  defs.setAttribute('width', '0'); defs.setAttribute('height', '0');
  defs.style.position = 'absolute';
  defs.innerHTML = `<defs>
    <marker id="arrE" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
      <path d="M0,0 L10,4 L0,8 z" fill="#16161a"/></marker>
    <marker id="arrS" markerWidth="10" markerHeight="8" refX="1" refY="4" orient="auto">
      <path d="M10,0 L0,4 L10,8 z" fill="#16161a"/></marker>
    <marker id="arrR" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
      <path d="M0,0 L10,4 L0,8 z" fill="#b3382e"/></marker>
    <marker id="arrB" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
      <path d="M0,0 L10,4 L0,8 z" fill="#155e75"/></marker>
    <marker id="arrG" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
      <path d="M0,0 L10,4 L0,8 z" fill="#1a7f37"/></marker>
  </defs>`;
  onReady(() => document.body.appendChild(defs));
})();
