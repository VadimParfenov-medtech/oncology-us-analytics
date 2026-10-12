/* Лабораторные исследования - простая версия */
(function(){
  console.log('[LAB] Инициализация...');

  // Демо-данные
  var data = [
    {type:'breast', state:'CA', year:2024, typeName:'Breast'},
    {type:'prostate', state:'CA', year:2025, typeName:'Prostate'},
    {type:'lung', state:'NY', year:2026, typeName:'Lung'}
  ];

  // KPI
  var kpi = '<div class="kpi-card"><div class="kpi-label">Записей</div><div class="kpi-value">' + data.length + '</div></div>';
  document.getElementById('labKpis').innerHTML = kpi;

  // Таблица
  var head = '<th>Год</th><th>Штат</th><th>Тип рака</th>';
  var rows = '';
  data.forEach(function(row) {
    rows += '<tr><td>' + row.year + '</td><td>' + row.state + '</td><td>' + row.typeName + '</td></tr>';
  });
  
  document.getElementById('labTableHead').innerHTML = head;
  document.getElementById('labTableBody').innerHTML = rows;
  document.getElementById('labTableNote').textContent = 'Показано ' + data.length + ' из ' + data.length + ' записей';

  console.log('[LAB] Готово, записей:', data.length);

})();
