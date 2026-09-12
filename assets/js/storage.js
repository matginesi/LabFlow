(function () {
  'use strict';

  const LF = window.LabFlow = window.LabFlow || {};
  if (!LF.Logger) throw new Error('LabFlow.Logger must be loaded before storage.js.');

  const Log = LF.Logger.scope('storage');

  /*
   * Storage owns browser persistence only. Scientific structure remains owned
   * by DomainSchema/DataModel; feature modules should use these named methods
   * instead of reading or writing localStorage/IndexedDB directly.
   */
  const LOCAL_KEYS = Object.freeze({
    AI_SETTINGS: 'labflow.ai.settings',
    ASSISTANT_SETTINGS: 'labflow.assistant.settings',
    API_KEYS: 'labflow.ai.keys',
    ACTION_OVERRIDES: 'labflow.action.overrides',
    USER_PROFILE: 'labflow.user.profile',
    UI_SETTINGS: 'labflow.ui.settings',
    EXPORT_SETTINGS: 'labflow.export.settings',
    CABINET: 'labflow.cabinet',
    KNOWLEDGE: 'labflow.knowledge',
    NOMAD_SETTINGS: 'labflow.nomad.settings',
    NOMAD_TOKEN: 'labflow.nomad.token'
  });

  const WORKSPACE_DB = Object.freeze({
    name: 'labflow.workspace.current',
    version: 2,
    store: 'workspace',
    rawStore: 'rawArchives',
    key: 'current'
  });

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      Log.warn('local.read-failed', { key: key, error: error });
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      Log.warn('local.write-failed', { key: key, error: error });
      return false;
    }
  }

  function sessionRead(key, fallback) {
    try {
      if (!window.sessionStorage) return fallback;
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      Log.warn('session.read-failed', { key: key, error: error });
      return fallback;
    }
  }

  function sessionWrite(key, value) {
    try {
      if (!window.sessionStorage) return false;
      sessionStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      Log.warn('session.write-failed', { key: key, error: error });
      return false;
    }
  }

  function endpointOrigin(value) {
    try { return new URL(String(value || ''), window.location && window.location.href || 'https://labflow.invalid/').origin; }
    catch (_error) { return ''; }
  }

  function providerEndpoint(providerId) {
    const provider = LF.AIProviders && LF.AIProviders[String(providerId || '')];
    return provider && provider.endpoint || '';
  }

  function credentialMap(key, persistent) {
    const value = persistent ? read(key, {}) : sessionRead(key, {});
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function getAiSettings() {
    const defaults = {
      provider: 'openrouter',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      model: 'openrouter/free',
      temperature: 0.7,
      thinkingMode: 'auto',
      streaming: true,
      inactivityTimeoutMs: 90000,
      maxOutputTokensCap: 0
    };
    const out = Object.assign({}, defaults, read(LOCAL_KEYS.AI_SETTINGS, {}));
    if (LF.AIProviders && !LF.AIProviders[out.provider]) {
      out.provider = defaults.provider;
      out.endpoint = defaults.endpoint;
      out.model = defaults.model;
    }
    out.endpoint = String(out.endpoint || '').replace(
      /\/chat\/completions(?:\/chat\/completions)+\/?$/i,
      '/chat/completions'
    );
    out.model = String(out.model || '').trim();
    out.thinkingMode = ['auto', 'off', 'on'].includes(out.thinkingMode)
      ? out.thinkingMode
      : 'auto';
    out.streaming = out.streaming !== false;
    out.inactivityTimeoutMs = Math.max(
      15000,
      Math.min(600000, Number(out.inactivityTimeoutMs) || 90000)
    );
    out.maxOutputTokensCap = Math.max(
      0,
      Math.min(1048576, Number(out.maxOutputTokensCap) || 0)
    );
    return out;
  }

  function saveAiSettings(value) {
    write(LOCAL_KEYS.AI_SETTINGS, value);
    Log.info('ai-settings.saved', {
      provider: value && value.provider,
      model: value && value.model
    });
  }

  function getAssistantSettings() {
    const defaults = {
      memoryEnabled: true,
      memoryTurns: 6,
      memoryChars: 6000,
      messageChars: 1800,
      contextChars: 12000,
      maxOutputTokens: 0,
      temperature: 0.4
    };
    const out = Object.assign(
      {},
      defaults,
      read(LOCAL_KEYS.ASSISTANT_SETTINGS, {})
    );
    out.memoryEnabled = out.memoryEnabled !== false;
    out.memoryTurns = Math.max(0, Math.min(20, Number(out.memoryTurns) || 0));
    out.memoryChars = Math.max(
      500,
      Math.min(32000, Number(out.memoryChars) || defaults.memoryChars)
    );
    out.messageChars = Math.max(
      250,
      Math.min(8000, Number(out.messageChars) || defaults.messageChars)
    );
    out.contextChars = Math.max(
      2000,
      Math.min(48000, Number(out.contextChars) || defaults.contextChars)
    );
    out.maxOutputTokens = Math.max(
      0,
      Math.min(1048576, Number(out.maxOutputTokens) || 0)
    );
    out.temperature = Math.max(0, Math.min(2, Number(out.temperature)));
    if (!Number.isFinite(out.temperature)) out.temperature = defaults.temperature;
    return out;
  }

  function saveAssistantSettings(value) {
    const next = Object.assign({}, getAssistantSettings(), value || {});
    write(LOCAL_KEYS.ASSISTANT_SETTINGS, next);
    return getAssistantSettings();
  }

  function apiKeys(persistent) {
    return credentialMap(LOCAL_KEYS.API_KEYS, persistent !== false);
  }

  function apiCredentialId(providerId, endpoint) {
    const provider = String(providerId || getAiSettings().provider || 'openrouter');
    const origin = endpointOrigin(endpoint || getAiSettings().endpoint || providerEndpoint(provider));
    return provider + '|' + (origin || 'no-origin');
  }

  function getApiKey(providerId, endpoint) {
    try {
      const provider = String(providerId || getAiSettings().provider || 'openrouter');
      const target = endpoint || getAiSettings().endpoint || providerEndpoint(provider);
      const id = apiCredentialId(provider, target);
      const session = apiKeys(false), persistent = apiKeys(true);
      if (session[id]) return String(session[id]);
      if (persistent[id]) return String(persistent[id]);
      /* One-time compatibility for pre-r7 provider-only keys, but never reuse
         one against a custom host. */
      const legacy = persistent[provider];
      if (legacy && endpointOrigin(target) && endpointOrigin(target) === endpointOrigin(providerEndpoint(provider))) return String(legacy);
      return '';
    } catch (_error) { return ''; }
  }

  function isApiKeyRemembered(providerId, endpoint) {
    const provider = String(providerId || getAiSettings().provider || 'openrouter');
    const target = endpoint || getAiSettings().endpoint || providerEndpoint(provider);
    const persistent = apiKeys(true), id = apiCredentialId(provider, target);
    return !!(persistent[id] || (persistent[provider] && endpointOrigin(target) === endpointOrigin(providerEndpoint(provider))));
  }

  function saveApiKey(key, providerId, options) {
    try {
      options = options || {};
      const provider = String(providerId || getAiSettings().provider || 'openrouter');
      const endpoint = options.endpoint || getAiSettings().endpoint || providerEndpoint(provider);
      const id = apiCredentialId(provider, endpoint), value = String(key || ''), remember = options.remember === true;
      const persistent = apiKeys(true), session = apiKeys(false);
      delete persistent[provider];
      if (!value) { delete persistent[id]; delete session[id]; }
      else if (remember) { persistent[id] = value; delete session[id]; }
      else { session[id] = value; delete persistent[id]; }
      const localOk = write(LOCAL_KEYS.API_KEYS, persistent);
      const sessionOk = sessionWrite(LOCAL_KEYS.API_KEYS, session);
      if (localOk && (!value || remember || sessionOk)) Log.info('api-key.saved', { provider: provider, remember: remember, origin: endpointOrigin(endpoint) });
      return localOk && (!value || remember || sessionOk);
    } catch (error) {
      Log.warn('api-key.save-failed', { error: error });
      return false;
    }
  }


  /*
   * Browser-local Action overrides are valid only for the source contract they
   * were edited from. A changed action.json/prompt invalidates the override;
   * there is no migration path between Action definitions.
   */
  function actionOverrides() {
    const current = read(LOCAL_KEYS.ACTION_OVERRIDES, {});
    return current && typeof current === 'object' && !Array.isArray(current)
      ? current
      : {};
  }

  function hashText(value) {
    let hash = 2166136261;
    const text = String(value || '');
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
  }

  function actionSourceSignature(id) {
    if (!LF.ActionRegistry || !LF.ActionRegistry.action) return '';
    const base = LF.ActionRegistry.action(id);
    if (!base) return '';
    const prompt = LF.ActionRegistry.prompt ? LF.ActionRegistry.prompt(id) : '';
    return hashText(JSON.stringify(base) + '\n' + String(prompt || ''));
  }

  const ACTION_EDITABLE_TOP = ['title', 'short_title', 'purpose', 'strategy'];
  const ACTION_EDITABLE_STEP = ['weight', 'thinking', 'timeout_ms', 'deadline_ms', 'max_retries', 'min_output_tokens', 'target_output_tokens', 'max_output_tokens', 'max_input_tokens'];
  const ACTION_LOCKED_STEP = ['id', 'type', 'tool', 'fn', 'prompt', 'output', 'schema', 'foreach', 'validate_with', 'provider_schema', 'capture_result'];

  function sameJson(a, b) { return JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b); }
  function actionValidationError(message) { const error = new Error(message); error.code = 'ACTION_OVERRIDE_INVALID'; return error; }

  function validateActionOverride(id, override) {
    const base = LF.ActionRegistry && LF.ActionRegistry.action ? LF.ActionRegistry.action(id) : null;
    if (!base) throw actionValidationError('Unknown Action: ' + id);
    const payload = override && typeof override === 'object' ? override : {};
    const def = payload.definition && typeof payload.definition === 'object' ? payload.definition : {};
    if (def.id != null && String(def.id) !== String(id)) throw actionValidationError('The Action ID is locked.');
    ['category','role','visibility','contract'].forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(def, key) && !sameJson(def[key], base[key])) throw actionValidationError(key + ' is part of the locked scientific contract.');
    });
    if (def.execution) {
      const baseExecution = base.execution || {}, customExecution = def.execution || {};
      if (Object.prototype.hasOwnProperty.call(customExecution, 'mode') && !sameJson(customExecution.mode, baseExecution.mode)) throw actionValidationError('Execution mode is locked.');
      const baseSteps = Array.isArray(baseExecution.steps) ? baseExecution.steps : [];
      const customSteps = Array.isArray(customExecution.steps) ? customExecution.steps : [];
      if (customSteps.length && customSteps.length !== baseSteps.length) throw actionValidationError('Execution steps cannot be added or removed.');
      customSteps.forEach(function (step, index) {
        const source = baseSteps[index] || {};
        ACTION_LOCKED_STEP.forEach(function (key) {
          if (Object.prototype.hasOwnProperty.call(step || {}, key) && !sameJson(step[key], source[key])) throw actionValidationError('Step ' + (source.id || index + 1) + ': ' + key + ' is locked.');
        });
        if (step && step.thinking != null && !['auto','on','off'].includes(String(step.thinking))) throw actionValidationError('Thinking must be auto, on or off.');
        ['max_retries','min_output_tokens','target_output_tokens','max_output_tokens','max_input_tokens','timeout_ms','deadline_ms'].forEach(function (key) {
          if (step && step[key] != null && (!Number.isFinite(Number(step[key])) || Number(step[key]) < 0)) throw actionValidationError('Step ' + (source.id || index + 1) + ': ' + key + ' must be a non-negative number.');
        });
        if (step && step.max_retries != null && Number(step.max_retries) > 8) throw actionValidationError('Retries are capped at 8.');
        if (step && step.max_output_tokens != null && step.target_output_tokens != null && Number(step.target_output_tokens) > Number(step.max_output_tokens)) throw actionValidationError('Target output cannot exceed the maximum output.');
        if (step && step.min_output_tokens != null && step.target_output_tokens != null && Number(step.min_output_tokens) > Number(step.target_output_tokens)) throw actionValidationError('Minimum output cannot exceed the target output.');
      });
    }
    if (payload.prompt != null && typeof payload.prompt !== 'string') throw actionValidationError('Prompt must be text.');
    if (typeof payload.prompt === 'string' && payload.prompt.length > 120000) throw actionValidationError('Prompt is too large.');
    return { ok: true, actionId: id };
  }

  function safeActionDefinition(id, definition) {
    const base = LF.ActionRegistry && LF.ActionRegistry.action ? LF.ActionRegistry.action(id) : null;
    if (!base) return null;
    const custom = definition && typeof definition === 'object' ? definition : {};
    const out = clone(base);
    ACTION_EDITABLE_TOP.forEach(function (key) { if (Object.prototype.hasOwnProperty.call(custom, key)) out[key] = clone(custom[key]); });
    const baseSteps = out.execution && Array.isArray(out.execution.steps) ? out.execution.steps : [];
    const customSteps = custom.execution && Array.isArray(custom.execution.steps) ? custom.execution.steps : [];
    customSteps.forEach(function (step, index) {
      if (!baseSteps[index] || !step || typeof step !== 'object') return;
      ACTION_EDITABLE_STEP.forEach(function (key) { if (Object.prototype.hasOwnProperty.call(step, key)) baseSteps[index][key] = clone(step[key]); });
    });
    return out;
  }

  function getActionOverride(id) {
    const raw = actionOverrides()[id];
    if (!raw) return null;
    const current = actionSourceSignature(id);
    if (current && raw.sourceSignature !== current) return null;
    try { validateActionOverride(id, raw); }
    catch (error) { Log.warn('action.override-rejected', { actionId: id, error: error }); return null; }
    return clone(raw);
  }

  function saveActionOverride(id, override) {
    validateActionOverride(id, override || {});
    const clean = clone(override || {});
    if (clean.definition) clean.definition = safeActionDefinition(id, clean.definition);
    const all = actionOverrides();
    all[id] = Object.assign({}, clean, { sourceSignature: actionSourceSignature(id), updatedAt: new Date().toISOString() });
    write(LOCAL_KEYS.ACTION_OVERRIDES, all);
    Log.info('action.override-saved', { actionId: id, hasDefinition: !!clean.definition, hasPrompt: typeof clean.prompt === 'string' });
    return getActionOverride(id);
  }

  function resetActionOverride(id) {
    const all = actionOverrides(); delete all[id]; write(LOCAL_KEYS.ACTION_OVERRIDES, all); Log.info('action.override-reset', { actionId: id });
  }

  function getEffectiveAction(id) {
    const base = LF.ActionRegistry && LF.ActionRegistry.action ? LF.ActionRegistry.action(id) : null;
    const override = getActionOverride(id);
    if (!base) return null;
    return override && override.definition ? safeActionDefinition(id, override.definition) : base;
  }


  function getEffectivePrompt(id) {
    const override = getActionOverride(id);
    if (override && typeof override.prompt === 'string') return override.prompt;
    return LF.ActionRegistry && LF.ActionRegistry.prompt
      ? LF.ActionRegistry.prompt(id)
      : '';
  }

  function getUserProfile() {
    return Object.assign(
      { name: '', organization: '', email: '' },
      read(LOCAL_KEYS.USER_PROFILE, {})
    );
  }

  function saveUserProfile(value) {
    write(LOCAL_KEYS.USER_PROFILE, Object.assign({}, getUserProfile(), value || {}));
  }

  function getUiSettings() {
    return Object.assign(
      { assistantOpen: false, theme: 'instrument' },
      read(LOCAL_KEYS.UI_SETTINGS, {})
    );
  }

  function saveUiSettings(value) {
    write(LOCAL_KEYS.UI_SETTINGS, Object.assign({}, getUiSettings(), value || {}));
  }

  function getCabinetState() {
    const raw = read(LOCAL_KEYS.CABINET, { items: [], updatedAt: null });
    return raw && typeof raw === 'object' && !Array.isArray(raw)
      ? clone(raw)
      : { items: [], updatedAt: null };
  }

  function saveCabinetState(value) {
    const payload = clone(value && typeof value === 'object' ? value : { items: [] }) || { items: [] };
    payload.items = Array.isArray(payload.items) ? payload.items : [];
    payload.updatedAt = new Date().toISOString();
    const ok = write(LOCAL_KEYS.CABINET, payload);
    if (ok) Log.info('cabinet.saved', { items: payload.items.length });
    return ok;
  }

  /* Custom Knowledge Base persistence is exactly JSONL: one object per line. */
  function parseKnowledgeJsonl(raw) {
    const text = String(raw || '').trim();
    if (!text) return { entries: [] };

    const entries = [];
    text.split(/\r?\n/).forEach(function (line, index) {
      const value = line.trim();
      if (!value) return;
      try {
        const item = JSON.parse(value);
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          throw new Error('line must be a JSON object');
        }
        entries.push(item);
      } catch (error) {
        throw new Error(
          'Invalid Knowledge Base JSONL at line ' +
          (index + 1) + ': ' +
          (error.message || String(error))
        );
      }
    });
    return { entries: entries };
  }

  function knowledgeJsonl(entries) {
    return (Array.isArray(entries) ? entries : [])
      .map(function (item) { return JSON.stringify(item); })
      .join('\n');
  }

  function getKnowledgeState() {
    try {
      const raw = localStorage.getItem(LOCAL_KEYS.KNOWLEDGE);
      return {
        entries: clone(parseKnowledgeJsonl(raw).entries),
        format: 'jsonl'
      };
    } catch (error) {
      Log.warn('knowledge.read-failed', {
        key: LOCAL_KEYS.KNOWLEDGE,
        error: error
      });
      return { entries: [], format: 'jsonl' };
    }
  }

  function saveKnowledgeState(value) {
    const payload = clone(
      value && typeof value === 'object' ? value : { entries: [] }
    ) || { entries: [] };
    const entries = Array.isArray(payload.entries) ? payload.entries : [];
    try {
      localStorage.setItem(LOCAL_KEYS.KNOWLEDGE, knowledgeJsonl(entries));
      Log.info('knowledge.saved', { entries: entries.length, format: 'jsonl' });
      return true;
    } catch (error) {
      Log.warn('knowledge.write-failed', {
        key: LOCAL_KEYS.KNOWLEDGE,
        error: error
      });
      return false;
    }
  }

  function getExportSettings() {
    const raw = read(LOCAL_KEYS.EXPORT_SETTINGS, {});
    return {
      includeRaw: raw.includeRaw !== false,
      includeDerived: raw.includeDerived !== false
    };
  }

  function saveExportSettings(value) {
    write(LOCAL_KEYS.EXPORT_SETTINGS, value);
  }

  function getNomadSettings() {
    const defaults = {
      instance: 'NOMAD Central',
      webUrl: 'https://nomad-lab.eu/prod/v1/gui/',
      apiEndpoint: 'https://nomad-lab.eu/prod/v1/api/v1',
      username: ''
    };
    const out = Object.assign(
      {},
      defaults,
      read(LOCAL_KEYS.NOMAD_SETTINGS, {})
    );
    ['instance', 'webUrl', 'apiEndpoint', 'username'].forEach(function (key) {
      out[key] = String(out[key] || '').trim();
    });
    return out;
  }

  function saveNomadSettings(value) {
    const next = Object.assign({}, getNomadSettings(), value || {});
    write(LOCAL_KEYS.NOMAD_SETTINGS, next);
    Log.info('nomad-settings.saved', {
      instance: next.instance,
      apiEndpoint: next.apiEndpoint,
      hasUsername: !!next.username
    });
    return getNomadSettings();
  }

  function nomadCredentialId(endpoint) {
    return 'nomad|' + (endpointOrigin(endpoint || getNomadSettings().apiEndpoint) || 'no-origin');
  }

  function nomadTokens(persistent) {
    const value = persistent !== false ? read(LOCAL_KEYS.NOMAD_TOKEN, {}) : sessionRead(LOCAL_KEYS.NOMAD_TOKEN, {});
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    if (persistent !== false && typeof value === 'string' && value) return { __legacy: value };
    return {};
  }

  function getNomadToken(endpoint) {
    const target = endpoint || getNomadSettings().apiEndpoint, id = nomadCredentialId(target);
    const session = nomadTokens(false), persistent = nomadTokens(true);
    if (session[id]) return String(session[id]);
    if (persistent[id]) return String(persistent[id]);
    /* Legacy token is used only for the exact saved destination. */
    const legacy = typeof persistent === 'object' ? persistent.__legacy : '';
    const savedOrigin = endpointOrigin(getNomadSettings().apiEndpoint);
    return legacy && savedOrigin && savedOrigin === endpointOrigin(target) ? String(legacy) : '';
  }

  function isNomadTokenRemembered(endpoint) {
    const id = nomadCredentialId(endpoint || getNomadSettings().apiEndpoint);
    return !!nomadTokens(true)[id];
  }

  function saveNomadToken(token, options) {
    options = options || {};
    const endpoint = options.endpoint || getNomadSettings().apiEndpoint, id = nomadCredentialId(endpoint);
    const value = String(token || ''), remember = options.remember === true;
    const persistent = nomadTokens(true), session = nomadTokens(false);
    delete persistent.__legacy;
    if (!value) { delete persistent[id]; delete session[id]; }
    else if (remember) { persistent[id] = value; delete session[id]; }
    else { session[id] = value; delete persistent[id]; }
    const localOk = write(LOCAL_KEYS.NOMAD_TOKEN, persistent), sessionOk = sessionWrite(LOCAL_KEYS.NOMAD_TOKEN, session);
    if (localOk && (!value || remember || sessionOk)) Log.info('nomad-token.saved', { configured: !!value, remember: remember, origin: endpointOrigin(endpoint) });
    return localOk && (!value || remember || sessionOk);
  }


  function db() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('IndexedDB is unavailable in this browser.')); return; }
      const request = indexedDB.open(WORKSPACE_DB.name, WORKSPACE_DB.version);
      request.onupgradeneeded = function () {
        const database = request.result;
        if (!database.objectStoreNames.contains(WORKSPACE_DB.store)) database.createObjectStore(WORKSPACE_DB.store);
        if (!database.objectStoreNames.contains(WORKSPACE_DB.rawStore)) database.createObjectStore(WORKSPACE_DB.rawStore);
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error('Could not open LabFlow workspace storage.')); };
    });
  }

  function rawReference(exp) {
    const raw = exp && exp.raw || {};
    return String(raw.sha256 || (exp && exp.id ? 'experiment:' + exp.id : '') || raw.sourceName || 'source');
  }

  async function saveExperiment(exp, ui) {
    if (!LF.DataModel || !LF.DataModel.serialize) throw new Error('LabFlow.DataModel must be loaded before saving a workspace.');
    const database = await db(), raw = exp && exp.raw || {}, rawRef = raw.sourceArchive instanceof ArrayBuffer && raw.sourceArchive.byteLength ? rawReference(exp) : '';
    return new Promise(function (resolve, reject) {
      const transaction = database.transaction([WORKSPACE_DB.store, WORKSPACE_DB.rawStore], 'readwrite');
      const workspace = transaction.objectStore(WORKSPACE_DB.store), rawStore = transaction.objectStore(WORKSPACE_DB.rawStore);
      const payload = { savedAt: new Date().toISOString(), rawRef: rawRef, experiment: LF.DataModel.serialize(exp, { includeSourceArchive: false }), ui: { route: ui && ui.route || 'experiment-import', resultsTab: ui && ui.resultsTab || 'overview', selectedMeasurementId: ui && ui.selectedMeasurementId || null, selectedDesignDeviceId: ui && ui.selectedDesignDeviceId || null } };
      workspace.put(payload, WORKSPACE_DB.key);
      if (rawRef) {
        const existing = rawStore.get(rawRef);
        existing.onsuccess = function () { if (!existing.result) rawStore.put(raw.sourceArchive, rawRef); };
      }
      transaction.oncomplete = function () { database.close(); resolve(payload); };
      transaction.onerror = function () { const error = transaction.error || new Error('Could not save the LabFlow workspace.'); database.close(); reject(error); };
    });
  }

  async function loadExperiment() {
    try {
      const database = await db();
      return await new Promise(function (resolve, reject) {
        const transaction = database.transaction([WORKSPACE_DB.store, WORKSPACE_DB.rawStore], 'readonly');
        const workspace = transaction.objectStore(WORKSPACE_DB.store), rawStore = transaction.objectStore(WORKSPACE_DB.rawStore);
        const request = workspace.get(WORKSPACE_DB.key); let value = null;
        request.onsuccess = function () {
          value = request.result || null;
          if (!value || !value.rawRef || !value.experiment) return;
          const rawRequest = rawStore.get(value.rawRef);
          rawRequest.onsuccess = function () { value.experiment.raw = value.experiment.raw || {}; value.experiment.raw.sourceArchive = rawRequest.result || null; };
        };
        transaction.oncomplete = function () { database.close(); resolve(value); };
        transaction.onerror = function () { const error = transaction.error || new Error('Could not read saved LabFlow workspace.'); database.close(); reject(error); };
      });
    } catch (error) { Log.warn('workspace.load-failed', { error: error }); return null; }
  }

  async function clearSavedExperiment() {
    try {
      const database = await db();
      return await new Promise(function (resolve, reject) {
        const transaction = database.transaction([WORKSPACE_DB.store, WORKSPACE_DB.rawStore], 'readwrite');
        transaction.objectStore(WORKSPACE_DB.store).clear();
        transaction.objectStore(WORKSPACE_DB.rawStore).clear();
        transaction.oncomplete = function () { database.close(); resolve(true); };
        transaction.onerror = function () { const error = transaction.error || new Error('Could not clear saved LabFlow workspace.'); database.close(); reject(error); };
      });
    } catch (error) { Log.warn('workspace.clear-failed', { error: error }); return false; }
  }

  function clearPrefixedStorage(storage) {
    if (!storage) return;
    const remove = [];
    for (let i = 0; i < storage.length; i++) { const key = storage.key(i); if (key && /^labflow\./.test(key)) remove.push(key); }
    remove.forEach(function (key) { storage.removeItem(key); });
  }

  async function clearAllLocalData() {
    const workspaceCleared = await clearSavedExperiment();
    try { clearPrefixedStorage(window.localStorage); clearPrefixedStorage(window.sessionStorage); }
    catch (error) { Log.warn('storage.clear-local-failed', { error: error }); }
    Log.info('storage.cleared', { workspace: workspaceCleared });
    return workspaceCleared;
  }


  LF.Storage = {
    keys: LOCAL_KEYS,
    getAiSettings: getAiSettings, saveAiSettings: saveAiSettings,
    getAssistantSettings: getAssistantSettings, saveAssistantSettings: saveAssistantSettings,
    getApiKey: getApiKey, isApiKeyRemembered: isApiKeyRemembered, saveApiKey: saveApiKey,
    getActionOverride: getActionOverride, validateActionOverride: validateActionOverride, saveActionOverride: saveActionOverride, resetActionOverride: resetActionOverride,
    getEffectiveAction: getEffectiveAction, getEffectivePrompt: getEffectivePrompt,
    getUserProfile: getUserProfile, saveUserProfile: saveUserProfile,
    getUiSettings: getUiSettings, saveUiSettings: saveUiSettings,
    getExportSettings: getExportSettings, saveExportSettings: saveExportSettings,
    getNomadSettings: getNomadSettings, saveNomadSettings: saveNomadSettings,
    getNomadToken: getNomadToken, isNomadTokenRemembered: isNomadTokenRemembered, saveNomadToken: saveNomadToken,
    getCabinetState: getCabinetState, saveCabinetState: saveCabinetState,
    getKnowledgeState: getKnowledgeState, saveKnowledgeState: saveKnowledgeState,
    saveExperiment: saveExperiment, loadExperiment: loadExperiment, clearSavedExperiment: clearSavedExperiment, clearAllLocalData: clearAllLocalData
  };
}());
