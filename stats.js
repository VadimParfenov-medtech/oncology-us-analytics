/* =========================================================================
 * Oncology US Analytics — единопассовая агрегация.
 *
 * Раньше каждый render прогонял весь массив записей ~150 раз:
 * KPI + дельты (по годам) + по типам + по стадиям + по 51 штату.
 * Здесь один проход O(N) строит ВСЕ срезы сразу (агрегация линейна —
 * суммы и взвешенные средние — поэтому результат идентичен поштучному
 * фильтрованию, включая порядок сложения чисел):
 *
 *   compute(rows) → {
 *     total:  {cases, deaths, mortality, survival, cost, age, male},
 *     byYear: { 2024: agg, 2025: agg, ... },
 *     byType: { breast: agg, ... },
 *     byStage:{ 'I': agg, ... },
 *     byState:{ 'CA': agg, ... }
 *   }
 *
 * Совместимо с window.OncologyStats.zero — агрегат пустой выборки
 * (то же, что aggregate([]) в старой версии app.js).
 * ========================================================================= */
(function () {
  'use strict';

  function newAgg() {
    return { cases: 0, deaths: 0, survW: 0, survN: 0, costW: 0, costN: 0, ageW: 0, ageN: 0, maleW: 0, maleN: 0 };
  }

  function finalize(g) {
    g.mortality = g.cases && g.deaths ? g.deaths / g.cases * 100 : null;
    g.survival = g.survN ? g.survW / g.survN : null;
    g.cost = g.costN ? g.costW / g.costN : null;
    g.age = g.ageN ? g.ageW / g.ageN : null;
    g.male = g.maleN ? g.maleW / g.maleN : null;
    return g;
  }

  function compute(rows) {
    var total = newAgg();
    var byYear = {}, byType = {}, byStage = {}, byState = {};
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var w = (typeof r.newCases === 'number') ? r.newCases : 0;
      var groups = [
        total,
        (byYear[r.year] || (byYear[r.year] = newAgg())),
        (byType[r.type] || (byType[r.type] = newAgg())),
        (byStage[r.stage] || (byStage[r.stage] = newAgg())),
        (byState[r.state] || (byState[r.state] = newAgg()))
      ];
      for (var gi = 0; gi < groups.length; gi++) {
        var g = groups[gi];
        g.cases += w;
        if (typeof r.deaths === 'number') g.deaths += r.deaths;
        if (r.survival5y != null) { g.survW += r.survival5y * w; g.survN += w; }
        if (r.costPerPatient != null) { g.costW += r.costPerPatient * w; g.costN += w; }
        if (r.medianAge != null) { g.ageW += r.medianAge * w; g.ageN += w; }
        if (r.malePct != null) { g.maleW += r.malePct * w; g.maleN += w; }
      }
    }
    return {
      total: finalize(total),
      byYear: mapVals(byYear, finalize),
      byType: mapVals(byType, finalize),
      byStage: mapVals(byStage, finalize),
      byState: mapVals(byState, finalize)
    };
  }

  function mapVals(obj, fn) {
    var out = {};
    var keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++) out[keys[i]] = fn(obj[keys[i]]);
    return out;
  }

  /* Агрегат пустой выборки (read-only, только чтение) */
  var ZERO = { cases: 0, deaths: 0, mortality: null, survival: null, cost: null, age: null, male: null };

  window.OncologyStats = { compute: compute, zero: ZERO };
})();
