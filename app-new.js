/* =========================================================================
 * Oncology US Analytics — лабораторные и инструментальные исследования.
 * Чистая версия с полной функциональностью для вкладки исследований.
 * ========================================================================= */

// === Утилиты ===
function $seed(seed) {
  var x = Math.imul(Math.min(1779033703 ^ seed.length, 2147483647) + 1, seed);
  return function () {
    x |= 0; x = (x + 0x6D2B79F5) | 0;
    var t = Math.imul(x ^ (x >>> 15), 1 | x);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// === Генерация демо-данных для исследований ===
function generateDemoLabData() {
  console.error('[LAB DATA DEMO] Генерация демо-данных...');
  
  var records = [];
  var types = ['breast', 'prostate', 'lung', 'colorectal', 'melanoma'];
  var states = [
    { code: 'CA', name: 'California' },
    { code: 'NY', name: 'New York' },
    { code: 'TX', name: 'Texas' }
  ];
  var years = [2024, 2025, 2026];
  
  types.forEach(function(type) {
    states.forEach(function(state) {
      years.forEach(function(year) {
        var seedStr = (year + type + state.code).charCodeAt(0);
        var rng = $seed(seedStr);
        
        // КТ - выполняем с вероятностью 60%
        if (rng() < 0.6) {
          records.push({
            type: type,
            state: state.code,
            year: year,
            typeName: 'Тип рака ' + (type[0].toUpperCase() + type.slice(1))
          });
        }
        
        // МРТ - выполняем с вероятностью 40%
        if (rng() < 0.4) {
          records.push({
            type: type,
            state: state.code,
            year: year,
            typeName: 'Тип рака ' + (type[0].toUpperCase() + type.slice(1))
          });
        }
        
        // ПЭТ-КТ - выполняем с вероятностью 30%
        if (rng() < 0.3) {
          records.push({
            type: type,
            state: state.code,
            year: year,
            typeName: 'Тип рака ' + (type[0].toUpperCase() + type.slice(1))
          });
        }
        
        // УЗИ - выполняем с вероятностью 70%
        if (rng() < 0.7) {
          records.push({
            type: type,
            state: state.code,
            year: year,
            typeName: 'Тип рака ' + (type[0].toUpperCase() + type.slice(1))
          });
        }
      });
    });
  });
  
  return records;
}

// === Состояние ===
var LAB_RECORDS = null;

/* ----------------------------- Ключевые показатели ---------------- */
function renderLabKpis() {
  if (!LAB_RECORDS || LAB_RECORDS.length === 0) return;

  var totalStudies = LAB_RECORDS.filter(function(r) { 
    return r.ctPerformed || r.mriPerformed || r.petctPerformed || r.usPerformed; 
  }).length;

  var totalCost = LAB_RECORDS.reduce(function(sum, r) {
    return sum + (r.ctCost || 0) + (r.mriCost || 0) + (r.petctCost || 0) + (r.usCost || 0);
  }, 0);

  var avgCost = LAB_RECORDS.length > 0 ? totalCost / LAB_RECORDS.length : 0;

  var html = [
    '<div class="kpi-card"><div class="kpi-label">Исследований выполнено</div><div class="kpi-value">' + totalStudies + '</div></div>',
    '<div class="kpi-card"><div class="kpi-label">Общая стоимость ($)</div><div class="kpi-value">$' + Math.round(totalCost) + '</div></div>',
    '<div class="kpi-card"><div class="kpi-label">Ср. стоимость/пациент</div><div class="kpi-value">$' + Math.round(avgCost) + '</div></div>'
  ].join('');

  var labKpis = document.getElementById('labKpis');
  if (labKpis) labKpis.innerHTML = html;
}

/* ------------------------------ Таблица ------------------------------ */
function renderLabTable() {
  var cols = [
    'year', 'state', 'typeName', 'psangml', 'ca125', 'ceangml', 
    'ctPerformed', 'mriPerformed', 'petctPerformed', 'usPerformed'
  ];

  var rows = LAB_RECORDS.slice(0, 200);
  
  var head = cols.map(function(c) {
    return '<th>' + c.replace(/([A-Z])/g, ' $1').trim() + '</th>';
  }).join('');

  function cell(r, key) {
    var v = r[key];
    if (v === true) return '<td>✓</td>';
    if (v === false) return '<td>✗</td>';
    return '<td>' + (typeof v === 'string' ? v : (v == null ? '—' : String(v))) + '</td>';
  }

  var body = rows.map(function(r) {
    return '<tr>' + cols.map(function(c) { return cell(r, c); }).join('') + '</tr>';
  }).join('');

  var labTableBody = document.getElementById('labTableBody');
  if (labTableBody) labTableBody.innerHTML = body;

  var labTableNote = document.getElementById('labTableNote');
  if (labTableNote) labTableNote.textContent = 'Показано 200 из ' + LAB_RECORDS.length + ' записей';
}

/* ------------------------------ Графики ------------------------------ */
var chartState = 'loading';

function startChartLib() {
  if (chartState !== 'loading') return;
  chartState = 'ready';
  
  if (typeof Chart !== 'undefined') { renderStudyCharts(); return; }
  
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.js';
  s.async = true;
  s.onload = function() { renderStudyCharts(); };
  s.onerror = function() { console.error('[CHARTS ERROR]', 'Chart.js не загружен из CDN.'); };
  (document.head || document.documentElement).appendChild(s);
}

function renderStudyCharts() {
  if (!LAB_RECORDS || LAB_RECORDS.length === 0) return;

  var uniqueTypes = [...new Set(LAB_RECORDS.map(function(r) { return r.type; }))];
  var typeNames = {};
  
  uniqueTypes.forEach(function(typeId) {
    var record = LAB_RECORDS.filter(function(r) { return r.type === typeId; })[0] || {};
    typeNames[typeId] = record.typeName || (typeId[0].toUpperCase() + typeId.slice(1));
  });

  // График частоты исследований
  try {
    var canvasFreq = document.getElementById('chartStudyFrequency');
    if (canvasFreq) {
      var counts = uniqueTypes.map(function(typeId) {
        var recordsForType = LAB_RECORDS.filter(function(r) { return r.type === typeId; });
        var ctCount = recordsForType.filter(function(r) { return r.ctPerformed; }).length;
        return { label: typeNames[typeId], count: ctCount };
      });

      var cfg = {
        type: 'bar',
        data: {
          labels: counts.map(function(c) { return c.label; }),
          datasets: [{
            label: 'Количество выполненных исследований',
            data: counts.map(function(c) { return c.count; }),
            backgroundColor: '#2563eb'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: { display: true, text: 'Частота выполнения исследований по типам рака', font: { size: 14 } },
            legend: { display: false }
          }
        }
      };

      var chart = new Chart(canvasFreq, cfg);
      window.__chartStudyFrequency = chart;
    }
  } catch(e) { console.error('[LAB CHART ERROR]', e.message); }

  // График стоимости
  try {
    var canvasCost = document.getElementById('chartStudyCost');
    if (canvasCost) {
      var costs = uniqueTypes.map(function(typeId) {
        var recordsForType = LAB_RECORDS.filter(function(r) { return r.type === typeId; });
        var totalCost = recordsForType.reduce(function(sum, r) {
          return sum + (r.ctCost || 0) + (r.mriCost || 0) + (r.petctCost || 0) + (r.usCost || 0);
        }, 0);
        return { label: typeNames[typeId], cost: totalCost };
      });

      var cfg = {
        type: 'bar',
        data: {
          labels: costs.map(function(c) { return c.label; }),
          datasets: [{
            label: 'Общая стоимость исследований ($)',
            data: costs.map(function(c) { return c.cost; }),
            backgroundColor: '#10b981'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: { display: true, text: 'Общая стоимость исследований по типам рака', font: { size: 14 } },
            legend: { display: false }
          }
        }
      };

      var chart = new Chart(canvasCost, cfg);
      window.__chartStudyCost = chart;
    }
  } catch(e) { console.error('[LAB CHART ERROR]', e.message); }
}

/* === Инициализация при загрузке страницы === */
(function() {
  'use strict';

  console.error('[LAB APP] Инициализация приложения лабораторных исследований...');

  // Загружаем демо-данные при старте
  LAB_RECORDS = generateDemoLabData();
  console.error('[LAB DATA DEMO] Загружено демо-данных:', LAB_RECORDS.length);

  // Рендерим KPI и таблицы после загрузки данных
  if (LAB_RECORDS && LAB_RECORDS.length > 0) {
    setTimeout(function() {
      renderLabKpis();
      renderLabTable();
      
      // Запускаем графики если есть canvas
      if (document.getElementById('chartStudyFrequency') && document.getElementById('chartStudyCost')) {
        startChartLib();
      }
    }, 100);
  }

})();
