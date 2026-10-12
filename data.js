/* =========================================================================
 * Oncology US Analytics — детерминированный генератор синтетического
 * датасета. Одна и та же запись всегда генерируется одинаково
 * (seeded PRNG на ключе штат|тип|стадия|год), поэтому данные стабильны
 * между перезагрузками страницы.
 *
 * Зависимость: data.json (каталог измерений). При загрузке через file://
 * fetch может быть недоступен — тогда используется встроенный каталог,
 * идентичный data.json.
 * ========================================================================= */
(function () {
  'use strict';

  var EMBEDDED_DIMENSIONS = {
    years: [2024, 2025, 2026],
    stages: ['I', 'II', 'III', 'IV'],
    states: [
      { code: 'AL', name: 'Алабама', popM: 5.1 },
      { code: 'AK', name: 'Аляска', popM: 0.73 },
      { code: 'AZ', name: 'Аризона', popM: 7.4 },
      { code: 'AR', name: 'Арканзас', popM: 3.0 },
      { code: 'CA', name: 'Калифорния', popM: 39.4 },
      { code: 'CO', name: 'Колорадо', popM: 5.9 },
      { code: 'CT', name: 'Коннектикут', popM: 3.6 },
      { code: 'DE', name: 'Делавэр', popM: 1.03 },
      { code: 'DC', name: 'Вашингтон (округ)', popM: 0.68 },
      { code: 'FL', name: 'Флорида', popM: 22.6 },
      { code: 'GA', name: 'Джорджия', popM: 11.1 },
      { code: 'HI', name: 'Гавайи', popM: 1.44 },
      { code: 'ID', name: 'Айдахо', popM: 1.96 },
      { code: 'IL', name: 'Иллинойс', popM: 12.5 },
      { code: 'IN', name: 'Индиана', popM: 6.9 },
      { code: 'IA', name: 'Айова', popM: 3.2 },
      { code: 'KS', name: 'Канзас', popM: 2.9 },
      { code: 'KY', name: 'Кентукки', popM: 4.5 },
      { code: 'LA', name: 'Луизиана', popM: 4.6 },
      { code: 'ME', name: 'Мэн', popM: 1.4 },
      { code: 'MD', name: 'Мэриленд', popM: 6.2 },
      { code: 'MA', name: 'Массачусетс', popM: 7.0 },
      { code: 'MI', name: 'Мичиган', popM: 10.0 },
      { code: 'MN', name: 'Миннесота', popM: 5.7 },
      { code: 'MS', name: 'Миссисипи', popM: 2.9 },
      { code: 'MO', name: 'Миссури', popM: 6.2 },
      { code: 'MT', name: 'Монтана', popM: 1.1 },
      { code: 'NE', name: 'Небраска', popM: 1.98 },
      { code: 'NV', name: 'Невада', popM: 3.2 },
      { code: 'NH', name: 'Нью-Гэмпшир', popM: 1.4 },
      { code: 'NJ', name: 'Нью-Джерси', popM: 9.3 },
      { code: 'NM', name: 'Нью-Мексико', popM: 2.11 },
      { code: 'NY', name: 'Нью-Йорк', popM: 19.6 },
      { code: 'NC', name: 'Северная Каролина', popM: 11.0 },
      { code: 'ND', name: 'Северная Дакота', popM: 0.78 },
      { code: 'OH', name: 'Огайо', popM: 11.8 },
      { code: 'OK', name: 'Оклахома', popM: 4.1 },
      { code: 'OR', name: 'Орегон', popM: 4.2 },
      { code: 'PA', name: 'Пенсильвания', popM: 13.0 },
      { code: 'RI', name: 'Род-Айленд', popM: 1.1 },
      { code: 'SC', name: 'Южная Каролина', popM: 5.4 },
      { code: 'SD', name: 'Южная Дакота', popM: 0.92 },
      { code: 'TN', name: 'Теннесси', popM: 7.1 },
      { code: 'TX', name: 'Техас', popM: 30.5 },
      { code: 'UT', name: 'Юта', popM: 3.4 },
      { code: 'VT', name: 'Вермонт', popM: 0.65 },
      { code: 'VA', name: 'Вирджиния', popM: 8.7 },
      { code: 'WA', name: 'Вашингтон', popM: 7.8 },
      { code: 'WV', name: 'Западная Вирджиния', popM: 1.77 },
      { code: 'WI', name: 'Висконсин', popM: 5.9 },
      { code: 'WY', name: 'Вайоминг', popM: 0.58 }
    ],
    types: [
      { id: 'breast', name: 'Рак молочной железы' },
      { id: 'prostate', name: 'Рак простаты' },
      { id: 'lung', name: 'Рак лёгких' },
      { id: 'colorectal', name: 'Колоректальный рак' },
      { id: 'melanoma', name: 'Меланома' },
      { id: 'pancreatic', name: 'Рак поджелудочной железы' },
      { id: 'ovarian', name: 'Рак яичников' },
      { id: 'gastric', name: 'Рак желудка' },
      { id: 'leukemia', name: 'Лейкозы' },
      { id: 'lymphoma', name: 'Лимфомы' }
    ]
  };

  /* ------------------------------------------------------------------ *
   * Параметры по типам рака (ориентиры по публичной онкостатистике США) *
   *  rate       — новых случаев на 1 млн населения в год                *
   *  stageShare — доля стадий [I, II, III, IV]                          *
   *  surv       — 5-летняя выживаемость, % [I, II, III, IV]             *
   *  death      — грубый коэффициент смертности от новых случаев        *
   *  cost       — средняя годовая стоимость лечения, $/пациент          *
   *  age        — медианный возраст при диагностике                     *
   *  male       — доля мужчин, %                                        *
   * ------------------------------------------------------------------ */
  var TYPE_PARAMS = {
    breast:     { rate: 910, stageShare: [0.45, 0.30, 0.17, 0.08], surv: [99, 88, 72, 50], death: 0.15, cost: 85000,  age: 62, male: 1 },
    prostate:   { rate: 880, stageShare: [0.60, 0.25, 0.10, 0.05], surv: [99, 98, 88, 34], death: 0.12, cost: 60000,  age: 66, male: 99 },
    lung:       { rate: 690, stageShare: [0.15, 0.15, 0.20, 0.50], surv: [82, 58, 33, 12], death: 0.55, cost: 120000, age: 68, male: 45 },
    colorectal: { rate: 450, stageShare: [0.35, 0.30, 0.20, 0.15], surv: [90, 72, 53, 13], death: 0.35, cost: 75000,  age: 68, male: 55 },
    melanoma:   { rate: 295, stageShare: [0.70, 0.20, 0.07, 0.03], surv: [99, 92, 74, 28], death: 0.10, cost: 70000,  age: 63, male: 55 },
    pancreatic: { rate: 198, stageShare: [0.08, 0.15, 0.25, 0.52], surv: [85, 60, 35, 8],  death: 0.80, cost: 140000, age: 71, male: 50 },
    ovarian:    { rate: 60,  stageShare: [0.10, 0.15, 0.25, 0.50], surv: [92, 76, 55, 30], death: 0.70, cost: 95000,  age: 62, male: 1 },
    gastric:    { rate: 74,  stageShare: [0.10, 0.20, 0.30, 0.40], surv: [70, 50, 35, 10], death: 0.72, cost: 90000,  age: 69, male: 50 },
    leukemia:   { rate: 185, stageShare: [0.30, 0.30, 0.25, 0.15], surv: [75, 60, 45, 28], death: 0.38, cost: 110000, age: 66, male: 55 },
    lymphoma:   { rate: 265, stageShare: [0.45, 0.25, 0.15, 0.15], surv: [92, 84, 68, 40], death: 0.22, cost: 95000,  age: 65, male: 60 }
  };

  var STAGE_DEATH_FACTOR = [0.5, 0.8, 1.15, 1.6];

  /* --------------------------- PRNG (seeded) ------------------------ */
  function xmur3(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /* Мультипликативный шум: 1 ± amp, детерминированный по seed */
  function noise(seed, amp) {
    var rnd = mulberry32(xmur3(seed)());
    return 1 + (rnd() * 2 - 1) * amp;
  }

  /* --------------------------- Генерация ---------------------------- */
  function buildDataset(dims) {
    dims = dims || EMBEDDED_DIMENSIONS;
    var records = [];
    var years = dims.years || [2024, 2025, 2026];

    dims.states.forEach(function (st) {
      dims.types.forEach(function (t) {
        var P = TYPE_PARAMS[t.id];
        if (!P) return;
        P.stageShare.forEach(function (share, si) {
          years.forEach(function (year) {
            var yi = years.indexOf(year);
            var stage = dims.stages[si];
            var key = st.code + '|' + t.id + '|' + si + '|' + year;

            var base = P.rate * st.popM; // новых случаев/год в штате
            var growth = Math.pow(1.02, yi); // рост заболеваемости ~2%/год

            var newCases = Math.max(
              1,
              Math.round(base * share * growth * noise(key + ':cases', 0.05))
            );

            var surv = P.surv[si] + yi * 0.6 + (noise(key + ':surv', 0.03) - 1) * P.surv[si];
            var survival5y = Math.min(99.5, Math.round(surv * 10) / 10);

            var deaths = Math.max(
              0,
              Math.round(newCases * P.death * STAGE_DEATH_FACTOR[si] * noise(key + ':death', 0.10))
            );

            var cost = P.cost * Math.pow(1.035, yi) * noise(key + ':cost', 0.06);
            var costPerPatient = Math.round(cost / 100) * 100;

            var medianAge = Math.round(P.age + (noise(key + ':age', 0.04) - 1) * P.age);
            var malePct = Math.max(0, Math.min(100, Math.round(P.male + (noise(key + ':male', 0.06) - 1) * P.male)));

            records.push({
              state: st.code,
              stateName: st.name,
              type: t.id,
              typeName: t.name,
              stage: stage,
              year: year,
              newCases: newCases,
              deaths: deaths,
              survival5y: survival5y,
              costPerPatient: costPerPatient,
              medianAge: medianAge,
              malePct: malePct
            });
          });
        });
      });
    });
    return records;
  }

  /* ---------------------------- Экспорт ----------------------------- */
  window.ONCO_DIMENSIONS = EMBEDDED_DIMENSIONS;
  window.buildOncologyDataset = buildDataset;

  /* Ленивая генерация: датасет строится при первом обращении, а не при
     разборе скрипта — не блокирует загрузку страницы. Значения те же
     (генерация детерминирована), строится один раз и кэшируется. */
  var _records = null;
  window.getOncologyRecords = function () {
    if (!_records) _records = buildDataset(EMBEDDED_DIMENSIONS);
    return _records;
  };
  Object.defineProperty(window, 'ONCO_RECORDS', {
    configurable: true,
    enumerable: true,
    get: function () { return window.getOncologyRecords(); }
  });
})();
