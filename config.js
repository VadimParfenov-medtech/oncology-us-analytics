/* =========================================================================
 * Oncology US Analytics — конфигурация источника данных.
 *
 * source:
 *   'synthetic' — встроенные демонстрационные данные (детерминированные, офлайн)
 *   'trials'    — реальные данные ClinicalTrials.gov (публичный API, без ключа)
 *   'api'       — ваш REST API по контракту из README.md (задайте apiUrl)
 *   'auto'      — если apiUrl задан, пробуем API, иначе демонстрационные данные
 *
 * Переопределение через URL (без перезаписи файла):
 *   index.html?source=trials
 *   index.html?source=api&api=https://host/oncology&apiName=Внутренний
 * ========================================================================= */
window.ONCO_CONFIG = {
  source: 'synthetic',   // Принудительно: демо-данные (встроенные, офлайн)
  apiUrl: null,
  apiName: 'Внутренний API',
};
