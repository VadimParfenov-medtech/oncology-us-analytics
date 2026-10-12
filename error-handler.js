/* =========================================================================
 * Oncology US Analytics — Error Handler & Logger Utility
 * 
 * Единый модуль для логирования ошибок в консоль разработчика.
 * Поддерживает уровни: error, warn, info
 * Автоматический сбор ошибок в единое окно (errors-container)
 * ========================================================================= */
(function () {
  'use strict';

  // Конфигурация
  var LOG_LEVELS = ['error', 'warn', 'info'];
  var DEFAULT_LEVEL = 'warn';
  
  var containerId = 'dsh-errors';
  var container = null;
  var errorCount = 0;

  /**
   * Логирование ошибок в консоль разработчика
   * @param {string} level - Уровень логирования: 'error', 'warn', 'info'
   * @param {...*} args - Аргументы для форматирования сообщения
   */
  function log(level, /* ...args */) {
    if (LOG_LEVELS.indexOf(level) < LOG_LEVELS.indexOf(DEFAULT_LEVEL)) return;

    var timestamp = new Date().toISOString();
    var message = Array.prototype.slice.call(arguments).join(' ');

    // Логирование в консоль разработчика
    console.log('[ONCO-' + level.toUpperCase() + ']', timestamp, message);

    // Сбор ошибок (только для уровня error)
    if (level === 'error') {
      errorCount++;
      renderError(containerId, message);
    }
  }

  /**
   * Создание контейнера для отображения ошибок в UI (только в браузере)
   */
  function ensureErrorContainer() {
    if (typeof document === 'undefined') return; // Только для браузера
    
    container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      container.setAttribute('role', 'log');
      container.setAttribute('aria-label', 'Логи ошибок приложения');
      container.className = 'dsh-errors';
      
      // Добавление контейнера перед завершением инициализации
      var beforeLast = Array.from(document.body.children).slice(0, -1);
      beforeLast.forEach(function(el) { el.parentNode.insertBefore(container, el.nextSibling); });
    }
  }

  /**
   * Отрисовка сообщения об ошибке в UI (только в браузере)
   * @param {string} containerId - ID контейнера
   * @param {string} message - Сообщение об ошибке
   */
  function renderError(containerId, message) {
    if (typeof document === 'undefined') return; // Только для браузера
    
    var container = document.getElementById(containerId);
    if (!container) return;

    // Ограничение количества отображаемых ошибок
    if (errorCount > 50) {
      container.innerHTML += '<div class="dsh-error-limit">⚠ Отображается только последняя ошибка</div>';
      return;
    }

    var errorEl = document.createElement('div');
    errorEl.className = 'dsh-error-item';
    errorEl.setAttribute('role', 'alert');
    errorEl.innerHTML = formatErrorMessage(message);
    
    container.insertBefore(errorEl, container.firstChild);
    
    // Ограничение количества отображаемых ошибок
    var allErrors = container.querySelectorAll('.dsh-error-item');
    if (allErrors.length > 10) {
      while (allErrors.length > 10) {
        allErrors[0].remove();
      }
    }
  }

  /**
   * Форматирование сообщения об ошибке
   */
  function formatErrorMessage(message) {
    return '<span class="dsh-error-text">' + escapeHtml(message) + '</span>';
  }

  /**
   * Экранирование HTML
   */
  function escapeHtml(text) {
    if (!text) return '';
    return String(text).replace(/[&<>"']/g, function (c) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[c];
    });
  }

  // Экспорт публичного API
  window.ONCO_ERROR = {
    /**
     * Логирование ошибки (по умолчанию)
     */
    error: function () {
      ensureErrorContainer();
      log.apply(null, arguments);
    },

    /**
     * Логирование предупреждения
     */
    warn: function () {
      ensureErrorContainer();
      log.apply(null, arguments);
    },

    /**
     * Логирование информации
     */
    info: function () {
      ensureErrorContainer();
      log.apply(null, arguments);
    },

    /**
     * Сброс счетчика ошибок (для тестов)
     */
    reset: function () {
      errorCount = 0;
    }
  };

})();
