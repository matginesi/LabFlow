'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/ai/prompt-bundle.js');
require('../../assets/js/experiment/data-model.js');
require('../../assets/js/data/parser.js');
require('../../assets/js/data/importer.js');
const fs = require('fs');
const path = require('path');

function assert(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error((label || 'assert') + ': expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(actual));
  }
}
function truthy(v, label) { if (!v) throw new Error((label || 'assert') + ': expected truthy, got ' + JSON.stringify(v)); }

module.exports = function (t, LF, env) {
  const P = LF.Parser;
  const DM = LF.DataModel;
  const Im = LF.Importer;

  function loadFixture(name) {
    const buf = fs.readFileSync(path.join(env.root, 'TEST_DATA', name));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }

  t['parseDataset of clean fixture produces the canonical experiment'] = async function () {
    const exp = await Im.parseDataset(loadFixture('01_PRECISO_PERFETTO_COMPLETO.zip'), '01_PRECISO_PERFETTO_COMPLETO.zip');
    assert(exp.id && /^exp_/.test(exp.id), true, 'exp id');
    truthy(exp.meta.name, 'meta.name');
    assert(exp.raw.sourceName, '01_PRECISO_PERFETTO_COMPLETO.zip', 'raw.sourceName');
    assert(exp.raw.sourceArchive instanceof ArrayBuffer, true, 'raw bytes retained');
    assert(typeof exp.raw.sha256, 'string', 'sha256 set on raw');
    assert(exp.raw.sha256.length, 64, 'sha256 64 hex chars');
    assert(exp.files.length > 0, true, 'files present');
    assert(exp.entities.length, 6, 'entities (samples)');
    assert(exp.measurements.length, 6, 'measurements');
    assert(exp.auxiliaryEvidence.length, 12, 'auxiliary evidence (6 param + 6 tracking)');
    assert(exp.findings.length, 0, 'no deterministic findings on clean fixture');
    assert(exp.blocks.length > 0, true, 'canonical blocks present');
  };

  t['clean fixture blocks: file identity, headers, entities, directions'] = async function () {
    const exp = await Im.parseDataset(loadFixture('01_PRECISO_PERFETTO_COMPLETO.zip'), 'z.zip');
    const metricBlocks = exp.blocks.filter(function (b) { return b.family === 'jv' && b.type === 'table'; });
    const curveBlocks = exp.blocks.filter(function (b) { return b.family === 'jv' && b.type === 'series'; });
    const summaryBlocks = exp.blocks.filter(function (b) { return b.family === 'summary'; });
    const auxBlocks = exp.blocks.filter(function (b) { return b.family === 'parameters' || b.family === 'tracking'; });
    assert(metricBlocks.length, 12, '12 dimension metric blocks (6 measurements x FW/RV)');
    assert(curveBlocks.length, 12, '12 curve blocks (6 measurements x FW/RV)');
    assert(summaryBlocks.length, 2, '2 summary table blocks');
    truthy(auxBlocks.length > 0, 'auxiliary blocks present');
    metricBlocks.forEach(function (b) {
      assert(Array.isArray(b.entities) && b.entities.length, 1, 'entity linked');
      assert(b.file.path && exp.files.some(function (f) { return f.path === b.file.path; }), true, 'block file resolves to a real archive path');
      assert(Array.isArray(b.data.rows) && b.data.rows.length, 1, 'one metric row');
      assert(Array.isArray(b.data.header) && b.data.header.indexOf('voc') >= 0, true, 'metric header has voc');
      assert(b.data.rows[0].eff != null, true, 'metric row carries eff');
      assert(b.direction === 'fw' || b.direction === 'rv', true, 'canonical direction');
    });
    curveBlocks.forEach(function (b) {
      assert(Array.isArray(b.data.rows) && b.data.rows.length > 0, true, 'curve has data rows');
      truthy(b.data.rows[0].v != null && b.data.rows[0].j != null, 'curve row v/j');
    });
  };

  t['clean fixture: every measurement is a distinct entity with summary + jv provenance'] = async function () {
    const exp = await Im.parseDataset(loadFixture('01_PRECISO_PERFETTO_COMPLETO.zip'), 'z.zip');
    assert(exp.samples.length, 6, '6 samples');
    const sampleNames = new Set(exp.samples.map(function (s) { return s.name; }));
    exp.measurements.forEach(function (m) {
      truthy(sampleNames.has(m.sample), 'measurement sample exists in samples');
      assert(!!(m.fw && m.rv), true, 'fw and rv present');
      assert(m.fw.eff != null && m.rv.eff != null, true, 'fw/rv carry eff');
      truthy(m.path, 'measurement has archive path');
      truthy(exp.files.some(function (f) { return f.path === m.path && f.type === 'jv'; }), 'measurement path is a parsed JV file');
    });
  };

  t['duplicate basenames stay distinct measurements keyed by path'] = async function () {
    const zip = new JSZip();
    zip.file('exp/sub1/Stability (JV)_S.txt', 'This JV file intentionally has no parseable metric block.');
    zip.file('exp/sub2/Stability (JV)_S.txt', 'This JV file intentionally has no parseable metric block.');
    const ab = await zip.generateAsync({ type: 'arraybuffer' });
    const exp = await Im.parseDataset(ab, 'dup.zip');
    const shared = exp.files.filter(function (f) { return f.type === 'jv'; });
    assert(shared.length, 2, 'two JV files');
    assert(new Set(shared.map(function (f) { return f.name; })).size, 1, 'same basename');
    assert(new Set(shared.map(function (f) { return f.path; })).size, 2, 'distinct paths');
    assert(new Set(exp.measurements.map(function (m) { return m.path; })).size, exp.measurements.length, 'measurements keyed by distinct paths');
    assert(exp.findings.some(function (f) { return f.type === 'duplicate-filename' || f.type === 'parse'; }), true, 'duplicate/parse finding raised');
  };

  t['identity uses archive path never basename: two same-named summary rows stay orphans'] = async function () {
    const zip = new JSZip();
    zip.file('exp/JV Summary_Parameters FW.txt', 'File\tVoc\tJsc\tVMPP\tJMPP\tPMPP\tRs\tRsh\tFF\tEfficiency\nS_shared\t1.0\t1.0\t1.0\t1.0\t1.0\t1.0\t1.0\t1.0\t1.0\n');
    zip.file('exp/sub1/Stability (JV)_S_shared.txt', 'x');
    zip.file('exp/sub2/Stability (JV)_S_shared.txt', 'y');
    const ab = await zip.generateAsync({ type: 'arraybuffer' });
    const exp = await Im.parseDataset(ab, 'name.zip');
    const summary = exp.blocks.filter(function (b) { return b.family === 'summary'; });
    assert(summary.length, 1, '1 summary block (single FW summary)');
    assert(summary[0].data.rows.length, 1, 'summary keeps the orphan row');
    assert(exp.measurements.some(function (m) { return m.summaryRow && m.summaryRow === 'S_shared'; }), false, 'no measurement merged onto a duplicate basename');
  };

  t['rejects missing JSZip cleanly'] = async function () {
    const prev = window.JSZip;
    window.JSZip = null;
    let thrown = false;
    try {
      await Im.parseDataset(new ArrayBuffer(8), 'x.zip');
    } catch (err) {
      thrown = /JSZip/.test(String(err.message));
    }
    window.JSZip = prev;
    assert(thrown, true, 'throws when JSZip unavailable');
  };

  t['scientific collections exist once on the canonical root'] = async function () {
    const exp = await Im.parseDataset(loadFixture('01_PRECISO_PERFETTO_COMPLETO.zip'), 'z.zip');
    assert(Array.isArray(exp.manifest), true, 'manifest');
    assert(Array.isArray(exp.measurements), true, 'measurements');
    assert(Array.isArray(exp.samples), true, 'samples');
    assert(Array.isArray(exp.findings), true, 'findings');
    assert(Array.isArray(exp.rawFormatEvidence), true, 'rawFormatEvidence');
    assert(Array.isArray(exp.auxiliaryEvidence), true, 'auxiliaryEvidence');
    assert(exp.derived && Object.keys(exp.derived).sort(), ['chat', 'operations'], 'derived is runtime-only');
  };

  t['importer and data-model agree: block ids resolve via readBlock'] = async function () {
    const exp = await Im.parseDataset(loadFixture('01_PRECISO_PERFETTO_COMPLETO.zip'), 'z.zip');
    const metric = exp.blocks.find(function (b) { return b.family === 'jv' && b.type === 'table'; });
    truthy(metric, 'has a metric block');
    const read = DM.readBlock(exp, metric.id);
    assert(read.block.id, metric.id, 'readBlock resolves');
    assert(read.rows[0].eff, metric.data.rows[0].eff, 'effective rows match parsed values');
    assert(DM.getBlockSummary(exp, metric.id).rows, 1, 'getBlockSummary rows');
  };
};
