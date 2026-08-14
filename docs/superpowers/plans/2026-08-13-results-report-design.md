# Implementation Plan — Results statistics bundle, Report tabs, per-scan Compare, per-device Design

Date: 2026-08-13. Source: `LABFLOW_POC_SPEC.md` §"RESOLVED → Use intradocument tabs for Lab vs Paper Reports", "Per-scan, not per-group box plots", "Compare statistics table and NOMAD mapping reuse groupStatistics", "visual per-device suggest + Apply experiment."

These four changes are interdependent because **the Analysis Dossier bundle** (`analysis.summarize`) is the single deterministic source of statistics that Compare, Report and NOMAD must reuse:

- Document tabs are blocked by Report figure generation running on every render; generation must move behind a memoized on-demand rasterizer that both page preview and DOCX/PDF consume (AGENTS §12).
- Per-scan Compare and Report figure selection need per-scan deterministic statistics from the same bundle.
- The per-device Design improve needs a deterministic "Apply for selected device" gate.

Written so tasks can be executed by a general-purpose subagent in order. Commit points are explicit; run them only when asked to commit.

## Verification baseline — run before starting and after Task #11

```bash
python tools/build_prompt_bundle.py
python tools/build_operation_registry.py
python tools/validate_operation_contract.py
python tools/validate_state_contract.py
python tools/validate_ui_contract.py
python tools/validate_privacy_contract.py
node tests/unit/run.js $(find tests/unit -maxdepth 1 -name '*-test.js' -printf '%p ' | sort)
```

All validators and unit tests must pass before Task #1 and after Task #11.

## Domain model facts the plan depends on (verified 2026-08-13)

- Measurements are `{ id, sample, group, isRef, qualityStatus, rankingEligible, bestEff, hysteresis, fw:{voc,jsc,ff,eff}, rv:{voc,jsc,ff,eff}, curve:{fw:[{x,y}],rv:[...]}, flags:[{label,severity,evidence}], excluded }`. `m.bestEff` and `m.fw/m.rv` `.eff`/`.jsc` are **already divided by the mismatch factor** (`LF.Analysis.settingsOf(exp)`); `.voc`/`.ff` are not. `m.hysteresis` is a fraction (0..1).
- `exp.analysis` = `{ summary:{...}, bestBySample:[], topNonRef:[], topRef:[], aiInterpretation? }`. The top-N arrays are **top-level**, each item compacted as `{id,file,sample,group,isRef,bestEff,hysteresis,qualityStatus,flags}`. `summary` has `measurementCount, eligibleCount, sampleCount, completePairs, curveCount, validCount, reviewCount, blockedCount, findingCount, namingFindingCount, missingFindingCount, patchCount, completeness, bestEfficiency, bestSample, meanEfficiency, medianEfficiency`. There is **no** `anomalies`, `chartData`, `safeFixCount` or `findingsBySeverity` on it — the bundle computes those itself from measurements/findings.
- `exp.findings[]` items are `{id,severity:'info'|'warning'|'danger',type,title,detail,target,evidence[],status,source,measurementId}`.
- `LF.Analysis` exports `analyze, deriveMeasurement, hysteresis, toCSV, rules, measurementsOf, samplesOf, findingsOf, manifestOf, analysisOf, settingsOf, designOf`.
- `results-page.js` `quartiles(values)` returns `{n,min,q1,med,q3,max,outliers,values}` (whiskers trimmed to 1.5×IQR; `values` kept sorted; used by `boxSvg`). `groupName(m)` and `factor()` are page helpers. `compareData(e)` currently pushes one value **per direction** into one per-group array, then `quartiles` once. `compareMetricMeta` maps `eff/voc/jsc/ff`.
- `vendor/report-export/report-export.js` **must stay unchanged** (vendor consumer contract): it reads `model.chartData?.efficiencies|scatter|thresholds|bestCurve`, `model.statistics.*`, `model.groupStatistics[]` with `name,n,medianEff,minEff,maxEff,medianVoc,medianJsc,medianFF`, `model.figures[].dataUrl/caption`, `model.disable`, `model.figureSelection`.

## Key interfaces (decided)

`LF.AnalysisSummary` (new `assets/js/data/analysis-summary.js`, loaded after `assets/js/data/analysis.js` in `index.html`):

- `stats(values)` → `{n,min,q1,median,mean,q3,max,std}` or `null` for empty. Use the **same quartile interpolation as `results-page.quartiles`** (`q(p)=(a.length-1)*p` linear interp) so Compare and Report agree exactly.
- `collect(exp)` → the bundle (below), pure + deterministic, no mutation.
- `fresh(exp)` → `true` iff `exp.analysisSummary` exists, `exp.analysisSummary.sourceRevision === Number(exp.sync.revision)`, and `exp.analysis.summary` is present.
- `ensure(exp)` → `fresh ? exp.analysisSummary : collect(exp)` (no mutation; used by read-only consumers).

Bundle shape (`exp.analysisSummary`):

```js
{
  version: 1,
  generatedAt: ISO,
  sourceRevision: Number,
  dataState: { basis, revision, savedRevision, dirty, appliedChanges },  // same semantics as LF.Report.dataState
  metrics: { eff:{fw:fieldStats|null,rv:fieldStats|null}, voc:{...}, jsc:{...}, ff:{...} },
  hysteresisAbsPct: fieldStats|null,          // m.hysteresis*100 over valid values
  groupStatistics: [ { name, n, scans:{ fw:fieldStats|null, rv:fieldStats|null } } ],
  chartData: {                                 // computed deterministically, mirrors report.js math
    efficiencies:[float], hysteresis:[float],
    scatter:[{sample,eff,hysteresisPct}],
    bestCurve:{fw:[{x,y}],rv:[{x,y}],label},
    thresholds:{hysteresisPct:number},         // same constant report.js uses
    figureSelection:{}
  },
  topNonRef:[...], topRef:[...], bestBySample:[...],   // copied from exp.analysis.* (compact)
  anomalies:[ {sample,file,note} ],                     // deterministic, mirrors context.js packResults
  findings: { open, total, resolved, bySeverity:{info,warning,danger} }
}
```

`fieldStats` = `stats(values)`; every non-finite value is excluded first. `.eff`/`.jsc` values are used **factored** (`/ LF.Analysis.settingsOf(exp)`) exactly like `results-page.compareData` and `analysis.toCSV`; `.voc`/`.ff` raw. Group key = `m.group || 'ungrouped'` (identical to `results-page.groupName`).

## Repository style reminders

- Domain logic lives in titled IIFEs under `assets/js/ai/` and `assets/js/data/`; pages under `assets/js/pages/`. Pages never own scientific math.
- Deterministic OPERATION steps may mutate Working Copy derived fields only; scientific fields never. `analysis.store` writes only `exp.analysisSummary`.
- `index.html` script order: `analysis-summary.js` must load after `analysis.js` and after `operation-steps.js` (it calls `LF.Analysis` and `LF.DatasetCorrections` only at call time, but load them anyway after to keep order obvious).
- One-fact-per-assertion tests, naming `*-test.js`.

---

## Phase #6 — Analysis Dossier statistics bundle (`analysis.summarize`)

### Task #1 — New deterministic bundle module

Files:
- Create `assets/js/data/analysis-summary.js`.
- `index.html`: insert after line 106 (`analysis.js`) the script tag for `assets/js/data/analysis-summary.js`.

Implement exactly this module:

```js
(function () {
  'use strict';
  const LF = window.LabFlow = window.LabFlow || {}, C = LF.Core, A = LF.Analysis;

  function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }

  function stats(values) {
    const a = values.map(num).filter(function (n) { return n !== null; });
    if (!a.length) return null;
    a.sort(function (x, y) { return x - y; });
    function q(p) { const pos = (a.length - 1) * p, b = Math.floor(pos), r = pos - b; return a[b + 1] !== undefined ? a[b] + r * (a[b + 1] - a[b]) : a[b]; }
    const sum = a.reduce(function (s, v) { return s + v; }, 0), mean = sum / a.length;
    const variance = a.reduce(function (s, v) { return s + (v - mean) * (v - mean); }, 0) / a.length;
    return { n: a.length, min: a[0], q1: q(0.25), median: q(0.5), mean: Math.round(mean * 10000) / 10000, q3: q(0.75), max: a[a.length - 1], std: Math.round(Math.sqrt(variance) * 10000) / 10000 };
  }

  // per-scan per-metric values, mirroring results-page.compareData factoring exactly
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
    return stats(ms.map(function (m) { const h = Number(m.hysteresis); return Number.isFinite(h) ? h * 100 : null; }));
  }

  function dataState(exp) { const sync = exp.sync || {}; return { basis: (exp.patches || []).length ? 'Modified Working Copy' : 'Original import interpretation', revision: Number(sync.revision) || 0, savedRevision: Number(sync.savedRevision) || 0, dirty: !!sync.dirty, appliedChanges: (exp.patches || []).length }; }

  function chartDataOf(exp) {
    const ms = A.measurementsOf(exp), factor = A.settingsOf(exp), best = (A.analysisOf(exp).bestBySample || [])[0], bestM = best && ms.find(function (m) { return m.id === best.id; });
    const eligible = ms.filter(function (m) { return m.rankingEligible; });
    return {
      efficiencies: eligible.map(function (m) { return num(m.bestEff); }).filter(function (n) { return n !== null; }),
      hysteresis: eligible.map(function (m) { const h = Number(m.hysteresis); return Number.isFinite(h) ? h * 100 : null; }).filter(function (n) { return n !== null; }),
      scatter: eligible.map(function (m) { return { sample: m.sample, eff: m.bestEff, hysteresisPct: (Number(m.hysteresis) || 0) * 100 }; }),
      bestCurve: bestM ? { fw: (bestM.curve && bestM.curve.fw) || [], rv: (bestM.curve && bestM.curve.rv) || [], label: bestM.sample } : { fw: [], rv: [], label: '' },
      thresholds: { hysteresisPct: 5 },
      figureSelection: (exp.report && exp.report.figureSelection) || {}
    };
  }

  function groupStatisticsOf(exp) {
    const ms = A.measurementsOf(exp), map = {};
    ms.forEach(function (m) {
      const key = m.group || 'ungrouped';
      map[key] = map[key] || { name: key, valsFW: [], valsRV: [] };
      if (num(m.fw && m.fw.eff) !== null) map[key].valsFW.push(num(m.fw && m.fw.eff) / A.settingsOf(exp));
      if (num(m.rv && m.rv.eff) !== null) map[key].valsRV.push(num(m.rv && m.rv.eff) / A.settingsOf(exp));
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
    const open = (exp.findings || []).filter(function (f) { return f.status !== 'resolved'; });
    const bySeverity = { info: 0, warning: 0, danger: 0 };
    open.forEach(function (f) { bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1; });
    return { open: open.length, total: (exp.findings || []).length, resolved: (exp.findings || []).length - open.length, bySeverity: bySeverity };
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

  function fresh(exp) { const b = exp.analysisSummary; return !!b && Number(b.sourceRevision) === Number(exp.sync && exp.sync.revision) && !!(exp.analysis && exp.analysis.summary); }
  function ensure(exp) { return fresh(exp) ? exp.analysisSummary : collect(exp); }

  LF.AnalysisSummary = { stats: stats, collect: collect, fresh: fresh, ensure: ensure };
}());
```

Notes:
- `chartData.efficiencies` uses `m.bestEff` (already factored) — same series `report.js` histogram uses. `hysteresis` = `m.hysteresis*100` — same as report figures.
- `thresholds.hysteresisPct` mirrors the constant the report figures use (5); change only if report.js changes.
- `ensure()` never mutates the experiment; the only writer is the `analysis.store` step.

Tests — `tests/unit/analysis-summary-test.js`:
- `stats()` quartile interpolation matches `results-page.quartiles` med/q1/q3 for a known array (also assert `outliers` parity is unnecessary here).
- Fixture: 2 samples, group `A` with fw+rv, group `B` fw-only, one excluded measurement. Assert `groupStatistics` has both groups with correct `scans.fw`/`scans.rv` presence, factored eff values, `metrics.eff.fw.n` counts.
- `collect` does not mutate `exp` (deep-equal before/after); `fresh()` false initially, true after `exp.analysisSummary` is stored with matching `sourceRevision`.

Run the single test, then the whole suite. Commit.

### Task #2 — Operations step + operation.json + validators

Files:
- `assets/js/ai/operation-steps.js`: add two deterministic steps after `'results.store-interpretation'` (line 52):

```js
    'analysis.collect': function (ctx) { ctx.outputs = ctx.outputs || {}; ctx.outputs.analysisSummary = LF.AnalysisSummary.ensure(ctx.exp); return { revision: ctx.outputs.analysisSummary.sourceRevision, groups: ctx.outputs.analysisSummary.groupStatistics.length }; },
    'analysis.store': function (ctx) { const b = LF.AnalysisSummary.ensure(ctx.exp); ctx.exp.analysisSummary = b; return { fresh: true, groups: b.groupStatistics.length, openFindings: b.findings.open }; },
```

  Export `LF.AnalysisSummary` is already on `window.LabFlow` (Task #1); nothing else changes in the module footer.
- Create `operations/analysis.summarize/operation.json`:

```json
{
  "id": "analysis.summarize",
  "title": "Summarize deterministic analysis",
  "short_title": "Analysis summary",
  "category": "analysis",
  "type": "DETERMINISTIC",
  "role": "Automatic",
  "mutation_scope": "",
  "output": "Analysis Dossier statistics bundle (per-scan groupStatistics, metrics, chartData) reused by Compare, Report and NOMAD.",
  "purpose": "Refresh a compact deterministic statistics bundle over the analysis. It is the single source the Compare table, Report figures and NOMAD derived analysis reuse, so they cannot diverge when the Working Copy changes.",
  "description": "Recomputes and stores the analysisStatistics bundle. Deterministic computation only; never mutates scientific fields.",
  "steps": [
    { "id": "analysis.collect", "type": "DETERMINISTIC", "fn": "steps.analysis.collect", "label": "Read deterministic analysis statistics" },
    { "id": "analysis.store", "type": "DETERMINISTIC", "fn": "steps.analysis.store", "label": "Store bundle on the Working Copy" }
  ]
}
```

  (No `prompt.md` — deterministic-only.)
- `tools/validate_operation_contract.py`: add `'analysis.summarize'` to the `PUBLIC` set (the deterministic-only set is derived from steps). Re-run.
- Re-run `python tools/build_prompt_bundle.py` and `python tools/build_operation_registry.py`.

Tests: covered by `validate_operation_contract.py` + the new step's return shape asserted in Task #1 tests (call `LF.ActionSteps` steps directly is not needed; the integration test runs the op through the runner). Commit.

### Task #3 — invalidation + defaults + normalization

Files: `assets/js/ai/state.js`, `assets/js/ai/model.js`.

- `state.js` defaults object (near line 54): add `reportMode: 'editor'` and `settingsActionDocKind: 'lab'` to the initial state (persist via existing save/restore machinery).
- `state.js` `touch` (near line 153–161): in the existing `dataset` branch, add `delete exp.analysisSummary;` and add an `analysis` branch that also deletes it (mismatch-factor changes re-derive analysis).
- `state.js` `normalize` (near line 76–80): `reportMode` allowed `'editor'|'preview'` only (drop `'split'`); coerce `settingsActionDocKind` to `'lab'|'paper'`.
- `assets/js/ai/model.js` line ~78: the `reportMode` normalization list currently accepts `'split'` — remove it (only `'editor'|'preview'`).

Tests: extend `tests/unit/state-test.js`: serialize → restore keeps `reportMode` and `settingsActionDocKind`; `analysisSummary` survives a Working Copy save round-trip; `touch('dataset')` clears `analysisSummary`.

### Task #4 — Report reads the bundle; figures become memoized lazy

Files: `assets/js/ai/report.js`, `assets/js/pages/report-page.js`. `vendor/report-export/report-export.js` unchanged.

- `report.js` — add module-level figure cache + memoized generator:

```js
  const figureCache = (window.LF_reportFigureCache = window.LF_reportFigureCache || {});
  function figureFingerprint(exp, sel, includeCharts) { return String(exp.id) + ':' + Number(exp.sync && exp.sync.revision) + ':' + (sel ? JSON.stringify(sel) : '') + ':' + String(!!includeCharts); }
  function reportFigurePreviews(exp) {
    const r = LF.Report.ensureReport(exp), sel = r.figureSelection || {}, includeCharts = LF.State.settings ? !!LF.State.settings.includeCharts : true;
    const key = figureFingerprint(exp, sel, includeCharts);
    if (figureCache[key]) return figureCache[key];
    const model = LF.Report.reportModel(exp);   // deterministic; uses bundle when fresh, legacy otherwise
    const figures = [];
    if (includeCharts) {
      const chart = model.chartData || {};
      figures.push(makeFigure(exp, 'pceDistribution', 'PCE distribution', chart.efficiencies || []));
      figures.push(makeFigure(exp, 'hysteresisDistribution', 'Hysteresis distribution', chart.hysteresis || []));
      figures.push(makeFigure(exp, 'bestJvmCurve', 'Best JV curve', chart.bestCurve || null));
      figures.push(makeFigure(exp, 'efficiencyHysteresis', 'PCE vs hysteresis', chart.scatter || []));
      figures.push(makeFigure(exp, 'topEfficiency', 'Top efficiency', model.topNonRef || []));
      figures.push(makeFigure(exp, 'groupComparison', 'Group comparison', model.groupStatistics || []));
    }
    figureCache[key] = figures;
    return figures;
  }
```

  where `makeFigure(exp, key, title, data)` reuses the **existing** deterministic figure builders already in `report.js` (`makeDataUrl`/`makeBarDataUrl`/etc.) and returns `{key, caption, dataUrl, width, height}`. Keep those builders untouched; just route the six enabled figures through `reportFigurePreviews`.

- Change `reportModel(exp)` so that when `LF.AnalysisSummary.fresh(exp)`:
  - `statistics` = `{ effRV: metrics.eff.rv, effFW: metrics.eff.fw, hysteresisAbsPct: bundle.hysteresisAbsPct, vocRV, vocFW, jscRV, jscFW, ffRV, ffFW }` from `bundle.metrics.*`.
  - `groupStatistics` = bundle `groupStatistics`, each item extended with legacy fields for the vendor: `medianEff/minEff/maxEff = scans.rv (fallback fw)`, `medianVoc/medianJsc/medianFF` likewise. When not fresh, keep the current measurement-based computation (byte-identical today).
  - `chartData` = bundle `chartData` when fresh; keep existing computation otherwise.
  - `figures` getter → `reportFigurePreviews(exp)`.

- `report-page.js` `reportFigurePreview(exp)` (line 24): call `LF.Report.reportFigurePreviews(exp)` instead of `reportModel(exp).figures`. When `LF.AnalysisSummary.fresh(exp)` is false and figures are empty, show the existing muted notice ("No generated figures are enabled…") plus a help line "Run Analyze dataset after Working Copy changes to refresh figures." — never block the MD editor.

Deterministic-first: figures are cached by `(exp.id, revision, figureSelection, includeCharts)` so DOCX/PDF export uses the **exact same PNG `dataUrl`** as the live preview (AGENTS §12). Cache is per-session (`window.LF_reportFigureCache`), rebuilt on demand.

Tests — extend `tests/unit/report-test.js`:
- `reportFigurePreviews(exp)` returns identical entries on two calls (no recompute) and identical `dataUrl` as `reportModel(exp).figures`.
- Fresh-bundle `reportModel.statistics.effRV.median` equals measurement-computed median for a fixed fixture (bundle == legacy equality, the reuse contract).
- `reportModel.groupStatistics` items carry `medianEff` (vendor contract) from `scans.rv`.

---

## Phase #3 — per-scan Compare ("Results" page)

### Task #5 — Compare statistics table + boxplots become per-scan

Files: `assets/js/pages/results-page.js` (functions `compareData`, `boxSvg`, `compare`, `quartiles` helpers).

- Split `compareData(e)` → return per-direction data:

```js
  function compareData(e) {
    const bp = S.state.boxPlot || {}, f = factor(), map = {};
    e.measurements.filter(function (m) { return !m.excluded && (bp.eligibleOnly === false || m.rankingEligible) && (bp.groups || []).includes(groupName(m)); })
      .forEach(function (m) {
        const g = groupName(m);
        map[g] = map[g] || { name: g, fw: [], rv: [] };
        ['fw', 'rv'].forEach(function (d) {
          if (bp.direction && bp.direction !== 'both' && bp.direction !== d) return;
          const x = m[d], key = bp.metric || 'eff';
          if (!x || !Number.isFinite(Number(x[key]))) return;
          let v = Number(x[key]); if (key === 'eff' || key === 'jsc') v /= f;
          map[g][d].push(v);
        });
      });
    return Object.keys(map).sort().map(function (name) {
      const g = map[name];
      return { name: name, count: g.fw.length + g.rv.length, stats: { fw: quartiles(g.fw), rv: quartiles(g.rv) } };
    }).filter(function (x) { return x.stats.fw || x.stats.rv; });
  }
```

- `boxSvg(data, id)`: for each item render **two boxes** when `stats.fw && stats.rv` (fw box then rv box side by side, offset `-bw/2` / `+bw/2`), one box when only one direction present; label `n` shows per-box counts (`n_fw + n_rv`), the group label unchanged; jitter `totalPoints` per direction keeps `<=150` per direction; whiskers/rects/median line reused from the existing single-box code via a small `boxGroup(x, cx, bw, Y)` helper. Legend row `FW · RV` when both exist.
- `compare(e)`: `statsRows` per-scan — columns `Group`, `n`, `FW median±IQR`, `FW min–max`, `RV median±IQR`, `RV min–max` (use `C.fmt(q.med,3)` + IQR; render `—` for missing direction). `summary`/`best`/`medianSpan` computed over `rv` median (fallback `fw`).
- **Reuse the bundle** for the statistics table: when `LF.AnalysisSummary.fresh(e)`, derive the per-scan median/IQR cells from `LF.AnalysisSummary.ensure(e).groupStatistics` matched by `name` (single source per spec); otherwise compute from `compareData` quartiles. A one-line comment cites the reuse contract.
- Empty state: if `data` is empty render the existing `chartEmpty('Select at least one group with usable values.', 260)` and a stats empty row — no broken table.
- Keep `compareMetricMeta`, `compareDefaults`, controls, PNG export intact.

Tests — extend `tests/unit/results-integration-test.js`:
- two groups × fw+rv fixture → `compareData` per-scan medians for each group/direction; `boxSvg` output contains both box groups; table rows count = 2 groups with `fw` and `rv` cells.
- Reuse contract: for a fixed fixture, bundle-driven table medians equal `compareData` quartile medians.

### Task #6 — NOMAD derived analysis reuses the bundle

Files: `assets/js/nomad/nomad.js` line ~245.

- In the derived files section, write `derived/analysis.json` as `{ analysis: C.safeJson(A.analysisOf(exp), 2), analysisSummary: C.safeJson(LF.AnalysisSummary.ensure(exp), 2) }`. This is derived-only, read-only, no readiness change.

Commit after Tasks #5+#6 (they share the bundle contract).

---

## Phase #4 — per-device Design

### Task #7 — Design page: chip selector + "Apply experiment" per device

Files: `assets/js/pages/design-page.js`, `assets/js/ai/operation-steps.js`, `assets/js/app.js`.

- `operation-steps.js` — add deterministic gate next to the existing design steps:

```js
  function applySelectedDevice(exp, deviceId) {
    const p = exp.aiDesignProposal; if (!p) throw new Error('No AI design proposal is available.');
    const src = (p.devices || []).find(function (d) { return d.id === deviceId; }) || (p.devices || []).find(function (d) { return String(d.name) === String(deviceId); });
    if (!src) throw new Error('Selected experiment proposal not found.');
    let changed = applyDesignDevice(exp, src, 'all');
    (p.solutions || []).forEach(function (sol) { if ((src.solution_names || []).some(function (n) { return String(sol.name).toLowerCase() === String(n).toLowerCase(); })) changed += applyDesignSolution(exp, sol); });
    if (!changed) throw new Error('The proposed values are already present or protected by researcher-entered values.');
    exp.design.status = 'reviewing';
    return { changed: changed };
  }
```

  and export it: `LF.DesignAnalysis.applySelectedDevice = applySelectedDevice;` (alongside `applyOne/applyAll`).

- `design-page.js`:
  - `app.js` (after line 301, mirroring the `data-apply-design-proposal` handler): add a click handler for `[data-apply-design-device]`:

```js
        const applyDevice = e.target.closest('[data-apply-design-device]'); if (applyDevice) { try { const out = LF.DesignAnalysis.applySelectedDevice(S.state.experiment, applyDevice.dataset.applyDesignDevice); markModified('design'); render(); LF.UI.toast('Applied AI-suggested missing values to ' + (out.changed) + ' Design field(s) for the selected experiment.', 'success'); } catch (err) { LF.UI.toast(err.message || String(err), 'error'); } return; }
```

  - Replace the `<select id="designDeviceSelect">` block with a chip list (`ui-kit.html` `.design-chip-list`/`.design-chip` classes exist in `app.css`):

```html
<div class="design-experiment-chips">
  <div class="design-chip-list">
    <button type="button" class="design-chip <active? 'active'>" data-design-device="<id>"><strong><name></strong><small><samples>/<n> measurements</small></button>
  </div>
  <div class="design-completion"><strong>42%</strong><span>5 missing</span></div>
  <button class="button primary compact" data-action="design.infer" data-action-device="<selectedId>">AI fill gaps</button>
  <button class="button primary compact" data-apply-design-device="<selectedId>">Apply experiment</button>
  <button class="button ghost compact" id="refreshDesignEvidence">Refresh evidence</button>
</div>
```

    Reuse the existing `data-design-device` change handler in `app.js` (line ~311) to set `selectedDesignDeviceId` and re-render; the new `data-apply-design-device` button uses a click handler that calls `LF.DesignAnalysis.applySelectedDevice(exp, id)`, then `LF.State.touch('design', id)` + re-render (pattern already used by `data-apply-design-proposal` in `app.js`).
  - `proposalPanel(exp)` → `proposalPanel(exp, selectedDeviceId)`: filter the `devices` rows to the selected device only; keep solution rows; update header meta counts.
  - `stackTable(dev)`: keep the existing `.design-stack-visual` wrapper but render each layer with UI-kit classes `design-stack-layer`, `layer-tone-<i%N>` (already styled in `app.css` lines ~813–986). No new CSS.
  - `render(options)`: when no device, keep current empty state.

Tests — `tests/unit/design-ai-apply-test.js`:
- `aiDesignProposal` with 2 devices (A already partially applied, B fresh) + 1 shared solution; `applySelectedDevice(exp, 'deviceB')` changes only deviceB + linked solution, leaves deviceA untouched, never overwrites a `user_confirmed` value; second call returns `{changed:0}`; missing proposal throws.

---

## Phase #5 — Report: intradocument tabs

### Task #8 — report.store per-document sync; no `split`

Files: `assets/js/ai/operation-steps.js`, `assets/js/ai/report.js`.

- `'report.store'` (line 56): after writing the active doc, sync only that doc:

```js
    LF.Report.syncDesignEvidence(exp, kind);
    LF.Report.syncAnalysisEvidence(exp, kind);
```

  (`kind` already resolved as `ctx.params.document_kind === 'paper' ? 'paper' : 'lab'`.)
- `report.js` `syncDesignEvidence(exp, kind)` / `syncAnalysisEvidence(exp, kind)`: accept an optional `kind`; when omitted default to the currently active document (`currentReport(exp).kind`). Write evidence into **that document only** (remove the both-docs upsert). This keeps the `nomad.js:234` call (`syncDesignEvidence(exp)`) valid and consistent.
- `report.js` `ensureReport`: remove any `reportMode === 'split'` coercion.

Tests — extend `tests/unit/report-test.js`: run `report.store` for `paper`; assert `labMarkdown` unchanged and `paperMarkdown` updated; `analysisEvidenceMarkdown('lab')` still resolves.

### Task #9 — report-page + workshop per-document controls

Files: `assets/js/pages/report-page.js`, `assets/js/pages/settings-page.js`, `assets/js/app.js`.

- `report-page.js`:
  - The `#runReportAiAction` handler (`app.js:290`) already targets the **active document** for `improve:*` (via `report.store` → `setActiveMarkdown` on the current kind) and passes `document_kind` for `generate:*`. No handler change needed; the two-document selector plus active-doc writing is the per-document behavior the spec wants.
  - Add an "Improve selection" button in `.report-toolbar` next to the markdown tools. The existing generic binding in `assistant.js` (`button[data-operation]`, line 28) already handles it — `params(el)` reads `data-action-mode` → `mode`, and `selection(el)` fires only when `data-action="report.improve"` + `data-action-mode="improve_selection"` and reads the `#reportMarkdown` selection:

```html
<button type="button" class="button ghost compact" id="reportImproveSelection" data-action="report.improve" data-action-kind="<kind>" data-action-mode="improve_selection">Improve selection</button>
```

    Disable it until the editor `<textarea id="reportMarkdown">` has a non-empty selection: after each render, add listeners (`mouseup`/`keyup`/`selectionchange`) that toggle `disabled` based on `selectionStart !== selectionEnd`. No app.js handler needed — the generic runner picks it up.
  - Keep the mobile Write/Preview toggle working (`reportMode` now only `editor|preview`).
- `settings-page.js` `actionEditorPanel`:
  - when `selected.id` is `report.generate` or `report.improve`, render a compact select `#actionReportDocKind` (lab/paper) beside the Run button, defaulting from `LF.State.state.settingsActionDocKind`; when a choice is made the Run button gets `data-action-kind="<chosen>"` and the choice persists via `LF.State.state.settingsActionDocKind`.
  - AI Helpers view reuses the same panel — no duplicate config (AGENTS §6).
- `app.js` `change` handler: add `#actionReportDocKind` → set `S.state.settingsActionDocKind = value; S.persist && S.persist(); LF.SettingsPage.render();`.

Tests — extend `tests/unit/settings-integration-test.js` (or nearest existing): selecting a report doc kind persists and the Run button carries the matching `data-action-kind`.

### Task #10 — OPERATIONS docs + WORKFLOW update

- `docs/specs/OPERATIONS.md`: add `analysis.summarize` entry (goal, why it exists, kind `DETERMINISTIC`, role Automatic, input dependency `dataset.analyze`, mutation scope "Working Copy internal derived field only", ordered checkpoints `collect`→`store`, output the bundle, what it must not do: mutate analysis or scientific fields, never a NOMAD readiness authority).
- `docs/WORKFLOW.md`: subsection in §6 explaining the internal (non-public-workshop) Analysis Summary Operation, its role as single source for Compare/Report/NOMAD statistics, and that Report figures are rasterized on demand (cache keyed by revision+figure selection).

---

## Final gates

### Task #11 — Regenerate + full battery + regression

1. Run the six Python validators (contract validator must pass with `analysis.summarize` in PUBLIC set) and the full unit suite.
2. `find assets/js tests -name '*.js' -print0 | xargs -0 -n1 node --check`
3. Full-flow smoke: import fixture ZIP → Review → apply safe correction → Results (per-scan Compare) → Design (chip selector + Apply experiment) → Report (Lab/Paper tabs, per-doc AI action, Improve selection, memoized figures) → NOMAD staging → Save Working Copy.
4. Export regression: upload the same fixture; the saved Working Copy's `raw/source.zip` stays **byte-identical** (AGENTS §2/§16); DOCX/PDF embed the same PNGs as the preview.
5. `tests/unit/report-export-test.js` unchanged and green.

### Task #12 — Docs pass in the same change

- `AGENTS.md`: add `analysis.summarize` to §5 as an internal OPERATION; note the Compare/Report/NOMAD groupStatistics reuse under the relevant sections; keep §15 same-change rule.

Commit point (final).

---

## Risks / open items recorded during design

1. `groupStatistics` legacy fields (`medianEff`, `medianVoc`, `medianJsc`, `medianFF`) are required by `vendor/report-export` and the group-comparison figure. They are derived from `scans.rv` fallback `scans.fw`; if the vendor or figures must keep `minEff`/`maxEff` too, keep them derived the same way (no new vendor fields).
2. `chartData.thresholds.hysteresisPct` must equal the constant `report.js` uses today, or DOCX/PDF hysteresis figures change. If report.js computes it from data, mirror that computation instead of a literal `5`.
3. The figure cache is session-scoped and keyed by revision — a Working Copy mutation invalidates it automatically (revision bump) so no stale previews. If a mutation ever occurs without a revision bump (should not), the cache key would not change; the `fresh()` guard on the bundle still keeps stats honest.
4. `applySelectedDevice` resolves the proposal device by `id` first, then by `name`; sample-name matching (existing `proposalDeviceTarget`) is deliberately not reused here because the action is already scoped to the selected chip.
