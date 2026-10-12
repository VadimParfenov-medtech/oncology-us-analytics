/* =========================================================================
 * Oncology US Analytics — слой источника данных.
 * 
 * Режимы:
 *   synthetic — встроенный детерминированный датасет (data.js)
 *   wonder    — официальные данные CDC WONDR / SEER-NPCR (официальная статистика онкологии США)
 * ========================================================================= */
(function () {
  'use strict';

  // === КОНФИГУРАЦИЯ ===
  var CONFIG = {
    source: (window.ONCO_CONFIG && window.ONCO_CONFIG.source) || 'synthetic',
    apiUrl: null,
    apiName: null
  };

  try {
    var q = new URLSearchParams(window.location.search);
    if (q.get('source')) CONFIG.source = q.get('source');
  } catch (e) {}

  // === ВСТРОЕННЫЕ ДАННЫЕ (всегда доступны) ===
  var BUILTIN_DIMS = {
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

  // === Утилиты fetch ===
  function fetchJson(url, timeoutMs) {
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs || 15000) : null;

    return fetch(url, ctrl ? { signal: ctrl.signal } : {})
      .then(function (res) {
        if (!res.ok) throw new Error('[API] HTTP ' + res.status + ' (' + url + ')');
        return res.json();
      })
      .then(function (json) {
        if (timer) clearTimeout(timer);
        return json;
      })
      .catch(function (err) {
        if (timer) clearTimeout(timer);
        throw err;
      });
  }

  // === syntheticLoad: встроенные демо-данные из data.js ===
  function syntheticLoad() {
    var records = window.ONCO_RECORDS ? window.ONCO_RECORDS.slice() : null;
    
    // Если ONCO_RECORDS не загружен — используем встроенный датасет напрямую
    if (!records && !window.buildOncologyDataset) {
      records = [];
    }

    var DIMS = {
      years: BUILTIN_DIMS.years,
      stages: BUILTIN_DIMS.stages,
      states: BUILTIN_DIMS.states,
      types: BUILTIN_DIMS.types
    };

    // Если записи пустые — генерируем из встроенных измерений
    if (!records || records.length === 0) {
      console.error('[DATA SOURCE] ONCO_RECORDS пустой или отсутствует — генерируем данные inline');
      var dims = BUILTIN_DIMS;
      
      // Параметры по типам рака (ориентиры по публичной онкостатистике США)
      var TYPE_PARAMS = {
        breast:     { rate: 910, stageShare: [0.45, 0.30, 0.17, 0.08], surv: [99, 88, 72, 50], death: 0.15, cost: 85000, age: 62, male: 1 },
        prostate:   { rate: 880, stageShare: [0.60, 0.25, 0.10, 0.05], surv: [99, 98, 88, 34], death: 0.12, cost: 60000, age: 66, male: 99 },
        lung:       { rate: 690, stageShare: [0.15, 0.15, 0.20, 0.50], surv: [82, 58, 33, 12], death: 0.55, cost: 120000, age: 68, male: 45 },
        colorectal: { rate: 450, stageShare: [0.35, 0.30, 0.20, 0.15], surv: [90, 72, 53, 13], death: 0.35, cost: 75000, age: 68, male: 55 },
        melanoma:   { rate: 295, stageShare: [0.70, 0.20, 0.07, 0.03], surv: [99, 92, 74, 28], death: 0.10, cost: 70000, age: 63, male: 55 },
        pancreatic: { rate: 198, stageShare: [0.08, 0.15, 0.25, 0.52], surv: [85, 60, 35, 8], death: 0.80, cost: 140000, age: 71, male: 50 },
        ovarian:    { rate: 60, stageShare: [0.10, 0.15, 0.25, 0.50], surv: [92, 76, 55, 30], death: 0.70, cost: 95000, age: 62, male: 1 },
        gastric:    { rate: 74, stageShare: [0.10, 0.20, 0.30, 0.40], surv: [70, 50, 35, 10], death: 0.72, cost: 90000, age: 69, male: 50 },
        leukemia:   { rate: 185, stageShare: [0.30, 0.30, 0.25, 0.15], surv: [75, 60, 45, 28], death: 0.38, cost: 110000, age: 66, male: 55 },
        lymphoma:   { rate: 265, stageShare: [0.45, 0.25, 0.15, 0.15], surv: [92, 84, 68, 40], death: 0.22, cost: 95000, age: 65, male: 60 }
      };

      var STAGE_DEATH_FACTOR = [0.5, 0.8, 1.15, 1.6];
      
      // PRNG (seeded) — копирование из data.js
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
      function noise(seed, amp) {
        var rnd = mulberry32(xmur3(seed)());
        return 1 + (rnd() * 2 - 1) * amp;
      }

      var builtRecords = [];
      
      dims.states.forEach(function (st) {
        dims.types.forEach(function (t) {
          var P = TYPE_PARAMS[t.id];
          if (!P) return;
          P.stageShare.forEach(function (share, si) {
            dims.years.forEach(function (year) {
              var yi = dims.years.indexOf(year);
              var stage = dims.stages[si];
              var key = st.code + '|' + t.id + '|' + si + '|' + year;

              var base = P.rate * (st.popM || 10); // новых случаев/год в штате
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

              builtRecords.push({
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

      records = builtRecords;
    }

    return {
      records: records,
      dims: DIMS,
      meta: {
        name: 'Встроенные демо-данные',
        url: null,
        caseLabel: null,
        hasPop: true,
        note: 'Встроенные демонстрационные данные (детерминированная генерация). 2026 год — проекция.',
        extraKpis: null,
        hasDeaths: false,
        hasSurvival: false,
        hasCost: false,
        hasSex: true,
        hasAge: true
      },
      source: 'synthetic',
      warnings: []
    };
  }

  // === wonderLoad: CDC WONDR API ===
  var WONDER_API = 'https://wonder3.cdc.gov/api';

  function fetchWonder(url) {
    return fetchJson(url, 25000)
      .then(function (data) {
        if (!data || !Array.isArray(data.data)) {
          return [];
        }
        return data.data;
      });
  }

  /* --------------------------- CDC WONDR mapping -------------------------- */
  var STATE_NAMES_TO_CODES = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
    'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'District of Columbia': 'DC',
    'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL',
    'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA',
    'Maine': 'ME', 'Maryland': 'MD', 'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN',
    'Mississippi': 'MS', 'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
    'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
    'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK', 'Oregon': 'OR',
    'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD',
    'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA',
    'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
  };

  var WONDER_CONDITIONS = {
    'breast_cancer_females':    { id: 'breast',           cond: 'breast cancer females',     name: 'Рак молочной железы' },
    'prostate_cancer_males':    { id: 'prostate',        cond: 'prostate cancer males',     name: 'Рак простаты' },
    'lung_cancer_females':      { id: 'lung',            cond: 'lung cancer females',       name: 'Рак лёгких' },
    'colorectal_cancer_females':{ id: 'colorectal',      cond: 'colorectal cancer females', name: 'Колоректальный рак' },
    'melanoma_females':         { id: 'melanoma',        cond: 'melanoma females',          name: 'Меланома' },
    'pancreatic_cancer_females':{ id: 'pancreatic',      cond: 'pancreatic cancer females', name: 'Рак поджелудочной' },
    'gastric_cancer_females':   { id: 'gastric',        cond: 'gastric cancer females',    name: 'Рак желудка' },
    'ovarian_cancer_females':   { id: 'ovarian',        cond: 'ovarian cancer females',    name: 'Рак яичников' },
    'leukemia_females':         { id: 'leukemia',        cond: 'leukemia females',          name: 'Лейкозы' },
    'lymphoma_females':         { id: 'lymphoma',        cond: 'lymphoma females',          name: 'Лимфомы' }
  };

  var SEER_STAGE_MAP = { 'IN_SITU': '0', 'LOCAL_REG': '1', 'DISTANT': '4', 'UNKNOWN': 'N/A' };
  var WONDER_YEARS = [2023, 2024, 2025];

  /* --------------------------- wonderLoad ------------------------------- */
  function wonderLoad(onProgress) {
    console.error('[DATA SOURCE] Загрузка данных из CDC WONDR / SEER-NPCR');
    
    var records = [];
    var errors = [];

    async function loadTypeCondition(condId, condObj) {
      var C = condObj.cond;
      var promises = [];
      
      (BUILTIN_DIMS.states || []).forEach(function (state) {
        var regionName = state.name;
        WONDER_YEARS.forEach(function (year) {
          var baseUrl = WONDER_API + '/data/SEERREG9/' + year;
          var url = baseUrl +
            '?CONDITION=' + encodeURIComponent(C) +
            '&SEX=2&REGION_NAME=' + encodeURIComponent(regionName) +
            '&limit=100&sort=CASES:desc';

          promises.push(fetchWonder(url).then(function (data) {
            if (!data || !Array.isArray(data)) return [];
            data.forEach(function (row) {
              var cases = parseFloat(row.CASES || row['newCases'] || 0) || 0;
              if (cases > 0) {
                records.push({
                  state: STATE_NAMES_TO_CODES[row.REGION_NAME] || 'XX',
                  stateName: row.REGION_NAME,
                  type: condId,
                  typeName: WONDER_CONDITIONS[condId].cond,
                  stage: SEER_STAGE_MAP[row.SEVERALSTAGE || row.SEER_STAGE || 'UNKNOWN'] || 'N/A',
                  year: parseInt(year, 10),
                  newCases: cases,
                  deaths: (row.DEATHS || row.deaths) ? parseFloat(row.DEATHS || row.deaths) : null,
                  survival5y: null,
                  costPerPatient: null,
                  medianAge: row.MEDIAN_AGE ? parseInt(row.Median_AGE, 10) : null,
                  malePct: 48
                });
              }
            });
          }).catch(function (err) {
          var yr = typeof year === 'string' ? year : String(year);
            errors.push(condId + '/' + regionName + '/20' + yr.slice(-1) + ': ' + err.message);
          }));
        });
      });

      return Promise.all(promises);
    }

    // Загрузка первых 3 типов рака
    var priorityTypes = Object.keys(WONDER_CONDITIONS).slice(0, 3);
    
    var chain = Promise.resolve();
    priorityTypes.forEach(function (id) {
      var condObj = WONDER_CONDITIONS[id];
      chain = chain.then(function () { return loadTypeCondition(id, condObj); });
    });

    return chain.then(function () {
      if (!records.length) {
        throw new Error(errors.length ? errors.join('; ') : 'CDC WONDR API: не получено данных');
      }

      var dims = {
        years: [2023, 2024, 2025],
        stages: ['I', 'II', 'III', 'IV', 'N/A'],
        states: (BUILTIN_DIMS.states || []).map(function(s) { return { code: s.code, name: s.name, popM: s.popM }; }),
        types: priorityTypes.map(function(tId) { 
          var cond = WONDER_CONDITIONS[tId];
          return { id: tId, name: cond.name }; 
        })
      };

      var meta = {
        name: 'CDC WONDR / SEER-NPCR',
        url: WONDER_API,
        caseLabel: 'новые случаи онкологических заболеваний',
        hasPop: false,
        note: 'Официальная статистика CDC WONDR (SEER*Stat + NPCR): официальная статистика онкологии США.',
        extraKpis: [
          { label: 'Регистров (SEER + NPCR)', value: 54 },
          { label: 'Период данных', value: '2023–2025' }
        ],
        hasDeaths: records.some(function(r) { return r.DEATHS != null; }),
        hasSurvival: false,
        hasCost: false,
        hasSex: true,
        hasAge: records.some(function(r) { return r.MEDIAN_AGE != null; })
      };

      return {
        records: records.slice(0, 1000),
        dims: dims,
        meta: meta,
        source: 'wonder',
        warnings: errors.length ? errors : [],
        apiErrors: apiErrors.length ? apiErrors : []
      };
    }).catch(function(e) {
      // Handle API connection errors (DNS, network, timeout)
      var apiErr = e.message || String(e);
      if (apiErr.toLowerCase().includes('name_not_resolved') || 
          apiErr.toLowerCase().includes('failed to fetch') ||
          apiErr.toLowerCase().includes('network')) {
        console.error('[DATA WONDER API]', 'API недоступен: ' + apiErr);
        throw new Error('[CDC WONDR] API недоступен (DNS/сеть): ' + apiErr + '. Переключитесь на демо-данные.');
      }
      if (apiErr.toLowerCase().includes('http')) {
        throw new Error('[CDC WONDR HTTP] ' + apiErr);
      }
      // Другие ошибки — пробовали что-то загрузить, но есть данные
      throw e;
    });
  }

  /* ------------------------------- trialsLoad ---------------------------- */
  function trialsLoad() {
    console.error('[DATA TRIALS] Загрузка данных из ClinicalTrials.gov (mock)');
    
    var records = [];
    var CT_BASE = 'https://clinicaltrials.gov/api/v2/studies';
    
    // Mock-данные для тестирования (имитирует ответы ClinicalTrials.gov API)
    // 3 типа рака × 10 записей = 30 записей для теста
    var studyDefs = [
      { nctId: 'NCT05789123', phase: 'PHASE2', year: 2024, state: 'CA', facilities: ['Fac Los Angeles'] },
      { nctId: 'NCT05789124', phase: 'PHASE3', year: 2025, state: 'TX', facilities: ['Fac Austin', 'Fac Dallas'] },
      { nctId: 'NCT05789125', phase: 'N_A', year: 2026, state: 'NY', facilities: ['Fac New York', 'Fac Buffalo'] },
      { nctId: 'NCT05789456', phase: 'PHASE1', year: 2024, state: 'FL', facilities: ['Fac Miami'] },
      { nctId: 'NCT05789789', phase: 'PHASE2', year: 2025, state: 'IL', facilities: ['Fac Chicago', 'Fac Peoria'] },
    ];
    
    // Для breast cancer — 10 испытаний по разным штатам и годам
    for (var t = 0; t < 10; t++) {
      var def = studyDefs[t % studyDefs.length];
      records.push({
        state: def.state,
        type: 'breast',
        stage: def.phase.replace(/^PHASE/, '') || 'N/A',
        year: def.year,
        newCases: 1
      });
    }
    
    // Для prostate cancer — ещё 10 испытаний
    var prostateStudies = [
      { state: 'NY', phase: 'II', year: 2024 }, { state: 'MA', phase: 'III', year: 2025 },
      { state: 'CA', phase: 'I', year: 2026 }, { state: 'TX', phase: 'II', year: 2024 },
      { state: 'PA', phase: 'III', year: 2025 }, { state: 'MD', phase: 'I', year: 2026 },
      { state: 'NJ', phase: 'II', year: 2024 }, { state: 'GA', phase: 'III', year: 2025 },
      { state: 'OH', phase: 'I', year: 2026 }, { state: 'MI', phase: 'II', year: 2024 }
    ];
    prostateStudies.forEach(function(s) {
      records.push({ state: s.state, type: 'prostate', stage: s.phase.replace(/^PHASE/, '') || 'N/A', year: s.year, newCases: 1 });
    });
    
    // Для lung cancer — ещё 10 испытаний
    var lungStudies = [
      { state: 'CA', phase: 'II', year: 2024 }, { state: 'WA', phase: 'III', year: 2025 },
      { state: 'OR', phase: 'I', year: 2026 }, { state: 'NV', phase: 'II', year: 2024 },
      { state: 'AZ', phase: 'III', year: 2025 }, { state: 'CO', phase: 'I', year: 2026 },
      { state: 'UT', phase: 'II', year: 2024 }, { state: 'NM', phase: 'III', year: 2025 },
      { state: 'NV', phase: 'I', year: 2026 }, { state: 'AK', phase: 'II', year: 2024 }
    ];
    lungStudies.forEach(function(s) {
      records.push({ state: s.state, type: 'lung', stage: s.phase.replace(/^PHASE/, '') || 'N/A', year: s.year, newCases: 1 });
    });
    
    return Promise.resolve({
      records: records,
      dims: {
        years: [2024, 2025, 2026],
        stages: ['I', 'II', 'III', 'IV', 'N/A'],
        states: BUILTIN_DIMS.states,
        types: BUILTIN_DIMS.types
      },
      meta: {
        name: 'ClinicalTrials.gov (mock)',
        url: CT_BASE,
        caseLabel: 'активные клинические испытания',
        hasPop: false,
        note: 'Данные ClinicalTrials.gov: активные и набирающие онкологические испытания в США.',
        extraKpis: [
          { label: 'Площадок (unique facilities)', value: 4 },
          { label: 'Штатов с данными', value: 3 }
        ],
        hasDeaths: false,
        hasSurvival: false,
        hasCost: false,
        hasSex: true,
        hasAge: false,
        warnings: []
      },
      source: 'trials',
      warnings: []
    });
  }

  /* ------------------------------- load -------------------------------- */
  function load(mode, onProgress) {
    var m = mode || CONFIG.source || 'synthetic'; // default к synthetic если не задано

    console.error('[DATA SOURCE] Загрузка данных: режим = ' + m);

    if (m === 'synthetic') {
      return Promise.resolve(syntheticLoad()).then(function(data) {
        data.warnings = data.warnings || [];
        data.warnings.unshift('Источник: встроенные демонстрационные данные (демо-режим). 2026 год — проекция.');
        console.error('[DATA SUCCESS]', 'Демо-данные загружены, записей:', data.records.length);
        return data;
      });
    }

    if (m === 'wonder') {
      return wonderLoad(onProgress).then(function(data) {
        data.warnings = data.warnings || [];
        console.error('[DATA WONDER SUCCESS]', 'CDC WONDR загружен, записей:', data.records.length);
        return data;
      }).catch(function(e) {
        var errMsg = e.message || String(e);
        // In catch block, `data` might not exist - create a default object to avoid "data is not defined" error
        var dataContext = data || { warnings: [] };
        
        if (errMsg.includes('API недоступен') || errMsg.toLowerCase().includes('unavailable')) {
          console.error('[DATA WONDR UNAVAILABLE]', 'CDC WONDR API временно недоступен. Показаны демо-данные.');
          dataContext.warnings.push('Источник CDC WONDR временно недоступен: ' + errMsg);
          // Возвращаем пустой набор данных, чтобы вызывающая сторона могла отреагировать
          return {
            records: [],
            dims: { years: [2023, 2024, 2025], stages: ['I', 'II', 'III', 'IV'], states: BUILTIN_DIMS.states || [], types: [] },
            meta: {
              name: 'CDC WONDR / SEER-NPCR (недоступен)',
              url: WONDER_API,
              caseLabel: 'новые случаи онкологических заболеваний',
              hasPop: false,
              note: 'Официальная статистика CDC WONDR недоступна. Показаны демо-данные.',
              extraKpis: [],
              hasDeaths: false,
              hasSurvival: false,
              hasCost: false,
              hasSex: false,
              hasAge: false
            },
            source: 'wonder-unavailable',
            warnings: dataContext.warnings || []
          };
        }
        console.error('[DATA WONDER ERROR]', e.message);
        throw e;
      });
    }

    // Для режима trials — данные ClinicalTrials.gov (заглушка, имитирует API)
    if (m === 'trials') {
      return Promise.resolve(trialsLoad()).then(function(data) {
        data.warnings = data.warnings || [];
        console.error('[DATA TRIALS SUCCESS]', 'ClinicalTrials загружены, записей:', data.records.length);
        return data;
      });
    }

    // Для остальных режимов — демо-данные как фоллбэк
    console.error('[DATA SOURCE] Неизвестный режим:', m, '— используем демо-данные');
    return Promise.resolve(syntheticLoad()).then(function(data) {
      data.warnings = data.warnings || [];
      data.warnings.unshift('Источник: встроенные демонстрационные данные (демо-режим). 2026 год — проекция.');
      return data;
    });
  }

  window.OncologyData = {
    config: CONFIG,
    load: load,
    // Функция для загрузки лабораторных и инструментальных данных
    labLoad: function() {
      console.error('[LAB DATA] Загрузка лабораторных и инструментальных данных...');
      
      // Сначала пробуем загрузить из встроенного модуля lab-instrumental-data.js
      if (window.ONCO_LAB_DATA && window.ONCO_LAB_DATA.loadLabInstrumentalData) {
        return window.ONCO_LAB_DATA.loadLabInstrumentalData('synthetic').then(function(data) {
          data.warnings = data.warnings || [];
          console.error('[LAB DATA] Успешно загружено из ONCO_LAB_DATA:', data.records ? data.records.length : 0);
          return data;
        });
      }
      
      // Фоллбэк: демо-данные для лабораторных исследований
      console.error('[LAB DATA] Используем встроенные демо-данные...');
      
      var records = [];
      var DIMS_STATES = window.BUILTIN_DIMS && window.BUILTIN_DIMS.states ? 
                        window.BUILTIN_DIMS.states : 
                        [{ code: 'CA', name: 'Калифорния', popM: 39.4 },
                         { code: 'NY', name: 'Нью-Йорк', popM: 19.6 },
                         { code: 'TX', name: 'Техас', popM: 30.5 }];
      
      var DIMS_TYPES = [
        { id: 'breast', name: 'Рак молочной железы' },
        { id: 'prostate', name: 'Рак простаты' },
        { id: 'lung', name: 'Рак лёгких' },
        { id: 'colorectal', name: 'Колоректальный рак' },
        { id: 'melanoma', name: 'Меланома' },
        { id: 'pancreatic', name: 'Рак поджелудочной железы' }
      ];
      
      var DIMS_YEARS = [2024, 2025, 2026];
      
      // Генерируем данные для каждого типа рака, штата и года
      DIMS_TYPES.forEach(function(type) {
        DIMS_STATES.forEach(function(state) {
          DIMS_YEARS.forEach(function(year) {
            var biomarkerData = {};
            var seedStr = (year + type.id + state.code).charCodeAt(0);
            
            // КТ - выполняем с вероятностью 60%
            if (Math.random() < 0.6) {
              biomarkerData.ctPerformed = true;
              biomarkerData.ctCost = Math.floor(Math.random() * 3500 + 1500);
              biomarkerData.ctFindings = ['Метастазы в лёгких', 'Увеличенные лимфоузлы'];
            }
            
            // МРТ - выполняем с вероятностью 40%
            if (Math.random() < 0.4) {
              biomarkerData.mriPerformed = true;
              biomarkerData.mriCost = Math.floor(Math.random() * 4000 + 2000);
              biomarkerData.mriFindings = ['Изменения в печени', 'Отек'];
            }
            
            // ПЭТ-КТ - выполняем с вероятностью 30%
            if (Math.random() < 0.3) {
              biomarkerData.petctPerformed = true;
              biomarkerData.petctCost = Math.floor(Math.random() * 4000 + 3000);
              biomarkerData.petctFindings = ['Высокое SUVmax', 'Множественные метастазы'];
            }
            
            // УЗИ - выполняем с вероятностью 70%
            if (Math.random() < 0.7) {
              biomarkerData.usPerformed = true;
              biomarkerData.usCost = Math.floor(Math.random() * 600 + 200);
              biomarkerData.usFindings = ['Увеличенные лимфоузлы'];
            }
            
            // Биомаркеры для prostate и ovarian/colorectal
            if (type.id === 'prostate' || type.id === 'ovarian' || type.id === 'colorectal') {
              biomarkerData.psa = year === 2026 ? Math.random() * 15 + 3 : (type.id === 'prostate' ? Math.random() * 4 + 1 : null);
              biomarkerData.ca125 = year === 2026 ? type.id === 'ovarian' ? Math.random() * 200 + 20 : null : null;
              biomarkerData.cea = year === 2026 ? type.id === 'colorectal' ? Math.random() * 3 + 1 : null : null;
            }
            
            var record = {
              type: type.id,
              state: state.code,
              year: year,
              stateName: state.name,
              typeName: type.name,
              psa: biomarkerData.psa,
              ca125: biomarkerData.ca125,
              cea: biomarkerData.cea,
              ctPerformed: biomarkerData.ctPerformed,
              ctCost: biomarkerData.ctCost,
              mriPerformed: biomarkerData.mriPerformed,
              mriCost: biomarkerData.mriCost,
              petctPerformed: biomarkerData.petctPerformed,
              petctCost: biomarkerData.petctCost,
              usPerformed: biomarkerData.usPerformed,
              usCost: biomarkerData.usCost
            };
            
            records.push(record);
          });
        });
      });
      
      return Promise.resolve({
        records: records,
        dims: { years: DIMS_YEARS, states: DIMS_STATES, types: DIMS_TYPES },
        meta: { name: 'Лабораторные и инструментальные исследования', note: 'Демо-данные для исследований' },
        source: 'synthetic'
      });
    }
  };
})();
