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
    store: 'workspace',
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

  function getAiSettings() {
    const defaults = {
      provider: 'zai',
      endpoint: 'http://127.0.0.1:8099/zai/v1',
      model: 'glm-4.7-flash',
      temperature: 0.7,
      thinkingMode: 'auto',
      streaming: true,
      inactivityTimeoutMs: 90000,
      maxOutputTokensCap: 0
    };
    const out = Object.assign({}, defaults, read(LOCAL_KEYS.AI_SETTINGS, {}));
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

  function apiKeys() {
    const keys = read(LOCAL_KEYS.API_KEYS, {});
    return keys && typeof keys === 'object' && !Array.isArray(keys) ? keys : {};
  }

  function getApiKey(providerId) {
    try {
      const provider = String(providerId || getAiSettings().provider || 'zai');
      return String(apiKeys()[provider] || '');
    } catch (_error) {
      return '';
    }
  }

  function saveApiKey(key, providerId) {
    try {
      const provider = String(providerId || getAiSettings().provider || 'zai');
      const keys = apiKeys();
      if (key) keys[provider] = String(key);
      else delete keys[provider];
      const stored = write(LOCAL_KEYS.API_KEYS, keys);
      if (!stored) Log.warn('api-key.save-failed', { provider: provider });
      return stored;
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

  function getActionOverride(id) {
    const raw = actionOverrides()[id];
    if (!raw) return null;
    const current = actionSourceSignature(id);
    if (current && raw.sourceSignature !== current) return null;
    return clone(raw);
  }

  function saveActionOverride(id, override) {
    const all = actionOverrides();
    all[id] = Object.assign({}, all[id] || {}, clone(override || {}), {
      sourceSignature: actionSourceSignature(id),
      updatedAt: new Date().toISOString()
    });
    write(LOCAL_KEYS.ACTION_OVERRIDES, all);
    Log.info('action.override-saved', {
      actionId: id,
      hasDefinition: !!(override && override.definition),
      hasPrompt: override && typeof override.prompt === 'string'
    });
    return getActionOverride(id);
  }

  function resetActionOverride(id) {
    const all = actionOverrides();
    delete all[id];
    write(LOCAL_KEYS.ACTION_OVERRIDES, all);
    Log.info('action.override-reset', { actionId: id });
  }

  function getEffectiveAction(id) {
    const base = LF.ActionRegistry && LF.ActionRegistry.action
      ? LF.ActionRegistry.action(id)
      : null;
    const override = getActionOverride(id);
    if (!base) return null;
    if (!override || !override.definition) return base;

    const custom = clone(override.definition);
    const merged = Object.assign({}, base, custom, { id: base.id });
    merged.contract = Object.assign({}, base.contract || {}, custom.contract || {});
    merged.execution = Object.assign({}, base.execution || {}, custom.execution || {});

    const customSteps = custom.execution && custom.execution.steps;
    const baseSteps = base.execution && base.execution.steps || [];
    if (Array.isArray(customSteps)) {
      const baseById = {};
      baseSteps.forEach(function (step) {
        if (step && step.id) baseById[step.id] = step;
      });
      merged.execution.steps = customSteps.map(function (step) {
        const source = step && step.id && baseById[step.id] || {};
        return Object.assign({}, source, step || {});
      });
    }
    return merged;
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

  function getNomadToken() {
    return String(read(LOCAL_KEYS.NOMAD_TOKEN, '') || '');
  }

  function saveNomadToken(token) {
    const value = String(token || '');
    const ok = write(LOCAL_KEYS.NOMAD_TOKEN, value);
    if (ok) Log.info('nomad-token.saved', { configured: !!value });
    return ok;
  }

  function db() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB is unavailable in this browser.'));
        return;
      }
      const request = indexedDB.open(WORKSPACE_DB.name);
      request.onupgradeneeded = function () {
        const database = request.result;
        if (!database.objectStoreNames.contains(WORKSPACE_DB.store)) {
          database.createObjectStore(WORKSPACE_DB.store);
        }
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () {
        reject(request.error || new Error('Could not open LabFlow workspace storage.'));
      };
    });
  }

  async function saveExperiment(exp, ui) {
    if (!LF.DataModel || !LF.DataModel.serialize) {
      throw new Error('LabFlow.DataModel must be loaded before saving a workspace.');
    }
    const database = await db();
    return new Promise(function (resolve, reject) {
      const transaction = database.transaction(WORKSPACE_DB.store, 'readwrite');
      const store = transaction.objectStore(WORKSPACE_DB.store);
      const payload = {
        savedAt: new Date().toISOString(),
        experiment: LF.DataModel.serialize(exp),
        ui: {
          route: ui && ui.route || 'experiment-import',
          resultsTab: ui && ui.resultsTab || 'overview',
          selectedMeasurementId: ui && ui.selectedMeasurementId || null,
          selectedDesignDeviceId: ui && ui.selectedDesignDeviceId || null
        }
      };
      store.put(payload, WORKSPACE_DB.key);
      transaction.oncomplete = function () {
        database.close();
        resolve(payload);
      };
      transaction.onerror = function () {
        const error = transaction.error || new Error('Could not save the LabFlow workspace.');
        database.close();
        reject(error);
      };
    });
  }

  async function loadExperiment() {
    try {
      const database = await db();
      return await new Promise(function (resolve, reject) {
        const transaction = database.transaction(WORKSPACE_DB.store, 'readonly');
        const request = transaction.objectStore(WORKSPACE_DB.store).get(WORKSPACE_DB.key);
        request.onsuccess = function () {
          const value = request.result || null;
          database.close();
          resolve(value);
        };
        request.onerror = function () {
          const error = request.error || new Error('Could not read saved LabFlow workspace.');
          database.close();
          reject(error);
        };
      });
    } catch (error) {
      Log.warn('workspace.load-failed', { error: error });
      return null;
    }
  }

  async function clearSavedExperiment() {
    try {
      const database = await db();
      return await new Promise(function (resolve, reject) {
        const transaction = database.transaction(WORKSPACE_DB.store, 'readwrite');
        transaction.objectStore(WORKSPACE_DB.store).delete(WORKSPACE_DB.key);
        transaction.oncomplete = function () {
          database.close();
          resolve(true);
        };
        transaction.onerror = function () {
          const error = transaction.error || new Error('Could not clear saved LabFlow workspace.');
          database.close();
          reject(error);
        };
      });
    } catch (error) {
      Log.warn('workspace.clear-failed', { error: error });
      return false;
    }
  }

  LF.Storage = {
    keys: LOCAL_KEYS,
    getAiSettings: getAiSettings,
    saveAiSettings: saveAiSettings,
    getAssistantSettings: getAssistantSettings,
    saveAssistantSettings: saveAssistantSettings,
    getApiKey: getApiKey,
    saveApiKey: saveApiKey,
    getActionOverride: getActionOverride,
    saveActionOverride: saveActionOverride,
    resetActionOverride: resetActionOverride,
    getEffectiveAction: getEffectiveAction,
    getEffectivePrompt: getEffectivePrompt,
    getUserProfile: getUserProfile,
    saveUserProfile: saveUserProfile,
    getUiSettings: getUiSettings,
    saveUiSettings: saveUiSettings,
    getExportSettings: getExportSettings,
    saveExportSettings: saveExportSettings,
    getNomadSettings: getNomadSettings,
    saveNomadSettings: saveNomadSettings,
    getNomadToken: getNomadToken,
    saveNomadToken: saveNomadToken,
    getCabinetState: getCabinetState,
    saveCabinetState: saveCabinetState,
    getKnowledgeState: getKnowledgeState,
    saveKnowledgeState: saveKnowledgeState,
    saveExperiment: saveExperiment,
    loadExperiment: loadExperiment,
    clearSavedExperiment: clearSavedExperiment
  };
}());
