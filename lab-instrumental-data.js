/* =========================================================================
 * Oncology US Analytics — Лабораторные и инструментальные исследования.
 * Детерминированная генерация данных о лабораторных тестах и 
 * инструментальных процедурах для каждого типа рака.
 * ========================================================================= */
(function () {
  'use strict';

  // === УТИЛИТЫ ===
  function $seed(seed) {
    var x = Math.imul(Math.min(1779033703 ^ seed.length, 2147483647) + 1, seed);
    return function () {
      x |= 0; x = (x + 0x6D2B79F5) | 0;
      var t = Math.imul(x ^ (x >>> 15), 1 | x);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function $rng(seed, min, max) { return min + ($seed(seed)() * (max - min)); }
  function $round(v, d) { return Math.round(v * Math.pow(10, d)) / Math.pow(10, d); }

  // === КОНФИГУРАЦИЯ ПАРАМЕТРОВ ИССЛЕДОВАНИЙ ПО ТИПАМ РАКА (месяцы между исследованиями) ===
  var TYPE_STUDY_PARAMS = {
    breast: {
      biomarkerFrequency: [1, 2, 6],
      ctFrequency: [3, 6, 12, 24],
      mriFrequency: [3, 6, 12, 24],
      ultrasoundFrequency: [3, 6, 12]
    },
    prostate: {
      biomarkerFrequency: [2, 3, 6],
      ctFrequency: [6, 12, 24],
      mriFrequency: [6, 12],
      ultrasoundFrequency: [2, 3, 6]
    },
    lung: {
      biomarkerFrequency: [1, 2, 3],
      ctFrequency: [1, 3, 6],
      mriFrequency: [6, 12],
      petctFrequency: [3, 6]
    },
    colorectal: {
      biomarkerFrequency: [2, 3, 6],
      ctFrequency: [3, 6, 12],
      mriFrequency: [6, 12, 24],
      ultrasoundFrequency: [3, 6]
    },
    melanoma: {
      biomarkerFrequency: [6, 12],
      ctFrequency: [3, 6, 12],
      mriFrequency: [6, 12],
      petctFrequency: [6, 12]
    },
    pancreatic: {
      biomarkerFrequency: [2, 3, 6],
      ctFrequency: [2, 4, 8],
      mriFrequency: [3, 6],
      ultrasoundFrequency: [1, 3]
    },
    ovarian: {
      biomarkerFrequency: [2, 3, 6],
      ctFrequency: [3, 6, 12],
      mriFrequency: [6, 12],
      ultrasoundFrequency: [3, 6]
    },
    gastric: {
      biomarkerFrequency: [3, 6],
      ctFrequency: [4, 8, 12],
      mriFrequency: [6, 12],
      petctFrequency: [6, 12]
    },
    leukemia: {
      biomarkerFrequency: [2, 4, 8],
      ctFrequency: [6, 12],
      mriFrequency: [12, 24],
      petctFrequency: [6, 12]
    },
    lymphoma: {
      biomarkerFrequency: [3, 6],
      ctFrequency: [2, 4, 8],
      mriFrequency: [6, 12],
      petctFrequency: [3, 6]
    }
  };

  // === ГЕНЕРАЦИЯ ДАННЫХ ДЛЯ ЛАБОРАТОРНЫХ ИССЛЕДОВАНИЙ (детерминировано!) ===
  function loadLabInstrumentalData(sourceMode) {
    console.error('[LAB DATA] Загрузка лабораторных и инструментальных данных...');

    var records = [];
    
    // Используем BUILTIN_DIMS из data-source.js если есть, иначе создадим минимальный набор
    var DIMS_STATES = window.BUILTIN_DIMS && window.BUILTIN_DIMS.states ? 
                      window.BUILTIN_DIMS.states : 
                      [{ code: 'CA', name: 'Калифорния', popM: 39.4 },
                       { code: 'NY', name: 'Нью-Йорк', popM: 19.6 },
                       { code: 'TX', name: 'Техас', popM: 30.5 }];

    // Типы рака - берём из OncologyData если есть, иначе демо-набор
    var DIMS_TYPES = window.OncologyData && window.OncologyData.dims && window.OncologyData.dims.types ?
                     window.OncologyData.dims.types : [
                       { id: 'breast', name: 'Рак молочной железы' },
                       { id: 'prostate', name: 'Рак простаты' },
                       { id: 'lung', name: 'Рак лёгких' },
                       { id: 'colorectal', name: 'Колоректальный рак' },
                       { id: 'melanoma', name: 'Меланома' },
                       { id: 'pancreatic', name: 'Рак поджелудочной железы' }
                     ];

    var DIMS_YEARS = [2024, 2025, 2026];

    console.error('[LAB DATA] Типы рака:', DIMS_TYPES.map(function(t) { return t.name; }).join(', '));
    console.error('[LAB DATA] Штаты:', DIMS_STATES.length);

    // Генерируем данные для каждого типа рака, штата и года (ДЕТЕРМИНИРОВАНО!)
    function generateRecord(typeId, stateCode, year) {
      var seedStr = (year + typeId + stateCode).charCodeAt(0);
      
      // Детерминированный PRNG для каждого типа/года/штата
      var rngState = $seed(seedStr);

      var biomarkerData = {};
      var params = TYPE_STUDY_PARAMS[typeId] || TYPE_STUDY_PARAMS.breast;
      
      // Генерируем данные для биомаркеров (если применимо)
      if (params && params.biomarkerFrequency) {
        biomarkerData.psa = null;
        biomarkerData.ca125 = null;
        biomarkerData.cea = null;
        
        var frequencyIdx = Math.floor(rngState() * params.biomarkerFrequency.length);
        biomarkerData.frequencyMonths = params.biomarkerFrequency[frequencyIdx];
      }

      // Генерируем данные для КТ (если применимо)
      if (params && params.ctFrequency && (typeId !== 'breast' || rngState() < 0.6)) {
        var ctFreqIdx = Math.floor(rngState() * params.ctFrequency.length);
        biomarkerData.ctFrequencyMonths = params.ctFrequency[ctFreqIdx];
        biomarkerData.ctPerformed = true;
      }

      // Генерируем данные для МРТ (если применимо)
      if (params && params.mriFrequency && (typeId !== 'breast' || rngState() < 0.4)) {
        var mriFreqIdx = Math.floor(rngState() * params.mriFrequency.length);
        biomarkerData.mriFrequencyMonths = params.mriFrequency[mriFreqIdx];
        biomarkerData.mriPerformed = true;
      }

      // Генерируем данные для ПЭТ-КТ (если применимо)
      if (params && params.petctFrequency && (typeId !== 'breast' || rngState() < 0.3)) {
        var petctFreqIdx = Math.floor(rngState() * params.petctFrequency.length);
        biomarkerData.petctFrequencyMonths = params.petctFrequency[petctFreqIdx];
        biomarkerData.petctPerformed = true;
      }

      // Генерируем данные для УЗИ (если применимо)
      if (params && params.ultrasoundFrequency && (typeId !== 'breast' || rngState() < 0.7)) {
        var usFreqIdx = Math.floor(rngState() * params.ultrasoundFrequency.length);
        biomarkerData.usFrequencyMonths = params.ultrasoundFrequency[usFreqIdx];
        biomarkerData.usPerformed = true;
      }

      // Базовые значения биомаркеров для 2024 года (детерминированные)
      function getBaseBiomarkerValue(typeId, year) {
        var baseYear = 2024;
        var delta = year - baseYear;
        
        switch(typeId) {
          case 'prostate': 
            return Math.round((1.5 + delta * 0.1) * 10) / 10; // PSA ~1.5-4.5 нг/мл
          case 'ovarian':
            return Math.round(20 + delta * 2) || 25; // CA-125 ~20-100 Ед/мл  
          case 'colorectal':
            return Math.round(3 + delta * 0.2) || 4; // CEA ~3-8 нг/мл
          default:
            return null;
        }
      }

      var baseYear = 2024;
      var yearDelta = year - baseYear;

      if (params && params.biomarkerFrequency) {
        biomarkerData.psa = getBaseBiomarkerValue(typeId, year);
        biomarkerData.ca125 = typeId === 'ovarian' ? (Math.round(20 + yearDelta * 2) || 25) : null;
        biomarkerData.cea = typeId === 'colorectal' ? (Math.round(3 + yearDelta * 0.2) || 4) : null;
      }

      return {
        psa: biomarkerData.psa,
        ca125: biomarkerData.ca125,
        cea: biomarkerData.cea,
        ctPerformed: biomarkerData.ctPerformed === true ? true : false,
        mriPerformed: biomarkerData.mriPerformed === true ? true : false,
        petctPerformed: biomarkerData.petctPerformed === true ? true : false,
        usPerformed: biomarkerData.usPerformed === true ? true : false
      };
    }

    // Генерируем агрегированные показатели для каждого типа рака, штата и года
    function generateAggregate(typeId, stateCode, year) {
      var seedStr = (year + typeId + stateCode).charCodeAt(0);
      return {
        ctCost: Math.round($rng(seedStr + 'ct', 1500, 5000)),
        mriCost: Math.round($rng(seedStr + 'mri', 2000, 6000)),
        petctCost: Math.round($rng(seedStr + 'pet', 4000, 8000)),
        usCost: Math.round($rng(seedStr + 'us', 200, 800))
      };
    }

    // Заполняем массивы
    var biomarkerRecords = [];
    var aggregateRecords = {};

    DIMS_TYPES.forEach(function(type) {
      DIMS_STATES.forEach(function(state) {
        DIMS_YEARS.forEach(function(year) {
          // Генерируем лабораторные данные
          var labData = generateRecord(type.id, state.code, year);
          
          // Генерируем агрегированные показатели
          var aggData = generateAggregate(type.id, state.code, year);

          biomarkerRecords.push({
            type: type.id,
            state: state.code,
            year: year,
            stateName: state.name,
            typeName: type.name,
            psangml: labData.psa,
            ca125: labData.ca125,
            ceangml: labData.cea,
            ctPerformed: labData.ctPerformed,
            mriPerformed: labData.mriPerformed,
            petctPerformed: labData.petctPerformed,
            usPerformed: labData.usPerformed
          });

          // Сохраняем агрегированные данные отдельно
          var key = year + '_' + type.id;
          aggregateRecords[key] = aggData;
        });
      });
    });

    // Объединяем данные
    var finalRecords = biomarkerRecords.map(function(record, idx) {
      var aggKey = record.year + '_' + record.type;
      var aggData = aggregateRecords[aggKey] || {};
      
      return {
        type: record.type,
        state: record.state,
        year: record.year,
        stateName: record.stateName,
        typeName: record.typeName,
        psangml: record.psangml,
        ca125: record.ca125,
        ceangml: record.ceangml,
        ctPerformed: record.ctPerformed,
        mriPerformed: record.mriPerformed,
        petctPerformed: record.petctPerformed,
        usPerformed: record.usPerformed,
        ctCost: aggData.ctCost || null,
        mriCost: aggData.mriCost || null,
        petctCost: aggData.petctCost || null,
        usCost: aggData.usCost || null,
        totalStudyCost: (aggData.ctCost || 0) + (aggData.mriCost || 0) + (aggData.petctCost || 0) + (aggData.usCost || 0)
      };
    });

    records = finalRecords;

    console.error('[LAB DATA] Загружено лабораторных исследований: ' + records.length);
    console.error('[LAB DATA] Пример записи:', JSON.stringify(records[0], null, 2));

    return {
      records: records,
      dims: {
        years: DIMS_YEARS,
        states: DIMS_STATES,
        types: DIMS_TYPES
      },
      meta: {
        name: 'Лабораторные и инструментальные исследования',
        note: 'Детерминированные данные о частоте лабораторных тестов, биомаркеров и визуализации (КТ, МРТ, ПЭТ-КТ, УЗИ) по типам рака.',
        hasBiomarker: true,
        hasInstrumental: true
      },
      source: sourceMode || 'synthetic'
    };
  };

  // === ИНИЦИАЛИЗАЦИЯ (обёрнуто в Promise.resolve для совместимости) ===
  
  // Запускаем инициализацию при загрузке скрипта
  if (typeof window !== 'undefined') {
    var initPromise = new Promise(function(resolve, reject) {
      console.error('[LAB DATA INIT] Инициализация лабораторных данных...');
      
      try {
        // Проверяем загружен ли модуль
        if (window.ONCO_LAB_DATA && typeof window.ONCO_LAB_DATA.loadLabInstrumentalData === 'function') {
          var result = window.ONCO_LAB_DATA.loadLabInstrumentalData('synthetic');
          
          // Если результат уже Promise - используем его, иначе оборачиваем
          if (result && typeof result.then === 'function') {
            resolve(result);
          } else {
            // Результат не является Promise - создаём новый и сразу resolvим
            var wrappedResult = Object.assign(
              {}, 
              result || { records: [], source: 'synthetic' },
              { warnings: (result && result.warnings) ? result.warnings : ['Источник: встроенные демонстрационные данные'] }
            );
            resolve(wrappedResult);
          }
        } else {
          console.error('[LAB DATA INIT] module not found, using demo data');
          // Демо-данные если модуль не загружен
          var demoData = generateDemoLabData();
          resolve({ 
            records: demoData,
            dims: { years: [2024, 2025, 2026], states: [], types: [] },
            meta: { name: 'Лабораторные и инструментальные исследования', note: 'Демо-данные' },
            source: 'synthetic' 
          });
        }
      } catch(e) {
        console.error('[LAB DATA INIT ERROR]', e.message, e.stack);
        // Демо-данные в случае ошибки
        var demoData = generateDemoLabData();
        resolve({ records: demoData, source: 'synthetic' });
      }
    });
    
    window.ONCO_LAB_DATA = window.ONCO_LAB_DATA || {};
    window.ONCO_LAB_DATA.loadLabInstrumentalData = function(mode) {
      return initPromise.then(function(result) {
        // Обновляем warnings
        var resultWithWarnings = Object.assign({}, result);
        if (!resultWithWarnings.warnings && mode === 'synthetic') {
          resultWithWarnings.warnings = ['Источник: встроенные демонстрационные данные (демо-режим). 2026 год — проекция.'];
        }
        return resultWithWarnings;
      });
    };
    
    // Инициализируем сразу при загрузке страницы
    initPromise.then(function(data) {
      console.error('[LAB DATA INIT DONE] Успешно:', data.records.length, 'записей');
    }).catch(function(err) {
      console.error('[LAB DATA INIT ERROR]', err.message);
    });
  }

  // Экспорт API
  window.ONCO_LAB_DATA = window.ONCO_LAB_DATA || {};
    LAB_STUDIES: TYPE_STUDY_PARAMS,
    generateLabData: loadLabInstrumentalData,
    loadLabInstrumentalData: loadLabInstrumentalData
  };

})();
