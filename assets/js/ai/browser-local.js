/*
 * Browser-local GGUF runtime backed by wllama.
 * Boundary: Model lifecycle, cache and inference only; no scientific routing lives here.
 */
(function () {
  'use strict';

  const LF = window.LabFlow = window.LabFlow || {};
  const Log = LF.Logger.scope('browser-local');
  const WLLAMA_VERSION = '3.6.1';
  const CDN_BASE = 'https://cdn.jsdelivr.net/npm/@wllama/wllama@' + WLLAMA_VERSION + '/esm/';
  const MODULE_URL = CDN_BASE + 'index.js';
  const WASM_URL = CDN_BASE + 'wasm/wllama.wasm';
  const CUSTOM_KEY = 'labflow.browser-local.models';
  const DEFAULT_MODEL = Object.freeze({
    id: 'lfm2.5-350m-q4_k_m',
    name: 'LFM2.5 350M · Q4_K_M',
    file: 'LFM2.5-350M-Q4_K_M.gguf',
    url: 'https://huggingface.co/LiquidAI/LFM2.5-350M-GGUF/resolve/main/LFM2.5-350M-Q4_K_M.gguf',
    expectedBytes: 229000000,
    sha256: '7e6f72643caafc9a68256686638c4d7916f2cec76d1df478d4c3ddcd95a6aed4',
    contextWindow: 4096,
    bundled: true,
    source: 'url'
  });
  /* Uploaded GGUF files are used directly from this device. Only their catalogue definition
     and compatibility metadata are persisted; the bytes stay in this session. */
  const FILE_SESSION = new Map();
  const GGUF_MAGIC = 0x46554747;
  const MAX_HEADER_BYTES = 4 * 1024 * 1024;
  const MAX_KV_PAIRS = 4096;
  const MAX_ARRAY_ITEMS = 8192;
  const SCALAR_SIZES = { 0: 1, 1: 1, 2: 2, 3: 2, 4: 4, 5: 4, 6: 4, 7: 1, 10: 8, 11: 8, 12: 8 };
  const FILE_TYPE_LABELS = {
    0: 'F32', 1: 'F16', 2: 'Q4_0', 3: 'Q4_1', 7: 'Q8_0', 8: 'Q5_0', 9: 'Q5_1',
    10: 'Q2_K', 11: 'Q3_K_S', 12: 'Q3_K_M', 13: 'Q3_K_L', 14: 'Q4_K_S', 15: 'Q4_K_M',
    16: 'Q5_K_S', 17: 'Q5_K_M', 18: 'Q6_K'
  };
  // Advisory only: a newer llama.cpp build may still support an architecture outside this list.
  const KNOWN_ARCHITECTURES = new Set([
    'llama', 'mistral', 'mixtral', 'qwen2', 'qwen2moe', 'qwen3', 'gemma', 'gemma2', 'gemma3',
    'phi2', 'phi3', 'phimoe', 'falcon', 'mpt', 'gpt2', 'gptneox', 'starcoder', 'starcoder2',
    'command-r', 'deepseek2', 'lfm2', 'lfm2moe', 'granite', 'olmo', 'olmo2', 'smollm', 'stablelm'
  ]);

  let modulePromise = null;
  let runtime = null;
  let activeModel = null;
  let activeModelId = '';
  let listeners = [];
  let initPromise = null;
  let activeController = null;
  let runtimeForcedCpu = false;
  let state = {
    status: 'idle', stage: 'Idle', progress: 0, cached: false, loaded: false,
    warmed: false, webgpuAvailable: false, backend: '', modelId: DEFAULT_MODEL.id,
    modelName: DEFAULT_MODEL.name, modelBytes: null, downloadedBytes: 0, totalBytes: 0,
    storageUsage: null, storageQuota: null, storagePersistent: null,
    downloadBytesPerSecond: 0, downloadEtaSeconds: null,
    error: '', note: '', checkedAt: 0,
    compatibility: null, cacheEntries: null
  };

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function emit(patch) {
    state = Object.assign({}, state, patch || {});
    listeners.slice().forEach(function (fn) { try { fn(clone(state)); } catch (_) {} });
    try { document.dispatchEvent(new CustomEvent('labflow:browser-local-state', { detail: clone(state) })); } catch (_) {}
    return clone(state);
  }
  function subscribe(fn) { if (typeof fn !== 'function') return function () {}; listeners.push(fn); return function () { listeners = listeners.filter(function (x) { return x !== fn; }); }; }
  function getState() { return clone(state); }

  async function refreshStorageInfo(requestPersistence) {
    if (typeof navigator === 'undefined' || !navigator.storage) return getState();
    let persistent = null;
    try {
      if (requestPersistence && navigator.storage.persist) persistent = await navigator.storage.persist();
      else if (navigator.storage.persisted) persistent = await navigator.storage.persisted();
    } catch (_) {}
    try {
      const estimate = navigator.storage.estimate ? await navigator.storage.estimate() : {};
      emit({
        storageUsage: Number.isFinite(Number(estimate && estimate.usage)) ? Number(estimate.usage) : null,
        storageQuota: Number.isFinite(Number(estimate && estimate.quota)) ? Number(estimate.quota) : null,
        storagePersistent: persistent
      });
    } catch (_) {
      if (persistent != null) emit({ storagePersistent: persistent });
    }
    return getState();
  }
  function readCustom() {
    try { const raw = localStorage.getItem(CUSTOM_KEY); const rows = raw ? JSON.parse(raw) : []; return Array.isArray(rows) ? rows : []; }
    catch (_) { return []; }
  }
  function writeCustom(rows) { try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(rows)); return true; } catch (_) { return false; } }
  function shortHash(text) {
    let hash = 2166136261;
    String(text || '').split('').forEach(function (char) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    });
    return (hash >>> 0).toString(36);
  }

  /* GGUF header inspection. It reads only the first megabytes, never executes content and
     returns a sanitized summary used for the compatibility report. */
  function inspectGguf(input) {
    const report = {
      format: 'GGUF', ok: false, version: null, tensorCount: null, kvCount: null,
      architecture: '', name: '', contextLength: null, fileType: null, quantization: '',
      partial: false, problems: [], warnings: []
    };
    let bytes;
    if (input instanceof Uint8Array) bytes = input;
    else if (input && typeof ArrayBuffer !== 'undefined' && input instanceof ArrayBuffer) bytes = new Uint8Array(input);
    else { report.problems.push('No readable file content was supplied.'); return report; }
    if (bytes.byteLength < 24) { report.problems.push('The file is too small to contain a GGUF header.'); return report; }
    let view;
    try { view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }
    catch (_) { report.problems.push('The file content could not be read.'); return report; }
    if (view.getUint32(0, true) !== GGUF_MAGIC) { report.problems.push('Missing GGUF signature: this is not a GGUF model file.'); return report; }
    report.version = view.getUint32(4, true);
    report.tensorCount = Number(view.getBigUint64(8, true));
    report.kvCount = Number(view.getBigUint64(16, true));
    if ([1, 2, 3].indexOf(report.version) < 0) report.problems.push('Unsupported GGUF version ' + report.version + ' (supported: 1, 2, 3).');
    if (report.version === 1) report.warnings.push('GGUF v1 is legacy; re-export as v2/v3 if loading fails.');
    const decoder = typeof TextDecoder === 'function' ? new TextDecoder('utf-8') : null;
    let offset = 24, architecture = '', name = '', fileType = null, contexts = {};
    function ensure(count) { if (offset + count > bytes.byteLength) throw new Error('truncated header'); }
    function readString() {
      ensure(8); const length = Number(view.getBigUint64(offset, true)); offset += 8;
      if (!Number.isFinite(length) || length < 0 || length > MAX_HEADER_BYTES) throw new Error('invalid string length');
      ensure(length); const text = decoder ? decoder.decode(bytes.subarray(offset, offset + length)) : '';
      offset += length; return text;
    }
    function readScalar(type) {
      switch (type) {
        case 0: case 7: { ensure(1); const value = view.getUint8(offset); offset += 1; return type === 7 ? !!value : value; }
        case 1: { ensure(1); const value = view.getInt8(offset); offset += 1; return value; }
        case 2: { ensure(2); const value = view.getUint16(offset, true); offset += 2; return value; }
        case 3: { ensure(2); const value = view.getInt16(offset, true); offset += 2; return value; }
        case 4: { ensure(4); const value = view.getUint32(offset, true); offset += 4; return value; }
        case 5: { ensure(4); const value = view.getInt32(offset, true); offset += 4; return value; }
        case 6: { ensure(4); const value = view.getFloat32(offset, true); offset += 4; return value; }
        case 10: { ensure(8); const value = Number(view.getBigUint64(offset, true)); offset += 8; return value; }
        case 11: { ensure(8); const value = Number(view.getBigInt64(offset, true)); offset += 8; return value; }
        case 12: { ensure(8); const value = view.getFloat64(offset, true); offset += 8; return value; }
        case 8: return readString();
        default: return undefined;
      }
    }
    function skipValue(type, depth) {
      if (type === 9) {
        ensure(12); const element = view.getUint32(offset, true), count = Number(view.getBigUint64(offset + 4, true)); offset += 12;
        if (element === 9) throw new Error('nested array');
        const elementSize = SCALAR_SIZES[element];
        if (elementSize && count <= MAX_ARRAY_ITEMS) { ensure(elementSize * count); offset += elementSize * count; return; }
        if (count > MAX_ARRAY_ITEMS && depth > 0) throw new Error('array too large');
        let seen = 0;
        for (; seen < count; seen++) {
          if (seen >= MAX_ARRAY_ITEMS) throw new Error('array too large');
          skipValue(element, depth + 1);
        }
        return;
      }
      const size = SCALAR_SIZES[type];
      if (size == null && type !== 8) throw new Error('unsupported metadata value type ' + type);
      if (type === 8) { readString(); return; }
      ensure(size); offset += size;
    }
    try {
      const pairs = Math.min(report.kvCount, MAX_KV_PAIRS);
      for (let index = 0; index < pairs; index++) {
        const key = readString(); ensure(4);
        const type = view.getUint32(offset, true); offset += 4;
        const contextMatch = /\.context_length$/.test(key);
        const wanted = key === 'general.architecture' || key === 'general.name' || key === 'general.file_type' || contextMatch;
        if (wanted) {
          const value = readScalar(type);
          if (key === 'general.architecture') architecture = String(value || '').trim();
          else if (key === 'general.name') name = String(value || '').trim();
          else if (key === 'general.file_type') fileType = Number.isFinite(Number(value)) ? Number(value) : null;
          else if (contextMatch) contexts[key.split('.')[0]] = Number(value) || contexts[key.split('.')[0]] || null;
        } else skipValue(type, 0);
      }
    } catch (_error) {
      report.partial = true;
      report.warnings.push('GGUF metadata is truncated or uses an unsupported value type; only the readable header was checked.');
    }
    report.architecture = architecture;
    report.name = name;
    report.fileType = fileType;
    report.quantization = fileType != null ? (FILE_TYPE_LABELS[fileType] || ('file_type_' + fileType)) : '';
    report.contextLength = (architecture && contexts[architecture]) || contexts.llama || Object.keys(contexts).map(function (key) { return contexts[key]; }).find(function (value) { return value; }) || null;
    if (!report.architecture) report.warnings.push('The model does not declare general.architecture.');
    else if (!KNOWN_ARCHITECTURES.has(report.architecture)) report.warnings.push('Architecture "' + report.architecture + '" is not in the known list for the pinned runtime; loading may fail.');
    if (report.contextLength != null && report.contextLength < 2048) report.warnings.push('The declared context length is very small (' + report.contextLength + ' tokens).');
    report.ok = report.problems.length === 0;
    return report;
  }
  async function blobHead(blob, maxBytes) {
    const size = Math.min(Math.max(0, Number(blob && blob.size) || 0), Math.max(1024, Number(maxBytes) || MAX_HEADER_BYTES));
    if (!size) return new ArrayBuffer(0);
    return blob.slice(0, size).arrayBuffer();
  }
  function compatibilityLabel(report) {
    if (!report) return 'Not checked';
    if (report.ok) return 'Compatible';
    return (report.problems && report.problems.length) ? 'Incompatible' : 'Review';
  }
  function clampContext(value) { return Math.max(2048, Math.min(16384, Number(value) || 4096)); }
  function normalizeCustom(row) {
    row = row || {};
    const source = String(row.source || 'url') === 'file' ? 'file' : 'url';
    const file = String(row.file || '').trim();
    if (source === 'file') {
      if (!/\.gguf$/i.test(file)) return null;
      const size = Number(row.expectedBytes) || null;
      return {
        id: String(row.id || ('file_' + shortHash(file + ':' + (size || 0)))),
        name: String(row.name || file.replace(/\.gguf$/i, '')), file: file, url: '', source: 'file',
        expectedBytes: size, contextWindow: clampContext(row.contextWindow),
        architecture: String(row.architecture || ''), quantization: String(row.quantization || ''),
        ggufVersion: Number(row.ggufVersion) || null, bundled: false
      };
    }
    const url = String(row.url || '').trim();
    if (!/^https?:\/\/.+\.gguf(?:$|[?#])/i.test(url)) return null;
    const urlFile = String(row.file || url.split('/').pop().split(/[?#]/)[0] || 'model.gguf');
    return {
      id: String(row.id || ('gguf_' + shortHash(url))),
      name: String(row.name || urlFile.replace(/\.gguf$/i, '')), file: urlFile, url: url, source: 'url',
      expectedBytes: Number(row.expectedBytes) || null, contextWindow: clampContext(row.contextWindow),
      architecture: String(row.architecture || ''), quantization: String(row.quantization || ''),
      ggufVersion: Number(row.ggufVersion) || null, bundled: false
    };
  }
  function catalog() {
    const custom = readCustom().map(normalizeCustom).filter(Boolean);
    return [DEFAULT_MODEL].concat(custom.filter(function (x) { return x.id !== DEFAULT_MODEL.id; }));
  }
  function resolveModel(id) { const key = String(id || DEFAULT_MODEL.id); return catalog().find(function (x) { return x.id === key; }) || DEFAULT_MODEL; }
  // A selected catalogue id must never be silently replaced by the bundled default.
  function hasModel(id) { const key = String(id || ''); return !!key && catalog().some(function (x) { return String(x.id) === key; }); }
  function addModel(url, name) {
    const row = normalizeCustom({ url: url, name: name }); if (!row) throw new Error('Enter a complete http(s) URL ending in .gguf.');
    const rows = readCustom().map(normalizeCustom).filter(Boolean).filter(function (x) { return x.url !== row.url; }); rows.push(row); writeCustom(rows); return row;
  }
  // Uploaded files are validated from their own bytes and used directly by wllama.loadModel(Blob[]).
  async function addModelFromFile(file, name) {
    if (!file || typeof file.slice !== 'function') throw new Error('Choose a GGUF file from this device first.');
    const fileName = String(file.name || 'model.gguf');
    if (!/\.gguf$/i.test(fileName)) throw new Error('Only .gguf files are supported.');
    if (!(Number(file.size) > 0)) throw new Error('The selected file is empty.');
    const report = inspectGguf(await blobHead(file, MAX_HEADER_BYTES));
    if (!report.ok) throw new Error(report.problems[0] || 'The selected file is not a compatible GGUF model.');
    const size = Number(file.size);
    const row = normalizeCustom({
      source: 'file', file: fileName, name: name || report.name || fileName.replace(/\.gguf$/i, ''),
      expectedBytes: size, contextWindow: report.contextLength || 4096,
      architecture: report.architecture, quantization: report.quantization, ggufVersion: report.version
    });
    if (!row) throw new Error('The selected file name is not a valid GGUF name.');
    FILE_SESSION.set(row.id, file);
    const rows = readCustom().map(normalizeCustom).filter(Boolean).filter(function (x) { return x.id !== row.id; });
    rows.push(row); writeCustom(rows);
    emit({ compatibility: Object.assign({}, report, { modelId: row.id, modelName: row.name, fileSize: size, label: compatibilityLabel(report), checkedAt: Date.now() }) });
    return row;
  }
  function removeModelDefinition(id) { FILE_SESSION.delete(String(id)); const rows = readCustom().map(normalizeCustom).filter(Boolean).filter(function (x) { return x.id !== String(id); }); writeCustom(rows); }

  async function importWllama() {
    if (!modulePromise) {
      emit({ status: 'checking', stage: 'Loading browser runtime', error: '', progress: 0.02 });
      const loader = LF.__browserLocalModuleLoader || function (url) { return import(url); };
      modulePromise = Promise.resolve(loader(MODULE_URL));
    }
    return modulePromise;
  }
  function runtimeLogger() { return { debug: function () {}, log: function () {}, warn: function () { Log.warn('runtime', { args: Array.from(arguments).map(String) }); }, error: function () { Log.error('runtime', { args: Array.from(arguments).map(String) }); } }; }
  async function createRuntime(forceCpu) {
    const mod = await importWllama();
    if (!mod || typeof mod.Wllama !== 'function') throw new Error('wllama did not expose the expected Wllama runtime.');
    const instance = new mod.Wllama(
      { default: WASM_URL },
      { parallelDownloads: 3, allowOffline: true, logger: runtimeLogger() }
    );
    runtimeForcedCpu = !!forceCpu;
    const webgpu = !forceCpu && !!(instance.isSupportWebGPU && instance.isSupportWebGPU());
    emit({ webgpuAvailable: !!(instance.isSupportWebGPU && instance.isSupportWebGPU()), backend: webgpu ? 'WebGPU' : 'WASM CPU' });
    return instance;
  }
  async function ensureRuntime(forceCpu) {
    const wantsCpu = !!forceCpu;
    const mustRecreate = !runtime || (wantsCpu && !runtimeForcedCpu);
    if (mustRecreate) {
      if (runtime) { try { await runtime.exit(); } catch (_) {} }
      runtime = await createRuntime(wantsCpu);
    }
    return runtime;
  }
  async function cachedModel(instance, model) {
    const rows = await instance.modelManager.getModels({ includeInvalid: true });
    return rows.find(function (x) { return String(x.url || '') === model.url; }) || null;
  }
  async function check(modelId) {
    if (modelId && !hasModel(modelId)) {
      emit({ status: 'error', stage: 'Selected model unavailable', modelId: String(modelId), modelName: '', error: 'The selected Browser Local model is not in the catalogue. Choose a model in Settings → AI connection.', note: '', progress: 0, checkedAt: Date.now() });
      return getState();
    }
    const model = resolveModel(modelId || (LF.Storage && LF.Storage.getAiSettings ? LF.Storage.getAiSettings().model : DEFAULT_MODEL.id));
    emit({ status: 'checking', stage: 'Checking model cache', modelId: model.id, modelName: model.name, error: '', progress: 0.05 });
    if (model.source === 'file') {
      const attached = FILE_SESSION.get(model.id) || null;
      activeModel = null;
      emit({ status: attached ? 'cached' : 'not_installed', stage: attached ? 'Local file attached' : 'Local file not attached',
        cached: !!attached, loaded: false, modelBytes: attached ? attached.size : (model.expectedBytes || null),
        progress: attached ? 0.2 : 0, checkedAt: Date.now(),
        note: attached ? 'The uploaded GGUF is attached for this session.' : 'Select the GGUF file again to use this catalogue entry.' });
      await refreshStorageInfo(false);
      return getState();
    }
    const instance = await ensureRuntime(false), cached = await cachedModel(instance, model), valid = !!(cached && cached.validate && cached.validate() === 'valid');
    activeModel = valid ? cached : null;
    emit({ status: valid ? 'cached' : 'not_installed', stage: valid ? 'Model cached' : 'Model not installed', cached: valid, loaded: instance.isModelLoaded ? instance.isModelLoaded() : false, modelBytes: valid ? cached.size : null, progress: valid ? 0.2 : 0, checkedAt: Date.now(), note: valid ? 'Ready to load from browser cache.' : 'The GGUF must be downloaded once before inference.' });
    await refreshStorageInfo(false);
    return getState();
  }
  async function download(modelId, options) {
    options = options || {}; const model = resolveModel(modelId);
    if (model.source === 'file') {
      const attached = FILE_SESSION.get(model.id) || null;
      if (!attached) throw new Error('Uploaded GGUF files are used directly from this device. Select the file again instead of downloading it.');
      emit({ status: 'cached', stage: 'Local file ready', cached: true, modelId: model.id, modelName: model.name, modelBytes: attached.size, downloadedBytes: attached.size, totalBytes: attached.size, progress: 0.82, downloadBytesPerSecond: 0, downloadEtaSeconds: 0 });
      await refreshStorageInfo(false);
      return getState();
    }
    const instance = await ensureRuntime(false);
    let sampleAt = performance.now(), sampleBytes = 0, smoothedRate = 0;
    emit({ status: 'downloading', stage: 'Downloading GGUF', modelId: model.id, modelName: model.name, cached: false, error: '', progress: 0, downloadedBytes: 0, totalBytes: model.expectedBytes || 0, downloadBytesPerSecond: 0, downloadEtaSeconds: null });
    const downloaded = await instance.modelManager.getModelOrDownload({ url: model.url }, { progressCallback: function (p) {
      const loaded = Math.max(0, Number(p && p.loaded) || 0), total = Math.max(0, Number(p && p.total) || model.expectedBytes || 0), progress = total ? loaded / total : 0;
      const now = performance.now(), elapsed = Math.max(0, (now - sampleAt) / 1000);
      if (elapsed >= 0.2 && loaded >= sampleBytes) {
        const instantRate = (loaded - sampleBytes) / elapsed;
        if (Number.isFinite(instantRate) && instantRate > 0) smoothedRate = smoothedRate > 0 ? smoothedRate * 0.72 + instantRate * 0.28 : instantRate;
        sampleAt = now; sampleBytes = loaded;
      }
      const eta = smoothedRate > 0 && total > loaded ? (total - loaded) / smoothedRate : null;
      emit({ status: 'downloading', stage: 'Downloading GGUF', progress: Math.min(0.82, progress * 0.82), downloadedBytes: loaded, totalBytes: total, downloadBytesPerSecond: smoothedRate, downloadEtaSeconds: eta });
      if (typeof options.onProgress === 'function') options.onProgress(getState());
    } });
    if (!downloaded || downloaded.validate() !== 'valid') throw new Error('The downloaded GGUF is incomplete or invalid.');
    activeModel = downloaded;
    emit({ status: 'cached', stage: 'Download complete', cached: true, modelBytes: downloaded.size, downloadedBytes: downloaded.size, totalBytes: downloaded.size, progress: 0.82, downloadBytesPerSecond: 0, downloadEtaSeconds: 0 });
    await refreshStorageInfo(true);
    return downloaded;
  }
  async function loadModel(modelId, options) {
    options = options || {}; const model = resolveModel(modelId), preferGpu = options.preferWebGPU !== false;
    const fileBlob = model.source === 'file' ? (FILE_SESSION.get(model.id) || null) : null;
    if (model.source === 'file' && !fileBlob) throw new Error('The uploaded GGUF is no longer attached. Select the file again in Settings → AI connection.');
    if (preferGpu && runtime && runtimeForcedCpu) {
      try { await runtime.exit(); } catch (_) {}
      runtime = await createRuntime(false);
    }
    let instance = await ensureRuntime(!preferGpu);
    if (!fileBlob) {
      const cached = await cachedModel(instance, model);
      if (!cached || cached.validate() !== 'valid') throw new Error('The selected GGUF is not cached. Download it first.');
    }
    emit({ status: 'loading', stage: 'Loading model', cached: true, modelId: model.id, modelName: model.name, progress: 0.86, error: '' });
    const nctx = Math.max(2048, Math.min(16384, Number(options.contextWindow) || model.contextWindow || 4096));
    async function payloadFor(target) {
      if (fileBlob) return [fileBlob];
      const entry = await cachedModel(target, model);
      if (!entry || entry.validate() !== 'valid') throw new Error('The selected GGUF is not cached. Download it first.');
      return entry;
    }
    async function doLoad(cpuOnly) {
      if (cpuOnly) instance = await ensureRuntime(true);
      const payload = await payloadFor(instance);
      await instance.loadModel(payload, { n_ctx: nctx, n_gpu_layers: cpuOnly ? 0 : 99999, jinja: true });
      activeModel = fileBlob ? null : payload; activeModelId = model.id;
      const size = fileBlob ? fileBlob.size : (payload && payload.size) || null;
      emit({ loaded: true, status: 'loaded', stage: 'Model loaded', backend: cpuOnly ? 'WASM CPU' : (state.webgpuAvailable ? 'WebGPU' : 'WASM CPU'), progress: 0.93, modelBytes: size });
      reportRuntimeCompatibility(instance, model, size);
    }
    try { await doLoad(!preferGpu || !state.webgpuAvailable); }
    catch (error) {
      if (!preferGpu || !state.webgpuAvailable) throw error;
      Log.warn('webgpu.load-fallback', { model: model.id, error: error });
      emit({ stage: 'WebGPU failed · switching to WASM CPU', note: String(error && error.message || error) });
      await doLoad(true);
    }
    return getState();
  }
  // After a successful load, wllama exposes the GGUF metadata it actually accepted.
  function reportRuntimeCompatibility(instance, model, size) {
    let metadata = null;
    try { metadata = instance && typeof instance.getModelMetadata === 'function' ? instance.getModelMetadata() : null; } catch (_) { return; }
    if (!metadata) return;
    const raw = metadata.meta || {}, hparams = metadata.hparams || {};
    const architecture = String(raw['general.architecture'] || model.architecture || '').trim();
    const rawFileType = raw['general.file_type'];
    const quantization = Number.isFinite(Number(rawFileType))
      ? (FILE_TYPE_LABELS[Number(rawFileType)] || ('file_type_' + rawFileType))
      : (model.quantization || '');
    const contextLength = Number(hparams.nCtxTrain) || model.contextWindow || null;
    const report = {
      format: 'GGUF', ok: true, version: model.ggufVersion || null, architecture: architecture,
      name: String(raw['general.name'] || model.name || ''), quantization: quantization,
      contextLength: contextLength, fileSize: size, partial: false, problems: [], warnings: [],
      runtime: 'loaded', modelId: model.id, modelName: model.name, checkedAt: Date.now()
    };
    if (architecture && !KNOWN_ARCHITECTURES.has(architecture)) report.warnings.push('Architecture "' + architecture + '" is outside the known list; verify model output before relying on it.');
    if (contextLength && contextLength < 2048) report.warnings.push('The model context is very small (' + contextLength + ' tokens).');
    report.label = compatibilityLabel(report);
    emit({ compatibility: report });
  }
  async function warmup(options) {
    options = options || {}; if (!runtime || !runtime.isModelLoaded || !runtime.isModelLoaded()) throw new Error('Load the browser model before warm-up.');
    emit({ status: 'warming', stage: 'Warming model', progress: 0.96, error: '' });
    const started = performance.now();
    try {
      await runtime.createChatCompletion({ messages: [{ role: 'user', content: 'Reply with exactly: OK' }], max_tokens: 8, temperature: 0, stream: false, cache_prompt: true });
    } catch (error) {
      if (state.backend === 'WebGPU') {
        Log.warn('webgpu.warmup-fallback', { error: error });
        await loadModel(activeModelId || state.modelId, { preferWebGPU: false, contextWindow: options.contextWindow });
        await runtime.createChatCompletion({ messages: [{ role: 'user', content: 'Reply with exactly: OK' }], max_tokens: 8, temperature: 0, stream: false, cache_prompt: true });
      } else throw error;
    }
    emit({ status: 'ready', stage: 'Ready', warmed: true, loaded: true, progress: 1, note: 'Warm-up completed in ' + Math.round(performance.now() - started) + ' ms.' });
    return getState();
  }
  function settings() { return LF.Storage && LF.Storage.getAiSettings ? LF.Storage.getAiSettings() : {}; }
  async function ensureReady(options) {
    options = options || {}; const s = settings(), modelId = options.modelId || s.model || DEFAULT_MODEL.id, model = resolveModel(modelId);
    // The bundled default is used only when no model was requested; a stale selected id fails closed.
    if (modelId && !hasModel(modelId)) {
      const error = new Error('The selected Browser Local model is not in the catalogue. Choose a model in Settings → AI connection.');
      emit({ status: 'error', stage: 'Selected model unavailable', error: String(error.message), note: '', progress: 0 });
      Log.warn('ready.unknown-model', { model: String(modelId) });
      throw error;
    }
    if (initPromise && !options.force) return initPromise;
    initPromise = (async function () {
      try {
        const checked = await check(modelId); let cached = checked.cached;
        const saveData = options.allowSaveData !== true && typeof navigator !== 'undefined' && !!(navigator.connection && navigator.connection.saveData);
        const autoDownload = options.autoDownload != null ? !!options.autoDownload : s.browserLocalAutoDownload !== false;
        if (!cached) {
          if (model.source === 'file') {
            emit({ status: 'not_installed', stage: 'Local file required', note: 'Select the GGUF file again in Settings → AI connection.' });
            return getState();
          }
          if (!autoDownload || saveData) {
            emit({ status: 'not_installed', stage: 'Model download required', note: saveData ? 'Automatic download skipped because browser Data Saver is enabled.' : 'Automatic model download is disabled.' });
            return getState();
          }
          await download(modelId, options); cached = true;
        }
        if (!runtime || !runtime.isModelLoaded || !runtime.isModelLoaded() || activeModelId !== modelId) await loadModel(modelId, { preferWebGPU: s.browserLocalPreferWebGPU !== false, contextWindow: s.browserLocalContextWindow || 4096 });
        if ((options.warmup != null ? options.warmup : s.browserLocalAutoWarmup !== false) && !state.warmed) await warmup({ contextWindow: s.browserLocalContextWindow || 4096 });
        else if (state.loaded) emit({ status: 'ready', stage: 'Ready', progress: 1 });
        return getState();
      } catch (error) {
        emit({ status: 'error', stage: 'Browser model unavailable', error: String(error && error.message || error), note: '', progress: 0 });
        Log.error('ready.failed', { error: error, model: modelId });
        throw error;
      } finally { initPromise = null; }
    }());
    return initPromise;
  }
  async function startup() {
    const s = settings(); if (s.provider !== 'browserlocal') return getState();
    return ensureReady({ autoDownload: s.browserLocalAutoDownload !== false, warmup: s.browserLocalAutoWarmup !== false });
  }
  async function removeCached(modelId) {
    const model = resolveModel(modelId);
    if (model.source === 'file') {
      FILE_SESSION.delete(model.id);
      if (activeModelId === model.id) { try { if (runtime && runtime.isModelLoaded && runtime.isModelLoaded()) await runtime.exit(); } catch (_) {} activeModelId = ''; activeModel = null; }
      emit({ status: 'not_installed', stage: 'Local file detached', cached: false, loaded: false, warmed: false, modelBytes: null, progress: 0, backend: '', modelId: model.id, modelName: model.name, downloadBytesPerSecond: 0, downloadEtaSeconds: null });
      await refreshStorageInfo(false);
      return getState();
    }
    const instance = await ensureRuntime(false), cached = await cachedModel(instance, model);
    if (runtime && runtime.isModelLoaded && runtime.isModelLoaded() && activeModelId === model.id) { await runtime.exit(); runtime = null; activeModelId = ''; activeModel = null; }
    if (cached) await cached.remove();
    emit({ status: 'not_installed', stage: 'Model removed', cached: false, loaded: false, warmed: false, modelBytes: null, progress: 0, backend: '', modelId: model.id, modelName: model.name, downloadBytesPerSecond: 0, downloadEtaSeconds: null });
    await refreshStorageInfo(false);
    return getState();
  }
  async function clearCache() {
    if (runtime && runtime.isModelLoaded && runtime.isModelLoaded()) await runtime.exit();
    runtime = null;
    runtimeForcedCpu = false;
    activeModel = null;
    activeModelId = '';
    FILE_SESSION.clear();
    const instance = await ensureRuntime(false);
    await instance.modelManager.clear();
    emit({ status: 'not_installed', stage: 'Model cache cleared', cached: false, loaded: false, warmed: false, modelBytes: null, progress: 0, backend: '', downloadBytesPerSecond: 0, downloadEtaSeconds: null, cacheEntries: [] });
    await refreshStorageInfo(false);
  }
  async function cachedModels() {
    const instance = await ensureRuntime(false), models = await instance.modelManager.getModels({ includeInvalid: true });
    return models.map(function (m) { return { url: m.url, size: m.size, valid: m.validate() === 'valid', id: (catalog().find(function (x) { return x.url === m.url; }) || {}).id || '' }; });
  }
  // Catalogue + cache inventory for the Settings cache panel (no network: wllama reports its own cache).
  async function cacheInventory() {
    const entries = [];
    for (const model of catalog()) {
      if (model.source === 'file') {
        const blob = FILE_SESSION.get(model.id) || null;
        entries.push({ id: model.id, name: model.name, file: model.file, source: 'file', cached: !!blob, size: blob ? blob.size : (model.expectedBytes || null), current: activeModelId === model.id, architecture: model.architecture || '', quantization: model.quantization || '' });
        continue;
      }
      let entry = null;
      try { const instance = await ensureRuntime(false); entry = await cachedModel(instance, model); } catch (_) {}
      const valid = !!(entry && entry.validate && entry.validate() === 'valid');
      entries.push({ id: model.id, name: model.name, file: model.file, source: model.bundled ? 'bundled' : 'url', cached: valid, size: valid ? entry.size : (model.expectedBytes || null), current: activeModelId === model.id, architecture: model.architecture || '', quantization: model.quantization || '' });
    }
    return entries;
  }
  async function refreshCache() { emit({ cacheEntries: await cacheInventory() }); return getState(); }
  // Compatibility report from bytes already available locally: uploaded file or cached wllama model.
  async function compatibility(modelId) {
    const model = resolveModel(modelId || state.modelId || DEFAULT_MODEL.id);
    let report = null, size = model.expectedBytes || null;
    if (model.source === 'file') {
      const blob = FILE_SESSION.get(model.id) || null;
      if (!blob) report = { format: 'GGUF', ok: false, partial: false, problems: ['The uploaded GGUF is no longer attached. Select the file again.'], warnings: [] };
      else { report = inspectGguf(await blobHead(blob, MAX_HEADER_BYTES)); size = blob.size; }
    } else {
      try {
        const instance = await ensureRuntime(false), entry = await cachedModel(instance, model);
        if (entry && entry.validate() === 'valid' && typeof entry.open === 'function') {
          const shards = await entry.open();
          report = inspectGguf(await blobHead(shards[0], MAX_HEADER_BYTES));
          size = entry.size;
        } else {
          report = { format: 'GGUF', ok: false, partial: false, problems: [], warnings: ['The model is not cached yet. Download it or attach the file to run the compatibility check.'] };
        }
      } catch (error) {
        report = { format: 'GGUF', ok: false, partial: false, problems: [], warnings: ['Compatibility could not be checked: ' + String(error && error.message || error)] };
      }
    }
    report.modelId = model.id; report.modelName = model.name; report.fileSize = size; report.checkedAt = Date.now();
    if (report.ok) {
      const quota = Number(state.storageQuota) || null, usage = Number(state.storageUsage) || 0;
      if (quota && size && size > Math.max(0, quota - usage)) report.warnings.push('The model may exceed the remaining browser storage quota.');
      const target = Number(settings().browserLocalContextWindow) || 0;
      if (target && report.contextLength && report.contextLength < target) report.warnings.push('The model context (' + report.contextLength + ' tokens) is below the configured ' + target + '; LabFlow will use the smaller value.');
    }
    report.label = compatibilityLabel(report);
    emit({ compatibility: report });
    return report;
  }
  async function chat(options) {
    options = options || {}; const s = settings(); await ensureReady({ modelId: options.model || s.model, autoDownload: true, warmup: true });
    if (!runtime || !runtime.isModelLoaded || !runtime.isModelLoaded()) throw new Error('Browser Local model is not ready.');
    const started = performance.now(), controller = options.controller || new AbortController(), wantsStream = options.stream !== false;
    activeController = controller;
    const request = { messages: options.messages || [], max_tokens: Math.max(8, Number(options.maxTokens) || 128), temperature: Number.isFinite(Number(options.temperature)) ? Number(options.temperature) : 0.2, stream: wantsStream, abortSignal: controller.signal, cache_prompt: true };
    if (options.jsonSchema) request.response_format = { type: 'json_schema', json_schema: { name: String(options.jsonSchemaName || 'labflow_output'), schema: options.jsonSchema, strict: false } };
    else if (options.jsonMode) request.response_format = { type: 'json_object' };
    let content = '', reasoning = '', firstToken = null, events = 0, finishReason = '', usage = null;
    try {
      if (typeof options.onProgress === 'function') {
        options.onProgress({ transportState: 'requesting', content: '', reasoning: '', backend: state.backend });
      }
      if (wantsStream) {
        const iterable = await runtime.createChatCompletion(request);
        for await (const chunk of iterable) {
          events++;
          const choice = chunk && chunk.choices && chunk.choices[0] || {}, delta = choice.delta || {};
          const text = String(delta.content || '');
          const think = String(delta.reasoning_content || delta.reasoning || '');
          if ((text || think) && firstToken == null) firstToken = performance.now();
          content += text;
          reasoning += think;
          finishReason = choice.finish_reason || finishReason;
          usage = chunk.usage || usage;
          if (typeof options.onProgress === 'function') {
            options.onProgress({
              transportState: 'streaming', content: content, reasoning: reasoning,
              backend: state.backend, events: events
            });
          }
        }
      } else {
        const response = await runtime.createChatCompletion(request);
        const choice = response && response.choices && response.choices[0] || {}, msg = choice.message || {};
        content = String(msg.content || '');
        reasoning = String(msg.reasoning_content || msg.reasoning || '');
        finishReason = String(choice.finish_reason || '');
        usage = response && response.usage || null;
        firstToken = performance.now();
      }
      const elapsed = Math.max(1, performance.now() - started);
      const completion = Number(usage && usage.completion_tokens) ||
        Math.max(1, Math.round((content.length + reasoning.length) / 4));
      const reasoningTokens = reasoning ? Math.round(reasoning.length / 4) : 0;
      return {
        content: content, reasoning: reasoning, finishReason: finishReason || 'stop',
        model: resolveModel(options.model || s.model).name, provider: 'browserlocal', backend: state.backend,
        latencyMs: Math.round(elapsed), requestElapsedMs: Math.round(elapsed),
        ttftMs: firstToken == null ? null : Math.round(firstToken - started),
        tokensPerSecond: Number((completion / (elapsed / 1000)).toFixed(2)),
        usage: {
          promptTokens: Number(usage && usage.prompt_tokens) || null,
          completionTokens: completion,
          totalTokens: Number(usage && usage.total_tokens) || null,
          reasoningTokens: reasoningTokens,
          answerTokens: Math.max(0, completion - reasoningTokens),
          estimated: !usage
        },
        streamed: wantsStream, streamEvents: events,
        responseBytes: new TextEncoder().encode(content + reasoning).byteLength,
        transport: 'browser-local-' + state.backend.toLowerCase().replace(/\s+/g, '-')
      };
    } catch (error) {
      const canFallback = options._wasmFallback !== true && state.backend === 'WebGPU' &&
        !controller.signal.aborted && !content && !reasoning;
      if (!canFallback) throw error;
      Log.warn('webgpu.inference-fallback', { model: options.model || s.model, error: error });
      emit({
        status: 'loading', stage: 'WebGPU inference failed · switching to WASM CPU',
        progress: 0.88, note: String(error && error.message || error)
      });
      await loadModel(options.model || s.model, {
        preferWebGPU: false,
        contextWindow: s.browserLocalContextWindow || 4096
      });
      await warmup({ contextWindow: s.browserLocalContextWindow || 4096 });
      return chat(Object.assign({}, options, { controller: controller, _wasmFallback: true }));
    } finally {
      if (activeController === controller) activeController = null;
    }
  }

  function abort() {
    if (!activeController) return false;
    try { activeController.abort(); } catch (_) {}
    activeController = null;
    return true;
  }
  async function resetForTests() {
    try { if (runtime) await runtime.exit(); } catch (_) {}
    runtime = null;
    runtimeForcedCpu = false;
    modulePromise = null;
    activeModel = null;
    activeModelId = '';
    initPromise = null;
    FILE_SESSION.clear();
    state = Object.assign({}, state, {
      status: 'idle', stage: 'Idle', progress: 0, cached: false, loaded: false,
      warmed: false, backend: '', downloadBytesPerSecond: 0, downloadEtaSeconds: null, error: '',
      compatibility: null, cacheEntries: null
    });
  }

  LF.BrowserLocal = {
    version: WLLAMA_VERSION, defaultModel: DEFAULT_MODEL, moduleUrl: MODULE_URL, wasmUrl: WASM_URL,
    state: getState, subscribe: subscribe, catalog: catalog, resolveModel: resolveModel, addModel: addModel,
    hasModel: hasModel,
    addModelFromFile: addModelFromFile, removeModelDefinition: removeModelDefinition,
    check: check, download: download, ensureReady: ensureReady,
    startup: startup, warmup: warmup, removeCached: removeCached, clearCache: clearCache, cachedModels: cachedModels,
    cacheInventory: cacheInventory, refreshCache: refreshCache, compatibility: compatibility, inspectGguf: inspectGguf,
    chat: chat, refreshStorageInfo: refreshStorageInfo, abort: abort, _resetForTests: resetForTests
  };
}());
