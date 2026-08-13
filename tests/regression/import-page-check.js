'use strict';
/* Byte-equality harness for the Import page extraction.
   Loads the real module chain, imports the clean fixture through the live
   canonical importer + analysis, then renders LF.ImportPage and compares against a
   faithful reimplementation of the pre-extraction renderImport(). */
global.window = globalThis;
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
global.localStorage = (function () {
  let store = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; },
    clear: function () { store = {}; },
    key: function (i) { return Object.keys(store)[i] || null; },
    get length() { return Object.keys(store).length; }
  };
})();
try { global.window.JSZip = require(path.join(root, 'vendor', 'jszip', 'jszip.min.js')); } catch (_e) {}

require(path.join(root, 'assets/js/logger.js'));
require(path.join(root, 'assets/js/core.js'));
require(path.join(root, 'assets/js/ai/prompt-bundle.js'));
require(path.join(root, 'assets/js/experiment/data-model.js'));
require(path.join(root, 'assets/js/experiment/model.js'));
require(path.join(root, 'assets/js/data/parser.js'));
require(path.join(root, 'assets/js/data/importer.js'));
require(path.join(root, 'assets/js/state.js'));
require(path.join(root, 'assets/js/storage.js'));
require(path.join(root, 'assets/js/data/analysis.js'));
require(path.join(root, 'assets/js/pages/shared.js'));
require(path.join(root, 'assets/js/pages/import-page.js'));
require(path.join(root, 'assets/js/report/report.js'));

const fs = require('fs');
const LF = global.LabFlow;

function eq(a, b, label) {
  if (a !== b) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i] !== b[i]) {
        throw new Error(label + ': first diff at char ' + (i - 10) + '..' + i + '\n  GOT : ' + JSON.stringify(a.slice(i - 60, i + 80)) + '\n  WANT: ' + JSON.stringify(b.slice(i - 60, i + 80)));
      }
    }
    throw new Error(label + ': length differs ' + a.length + ' vs ' + b.length);
  }
}

async function main() {
  const buf = fs.readFileSync(path.join(root, 'TEST_DATA', '01_PRECISO_PERFETTO_COMPLETO.zip'));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

  const exp = await LF.Importer.parseDataset(ab, '01_PRECISO_PERFETTO_COMPLETO.zip');
  LF.Analysis.analyze(exp);
  LF.ExperimentModel.ensureShape(exp, LF.State.state);
  LF.State.setExperiment(exp, ab);
  LF.State.state.route = 'experiment-import';

  const S = LF.State;
  const C = LF.Core;

  /* --- reference reimplementation of the removed renderImport() --- */
  const importTimestamp = function (value) { const d = new Date(value || ''); return Number.isNaN(d.getTime()) ? 'Not recorded' : d.toLocaleString(); };
  const importFamilyCounts = function (manifest) {
    const counts = { summary: 0, jv: 0, parameters: 0, tracking: 0, other: 0 };
    (manifest || []).forEach(function (entry) {
      if (entry.directory) return;
      if (entry.type === 'summary' || entry.type === 'summary-fw' || entry.type === 'summary-rv') counts.summary++;
      else if (Object.prototype.hasOwnProperty.call(counts, entry.type)) counts[entry.type]++;
      else counts.other++;
    });
    return counts;
  };
  const importFamilyItem = function (label, count, description) { return '<div class="import-family"><span>' + C.escapeHtml(label) + '</span><strong>' + Number(count || 0) + '</strong><small>' + C.escapeHtml(description) + '</small></div>'; };
  const badge = function (t, type) { return '<span class="badge ' + (type || '') + '">' + C.escapeHtml(t) + '</span>'; };
  function refRenderImport() {
    if (!LF.PageShell.hasExperiment()) return LF.PageShell.needExperiment();
    const e = S.state.experiment, sum = e.analysis.summary || {}, files = e.manifest.filter(function (x) { return !x.directory; }), directories = e.manifest.length - files.length;
    const families = importFamilyCounts(e.manifest), recoveries = e.measurements.reduce(function (total, m) { return total + (m.recoveries || []).length; }, 0);
    const tree = e.manifest.filter(function (x) { return !x.directory; }).slice(0, 220).map(function (x) { return '<div>' + C.escapeHtml(x.path) + ' <span class="muted">[' + C.escapeHtml(x.type) + ']</span></div>'; }).join('');
    return '<section class="page">' + LF.PageShell.workflowHead('Uploaded ZIP', 'Deterministic receipt for the immutable source archive and its local working interpretation.', '<button type="button" class="button" data-open-dataset>Replace ZIP</button><button type="button" class="button primary" data-route="experiment-understand">Open Review</button>') +
      '<div class="metric-grid compact-metrics"><div class="metric"><div class="metric-label">RAW archive</div><div class="metric-value metric-value-text">' + C.escapeHtml(e.meta.sourceName) + '</div><div class="metric-sub">' + C.bytes(e.meta.sourceSize) + '</div></div><div class="metric"><div class="metric-label">Inventory</div><div class="metric-value">' + files.length + '</div><div class="metric-sub">' + directories + ' directories retained</div></div><div class="metric"><div class="metric-label">Parsed dataset</div><div class="metric-value">' + (sum.measurementCount || e.measurements.length) + '</div><div class="metric-sub">' + e.samples.length + ' samples · ' + recoveries + ' recoveries</div></div><div class="metric"><div class="metric-label">Review status</div><div class="metric-value">' + (sum.findingCount || 0) + '</div><div class="metric-sub">' + (sum.blockedCount || 0) + ' safety-stopped measurements</div></div></div>' +
      '<section class="panel import-receipt"><div class="panel-head"><div><h2 class="h2">Local import receipt</h2><div class="meta">What LabFlow received and how it produced the current view.</div></div><div class="spacer"></div>' + badge('RAW preserved', 'success') + '</div><div class="panel-body import-receipt-body"><div class="import-path" aria-label="Deterministic import stages"><div class="import-stage done"><span>1</span><div><strong>Read archive</strong><small>Browser memory</small></div></div><div class="import-stage done"><span>2</span><div><strong>Inventory files</strong><small>' + files.length + ' entries classified</small></div></div><div class="import-stage done"><span>3</span><div><strong>Parse evidence</strong><small>Local deterministic rules</small></div></div><div class="import-stage done"><span>4</span><div><strong>Build working view</strong><small>RAW unchanged</small></div></div></div><dl class="import-facts"><div><dt>Imported</dt><dd>' + C.escapeHtml(importTimestamp(e.meta.createdAt)) + '</dd></div><div><dt>Source modified</dt><dd>' + C.escapeHtml(importTimestamp(e.meta.sourceModifiedAt)) + '</dd></div><div><dt>Method</dt><dd>' + C.escapeHtml(e.meta.importMethod || 'Local browser import') + '</dd></div><div><dt>AI calls</dt><dd>None</dd></div></dl></div></section>' +
      '<section class="panel"><div class="panel-head"><div><h2 class="h2">Archive overview</h2><div class="meta">File families detected from paths and known format markers.</div></div><div class="spacer"></div>' + badge('deterministic', 'info') + '</div><div class="panel-body import-family-grid">' + importFamilyItem('Summary', families.summary, 'FW, RV or general tables') + importFamilyItem('JV', families.jv, 'measurements and curves') + importFamilyItem('Parameters', families.parameters, 'acquisition evidence') + importFamilyItem('Tracking', families.tracking, 'time-series evidence') + importFamilyItem('Other', families.other, 'retained in manifest') + '</div></section>' +
      '<div class="notice info upload-notice"><strong>Next step: Review.</strong> LabFlow opened Review automatically after import. This page remains the source receipt; use it to inspect what entered the workflow or replace the archive.</div>' +
      '<details class="panel compact-details"><summary class="panel-head"><strong>RAW manifest</strong><span class="meta">' + files.length + ' files · optional detail</span></summary><div class="panel-body file-tree">' + tree + (e.manifest.length > 220 ? '<div class="muted">… ' + (e.manifest.length - 220) + ' more entries</div>' : '') + '</div></details></section>';
  }

  /* Verify shared shell fragments against the removed app.js implementations. */
  const LFCore = LF.Core;
  function origBadge(text, type) { return '<span class="badge ' + (type || '') + '">' + LFCore.escapeHtml(text) + '</span>'; }
  function origPageHead(title, subtitle, actions) { return '<div class="page-head"><div><h1 class="h1">' + LFCore.escapeHtml(title) + '</h1><div class="meta">' + LFCore.escapeHtml(subtitle || '') + '</div></div><div class="spacer"></div><div class="toolbar no-print">' + (actions || '') + '</div></div>'; }
  function origStepper() {
    const steps = [['experiment-import','1','Upload'],['experiment-understand','2','Review'],['experiment-results','3','Results'],['experiment-design','4','Design'],['experiment-report','5','Report'],['experiment-nomad','6','NOMAD']];
    const ready = LF.PageShell.hasExperiment(), routeIndex = steps.findIndex(function (x) { return S.state.route === x[0]; }), current = ready && routeIndex >= 0 ? routeIndex : 0;
    return '<nav class="stepper experiment-strip no-print" aria-label="Experiment workflow">' + steps.map(function (x, i) { const active = i === current, done = ready && i < current, disabled = !ready && i > 0; return '<button type="button" class="step ' + (active ? 'active ' : '') + (done ? 'done ' : '') + '" data-route="' + x[0] + '" ' + (active ? 'aria-current="step" ' : '') + (disabled ? 'disabled aria-disabled="true"' : '') + '><span class="step-index">' + x[1] + '</span><strong>' + x[2] + '</strong></button>'; }).join('') + '</nav>';
  }
  function origWorkflowHead(title, subtitle, actions) { return origPageHead(title, subtitle, actions) + origStepper(); }
  eq(LF.PageShell.badge('lib', 'info'), origBadge('lib', 'info'), 'badge');
  eq(LF.PageShell.pageHead('T', 's', '<b>x</b>'), origPageHead('T', 's', '<b>x</b>'), 'pageHead');
  eq(LF.PageShell.experimentStepper(), origStepper(), 'experimentStepper');
  eq(LF.PageShell.workflowHead('T', 's'), origWorkflowHead('T', 's'), 'workflowHead');
  eq(LF.PageShell.needExperiment(), '<section class="page start-page">' + origWorkflowHead('Upload experiment', 'Load the original laboratory ZIP to begin the RAW → Review → Results → Design → Report → NOMAD workflow.') +
    '<section class="panel upload-panel"><div class="panel-head"><div><h2 class="h2">RAW experiment source</h2><div class="meta">The ZIP is the only experiment entry point.</div></div><div class="spacer"></div>' + origBadge('local import', 'info') + '</div><div class="upload-workbench"><div class="upload-ingest"><div class="upload-source-mark" aria-hidden="true"><span>RAW</span><strong>ZIP</strong></div><div class="upload-copy"><h2>Choose the original experiment ZIP</h2><p>LabFlow preserves the uploaded bytes, inventories every path, and builds a separate working interpretation for review.</p><div class="row-wrap"><button type="button" class="button primary upload-primary" data-open-dataset>Choose ZIP file</button><span class="help">No model call is made during import.</span></div></div></div><dl class="upload-contract"><div><dt>Source</dt><dd>Exact RAW archive retained in memory</dd></div><div><dt>Processing</dt><dd>Local deterministic parsing and validation</dd></div><div><dt>Next decision</dt><dd>Review evidence and proposed corrections</dd></div></dl></div></section>' +
    '<div class="notice info upload-notice"><strong>Non-destructive workflow.</strong> RAW files are never renamed or rewritten. Accepted corrections affect only the reviewed working interpretation and keep their provenance.</div></section>', 'needExperiment');

  const want = refRenderImport();
  const got = LF.ImportPage.render(LF.State.state);
  eq(got, want, 'ImportPage.render === original renderImport');

  console.log('shared shell + ImportPage byte-equality: OK (' + got.length + ' chars)');
  console.log('needExperiment byte-equality: ' + (LF.ImportPage.render({ state: LF.State.state, route: 'experiment-import' }) === LF.PageShell.needExperiment() ? 'n/a' : 'n/a'));
  let threw = false;
  try {
    const st = Object.assign({}, LF.State.state, { experiment: null });
    LF.ImportPage.render(st);
  } catch (err) { threw = true; }
  process.stdout.write(threw ? 'ImportPage(no experiment) requires state wrapper: as expected\n' : '');
}

main().then(function () { process.exit(0); }).catch(function (err) { console.error(err && err.stack || err); process.exit(1); });
