(function () {
  'use strict';

  /*
   * ExperimentData is LabFlow's single aggregate root.
   *
   * DomainSchema owns record shapes/defaults/persistence metadata.
   * This module owns aggregate mechanics and the stable query/mutation API.
   * Importers and feature modules must not create parallel representations of
   * samples, runs or measurements and must not redefine record defaults.
   */
  const LF = window.LabFlow = window.LabFlow || {};
  if (!LF.Core) throw new Error('LabFlow.Core must be loaded before data-model.js.');
  const C = LF.Core;
  const Schema = LF.DomainSchema;
  if (!Schema) throw new Error('LabFlow.DomainSchema must be loaded before data-model.js.');
  const uid = C.uid;
  const OPERATIONS = ['set', 'remove', 'add'];

  function nowIso() { return new Date().toISOString(); }
  function cleanRef(value) { return String(value == null ? '' : value).trim(); }
  function sameRef(value, ref) { return cleanRef(value).toLowerCase() === cleanRef(ref).toLowerCase(); }
  function clone(value) { if (value === undefined) return undefined; return JSON.parse(JSON.stringify(value)); }
  function coerce(raw) { return raw && typeof raw === 'object' && !Array.isArray(raw) && 'value' in raw ? coerce(raw.value) : raw; }
  function errorOut(code, message) { return { ok: false, error: { code: code, message: message } }; }

  function normalize(exp) {
    if (!exp || typeof exp !== 'object') return exp;
    Schema.normalizeRoot(exp);
    if (!(exp instanceof ExperimentData)) {
      try { Object.setPrototypeOf(exp, ExperimentData.prototype); } catch (_err) {}
    }
    return exp;
  }

  function matchRecord(record, ref, fields) {
    if (!record || ref == null || ref === '') return false;
    if (typeof ref === 'object' && ref.id) ref = ref.id;
    return (fields || ['id', 'name']).some(function (key) { return sameRef(record[key], ref); });
  }
  function recordOf(exp, collection, ref, fields) {
    return (exp[collection] || []).find(function (x) { return matchRecord(x, ref, fields); }) || null;
  }
  function getExperimentRecord(exp, ref) { return recordOf(exp, 'experiments', ref, ['id', 'name']); }
  function getSampleRecord(exp, ref) { return recordOf(exp, 'samples', ref, ['id', 'name', 'rawName']); }
  function getRunRecord(exp, ref) { return recordOf(exp, 'runs', ref, ['id', 'path', 'label']); }
  function getMeasurementRecord(exp, ref) { return recordOf(exp, 'measurements', ref, ['id', 'file', 'path']); }

  function filterRecords(records, query, aliases) {
    query = query || {};
    if (typeof query === 'string') query = { search: query };
    const search = cleanRef(query.search).toLowerCase();
    return (records || []).filter(function (record) {
      if (query.id != null && !sameRef(record.id, query.id)) return false;
      if (query.name != null && !sameRef(record.name, query.name)) return false;
      if (query.experiment != null && ![record.experimentId, record.experiment, record.group].some(function (v) { return sameRef(v, query.experiment); })) return false;
      if (query.sample != null && ![record.sampleId, record.sample, record.name].some(function (v) { return sameRef(v, query.sample); })) return false;
      if (query.run != null && ![record.runId, record.id, record.path, record.label].some(function (v) { return sameRef(v, query.run); })) return false;
      if (query.group != null && !sameRef(record.group, query.group)) return false;
      if (query.quality != null && !sameRef(record.qualityStatus, query.quality)) return false;
      if (query.reference != null && !!record.isRef !== !!query.reference) return false;
      if (query.eligible != null && !!record.rankingEligible !== !!query.eligible) return false;
      if (search) {
        const fields = (aliases || ['id', 'name']).map(function (key) { return cleanRef(record[key]); });
        if (!fields.join(' ').toLowerCase().includes(search)) return false;
      }
      return true;
    });
  }

  function blockOf(exp, ref) { return recordOf(exp, 'blocks', ref, ['id', 'name']); }
  function getBlock(exp, ref) { return blockOf(normalize(exp), ref); }
  function getFile(exp, ref) { return recordOf(normalize(exp), 'files', ref, ['id', 'path', 'name', 'canonicalPath', 'canonicalName']); }

  function refMatches(block, queryRef) {
    if (!queryRef) return true;
    if (typeof queryRef === 'string') return (block.refs || []).some(function (r) { return sameRef(r.id, queryRef); });
    return (block.refs || []).some(function (r) {
      return (!queryRef.kind || sameRef(r.kind, queryRef.kind)) && (!queryRef.id || sameRef(r.id, queryRef.id));
    });
  }

  function selectBlocks(exp, q) {
    q = q || {};
    return (normalize(exp).blocks || []).filter(function (b) {
      if (q.family && b.family !== q.family) return false;
      if (q.type && b.type !== q.type) return false;
      if (q.file) { const f = b.file || {}; if (f.path !== q.file && f.id !== q.file) return false; }
      if ((q.ref || q.sample) && !refMatches(b, q.ref || { kind: 'sample', id: q.sample })) return false;
      if (q.nameSubstr && String(b.name || '').indexOf(q.nameSubstr) < 0) return false;
      if (q.direction && b.direction !== q.direction) return false;
      return true;
    });
  }

  function readBlock(exp, id, opts) {
    const block = blockOf(normalize(exp), id);
    if (!block) return { error: { code: 'BLOCK_NOT_FOUND', message: 'Block not found: ' + id } };
    opts = opts || {};
    const rows = block.data.rows || [];
    const limited = Number.isInteger(opts.rows) && opts.rows >= 0 ? rows.slice(0, opts.rows) : rows.slice(0);
    return { block: block, header: (block.data.header || []).slice(), rows: limited };
  }

  function describeRef(exp, ref) {
    if (!ref || !ref.kind || !ref.id) return '';
    const collection = { sample: 'samples', experiment: 'experiments', run: 'runs', measurement: 'measurements', file: 'files', finding: 'findings' }[ref.kind];
    if (!collection) return ref.kind + ':' + ref.id;
    const item = recordOf(exp, collection, ref.id, ['id', 'name', 'path', 'file', 'title']);
    return item ? String(item.name || item.path || item.file || item.title || item.id) : ref.kind + ':' + ref.id;
  }

  function getBlockSummary(exp, id) {
    exp = normalize(exp);
    const block = blockOf(exp, id);
    if (!block) return { error: { code: 'BLOCK_NOT_FOUND', message: 'Block not found: ' + id } };
    const cols = block.schema.columns || [], rows = block.data.rows || [];
    return {
      blockId: block.id, type: block.type, family: block.family || null, name: block.name || '', direction: block.direction || null,
      file: block.file && block.file.path || '', rows: rows.length,
      columns: cols.map(function (c) { return c.name; }),
      refs: (block.refs || []).map(function (r) { return { kind: r.kind, id: r.id, label: describeRef(exp, r) }; })
    };
  }

  function patchTargetsBlock(p, id) { return p && p.target && p.target.kind === 'block' && p.target.id === id && p.status === 'applied'; }
  function getEffectiveBlock(exp, id) {
    exp = normalize(exp);
    const block = blockOf(exp, id);
    if (!block) return null;
    const copy = clone(block);
    (exp.patches || []).forEach(function (p) {
      if (!patchTargetsBlock(p, id)) return;
      if (p.operation === 'set' && typeof p.field === 'string') {
        const seg = p.field.split('.'); let node = copy;
        for (let i = 0; i < seg.length - 1 && node; i++) node = node != null && typeof node === 'object' ? node[seg[i]] : undefined;
        if (node != null && typeof node === 'object') node[seg[seg.length - 1]] = clone(p.to);
      } else if (p.operation === 'remove' && typeof p.field === 'string') {
        const seg = p.field.split('.'); let node = copy;
        for (let i = 0; i < seg.length - 1 && node; i++) node = node != null && typeof node === 'object' ? node[seg[i]] : undefined;
        if (node != null && typeof node === 'object') delete node[seg[seg.length - 1]];
      } else if (p.operation === 'add') {
        const seg = (p.field || 'data.rows').split('.'); let node = copy;
        for (let i = 0; i < seg.length - 1 && node; i++) node = node != null && typeof node === 'object' ? node[seg[i]] : undefined;
        if (node != null && Array.isArray(node[seg[seg.length - 1]])) node[seg[seg.length - 1]].push(clone(p.to));
      }
    });
    return copy;
  }


  function addRecord(exp, kind, seed) {
    exp = normalize(exp);
    const meta = Schema.rootForRecordKind ? Schema.rootForRecordKind(kind) : Schema.rootFields().find(function (x) { return x.recordKind === kind; });
    if (!meta || !meta.key || !Array.isArray(exp[meta.key])) throw new Error('Record kind is not attached to an ExperimentData root collection: ' + kind);
    const record = Schema.create(kind, seed || {});
    exp[meta.key].push(record);
    return record;
  }

  function addPatch(exp, seed, opts) {
    exp = normalize(exp); opts = opts || {};
    const rec = Schema.create('patch', Object.assign({}, seed || {}));
    exp.patches.push(rec);
    if (opts.touch !== false) touch(exp, opts.scope || 'dataset');
    return rec;
  }

  function applyPatch(exp, patch) {
    exp = normalize(exp);
    if (!patch || OPERATIONS.indexOf(patch.operation) < 0) return errorOut('PATCH_INVALID', 'Invalid patch operation: ' + (patch && patch.operation));
    const target = patch.target && typeof patch.target === 'object' ? patch.target : { kind: 'block', id: patch.blockId || '' };
    if (target.kind !== 'block') return errorOut('PATCH_TARGET_INVALID', 'DataModel.applyPatch edits parsed blocks only; use a feature service for scientific record mutations.');
    const block = blockOf(exp, target.id);
    if (!block) return errorOut('BLOCK_NOT_FOUND', 'No block ' + target.id);
    const operation = patch.operation, field = patch.field || (operation === 'add' ? 'data.rows' : '');
    if (operation !== 'add' && !field) return errorOut('PATCH_INVALID', 'field path is required');
    const rec = addPatch(exp, {
      patchType: patch.patchType || 'block_value', target: { kind: 'block', id: target.id }, operation: operation, field: field,
      from: coerce(patch.from), to: coerce(patch.to), source: patch.source || 'system', reason: patch.reason || '',
      evidence: Array.isArray(patch.evidence) ? patch.evidence.slice() : [], findingId: patch.findingId || '', confidence: patch.confidence,
      status: 'applied', reviewStatus: patch.reviewStatus || 'accepted', reviewedBy: patch.reviewedBy || '', createdAt: nowIso(), appliedAt: nowIso()
    }, { scope: 'dataset' });
    return { ok: true, patch: rec };
  }

  function touch(exp, scope) {
    exp = normalize(exp);
    exp.sync.revision = Number(exp.sync.revision || 0) + 1;
    exp.sync.lastChange = { scope: scope || 'metadata', at: nowIso() };
    exp.meta.modifiedAt = nowIso();
  }

  class ExperimentData {
    constructor(seed) { Object.assign(this, Schema.createRoot(seed || {})); normalize(this); }
    normalize() { normalize(this); return this; }
    experiment(ref) { return getExperimentRecord(this, ref); }
    sample(ref) { return getSampleRecord(this, ref); }
    run(ref) { return getRunRecord(this, ref); }
    measurement(ref) { return getMeasurementRecord(this, ref); }
    file(ref) { return getFile(this, ref); }
    block(ref) { return getBlock(this, ref); }
    finding(ref) { return recordOf(this, 'findings', ref, ['id', 'title', 'target']); }
    addRecord(kind, seed) { return addRecord(this, kind, seed); }
    get(ref) { return this.experiment(ref) || this.sample(ref) || this.run(ref) || this.measurement(ref) || this.file(ref) || this.block(ref) || this.finding(ref) || null; }
    selectExperiments(q) { return filterRecords(this.experiments, q, ['id', 'name']); }
    selectSamples(q) { return filterRecords(this.samples, q, ['id', 'name', 'rawName', 'experiment', 'group', 'position', 'cell']); }
    selectRuns(q) { return filterRecords(this.runs, q, ['id', 'path', 'label', 'sample', 'experiment']); }
    selectMeasurements(q) { return filterRecords(this.measurements, q, ['id', 'file', 'path', 'sample', 'rawSample', 'experiment', 'group', 'sequence']); }
    selectBlocks(q) { return selectBlocks(this, q); }
    samplesForExperiment(ref) { const e = this.experiment(ref), id = e ? e.id : ref, name = e ? e.name : ref; return this.samples.filter(function (s) { return sameRef(s.experimentId, id) || sameRef(s.experiment, name) || sameRef(s.group, name); }); }
    runsForSample(ref) { const s = this.sample(ref), id = s ? s.id : ref, name = s ? s.name : ref; return this.runs.filter(function (r) { return sameRef(r.sampleId, id) || sameRef(r.sample, name); }); }
    measurementsForSample(ref) { const s = this.sample(ref), id = s ? s.id : ref, name = s ? s.name : ref; return this.measurements.filter(function (m) { return sameRef(m.sampleId, id) || sameRef(m.sample, name); }); }
    measurementsForExperiment(ref) { const e = this.experiment(ref), id = e ? e.id : ref, name = e ? e.name : ref; return this.measurements.filter(function (m) { return sameRef(m.experimentId, id) || sameRef(m.experiment, name) || sameRef(m.group, name); }); }
    bestMeasurementForSample(ref) { return this.measurementsForSample(ref).filter(function (m) { return m.rankingEligible !== false && Number.isFinite(Number(m.bestEff)); }).sort(function (a, b) { return Number(b.bestEff) - Number(a.bestEff); })[0] || null; }
    effectiveBlock(ref) { return getEffectiveBlock(this, ref); }
    applyPatch(patch) { return applyPatch(this, patch); }
    addPatch(patch, opts) { return addPatch(this, patch, opts); }
    validate() { if (!LF.DataContracts) throw new Error('LabFlow.DataContracts is not loaded.'); return LF.DataContracts.validate(this); }
    summary() { const a = this.analysis && this.analysis.summary || {}; return { id: this.id || '', name: this.meta && this.meta.name || '', source: this.meta && this.meta.sourceName || '', revision: Number(this.sync && this.sync.revision || 0), files: this.files.length, experiments: this.experiments.length, samples: this.samples.length, runs: this.runs.length, measurements: this.measurements.length, eligible: Number(a.eligibleCount || 0), findings: this.findings.filter(function (f) { return f.status !== 'resolved'; }).length, bestExperiment: a.bestExperiment || '', bestSample: a.bestSample || '', bestEfficiency: a.bestEfficiency == null ? null : a.bestEfficiency }; }
    tree() { const self = this; return this.experiments.map(function (e) { return { id: e.id, experiment: e.name, reference: !!e.isRef, samples: self.samplesForExperiment(e.id).map(function (s) { return { id: s.id, sample: s.name, position: s.position || '', cell: s.cell || '', runs: self.runsForSample(s.id).map(function (r) { return { id: r.id, run: r.label || r.path || '', measurements: self.selectMeasurements({ run: r.id }).map(function (m) { return { id: m.id, sequence: m.sequence, file: m.file, bestEff: m.bestEff, quality: m.qualityStatus }; }) }; }) }; }) }; }); }
    inspect(ref) { if (ref == null || ref === '') return this.summary(); const item = this.get(ref); if (!item) return null; if (this.experiments.includes(item)) return { type: 'experiment', value: item, samples: this.samplesForExperiment(item.id), measurements: this.measurementsForExperiment(item.id) }; if (this.samples.includes(item)) return { type: 'sample', value: item, runs: this.runsForSample(item.id), measurements: this.measurementsForSample(item.id), best: this.bestMeasurementForSample(item.id) }; if (this.runs.includes(item)) return { type: 'run', value: item, measurements: this.selectMeasurements({ run: item.id }) }; return { type: item.kind || item.type || 'record', value: item }; }
    reanalyze(reason) { if (!LF.DataPipeline || !LF.DataPipeline.refresh) throw new Error('LabFlow.DataPipeline is not loaded.'); LF.DataPipeline.refresh(this, { reason: reason || 'ExperimentData.reanalyze' }); return this.summary(); }
    setMismatchFactor(value) { const factor = Number(value); if (!Number.isFinite(factor) || factor <= 0) throw new Error('Mismatch factor must be a finite number > 0.'); this.analysisSettings.mismatchFactor = factor; touch(this, 'analysis'); return this.reanalyze(); }
    toWorkingJSON(opts) { return toWorkingJSON(this, opts); }
  }

  function hydrate(exp) { if (!exp || typeof exp !== 'object') return new ExperimentData(); return normalize(exp); }

  /**
   * Restore a persisted LabFlow snapshot. Unlike hydrate(), this is a trust
   * boundary: external/persisted data must satisfy the current snapshot shape
   * before defaults are applied. LabFlow intentionally has no legacy migration
   * chain; incompatible snapshots fail with an actionable contract error.
   */
  function restore(snapshot) {
    if (!LF.DataContracts || !LF.DataContracts.assertSnapshot) {
      throw new Error('LabFlow.DataContracts must be loaded before restoring a persisted ExperimentData snapshot.');
    }
    LF.DataContracts.assertSnapshot(snapshot);
    return hydrate(snapshot);
  }

  function serialize(exp, options) { return Schema.snapshot(hydrate(exp), options || {}); }
  function create(opts) {
    opts = opts || {}; const exp = new ExperimentData();
    exp.meta.name = String(opts.sourceName || '').replace(/\.zip$/i, '') || 'Untitled experiment';
    exp.meta.sourceName = String(opts.sourceName || ''); exp.meta.sourceSize = Number(opts.bytes ? opts.bytes.byteLength : 0);
    exp.meta.sourceModifiedAt = opts.sourceModifiedAt || null; exp.meta.sourceType = opts.sourceType || 'application/zip';
    exp.raw.sourceArchive = opts.bytes instanceof ArrayBuffer ? opts.bytes.slice(0) : null; exp.raw.sourceName = exp.meta.sourceName;
    return exp;
  }
  function addFile(exp, seed) { return addRecord(exp, 'file', seed); }
  function addBlock(exp, seed) { return addRecord(exp, 'block', seed); }

  function getExperiment() { const exp = LF.State && LF.State.state && LF.State.state.experiment || null; return exp ? hydrate(exp) : null; }
  function toWorkingJSON(exp, opts) {
    const n = normalize(exp); opts = opts || {};
    return {
      meta: clone(n.meta), experiments: clone(n.experiments), samples: clone(n.samples), runs: clone(n.runs), measurements: clone(n.measurements),
      files: n.files.map(function (f) { return { id: f.id, path: f.path, rawPath: f.rawPath, name: f.name, rawName: f.rawName, canonicalName: f.canonicalName, canonicalPath: f.canonicalPath, family: f.family, type: f.type }; }),
      blocks: n.blocks.map(function (b) { const limit = Number.isInteger(opts.rows) && opts.rows >= 0 ? opts.rows : b.data.rows.length; return { id: b.id, type: b.type, family: b.family, name: b.name, direction: b.direction, file: b.file && b.file.path || '', refs: clone(b.refs), columns: (b.schema.columns || []).map(function (c) { return c.name; }), rows: (b.data.rows || []).slice(0, limit) }; }),
      patches: clone(n.patches)
    };
  }

  LF.ExperimentData = ExperimentData;
  LF.DataModel = { ExperimentData: ExperimentData, create: create, hydrate: hydrate, restore: restore, serialize: serialize, normalize: normalize, touch: touch, getExperiment: getExperiment, getFile: getFile, getBlock: getBlock, selectBlocks: selectBlocks, readBlock: readBlock, getBlockSummary: getBlockSummary, getEffectiveBlock: getEffectiveBlock, applyPatch: applyPatch, addPatch: addPatch, toWorkingJSON: toWorkingJSON, addFile: addFile, addBlock: addBlock, addRecord: addRecord, _uid: uid };
}());
