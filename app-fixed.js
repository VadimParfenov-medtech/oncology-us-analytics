/* =========================================================================
 * Oncology US Analytics — дашборд (ИСПРАВЛЕННАЯ ВЕРСИЯ).
 * ✅ Прямая агрегация вместо window.OncologyStats.compute()
 * ✅ Гарантированная загрузка данных при source: 'synthetic'
 */
(function () {
  'use strict';

  // === ИНИЦИАЛИЗАЦИЯ ЛОГИРОВАНИЯ ОШИБКОВ В КОНСОЛЬ ===
  if (typeof window.ONCO_ERROR !== 'undefined') {
    ONCO_ERROR.info('Oncology US Analytics: инициализация с логированием ошибок в консоль');
  }

  /* --------------------------- Состояние ------------------------------ */
  var RECORDS = null;
  var DIMS = null;
  var META = null;
  var currentSource = null;

  var filters = { year: 'all', state: 'all', type: 'all', stage: 'all' };
  var charts = {};
  var tableSort = { col: 'cases', dir: -1 };
  var TABLE_LIMIT = 200;

  /* Прямая агрегация вместо window.OncologyStats */
  function aggregate(rows) {
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return null;
    }
    
    var cases = 0, deaths = 0;
    var survW = 0, survN = 0, costW = 0, costN = 0, ageW = 0, ageN = 0, maleW = 0, maleN = 0;
    
    rows.forEach(function (r) {
      if (!r || typeof r.newCases !== 'number') return;
      
      var w = r.newCases;
      cases += w;
      if (typeof r.deaths === 'number') deaths += r.deaths;
      if (r.survival5y != null) { survW += r.survival5y * w; survN += w; }
      if (r.costPerPatient != null) { costW += r.costPerPatient * w; costN += w; }
      if (r.medianAge != null) { ageW += r.medianAge * w; ageN += w; }
      if (r.malePct != null) { maleW += r.malePct * w; maleN += w; }
    });
    
    return {
      cases: cases,
      deaths: deaths,
      mortality: cases && deaths ? deaths / cases * 100 : null,
      survival: survN ? survW / survN : null,
      cost: costN ? costW / costN : null,
      age: ageN ? ageW / ageN : null,
      male: maleN ? maleW / maleN : null
    };
  }

  function yearAgg(y) {
    if (y === 'all') return aggregate(baseRows('all'));
    
    var agg = aggregate(baseRows(+y));
    // Если нет данных за конкретный год, берём среднее из всех годов
    if (!agg || !agg.cases) {
      var allAgg = aggregate(baseRows('all'));
      if (allAgg) return allAgg;
    }
    return agg;
  }

  function popMOf(code) {
    for (var i = 0; i < DIMS.states.length; i++) {
      if (DIMS.states[i].code === code && DIMS.states[i].popM != null) return DIMS.states[i].popM;
    }
    return null;
  }

  /* ---------------------- Утилиты форматирования --------------------- */
  var fmtInt = new Intl.NumberFormat('ru-RU');
  function fmt1(v) { return v == null ? '—' : (Math.round(v * 10) / 10).toLocaleString('ru-RU'); }
  function fmtMoney(v) { return v == null ? '—' : '$' + fmtInt.format(Math.round(v)); }

  /* ---------------------- Утилиты для графиков --------------------- */
  var chartState = 'loading'; // 'loading' | 'ready' | 'failed'
  var CHART_SRC = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.js';
  
  function startChartLib() {
    if (chartLibStarted) return;
    chartLibStarted = true;
    if (typeof Chart !== 'undefined') { onChartReady(); return; }
    var s = document.createElement('script');
    s.src = CHART_SRC;
    s.async = true;
    s.onload = onChartReady;
    s.onerror = onChartFailed;
    (document.head || document.documentElement).appendChild(s);
  }

  var chartLibStarted = false;

  function onChartReady() {
    chartState = 'ready';
    setChartsLoading(false);
    if (RECORDS) renderCharts();
    console.error('[CHARTS] Chart.js загружен успешно');
  }

  function onChartFailed() {
    chartState = 'failed';
    var box = document.getElementById('chartsWrap');
    if (box) {
      var errorMsg = '⚠ Не удалось загрузить Chart.js — графики отключены. KPI, карта и таблица продолжают работать.';
      box.innerHTML = '<div class="card"><p style="padding:16px 0">' + errorMsg + '</p></div>';
    }
  }

  function setChartsLoading(on) {
    var box = document.getElementById('chartsWrap');
    if (!box) return;
    var el = box.querySelector('.charts-loading');
    if (on && !el) {
      el = document.createElement('div');
      el.className = 'charts-loading';
      el.innerHTML = '<div class="spinner">Загрузка графиков…</div>';
      box.appendChild(el);
    } else if (!on && el) {
      el.remove();
    }
  }

  function baseRows(yearValue) {
    if (!RECORDS || !Array.isArray(RECORDS)) return [];
    var filtered = RECORDS.filter(function (r) {
      var typeMatch = filters.type === 'all' || r.type.startsWith(filters.type);
      return (filters.state === 'all' || r.state === filters.state) &&
             typeMatch &&
             (filters.stage === 'all' || r.stage === filters.stage) &&
             (yearValue === 'all' || r.year === +yearValue);
    });
    return filtered;
  }

  /* ---------------------- Source management --------------------- */
  function switchSource(mode) {
    console.error('[DATA SOURCE] Переключение режима: ' + mode);

    if (mode === 'api' && !window.OncologyData.config.apiUrl) {
      var errorMsg = 'Режим «Свой API»: задайте apiUrl в config.js';
      console.error('[DATA ERROR]', errorMsg);
      return;
    }

    setBanner('progress', 'Загрузка данных из источника…');
    setChartsLoading(true);

    // Для synthetic — мгновенная загрузка без ожидания внешних API
    if (mode === 'synthetic' || currentSource === 'synthetic') {
      console.error('[DATA SYNTHETIC]', 'Мгновенная загрузка демо-данных');
      
      var data = window.OncologyData.load('synthetic');
      
      if (data && typeof data.then === 'function') {
        data.then(function(d) { applyDataset(d); });
      } else if (data && data.records && Array.isArray(data.records)) {
        applyDataset(data);
      }
      return;
    }

    window.OncologyData.load(mode, function(p) {}