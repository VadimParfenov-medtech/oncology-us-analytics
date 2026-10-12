/* Лабораторные и инструментальные исследования — чистая версия */

(function() {
  'use strict';

  /* KPI для лабораторных исследований */
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

  /* Таблица для лабораторных исследований */
  function renderLabTable() {
    var cols = [
      'year', 'state', 'typeName', 'psangml', 'ca125', 'ceangml', 
      'ctPerformed', 'mriPerformed', 'petctPerformed', 'usPerformed', 
      'ctCost', 'mriCost', 'petctCost', 'usCost'
    ];

    var rows = LAB_RECORDS.slice(0, 200);
    
    var head = cols.map(function(c) {
      return '<th>' + c.replace(/([A-Z])/g, ' $1').trim() + '</th>';
    }).join('');

    function cell(r, key) {
      var v = r[key];
      if (v === true) return '<td>✓</td>';
      if (v === false) return '<td>✗</td>';
      return '<td>' + (typeof v === 'string' ? v : (v == null ? '—' : v)) + '</td>';
    }

    var body = rows.map(function(r) {
      return '<tr>' + cols.map(function(c) { return cell(r, c); }).join('') + '</tr>';
    }).join('');

    var labTableBody = document.getElementById('labTableBody');
    if (labTableBody) labTableBody.innerHTML = body;

    var labTableNote = document.getElementById('labTableNote');
    if (labTableNote) labTableNote.textContent = 'Показано 200 из ' + LAB_RECORDS.length + ' записей';
  }

  /* Обработчик кнопки сброса исследований */
  function initLabResetButton() {
    var resetLabBtn = document.getElementById('resetLabBtn');
    if (resetLabBtn) {
      resetLabBtn.addEventListener('click', function() { 
        var studyTypeFilter = document.getElementById('fStudyType');
        if (studyTypeFilter) studyTypeFilter.value = 'all';
      });
    }
  }

  /* Обработчик кнопки экспорта CSV */
  function initLabExportButton() {
    var exportLabBtn = document.getElementById('exportLabBtn');
    if (exportLabBtn) {
      exportLabBtn.addEventListener('click', function() {
        var cols = [
          'year', 'state', 'typeName', 'psa', 'ca125', 'cea', 
          'ctPerformed', 'ctCost', 'mriPerformed', 'mriCost', 
          'petctPerformed', 'petctCost', 'usPerformed', 'usCost'
        ];

        var lines = [cols.map(function(c) { return String(c); }).join(';')];
        LAB_RECORDS.slice(0, 200).forEach(function(r) {
          lines.push(cols.map(function(c) {
            var v = r[c];
            if (c === 'typeName') return '"' + (v || '') + '"';
            if (c === 'state') return '"' + v + '"';
            if ([true, false].indexOf(v) >= 0) return v ? 'true' : 'false';
            return typeof v === 'string' ? '"' + v.replace(/"/g, '""') + '"' : 
                   (v == null ? '' : String(v));
          }).join(';'));
        });

        var blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'oncology_lab_studies.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      });
    }
  }

  /* Инициализация событий для лабораторных исследований */
  function initLabEvents() {
    // Кнопка сброса
    var resetLabBtn = document.getElementById('resetLabBtn');
    if (resetLabBtn) {
      resetLabBtn.addEventListener('click', function() { 
        var studyTypeFilter = document.getElementById('fStudyType');
        if (studyTypeFilter) studyTypeFilter.value = 'all';
      });
    }

    // Кнопка экспорта CSV
    var exportLabBtn = document.getElementById('exportLabBtn');
    if (exportLabBtn) {
      exportLabBtn.addEventListener('click', function() {
        var cols = ['year', 'state', 'typeName', 'psa', 'ca125', 'cea', 
          'ctPerformed', 'ctCost', 'mriPerformed', 'mriCost', 
          'petctPerformed', 'petctCost', 'usPerformed', 'usCost'];

        var lines = [cols.map(function(c) { return String(c); }).join(';')];
        LAB_RECORDS.slice(0, 200).forEach(function(r) {
          lines.push(cols.map(function(c) {
            var v = r[c];
            if (c === 'typeName') return '"' + (v || '') + '"';
            if (c === 'state') return '"' + v + '"';
            if ([true, false].indexOf(v) >= 0) return v ? 'true' : 'false';
            return typeof v === 'string' ? '"' + v.replace(/"/g, '""') + '"' : 
                   (v == null ? '' : String(v));
          }).join(';'));
        });

        var blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'oncology_lab_studies.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      });
    }
  }

})();
