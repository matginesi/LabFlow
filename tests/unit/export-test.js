'use strict';
require('../../assets/js/core.js');
require('../../assets/js/experiment/data-model.js');
require('../../assets/js/experiment/canonical-store.js');
require('../../assets/js/export/export.js');

function assert(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error((label || 'assert') + ': expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(actual));
  }
}
function truthy(v, label) { if (!v) throw new Error((label || 'assert') + ': expected truthy, got ' + JSON.stringify(v)); }

async function sampleExperiment() {
  const zip = new JSZip();
  zip.file('demo/notes.md', 'hello labflow');
  zip.file('demo/run1/Stability (JV)_A.txt', 'A\n1\n2\n3\n');
  zip.file('demo/run1/Stability (JV)_RV.txt', 'A\n1\n2\n3\n');
  const arc = await zip.generateAsync({ type: 'arraybuffer' });
  const DM = window.LabFlow.DataModel;
  const exp = DM.create({ bytes: arc, sourceName: 'sample.zip', sourceModifiedAt: '2026-01-01T00:00:00Z' });
  DM.addFile(exp, { path: 'demo/notes.md', name: 'notes.md', extension: '.md', family: 'support', type: 'notes', size: 13 });
  DM.addFile(exp, { path: 'demo/run1/Stability (JV)_A.txt', name: 'Stability (JV)_A.txt', extension: '.txt', family: 'jv', type: 'jv', size: 8 });
  DM.addFile(exp, { path: 'demo/run1/Stability (JV)_RV.txt', name: 'Stability (JV)_RV.txt', extension: '.txt', family: 'jv', type: 'jv', size: 8 });
  exp.samples = [{ id: 'sample_ref', name: 'REF-01', rawName: 'REF_01', aliases: ['REF_01'], group: 'REF', isRef: true, measurementIds: ['m_ref'] }];
  exp.measurements = [{ id: 'm_ref', sample: 'REF-01', rawSample: 'REF_01', path: 'demo/run1/Stability (JV)_A.txt', group: 'REF', isRef: true, rankingEligible: true, qualityStatus: 'valid', bestEff: 20.1, fw: { eff: 20.1 }, rv: { eff: 19.8 }, curve: Array.from({ length: 250 }, (_, i) => [i, i * 2]) }];
  exp.patches = [{ op: 'set', block: 'b_x', path: 'metadata.area', value: 0.09, reason: 'user' }];
  exp.findings = [{ code: 'x', severity: 'info', title: 't' }];
  exp.nomad = exp.nomad || {};
  exp.nomad.validation = { status: 'ready' };
  exp.nomad.mappingPlan = { readiness: 'ready', mappings: [] };
  return { exp: exp, arc: arc };
}

module.exports = function (t, LF, env) {
  const EX = LF.Export;

  t['original returns pristine archive bytes untouched'] = async function () {
    const { exp, arc } = await sampleExperiment();
    const blob = EX.original(exp);
    truthy(blob instanceof Blob, 'returns Blob');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const src = new Uint8Array(arc);
    assert(bytes.length, src.length, 'byte length identical');
    for (let i = 0; i < src.length; i++) assert(bytes[i], src[i], 'byte[' + i + '] identical');
  };

  t['RAW snapshot is isolated from caller bytes and Working Copy mutations'] = async function () {
    const { exp, arc } = await sampleExperiment();
    const expected = new Uint8Array(await window.LabFlow.Export.original(exp).arrayBuffer());

    // Mutate the caller-owned upload buffer after import.
    const caller = new Uint8Array(arc);
    if (caller.length) caller[0] = (caller[0] + 1) % 255;

    // Mutate representative Working Copy structures. None may alter RAW.
    exp.meta.name = 'Changed working name';
    exp.samples[0].name = 'CHANGED-SAMPLE';
    exp.measurements[0].bestEff = 99.9;
    exp.design.status = 'confirmed';
    exp.patches.push({ op: 'set', path: 'demo', value: true });

    const after = new Uint8Array(await window.LabFlow.Export.original(exp).arrayBuffer());
    assert(after.length, expected.length, 'RAW snapshot length unchanged');
    for (let i = 0; i < expected.length; i++) assert(after[i], expected[i], 'RAW snapshot byte[' + i + '] unchanged');
  };

  t['package zip: manifest + experiment.json + raw/<path> pristine copies'] = async function () {
    const { exp } = await sampleExperiment();
    const blob = await EX.package(exp);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const names = Object.keys(zip.files);
    truthy(names.indexOf('manifest.json') >= 0, 'manifest.json present');
    truthy(names.indexOf('experiment.json') >= 0, 'experiment.json present');
    truthy(names.indexOf('canonical.json') >= 0, 'canonical.json present');
    truthy(names.indexOf('raw/demo/notes.md') >= 0, 'raw/notes.md present');
    truthy(names.indexOf('raw/demo/run1/Stability (JV)_A.txt') >= 0, 'raw/JV A present');

    const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
    assert(manifest.files.length, 3, 'manifest lists all files');
    assert(manifest.files[1], { path: 'demo/run1/Stability (JV)_A.txt', sha256: '', family: 'jv', type: 'jv' }, 'manifest file entry');

    const expJson = JSON.parse(await zip.file('experiment.json').async('string'));
    const expected = JSON.parse(JSON.stringify(LF.DataModel.toWorkingJSON(exp, { rows: null })));
    assert(expJson, expected, 'experiment.json equals toWorkingJSON({rows:null})');
    assert(expJson.patches, undefined, 'no patches embedded in package');

    const canonical = JSON.parse(await zip.file('canonical.json').async('string'));
    assert(canonical.format, 'labflow-canonical-v1', 'canonical format');
    assert(canonical.samples[0].aliases.indexOf('REF_01') >= 0, true, 'canonical alias retained');
    assert(canonical.measurements[0].curve, undefined, 'RAW curve array is not duplicated in canonical snapshot');
    truthy(canonical.relations.some(r => r.type === 'sample_measurement' && r.from === 'sample_ref' && r.to === 'm_ref'), 'canonical sample measurement relation');
    truthy(canonical.evidence.some(e => e.type === 'file'), 'canonical evidence retained');

    const md = new TextDecoder().decode(await zip.file('raw/demo/notes.md').async('arraybuffer'));
    assert(md, 'hello labflow', 'raw bytes copied verbatim');
  };

  t['modified zip: RAW + experiment.json(patches+review) + .labflow copies + patches.json'] = async function () {
    const { exp, arc } = await sampleExperiment();
    const blob = await EX.modified(exp);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const names = Object.keys(zip.files);

    truthy(names.indexOf('patches.json') >= 0, 'patches.json present');
    truthy(names.indexOf('raw/source.zip') >= 0, 'pristine RAW source.zip present');
    truthy(names.indexOf('raw/demo/notes.md.labflow') >= 0, '.labflow copy present');
    truthy(names.indexOf('raw/demo/notes.md') < 0, 'plain raw copy absent in modified');

    const patches = JSON.parse(await zip.file('patches.json').async('string'));
    assert(patches.patches, exp.patches, 'patches round-trip');

    const expJson = JSON.parse(await zip.file('experiment.json').async('string'));
    assert(expJson.patches, exp.patches, 'experiment.json(patches)');
    assert(expJson.review.derived.findings, exp.findings, 'review.derived.findings kept');
    assert(expJson.review.nomad, { validation: { status: 'ready' }, mappingPlan: { readiness: 'ready', mappings: [] } }, 'deterministic NOMAD snapshot kept');

    const src = new Uint8Array(arc);
    const roundtrip = new Uint8Array(await zip.file('raw/source.zip').async('arraybuffer'));
    assert(roundtrip.length, src.length, 'source.zip byte length');
    for (let i = 0; i < src.length; i++) assert(roundtrip[i], src[i], 'source.zip byte[' + i + ']');

    const md = new TextDecoder().decode(await zip.file('raw/demo/notes.md.labflow').async('arraybuffer'));
    assert(md, 'hello labflow', '.labflow raw bytes copied verbatim');
  };

  t['original throws when RAW archive is unavailable'] = function () {
    const exp = window.LabFlow.DataModel.create({ bytes: new Uint8Array([1]).buffer, sourceName: 'x.zip' });
    exp.raw.sourceArchive = new ArrayBuffer(0);
    let threw = false;
    try { EX.original(exp); } catch (_err) { threw = true; }
    truthy(threw, 'throws when archive empty/unavailable');
  };

  t['fileName sanitizes experiment name'] = function () {
    const exp = { meta: { name: 'My Experiment/Foo.zip' } };
    assert(EX.fileName(exp, 'package'), LF.Core.safeName('My Experiment/Foo.zip') + '_package.zip', 'file name');
  };
};
