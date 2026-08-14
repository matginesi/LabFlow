'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/core.js');
require('../../assets/js/data/analysis.js');
require('../../assets/js/data/analysis-summary.js');

function assert(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error((label || 'assert') + ': expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(actual));
}

module.exports = function (t, LF) {
  LF.PromptRegistry = { effectiveRules: function () { return {
    metric_ranges: { ff: { min: 0, max: 1, severity: 'warning' }, efficiency: { min: 0, max: 100, severity: 'warning' }, voc: { min: 0, max: 2, severity: 'warning' }, jsc_abs: { max: 100, severity: 'warning' } },
    pair_checks: { hysteresis_abs_warning: 0.2, jsc_difference_percent_warning: 50, efficiency_difference_percent_warning: 50 },
    ranking: { exclude_danger_findings: true, require_finite_efficiency: true }
  }; } };

  function experiment() {
    return {
      id: 'exp', sync: { revision: 4, savedRevision: 4, dirty: false }, patches: [], findings: [], analysisSettings: { mismatchFactor: 2 }, samples: [
        { id: 's1', name: 'DEVICE A' }, { id: 's2', name: 'REF CONTROL' }
      ], measurements: [
        { id: 'm1', file: 'a.txt', sample: 'DEVICE A', group: 'A', isRef: false, fw: { voc: 1.0, jsc: 40, ff: 0.8, eff: 36 }, rv: { voc: 1.0, jsc: 40, ff: 0.8, eff: 40 } },
        { id: 'm2', file: 'b.txt', sample: 'DEVICE A', group: 'A', isRef: false, fw: { voc: 1.0, jsc: 40, ff: 0.8, eff: 38 }, rv: { voc: 1.0, jsc: 40, ff: 0.8, eff: 44 } },
        { id: 'm3', file: 'ref.txt', sample: 'REF CONTROL', group: 'REF', isRef: true, fw: { voc: 1.0, jsc: 40, ff: 0.8, eff: 34 }, rv: null }
      ], analysis: { summary: {}, bestBySample: [], topNonRef: [], topRef: [] }, report: { figureSelection: { pceDistribution: false } }
    };
  }

  t['stats matches the results quartile interpolation for a known array'] = function () {
    const s = LF.AnalysisSummary.stats([1, 2, 3, 4, 5, 6, 7, 8]);
    assert(s.n, 8, 'n');
    assert(s.min, 1, 'min');
    assert(s.q1, 2.75, 'q1');
    assert(s.median, 4.5, 'median');
    assert(s.mean, 4.5, 'mean');
    assert(s.q3, 6.25, 'q3');
    assert(s.max, 8, 'max');
  };

  t['stats returns null for empty or all-non-finite input'] = function () {
    assert(LF.AnalysisSummary.stats([]), null, 'empty');
    assert(LF.AnalysisSummary.stats(['x', null, NaN]), null, 'non-finite');
  };

  t['collect groups per scan with factored efficiency values'] = function () {
    const e = experiment();
    LF.Analysis.analyze(e);
    const b = LF.AnalysisSummary.collect(e);
    assert(b.sourceRevision, 4, 'revision stamped');
    assert(b.metrics.eff.fw.n, 3, 'fw count includes fw-only sample');
    assert(b.metrics.eff.rv.n, 2, 'rv count only paired');
    // factor 2: fw eff 36/2=18, 38/2=19, 34/2=17 -> median 18
    assert(b.metrics.eff.fw.median, 18, 'factored fw median');
    // rv: 40/2=20, 44/2=22 -> median 21
    assert(b.metrics.eff.rv.median, 21, 'factored rv median');
    const a = b.groupStatistics.find(function (g) { return g.name === 'A'; });
    assert(a.scans.fw.n, 2, 'group A fw count');
    assert(a.scans.rv.n, 2, 'group A rv count');
    const ref = b.groupStatistics.find(function (g) { return g.name === 'REF'; });
    assert(ref.scans.fw.n, 1, 'group REF fw count');
    assert(ref.scans.rv, null, 'group REF has no rv scan');
    assert(b.hysteresisAbsPct.n, 2, 'hysteresis from paired measurements');
  };

  t['collect never mutates the experiment'] = function () {
    const e = experiment();
    LF.Analysis.analyze(e);
    const before = JSON.stringify(e);
    LF.AnalysisSummary.collect(e);
    assert(JSON.stringify(e), before, 'deep equal after collect');
  };

  t['fresh is false until a matching sourceRevision bundle is stored'] = function () {
    const e = experiment();
    LF.Analysis.analyze(e);
    assert(LF.AnalysisSummary.fresh(e), false, 'not fresh before store');
    e.analysisSummary = LF.AnalysisSummary.collect(e);
    assert(LF.AnalysisSummary.fresh(e), true, 'fresh after store');
    e.sync.revision = 5;
    assert(LF.AnalysisSummary.fresh(e), false, 'stale after revision bump');
  };

  t['Experiment Brief AI survives non-scientific revision bumps but invalidates on scientific changes'] = function () {
    const e = experiment();
    LF.Analysis.analyze(e);
    let brief = LF.ExperimentBrief.ensure(e), signature = LF.ExperimentBrief.signature(e);
    brief.ai = { summary: 'Shared scientific context', inputSignature: signature, sourceRevision: e.sync.revision };
    e.sync.revision += 1; // e.g. report/editor metadata changed; scientific inputs are identical
    assert(LF.ExperimentBrief.fresh(e), true, 'non-scientific revision does not stale brief');
    brief = LF.ExperimentBrief.ensure(e);
    assert(brief.ai.summary, 'Shared scientific context', 'AI enrichment preserved');
    e.measurements[0].fw.eff = 99;
    assert(LF.ExperimentBrief.fresh(e), false, 'scientific edit invalidates brief');
    brief = LF.ExperimentBrief.ensure(e);
    assert(brief.ai, null, 'stale AI enrichment dropped');
  };

  t['findings rollup only counts open findings by severity'] = function () {
    const e = experiment();
    e.findings = [
      { id: 'f1', severity: 'danger', status: 'open' },
      { id: 'f2', severity: 'warning', status: 'open' },
      { id: 'f3', severity: 'warning', status: 'resolved' }
    ];
    const b = LF.AnalysisSummary.collect(e);
    assert(b.findings.open, 2, 'open count');
    assert(b.findings.total, 3, 'total count');
    assert(b.findings.resolved, 1, 'resolved count');
    assert(b.findings.bySeverity.danger, 1, 'danger severity');
    assert(b.findings.bySeverity.warning, 1, 'warning severity');
  };

  return t;
};