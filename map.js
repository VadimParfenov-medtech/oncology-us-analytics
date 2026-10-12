/* =========================================================================
 * Oncology US Analytics — карта США с тепловыми значениями.
 *
 * Основной вариант: реальная географическая карта (d3-geo + us-atlas
 * topojson с jsDelivr CDN). Если d3 или топология недоступны — автоматический
 * fallback на tile-grid карту (квадратная сетка штатов), полностью офлайн.
 *
 * API: USMap.render({
 *   values:  { 'CA': 1234, ... }   — число или null для каждого штата,
 *   names:   { 'CA': 'Калифорния' },
 *   selected:'CA' | 'all',
 *   onSelect: function(code){},
 *   fmt:     function(value) => строка
 * })
 * ========================================================================= */
(function () {
  'use strict';

  var FIPS2CODE = {
    '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT',
    '10': 'DE', '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL',
    '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD',
    '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE',
    '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
    '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD',
    '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV',
    '55': 'WI', '56': 'WY'
  };

  /* Позиции штатов на tile-grid карте: [row, col] (12 колонок × 8 рядов) */
  var TILE_POS = {
    'AK': [0, 0], 'ME': [0, 11],
    'VT': [1, 10], 'NH': [1, 11],
    'WA': [2, 1], 'ID': [2, 2], 'MT': [2, 3], 'ND': [2, 4], 'MN': [2, 5], 'WI': [2, 7], 'MI': [2, 8], 'RI': [2, 11],
    'OR': [3, 1], 'NV': [3, 2], 'UT': [3, 3], 'CO': [3, 4], 'WY': [3, 5], 'SD': [3, 6], 'IA': [3, 7], 'IL': [3, 8], 'IN': [3, 9], 'OH': [3, 10], 'PA': [3, 11],
    'CA': [4, 1], 'AZ': [4, 2], 'NM': [4, 3], 'OK': [4, 4], 'AR': [4, 5], 'MO': [4, 6], 'KY': [4, 7], 'WV': [4, 8], 'VA': [4, 9], 'MD': [4, 10], 'DE': [4, 11],
    'HI': [5, 0], 'TX': [5, 4], 'LA': [5, 5], 'MS': [5, 6], 'AL': [5, 7], 'TN': [5, 8], 'NC': [5, 9], 'SC': [5, 10], 'DC': [5, 11],
    'GA': [6, 9], 'FL': [7, 10]
  };
  var TILE_INV = {};
  Object.keys(TILE_POS).forEach(function (code) { TILE_INV[TILE_POS[code][0] + ':' + TILE_POS[code][1]] = code; });

  var TOPO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';
  var D3_SRC = 'https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js';
  var TOPOJSON_SRC = 'https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js';

  /* ------------------- Асинхронная загрузка ресурсов --------------------
   * d3 + topojson-client подтягиваются асинхронно (не блокируют запуск
   * дашборда), топология США скачивается фоном сразу при разборе скрипта.
   * Пока библиотеки/топология не готовы — карта рисуется tile-grid'ом,
   * после готовности — автоматически перерисовывается в настоящую SVG. */
  var topoRawCache = null;   /* Promise<topology JSON> */
  var featuresCache = null;  /* Promise<Feature[]>    */
  var libsReady = false;
  var libsStarted = false;
  var lastOpts = null;

  function getTopoRaw() {
    if (!topoRawCache) {
      if (typeof fetch !== 'function') {
        console.error('[MAP ERROR] fetch недоступен, используется tile-grid карта');
        topoRawCache = Promise.reject(new Error('fetch недоступен'));
      } else {
        console.error('[MAP INFO] Загрузка топологии США: ' + TOPO_URL);
        topoRawCache = fetch(TOPO_URL).then(function (res) {
          if (!res.ok) throw new Error('[TOPOLGY FETCH ERROR] HTTP ' + res.status + ' (' + TOPO_URL + ')');
          return res.json();
        });
      }
      topoRawCache.catch(function () { 
        console.error('[MAP WARNING] Попытка загрузки топологии США неудачна, используется tile-grid карта'); 
        topoRawCache = null; 
      });
    }
    return topoRawCache;
  }

  function getFeatures() {
    if (!featuresCache) {
      console.error('[MAP INFO] Парсинг топологии в GeoJSON features…');
      featuresCache = getTopoRaw().then(function (topo) {
        if (!window.topojson) throw new Error('[MAP ERROR] topojson не загружен из CDN');
        var fc = window.topojson.feature(topo, topo.objects.states);
        var features = (fc.features || []).filter(function (f) { return !!FIPS2CODE[String(f.id)]; });
        if (!features.length) throw new Error('[MAP ERROR] topology: нет штатов в топологии');
        console.error('[MAP INFO] Топология успешно загружена: ' + features.length + ' штатов');
        return features;
      });
      featuresCache.catch(function () { 
        console.error('[MAP WARNING] Парсинг топологии неудачен, используется tile-grid карта'); 
        featuresCache = null; 
      });
    }
    return featuresCache;
  }

  function loadScript(src, globalName, cb) {
    if (window[globalName]) { cb(true); return; }
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = function () { cb(true); };
    s.onerror = function () { cb(false); };
    (document.head || document.documentElement).appendChild(s);
  }

  function startLibs() {
    if (libsStarted) return;
    libsStarted = true;
    console.error('[MAP INFO] Загрузка библиотек: d3 → topojson-client');
    loadScript(D3_SRC, 'd3', function (ok) {
      if (!ok) {
        console.error('[MAP ERROR] Не удалось загрузить d3 из CDN, используется tile-grid карта');
        return;
      }
      loadScript(TOPOJSON_SRC, 'topojson', function (ok2) {
        if (!ok2) {
          console.error('[MAP ERROR] Не удалось загрузить topojson-client из CDN, используется tile-grid карта');
          return;
        }
        libsReady = true;
        console.error('[MAP INFO] Библиотеки d3+topojson готовы, возможна перерисовка карты в SVG');
        if (lastOpts) tryRender();
      });
    });
  }

  /* ------------------------------ Палитра ------------------------------ */
  var STOPS = ['#eff6ff', '#60a5fa', '#1e3a8a'];
  function hex2rgb(h) {
    h = h.slice(1);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function colorFor(t) {
    t = Math.max(0, Math.min(1, t));
    var c0 = hex2rgb(STOPS[0]), c1 = hex2rgb(STOPS[1]), c2 = hex2rgb(STOPS[2]);
    var a, b, tt;
    if (t < 0.5) { a = c0; b = c1; tt = t / 0.5; } else { a = c1; b = c2; tt = (t - 0.5) / 0.5; }
    return 'rgb(' + Math.round(lerp(a[0], b[0], tt)) + ',' + Math.round(lerp(a[1], b[1], tt)) + ',' + Math.round(lerp(a[2], b[2], tt)) + ')';
  }

  var state = {
    values: {}, names: {}, selected: 'all', onSelect: null, fmt: String,
    min: 0, max: 1
  };

  function fillFor(value) {
    if (value == null) return { color: '#e2e8f0', text: '#64748b', t: null };
    var range = state.max - state.min || 1;
    var t = (value - state.min) / range;
    // Убедимся что цвет действительно отличается от фона (#eff6ff)
    return { color: colorFor(Math.max(0.1, Math.min(0.99, t))), text: t > 0.55 ? '#ffffff' : '#0f172a', t: t };
  }

  /* ------------------------------ Tooltip ------------------------------ */
  function ensureTip(box) {
    var t = box.querySelector('.map-tip');
    if (t) return t;
    t = document.createElement('div');
    t.className = 'map-tip';
    box.appendChild(t);
    return t;
  }
  function showTip(box, ev, code, value) {
    var tip = ensureTip(box);
    var r = box.getBoundingClientRect();
    tip.style.display = 'block';
    tip.style.left = Math.max(0, Math.min(ev.clientX - r.left + 14, r.width - 200)) + 'px';
    tip.style.top = Math.max(0, ev.clientY - r.top + 16) + 'px';
    tip.innerHTML = '<b>' + escapeHtml(state.names[code] || code) + '</b><br>' +
      (value == null ? 'нет данных' : state.fmt(value));
  }
  function hideTip(box) {
    var tip = box.querySelector('.map-tip');
    if (tip) tip.style.display = 'none';
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* --------------------------- SVG (d3) -------------------------------- */
  function renderSvg(features, box) {
    box.innerHTML = '';
    var W = Math.max(560, box.clientWidth || 960);
    var H = 440;
    var projection = window.d3.geoAlbersUsa().fitExtent([[10, 10], [W - 10, H - 10]], {
      type: 'FeatureCollection', features: features
    });
    var path = window.d3.geoPath(projection);
    var svg = window.d3.select(box).append('svg')
      .attr('viewBox', '0 0 ' + W + ' ' + H)
      .attr('width', '100%')
      .attr('height', H)
      .attr('role', 'img')
      .attr('aria-label', 'Карта США с тепловыми значениями');

    features.forEach(function (f) {
      var code = FIPS2CODE[String(f.id)];
      if (!code) return;
      var v = state.values[code];
      var fill = fillFor(v);
      var isSel = state.selected === code;
      var el = svg.append('path')
        .attr('d', path(f))
        .attr('fill', fill.color)
        .attr('stroke', isSel ? '#0f172a' : '#ffffff')
        .attr('stroke-width', isSel ? 2.5 : 1)
        .attr('tabindex', '0')
        .style('cursor', state.onSelect ? 'pointer' : 'default');
      el.on('mousemove', function (ev) { showTip(box, ev, code, v); })
        .on('mouseleave', function () { hideTip(box); })
        .on('click', function () { if (state.onSelect) state.onSelect(code); })
        .on('keydown', function (ev) {
          if (state.onSelect && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); state.onSelect(code); }
        });
      if (isSel) el.raise();
    });
  }

  /* ------------------------ Tile-grid (fallback) ----------------------- */
  function renderTiles(box) {
    box.innerHTML = '';
    var grid = document.createElement('div');
    grid.className = 'tilegrid';
    var rows = 8, cols = 12;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var cell = document.createElement('div');
        cell.className = 'tile-cell';
        var code = TILE_INV[r + ':' + c];
        if (!code) { grid.appendChild(cell); continue; }
        var v = state.values[code];
        var fill = fillFor(v);
        var isSel = state.selected === code;
        var tile = document.createElement('div');
        tile.className = 'tile' + (isSel ? ' sel' : '');
        tile.style.background = fill.color;
        tile.style.color = fill.text;
        tile.textContent = code;
        tile.setAttribute('role', 'button');
        tile.setAttribute('aria-label', (state.names[code] || code) + (v == null ? '' : ': ' + state.fmt(v)));
        (function (code, v) {
          tile.addEventListener('mousemove', function (ev) { showTip(box, ev, code, v); });
          tile.addEventListener('mouseleave', function () { hideTip(box); });
          tile.addEventListener('click', function () { if (state.onSelect) state.onSelect(code); });
        })(code, v);
        cell.appendChild(tile);
        grid.appendChild(cell);
      }
    }
    box.appendChild(grid);
  }

  /* ------------------------------ Legend ------------------------------- */
  function renderLegend(min, max) {
    var legend = document.getElementById('mapLegend');
    if (!legend) {
      console.error('[MAP WARNING] Контейнер legend не найден для отрисовки легенды');
      return;
    }
    legend.innerHTML = '<span>' + state.fmt(min) + '</span>' +
      '<i class="legend-bar" aria-hidden="true"></i>' +
      '<span>' + state.fmt(max) + '</span>' +
      '<span class="legend-na"><i></i>нет данных</span>';
  }

  /* ------------------------------- render ------------------------------ */
  function render(opts) {
    opts = opts || {};
    state.values = opts.values || {};
    state.names = opts.names || {};
    state.selected = opts.selected || 'all';
    state.onSelect = opts.onSelect || null;
    state.fmt = opts.fmt || String;

    var box = document.getElementById('mapBox');
    if (!box) {
      console.error('[MAP ERROR] Контейнер mapBox не найден в DOM');
      return;
    }

    // Отладка: выводим информацию о переданных данных
    var valueCount = Object.keys(state.values).length;
    var hasNulls = Object.values(state.values).some(function(v) { return v == null; });
    console.error('[MAP DATA] Значения для', valueCount, 'штатов (null:', hasNulls + ')');
    
    var nums = [];
    Object.keys(state.values).forEach(function (k) {
      var v = state.values[k];
      if (v != null && isFinite(v)) nums.push(v);
    });
    state.min = nums.length ? Math.min.apply(null, nums) : 0;
    state.max = nums.length ? Math.max.apply(null, nums) : 1;
    if (state.max === state.min) state.max = state.min + 1;

    console.error('[MAP RENDER] min:', state.min, 'max:', state.max);

    lastOpts = opts;
    tryRender();
  }

  function tryRender() {
    var box = document.getElementById('mapBox');
    if (!box) {
      console.error('[MAP ERROR] tryRender: mapBox не найден');
      return;
    }
    
    console.error('[MAP RENDER] Попытка отрисовки карты (SVG или tile-grid)…');
    
    var nums = [];
    Object.keys(state.values).forEach(function (k) {
      var v = state.values[k];
      if (v != null && isFinite(v)) nums.push(v);
    });
    var done = function () { renderLegend(state.min, state.max); };

    // Проверка загруженности топологии перед отрисовкой SVG
    if (libsReady && window.d3 && topoRawCache) {
      console.error('[MAP INFO] Топология доступна, пробуем SVG карту…');
      getFeatures()
        .then(function (features) { 
          console.error('[MAP INFO] Отрисовка SVG карты…');
          renderSvg(features, box); done(); 
        })
        .catch(function (err) { 
          console.error('[MAP ERROR] Парсинг топологии неудачен:', err.message, '→ tile-grid карта');
          renderTiles(box); done(); 
        });
    } else if (!libsReady || !window.d3) {
      console.error('[MAP Fallback] Библиотеки d3/topojson недоступны или не загрузились → tile-grid карта');
      // Стартовая заглушка для tile-grid пока ресурсы загружаются
      renderTiles(box);
      done();
      startLibs();
    } else if (!topoRawCache) {
      console.error('[MAP WARNING] Топология США не загружена (fetch неудачно), используем tile-grid карту');
      // Стартовая заглушка для tile-grid
      renderTiles(box);
      done();
      startLibs();
    } else {
      console.error('[MAP INFO] Ресурсы загрузились, отрисовка SVG карты…');
      getFeatures()
        .then(function (features) { 
          console.error('[MAP INFO] Отрисовка SVG карты…');
          renderSvg(features, box); done(); 
        })
        .catch(function (err) { 
          console.error('[MAP ERROR] Парсинг топологии неудачен:', err.message, '→ tile-grid карта');
          renderTiles(box); done(); 
        });
    }
  }

  /* Автозапуск фонового prefetch (топология + библиотеки) при разборе
     скрипта — параллельно с генерацией демо-данных и первым рендером. */
  if (typeof document !== 'undefined') {
    console.error('[MAP INFO] Начата фоновая загрузка топологии США…');
    if (typeof fetch === 'function') getTopoRaw().catch(function () {});
    startLibs();
  }

  window.USMap = { render: render, refresh: tryRender };
})();
