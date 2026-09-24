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
    bundled: true
  });

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
    error: '', note: '', checkedAt: 0
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
  function normalizeCustom(row) {
    row = row || {};
    const url = String(row.url || '').trim();
    if (!/^https?:\/\/.+\.gguf(?:$|[?#])/i.test(url)) return null;
    const file = String(row.file || url.split('/').pop().split(/[?#]/)[0] || 'model.gguf');
    const id = String(row.id || ('gguf_' + shortHash(url)));
    return { id: id, name: String(row.name || file.replace(/\.gguf$/i, '')), file: file, url: url, expectedBytes: Number(row.expectedBytes) || null, contextWindow: Math.max(2048, Math.min(16384, Number(row.contextWindow) || 4096)), bundled: false };
  }
  function catalog() {
    const custom = readCustom().map(normalizeCustom).filter(Boolean);
    return [DEFAULT_MODEL].concat(custom.filter(function (x) { return x.id !== DEFAULT_MODEL.id; }));
  }
  function resolveModel(id) { const key = String(id || DEFAULT_MODEL.id); return catalog().find(function (x) { return x.id === key; }) || DEFAULT_MODEL; }
  function addModel(url, name) {
    const row = normalizeCustom({ url: url, name: name }); if (!row) throw new Error('Enter a complete http(s) URL ending in .gguf.');
    const rows = readCustom().map(normalizeCustom).filter(Boolean).filter(function (x) { return x.url !== row.url; }); rows.push(row); writeCustom(rows); return row;
  }
  function removeModelDefinition(id) { const rows = readCustom().map(normalizeCustom).filter(Boolean).filter(function (x) { return x.id !== String(id); }); writeCustom(rows); }

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
    const model = resolveModel(modelId || (LF.Storage && LF.Storage.getAiSettings ? LF.Storage.getAiSettings().model : DEFAULT_MODEL.id));
    emit({ status: 'checking', stage: 'Checking model cache', modelId: model.id, modelName: model.name, error: '', progress: 0.05 });
    const instance = await ensureRuntime(false), cached = await cachedModel(instance, model), valid = !!(cached && cached.validate && cached.validate() === 'valid');
    activeModel = valid ? cached : null;
    emit({ status: valid ? 'cached' : 'not_installed', stage: valid ? 'Model cached' : 'Model not installed', cached: valid, loaded: instance.isModelLoaded ? instance.isModelLoaded() : false, modelBytes: valid ? cached.size : null, progress: valid ? 0.2 : 0, checkedAt: Date.now(), note: valid ? 'Ready to load from browser cache.' : 'The GGUF must be downloaded once before inference.' });
    await refreshStorageInfo(false);
    return getState();
  }
  async function download(modelId, options) {
    options = options || {}; const model = resolveModel(modelId), instance = await ensureRuntime(false);
    emit({ status: 'downloading', stage: 'Downloading GGUF', modelId: model.id, modelName: model.name, cached: false, error: '', progress: 0, downloadedBytes: 0, totalBytes: model.expectedBytes || 0 });
    const downloaded = await instance.modelManager.getModelOrDownload({ url: model.url }, { progressCallback: function (p) {
      const loaded = Math.max(0, Number(p && p.loaded) || 0), total = Math.max(0, Number(p && p.total) || model.expectedBytes || 0), progress = total ? loaded / total : 0;
      emit({ status: 'downloading', stage: 'Downloading GGUF', progress: Math.min(0.82, progress * 0.82), downloadedBytes: loaded, totalBytes: total });
      if (typeof options.onProgress === 'function') options.onProgress(getState());
    } });
    if (!downloaded || downloaded.validate() !== 'valid') throw new Error('The downloaded GGUF is incomplete or invalid.');
    activeModel = downloaded;
    emit({ status: 'cached', stage: 'Download complete', cached: true, modelBytes: downloaded.size, downloadedBytes: downloaded.size, totalBytes: downloaded.size, progress: 0.82 });
    await refreshStorageInfo(true);
    return downloaded;
  }
  async function loadModel(modelId, options) {
    options = options || {}; const model = resolveModel(modelId), preferGpu = options.preferWebGPU !== false;
    if (preferGpu && runtime && runtimeForcedCpu) {
      try { await runtime.exit(); } catch (_) {}
      runtime = await createRuntime(false);
    }
    let instance = await ensureRuntime(!preferGpu), cached = await cachedModel(instance, model);
    if (!cached || cached.validate() !== 'valid') throw new Error('The selected GGUF is not cached. Download it first.');
    emit({ status: 'loading', stage: 'Loading model', cached: true, modelId: model.id, modelName: model.name, progress: 0.86, error: '' });
    const nctx = Math.max(2048, Math.min(16384, Number(options.contextWindow) || model.contextWindow || 4096));
    async function doLoad(cpuOnly) {
      if (cpuOnly) instance = await ensureRuntime(true);
      cached = await cachedModel(instance, model);
      await instance.loadModel(cached, { n_ctx: nctx, n_gpu_layers: cpuOnly ? 0 : 99999, jinja: true });
      activeModel = cached; activeModelId = model.id;
      emit({ loaded: true, status: 'loaded', stage: 'Model loaded', backend: cpuOnly ? 'WASM CPU' : (state.webgpuAvailable ? 'WebGPU' : 'WASM CPU'), progress: 0.93, modelBytes: cached.size });
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
    options = options || {}; const s = settings(), modelId = options.modelId || s.model || DEFAULT_MODEL.id;
    if (initPromise && !options.force) return initPromise;
    initPromise = (async function () {
      try {
        const checked = await check(modelId); let cached = checked.cached;
        const saveData = typeof navigator !== 'undefined' && !!(navigator.connection && navigator.connection.saveData);
        const autoDownload = options.autoDownload != null ? !!options.autoDownload : s.browserLocalAutoDownload !== false;
        if (!cached) {
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
    const model = resolveModel(modelId), instance = await ensureRuntime(false), cached = await cachedModel(instance, model);
    if (runtime && runtime.isModelLoaded && runtime.isModelLoaded() && activeModelId === model.id) { await runtime.exit(); runtime = null; activeModelId = ''; activeModel = null; }
    if (cached) await cached.remove();
    emit({ status: 'not_installed', stage: 'Model removed', cached: false, loaded: false, warmed: false, modelBytes: null, progress: 0, backend: '', modelId: model.id, modelName: model.name });
    await refreshStorageInfo(false);
    return getState();
  }
  async function clearCache() {
    if (runtime && runtime.isModelLoaded && runtime.isModelLoaded()) await runtime.exit();
    runtime = null;
    runtimeForcedCpu = false;
    activeModel = null;
    activeModelId = '';
    const instance = await ensureRuntime(false);
    await instance.modelManager.clear();
    emit({ status: 'not_installed', stage: 'Model cache cleared', cached: false, loaded: false, warmed: false, modelBytes: null, progress: 0, backend: '' });
    await refreshStorageInfo(false);
  }
  async function cachedModels() {
    const instance = await ensureRuntime(false), models = await instance.modelManager.getModels({ includeInvalid: true });
    return models.map(function (m) { return { url: m.url, size: m.size, valid: m.validate() === 'valid', id: (catalog().find(function (x) { return x.url === m.url; }) || {}).id || '' }; });
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
    state = Object.assign({}, state, {
      status: 'idle', stage: 'Idle', progress: 0, cached: false, loaded: false,
      warmed: false, backend: '', error: ''
    });
  }

  LF.BrowserLocal = {
    version: WLLAMA_VERSION, defaultModel: DEFAULT_MODEL, moduleUrl: MODULE_URL, wasmUrl: WASM_URL,
    state: getState, subscribe: subscribe, catalog: catalog, resolveModel: resolveModel, addModel: addModel,
    removeModelDefinition: removeModelDefinition, check: check, download: download, ensureReady: ensureReady,
    startup: startup, warmup: warmup, removeCached: removeCached, clearCache: clearCache, cachedModels: cachedModels,
    chat: chat, refreshStorageInfo: refreshStorageInfo, abort: abort, _resetForTests: resetForTests
  };
}());
