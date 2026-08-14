(function () {
  'use strict';

  /*
   * Canonical ExperimentData core.
   *
   * RAW is immutable. Working modifications travel exclusively through
   * `patches` (operation set|remove|add) and are visible only through
   * getEffectiveBlock(). This module owns mechanics: file/entity/block
   * identity, selection, reads, summaries, patch application and revision
   * tracking. It never parses RAW bytes, calculates scientific metrics or
   * interprets meaning — those live in data/importer.js and data/analysis.js.
   *
   * Block data model: block.data = { header: string[], rows: object[] } where
   * each row is keyed by column name (plain values). Patch field paths use
   * dot notation, e.g. "rows.0.voc", "metadata.area".
   */
  'use strict';
  const LF = window.LabFlow = window.LabFlow || {};
  const C = LF.Core || {};
  const uid = C.uid || (function () {
    let n = 0;
    return function (p) { return (p || 'x') + '_' + (++n); };
  })();

  const OPERATIONS = ['set', 'remove', 'add'];

  function nowIso() { return new Date().toISOString(); }

  function empty(exp) {
    return {
      id: (exp && exp.id) || uid('exp'),
      meta: { name: '', createdAt: nowIso(), modifiedAt: null, sourceName: '', sourceSize: 0, sourceModifiedAt: null, sourceType: '', importMethod: '' },
      raw: { sourceArchive: null, sourceName: '', sha256: '' },
      files: [], entities: [], blocks: [], patches: [],
      manifest: [], rawFormatEvidence: [], auxiliaryEvidence: [], samples: [], measurements: [], findings: [], provenance: [],
      analysisSettings: { mismatchFactor: 1 },
      analysis: { summary: {}, bestBySample: [], topNonRef: [], topRef: [] },
      design: { status: 'unknown', solutions: [], process: { coating: '', annealing: '', atmosphere: '', notes: '' }, stack: [], devices: [] },
      report: {}, nomad: {}, interpretationOverrides: {},
      derived: { actions: {}, chat: { conversation: [] } },
      sync: { revision: 0, savedRevision: 0, dirty: false, lastChange: null, savedAt: null, savedKind: '' }
    };
  }

  function ensureBlockShape(b) {
    if (!b.id) b.id = uid('b');
    if (!b.type) b.type = 'table';
    if (!b.name) b.name = '';
    if (!b.entities) b.entities = [];
    if (!b.file) b.file = { id: '', path: '', locator: null };
    if (!b.schema) b.schema = { columns: [] };
    if (!b.data) b.data = { header: [], rows: [] };
    if (!Array.isArray(b.data.header)) b.data.header = [];
    if (!Array.isArray(b.data.rows)) b.data.rows = [];
    if (!b.metadata) b.metadata = {};
  }

  /** Repair structural gaps in place; never parses or calculates. */
  function normalize(exp) {
    if (!exp) return exp;
    const base = empty(exp);
    exp.meta = Object.assign(base.meta, exp.meta || {});
    exp.raw = Object.assign(base.raw, exp.raw || {});
    exp.files = Array.isArray(exp.files) ? exp.files : [];
    exp.entities = Array.isArray(exp.entities) ? exp.entities : [];
    exp.blocks = Array.isArray(exp.blocks) ? exp.blocks : [];
    exp.patches = Array.isArray(exp.patches) ? exp.patches : [];
    ['manifest', 'rawFormatEvidence', 'auxiliaryEvidence', 'samples', 'measurements', 'findings', 'provenance'].forEach(function (key) {
      exp[key] = Array.isArray(exp[key]) ? exp[key] : [];
    });
    exp.analysisSettings = Object.assign(base.analysisSettings, exp.analysisSettings || {});
    exp.analysis = Object.assign(base.analysis, exp.analysis || {});
    exp.design = Object.assign(base.design, exp.design || {});
    exp.report = exp.report && typeof exp.report === 'object' ? exp.report : {};
    exp.nomad = exp.nomad && typeof exp.nomad === 'object' ? exp.nomad : {};
    exp.interpretationOverrides = exp.interpretationOverrides && typeof exp.interpretationOverrides === 'object' ? exp.interpretationOverrides : {};
    exp.derived = exp.derived && typeof exp.derived === 'object' ? exp.derived : {};
    if(!exp.derived.actions && exp.derived.operations && typeof exp.derived.operations === 'object') exp.derived.actions=exp.derived.operations;
    exp.derived.actions = exp.derived.actions && typeof exp.derived.actions === 'object' ? exp.derived.actions : {};
    if(Object.prototype.hasOwnProperty.call(exp.derived,'operations')) delete exp.derived.operations;
    exp.derived.chat = exp.derived.chat && typeof exp.derived.chat === 'object' ? exp.derived.chat : { conversation: [] };
    exp.derived.chat.conversation = Array.isArray(exp.derived.chat.conversation) ? exp.derived.chat.conversation : [];
    exp.sync = Object.assign(base.sync, exp.sync || {});
    exp.files.forEach(function (f) {
      if (!f.id) f.id = uid('f');
      if (!f.path) f.path = f.name || '';
      if (!f.name) f.name = String(f.path).split('/').filter(Boolean).pop() || '';
      if (!f.extension) { const m = (f.name.match(/\.[^.]+$/) || [''])[0]; f.extension = m ? m.toLowerCase() : ''; }
      if (!f.type) f.type = 'unknown';
    });
    exp.entities.forEach(function (e) { if (!e.id) e.id = uid('e'); });
    exp.blocks.forEach(ensureBlockShape);
    return exp;
  }

  function create(opts) {
    opts = opts || {};
    const exp = empty();
    normalize(exp);
    exp.meta.name = String(opts.sourceName || '').replace(/\.zip$/i, '') || 'Untitled experiment';
    exp.meta.sourceName = String(opts.sourceName || '');
    exp.meta.sourceSize = Number(opts.bytes ? opts.bytes.byteLength : 0);
    exp.meta.sourceModifiedAt = opts.sourceModifiedAt || null;
    exp.meta.sourceType = opts.sourceType || 'application/zip';
    /* Keep a private pristine snapshot of the uploaded archive. The Working Copy
       never shares the caller's mutable ArrayBuffer reference. */
    exp.raw.sourceArchive = opts.bytes instanceof ArrayBuffer ? opts.bytes.slice(0) : null;
    exp.raw.sourceName = exp.meta.sourceName;
    return exp;
  }

  function addFile(exp, f) {
    normalize(exp);
    const file = { id: uid('f'), name: '', extension: '', family: null, type: 'unknown', size: 0, sha256: '', unreadable: false };
    Object.assign(file, f);
    if (!file.path) file.path = file.name;
    if (!file.name) file.name = String(file.path).split('/').filter(Boolean).pop() || '';
    exp.files.push(file);
    return file;
  }

  function addEntity(exp, e) {
    normalize(exp);
    const ent = { id: uid('e'), kind: 'sample', name: '', rawName: '', isRef: false, group: '', meta: {} };
    Object.assign(ent, e);
    if (!ent.rawName) ent.rawName = ent.name;
    exp.entities.push(ent);
    return ent;
  }

  function addBlock(exp, b) {
    normalize(exp);
    ensureBlockShape(b);
    exp.blocks.push(b);
    return b;
  }

  function blockOf(exp, id) {
    return (exp.blocks || []).find(function (b) { return b.id === id; }) || null;
  }

  function getBlock(exp, id) { return blockOf(normalize(exp), id); }
  function getFile(exp, path) { return (exp.files || []).find(function (f) { return f.path === path; }) || null; }
  function getEntity(exp, id) { return (exp.entities || []).find(function (e) { return e.id === id; }) || null; }

  function selectBlocks(exp, q) {
    q = q || {};
    return (exp.blocks || []).filter(function (b) {
      if (q.family && b.family !== q.family) return false;
      if (q.type && b.type !== q.type) return false;
      if (q.file) { const f = b.file || {}; if (f.path !== q.file && f.id !== q.file) return false; }
      if (q.entity && !(Array.isArray(b.entities) && b.entities.indexOf(q.entity) >= 0)) return false;
      if (q.nameSubstr && String(b.name || '').indexOf(q.nameSubstr) < 0) return false;
      if (q.direction && b.direction !== q.direction) return false;
      return true;
    });
  }

  function readBlock(exp, id, opts) {
    const block = blockOf(exp, id);
    if (!block) return { error: { code: 'BLOCK_NOT_FOUND', message: 'Block not found: ' + id } };
    opts = opts || {};
    const rows = block.data.rows || [];
    const limited = Number.isInteger(opts.rows) && opts.rows >= 0 ? rows.slice(0, opts.rows) : rows.slice(0);
    return { block: block, header: (block.data.header || []).slice(), rows: limited };
  }

  function getBlockSummary(exp, id) {
    const block = blockOf(exp, id);
    if (!block) return { error: { code: 'BLOCK_NOT_FOUND', message: 'Block not found: ' + id } };
    const cols = block.schema.columns || [];
    const rows = block.data.rows || [];
    const ents = (block.entities || []).map(function (eid) { const e = getEntity(exp, eid); return e ? e.name : eid; });
    return {
      blockId: block.id, type: block.type, family: block.family || null, name: block.name || '',
      direction: block.direction || null,
      file: block.file && block.file.path || '', rows: rows.length,
      columns: cols.map(function (c) { return c.name; }), entities: ents
    };
  }

  function clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  /**
   * Apply an applied patch list to a deep clone of the base block.
   * field is a dot path; numeric segments index arrays. add() appends to the
   * target array (block.data.rows by default).
   */
  function getEffectiveBlock(exp, id) {
    const block = blockOf(exp, id);
    if (!block) return null;
    const copy = clone(block);
    (exp.patches || []).forEach(function (p) {
      if (p.blockId !== id || p.status !== 'applied') return;
      if (p.operation === 'set' && typeof p.field === 'string') {
        const seg = p.field.split('.');
        let node = copy;
        for (let i = 0; i < seg.length - 1 && node; i++) {
          const key = seg[i];
          node = (node != null && typeof node === 'object') ? node[key] : undefined;
        }
        if (node != null && typeof node === 'object') node[seg[seg.length - 1]] = p.to;
      } else if (p.operation === 'remove' && typeof p.field === 'string') {
        const seg = p.field.split('.');
        let node = copy;
        for (let i = 0; i < seg.length - 1 && node; i++) {
          const key = seg[i];
          node = (node != null && typeof node === 'object') ? node[key] : undefined;
        }
        if (node != null && typeof node === 'object') delete node[seg[seg.length - 1]];
      } else if (p.operation === 'add') {
        const seg = (p.field || 'data.rows').split('.');
        let node = copy;
        for (let i = 0; i < seg.length - 1 && node; i++) {
          const key = seg[i];
          node = (node != null && typeof node === 'object') ? node[key] : undefined;
        }
        if (node != null && Array.isArray(node[seg[seg.length - 1]])) node[seg[seg.length - 1]].push(p.to);
      }
    });
    return copy;
  }

  function coerce(raw) {
    if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'value' in raw) return coerce(raw.value);
    return raw;
  }

  function errorOut(code, message) { return { ok: false, error: { code: code, message: message } }; }

  function applyPatch(exp, patch) {
    normalize(exp);
    if (!patch || OPERATIONS.indexOf(patch.operation) < 0) return errorOut('PATCH_INVALID', 'Invalid patch operation: ' + (patch && patch.operation));
    const block = blockOf(exp, patch.blockId);
    if (!block) return errorOut('BLOCK_NOT_FOUND', 'No block ' + patch.blockId);
    if (patch.operation === 'set' && typeof patch.field !== 'string') return errorOut('PATCH_INVALID', 'set requires a field path');
    const operation = patch.operation;
    const field = patch.field || (operation === 'add' ? 'data.rows' : null);
    if (operation !== 'add' && typeof field !== 'string') return errorOut('PATCH_INVALID', 'field path is required');
    const rec = {
      id: uid('p'),
      blockId: patch.blockId,
      operation: operation,
      field: field,
      from: coerce(patch.from),
      to: coerce(patch.to),
      source: patch.source || 'system',
      reason: patch.reason || '',
      evidence: Array.isArray(patch.evidence) ? patch.evidence.slice() : [],
      status: 'applied',
      createdAt: nowIso(),
      appliedAt: nowIso()
    };
    exp.patches.push(rec);
    touch(exp, 'dataset');
    return { ok: true, patch: rec };
  }

  function touch(exp, scope) {
    normalize(exp);
    exp.sync.revision = Number(exp.sync.revision || 0) + 1;
    exp.sync.dirty = exp.sync.revision !== Number(exp.sync.savedRevision || 0);
    exp.sync.lastChange = { scope: scope || 'metadata', at: nowIso() };
    exp.meta.modifiedAt = nowIso();
  }

  function getExperiment() {
    return (LF.State && LF.State.state && LF.State.state.experiment) || null;
  }

  function toWorkingJSON(exp, opts) {
    const n = normalize(exp);
    opts = opts || {};
    return {
      meta: n.meta,
      files: n.files.map(function (f) { return { id: f.id, path: f.path, rawPath: f.rawPath || f.path, name: f.name || '', rawName: f.rawName || f.name || '', canonicalName: f.canonicalName || f.name || '', canonicalPath: f.canonicalPath || f.path, family: f.family, type: f.type }; }),
      entities: n.entities.map(function (e) { return { id: e.id, kind: e.kind, name: e.name, isRef: !!e.isRef, group: e.group || '' }; }),
      blocks: n.blocks.map(function (b) {
        const limit = Number.isInteger(opts.rows) && opts.rows >= 0 ? opts.rows : b.data.rows.length;
        return {
          id: b.id, type: b.type, family: b.family || null, name: b.name || '',
          direction: b.direction || null,
          file: b.file && b.file.path || '',
          entities: (b.entities || []).slice(),
          columns: (b.schema.columns || []).map(function (c) { return c.name; }),
          rows: (b.data.rows || []).slice(0, limit)
        };
      })
    };
  }

  LF.DataModel = {
    create: create,
    normalize: normalize,
    touch: touch,
    getExperiment: getExperiment,
    getFile: getFile,
    getEntity: getEntity,
    getBlock: getBlock,
    selectBlocks: selectBlocks,
    readBlock: readBlock,
    getBlockSummary: getBlockSummary,
    getEffectiveBlock: getEffectiveBlock,
    applyPatch: applyPatch,
    toWorkingJSON: toWorkingJSON,
    addFile: addFile,
    addEntity: addEntity,
    addBlock: addBlock,
    _uid: uid
  };
}());
