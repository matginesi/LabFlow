(function () {
  'use strict';
  const LF = window.LabFlow = window.LabFlow || {};
  const Log = LF.Logger.scope('state');

  /*
   * One app-wide in-memory state object. The experiment slot holds the single
   * canonical ExperimentData. Scientific collections and documents live on
   * that object; `experiment.derived` is reserved for transient Action history
   * and chat. Route and selection state live under `ui`. `actionRun`
   * records the one active workflow so navigation/abort/staleness checks
   * never start a second request behind the user's back.
   */
  function nowIso() { return new Date().toISOString(); }

  function emptyExperiment() {
    if (LF.DataModel && LF.DataModel.create) return LF.DataModel.create({ sourceName: '' });
    return {
      id: null,
      meta: { name: 'Untitled experiment', createdAt: null, modifiedAt: null, sourceName: '', sourceSize: 0 },
      raw: { sourceName: '', sha256: '', sourceArchive: null },
      files: [], blocks: [], patches: [], manifest: [], rawFormatEvidence: [], auxiliaryEvidence: [], experiments: [], samples: [], runs: [], measurements: [], findings: [],
      analysisSettings: { mismatchFactor: 1 }, analysis: { summary: {}, bestBySample: [], bestByExperiment: [], topNonRef: [], topRef: [] },
      design: { status: 'unknown', solutions: [], process: { coating: '', annealing: '', atmosphere: '', notes: '' }, stack: [], devices: [] }, nomad: {}, interpretationOverrides: {},
      sync: { revision: 0, lastChange: null, pendingScopes: [] },
      derived: {}
    };
  }

  function defaultUiState() {
    return {
      route: 'experiment-import',
      uploadLanding: false,
      assistantOpen: false,
      resultsTab: 'overview',
      resultsDataMode: 'all',
      resultsJvMode: 'single',
      resultsOverviewMetric: 'eff',
      resultsOverviewDirection: 'best',
      resultsOverviewStatistic: 'median',
      selectedMeasurementId: null,
      curveSelection: [],
      curveOverlaySelection: [],
      curveView: 'all',
      curveGroup: 'all',
      curveDirection: 'both',
      curveEligibleOnly: false,
      curveSearch: '',
      curveZoom: 1,
      pceDistributionZoom: 1,
      selectedDesignDeviceId: null,
      resultInspectorId: null,
      cabinetKind: 'all',
      cabinetQuery: '',
      cabinetSelectedId: null,
      designCabinetPicker: '',
      uiKitQuery: '',
      uiKitFilter: 'all',
      boxPlot: { metric: 'eff', direction: 'both', groups: [], eligibleOnly: true, experimentId: null },
      settingsSection: 'provider',
      settingsActionId: 'dataset.resolve-ambiguities',
      settingsKnowledgeId: '',
      settingsKnowledgeQuery: '',
      settingsKnowledgeKind: 'all',
      docsSlug: 'guides--getting-started',
      docsQuery: '',
      docsSection: 'all',
      logFilters: { level: 'all', category: 'all', query: '', scope: 'all' },
      pageContext: { page: '', view: '', selected: {}, filters: {}, visible: [] }
    };
  }

  const state = {
    user: { name: '', organization: '', email: '' },
    workspace: { theme: 'instrument' },
    project: {},
    experiment: emptyExperiment(),
    actionRun: null,
    ui: defaultUiState()
  };

  Object.defineProperty(state, 'route', {
    configurable: true,
    enumerable: false,
    get: function () { return state.ui.route; },
    set: function (v) { state.ui.route = v; }
  });

  const listeners = [];

  function ensureDerived(exp) {
    if (!exp.derived || typeof exp.derived !== 'object') exp.derived = {};
    const d = exp.derived;
    d.actions = d.actions && typeof d.actions === 'object' ? d.actions : {};
    /* Completed Action history is diagnostic metadata, not a second copy of model outputs.
       Keep only bounded telemetry so long sessions stay small. */
    Object.keys(d.actions).forEach(function(actionId){const entry=d.actions[actionId];if(!entry||!Array.isArray(entry.runs))return;entry.runs=entry.runs.slice(-12).map(function(run){if(!run||typeof run!=='object')return run;const compact=Object.assign({},run);delete compact.outputs;delete compact.result;if(compact.requestMeta&&typeof compact.requestMeta==='object'){const meta={};Object.keys(compact.requestMeta).slice(-24).forEach(function(key){const m=compact.requestMeta[key]||{};meta[key]={model:m.model||'',provider:m.provider||'',thinkingMode:m.thinkingMode||'auto',requestId:m.requestId||'',requestLogId:m.requestLogId||'',latencyMs:m.latencyMs,ttftMs:m.ttftMs,tokensPerSecond:m.tokensPerSecond,streamed:!!m.streamed,usage:m.usage||null,finishReason:m.finishReason||''};});compact.requestMeta=meta;}if(Array.isArray(compact.attempts))compact.attempts=compact.attempts.slice(-8).map(function(x){return Object.assign({},x,{message:String(x&&x.message||'').slice(0,900)});});return compact;});});
    d.chat = d.chat || { conversation: [] };
    d.chat.conversation = Array.isArray(d.chat.conversation) ? d.chat.conversation : [];
    return d;
  }

  /**
   * Return the one canonical in-memory experiment and repair only structural
   * gaps. Route-independent. This never parses RAW bytes, calculates metrics or
   * invents scientific values; canonical guarantees come from LF.DataModel.
   */
  function ensureExperiment(reason) {
    if (!state.experiment || typeof state.experiment !== 'object') state.experiment = emptyExperiment();
    if (!state.experiment.id) state.experiment.id = 'exp_' + Math.random().toString(36).slice(2, 10);
    let exp = state.experiment;
    if (LF.DataModel && LF.DataModel.hydrate) { exp = LF.DataModel.hydrate(exp); state.experiment = exp; }
    else if (LF.DataModel && LF.DataModel.normalize) LF.DataModel.normalize(exp);
    exp.raw = exp.raw || {};
    ensureDerived(exp);
    Log.trace('ensure.experiment', { reason: reason, id: exp.id, blocks: exp.blocks && exp.blocks.length });
    return exp;
  }

  /** Invalidate NOMAD-derived state through the dependency registry. */
  function invalidateNomad(exp, scope) {
    if (LF.DerivedState && LF.DerivedState.invalidate) LF.DerivedState.invalidate(exp, scope || 'metadata');
  }

  function notify(reason) {
    Log.trace('state.notify', { reason: reason, route: state.ui.route, listeners: listeners.length, experimentId: state.experiment && state.experiment.id });
    listeners.forEach(function (fn) { try { fn(state, reason); } catch (err) { Log.error('state.listener-failed', { error: err, reason: reason }); } });
  }

  function subscribe(fn) { listeners.push(fn); Log.debug('state.subscribe', { listeners: listeners.length }); return function () { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; }
  function normalizeRoute(route) { return String(route || ''); }

  function routeRequiresExperiment(route) {
    const normalized = normalizeRoute(route);
    return /^experiment-/.test(normalized) && normalized !== 'experiment-import';
  }

  function setRoute(route) {
    const previous = state.ui.route;
    route = normalizeRoute(route);
    if (previous !== route) commitAllDrafts();
    ensureExperiment('route:' + route);
    state.ui.route = route;
    state.ui.uploadLanding = false;
    Log.info('route.changed', { from: previous, to: route });
    notify('route');
  }

  function setExperiment(exp, rawArchive) {
    state.experiment = exp || emptyExperiment();
    if (LF.DataModel && LF.DataModel.hydrate) state.experiment = LF.DataModel.hydrate(state.experiment);
    ensureExperiment('set');
    /* Preserve the uploaded source bytes as immutable evidence. The application
       works on ExperimentData and never rewrites this ArrayBuffer. */
    if (rawArchive && state.experiment.raw && !(state.experiment.raw.sourceArchive instanceof ArrayBuffer && state.experiment.raw.sourceArchive.byteLength)) {
      state.experiment.raw.sourceArchive = rawArchive instanceof ArrayBuffer ? rawArchive.slice(0) : rawArchive;
    }
    state.experiment.sync = state.experiment.sync || { revision: 0, lastChange: null, pendingScopes: [] };
    const first = Array.isArray(state.experiment.measurements) ? state.experiment.measurements[0] : null;
    state.ui.selectedMeasurementId = first ? first.id : null;
    Log.info('experiment.set', { id: state.experiment.id, name: state.experiment.meta && state.experiment.meta.name, files: state.experiment.files && state.experiment.files.length, blocks: state.experiment.blocks && state.experiment.blocks.length, measurements: (state.experiment.measurements || []).length });
    notify('experiment');
  }

  /** Commit an already-applied edit: advance revision through DataModel, then
      invalidate NOMAD projections when the scope demands it. */
  function touch(scope) {
    const exp = ensureExperiment('before-touch');
    if (!exp.id) return exp;
    const changeScope = scope || 'metadata';
    if (LF.DataModel && LF.DataModel.touch) LF.DataModel.touch(exp, changeScope);
    if (LF.DerivedState && LF.DerivedState.invalidate) {
      const invalidated=LF.DerivedState.invalidate(exp,changeScope);
      if(invalidated.length)Log.debug('derived.invalidated',{scope:changeScope,projections:invalidated});
    }
    ensureExperiment('after-touch:' + String(changeScope));
    notify(changeScope === 'route' ? 'route' : 'touch');
    return exp;
  }

  /** Run a pure mutation, then commit it as one atomic edit. */
  function mutate(fn, reason) {
    const before = { route: state.ui.route, experimentId: state.experiment.id, revision: state.experiment.sync && state.experiment.sync.revision };
    fn(state);
    touch(reason || 'metadata');
    Log.debug('state.mutate', { scope: reason || 'metadata', before: before, after: { revision: state.experiment.sync && state.experiment.sync.revision } });
  }

  /** The one active Action run examined by every execution path. */
  function startActionRun(record) {
    state.actionRun = {
      actionId: record && record.actionId || '',
      stepIndex: record && record.stepIndex || 0,
      sourceRevision: state.experiment && state.experiment.sync ? state.experiment.sync.revision : 0,
      status: 'running',
      startedAt: nowIso(),
      aborted: false
    };
    notify('actionRun');
    return state.actionRun;
  }

  function endActionRun(status) {
    if (state.actionRun) state.actionRun.status = status || 'done';
    notify('actionRun');
    return state.actionRun;
  }


  function markDraft(scope) {
    const exp=ensureExperiment('draft:'+String(scope||'metadata')); exp.sync=exp.sync||{}; exp.sync.pendingScopes=Array.isArray(exp.sync.pendingScopes)?exp.sync.pendingScopes:[];
    const name=String(scope||'metadata'); if(!exp.sync.pendingScopes.includes(name))exp.sync.pendingScopes.push(name); exp.sync.lastChange={scope:name,at:nowIso()}; return exp;
  }

  function commitDraft(scope) {
    const exp=ensureExperiment('commit-draft'); exp.sync=exp.sync||{}; const pending=Array.isArray(exp.sync.pendingScopes)?exp.sync.pendingScopes:[];
    const scopes=scope?[String(scope)]:pending.slice(); let changed=false; scopes.forEach(function(name){const i=pending.indexOf(name);if(i>=0){pending.splice(i,1);changed=true;if(LF.DataModel&&LF.DataModel.touch)LF.DataModel.touch(exp,name);if(LF.DerivedState&&LF.DerivedState.invalidate)LF.DerivedState.invalidate(exp,name);}});
    exp.sync.pendingScopes=pending; if(changed)notify('touch'); return exp;
  }

  function commitAllDrafts(){return commitDraft();}

  function currentExperiment(reason){ return ensureExperiment(reason||'current'); }

  function resetSession() {
    state.experiment = emptyExperiment();
    state.actionRun = null;
    /* Keep the `ui` object identity stable for modules that reference it, but
       reset every transient view field from one canonical default factory. */
    Object.keys(state.ui).forEach(function (key) { delete state.ui[key]; });
    Object.assign(state.ui, defaultUiState());
    notify('reset');
    return state;
  }


  LF.State = {
    state: state,
    emptyExperiment: emptyExperiment,
    ensureDerived: ensureDerived,
    invalidateNomad: invalidateNomad,
    ensureExperiment: ensureExperiment,
    subscribe: subscribe,
    notify: notify,
    normalizeRoute: normalizeRoute,
    routeRequiresExperiment: routeRequiresExperiment,
    setRoute: setRoute,
    setExperiment: setExperiment,
    touch: touch,
    mutate: mutate,
    startActionRun: startActionRun,
    endActionRun: endActionRun,
    markDraft: markDraft,
    commitDraft: commitDraft,
    commitAllDrafts: commitAllDrafts,
    currentExperiment: currentExperiment,
    resetSession: resetSession
  };
}());
