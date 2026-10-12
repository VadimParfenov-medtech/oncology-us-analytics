/* =========================================================================
 * CDC WONDER / SEER-NPCR API — адаптер для Oncology US Analytics
 * 
 * Источник: CDC WONDER (SEER + NPCR) — официальная статистика онкологии США
 * Документация: https://wonder.cdc.gov/
 * 
 * Примечание: Прямой доступ к CDC WONDR API из браузера может быть ограничен CORS.
 * Для работы требуется прокси-сервер или backend.
 * 
 * Контракт результата load():
 *   { records, dims, meta, source: 'wonder', warnings: [string] }
 * ========================================================================= */
(function () {
  'use strict';

  // URL API CDC WONDER (публичный REST proxy)
  var WONDER_API = 'https://wonder3.cdc.gov/api';

  // Таблицы CDC WONDER: SEER*Stat и NPCR
  var WONDER_TABLES = {
    'SEER 9 Plus Registration Data': 'SEERREG9',
    'NPCR Central Cancer Registry Database': 'NPCR'
  };

  // Коды регионов CDC (REGION) — маппинг на штаты США (используем state_name для простоты)
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

  // Наименования типов рака (мужские и женские)
  var WONDER_CONDITIONS = {
    'breast_cancer_females':    { id: 'breast',           cond: 'breast cancer females',     name: 'Рак молочной железы' },
    'breast_cancer_males':      { id: 'breast_males',     cond: 'breast cancer males',       name: 'Рак молочной железы (мужчины)' },
    'prostate_cancer_males':    { id: 'prostate',        cond: 'prostate cancer males',     name: 'Рак простаты' },
    'colorectal_cancer_females':{ id: 'colorectal',      cond: 'colorectal cancer females', name: 'Колоректальный рак' },
    'colorectal_cancer_males':  { id: 'colorectal_males', cond: 'colorectal cancer males',   name: 'Колоректальный рак (мужчины)' },
    'lung_cancer_females':      { id: 'lung',            cond: 'lung cancer females',       name: 'Рак лёгких' },
    'lung_cancer_males':        { id: 'lung_males',      cond: 'lung cancer males',         name: 'Рак лёгких (мужчины)' },
    'melanoma_females':         { id: 'melanoma',        cond: 'melanoma females',          name: 'Меланома' },
    'melanoma_males':           { id: 'melanoma_males',  cond: 'melanoma males',            name: 'Меланома (мужчины)' },
    'pancreatic_cancer_females':{ id: 'pancreatic',      cond: 'pancreatic cancer females', name: 'Рак поджелудочной' },
    'pancreatic_cancer_males':  { id: 'pancreatic_males',cond: 'pancreatic cancer males',   name: 'Рак поджелудочной (мужчины)' },
    'gastric_cancer_females':   { id: 'gastric',        cond: 'gastric cancer females',    name: 'Рак желудка' },
    'gastric_cancer_males':     { id: 'gastric_males',   cond: 'gastric cancer males',      name: 'Рак желудка (мужчины)' },
    'ovarian_cancer_females':   { id: 'ovarian',        cond: 'ovarian cancer females',    name: 'Рак яичников' },
    'ovarian_cancer_males':     { id: 'ovarian_males',   cond: 'ovarian cancer males',      name: 'Рак яичников (мужчины)' },
    'leukemia_females':         { id: 'leukemia',        cond: 'leukemia females',          name: 'Лейкозы' },
    'leukemia_males':           { id: 'leukemia_males',  cond: 'leukemia males',            name: 'Лейкозы (мужчины)' },
    'lymphoma_females':         { id: 'lymphoma',        cond: 'lymphoma females',          name: 'Лимфомы' },
    'lymphoma_males':           { id: 'lymphoma_males',  cond: 'lymphoma males',            name: 'Лимфомы (мужчины)' }
  };

  // Коды стадий (SEER)
  var SEER_STAGE_MAP = {
    'IN_SITU':     '0',         // in situ
    'LOCAL_REG':   '1',         // локальная
    'DISTANT':     '4',         // далёкая (метастатическая)
    'UNKNOWN':     'N/A'        // неизвестно
  };

  var WONDER_YEARS = [2023, 2024, 2025]; // актуальные годы

  /* ------------------------------ Утилиты fetch ------------------------- */
  function fetchWonder(url, timeoutMs) {
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs || 20000) : null;

    return fetch(url, ctrl ? { signal: ctrl.signal } : {})
      .then(function (res) {
        if (!res.ok) {
          throw new Error('[WONDER API] HTTP ' + res.status + ' (' + url + ')');
        }
        return res.json();
      })
      .then(function (json) {
        if (timer) clearTimeout(timer);
        return json;
      })
      .catch(function (err) {
        console.error('[WONDER API ERROR]', '[CDC WONDR] Ошибка запроса к ' + url + ':', err.message);
        if (timer) clearTimeout(timer);
        throw err;
      });
  }

  /* ----------------------------- Парсинг данных CDC WONDR ---------------- */
  function parseWonderRow(row, conditionId, tableId, year, isMale) {
    // CDC WONDER API возвращает JSON с полями: CASES, REGION_NAME, YEAR, и т.д.
    var cases = parseFloat(row.CASES || row['newCases'] || 0) || 0;
    var deaths = (row.DEATHS || row.deaths) ? parseFloat(row.DEATHS || row.deaths) : null;
    var stageRaw = row.SEVERALSTAGE || row.SEER_STAGE || 'UNKNOWN';
    var stage = SEER_STAGE_MAP[stageRaw] || (row.stage ? String(row.stage) : 'N/A');

    // Для женского типа предполагаем соотношение ~45% мужчин (примерно)
    var malePct = isMale ? 48 : 100 - 48; // условное распределение по полу

    var regionCode = STATE_NAMES_TO_CODES[row.REGION_NAME] || 'XX';
    var stateName = row.REGION_NAME || null;

    return {
      state: regionCode,
      stateName: stateName,
      type: isMale ? (conditionId + '_males') : conditionId,
      typeName: WONDER_CONDITIONS[conditionId].cond + ' (' + (isMale ? 'мужчины' : 'женщины') + ')',
      stage: stage,
      year: parseInt(year, 10),
      newCases: cases,
      deaths: deaths,
      survival5y: null, // CDC WONDR не предоставляет выживаемость напрямую
      costPerPatient: null, // CDC WONDR не предоставляет стоимость
      medianAge: row.MEDIAN_AGE ? parseInt(row.Median_AGE, 10) : null,
      malePct: malePct
    };
  }

  function parseWonderResponse(response) {
    var data = response.data || response;
    var records = Array.isArray(data) ? data : [];

    // Валидация записей
    if (!records.length) {
      throw new Error('[VALIDATION] CDC WONDR: получен пустой набор данных');
    }

    // Извлекаем уникальные измерения из данных
    var states = {}, types = {}, stages = {}, years = {};
    records.forEach(function (r) {
      if (!states[r.state]) states[r.state] = r;
      if (!types[r.type]) types[r.type] = r;
      if (!stages[r.stage]) stages[r.stage] = true;
      if (!years[r.year]) years[r.year] = r;
    });

    var stateList = Object.keys(states).map(function (k) { return states[k]; }).sort(function (a, b) {
      // Сортировка штатов алфавитно по названию
      return a.stateName ? a.stateName.localeCompare(b.stateName, 'en') : a.state.localeCompare(b.state, 'en');
    });

    var typeList = Object.keys(types).map(function (k) { return types[k]; }).sort(function (a, b) {
      // Сортировка типов рака по приоритету
      var priority = { breast: 0, prostate: 1, colorectal: 2, lung: 3, melanoma: 4, pancreatic: 5, gastric: 6, ovarian: 7, leukemia: 8, lymphoma: 9 };
      return (priority[a.type.split('_')[0]] || 99) - (priority[b.type.split('_')[0]] || 99);
    });

    var yearList = Object.keys(years).map(Number).sort(function (a, b) { return a - b; });

    return {
      records: records.slice(0, 1000), // лимит для демо-запуска
      dims: {
        years: yearList,
        states: stateList,
        types: typeList,
        stages: Object.keys(stages).sort(function (a, b) {
          return a.localeCompare(b);
        })
      },
      meta: {
        name: 'CDC WONDER / SEER-NPCR',
        url: WONDER_API,
        caseLabel: 'новые случаи онкологических заболеваний',
        hasDeaths: records.some(function (r) { return r.DEATHS != null; }),
        hasSurvival: false, // CDC WONDR не предоставляет выживаемость
        hasCost: false,
        hasSex: records.some(function (r) { return r.SEX != null; }),
        hasAge: records.some(function (r) { return r.MEDIAN_AGE != null; }),
        hasPop: false, // население не предоставляется напрямую
        note: 'Данные CDC WONDER (SEER*Stat + NPCR): официальная статистика онкологии США. Записи агрегированы по штатам, годам и типам рака.',
        extraKpis: [
          { label: 'Регистров (SEER + NPCR)', value: 54 },
          { label: 'Период данных', value: yearList[0] + '–' + yearList[yearList.length - 1] }
        ]
      },
      source: 'wonder'
    };
  }

  /* --------------------------- Загрузка из CDC WONDR ---------------------- */
  function wonderLoad(onProgress) {
    var records = [];
    var errors = [];
    var tableId = WONDER_TABLES['SEER 9 Plus Registration Data'] || 'SEERREG9';

    // Для демонстрации загружаем только несколько типов рака и штатов
    var sampleConditions = ['breast_cancer_females', 'prostate_cancer_males', 'lung_cancer_females'];
    var sampleRegions = ['California', 'Texas', 'New York', 'Florida', 'Illinois'];

    async function loadTypeCondition(condId, condObj) {
      var C = condObj.cond; // CONDITION для запроса
      var regions = sampleRegions.slice();
      var years = WONDER_YEARS.slice();

      var promises = [];

      // Для каждого региона и года формируем запрос
      regions.forEach(function (regionName) {
        years.forEach(function (year) {
          var baseUrl = WONDER_API + '/data/' + tableId + '/' + year;
          var url = baseUrl +
            '?CONDITION=' + encodeURIComponent(C) +
            '&SEX=2&REGION_NAME=' + encodeURIComponent(regionName) +
            '&limit=100&sort=CASES:desc';

          promises.push(fetchWonder(url, 25000).then(function (data) {
            if (!data || !data.data) return;

            data.data.forEach(function (row) {
              if (parseFloat(row.CASES || row['newCases'] || 0) > 0) {
                records.push(parseWonderRow(row, condId, tableId, String(year), false));
              }
            });
          }).catch(function (err) {
            errors.push(condId + '/' + regionName + '/20' + year.slice(-1) + ': ' + err.message);
          }));
        });
      });

      return Promise.all(promises);
    }

    // Запускаем загрузку для нескольких типов рака
    var chain = Promise.resolve();
    sampleConditions.forEach(function (id) {
      var condObj = WONDER_CONDITIONS[id];
      chain = chain.then(function () { return loadTypeCondition(id, condObj); });
    });

    return chain.then(function () {
      if (!records.length) {
        throw new Error(errors.length ? errors.join('; ') : 'CDC WONDR API: не получено данных');
      }

      var dims = parseWonderResponse({ data: records }).dims;
      var meta = parseWonderResponse({ data: records }).meta;

      return {
        records: records,
        dims: dims,
        meta: meta,
        source: 'wonder',
        warnings: errors.length ? errors : []
      };
    });
  }

  /* ------------------------------ Fallback CDC WONDR ---------------------- */
  function wonderFallback() {
    console.error('[WONDER FALLBACK] CDC WONDR API недоступен — переход на демо-данные');
    return window.OncologyData.load('synthetic').then(function (data) {
      data.warnings = data.warnings || [];
      data.warnings.unshift('Источник данных «CDC WONDR» недоступен — показаны демонстрационные данные.');
      return data;
    });
  }

  /* ------------------------------ Экспорт CDC WONDR ------------------------ */
  function wonderExport() {
    return {
      type: 'wonder',
      name: 'CDC WONDER / SEER-NPCR',
      url: WONDER_API,
      config: {
        apiUrl: WONDER_API,
        tableId: WONDER_TABLES['SEER 9 Plus Registration Data'],
        conditions: Object.keys(WONDER_CONDITIONS),
        years: WONDER_YEARS,
        regionNames: STATE_NAMES_TO_CODES
      },
      load: wonderLoad,
      fallback: wonderFallback
    };
  }

  /* ------------------------------ Интеграция в OncologyData ---------------- */
  window.ONCO_WONDER = wonderExport();

})();
