/* Данные каркаса страниц. Машинерия — assets/shell.js. */
'use strict';
(function () {
  const me = document.currentScript;
  const root = (me && me.dataset.root) || './';
  buildSiteShell({
    root,
    page: (me && me.dataset.page) || '',
    brand: 'Физика',
    logo: `
  <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
    <rect x="1" y="1" width="28" height="28" rx="6" fill="#4338ca"/>
    <text x="15" y="22" text-anchor="middle" font-size="16">⚛️</text>
  </svg>`,
    nav: [
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
        { h: 'problems', k: 'problems', t: 'Все разборы' },
        { h: 'p-kinematics', k: 'problems', t: '1–2. Кинематика и динамика точки' },
        { h: 'p-conserv', k: 'problems', t: '3. Законы сохранения' },
        { h: 'p-rigid', k: 'problems', t: '4. Твёрдое тело' },
        { h: 'p-osc', k: 'problems', t: '5. Колебания и волны' },
        { h: 'p-molecular', k: 'problems', t: '6. Молекулярная физика' },
        { h: 'p-thermo', k: 'problems', t: '7. Термодинамика' },
        { h: 'p-solid', k: 'problems', t: '8. Твёрдые тела и жидкости' },
        { h: 'p-electro', k: 'problems', t: '9. Электростатика' },
        { h: 'p-current', k: 'problems', t: '10. Постоянный ток' },
        { h: 'p-magnetism', k: 'problems', t: '11. Магнетизм и индукция' },
        { h: 'p-optics', k: 'problems', t: '12. Оптика' },
        { h: 'p-quantum', k: 'problems', t: '13. Квантовая и ядерная физика' },
      ] },
      { t: 'Опыты', h: 'lab', drop: [
        { h: 'lab', k: 'lab', t: 'Практикум: перечень работ и отчёт' },
        { h: 'errors', k: 'errors', t: 'Обработка результатов измерений' },
        { h: 'v-pendulum', k: 'v-pendulum', t: '1-18. Ускорение свободного падения' },
        { h: 'v-oberbeck', k: 'v-oberbeck', t: '1-16. Маятник Обербека' },
        { h: 'v-maxwell', k: 'v-maxwell', t: '1-13. Маятник Максвелла' },
        { h: 'v-torsion', k: 'v-torsion', t: '1-10. Крутильные колебания' },
        { h: 'v-resonance', k: 'v-resonance', t: '1-3. Механический резонанс' },
        { h: 'v-sound', k: 'v-sound', t: '1-8. Скорость звука' },
        { h: 'v-surface', k: 'v-surface', t: '1-7. Поверхностное натяжение' },
        { h: 'v-heat', k: 'v-heat', t: 'Теплоёмкости: Клеман — Дезорм' },
        { h: 'v-bridge', k: 'v-bridge', t: 'Мост постоянного тока' },
        { h: 'v-refraction', k: 'v-refraction', t: 'Показатель преломления' },
        { h: 'v-grating', k: 'v-grating', t: 'Дифракционная решётка' },
        { h: 'v-photo', k: 'v-photo', t: 'Постоянная Планка (фотоэффект)' },
      ] },
      { t: 'Источники', h: 'sources', drop: [
        { h: 'sources', k: 'sources', t: 'Литература курса' },
        { h: 'constants', k: 'sources', t: 'Справочник постоянных' },
      ] },
    ],
    footer: `<div>Учебный сайт по курсу общей физики (540 ч, экзамены в 1–4 семестрах) ·
    теория, схемы, живые модели и разобранные задачи</div>
    <div><a href="${root}constants">Справочник постоянных</a> ·
    <a href="${root}sources">Источники</a></div>`,
    markers: `<marker id="arrE" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
      <path d="M0,0 L10,4 L0,8 z" fill="#16161a"/></marker>
    <marker id="arrS" markerWidth="10" markerHeight="8" refX="1" refY="4" orient="auto">
      <path d="M10,0 L0,4 L10,8 z" fill="#16161a"/></marker>
    <marker id="arrR" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
      <path d="M0,0 L10,4 L0,8 z" fill="#b3382e"/></marker>
    <marker id="arrB" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
      <path d="M0,0 L10,4 L0,8 z" fill="#155e75"/></marker>
    <marker id="arrG" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
      <path d="M0,0 L10,4 L0,8 z" fill="#1a7f37"/></marker>`,
  });
})();
