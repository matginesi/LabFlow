'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/core.js');
require('../../assets/js/experiment/domain-schema.js');
require('../../assets/js/experiment/data-model.js');
require('../../assets/js/experiment/action-data.js');
require('../../assets/js/experiment/data-contracts.js');
require('../../assets/js/experiment/derived-state.js');
require('../../assets/js/experiment/canonical-store.js');
require('../../assets/js/data/pipeline.js');

function assert(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error((label || 'assert') + ': expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(actual));
}
function truthy(value, label) { if (!value) throw new Error(label || 'expected truthy'); }

module.exports = function (t, LF) {
  t['DomainSchema is the single discoverable record/root contract'] = function () {
    const c = LF.DomainSchema.contract();
    truthy(c.records.some(function (x) { return x.kind === 'measurement' && /FW\/RV/.test(x.description); }), 'measurement contract');
    truthy(c.roots.some(function (x) { return x.key === 'measurements' && x.recordKind === 'measurement'; }), 'measurement root ownership');
    assert(LF.DomainSchema.rootForRecordKind('sample').key, 'samples', 'record kind maps to one root');
  };

  t['ExperimentData generic record factory follows DomainSchema ownership'] = function () {
    const e = LF.DataModel.create({ sourceName: 'factory.zip' });
    const s = e.addRecord('sample', { id: 's1', name: 'A' });
    assert(s.kind, 'sample', 'normalized kind');
    assert(e.samples.length, 1, 'stored in schema-owned root');
    let threw = false; try { e.addRecord('design_layer', { id: 'l1' }); } catch (_err) { threw = true; }
    assert(threw, true, 'nested non-root kind requires its owning projection');
  };

  t['DomainSchema snapshot persists declared state and excludes runtime projections'] = function () {
    const e = LF.DataModel.create({ sourceName: 'snapshot.zip' });
    e.pipeline = { status: 'ready' }; e.canonical = { transient: true }; e.datasetAnalysis = { transient: true };
    e.patches.push(LF.DomainSchema.create('patch', { id: 'p1', target: { kind: 'dataset', id: e.id }, operation: 'set', field: 'meta.name', to: 'x', status: 'applied' }));
    const snap = LF.DomainSchema.snapshot(e);
    truthy(Array.isArray(snap.patches) && snap.patches.length === 1, 'working provenance persists');
    assert(snap.pipeline, undefined, 'pipeline runtime excluded');
    assert(snap.canonical, undefined, 'canonical cache excluded');
    assert(snap.datasetAnalysis, undefined, 'review projection excluded');
  };

  t['DomainSchema snapshot is detached and ActionData is the only Action-output root'] = function () {
    const e = LF.DataModel.create({ sourceName: 'action-data.zip' });
    LF.ActionData.setProposal(e, 'design.infer', 'd1', { summary: 'proposal' });
    LF.ActionData.setAnnotation(e, 'results.interpret', { summary: 'annotation' });
    const beforeKeys = Object.keys(e.actionData.proposals);
    LF.ActionData.proposals(e, 'missing.action');
    assert(Object.keys(e.actionData.proposals), beforeKeys, 'read APIs do not create Action buckets');
    const snap = LF.DomainSchema.snapshot(e);
    snap.actionData.proposals['design.infer'].d1.summary = 'changed snapshot';
    assert(LF.ActionData.proposal(e, 'design.infer', 'd1').summary, 'proposal', 'snapshot cannot mutate live aggregate');
    e.actionData.annotations = [];
    const invalid = LF.DataContracts.validate(e);
    truthy(invalid.errors.some(function (x) { return x.code === 'ACTION_DATA_BUCKET_INVALID'; }), 'malformed ActionData buckets fail the domain contract');
    e.actionData.annotations = {};
  };

  t['DerivedState invalidates ActionData by Action id without path parsing'] = function () {
    const e = LF.DataModel.create({ sourceName: 'derived-actions.zip' });
    LF.ActionData.setProposal(e, 'dataset.resolve-ambiguities', '', { proposals: [{ id: 'x' }] });
    LF.ActionData.setProposal(e, 'design.infer', 'd1', { summary: 'x' });
    LF.ActionData.setStatus(e, 'design.infer', 'd1', { state: 'suggested' });
    LF.ActionData.setAnnotation(e, 'results.interpret', { summary: 'x' });
    LF.DerivedState.invalidate(e, 'dataset');
    assert(LF.ActionData.proposal(e, 'dataset.resolve-ambiguities'), null, 'dataset ambiguity proposal invalidated');
    assert(LF.ActionData.proposal(e, 'design.infer', 'd1'), null, 'design proposal invalidated');
    assert(LF.ActionData.status(e, 'design.infer', 'd1'), null, 'design status invalidated');
    assert(LF.ActionData.annotation(e, 'results.interpret'), null, 'results annotation invalidated');
  };

  t['CanonicalStore build is a pure projection over the LabFlow Data'] = function () {
    const e = LF.DataModel.create({ sourceName: 'canonical.zip' });
    e.samples = [LF.DomainSchema.create('sample', { id: 's1', name: 'N1_1A', rawName: 'N1 1A', aliases: ['alias-b', 'alias-a'] })];
    e.measurements = [LF.DomainSchema.create('measurement', { id: 'm1', sampleId: 's1', sample: 'N1_1A', rawSample: 'N1 1A', sampleAliases: ['from-measurement'] })];
    const before = JSON.stringify(e.samples);
    const store = LF.CanonicalStore.build(e);
    assert(JSON.stringify(e.samples), before, 'canonical projection cannot mutate sample records');
    truthy(store.aliases[0].aliases.includes('from-measurement'), 'projection may enrich its own alias index');
    truthy(Array.isArray(store.records.samples), 'read projection is named records, not a second entity model');
  };

  t['DerivedState exposes dependencies and invalidates without State knowing feature paths'] = function () {
    const e = LF.DataModel.create({ sourceName: 'derived.zip' });
    e.analysisSummary = { old: true }; e.experimentBrief = { old: true };
    const contract = LF.DerivedState.describe();
    truthy(contract.some(function (x) { return x.id === 'analysis-summary' && x.dependsOn.includes('dataset'); }), 'dependency discoverable');
    const changed = LF.DerivedState.invalidate(e, 'dataset');
    truthy(changed.includes('analysis-summary'), 'projection invalidated');
    assert(e.analysisSummary, undefined, 'path removed');
    assert(e.experimentBrief, undefined, 'dependent path removed');
  };

  t['DataPipeline exposes a unique logical plan separately from runtime executions'] = function () {
    const plan = LF.DataPipeline.stages();
    assert(new Set(plan.map(function (x) { return x.id; })).size, plan.length, 'logical plan has unique stage ids');
    truthy(plan.every(function (x) { return Array.isArray(x.after) && Array.isArray(x.reads) && Array.isArray(x.writes) && x.phase; }), 'stage metadata is explicit');
    const status = LF.DataPipeline.status(LF.DataModel.create({ sourceName: 'not-run.zip' }));
    assert(status.plan.map(function (x) { return x.id; }), plan.map(function (x) { return x.id; }), 'status exposes same logical plan');
    assert(status.executions, [], 'no execution trace before run');
  };
};
