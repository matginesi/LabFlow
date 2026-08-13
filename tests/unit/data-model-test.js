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
    const s1 = DM.addEntity(exp, { kind: 'sample', name: 'REF A', isRef: true, group: 'REF' });
    const metrics = DM.addBlock(exp, {
      type: 'table', family: 'jv', name: 'A metrics', direction: 'fw',
      file: { id: fw.id, path: fw.path, locator: { header: 'File', row: 0 } },
      entities: [s1.id],
      schema: { columns: [{ name: 'voc', unit: 'V' }, { name: 'jsc', unit: 'mA/cm²' }] },
      data: { header: ['voc', 'jsc'], rows: [{ voc: 1.05, jsc: 24.1 }] },
      metadata: {}
    });
    return { exp: exp, fw: fw, s1: s1, metrics: metrics };
  }

  t['create produces the canonical shape'] = function () {
    const exp = DM.create({ bytes: new Uint8Array([9]).buffer, sourceName: 'x.zip' });
    assert(exp.files, [], 'files');
    assert(exp.entities, [], 'entities');
    assert(exp.blocks, [], 'blocks');
    assert(exp.patches, [], 'patches');
    assert(exp.raw.sourceName, 'x.zip', 'raw.sourceName');
    assert(exp.raw.sourceArchive.byteLength, 1, 'raw bytes immutably retained');
    assert(exp.meta.name, 'x', 'name from zip basename');
  };

  t['selectBlocks filters by family, file path and type'] = function () {
    const { exp, metrics } = sampleExperiment();
    assert(DM.selectBlocks(exp, { family: 'jv' }).map(function (b) { return b.id; }), [metrics.id], 'family=jv');
    assert(DM.selectBlocks(exp, { family: 'summary' }).length, 0, 'no summary blocks yet');
    assert(DM.selectBlocks(exp, { file: 'demo/JV Summary_Parameters FW.txt' }).map(function (b) { return b.id; }), [metrics.id], 'file path filter');
    assert(DM.selectBlocks(exp, { type: 'table', family: 'jv' }).length, 1, 'combined');
    assert(DM.selectBlocks(exp, { type: 'series' }).length, 0, 'type mismatch');
  };

  t['readBlock limits rows and returns header'] = function () {
    const { exp, metrics } = sampleExperiment();
    const read = DM.readBlock(exp, metrics.id, { rows: 1 });
    assert(read.header, ['voc', 'jsc'], 'header');
    assert(read.rows, [{ voc: 1.05, jsc: 24.1 }], 'limited rows');
    const missing = DM.readBlock(exp, 'b_missing');
    assert(missing.error.code, 'BLOCK_NOT_FOUND', 'error code');
  };

  t['getBlockSummary reports counts, columns and entities'] = function () {
    const { exp, metrics, s1 } = sampleExperiment();
    const s = DM.getBlockSummary(exp, metrics.id);
    assert(s.blockId, metrics.id, 'blockId');
    assert(s.rows, 1, 'rows');
    assert(s.columns, ['voc', 'jsc'], 'columns');
    assert(s.entities, ['REF A'], 'entity names');
  };

  t['applyPatch set + getEffectiveBlock returns patched value'] = function () {
    const { exp, metrics } = sampleExperiment();
    const res = DM.applyPatch(exp, {
      blockId: metrics.id, operation: 'set', field: 'data.rows.0.voc',
      from: 1.05, to: 1.1, source: 'user', reason: 'reviewed', evidence: ['evidence/path']
    });
    assert(res.ok, true, 'accepted');
    assert(exp.patches.length, 1, 'one patch stored');
    assert(exp.patches[0].status, 'applied', 'patch status');
    const eff = DM.getEffectiveBlock(exp, metrics.id);
    assert(eff.data.rows[0].voc, 1.1, 'effective value');
    assert(exp.blocks[0].data.rows[0].voc, 1.05, 'RAW block untouched');
    assert(exp.sync.revision, 1, 'revision advanced by applyPatch');
  };

  t['applyPatch rejects unknown block and invalid operation'] = function () {
    const { exp } = sampleExperiment();
    const missing = DM.applyPatch(exp, { blockId: 'b_nope', operation: 'set', field: 'data.rows.0.voc', to: 0, source: 'user' });
    assert(missing.error.code, 'BLOCK_NOT_FOUND', 'missing block');
    const badOp = DM.applyPatch(exp, { blockId: 'b_x', operation: 'upsert', to: 0, source: 'user' });
    assert(badOp.error.code, 'PATCH_INVALID', 'bad operation');
  };

  t['applyPatch remove deletes a field in the effective block'] = function () {
    const { exp, metrics } = sampleExperiment();
    const res = DM.applyPatch(exp, { blockId: metrics.id, operation: 'remove', field: 'data.rows.0.jsc', source: 'user', reason: 'bad column' });
    assert(res.ok, true, 'accepted');
    const eff = DM.getEffectiveBlock(exp, metrics.id);
    assert(eff.data.rows[0].jsc, undefined, 'removed in effective block');
    assert(exp.blocks[0].data.rows[0].jsc, 24.1, 'RAW block untouched');
  };

  t['applyPatch add appends a row to the effective block'] = function () {
    const { exp, metrics } = sampleExperiment();
    const res = DM.applyPatch(exp, { blockId: metrics.id, operation: 'add', field: 'data.rows', to: { voc: 0.8, jsc: 22.0 }, source: 'ai', reason: 'recovered direction' });
    assert(res.ok, true, 'accepted');
    const eff = DM.getEffectiveBlock(exp, metrics.id);
    assert(eff.data.rows.length, 2, 'row appended');
    assert(eff.data.rows[1].voc, 0.8, 'appended value');
    assert(exp.blocks[0].data.rows.length, 1, 'RAW block untouched');
  };

  t['touch advances revision and stamps modifiedAt'] = function () {
    const { exp } = sampleExperiment();
    const before = exp.sync.revision;
    DM.touch(exp, 'design');
    assert(exp.sync.revision, before + 1, 'revision +1');
    assert(exp.sync.lastChange.scope, 'design', 'scope');
    assert(exp.meta.modifiedAt !== null && exp.meta.modifiedAt !== undefined, true, 'modifiedAt stamped');
  };

  t['toWorkingJSON exposes bounded rows per block'] = function () {
    const { exp, metrics } = sampleExperiment();
    const json = DM.toWorkingJSON(exp, { rows: 1 });
    assert(json.meta.name, exp.meta.name, 'canonical metadata');
    assert(json.files.length, 2, 'all files listed');
    assert(json.entities.length, 1, 'entities');
    assert(json.blocks[0].rows, [{ voc: 1.05, jsc: 24.1 }], 'bounded rows');
    assert(json.blocks[0].columns, ['voc', 'jsc'], 'columns from schema');
    assert(json.patches, undefined, 'patches not serialised into working json');
  };

  t['normalize repairs missing arrays idempotently'] = function () {
    const exp = { id: 'exp_x' };
    DM.normalize(exp);
    assert(exp.files, [], 'files repaired');
    assert(exp.blocks, [], 'blocks repaired');
    DM.normalize(exp);
    assert(exp.files, [], 'idempotent');
  };

  return t;
};
