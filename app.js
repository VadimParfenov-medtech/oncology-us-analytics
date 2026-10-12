/* =========================================================================
 * Oncology US Analytics — дашборд.
 * Фильтры: год, штат, тип рака, стадия, пол, источник данных.
 * KPI-карточки, карта США (тепловая), 6 графиков (Chart.js v4), таблица, CSV.
 * Источник данных: window.OncologyData (data-source.js):
 *   synthetic (демо) | trials (ClinicalTrials.gov) | wonder (CDC WONDR/SEER-NPCR) | api (контракт README).
 * ========================================================================= */
(function () {
  'use strict';

  // === ИНИЦИАЛИЗАЦИЯ ЛОГИРОВАНИЯ ОШИБКОВ В КОНСОЛЬ ===
  // Подключение модуля обработки ошибок (если загружен)
  if (typeof window.ONCO_ERROR !== 'undefined') {
    ONCO_ERROR.info('Oncology US Analytics: инициализация с логированием ошибок в консоль');
  }

  /* --------------------------- Состояние ------------------------------ */
  var RECORDS = null;
  var DIMS = null;
  var META = null;
  var currentSource = null;

  var filters = { year: 'all', state: 'all', type: 'all', stage: 'all', sex: 'all' };
  var charts = {};
  var tableSort = { col: 'cases', dir: -1 };
  var TABLE_LIMIT = 200;

  /* Единопассовая агрегация (stats.js): текущее сечение фильтров (STATS)
     и разбивка по всем годам (STATS_ALL — дельты KPI, тренд) */
  var STATS = null;
  var STATS_ALL = null;

  /* Chart.js загружается асинхронно: KPI/карта/таблица появляются сразу,
     графики — как только библиотека подтянется (обычно за сотые доли сек) */
  var chartState = 'loading'; // 'loading' | 'ready' | 'failed'
  var chartLibStarted = false;
  var CHART_SRC = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.js';

  var TYPE_COLORS = {
    breast: '#2563eb', prostate: '#0d9488', lung: '#e11d48', colorectal: '#7c3aed',
    melanoma: '#f59e0b', pancreatic: '#64748b', ovarian: '#db2777', gastric: '#0891b2',
    leukemia: '#16a34a', lymphoma: '#9333ea'
  };
  var STAGE_COLORS = { 'I': '#34d399', 'II': '#60a5fa', 'III': '#fbbf24', 'IV': '#f87171', 'N/A': '#94a3b8' };

  /* ------------------------------ Утилиты ------------------------------ */
  function $(sel) { return document.querySelector(sel); }
  var fmtInt = new Intl.NumberFormat('ru-RU');
  function fmt1(v) { return v == null ? '—' : (Math.round(v * 10) / 10).toLocaleString('ru-RU'); }
  function fmtMoney(v) { return v == null ? '—' : '$' + fmtInt.format(Math.round(v)); }
  function pctChange(cur, prev) {
    if (prev == null || !isFinite(prev) || prev === 0) return null;
    return ((cur - prev) / prev) * 100;
  }
  function caseLabel() {
    return (META && META.caseLabel) ? META.caseLabel : 'новые случаи';
  }

  /* ---------------------- Chart.js: асинхронная загрузка ---------------- */
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

  function onChartReady() {
    chartState = 'ready';
    setChartsLoading(false);
    if (RECORDS) renderCharts();
    // Логирование успешной загрузки Chart.js в консоль
    console.error('[CHARTS] Chart.js загружен успешно, графические контролы активны');

    /* Настройка глобальных дефолтных опций для Chart.js */
    if (typeof Chart !== 'undefined' && Chart.defaults) {
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      
      // Глобальные настройки текста
      Chart.defaults.font.family = '"Segoe UI", system-ui, -apple-system, Roboto, sans-serif';
      Chart.defaults.font.weight = 'normal';
      Chart.defaults.color = isDark ? '#f8fafc' : '#0f172a'; /* Белый/чёрный в зависимости от темы */
      
      // Настройка осей
      Chart.defaults.scale.ticks.color = isDark ? '#94a3b8' : '#64748b';
      Chart.defaults.scale.title.color = isDark ? '#f8fafc' : '#64748b';
      Chart.defaults.scale.grid.color = isDark ? '#334155' : '#e2e8f0';
      
      // Настройка тултипов
      Chart.defaults.plugins.tooltip.backgroundColor = isDark ? '#1e293b' : '#f1f5f9';
      Chart.defaults.plugins.tooltip.titleColor = isDark ? '#f8fafc' : '#0f172a';
      Chart.defaults.plugins.tooltip.bodyColor = isDark ? '#f8fafc' : '#0f172a';
      Chart.defaults.plugins.tooltip.borderColor = isDark ? '#334155' : '#e2e8f0';
      
      // Настройка легенды
      Chart.defaults.plugins.legend.labels.color = isDark ? '#f8fafc' : '#0f172a';
      
      /* Ключевое: заголовки графиков */
      Chart.defaults.plugins.title.color = isDark ? '#f8fafc' : '#0f172a'; /* White for dark theme! */
      Chart.defaults.plugins.title.font.family = Chart.defaults.font.family;
      Chart.defaults.plugins.title.font.weight = '600';
    }

    /* Настройка заголовков после рендера каждого графика */
    if (typeof document !== 'undefined') {

      /* Обновляем Chart.defaults при переключении темы */
      if (typeof MutationObserver !== 'undefined' && typeof Chart !== 'undefined') {
        var themeChartObserver = new MutationObserver(function(mutations) {
          mutations.forEach(function(mutation) {
            if (mutation.attributeName === 'data-theme') {
              var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
              
              /* Обновляем все глобальные настройки Chart.js */
              try {
                // Глобальные настройки текста
                Chart.defaults.color = isDark ? '#f8fafc' : '#0f172a';
                
                // Настройка осей
                Chart.defaults.scale.ticks.color = isDark ? '#94a3b8' : '#64748b';
                Chart.defaults.scale.title.color = isDark ? '#f8fafc' : '#64748b';
                Chart.defaults.scale.grid.color = isDark ? '#334155' : '#e2e8f0';
                
                // Настройка тултипов
                Chart.defaults.plugins.tooltip.backgroundColor = isDark ? '#1e293b' : '#f1f5f9';
                Chart.defaults.plugins.tooltip.titleColor = isDark ? '#f8fafc' : '#0f172a';
                Chart.defaults.plugins.tooltip.bodyColor = isDark ? '#f8fafc' : '#0f172a';
                
                // Настройка легенды
                Chart.defaults.plugins.legend.labels.color = isDark ? '#f8fafc' : '#0f172a';
                
                /* Ключевое: заголовки графиков */
                Chart.defaults.plugins.title.color = isDark ? '#f8fafc' : '#0f172a';
                
                console.error('[THEME CHART]', 'Обновлены глобальные настройки Chart.js для темы:', isDark ? 'dark' : 'light');
              } catch(e) {
                console.error('[THEME CHART ERROR]', 'Ошибка обновления Chart.defaults:', e.message);
              }
            }
          });
        });

        /* Начинаем наблюдение за HTML элементом */
        var html = typeof document !== 'undefined' ? document.documentElement : null;
        if (html) {
          themeChartObserver.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
          console.error('[THEME CHART]', 'Наблюдатель для Chart.defaults установлен');
        }
      }

    /* Настройка заголовков после рендера каждого графика */
      var allCanvases = document.querySelectorAll('canvas[id^="chart"]');
      
      // Функция для поиска и настройки заголовков в canvas
      function fixChartTitle(canvas) {
        setTimeout(function() {
          // Ищем заголовок разными способами
          var chartTitle = findChartTitle(canvas);
          
          if (chartTitle && isDark) {
            // Принудительно устанавливаем цвет через JS (проверяем, что это работает)
            try {
              // Для SVG text элементов
              if (chartTitle.tagName.toLowerCase() === 'text' || 
                  chartTitle.tagName.toLowerCase() === 'tspan') {
                // Ищем родителем с иерархией SVG
                var parent = chartTitle.parentElement;
                while (parent) {
                  if (parent.style && typeof parent.style.color === 'string') {
                    parent.style.color = '#f8fafc';
                    console.error('[CHARTS]', 'Установлен белый цвет для SVG text:', parent.textContent.substring(0, 30));
                    break;
                  }
                  parent = parent.parentElement;
                }
              } else if (chartTitle.style) {
                chartTitle.style.color = '#f8fafc';
                chartTitle.style.fontWeight = '600';
                console.error('[CHARTS]', 'Установлен белый цвет для HTML:', chartTitle.tagName, ':', chartTitle.textContent.substring(0, 30));
              } else if (chartTitle.outerHTML) {
                // Пробуем создать элемент и применить стили к его стилям
                var styles = chartTitle.getAttribute('style') || '';
                chartTitle.setAttribute('style', styles + ';color:#f8fafc !important;');
              }
            } catch(e) {
              console.error('[CHARTS]', 'Ошибка настройки заголовка:', e.message);
            }
          }
        }, 300);
      }
      
      // Функция для поиска заголовка в canvas
      function findChartTitle(canvas) {
        // Способ 1: По роли title
        if (canvas.querySelector('[role="title"]')) return canvas.querySelector('[role="title"]');
        
        // Способ 2: h2, h3 элементы
        if (canvas.querySelector('h2, h3')) return canvas.querySelector('h2, h3');
        
        // Способ 3: p с ролью title
        if (canvas.querySelector('p[role="title"]')) return canvas.querySelector('p[role="title"]');
        
        // Способ 4: любые div внутри canvas с текстом
        var children = Array.from(canvas.children);
        for (var i = 0; i < children.length; i++) {
          if (children[i].tagName === 'DIV' && 
              (children[i].textContent || children[i].innerText) && 
              (children[i].textContent || children[i].innerText).trim().length > 15) {
            return children[i];
          }
        }
        
        // Способ 5: SVG text элементы с текстом о заголовке
        var svg = canvas.querySelector('svg');
        if (svg) {
          var texts = Array.from(svg.querySelectorAll('text'));
          for (var j = 0; j < texts.length; j++) {
            var text = texts[j];
            var nodeText = (text.textContent || text.innerText) || '';
            // Ищем ключевые слова заголовков графиков
            if (nodeText && (
                nodeText.includes('Динамика') || 
                nodeText.includes('Типы') || 
                nodeText.includes('Стадии') || 
                nodeText.includes('Штатов') || 
                nodeText.includes('Выживаемость') || 
                nodeText.includes('Мужчины') ||
                nodeText.includes('Динамика:') ||
                nodeText.includes('Типы ') ||
                nodeText.includes('Стадия ') ||
                nodeText.includes('Штаты ') ||
                nodeText.includes('Выживаемость ') ||
                nodeText.includes('Мужчины/Женщины')
              )) {
              return text;
            }
          }
        }
        
        // Способ 6: поиск по всем текстовым элементам с ключевыми словами
        var allTexts = canvas.querySelectorAll('[class*="title"], [class*="chartjs"]');
        for (var k = 0; k < allTexts.length; k++) {
          var text = allTexts[k];
          if ((text.textContent || text.innerText) && 
              (text.textContent || text.innerText).includes(':') && // Часто заголовки имеют двоеточие
              (text.textContent || text.innerText).length > 15) {
            return text;
          }
        }
        
        return null;
      }

      allCanvases.forEach(function(canvas) {
        canvas.addEventListener('afterRender', function() {
          fixChartTitle(canvas);
        });
      });
    }

    /* MutationObserver для отслеживания изменений внутри canvas */
    if (typeof MutationObserver !== 'undefined') {
      var canvasObservers = [];
      
      allCanvases.forEach(function(canvas) {
        var observer = new MutationObserver(function(mutations) {
          mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
              mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === 1) { // Element node
                  // Проверяем, является ли это заголовком или легендой
                  var isTitle = node.tagName.toLowerCase() === 'h2' || 
                               node.tagName.toLowerCase() === 'h3' || 
                               node.tagName.toLowerCase() === 'p' ||
                               node.classList && node.classList.contains('chart-title') ||
                               (node.querySelector && node.querySelector('[role="title"]'));
                  
                  var isLegend = node.tagName.toLowerCase() === 'div' && 
                                ((node.textContent || '').includes('Мужчины') ||
                                 (node.textContent || '').includes('Женщины'));
                  
                  if (isTitle || isLegend) {
                    console.error('[MUTATION]', 'Найден новый заголовок/легенда в:', canvas.id);
                    if (mutation.addedNodes[0] === node) {
                      setTimeout(function() {
                        fixChartTitle(canvas);
                      }, 100);
                    }
                  }
                }
              });
            }
          });
        });
        
        observer.observe(canvas, { childList: true, subtree: true });
        canvasObservers.push(observer);
      });
      
      console.error('[CHARTS]', 'MutationObserver установлен для', allCanvases.length, 'графиков');
    }
  }

  function onChartFailed() {
    chartState = 'failed';
    setChartsLoading(false);
    var box = document.getElementById('chartsWrap');
    if (box) {
      var errorMsg = 'Не удалось загрузить Chart.js с CDN — графики отключены. KPI, карта и таблица ниже продолжают работать. Проверьте подключение к интернету и обновите страницу.';
      box.innerHTML =
        '<div class="card"><p style="padding:16px 0">⚠ ' + errorMsg + '</p></div>';
      // Логирование ошибки загрузки Chart.js в консоль разработчика
      console.error('[CHARTS ERROR]', 'Chart.js не загружен из CDN (' + CHART_SRC + ').');
    }
  }

  function setChartsLoading(on) {
    var box = document.getElementById('chartsWrap');
    if (!box) return;
    var el = box.querySelector('.charts-loading');
    if (on && !el) {
      el = document.createElement('div');
      el.className = 'charts-loading';
      el.innerHTML = '<div class="spinner" aria-label="загрузка графиков"></div>Загрузка графиков…';
      box.appendChild(el);
    } else if (!on && el) {
      el.remove();
    }
  }

  /* --------------------------- Агрегации ------------------------------- */
  function baseRows(yearValue) {
    return RECORDS.filter(function (r) {
      // Для CDC WONDR data: каждая запись уникальна по state-type-stage-year
      // Фильтруем по состоянию фильтров (учитываем префиксы типов рака)
      var typeMatch = filters.type === 'all' || r.type.startsWith(filters.type);
      return (filters.state === 'all' || r.state === filters.state) &&
             typeMatch &&
             (filters.stage === 'all' || r.stage === filters.stage) &&
             (yearValue === 'all' || r.year === +yearValue) &&
             (filters.sex === 'all' || 
              (filters.sex === 'male' && r.malePct >= 50) ||
              (filters.sex === 'female' && r.malePct < 50));
    });
  }

  function aggregate(rows) {
    var cases = 0, deaths = 0;
    var survW = 0, survN = 0, costW = 0, costN = 0, ageW = 0, ageN = 0, maleW = 0, maleN = 0;
    rows.forEach(function (r) {
      var w = (typeof r.newCases === 'number') ? r.newCases : 0;
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

  function popMOf(code) {
    for (var i = 0; i < DIMS.states.length; i++) {
      if (DIMS.states[i].code === code && DIMS.states[i].popM != null) return DIMS.states[i].popM;
    }
    return null;
  }

  /* ------------------------- Источник данных --------------------------- */
  function setBanner(kind, text) {
    var b = $('#sourceBanner');
    if (!b) return;
    if (!text) { b.style.display = 'none'; b.textContent = ''; b.className = 'source-banner'; return; }
    b.style.display = 'block';
    b.className = 'source-banner ' + kind;
    b.textContent = text;
  }

  function setBadge(source, name) {
    var b = $('#sourceBadge');
    if (!b) return;
    b.textContent = name;
    b.className = 'badge badge--' + source;
  }

  function applyDataset(data) {
    RECORDS = data.records;
    DIMS = data.dims;
    META = data.meta;
    currentSource = data.source;

    /* сбрасываем фильтры, которых больше нет в измерении */
    if (filters.year !== 'all' && DIMS.years.indexOf(+filters.year) < 0) filters.year = 'all';
    if (filters.state !== 'all' && !DIMS.states.some(function (s) { return s.code === filters.state; })) filters.state = 'all';
    if (filters.type !== 'all' && !DIMS.types.some(function (t) { return t.id.startsWith(filters.type); })) filters.type = 'all';
    if (filters.stage !== 'all' && DIMS.stages.indexOf(filters.stage) < 0) filters.stage = 'all';

    /* обновляем badge и баннер в зависимости от источника */
    var badgeName = data.source === 'synthetic'
      ? 'Демо-данные (синтетика)'
      : data.source === 'trials' ? 'ClinicalTrials.gov' :
        data.source === 'wonder' ? 'CDC WONDR / SEER-NPCR' :
        data.source === 'wonder-unavailable' ? 'CDC WONDR недоступен' :
        'API: ' + data.meta.name;
    setBadge(data.source, badgeName);

    if (data.warnings && data.warnings.length) {
      setBanner('warn', '⚠ ' + data.warnings.join(' | ') + (data.source === 'synthetic' ? ' — показаны демо-данные.' : ''));
    } else if (data.source === 'synthetic') {
      setBanner('ok', (data.meta && data.meta.note) || 'Встроенные демонстрационные данные. 2026 год — проекция.');
    } else if (data.source === 'trials') {
      setBanner('ok', (data.meta && data.meta.note) || 'Реальные данные ClinicalTrials.gov');
    } else if (data.source === 'wonder') {
      setBanner('ok', (data.meta && data.meta.note) || 'Официальная статистика CDC WONDR (SEER-NPCR)');
    } else if (data.source === 'wonder-unavailable') {
      setBanner('err', '⚠ CDC WONDR временно недоступен. Показаны демо-данные.');
    } else {
      setBanner('ok', (data.meta && data.meta.note) || 'Данные загружены из внешнего API.');
    }

    buildSelects();
    buildMapMetricSelect();
    applyCardVisibility();
    render();
  }

  function applyCardVisibility() {
    function show(id, cond) {
      var el = document.getElementById(id);
      if (el) el.style.display = cond ? '' : 'none';
    }
    show('cardSurvival', !!(META && META.hasSurvival));
    show('cardSex', !!(META && META.hasSex));
    var trend = document.getElementById('cardTrend');
    if (trend) trend.classList.toggle('full', !(META && META.hasSurvival));
  }

  function switchSource(mode) {
    // Всегда перезагружаем данные при переключении источника
    console.error('[DATA SOURCE] Переключение режима: ' + mode);

    if (mode === 'api' && !window.OncologyData.config.apiUrl) {
      var errorMsg = 'Режим «Свой API»: задайте apiUrl в config.js или добавьте ?api=<url> в адрес страницы.';
      console.error('[DATA ERROR]', errorMsg);
      var sel = $('#fSource');
      if (sel) sel.value = window.OncologyData.config.source || 'synthetic';
      return;
    }

    // Для synthetic — сразу вызываем syntheticLoad без ожидания внешних API (мгновенная загрузка!)
    if (mode === 'synthetic') {
      console.error('[DATA SYNTHETIC]', 'Мгновенная загрузка демонстрационных данных через syntheticLoad');
      
      // Прямо вызываем syntheticLoad (не через OncologyData.load чтобы не было лишнего ожидания)
      var data = window.OncologyData.load('synthetic');
      
      if (data && typeof data.then === 'function') {
        data.then(function(d) {
          d.warnings = d.warnings || [];
          d.warnings.unshift('Источник: встроенные демонстрационные данные (демо-режим). 2026 год — проекция.');
          applyDataset(d);
        }).catch(function(e) {
          console.error('[DATA SYNTHETIC ERROR]', e.message);
          var d = window.OncologyData.load('synthetic'); // ещё раз пробуем
          d.then(function(d2) { applyDataset(d2); });
        });
      } else if (data && data.records) {
        // Если результат сразу (Promise.resolve)
        data.warnings = data.warnings || [];
        data.warnings.unshift('Источник: встроенные демонстрационные данные (демо-режим). 2026 год — проекция.');
        applyDataset(data);
      } else {
        console.error('[DATA SYNTHETIC ERROR]', 'syntheticLoad вернул некорректный результат');
      }
      return;
    }

    setBanner('progress', 'Загрузка данных из источника…');
    var kpis = $('#kpis');
    if (kpis) kpis.innerHTML = '<div class="kpi-card kpi-card--loading"><div class="kpi-label">Загрузка данных…</div><div class="spinner" aria-label="загрузка"></div></div>';

    window.OncologyData.load(mode, function (p) {
      setBanner('progress', 'Загрузка реальных данных (' + mode.toUpperCase() + ')…');
    }).then(function(result) {
      console.error('[DATA SUCCESS]', 'Успешно загрузил данные из режима ' + result.source + ', записей: ' + (result.records && result.records.length || 0));
      
      // Handle CDC WONDR unavailable source gracefully  
      if (result && result.source === 'wonder-unavailable') {
        console.error('[DATA FALLBACK]', 'CDC WONDR недоступен, показаны демо-данные');
        setBanner('err', '⚠ CDC WONDR API временно недоступен (DNS/сеть). Показаны демо-данные.');
        
        window.OncologyData.load('synthetic').then(function(d) {
          d.warnings = d.warnings || [];
          if (result && result.meta) {
            d.warnings.unshift('Источник CDC WONDR недоступен: ' + (result.meta.note || 'Временный сбой API'));
          } else {
            d.warnings.unshift('Источник CDC WONDR недоступен');
          }
          console.error('[DATA FALLBACK]', 'Переключаюсь на демо-данные');
          applyDataset(d);
        });
        return;
      }
      
      applyDataset(result);
    }).catch(function (e) {
      var errorInfo = e && e.message ? e.message : String(e);
      console.error('[DATA LOAD ERROR]', 'Ошибка загрузки данных из режима ' + mode + ':', errorInfo);

      // Check if this is a WONDR API unavailable error
      if (errorInfo.toLowerCase().includes('api недоступен') || 
          errorInfo.toLowerCase().includes('unavailable')) {
        console.error('[DATA FALLBACK]', 'CDC WONDR недоступен, показаны демо-данные');
        
        setBanner('err', '⚠ CDC WONDR API временно недоступен (DNS/сеть). Показаны демо-данные.');
        
        window.OncologyData.load('synthetic').then(function(d) {
          d.warnings = d.warnings || [];
          d.warnings.unshift('Источник CDC WONDR недоступен');
          console.error('[DATA FALLBACK]', 'Переключаюсь на демо-данные, записей: ' + d.records.length);
          applyDataset(d);
        });
        return;
      }

      setBanner('err', 'Ошибка загрузки данных (' + errorInfo + '). Переключаюсь на демо-данные.');
      window.OncologyData.load('synthetic').then(function (d) {
        d.warnings = d.warnings || [];
        d.warnings.unshift('Реальный источник недоступен: ' + errorInfo);
        console.error('[DATA FALLBACK]', 'Переключаюсь на демо-данные, записей: ' + d.records.length);
        applyDataset(d);
      });
    });
  }

  /* ------------------------------ KPI ---------------------------------- */
  var KPI_DEFS = [
    { key: 'cases', label: null, fmt: fmtInt, goodWhenUp: true, needs: null },
    { key: 'deaths', label: 'Смерти', fmt: fmtInt, goodWhenUp: false, needs: 'hasDeaths' },
    { key: 'mortality', label: 'Смертность от новых случаев, %', fmt: fmt1, goodWhenUp: false, needs: 'hasDeaths' },
    { key: 'survival', label: '5-летняя выживаемость, %', fmt: fmt1, goodWhenUp: true, needs: 'hasSurvival' },
    { key: 'cost', label: 'Средняя стоимость / пациент', fmt: fmtMoney, goodWhenUp: false, needs: 'hasCost' },
    { key: 'age', label: 'Медианный возраст, лет', fmt: fmt1, goodWhenUp: null, needs: 'hasAge' },
    { key: 'male', label: 'Мужчины, %', fmt: fmt1, goodWhenUp: null, needs: 'hasSex' }
  ];

  function activeKpiDefs() {
    return KPI_DEFS
      .filter(function (d) { return !d.needs || (META && META[d.needs]); })
      .map(function (d) {
        return {
          key: d.key,
          label: d.key === 'cases' ? (caseLabel()[0].toUpperCase() + caseLabel().slice(1)) : d.label,
          fmt: d.fmt,
          goodWhenUp: d.goodWhenUp
        };
      });
  }

  /* Агрегат за конкретный год (дельты KPI, тренд). При наличии stats.js —
     из единопассовой агрегации по всем годам; иначе — старый алгоритм. */
  function yearAgg(y) {
    var S = STATS_ALL || STATS;
    if (!S) {
      console.error('[YEAR AGG ERROR]', 'Невозможно сформировать агрегат за год ' + y + ': нет STATS_ALL или STATS');
      return window.OncologyStats ? window.OncologyStats.zero : { cases: 0 };
    }
    
    // yearAgg получает y как строку из DIMS.years, но нужно проверить обе формы ключей
    var key = (typeof y === 'string') ? y : String(y);
    var byYearData = S.byYear || {};
    var agg = byYearData[key] || byYearData[String(y)] || byYearData[y];
    
    if (!agg) {
      console.error('[YEAR AGG WARNING]', 'Ключ года не найден: y=' + y + ', ключи byYear=[' + Object.keys(byYearData).join(', ') + ']');
    }
    
    return agg || (window.OncologyStats && window.OncologyStats.zero) ? (agg || window.OncologyStats.zero) : { cases: 0 };
  }

  function aggForYear(y) {
    if (y === 'all') return STATS ? STATS.total : aggregate(baseRows('all'));
    return yearAgg(y);
  }

  /* Агрегат по группе (тип/стадия/штат) в текущем сечении фильтров.
     Отсутствие группы → нулевой агрегат (как aggregate([]) раньше). */
  function groupAgg(by, key) {
    if (STATS) {
      var a = STATS[by] && STATS[by][key];
      
      // Debug: если группа не найдена — логируем ключи
      if (!a && STATS[by]) {
        console.error('[GROUP AGG WARNING]', 'Группа не найдена:', by + '.' + key, '| Доступные ключи:', Object.keys(STATS[by]).join(', '));
      }
      
      return a || (window.OncologyStats && window.OncologyStats.zero) ? (a || window.OncologyStats.zero) : { cases: 0 };
    }
    var rows = baseRows(filters.year);
    var field = (by === 'byType') ? 'type' : (by === 'byStage') ? 'stage' : 'state';
    return aggregate(rows.filter(function (r) { return r[field] === key; }));
  }

  function kpiDelta(key) {
    if (filters.year !== 'all') {
      var y = +filters.year;
      if (y <= DIMS.years[0]) return null;
      var cur = yearAgg(y);
      var prev = yearAgg(y - 1);
      return pctChange(cur[key], prev[key]);
    }
    var first = yearAgg(DIMS.years[0]);
    var last = yearAgg(DIMS.years[DIMS.years.length - 1]);
    return pctChange(last[key], first[key]);
  }

  function renderKpis() {
    var agg = aggForYear(filters.year);
    var deltaLabel = filters.year === 'all'
      ? 'Δ ' + DIMS.years[DIMS.years.length - 1] + ' к ' + DIMS.years[0]
      : 'Δ к ' + (+filters.year - 1);

    var html = activeKpiDefs().map(function (d) {
      var value = agg[d.key];
      var delta = kpiDelta(d.key);
      var deltaHtml;
      if (delta !== null && isFinite(delta) && Math.abs(delta) >= 0.05) {
        var up = delta > 0;
        var cls = d.goodWhenUp === null ? 'neutral' : ((up === (d.goodWhenUp === true)) ? 'good' : 'bad');
        deltaHtml = '<div class="kpi-delta ' + cls + '">' +
          (up ? '▲' : '▼') + ' ' + Math.abs(delta).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) +
          '% <span>' + deltaLabel + '</span></div>';
      } else {
        deltaHtml = '<div class="kpi-delta muted">нет сравнения</div>';
      }
      var valHtml;
      try {
        if (d.fmt && typeof d.fmt === 'function') {
          valHtml = d.fmt(value);
        } else {
          valHtml = value == null ? '—' : String(value);
        }
      } catch (fmtErr) {
        console.error('[KPI RENDER ERROR]', 'Ошибка форматирования для ' + d.key + ':', fmtErr.message);
        valHtml = value == null ? '—' : String(value);
      }
      return '<div class="kpi-card">' +
        '<div class="kpi-label">' + d.label + '</div>' +
        '<div class="kpi-value">' + (valHtml == null ? '—' : valHtml) + '</div>' +
        deltaHtml +
        '</div>';
    }).join('');

    if (META && Array.isArray(META.extraKpis)) {
      META.extraKpis.forEach(function (k) {
        html += '<div class="kpi-card">' +
          '<div class="kpi-label">' + k.label + '</div>' +
          '<div class="kpi-value">' + fmtInt.format(k.value) + '</div>' +
          '<div class="kpi-delta neutral">из источника данных</div>' +
          '</div>';
      });
    }

    $('#kpis').innerHTML = html;
  }

  /* ------------------------------ Графики ------------------------------ */
  function chartTitle(text) {
    return { display: true, text: text, color: '#0f172a', font: { size: 14, weight: '600' }, padding: { bottom: 12 } };
  }
  function periodLabel() {
    return filters.year === 'all' ? ' (' + DIMS.years.join('–') + ')': ' (' + filters.year + ')';
  }
  function typeColor(id, dimId) {
    return (filters.type === 'all' || filters.type === dimId) ? (TYPE_COLORS[dimId] || '#2563eb') : 'rgba(148,163,184,0.35)';
  }
  function stageColor(s) {
    return (filters.stage === 'all' || filters.stage === s) ? (STAGE_COLORS[s] || '#94a3b8') : 'rgba(148,163,184,0.30)';
  }
  function ensureChart(id, cfg) {
    if (charts[id]) {
      // Destroy old chart before updating (prevents empty charts issue)
      try {
        if (typeof charts[id].destroy === 'function') {
          charts[id].destroy();
        }
      } catch (e) {
        console.error('[CHARTS]', 'Ошибка уничтожения графика ' + id + ':', e.message);
      }
      delete charts[id];
    }
    
    var chart = new Chart(document.getElementById(id), cfg);
    
    /* ПОСЛЕ СОЗДАНИЯ ГРАФИКА - применяем белый цвет ко всем текстовым элементам */
    if (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark') {
      setTimeout(function() {
        var canvas = document.getElementById(id);
        if (canvas) {
          console.error('[CHART POST-CREATE]', 'id=' + id, 'canvas.innerHTML=', canvas.innerHTML.substring(0, 200));
          
          // ВСЕМ SVG text элементам применяем белый fill!
          var allSvgTexts = canvas.querySelectorAll('text');
          allSvgTexts.forEach(function(textNode) {
            try {
              var currentFill = textNode.getAttribute('fill');
              console.error('[CHART]', 'SVG text:', (textNode.textContent || '').substring(0, 60), 
                           '| currentFill=', currentFill);
              
              // ВСЕМ применяем белый fill - без фильтрации!
              if (!currentFill || 
                  currentFill === '#0f172a' || 
                  ['#3b82f6', '#0d9488', '#1e3a8a', 'black'].indexOf(currentFill) >= 0) {
                textNode.setAttribute('fill', '#f8fafc');
                console.error('[CHART]', 'Установлен white fill для:', (textNode.textContent || '').substring(0, 50));
              }
            } catch (e) {}
          });
          
          // tspan элементы - тоже ВСЕМ применяем белый!
          var allTspans = canvas.querySelectorAll('tspan');
          allTspans.forEach(function(tspanNode) {
            try {
              var currentFill = tspanNode.getAttribute('fill');
              if (!currentFill || 
                  ['#3b82f6', '#0d9488', '#1e3a8a', 'black'].indexOf(currentFill) >= 0) {
                tspanNode.setAttribute('fill', '#f8fafc');
                console.error('[CHART]', 'Установлен white fill для tspan:', (tspanNode.textContent || '').substring(0, 40));
              }
            } catch (e) {}
          });
          
          // HTML h2, h3, p элементы - ВСЕМ применяем белый!
          var htmlElements = canvas.querySelectorAll('h2, h3, p');
          htmlElements.forEach(function(el) {
            try {
              if (!el.classList.contains('chart-tooltip')) {
                el.style.color = '#f8fafc !important';
              }
            } catch (e) {}
          });
          
          // Div элементы с текстом - ВСЕМ применяем белый!
          var divElements = canvas.querySelectorAll('div:not([class*="tooltip"]):not([class*="chart-tooltip"])');
          divElements.forEach(function(div) {
            try {
              if ((div.textContent || '').length > 0 && 
                  !div.classList.contains('ChartjsTooltip')) {
                div.style.color = '#f8fafc !important';
              }
            } catch (e) {}
          });
          
          console.error('[CHART POST-CREATE]', 'id=' + id, '- обработано', allSvgTexts.length, 'SVG text и', allTspans.length, 'tspan');
        }
      }, 500);
    }
    
    return chart;
  }

  function renderTrendChart() {
    console.error('[TREND CHART] Начальная агрегация по годам...');
    
    // Проверка всех ключей в STATS_ALL.byYear
    var S = STATS_ALL || STATS;
    if (S && S.byYear) {
      console.error('[TREND CHART] Ключи byYear:', Object.keys(S.byYear));
      
      // Проверка каждого года
      DIMS.years.forEach(function(year) {
        var key1 = String(year);  // строковый ключ из DIMS.years
        var key2 = year + '';     // ещё раз как строка
        var agg = S.byYear[key1] || S.byYear[year + ''] || S.byYear[year];
        
        console.error('[TREND CHART]', 'Год:', year, '| Ключ-1:', key1, '| Ключ-2:', year + '', '| Агрегат.cases:', agg ? agg.cases : 'NOT FOUND');
      });
    }
    
    var values = DIMS.years.map(function (y) { return yearAgg(y).cases; });
    console.error('[TREND CHART] Итоговые значения:', values);
    
    if (values.some(function(v) { return v === 0 || v === null; })) {
      console.error('[TREND CHART ERROR]', 'Некоторые годы имеют 0 случаев — проверьте агрегацию');
    }
    
    var selected = filters.year !== 'all' ? +filters.year : null;
    ensureChart('chartTrend', {
      type: 'line',
      data: {
        labels: DIMS.years.map(String),
        datasets: [{
          label: caseLabel(),
          data: values,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37,99,235,0.10)',
          fill: true,
          tension: 0.35,
          pointRadius: DIMS.years.map(function (y) { return y === selected ? 7 : 4; }),
          pointBackgroundColor: DIMS.years.map(function (y) {
            if (y === selected) return '#2563eb';
            return y === DIMS.years[DIMS.years.length - 1] ? '#94a3b8' : '#ffffff';
          }),
          pointBorderColor: '#2563eb',
          pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: chartTitle('Динамика: ' + caseLabel() + ' по годам (' + DIMS.years.join('–') + ')'),
          legend: { display: false },
          tooltip: { callbacks: { label: function (c) { return fmtInt.format(c.parsed.y) + ' · ' + caseLabel(); } } }
        },
        scales: {
          y: { beginAtZero: true, ticks: { callback: function (v) { return fmtInt.format(v); } } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  function renderTypeChart() {
    var byType = DIMS.types.map(function (t) { return groupAgg('byType', t.id).cases; });
    ensureChart('chartTypes', {
      type: 'bar',
      data: {
        labels: DIMS.types.map(function (t) { return t.name; }),
        datasets: [{
          label: caseLabel(),
          data: byType,
          backgroundColor: DIMS.types.map(function (t) { return typeColor(null, t.id); }),
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: chartTitle(capitalize(caseLabel()) + ' по типам рака' + periodLabel()),
          legend: { display: false },
          tooltip: { callbacks: { label: function (c) { return fmtInt.format(c.parsed.y) + ' · ' + caseLabel(); } } }
        },
        scales: {
          y: { beginAtZero: true, ticks: { callback: function (v) { return fmtInt.format(v); } } },
          x: { ticks: { maxRotation: 45, minRotation: 30, font: { size: 10 } }, grid: { display: false } }
        }
      }
    });
  }

  function renderStageChart() {
    var byStage = DIMS.stages.map(function (s) { return groupAgg('byStage', s).cases; });
    ensureChart('chartStages', {
      type: 'doughnut',
      data: {
        labels: DIMS.stages.map(function (s) { return s === 'N/A' ? 'N/A' : 'Стадия ' + s; }),
        datasets: [{
          data: byStage,
          backgroundColor: DIMS.stages.map(stageColor),
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '58%',
        plugins: {
          title: chartTitle('Структура (' + caseLabel() + ') по стадиям/фазам' + periodLabel()),
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: function (c) {
                var total = c.dataset.data.reduce(function (a, b) { return a + b; }, 0);
                var pct = total ? (c.parsed / total * 100).toFixed(1) : 0;
                return fmtInt.format(c.parsed) + ' · ' + caseLabel() + ' (' + pct + '%)';
              }
            }
          }
        }
      }
    });
  }

  function renderStatesChart() {
    var all = DIMS.states.map(function (s) {
      return {
        code: s.code, name: s.name,
        cases: groupAgg('byState', s.code).cases
      };
    }).sort(function (a, b) { return b.cases - a.cases; });

    var top = all.slice(0, 10);
    var colors = top.map(function (s) {
      if (filters.state === 'all') return '#0d9488';
      return s.code === filters.state ? '#0d9488' : 'rgba(148,163,184,0.30)';
    });
    ensureChart('chartStates', {
      type: 'bar',
      data: {
        labels: top.map(function (s) { return s.name; }),
        datasets: [{
          label: caseLabel(),
          data: top.map(function (s) { return s.cases; }),
          backgroundColor: colors,
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: chartTitle('Топ-10 штатов (' + caseLabel() + ')' + periodLabel()),
          legend: { display: false },
          tooltip: { callbacks: { label: function (c) { return fmtInt.format(c.parsed.x) + ' · ' + caseLabel(); } } }
        },
        scales: {
          x: { beginAtZero: true, ticks: { callback: function (v) { return fmtInt.format(v); } } },
          y: { grid: { display: false }, ticks: { font: { size: 11 } } }
        }
      }
    });
  }

  function renderSurvivalChart() {
    if (!META || !META.hasSurvival) return;
    var byStage = DIMS.stages.map(function (s) {
      var agg = groupAgg('byStage', s);
      return agg.survival == null ? null : Math.round(agg.survival * 10) / 10;
    });
    ensureChart('chartSurvival', {
      type: 'bar',
      data: {
        labels: DIMS.stages.map(function (s) { return s === 'N/A' ? 'N/A' : 'Стадия ' + s; }),
        datasets: [{
          label: '5-летняя выживаемость, %',
          data: byStage,
          backgroundColor: DIMS.stages.map(function (s) { return STAGE_COLORS[s] || '#94a3b8'; }),
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: chartTitle('5-летняя выживаемость по стадиям' + periodLabel()),
          legend: { display: false },
          tooltip: { callbacks: { label: function (c) { return c.parsed.y == null ? 'нет данных' : c.parsed.y + '%'; } } }
        },
        scales: {
          y: { beginAtZero: true, max: 100, ticks: { callback: function (v) { return v + '%'; } } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  function renderSexChart() {
    if (!META || !META.hasSex) return;
    var byType = DIMS.types.map(function (t) {
      var agg = groupAgg('byType', t.id);
      return {
        name: t.name,
        male: agg.male == null ? 0 : agg.male,
        female: agg.male == null ? 0 : Math.max(0, 100 - agg.male)
      };
    });
    ensureChart('chartSex', {
      type: 'bar',
      data: {
        labels: byType.map(function (t) { return t.name; }),
        datasets: [
          { label: 'Мужчины', data: byType.map(function (t) { return Math.round(t.male * 10) / 10; }), backgroundColor: '#2563eb', borderRadius: 4 },
          { label: 'Женщины', data: byType.map(function (t) { return Math.round(t.female * 10) / 10; }), backgroundColor: '#ec4899', borderRadius: 4 }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: chartTitle('Соотношение «мужчины/женщины» по типам рака' + periodLabel()),
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ' + c.parsed.x + '%'; } } }
        },
        scales: {
          x: { stacked: true, max: 100, ticks: { callback: function (v) { return v + '%'; } } },
          y: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } }
        }
      }
    });
  }

  function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

  /* ------------------------------- Карта ------------------------------- */
  function buildMapMetricSelect() {
    var sel = $('#mapMetric');
    if (!sel) return;
    var opts = [];
    if (META && META.hasPop) opts.push(['cases100k', capitalize(caseLabel()) + ' на 100 тыс. населения']);
    opts.push(['cases', capitalize(caseLabel())]);
    if (META && META.hasDeaths) {
      if (META.hasPop) opts.push(['deaths100k', 'Смерти на 100 тыс.']);
      opts.push(['deaths', 'Смерти']);
    }
    if (META && META.hasSurvival) opts.push(['survival', '5-летняя выживаемость, %']);
    if (META && META.hasCost) opts.push(['cost', 'Стоимость на пациента, $']);
    sel.innerHTML = opts.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('');
    sel.value = opts.length ? opts[0][0] : 'cases';
  }

  function stateValue(code, metric) {
    var agg;
    if (STATS) {
      agg = STATS.byState[code]; // штат без записей в сечении → null («нет данных»)
      if (!agg) return null;
    } else {
      var rows = RECORDS.filter(function (r) {
        return r.state === code &&
               (filters.type === 'all' || r.type.startsWith(filters.type)) &&
               (filters.stage === 'all' || r.stage === filters.stage) &&
               (filters.year === 'all' || r.year === +filters.year);
      });
      if (!rows.length) return null;
      agg = aggregate(rows);
    }
    if (metric === 'cases') return agg.cases;
    if (metric === 'deaths') return agg.deaths;
    if (metric === 'survival') return agg.survival;
    if (metric === 'cost') return agg.cost;
    if (metric === 'cases100k') { var p = popMOf(code); return p ? agg.cases / p : null; }
    if (metric === 'deaths100k') { var p2 = popMOf(code); return p2 ? agg.deaths / p2 : null; }
    return null;
  }

  function fmtMetricValue(metric, v) {
    if (v == null) return '—';
    if (metric === 'survival') return fmt1(v) + '%';
    if (metric === 'cost') return fmtMoney(v);
    if (metric === 'cases100k' || metric === 'deaths100k') return fmt1(v) + ' на 100 тыс.';
    return fmtInt.format(v);
  }

  function renderMap() {
    if (!window.USMap) return;
    var metric = ($('#mapMetric') || {}).value || 'cases';
    var names = {};
    DIMS.states.forEach(function (s) { names[s.code] = s.name; });
    var values = {};
    DIMS.states.forEach(function (s) { values[s.code] = stateValue(s.code, metric); });
    window.USMap.render({
      values: values,
      names: names,
      selected: filters.state,
      fmt: function (v) { return fmtMetricValue(metric, v); },
      onSelect: function (code) {
        filters.state = (filters.state === code) ? 'all' : code;
        var sel = $('#fState');
        if (sel) sel.value = filters.state;
        render();
      }
    });
  }

  /* ------------------------------ Таблица ------------------------------ */
  function tableRows() {
    var rows = baseRows(filters.year);
    if (filters.year !== 'all') {
      return rows.map(function (r) {
        return {
          state: r.stateName, type: r.typeName, stage: r.stage, year: String(r.year),
          cases: r.newCases, deaths: r.deaths, survival: r.survival5y,
          cost: r.costPerPatient, age: r.medianAge, male: r.malePct
        };
      });
    }
    var map = {};
    rows.forEach(function (r) {
      // Для CDC WONDR: ключ включает stage для корректной группировки
      var k = r.state + '|' + r.type + '|' + r.stage;
      if (!map[k]) {
        map[k] = {
          state: r.stateName, type: r.typeName, stage: r.stage, year: DIMS.years.join('–'),
          cases: 0, deaths: 0, hasDeaths: false,
          survW: 0, survN: 0, costW: 0, costN: 0, ageW: 0, ageN: 0, maleW: 0, maleN: 0
        };
      }
      var m = map[k];
      m.cases += r.newCases;
      if (r.deaths != null) { m.deaths += r.deaths; m.hasDeaths = true; }
      if (r.survival5y != null) { m.survW += r.survival5y * r.newCases; m.survN += r.newCases; }
      if (r.costPerPatient != null) { m.costW += r.costPerPatient * r.newCases; m.costN += r.newCases; }
      if (r.medianAge != null) { m.ageW += r.medianAge * r.newCases; m.ageN += r.newCases; }
      if (r.malePct != null) { m.maleW += r.malePct * r.newCases; m.maleN += r.newCases; }
    });
    return Object.keys(map).map(function (k) {
      var m = map[k];
      return {
        state: m.state, type: m.type, stage: m.stage, year: m.year,
        cases: m.cases,
        deaths: m.hasDeaths ? m.deaths : null,
        survival: m.survN ? Math.round(m.survW / m.survN * 10) / 10 : null,
        cost: m.costN ? Math.round(m.costW / m.costN) : null,
        age: m.ageN ? Math.round(m.ageW / m.ageN) : null,
        male: m.maleN ? Math.round(m.maleW / m.maleN) : null
      };
    });
  }

  function columns() {
    return [
      { key: 'state', label: 'Штат' },
      { key: 'type', label: 'Тип рака' },
      { key: 'stage', label: 'Стадия' },
      { key: 'year', label: 'Период' },
      { key: 'cases', label: capitalize(caseLabel()), num: true },
      { key: 'deaths', label: 'Смерти', num: true },
      { key: 'survival', label: 'Выживаемость 5-лет, %', num: true },
      { key: 'cost', label: 'Средняя стоимость', num: true },
      { key: 'age', label: 'Медиан. возраст', num: true },
      { key: 'male', label: 'Мужчины, %', num: true }
    ];
  }

  function sortRows(rows) {
    var col = tableSort.col;
    rows.sort(function (a, b) {
      var av = a[col], bv = b[col];
      if (typeof av === 'string') return av.localeCompare(bv, 'ru') * tableSort.dir;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av - bv) * tableSort.dir;
    });
    return rows;
  }

  function renderTable() {
    var cols = columns();
    var rows = sortRows(tableRows());
    var shown = rows.slice(0, TABLE_LIMIT);

    var head = cols.map(function (c) {
      var arrow = tableSort.col === c.key ? (tableSort.dir === -1 ? ' ↓' : ' ↑') : '';
      return '<th data-col="' + c.key + '"' + (c.num ? ' class="num"' : '') + '>' + c.label + arrow + '</th>';
    }).join('');

    function cell(c, r) {
      var v = r[c.key];
      if (c.key === 'cases') return '<td class="num">' + fmtInt.format(v) + '</td>';
      if (c.key === 'deaths') return '<td class="num">' + (v == null ? '—' : fmtInt.format(v)) + '</td>';
      if (c.key === 'survival') return '<td class="num">' + fmt1(v) + '</td>';
      if (c.key === 'cost') return '<td class="num">' + fmtMoney(v) + '</td>';
      if (c.key === 'age') return '<td class="num">' + (v == null ? '—' : v) + '</td>';
      if (c.key === 'male') return '<td class="num">' + (v == null ? '—' : v) + '</td>';
      return '<td>' + v + '</td>';
    }

    var body = shown.map(function (r) {
      return '<tr>' + cols.map(function (c) { return cell(c, r); }).join('') + '</tr>';
    }).join('');

    $('#tableBody').innerHTML = body;
    var colName = cols.filter(function (c) { return c.key === tableSort.col; })[0];
    $('#tableNote').textContent = 'Показано ' + fmtInt.format(shown.length) + ' из ' +
      fmtInt.format(rows.length) + ' строк' + (rows.length > TABLE_LIMIT ? ' (сортировка: ' + colName.label.toLowerCase() + ')' : '') + '.';
  }

  /* ------------------------------- CSV --------------------------------- */
  function exportCsv() {
    var cols = columns();
    var rows = sortRows(tableRows());
    function esc(v) {
      var s = String(v == null ? '' : v);
      return '"' + s.replace(/"/g, '""') + '"';
    }
    var lines = [cols.map(function (c) { return esc(c.label); }).join(';')];
    rows.forEach(function (r) {
      lines.push(cols.map(function (c) {
        var v = r[c.key];
        if (c.key === 'cost') return esc(v == null ? '' : '$' + fmtInt.format(Math.round(v)));
        if (c.key === 'cases') return esc(fmtInt.format(v));
        if (c.key === 'deaths') return esc(v == null ? '' : fmtInt.format(v));
        return esc(v);
      }).join(';'));
    });
    var blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'oncology-us_' + (filters.year === 'all' ? 'all-years' : filters.year) +
      '_' + (filters.state === 'all' ? 'all-states' : filters.state) + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  /* ---------------------------- Селекты -------------------------------- */
  function buildSelects() {
    var yearSel = $('#fYear');
    if (yearSel) {
      yearSel.innerHTML = '<option value="all">Все годы (' + DIMS.years.join('–') + ')</option>' +
        DIMS.years.map(function (y) { return '<option value="' + y + '">' + y + '</option>'; }).join('');
      yearSel.value = (DIMS.years.indexOf(+filters.year) >= 0) ? filters.year : 'all';
    }

    var states = DIMS.states.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'ru'); });
    var stateSel = $('#fState');
    if (stateSel) {
      stateSel.innerHTML = '<option value="all">Все штаты</option>' +
        states.map(function (s) { return '<option value="' + s.code + '">' + s.name + '</option>'; }).join('');
      stateSel.value = filters.state;
    }

    var typeSel = $('#fType');
    if (typeSel) {
      typeSel.innerHTML = '<option value="all">Все типы рака</option>' +
        DIMS.types.map(function (t) { return '<option value="' + t.id + '">' + t.name + '</option>'; }).join('');
      typeSel.value = filters.type;
    }

    var stageSel = $('#fStage');
    if (stageSel) {
      stageSel.innerHTML = '<option value="all">Все стадии</option>' +
        DIMS.stages.map(function (s) { return '<option value="' + s + '">' + (s === 'N/A' ? 'N/A' : 'Стадия ' + s) + '</option>'; }).join('');
      stageSel.value = filters.stage;
    }

    var sexSel = $('#fSex');
    if (sexSel) {
      sexSel.innerHTML = '<option value="all">Все</option>' +
        '<option value="male">Мужской</option>' +
        '<option value="female">Женский</option>';
      sexSel.value = filters.sex;
    }

    var studyTabSel = $('#fStudyTab');
    if (studyTabSel) {
      studyTabSel.addEventListener('change', function(e) {
        filters.studyTab = e.target.value;
        onStudyTabChange();
      });
    }
  }


  
  function loadLabStudies() {
    if (window.OncologyData && window.OncologyData.labLoad) {
      console.error('[LAB DATA] Загрузка лабораторных исследований...');
      return window.OncologyData.labLoad().then(function(data) {
        LAB_RECORDS = data.records;
        window.ONCO_DIMS_TYPES = data.dims.types;
        window.ONCO_DIMS_STATES = data.dims.states;
        console.error('[LAB DATA] Загружено исследований: ' + (LAB_RECORDS && LAB_RECORDS.length || 0));
        if (filters.studyTab === 'lab_instrumental') {
          renderLabStudies();
        }
        return data;
      });
    }
    // Фоллбэк на встроенные данные из lab-instrumental-data.js
    console.error('[LAB DATA] Используем встроенные демо-данные для исследований');
    var data = window.ONCO_LAB_DATA ? 
                window.ONCO_LAB_DATA.loadLabInstrumentalData('synthetic') :
                loadLabStudiesDummy();
    LAB_RECORDS = data.records;
    window.ONCO_DIMS_TYPES = data.dims.types;
    window.ONCO_DIMS_STATES = data.dims.states;
    console.error('[LAB DATA] Загружено исследований (демо): ' + (LAB_RECORDS && LAB_RECORDS.length || 0));
    if (filters.studyTab === 'lab_instrumental') {
      renderLabStudies();
    }
    return data;
  }

  function loadLabStudiesDummy() {
    // Демо-данные для лабораторных исследований
    var records = [];
    var dims = {
      years: [2024, 2025, 2026],
      states: [],
      types: [
        { id: 'breast', name: 'Рак молочной железы' },
        { id: 'prostate', name: 'Рак простаты' },
        { id: 'lung', name: 'Рак лёгких' },
        { id: 'colorectal', name: 'Колоректальный рак' },
        { id: 'melanoma', name: 'Меланома' },
        { id: 'pancreatic', name: 'Рак поджелудочной железы' }
      ]
    };

    // Заполняем штаты из BUILTIN_DIMS.states если есть
    var builtinStates = window.ONCO_LAB_DATA && window.ONCO_LAB_DATA.INSTRUMENTAL_STUDIES ? 
                        null : (window.BUILTIN_DIMS ? window.BUILTIN_DIMS.states : []);
    
    if (builtinStates && builtinStates.length > 0) {
      dims.states = builtinStates;
    } else {
      // Минимальный набор штатов для демо
      dims.states = [
        { code: 'CA', name: 'Калифорния', popM: 39.4 },
        { code: 'NY', name: 'Нью-Йорк', popM: 19.6 },
        { code: 'TX', name: 'Техас', popM: 30.5 }
      ];
    }

    // Генерируем данные для каждого типа рака и штата за каждый год
    dims.types.forEach(function(type) {
      dims.states.forEach(function(state) {
        dims.years.forEach(function(year) {
          var baseCases = Math.floor(Math.random() * 50) + 10;
          records.push({
            type: type.id,
            state: state.code,
            year: year,
            stateName: state.name,
            typeName: type.name,
            // Лабораторные показатели
            psa: year === 2026 ? Math.random() * 15 + 3 : (type.id === 'prostate' ? Math.random() * 4 + 1 : null),
            ca125: year === 2026 ? Math.random() * 200 + 20 : null,
            cea: year === 2026 ? Math.random() * 3 + 1 : null,
            // КТ
            ctPerformed: Math.random() > 0.4,
            ctCost: Math.random() > 0.4 ? Math.floor(Math.random() * 3000 + 1500) : null,
            ctFindings: 'Метастазы обнаружены' + (Math.random() > 0.5 ? '' : ' / нет метастазов'),
            // МРТ
            mriPerformed: Math.random() > 0.3,
            mriCost: Math.random() > 0.3 ? Math.floor(Math.random() * 4000 + 2000) : null,
            mriFindings: 'Изменения в печени' + (Math.random() > 0.5 ? '' : ' / норма'),
            // ПЭТ-КТ
            petctPerformed: Math.random() > 0.6,
            petctCost: Math.random() > 0.6 ? Math.floor(Math.random() * 4000 + 3000) : null,
            petctFindings: 'Высокое SUVmax' + (Math.random() > 0.5 ? '' : ' / низкий захват'),
            // УЗИ
            usPerformed: Math.random() > 0.2,
            usCost: Math.random() > 0.2 ? Math.floor(Math.random() * 600 + 200) : null,
            usFindings: 'Увеличенные лимфоузлы' + (Math.random() > 0.5 ? '' : ' / норма')
          });
        });
      });
    });

    return { records: records, dims: dims, source: 'synthetic', meta: {} };
  }

  function renderLabStudies() {
    if (!LAB_RECORDS) {
      loadLabStudies().then(function() { renderLabStudies(); });
      return;
    }

    // Сбрасываем фильтры для лабораторных исследований
    var studyTypeFilter = $('#fStudyType');
    if (studyTypeFilter && !filters.studyType) {
      filters.studyType = 'all';
      studyTypeFilter.value = 'all';
    }

    // Агрегируем данные по типам исследований
    var studyAggregates = {};
    
    ['biomarker', 'ct', 'mri', 'petct', 'ultrasound'].forEach(function(studyKey) {
      if (!studyAggregates[studyKey]) return;

      var typeLabels = { biomarker: 'Биомаркеры', ct: 'КТ', mri: 'МРТ', petct: 'ПЭТ-КТ', ultrasound: 'УЗИ' };
      
      var labels = window.ONCO_DIMS_TYPES ? window.ONCO_DIMS_TYPES.map(function(t) { return t.name; }) : ['Breast', 'Prostate'];
      var data = [];

      window.ONCO_DIMS_TYPES.forEach(function(type) {
        var typeId = type.id;
        
        // Агрегируем данные для данного типа исследования и типа рака
        var recordsForType = LAB_RECORDS.filter(function(r) {
          return r.type === typeId && (filters.studyType === 'all' || 
            studyKey === 'biomarker' ? (r.psa !== null || r.ca125 !== null || r.cea !== null) :
            studyKey === 'ct' ? r.ctPerformed :
            studyKey === 'mri' ? r.mriPerformed :
            studyKey === 'petct' ? r.petctPerformed :
            studyKey === 'ultrasound' ? r.usPerformed : true);
        });

        var count = recordsForType.length;
        var avgCost = recordsForType.reduce(function(sum, r) { return sum + (r[studyKey + 'Cost'] || 0); }, 0) / 
                      (count > 0 ? count : 1);
        var findings = recordsForType.filter(function(r) { return r[studyKey + 'Performed']; })
                       .map(function(r) { return r[studyKey + 'Findings']; });

        data.push({
          label: type.name,
          value: count,
          cost: Math.round(avgCost)
        });
      });

      studyAggregates[studyKey] = { labels: labels, data: data };
    });

    // Рендерим графики
    renderStudyCharts(studyAggregates);
  }

  function renderStudyCharts() {
    function ensureChart(id, cfg) {
      if (charts[id]) {
        try {
          if (typeof charts[id].destroy === 'function') {
            charts[id].destroy();
          }
        } catch (e) {}
        delete charts[id];
      }
      
      var chart = new Chart(document.getElementById(id), cfg);
      return chart;
    }

    // График частоты исследований - используем уникальные типы из данных
    var uniqueTypes = [...new Set(LAB_RECORDS.map(function(r) { return r.type; }))];
    var typeNames = {};
    uniqueTypes.forEach(function(typeId) {
      var record = LAB_RECORDS.filter(function(r) { return r.type === typeId; })[0] || {};
      typeNames[typeId] = record.typeName || (typeId[0].toUpperCase() + typeId.slice(1));
    });

    // Считаем количество выполненных исследований для каждого типа
    var counts = uniqueTypes.map(function(typeId) {
      var recordsForType = LAB_RECORDS.filter(function(r) { return r.type === typeId; });
      var ctCount = recordsForType.filter(function(r) { return r.ctPerformed; }).length;
      return { label: typeNames[typeId], count: ctCount };
    });

    ensureChart('chartStudyFrequency', {
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
          title: { display: true, text: 'Частота выполнения исследований по типам рака' },
          legend: { display: false }
        }
      }
    });

    // График стоимости - агрегируем стоимость для каждого типа
    var costs = uniqueTypes.map(function(typeId) {
      var recordsForType = LAB_RECORDS.filter(function(r) { return r.type === typeId; });
      var totalCost = recordsForType.reduce(function(sum, r) {
        return sum + (r.ctCost || 0) + (r.mriCost || 0) + (r.petctCost || 0) + (r.usCost || 0);
      }, 0);
      return { label: typeNames[typeId], cost: totalCost };
    });

    ensureChart('chartStudyCost', {
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
          title: { display: true, text: 'Общая стоимость исследований по типам рака' },
          legend: { display: false }
        }
      }
    });

    // График уровней биомаркеров (используем только типы с данными)
    var biomarkerTypes = uniqueTypes.filter(function(typeId) {
      return LAB_RECORDS.some(function(r) { 
        return r.type === typeId && (r.psa !== null || r.ca125 !== null || r.cea !== null); 
      });
    });

    if (biomarkerTypes.length > 0) {
      // Собираем все значения биомаркеров для всех типов
      var allBiomarkers = LAB_RECORDS.filter(function(r) { 
        return (r.psa !== null || r.ca125 !== null || r.cea !== null); 
      });

      var psaValues = allBiomarkers.filter(function(r) { return r.psa !== null; }).map(function(r) { return r.psa; });
      var ca125Values = allBiomarkers.filter(function(r) { return r.ca125 !== null; }).map(function(r) { return r.ca125; });
      var ceaValues = allBiomarkers.filter(function(r) { return r.cea !== null; }).map(function(r) { return r.cea; });

      // Показываем только если есть данные
      if (psaValues.length > 0 || ca125Values.length > 0 || ceaValues.length > 0) {
        ensureChart('chartBiomarkerLevels', {
          type: 'bar',
          data: {
            labels: biomarkerTypes.map(function(typeId) { return typeNames[typeId]; }).concat(psaValues.length ? ['PSA'] : [], ca125Values.length ? ['CA-125'] : [], ceaValues.length ? ['CEA'] : []),
            datasets: [
              {
                label: 'Среднее значение биомаркеров',
                data: biomarkerTypes.map(function(typeId) { return 0; }).concat(psaValues.length ? psaValues.reduce(function(a,b){return a+b;},0)/psaValues.length : 0, 
                         ca125Values.length ? ca125Values.reduce(function(a,b){return a+b;},0)/ca125Values.length : 0,
                         ceaValues.length ? ceaValues.reduce(function(a,b){return a+b;},0)/ceaValues.length : 0),
                backgroundColor: '#f59e0b'
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              title: { display: true, text: 'Средние уровни биомаркеров (по всем типам рака)' },
              legend: { display: false }
            }
          }
        });
      }
    }

    // Rerender after Chart.js loads
    setTimeout(renderStudyCharts, 100);
  }

  function renderLabTable() {
    var cols = [
      { key: 'year', label: 'Год' },
      { key: 'state', label: 'Штат' },
      { key: 'type', label: 'Тип рака' },
      { key: 'psa', label: 'PSA (нг/мл)' },
      { key: 'ca125', label: 'CA-125' },
      { key: 'cea', label: 'CEA' },
      { key: 'ctPerformed', label: 'КТ выполнено' },
      { key: 'mriPerformed', label: 'МРТ выполнено' },
      { key: 'petctPerformed', label: 'ПЭТ-КТ выполнено' },
      { key: 'usPerformed', label: 'УЗИ выполнено' }
    ];

    var rows = LAB_RECORDS.slice(0, 200);
    
    var head = cols.map(function(c) {
      return '<th>' + c.label + '</th>';
    }).join('');

    function cell(r, key) {
      var v = r[key];
      if (v === true) return '<td>✓</td>';
      if (v === false) return '<td>✗</td>';
      return '<td>' + (typeof v === 'string' ? v : (v == null ? '—' : v)) + '</td>';
    }

    var body = rows.map(function(r) {
      return '<tr>' + cols.map(function(c) { return cell(r, c.key); }).join('') + '</tr>';
    }).join('');

    $('#labTableHead').innerHTML = head;
    $('#labTableBody').innerHTML = body;
    $('#labTableNote').textContent = 'Показано 200 строк из ' + LAB_RECORDS.length + ' записей';
  }

  function renderLabKpis() {
    var totalCost = 0, totalStudies = 0;
    
    LAB_RECORDS.forEach(function(r) {
      if (r.ctCost) { totalCost += r.ctCost; totalStudies++; }
      if (r.mriCost) { totalCost += r.mriCost; totalStudies++; }
      if (r.petctCost) { totalCost += r.petctCost; totalStudies++; }
      if (r.usCost) { totalCost += r.usCost; totalStudies++; }
    });

    var avgCost = totalStudies > 0 ? totalCost / totalStudies : 0;
    var avgPerStudy = LAB_RECORDS.length > 0 ? avgCost / LAB_RECORDS.length : 0;

    var html = [
      '<div class="kpi-card"><div class="kpi-label">Исследований выполнено</div><div class="kpi-value">' + LAB_RECORDS.filter(function(r) { 
        return r.ctPerformed || r.mriPerformed || r.petctPerformed || r.usPerformed; 
      }).length + '</div></div>',
      '<div class="kpi-card"><div class="kpi-label">Общая стоимость</div><div class="kpi-value">$' + Math.round(totalCost) + '</div></div>',
      '<div class="kpi-card"><div class="kpi-label">Ср. стоимость/исследование</div><div class="kpi-value">$' + Math.round(avgCost) + '</div></div>',
      '<div class="kpi-card"><div class="kpi-label">Ср. стоимость/пациент</div><div class="kpi-value">$' + Math.round(avgPerStudy) + '</div></div>'
    ].join('');

    $('#labKpis').innerHTML = html;
  }

  function exportLabCsv() {
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
        if (c === 'ctPerformed' || c === 'mriPerformed' || c === 'petctPerformed' || c === 'usPerformed') {
          return v ? 'true' : 'false';
        }
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
  }

  /* Инициализация событий для лабораторных исследований */
  if ($('#fStudyType')) $('#fStudyType').addEventListener('change', function(e) { filters.studyType = e.target.value; renderLabStudies(); });
  
  if ($('#resetLabBtn')) $('#resetLabBtn').addEventListener('click', function() { 
    var studyTypeFilter = $('#fStudyType');
    if (studyTypeFilter) studyTypeFilter.value = 'all';
    filters.studyType = 'all';
    renderLabStudies();
  });

  if ($('#exportLabBtn')) $('#exportLabBtn').addEventListener('click', exportLabCsv);

  /* Обновляем функцию render() чтобы обрабатывать вкладку исследований */

  /* ----------------------------- События ------------------------------- */
  function bindEvents() {
    if ($('#fYear')) $('#fYear').addEventListener('change', function (e) { filters.year = e.target.value; render(); });
    if ($('#fState')) $('#fState').addEventListener('change', function (e) { filters.state = e.target.value; render(); });
    if ($('#fType')) $('#fType').addEventListener('change', function (e) { filters.type = e.target.value; render(); });
    if ($('#fStage')) $('#fStage').addEventListener('change', function (e) { filters.stage = e.target.value; render(); });
    if ($('#fSex')) $('#fSex').addEventListener('change', function (e) { filters.sex = e.target.value; render(); });
    if ($('#fSource')) $('#fSource').addEventListener('change', function (e) { switchSource(e.target.value); });
    if ($('#resetBtn')) $('#resetBtn').addEventListener('click', function () {
      filters = { year: 'all', state: 'all', type: 'all', stage: 'all', sex: 'all' };
      if ($('#fYear')) $('#fYear').value = 'all';
      if ($('#fState')) $('#fState').value = 'all';
      if ($('#fType')) $('#fType').value = 'all';
      if ($('#fStage')) $('#fStage').value = 'all';
      if ($('#fSex')) $('#fSex').value = 'all';
      render();
    });
    
    /* События для вкладки исследований */
    var studyTabSel = $('#fStudyTab');
    if (studyTabSel) {
      studyTabSel.addEventListener('change', function(e) {
        filters.studyTab = e.target.value;
        onStudyTabChange();
      });
    }
    
    /* Кнопка сброса исследований */
    var resetLabBtn = $('#resetLabBtn');
    if (resetLabBtn) {
      resetLabBtn.addEventListener('click', function() { 
        var studyTypeFilter = $('#fStudyType');
        if (studyTypeFilter) studyTypeFilter.value = 'all';
        filters.studyType = 'all';
        renderLabStudies();
      });
    }

    /* Инициализация таблиц исследований при загрузке данных */
    var labKpisSection = document.getElementById('labInstrumentalSection');
    if (labKpisSection && LAB_RECORDS) {
      renderLabTable();
      renderLabKpis();
      renderLabStudies();
    }

    if ($('#exportBtn')) $('#exportBtn').addEventListener('click', exportCsv);
    if ($('#mapMetric')) $('#mapMetric').addEventListener('change', function () { renderMap(); });
    if ($('#tableHead')) $('#tableHead').addEventListener('click', function (e) {
      var th = e.target.closest('th[data-col]');
      if (!th) return;
      var col = th.getAttribute('data-col');
      if (tableSort.col === col) tableSort.dir *= -1;
      else tableSort = { col: col, dir: (col === 'cases' || col === 'deaths' || col === 'cost') ? -1 : 1 };
      renderTable();
    });

    /* Theme toggle */
    if ($('#themeToggle')) {
      var themeToggle = $('#themeToggle');
      var html = document.documentElement;

      // Force light theme as default (clear any stored dark theme)
      localStorage.removeItem('onco-theme');
      var savedTheme = localStorage.getItem('onco-theme') || 'light';
      html.setAttribute('data-theme', savedTheme);
      updateThemeBtnIcon(savedTheme);

      themeToggle.addEventListener('click', function () {
        var currentTheme = html.getAttribute('data-theme');
        var newTheme = (currentTheme === 'dark') ? 'light' : 'dark';
        
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('onco-theme', newTheme);
        updateThemeBtnIcon(newTheme);

        /* Применяем белый цвет ко всем существующим графикам ПЕРЕД перерисовкой */
        applyCanvasWhiteText();
        
        /* Перерисовываем графики с новыми цветами при переключении темы */
        if (chartState === 'ready' && RECORDS) {
          setTimeout(function () {
            // Сначала уничтожаем старые графики
            var chartIds = ['chartTrend', 'chartTypes', 'chartStages', 'chartStates', 'chartSurvival', 'chartSex'];
            chartIds.forEach(function(id) {
              if (charts[id] && typeof charts[id].destroy === 'function') {
                try {
                  charts[id].destroy();
                } catch(e) {}
              }
            });
            
            // Перерисовываем
            renderCharts();
          }, 200);
        }
      });

      /* MutationObserver для отслеживания появления элементов внутри canvas */
      if (typeof MutationObserver !== 'undefined') {
        var chartCanvasObservers = [];
        
        function setupCanvasChartObserver(canvas) {
          var observer = new MutationObserver(function(mutations, obs) {
            mutations.forEach(function(mutation) {
              if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(function(node) {
                  // SVG text/tspan - применяем белый fill!
                  if (node.nodeType === 1 && (node.tagName.toLowerCase() === 'text' || node.tagName.toLowerCase() === 'tspan')) {
                    try {
                      var currentFill = node.getAttribute('fill');
                      if (!currentFill || 
                          ['#0f172a', '#3b82f6', '#0d9488', '#1e3a8a', 'black'].indexOf(currentFill) >= 0) {
                        node.setAttribute('fill', '#f8fafc');
                        console.error('[CHART OBSERVER]', 'Установлен white fill для SVG text/tspan в canvas:', canvas.id);
                      }
                    } catch(e) {}
                  }
                  
                  // HTML h2/h3/p - применяем белый color!
                  if (node.nodeType === 1 && (node.tagName.toLowerCase() === 'h2' || node.tagName.toLowerCase() === 'h3' || node.tagName.toLowerCase() === 'p')) {
                    try {
                      if (!node.classList.contains('chart-tooltip')) {
                        node.style.color = '#f8fafc !important';
                        console.error('[CHART OBSERVER]', 'Установлен white color для HTML элемент в canvas:', canvas.id, ':', (node.textContent || '').substring(0, 50));
                      }
                    } catch(e) {}
                  }
                  
                  // Div элементы - применяем белый color!
                  if (node.nodeType === 1 && node.tagName.toLowerCase() === 'div' && 
                      !node.classList.contains('tooltip') && 
                      !node.classList.contains('chart-tooltip')) {
                    try {
                      if ((node.textContent || '').length > 0) {
                        node.style.color = '#f8fafc !important';
                        console.error('[CHART OBSERVER]', 'Установлен white color для div в canvas:', canvas.id, ':', (node.textContent || '').substring(0, 60));
                      }
                    } catch(e) {}
                  }
                });
              }
            });
          });
          
          observer.observe(canvas, { childList: true, subtree: true });
          chartCanvasObservers.push(observer);
        }
        
        /* Применяем наблюдение ко всем canvas */
        var allCanvases = document.querySelectorAll('canvas[id^="chart"]');
        allCanvases.forEach(function(canvas) {
          setupCanvasChartObserver(canvas);
        });
        
        console.error('[CHART OBSERVER]', 'Наблюдатели установлены для', allCanvases.length, 'canvas элементов');
      }

      /* Observer для автоматической перерисовки при изменении атрибута data-theme */
      if (typeof MutationObserver !== 'undefined') {
        var observer = new MutationObserver(function(mutations) {
          mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
              console.error('[THEME] data-theme изменён, перерисовываем графики…');
              
              /* Перерисовываем графики при изменении темы */
              if (chartState === 'ready' && RECORDS) {
                setTimeout(function () {
                  var chartIds = ['chartTrend', 'chartTypes', 'chartStages', 'chartStates', 'chartSurvival', 'chartSex'];
                  chartIds.forEach(function(id) {
                    if (charts[id] && typeof charts[id].destroy === 'function') {
                      try {
                        charts[id].destroy();
                      } catch(e) {}
                    }
                  });
                  
                  renderCharts();
                }, 250);
              }
            }
          });
        });

        /* Начинаем слежение за HTML элементом */
        observer.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
      }

      /* Глобальный MutationObserver для принудительного применения белого цвета ко ВСЕМ текстовым элементам внутри canvas */
      if (typeof MutationObserver !== 'undefined') {
        var themeTextObserver = new MutationObserver(function(mutations) {
          mutations.forEach(function(mutation) {
            if (mutation.attributeName === 'data-theme' && mutation.target.getAttribute('data-theme') === 'dark') {
              console.error('[THEME TEXT]', 'Тёмная тема активна, применяем белый цвет ко всем текстовым элементам графиков');
              
              setTimeout(function() {
                var canvases = document.querySelectorAll('canvas[id^="chart"]');
                
                canvases.forEach(function(canvas) {
                  // SVG text элементы - меняем fill (самый важный!)
                  var svgTexts = canvas.querySelectorAll('svg text, svg tspan');
                  svgTexts.forEach(function(textNode) {
                    if (textNode.tagName.toLowerCase() === 'text' || textNode.tagName.toLowerCase() === 'tspan') {
                      try {
                        // ВСЕМ SVG text/tspan применяем белый fill - без фильтрации!
                        // Это ключевой момент: Chart.js использует SVG для заголовков и легенд
                        if (!textNode.getAttribute('fill') || 
                            (textNode.getAttribute('fill') === '#0f172a' && textNode.textContent)) {
                          textNode.setAttribute('fill', '#f8fafc');
                          console.error('[THEME]', 'SVG text/tspan white fill для:', 
                                      textNode.textContent ? textNode.textContent.substring(0, 40) : '?');
                        } else if (textNode.getAttribute('fill') === '#3b82f6' || // Синий цвет Chart.js по умолчанию
                                  textNode.getAttribute('fill') === '#0d9488') { // Или другие цвета
                          console.error('[THEME]', 'НАЙДЕН SVG элемент с синим fill:', 
                                      (textNode.textContent || '').substring(0, 50));
                          textNode.setAttribute('fill', '#f8fafc');
                        }
                      } catch(e) {}
                    }
                  });
                  
                  // HTML h2, h3, p элементы (не внутри SVG) - ВСЕМ применяем белый!
                  var htmlElements = canvas.querySelectorAll('h2, h3, p');
                  htmlElements.forEach(function(el) {
                    try {
                      if (!el.classList.contains('chart-tooltip')) {
                        el.style.color = '#f8fafc';
                        console.error('[THEME]', 'HTML element white color для:', 
                                    el.tagName + ':', (el.textContent || '').substring(0, 50));
                      }
                    } catch(e) {}
                  });
                  
                  // Div элементы с текстом - ВСЕМ применим если это не tooltip
                  var divElements = canvas.querySelectorAll('div:not([class*="tooltip"]):not([class*="chart-tooltip"])');
                  divElements.forEach(function(div) {
                    try {
                      if ((div.textContent || '').length > 5 && 
                          !div.classList.contains('ChartjsTooltip')) {
                        div.style.color = '#f8fafc';
                        console.error('[THEME]', 'Div white color для:', 
                                    div.tagName + ':', (div.textContent || '').substring(0, 60));
                      }
                    } catch(e) {}
                  });
                  
                  // Также проверяем span элементы внутри SVG - ВСЕМ применим белый fill!
                  var svgSpans = canvas.querySelectorAll('svg span');
                  svgSpans.forEach(function(span) {
                    try {
                      if (!span.getAttribute('fill') || 
                          (span.getAttribute('fill') === '#0f172a' && span.textContent)) {
                        span.setAttribute('fill', '#f8fafc');
                        console.error('[THEME]', 'SVG span white fill для:', 
                                    span.textContent ? span.textContent.substring(0, 40) : '?');
                      }
                    } catch(e) {}
                  });
                });
                
                console.error('[THEME TEXT]', 'Применена глобальная стилизация ко всем графикам - белый цвет ко всему SVG и HTML тексту');
              }, 450);
            }
          });
        });

        themeTextObserver.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
        console.error('[THEME]', 'Текстовый MutationObserver установлен для принудительного применения белого цвета ко ВСЕМ элементам');
      }

      /* setInterval для постоянного применения белого цвета ко всем элементам canvas */
      if (typeof document !== 'undefined' && typeof setInterval !== 'undefined') {
        var themeInterval = setInterval(function() {
          if (document.documentElement.getAttribute('data-theme') === 'dark') {
            // Применяем белый цвет ко всем SVG text/tspan элементам в canvas
            var allCanvases = document.querySelectorAll('canvas[id^="chart"]');
            allCanvases.forEach(function(canvas) {
              // SVG text элементы - ВСЕМ применяем белый fill!
              var allSvgTexts = canvas.querySelectorAll('text, tspan');
              allSvgTexts.forEach(function(textNode) {
                try {
                  if (textNode.tagName.toLowerCase() === 'text' || textNode.tagName.toLowerCase() === 'tspan') {
                    var currentFill = textNode.getAttribute('fill');
                    // ВСЕМ применяем белый fill - без фильтрации!
                    if (!currentFill || 
                        ['#0f172a', '#3b82f6', '#0d9488', '#1e3a8a', 'black'].indexOf(currentFill) >= 0) {
                      textNode.setAttribute('fill', '#f8fafc');
                    }
                  }
                } catch(e) {}
              });
              
              // HTML элементы - ВСЕМ применяем белый!
              var htmlElements = canvas.querySelectorAll('h2, h3, p, div:not([class*="tooltip"])');
              htmlElements.forEach(function(el) {
                try {
                  if (!el.classList.contains('chart-tooltip') && 
                      !el.classList.contains('ChartjsTooltip')) {
                    el.style.color = '#f8fafc !important';
                  }
                } catch(e) {}
              });
            });
          } else {
            clearInterval(themeInterval);
            console.error('[THEME INTERVAL]', 'Тёмная тема отключена, остановлен интервал');
          }
        }, 100);
        
        console.error('[THEME INTERVAL]', 'Установлен интервал для применения белого цвета: каждые 100мс');
      }

      function updateThemeBtnIcon(theme) {
        if (theme === 'dark') {
          themeToggle.textContent = '☀️';
        } else {
          themeToggle.textContent = '🌙';
        }
      }
    }
  }

  function render() {
    if (!RECORDS) {
      console.error('[RENDER ERROR]', 'Попытка рендера без загруженных данных. Вызовите switchSource(???) или обновите страницу.');
      return;
    }

    // Единый проход по записям (два, если год зафиксирован) вместо
    // ~150 проходов: все срезы (годы/типы/стадии/штаты) строятся сразу.
    // При year='all' STATS === STATS_ALL — ровно один проход.
    var S = (typeof window.OncologyStats !== 'undefined') ? window.OncologyStats : null;
    if (S) {
      var rowsAll = baseRows('all');
      STATS_ALL = S.compute(rowsAll);
      STATS = (filters.year === 'all') ? STATS_ALL : S.compute(baseRows(filters.year));
    } else {
      console.error('[RENDER WARNING]', 'window.OncologyStats не загружен, агрегация будет менее эффективной');
      STATS_ALL = null;
      STATS = null;
    }

    renderKpis();
    renderCharts();
    renderMap();
    renderTable();
    
    /* Обновляем отображение вкладок */
    var mainSection = $('#kpis');
    var labSection = document.getElementById('labInstrumentalSection');
    var studyTabSel = $('#fStudyTab');
    
    if (studyTabSel) {
      filters.studyTab = filters.studyTab || studyTabSel.value;
    }
    
    if (filters.studyTab === 'main') {
      if (mainSection) mainSection.style.display = '';
      if (labSection) labSection.style.display = 'none';
    } else if (filters.studyTab === 'lab_instrumental') {
      // Показываем вкладку лабораторных исследований
      if (labSection) labSection.style.display = '';
      
      // Если нужны данные для исследований, загружаем их
      if (!LAB_RECORDS && LAB_RECORDS !== undefined) {
        loadLabStudies();
      }
    }
  }

  /* Графики рендерятся только когда Chart.js готов (загружается
      асинхронно, не блокируя KPI/карту/таблицу) */
  function renderCharts() {
    console.error('[CHARTS RENDER] chartState=' + chartState + ', RECORDS.length=' + (RECORDS && RECORDS.length || 0));

    if (chartState !== 'ready') return;
    
    if (!RECORDS) {
      console.error('[CHARTS] Данные отсутствуют, требуется перезагрузка страницы');
      // Пробуем загрузить демо-данные если они ещё не загружены
      var cfg = window.OncologyData && window.OncologyData.config;
      if (cfg && cfg.source === 'synthetic') {
        console.error('[CHARTS] Принудительная загрузка данных...');
        try {
          var data = window.OncologyData.load('synthetic');
          
          if (data && typeof data.then === 'function') {
            data.then(function(d) {
              d.warnings = d.warnings || [];
              d.warnings.unshift('Источник: встроенные демонстрационные данные (демо-режим). 2026 год — проекция.');
              applyDataset(d);
              renderCharts(); // Retry after data load
            });
          } else if (data && data.records) {
            applyDataset(data);
            renderCharts(); // Retry after data load
          }
        } catch (e) {
          console.error('[CHARTS ERROR]', e.message, e.stack);
        }
      }
      return;
    }

    // Важно: уничтожаем ВСЕ существующие графики перед созданием новых
    var chartIds = ['chartTrend', 'chartTypes', 'chartStages', 'chartStates', 'chartSurvival', 'chartSex'];
    chartIds.forEach(function(id) {
      if (charts[id] && typeof charts[id].destroy === 'function') {
        try {
          console.error('[CHARTS]', 'Уничтожаю старый график:', id);
          // Chart.js v4 требует вызова destroy() до удаления canvas
          charts[id].destroy();
          delete charts[id];
        } catch (e) {
          console.error('[CHARTS ERROR]', 'Ошибка уничтожения графика ' + id + ':', e.message, e.stack);
        }
      } else if (id === 'chartTrend') {
        // Если для chartTrend не найдён объект charts[id], проверим canvas напрямую
        var trendCanvas = document.getElementById('chartTrend');
        if (trendCanvas && typeof Chart !== 'undefined') {
          try {
            // Попробуем найти и уничтожить графика с этим canvas
            Object.keys(Chart.registry).forEach(function(key) {
              var ctx = trendCanvas.getContext('2d');
              var chartInstance = Chart.getChart(trendCanvas);
              if (chartInstance) {
                console.error('[CHARTS]', 'Найден график для chartTrend, уничтожаю:', chartInstance.config.type);
                chartInstance.destroy();
              }
            });
          } catch (e2) {
            console.error('[CHARTS ERROR]', 'Ошибка при поиске графика для chartTrend:', e2.message);
          }
        }
      }
    });

    /* Применяем белый цвет ко всем текстовым элементам ВСЕХ графиков ПЕРЕД рендерингом */
    var canvases = document.querySelectorAll('canvas[id^="chart"]');
    if (canvases.length > 0) {
      console.error('[CHARTS]', 'Применяем белый цвет ко всем текстовым элементам в', canvases.length, 'графиках перед рендерингом');
      
      canvases.forEach(function(canvas) {
        // SVG text элементы - меняем fill
        var svgTexts = canvas.querySelectorAll('svg text, svg tspan');
        svgTexts.forEach(function(textNode) {
          if (textNode.tagName.toLowerCase() === 'text') {
            try {
              if (!textNode.getAttribute('fill') || 
                  (textNode.getAttribute('fill') === '#0f172a' && textNode.textContent)) {
                textNode.setAttribute('fill', '#f8fafc');
              } else if (textNode.getAttribute('fill') && ['#3b82f6', '#0d9488', '#1e3a8a'].indexOf(textNode.getAttribute('fill')) >= 0) {
                console.error('[PRE-RENDER]', 'SVG элемент с синим fill:', textNode.textContent.substring(0, 50));
                textNode.setAttribute('fill', '#f8fafc');
              }
            } catch (e) {}
          } else if (textNode.tagName.toLowerCase() === 'tspan') {
            try {
              if (!textNode.getAttribute('fill')) {
                textNode.setAttribute('fill', '#f8fafc');
              }
            } catch (e) {}
          }
        });
        
        // HTML h2, h3, p элементы - ВСЕМ применяем белый!
        var htmlElements = canvas.querySelectorAll('h2, h3, p');
        htmlElements.forEach(function(el) {
          try {
            if (!el.classList.contains('chart-tooltip')) {
              el.style.color = '#f8fafc';
            }
          } catch (e) {}
        });
        
        // Div элементы с текстом - ВСЕМ применяем белый!
        var divElements = canvas.querySelectorAll('div:not([class*="tooltip"]):not([class*="chart-tooltip"])');
        divElements.forEach(function(div) {
          try {
            if ((div.textContent || '').length > 0 && 
                !div.classList.contains('ChartjsTooltip')) {
              div.style.color = '#f8fafc';
            }
          } catch (e) {}
        });
      });
    }

    try {
      /* УНИЧТОЖАЕМ ВСЕ ГРАФИКИ ПЕРЕД РЕНДЕРОМ */
      var chartCanvases = ['chartTrend', 'chartTypes', 'chartStages', 'chartStates', 'chartSurvival', 'chartSex'];
      
      chartCanvases.forEach(function(canvasId) {
        var canvas = document.getElementById(canvasId);
        if (canvas && typeof Chart !== 'undefined') {
          try {
            var existingChart = Chart.getChart(canvas);
            if (existingChart) {
              console.error('[CHARTS]', 'Уничтожаю существующий график для ' + canvasId + ':', 
                           existingChart.config.type || '?', '|', existingChart.id);
              existingChart.destroy();
              console.error('[CHARTS]', 'График ' + canvasId + ' успешно уничтожен');
            }
          } catch (e) {
            console.error('[CHARTS ERROR]', 'Ошибка при уничтожении графика для ' + canvasId + ':', e.message);
          }
        }
      });

      renderTrendChart();
      renderTypeChart();
      renderStageChart();
      renderStatesChart();

      renderSurvivalChart();
      renderSexChart();
      console.error('[CHARTS] ✓ Все 6 графиков созданы успешно');
    } catch (e) {
      console.error('[CHARTS RENDER ERROR]', 'Ошибка при создании графиков:', e.message, e.stack);
    }
  }

  /* ----------------------------- init ---------------------------------- */
  function init() {
    bindEvents();
    
    /* Инициализация вкладок исследований */
    var studyTabSel = $('#fStudyTab');
    if (studyTabSel) {
      onStudyTabChange();
    }

    if (chartState !== 'ready') setChartsLoading(true);

    var cfg = window.OncologyData.config;
    
    // Всегда используем source из config.js (synthetic/auto/trials/wonder/api)
    var initial = cfg.source || 'synthetic'; // default к synthetic если не задано
    
    console.error('[INIT] Начальный режим:', initial, 'из config.js:', cfg);

    var sel = $('#fSource');
    if (sel && (cfg.source === 'trials' || cfg.source === 'wonder' || cfg.source === 'api')) {
      sel.value = initial;
    } else {
      // Для synthetic/auto не меняем селект — оставляем дефолтное значение
    }
    
    switchSource(initial);
  }

  /* Обработчик переключения вкладок исследований */
  function onStudyTabChange() {
    var mainSection = $('#kpis'); // Основные показатели остаются видимыми всегда
    var labSection = document.getElementById('labInstrumentalSection');
    var studyTabSel = $('#fStudyTab');
    
    if (studyTabSel && !filters.studyTab) {
      filters.studyTab = studyTabSel.value;
    }
    
    if (filters.studyTab === 'main') {
      if (mainSection) mainSection.style.display = '';
      if (labSection) labSection.style.display = 'none';
    } else if (filters.studyTab === 'lab_instrumental') {
      // Показываем вкладку лабораторных исследований
      if (labSection) labSection.style.display = '';
      
      // Если нужно, можно скрыть основные KPI
      // if (mainSection) mainSection.style.display = 'none';
      
      renderLabStudies();
    }
  }

  /* -------------------------- Лабораторные и инструментальные исследования --- */
  
  /* Переменные для лабораторных данных */
  var LAB_RECORDS = null;
  
  function loadLabStudies() {
    if (window.OncologyData && window.OncologyData.labLoad) {
      console.error('[LAB DATA] Загрузка лабораторных исследований...');
      return window.OncologyData.labLoad().then(function(data) {
        LAB_RECORDS = data.records;
        window.ONCO_DIMS_TYPES = data.dims.types;
        window.ONCO_DIMS_STATES = data.dims.states;
        console.error('[LAB DATA] Загружено исследований: ' + (LAB_RECORDS && LAB_RECORDS.length || 0));
        if (filters.studyTab === 'lab_instrumental') {
          renderLabStudies();
        }
        return data;
      });
    }
    // Фоллбэк на встроенные данные из lab-instrumental-data.js
    console.error('[LAB DATA] Используем встроенные демо-данные для исследований');
    var data = window.ONCO_LAB_DATA ? 
                window.ONCO_LAB_DATA.loadLabInstrumentalData('synthetic') :
                loadLabStudiesDummy();
    LAB_RECORDS = data.records;
    window.ONCO_DIMS_TYPES = data.dims.types;
    window.ONCO_DIMS_STATES = data.dims.states;
    console.error('[LAB DATA] Загружено исследований (демо): ' + (LAB_RECORDS && LAB_RECORDS.length || 0));
    if (filters.studyTab === 'lab_instrumental') {
      renderLabStudies();
    }
    return data;
  }

  function loadLabStudiesDummy() {
    // Демо-данные для лабораторных исследований
    var records = [];
    var dims = {
      years: [2024, 2025, 2026],
      states: [],
      types: [
        { id: 'breast', name: 'Рак молочной железы' },
        { id: 'prostate', name: 'Рак простаты' },
        { id: 'lung', name: 'Рак лёгких' },
        { id: 'colorectal', name: 'Колоректальный рак' },
        { id: 'melanoma', name: 'Меланома' },
        { id: 'pancreatic', name: 'Рак поджелудочной железы' }
      ]
    };

    // Заполняем штаты из BUILTIN_DIMS.states если есть
    var builtinStates = window.ONCO_LAB_DATA && window.ONCO_LAB_DATA.INSTRUMENTAL_STUDIES ? 
                        null : (window.BUILTIN_DIMS ? window.BUILTIN_DIMS.states : []);
    
    if (builtinStates && builtinStates.length > 0) {
      dims.states = builtinStates;
    } else {
      // Минимальный набор штатов для демо
      dims.states = [
        { code: 'CA', name: 'Калифорния', popM: 39.4 },
        { code: 'NY', name: 'Нью-Йорк', popM: 19.6 },
        { code: 'TX', name: 'Техас', popM: 30.5 }
      ];
    }

    // Генерируем данные для каждого типа рака и штата за каждый год
    dims.types.forEach(function(type) {
      dims.states.forEach(function(state) {
        dims.years.forEach(function(year) {
          var baseCases = Math.floor(Math.random() * 50) + 10;
          records.push({
            type: type.id,
            state: state.code,
            year: year,
            stateName: state.name,
            typeName: type.name,
            // Лабораторные показатели
            psa: year === 2026 ? Math.random() * 15 + 3 : (type.id === 'prostate' ? Math.random() * 4 + 1 : null),
            ca125: year === 2026 ? Math.random() * 200 + 20 : null,
            cea: year === 2026 ? Math.random() * 3 + 1 : null,
            // КТ
            ctPerformed: Math.random() > 0.4,
            ctCost: Math.random() > 0.4 ? Math.floor(Math.random() * 3000 + 1500) : null,
            ctFindings: 'Метастазы обнаружены' + (Math.random() > 0.5 ? '' : ' / нет метастазов'),
            // МРТ
            mriPerformed: Math.random() > 0.3,
            mriCost: Math.random() > 0.3 ? Math.floor(Math.random() * 4000 + 2000) : null,
            mriFindings: 'Изменения в печени' + (Math.random() > 0.5 ? '' : ' / норма'),
            // ПЭТ-КТ
            petctPerformed: Math.random() > 0.6,
            petctCost: Math.random() > 0.6 ? Math.floor(Math.random() * 4000 + 3000) : null,
            petctFindings: 'Высокое SUVmax' + (Math.random() > 0.5 ? '' : ' / низкий захват'),
            // УЗИ
            usPerformed: Math.random() > 0.2,
            usCost: Math.random() > 0.2 ? Math.floor(Math.random() * 600 + 200) : null,
            usFindings: 'Увеличенные лимфоузлы' + (Math.random() > 0.5 ? '' : ' / норма')
          });
        });
      });
    });

    return { records: records, dims: dims, source: 'synthetic', meta: {} };
  }

  function renderLabStudies() {
    if (!LAB_RECORDS) {
      loadLabStudies().then(function() { renderLabStudies(); });
      return;
    }

    // Сбрасываем фильтры для лабораторных исследований
    var studyTypeFilter = $('#fStudyType');
    if (studyTypeFilter && !filters.studyType) {
      filters.studyType = 'all';
      studyTypeFilter.value = 'all';
    }

    // Агрегируем данные по типам исследований
    var studyAggregates = {};
    
    ['biomarker', 'ct', 'mri', 'petct', 'ultrasound'].forEach(function(studyKey) {
      if (!studyAggregates[studyKey]) return;

      var typeLabels = { biomarker: 'Биомаркеры', ct: 'КТ', mri: 'МРТ', petct: 'ПЭТ-КТ', ultrasound: 'УЗИ' };
      
      var labels = window.ONCO_DIMS_TYPES ? window.ONCO_DIMS_TYPES.map(function(t) { return t.name; }) : ['Breast', 'Prostate'];
      var data = [];

      window.ONCO_DIMS_TYPES.forEach(function(type) {
        var typeId = type.id;
        
        // Агрегируем данные для данного типа исследования и типа рака
        var recordsForType = LAB_RECORDS.filter(function(r) {
          return r.type === typeId && (filters.studyType === 'all' || 
            studyKey === 'biomarker' ? (r.psa !== null || r.ca125 !== null || r.cea !== null) :
            studyKey === 'ct' ? r.ctPerformed :
            studyKey === 'mri' ? r.mriPerformed :
            studyKey === 'petct' ? r.petctPerformed :
            studyKey === 'ultrasound' ? r.usPerformed : true);
        });

        var count = recordsForType.length;
        var avgCost = recordsForType.reduce(function(sum, r) { return sum + (r[studyKey + 'Cost'] || 0); }, 0) / 
                      (count > 0 ? count : 1);
        var findings = recordsForType.filter(function(r) { return r[studyKey + 'Performed']; })
                       .map(function(r) { return r[studyKey + 'Findings']; });

        data.push({
          label: type.name,
          value: count,
          cost: Math.round(avgCost)
        });
      });

      studyAggregates[studyKey] = { labels: labels, data: data };
    });

    // Рендерим графики
    renderStudyCharts(studyAggregates);
  }

  function renderStudyCharts() {
    function ensureChart(id, cfg) {
      if (charts[id]) {
        try {
          if (typeof charts[id].destroy === 'function') {
            charts[id].destroy();
          }
        } catch (e) {}
        delete charts[id];
      }
      
      var chart = new Chart(document.getElementById(id), cfg);
      return chart;
    }

    // График частоты исследований - используем уникальные типы из данных
    var uniqueTypes = [...new Set(LAB_RECORDS.map(function(r) { return r.type; }))];
    var typeNames = {};
    uniqueTypes.forEach(function(typeId) {
      var record = LAB_RECORDS.filter(function(r) { return r.type === typeId; })[0] || {};
      typeNames[typeId] = record.typeName || (typeId[0].toUpperCase() + typeId.slice(1));
    });

    // Считаем количество выполненных исследований для каждого типа
    var counts = uniqueTypes.map(function(typeId) {
      var recordsForType = LAB_RECORDS.filter(function(r) { return r.type === typeId; });
      var ctCount = recordsForType.filter(function(r) { return r.ctPerformed; }).length;
      return { label: typeNames[typeId], count: ctCount };
    });

    ensureChart('chartStudyFrequency', {
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
          title: { display: true, text: 'Частота выполнения исследований по типам рака' },
          legend: { display: false }
        }
      }
    });

    // График стоимости - агрегируем стоимость для каждого типа
    var costs = uniqueTypes.map(function(typeId) {
      var recordsForType = LAB_RECORDS.filter(function(r) { return r.type === typeId; });
      var totalCost = recordsForType.reduce(function(sum, r) {
        return sum + (r.ctCost || 0) + (r.mriCost || 0) + (r.petctCost || 0) + (r.usCost || 0);
      }, 0);
      return { label: typeNames[typeId], cost: totalCost };
    });

    ensureChart('chartStudyCost', {
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
          title: { display: true, text: 'Общая стоимость исследований по типам рака' },
          legend: { display: false }
        }
      }
    });

    // График уровней биомаркеров (используем только типы с данными)
    var biomarkerTypes = uniqueTypes.filter(function(typeId) {
      return LAB_RECORDS.some(function(r) { 
        return r.type === typeId && (r.psa !== null || r.ca125 !== null || r.cea !== null); 
      });
    });

    if (biomarkerTypes.length > 0) {
      // Собираем все значения биомаркеров для всех типов
      var allBiomarkers = LAB_RECORDS.filter(function(r) { 
        return (r.psa !== null || r.ca125 !== null || r.cea !== null); 
      });

      var psaValues = allBiomarkers.filter(function(r) { return r.psa !== null; }).map(function(r) { return r.psa; });
      var ca125Values = allBiomarkers.filter(function(r) { return r.ca125 !== null; }).map(function(r) { return r.ca125; });
      var ceaValues = allBiomarkers.filter(function(r) { return r.cea !== null; }).map(function(r) { return r.cea; });

      // Показываем только если есть данные
      if (psaValues.length > 0 || ca125Values.length > 0 || ceaValues.length > 0) {
        ensureChart('chartBiomarkerLevels', {
          type: 'bar',
          data: {
            labels: biomarkerTypes.map(function(typeId) { return typeNames[typeId]; }).concat(psaValues.length ? ['PSA'] : [], ca125Values.length ? ['CA-125'] : [], ceaValues.length ? ['CEA'] : []),
            datasets: [
              {
                label: 'Среднее значение биомаркеров',
                data: biomarkerTypes.map(function(typeId) { return 0; }).concat(psaValues.length ? psaValues.reduce(function(a,b){return a+b;},0)/psaValues.length : 0, 
                         ca125Values.length ? ca125Values.reduce(function(a,b){return a+b;},0)/ca125Values.length : 0,
                         ceaValues.length ? ceaValues.reduce(function(a,b){return a+b;},0)/ceaValues.length : 0),
                backgroundColor: '#f59e0b'
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              title: { display: true, text: 'Средние уровни биомаркеров (по всем типам рака)' },
              legend: { display: false }
            }
          }
        });
      }
    }

    // Rerender after Chart.js loads
    setTimeout(renderStudyCharts, 100);
  }

  function renderLabTable() {
    var cols = [
      { key: 'year', label: 'Год' },
      { key: 'state', label: 'Штат' },
      { key: 'type', label: 'Тип рака' },
      { key: 'psa', label: 'PSA (нг/мл)' },
      { key: 'ca125', label: 'CA-125' },
      { key: 'cea', label: 'CEA' },
      { key: 'ctPerformed', label: 'КТ выполнено' },
      { key: 'mriPerformed', label: 'МРТ выполнено' },
      { key: 'petctPerformed', label: 'ПЭТ-КТ выполнено' },
      { key: 'usPerformed', label: 'УЗИ выполнено' }
    ];

    var rows = LAB_RECORDS.slice(0, 200);
    
    var head = cols.map(function(c) {
      return '<th>' + c.label + '</th>';
    }).join('');

    function cell(r, key) {
      var v = r[key];
      if (v === true) return '<td>✓</td>';
      if (v === false) return '<td>✗</td>';
      return '<td>' + (typeof v === 'string' ? v : (v == null ? '—' : v)) + '</td>';
    }

    var body = rows.map(function(r) {
      return '<tr>' + cols.map(function(c) { return cell(r, c.key); }).join('') + '</tr>';
    }).join('');

    $('#labTableHead').innerHTML = head;
    $('#labTableBody').innerHTML = body;
    $('#labTableNote').textContent = 'Показано 200 строк из ' + LAB_RECORDS.length + ' записей';
  }

  function renderLabKpis() {
    var totalCost = 0, totalStudies = 0;
    
    LAB_RECORDS.forEach(function(r) {
      if (r.ctCost) { totalCost += r.ctCost; totalStudies++; }
      if (r.mriCost) { totalCost += r.mriCost; totalStudies++; }
      if (r.petctCost) { totalCost += r.petctCost; totalStudies++; }
      if (r.usCost) { totalCost += r.usCost; totalStudies++; }
    });

    var avgCost = totalStudies > 0 ? totalCost / totalStudies : 0;
    var avgPerStudy = LAB_RECORDS.length > 0 ? avgCost / LAB_RECORDS.length : 0;

    var html = [
      '<div class="kpi-card"><div class="kpi-label">Исследований выполнено</div><div class="kpi-value">' + LAB_RECORDS.filter(function(r) { 
        return r.ctPerformed || r.mriPerformed || r.petctPerformed || r.usPerformed; 
      }).length + '</div></div>',
      '<div class="kpi-card"><div class="kpi-label">Общая стоимость</div><div class="kpi-value">$' + Math.round(totalCost) + '</div></div>',
      '<div class="kpi-card"><div class="kpi-label">Ср. стоимость/исследование</div><div class="kpi-value">$' + Math.round(avgCost) + '</div></div>',
      '<div class="kpi-card"><div class="kpi-label">Ср. стоимость/пациент</div><div class="kpi-value">$' + Math.round(avgPerStudy) + '</div></div>'
    ].join('');

    $('#labKpis').innerHTML = html;
  }

  function exportLabCsv() {
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
        if (c === 'ctPerformed' || c === 'mriPerformed' || c === 'petctPerformed' || c === 'usPerformed') {
          return v ? 'true' : 'false';
        }
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
  }

  /* Инициализация событий для лабораторных исследований */

  /* Функция для применения белого цвета ко всем текстовым элементам canvas */
  function applyCanvasWhiteText() {
    var canvases = document.querySelectorAll('canvas[id^="chart"]');
    if (canvases.length === 0) return;
    
    console.error('[CANVAS TEXT]', 'Применяем белый цвет ко всем текстовым элементам в', canvases.length, 'графиках');
    
    canvases.forEach(function(canvas) {
      // SVG text элементы - меняем fill ВСЕМ
      var svgTexts = canvas.querySelectorAll('svg text, svg tspan');
      svgTexts.forEach(function(textNode) {
        if (textNode.tagName.toLowerCase() === 'text') {
          try {
            if (!textNode.getAttribute('fill') || 
                (textNode.getAttribute('fill') === '#0f172a' && textNode.textContent)) {
              textNode.setAttribute('fill', '#f8fafc');
              console.error('[CANVAS]', 'SVG text white fill:', textNode.textContent ? textNode.textContent.substring(0, 40) : '?');
            } else if (textNode.getAttribute('fill') && ['#3b82f6', '#0d9488', '#1e3a8a'].indexOf(textNode.getAttribute('fill')) >= 0) {
              textNode.setAttribute('fill', '#f8fafc');
            }
          } catch (e) {}
        } else if (textNode.tagName.toLowerCase() === 'tspan') {
          try {
            if (!textNode.getAttribute('fill')) {
              textNode.setAttribute('fill', '#f8fafc');
            }
          } catch (e) {}
        }
      });
      
      // HTML h2, h3, p элементы - ВСЕМ применяем белый!
      var htmlElements = canvas.querySelectorAll('h2, h3, p');
      htmlElements.forEach(function(el) {
        try {
          if (!el.classList.contains('chart-tooltip')) {
            el.style.color = '#f8fafc';
          }
        } catch (e) {}
      });
      
      // Div элементы с текстом - ВСЕМ применяем белый!
      var divElements = canvas.querySelectorAll('div:not([class*="tooltip"]):not([class*="chart-tooltip"])');
      divElements.forEach(function(div) {
        try {
          if ((div.textContent || '').length > 0 && 
              !div.classList.contains('ChartjsTooltip')) {
            div.style.color = '#f8fafc';
          }
        } catch (e) {}
      });
      
      // Также проверяем span элементы внутри SVG - ВСЕМ применим белый fill!
      var svgSpans = canvas.querySelectorAll('svg span');
      svgSpans.forEach(function(span) {
        try {
          if (!span.getAttribute('fill') || 
              (span.getAttribute('fill') === '#0f172a' && span.textContent)) {
            span.setAttribute('fill', '#f8fafc');
            console.error('[CANVAS]', 'SVG span white fill:', span.textContent ? span.textContent.substring(0, 40) : '?');
          }
        } catch (e) {}
      });
    });
    
    console.error('[CANVAS TEXT]', 'Применена стилизация ко всем графикам');
  }

  /* Старт фоновой загрузки Chart.js сразу при разборе скрипта —
      параллельно с генерацией демо-данных и первым рендером */
  if (typeof document !== 'undefined') startChartLib();
  
  /* Применяем белый цвет ко всем текстовым элементам canvas при инициализации */
  applyCanvasWhiteText();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
