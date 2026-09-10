'use strict';
require('../../assets/js/experiment/data-model.js');

function assert(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error((label || 'assert') + ': expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(actual));
  }
}

module.exports = function (t, LF) {
  const DM = LF.DataModel;

  function sampleExperiment() {
    const exp = DM.create({ bytes: new Uint8Array([1, 2, 3]).buffer, sourceName: 'demo.zip', sourceModifiedAt: '2026-01-01T00:00:00Z' });
    const fw = DM.addFile(exp, { path: 'demo/JV Summary_Parameters FW.txt', name: 'JV Summary_Parameters FW.txt', extension: '.txt', family: 'summary', type: 'summary-fw', size: 10 });
    DM.addFile(exp, { path: 'demo/run1/Stability (JV)_A.txt', name: 'Stability (JV)_A.txt', extension: '.txt', family: 'jv', type: 'jv', size: 20 });
    const condition = DM.addRecord(exp, 'experiment', { name: 'REF', isRef: true, sampleIds: [], runIds: [], measurementIds: [] });
    const s1 = DM.addRecord(exp, 'sample', { name: 'REF A', rawName: 'REF A', isRef: true, group: 'REF', experiment: 'REF', experimentId: condition.id, runIds: [], measurementIds: [] });
    condition.sampleIds.push(s1.id);
    condition.sampleNames.push(s1.name);
    const metrics = DM.addBlock(exp, {
      type: 'table', family: 'jv', name: 'A metrics', direction: 'fw',
      file: { id: fw.id, path: fw.path, locator: { header: 'File', row: 0 } },
      refs: [{ kind: 'sample', id: s1.id }],
      schema: { columns: [{ name: 'voc', unit: 'V' }, { name: 'jsc', unit: 'mA/cm²' }] },
      data: { header: ['voc', 'jsc'], rows: [{ voc: 1.05, jsc: 24.1 }] },
      metadata: {}
    });
    return { exp: exp, fw: fw, s1: s1, metrics: metrics };
  }

  t['create produces the canonical aggregate shape without parallel aggregate aliases'] = function () {
    const exp = DM.create({ bytes: new Uint8Array([9]).buffer, sourceName: 'x.zip' });
    assert(exp.files, [], 'files');
    assert(exp.blocks, [], 'blocks');
    assert(exp.patches, [], 'patches');
    assert(exp.experiments, [], 'experiments');
    assert(exp.samples, [], 'samples');
    assert(exp.runs, [], 'runs');
    assert(exp.measurements, [], 'measurements');
    assert(Object.prototype.hasOwnProperty.call(exp, 'entities'), false, 'no parallel entities collection');
    assert(exp.raw.sourceName, 'x.zip', 'raw.sourceName');
    assert(exp.raw.sourceArchive.byteLength, 1, 'raw bytes immutably retained');
    assert(exp.meta.name, 'x', 'name from zip basename');
  };

  t['DomainSchema preserves unknown Design confidence as null'] = function () {
    const solution = LF.DomainSchema.create('design_solution', { name: 'Unknown confidence', confidence: null });
    const layer = LF.DomainSchema.create('design_layer', { material: 'SnO2', confidence: '' });
    const device = LF.DomainSchema.create('design_device', { name: 'D1' });
    assert(solution.confidence, null, 'solution confidence');
    assert(layer.confidence, null, 'layer confidence');
    assert(device.confidence, null, 'device confidence');
  };

  t['generic addRecord uses DomainSchema ownership to attach typed records'] = function () {
    const exp = DM.create({ sourceName: 'x.zip' });
    const experiment = DM.addRecord(exp, 'experiment', { name: 'N3' });
    const sample = exp.addRecord('sample', { name: 'N3_1_1A', experimentId: experiment.id, experiment: 'N3', group: 'N3' });
    assert(exp.experiments[0].id, experiment.id, 'experiment collection');
    assert(exp.samples[0].id, sample.id, 'sample collection');
    let threw = false; try { DM.addRecord(exp, 'design_layer', { material: 'SnO2' }); } catch (_err) { threw = true; }
    assert(threw, true, 'nested design layer is not a root collection');
  };

  t['selectBlocks filters by family, file path and type'] = function () {
    const { exp, metrics } = sampleExperiment();
    assert(DM.selectBlocks(exp, { family: 'jv' }).map(function (b) { return b.id; }), [metrics.id], 'family=jv');
    assert(DM.selectBlocks(exp, { family: 'summary' }).length, 0, 'no summary blocks yet');
    assert(DM.selectBlocks(exp, { file: 'demo/JV Summary_Parameters FW.txt' }).map(function (b) { return b.id; }), [metrics.id], 'file path filter');
    assert(DM.selectBlocks(exp, { type: 'table', family: 'jv' }).length, 1, 'combined');
    assert(DM.selectBlocks(exp, { type: 'series' }).length, 0, 'type mismatch');
  };

  t['selectBlocks filters by typed domain reference'] = function () {
    const { exp, metrics, s1 } = sampleExperiment();
    assert(DM.selectBlocks(exp, { ref: { kind: 'sample', id: s1.id } }).map(function (b) { return b.id; }), [metrics.id], 'typed ref');
    assert(DM.selectBlocks(exp, { sample: s1.id }).length, 1, 'sample convenience query');
  };

  t['readBlock limits rows and returns header'] = function () {
    const { exp, metrics } = sampleExperiment();
    const read = DM.readBlock(exp, metrics.id, { rows: 1 });
    assert(read.header, ['voc', 'jsc'], 'header');
    assert(read.rows, [{ voc: 1.05, jsc: 24.1 }], 'limited rows');
    const missing = DM.readBlock(exp, 'b_missing');
    assert(missing.error.code, 'BLOCK_NOT_FOUND', 'error code');
  };

  t['getBlockSummary reports counts, columns and typed refs'] = function () {
    const { exp, metrics, s1 } = sampleExperiment();
    const s = DM.getBlockSummary(exp, metrics.id);
    assert(s.blockId, metrics.id, 'blockId');
    assert(s.rows, 1, 'rows');
    assert(s.columns, ['voc', 'jsc'], 'columns');
    assert(s.refs, [{ kind: 'sample', id: s1.id, label: 'REF A' }], 'typed refs');
  };

  t['applyPatch set + getEffectiveBlock returns patched value'] = function () {
    const { exp, metrics } = sampleExperiment();
    const res = DM.applyPatch(exp, {
      target: { kind: 'block', id: metrics.id }, operation: 'set', field: 'data.rows.0.voc',
      from: 1.05, to: 1.1, source: 'user', reason: 'reviewed', evidence: ['evidence/path']
    });
    assert(res.ok, true, 'accepted');
    assert(exp.patches.length, 1, 'one patch stored');
    assert(exp.patches[0].target, { kind: 'block', id: metrics.id }, 'typed patch target');
    assert(exp.patches[0].status, 'applied', 'patch status');
    const eff = DM.getEffectiveBlock(exp, metrics.id);
    assert(eff.data.rows[0].voc, 1.1, 'effective value');
    assert(exp.blocks[0].data.rows[0].voc, 1.05, 'source-parsed block untouched');
    assert(exp.sync.revision, 1, 'revision advanced by applyPatch');
  };

  t['applyPatch rejects unknown block, non-block target and invalid operation'] = function () {
    const { exp, s1 } = sampleExperiment();
    const missing = DM.applyPatch(exp, { target: { kind: 'block', id: 'b_nope' }, operation: 'set', field: 'data.rows.0.voc', to: 0, source: 'user' });
    assert(missing.error.code, 'BLOCK_NOT_FOUND', 'missing block');
    const wrongTarget = DM.applyPatch(exp, { target: { kind: 'sample', id: s1.id }, operation: 'set', field: 'name', to: 'X', source: 'user' });
    assert(wrongTarget.error.code, 'PATCH_TARGET_INVALID', 'feature record mutation boundary');
    const badOp = DM.applyPatch(exp, { target: { kind: 'block', id: 'b_x' }, operation: 'upsert', to: 0, source: 'user' });
    assert(badOp.error.code, 'PATCH_INVALID', 'bad operation');
  };

  t['applyPatch remove deletes a field in the effective block'] = function () {
    const { exp, metrics } = sampleExperiment();
    const res = DM.applyPatch(exp, { target: { kind: 'block', id: metrics.id }, operation: 'remove', field: 'data.rows.0.jsc', source: 'user', reason: 'bad column' });
    assert(res.ok, true, 'accepted');
    const eff = DM.getEffectiveBlock(exp, metrics.id);
    assert(eff.data.rows[0].jsc, undefined, 'removed in effective block');
    assert(exp.blocks[0].data.rows[0].jsc, 24.1, 'source-parsed block untouched');
  };

  t['applyPatch add appends a row to the effective block'] = function () {
    const { exp, metrics } = sampleExperiment();
    const res = DM.applyPatch(exp, { target: { kind: 'block', id: metrics.id }, operation: 'add', field: 'data.rows', to: { voc: 0.8, jsc: 22.0 }, source: 'ai', reason: 'recovered direction' });
    assert(res.ok, true, 'accepted');
    const eff = DM.getEffectiveBlock(exp, metrics.id);
    assert(eff.data.rows.length, 2, 'row appended');
    assert(eff.data.rows[1].voc, 0.8, 'appended value');
    assert(exp.blocks[0].data.rows.length, 1, 'source-parsed block untouched');
  };

  t['touch advances revision and stamps modifiedAt'] = function () {
    const { exp } = sampleExperiment();
    const before = exp.sync.revision;
    DM.touch(exp, 'design');
    assert(exp.sync.revision, before + 1, 'revision +1');
    assert(exp.sync.lastChange.scope, 'design', 'scope');
    assert(exp.meta.modifiedAt !== null && exp.meta.modifiedAt !== undefined, true, 'modifiedAt stamped');
  };

  t['toWorkingJSON exposes current domain records, typed refs and patches'] = function () {
    const { exp, metrics, s1 } = sampleExperiment();
    DM.applyPatch(exp, { target: { kind: 'block', id: metrics.id }, operation: 'set', field: 'data.rows.0.voc', to: 1.1, source: 'user' });
    const json = DM.toWorkingJSON(exp, { rows: 1 });
    assert(json.meta.name, exp.meta.name, 'canonical metadata');
    assert(json.files.length, 2, 'all files listed');
    assert(json.samples.length, 1, 'samples');
    assert(Object.prototype.hasOwnProperty.call(json, 'entities'), false, 'no parallel entities');
    assert(json.blocks[0].refs, [{ kind: 'sample', id: s1.id }], 'typed refs');
    assert(json.blocks[0].rows, [{ voc: 1.05, jsc: 24.1 }], 'bounded source rows');
    assert(json.blocks[0].columns, ['voc', 'jsc'], 'columns from schema');
    assert(json.patches.length, 1, 'patch provenance included');
  };

  t['normalize repairs missing arrays idempotently'] = function () {
    const exp = { id: 'exp_x' };
    DM.normalize(exp);
    assert(exp.files, [], 'files repaired');
    assert(exp.blocks, [], 'blocks repaired');
    assert(exp.experiments, [], 'experiments repaired');
    assert(exp.samples, [], 'samples repaired');
    assert(exp.runs, [], 'runs repaired');
    DM.normalize(exp);
    assert(exp.files, [], 'idempotent');
  };

  t['ExperimentData exposes one stable domain API over hierarchy collections'] = function () {
    const exp = DM.create({ sourceName: 'hierarchy.zip' });
    const e = DM.addRecord(exp, 'experiment', { id: 'x1', name: 'N3', sampleIds: ['s1'], sampleNames: ['N3_1_1A'], runIds: ['r1'], measurementIds: ['m1'] });
    DM.addRecord(exp, 'sample', { id: 's1', name: 'N3_1_1A', experimentId: e.id, experiment: 'N3', group: 'N3', measurementIds: ['m1'], runIds: ['r1'] });
    DM.addRecord(exp, 'run', { id: 'r1', label: '19.25.46', sampleId: 's1', sample: 'N3_1_1A', experimentId: e.id, experiment: 'N3', measurementIds: ['m1'] });
    DM.addRecord(exp, 'measurement', { id: 'm1', sampleId: 's1', sample: 'N3_1_1A', experimentId: e.id, experiment: 'N3', group: 'N3', runId: 'r1', bestEff: 20, rankingEligible: true });
    assert(exp instanceof LF.ExperimentData, true, 'class instance');
    assert(exp.experiment('N3').id, 'x1', 'experiment lookup');
    assert(exp.sample('N3_1_1A').id, 's1', 'sample lookup');
    assert(exp.measurementsForSample('N3_1_1A').map(function(x){return x.id;}), ['m1'], 'sample measurements');
    assert(exp.measurementsForExperiment('N3').map(function(x){return x.id;}), ['m1'], 'experiment measurements');
    assert(exp.tree()[0].samples[0].runs[0].measurements[0].id, 'm1', 'hierarchy tree');
    assert(typeof exp.addRecord, 'function', 'record factory API');
    assert(typeof exp.applyPatch, 'function', 'patch API');
    assert(typeof exp.reanalyze, 'function', 'pipeline API');
  };

  t['normalize hydrates a persisted plain object into ExperimentData in place'] = function () {
    const raw = {id:'exp_saved',meta:{name:'saved'},measurements:[]};
    const hydrated = DM.hydrate(raw);
    assert(hydrated === raw, true, 'same object identity');
    assert(hydrated instanceof LF.ExperimentData, true, 'prototype restored');
    assert(typeof hydrated.summary, 'function', 'domain methods restored');
  };

  return t;
};
