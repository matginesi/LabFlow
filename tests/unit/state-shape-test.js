'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/experiment/data-model.js');
require('../../assets/js/state.js');

function assert(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error((label || 'assert') + ': expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(actual));
  }
}
function truthy(v, label) { if (!v) throw new Error((label || 'assert') + ': expected truthy, got ' + JSON.stringify(v)); }

module.exports = function (t, LF) {
  const S = LF.State;

  t['state has the canonical nested shape'] = function () {
    assert(Object.keys(S.state).sort(), ['experiment', 'operationRun', 'project', 'ui', 'user', 'workspace'], 'state top-level keys');
    assert(S.state.user.name, '', 'user default');
    assert(S.state.workspace.theme, 'instrument', 'workspace theme default');
    assert(S.state.project, {}, 'project slot');
    assert(S.state.operationRun, null, 'operationRun starts null');
    assert(typeof S.state.ui.route, 'string', 'ui.route');
    assert(S.state.ui.route, 'experiment-import', 'app starts on upload screen');
    assert(typeof S.state.ui.assistantOpen, 'boolean', 'ui.assistantOpen');
    assert(S.state.ui.resultsTab, 'overview', 'ui.resultsTab default');
  };

  t['experiment slot holds the canonical ExperimentData shape'] = function () {
    const exp = S.state.experiment;
    assert(Array.isArray(exp.files), true, 'files');
    assert(Array.isArray(exp.entities), true, 'entities');
    assert(Array.isArray(exp.blocks), true, 'blocks');
    assert(Array.isArray(exp.patches), true, 'patches');
    assert(exp.sync && Number.isInteger(exp.sync.revision), true, 'sync.revision');
    assert(exp.raw && exp.raw.sourceArchive, null, 'fresh experiment has no archive bytes');
  };

  t['scientific state lives once on the canonical experiment root'] = function () {
    const exp = S.ensureExperiment('shape-test');
    truthy(exp.derived, 'derived exists');
    assert(exp.derived.chat && typeof exp.derived.chat, 'object', 'derived.chat');
    assert(Array.isArray(exp.derived.chat.conversation), true, 'derived.chat.conversation');
    assert(exp.derived.operations && typeof exp.derived.operations, 'object', 'derived.operations');
    assert(exp.analysis && typeof exp.analysis, 'object', 'analysis');
    assert(exp.design && typeof exp.design, 'object', 'design');
    assert(exp.report && typeof exp.report, 'object', 'report');
    assert(Array.isArray(exp.manifest), true, 'manifest');
  };

  t['ensureExperiment is idempotent and route-independent'] = function () {
    const a = S.ensureExperiment('once');
    const b = S.ensureExperiment('twice');
    assert(a === b, true, 'same canonical object across calls');
    assert(a === S.state.experiment, true, 'canonical object is the state slot');
    const routeBefore = S.state.ui.route;
    S.state.ui.route = 'experiment-design';
    const c = S.ensureExperiment('route-call');
    assert(c === a, true, 'route change never replaces the working object');
    S.state.ui.route = routeBefore;
  };

  t['setExperiment records an experiment and resets selection state'] = function () {
    const exp = LF.DataModel.create({ bytes: new Uint8Array([1]).buffer, sourceName: 'sample.zip' });
    LF.DataModel.addBlock(exp, {
      type: 'table', family: 'jv', name: 'x metrics', file: { id: 'f_1', path: 'x/JV.txt' },
      entities: [], schema: { columns: [] }, data: { header: ['a'], rows: [{ a: 1 }] }, metadata: {}
    });
    S.setExperiment(exp, new Uint8Array([1]).buffer);
    assert(S.state.experiment === exp, true, 'experiment stored');
    assert(S.state.experiment.raw.sourceArchive instanceof ArrayBuffer, true, 'raw archive retained on experiment');
    assert(S.state.ui.selectedMeasurementId, null, 'selection reset when no measurements');
    S.state.ui.selectedMeasurementId = 'stale-id';
    S.setExperiment(LF.DataModel.create({ sourceName: 'y.zip' }));
    assert(S.state.ui.selectedMeasurementId, null, 'reset on replace');
  };

  t['touch advances the revision through DataModel and invalidates NOMAD projections'] = function () {
    const exp = LF.DataModel.create({ sourceName: 'rev.zip' });
    S.setExperiment(exp);
    const r0 = S.state.experiment.sync.revision;
    S.touch('dataset');
    assert(S.state.experiment.sync.revision, r0 + 1, 'revision advanced');
    truthy(S.state.experiment.meta.modifiedAt, 'modifiedAt stamped');
    assert(S.state.experiment.nomad.validation, null, 'NOMAD validation invalidated');
    assert(S.state.experiment.nomad.staleReason, 'dataset', 'staleness reason recorded');
  };

  t['dataset mutation invalidates stored AI analysis and correction dossier'] = function () {
    const exp = LF.DataModel.create({ sourceName: 'analysis.zip' });
    exp.datasetAnalysis={summary:'old',findings:[]};
    exp.aiCorrectionPlan={proposals:[]};
    S.setExperiment(exp);
    S.touch('dataset');
    assert(S.state.experiment.datasetAnalysis, undefined, 'analysis invalidated');
    assert(S.state.experiment.aiCorrectionPlan, undefined, 'corrections invalidated');
  };

  t['proposal-only scope does not invalidate NOMAD projections'] = function () {
    const exp = LF.DataModel.create({ sourceName: 'proposal.zip' });
    S.setExperiment(exp);
    S.state.experiment.nomad.validation = { ready: true };
    S.touch('ai');
    assert(S.state.experiment.nomad.validation && S.state.experiment.nomad.validation.ready, true, 'validation preserved under ai scope');
    assert(S.state.experiment.nomad.staleReason, undefined, 'no staleness marker for ai scope');
  };

  t['operationRun records the single active workflow'] = function () {
    const exp = LF.DataModel.create({ sourceName: 'run.zip' });
    S.setExperiment(exp);
    const run = S.startOperationRun({ operationId: 'dataset.analyze', stepIndex: 1 });
    assert(run.operationId, 'dataset.analyze', 'operationId');
    assert(run.stepIndex, 1, 'stepIndex');
    assert(run.status, 'running', 'status');
    assert(run.aborted, false, 'aborted flag');
    assert(run.sourceRevision, S.state.experiment.sync.revision, 'sourceRevision');
    assert(S.state.operationRun === run, true, 'recorded on state');
    S.endOperationRun('done');
    assert(S.state.operationRun.status, 'done', 'terminal status');
  };

  t['values routed to designed nest, surface methods intact'] = function () {
    const seen = [];
    const unsub = S.subscribe(function () { seen.push(1); });
    S.setRoute('logs');
    assert(S.state.ui.route, 'logs', 'route routed');
    assert(S.state.ui.lastExperimentRoute, 'experiment-import', 'last experiment route preserved');
    assert(seen.length >= 1, true, 'notify fired');
    unsub();
    const n = seen.length;
    S.notify('x');
    assert(seen.length, n, 'unsubscribe stops notifications');
  };
};
