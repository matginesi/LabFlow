(function () {
  'use strict';
  const LF = window.LabFlow = window.LabFlow || {}, C = LF.Core, A = LF.Analysis;

  function num(v) { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; }

  function stats(values) {
    const a = values.map(num).filter(function (n) { return n !== null; });
    if (!a.length) return null;
    a.sort(function (x, y) { return x - y; });
    function q(p) { const pos = (a.length - 1) * p, b = Math.floor(pos), r = pos - b; return a[b + 1] !== undefined ? a[b] + r * (a[b + 1] - a[b]) : a[b]; }
    const sum = a.reduce(function (s, v) { return s + v; }, 0), mean = sum / a.length;
    const variance = a.length > 1 ? a.reduce(function (s, v) { return s + (v - mean) * (v - mean); }, 0) / (a.length - 1) : 0;
    return { n: a.length, min: a[0], q1: q(0.25), median: q(0.5), mean: mean, q3: q(0.75), max: a[a.length - 1], std: Math.sqrt(variance) };
  }

  function dirValues(ms, dir, key, factor) {
    return ms.map(function (m) {
      const x = m[dir]; if (!x) return null;
      const v = Number(x[key]); if (!Number.isFinite(v)) return null;
      return (key === 'eff' || key === 'jsc') ? v / factor : v;
    });
  }
  function dirStats(ms, dir, key, factor) { return stats(dirValues(ms, dir, key, factor)); }
  function metricField(ms, key, factor) { return { fw: dirStats(ms, 'fw', key, factor), rv: dirStats(ms, 'rv', key, factor) }; }

  function hysteresisPct(ms) {
    return stats(ms.map(function (m) { const h = num(m.hysteresis); return h === null ? null : h * 100; }));
  }

  function dataState(exp) {
    const sync = exp.sync || {};
    return { basis: (exp.patches || []).length ? 'Modified Working Copy' : 'Original import interpretation', revision: Number(sync.revision) || 0, savedRevision: Number(sync.savedRevision) || 0, dirty: !!sync.dirty, appliedChanges: (exp.patches || []).length };
  }

  function chartDataOf(exp) {
    const ms = A.measurementsOf(exp), factor = A.settingsOf(exp), best = (A.analysisOf(exp).bestBySample || [])[0], bestM = best && ms.find(function (m) { return m.id === best.id; });
    const eligible = ms.filter(function (m) { return m.rankingEligible; });
    const rules = (LF.PromptRegistry && LF.PromptRegistry.effectiveRules) ? LF.PromptRegistry.effectiveRules() : {};
    const warningHysteresis = Number((((rules || {}).pair_checks || {}).hysteresis_abs_warning) || 0.30) * 100;
    function factorY(p) { return { x: Number(p.x), y: Number(p.y) / factor }; }
    return {
      efficiencies: ms.map(function (m) { const v = m.rv && m.rv.eff, n = num(v); return n === null ? null : n / factor; }).filter(function (n) { return n !== null; }),
      hysteresis: ms.map(function (m) { const h = num(m.hysteresis); return h === null ? null : Math.abs(h) * 100; }).filter(function (n) { return n !== null; }),
      scatter: eligible.filter(function (m) { return num(m.bestEff) !== null && num(m.hysteresis) !== null; }).map(function (m) { return { cell: m.sample, eff: num(m.bestEff), hysteresisPct: (num(m.hysteresis) || 0) * 100 }; }),
      bestCurve: bestM ? { sample: bestM.sample, fw: (bestM.curve && bestM.curve.fw || []).map(factorY), rv: (bestM.curve && bestM.curve.rv || []).map(factorY) } : null,
      thresholds: { hysteresisPct: warningHysteresis },
      figureSelection: (exp.report && exp.report.figureSelection) || {}
    };
  }

  function groupStatisticsOf(exp) {
    const ms = A.measurementsOf(exp), factor = A.settingsOf(exp), map = {};
    /* Same eligible scope and group naming the Results Compare view uses, so the
       bundle is a valid single source for the per-scan statistics table. */
    ms.forEach(function (m) {
      if (!m.rankingEligible) return;
      const key = String(m.group || '').trim() || 'Ungrouped';
      map[key] = map[key] || { name: key, valsFW: [], valsRV: [] };
      const fw = m.fw && num(m.fw.eff), rv = m.rv && num(m.rv.eff);
      if (fw !== null) map[key].valsFW.push(fw / factor);
      if (rv !== null) map[key].valsRV.push(rv / factor);
    });
    return Object.keys(map).sort().map(function (k) {
      const g = map[k];
      return { name: k, n: Math.max(g.valsFW.length, g.valsRV.length), scans: { fw: stats(g.valsFW), rv: stats(g.valsRV) } };
    });
  }

  function anomaliesOf(exp) {
    return A.measurementsOf(exp).filter(function (m) { return m.qualityStatus !== 'valid' || (m.flags || []).length; }).slice(0, 24).map(function (m) {
      return { sample: m.sample, file: m.file, note: (m.flags || []).map(function (f) { return f.label || f; }).join(', ') || m.qualityStatus };
    });
  }

  function findingsOf(exp) {
    const all = exp.findings || [], open = all.filter(function (f) { return f.status !== 'resolved'; });
    const bySeverity = { info: 0, warning: 0, danger: 0 };
    open.forEach(function (f) { bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1; });
    return { open: open.length, total: all.length, resolved: all.length - open.length, bySeverity: bySeverity };
  }

  function topOf(exp, key) { return ((A.analysisOf(exp)[key]) || []).slice(0, 10); }

  function collect(exp) {
    const ms = A.measurementsOf(exp), factor = A.settingsOf(exp);
    return {
      version: 1, generatedAt: new Date().toISOString(),
      sourceRevision: Number(exp.sync && exp.sync.revision) || 0,
      dataState: dataState(exp),
      metrics: { eff: metricField(ms, 'eff', factor), voc: metricField(ms, 'voc', factor), jsc: metricField(ms, 'jsc', factor), ff: metricField(ms, 'ff', factor) },
      hysteresisAbsPct: hysteresisPct(ms),
      groupStatistics: groupStatisticsOf(exp),
      chartData: chartDataOf(exp),
      topNonRef: topOf(exp, 'topNonRef'), topRef: topOf(exp, 'topRef'), bestBySample: topOf(exp, 'bestBySample'),
      anomalies: anomaliesOf(exp),
      findings: findingsOf(exp)
    };
  }

  function fresh(exp) {
    const b = exp.analysisSummary;
    return !!b && Number(b.sourceRevision) === Number(exp.sync && exp.sync.revision) && !!(exp.analysis && exp.analysis.summary);
  }

  function ensure(exp) { return fresh(exp) ? exp.analysisSummary : collect(exp); }

  LF.AnalysisSummary = { stats: stats, collect: collect, fresh: fresh, ensure: ensure };
}());
