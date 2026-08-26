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
  const SCOPE_INVALIDATES_NOMAD = ['dataset', 'analysis', 'validation', 'design', 'report', 'metadata'];

  function nowIso() { return new Date().toISOString(); }

  function emptyExperiment() {
    if (LF.DataModel && LF.DataModel.create) return LF.DataModel.create({ sourceName: '' });
    return {
      id: null,
      meta: { name: 'Untitled experiment', createdAt: null, modifiedAt: null, sourceName: '', sourceSize: 0 },
      raw: { sourceName: '', sha256: '', sourceArchive: null },
      files: [], entities: [], blocks: [], patches: [], manifest: [], rawFormatEvidence: [], auxiliaryEvidence: [], samples: [], measurements: [], findings: [], provenance: [],
      analysisSettings: { mismatchFactor: 1 }, analysis: { summary: {}, bestBySample: [], topNonRef: [], topRef: [] },
      design: { status: 'unknown', solutions: [], process: { coating: '', annealing: '', atmosphere: '', notes: '' }, stack: [], devices: [] }, report: {}, nomad: {}, interpretationOverrides: {},
      sync: { revision: 0, savedRevision: 0, dirty: false, lastChange: null, savedAt: null, savedKind: '' },
      derived: {}
    };
  }

  const state = {
    user: { name: '', defaultAuthor: '', organization: '', email: '' },
    workspace: { theme: 'instrument' },
    project: {},
    experiment: emptyExperiment(),
    actionRun: null,
    docsSlug: 'guides--getting-started',
    docsQuery: '',
    docsSection: 'all',
    knowledgeSelectedId: null,
    knowledgeQuery: '',
    knowledgeKind: 'all',
    knowledgeCreating: false,
    knowledgeDraftKind: 'material',
    ui: {
      route: 'experiment-import',
      uploadLanding: false,
      assistantOpen: true,
      resultsTab: 'overview',
      selectedMeasurementId: null,
      curveSelection: [],
      curveView: 'all',
      curveGroup: 'all',
      curveDirection: 'both',
      curveEligibleOnly: false,
      curveSearch: '',
      selectedDesignDeviceId: null,
      resultInspectorId: null,
      uiKitQuery: '',
      uiKitFilter: 'all',
      reportMode: 'editor',
      boxPlot: { metric: 'eff', direction: 'both', groups: [], eligibleOnly: true, experimentId: null },
      settingsSection: 'provider',
      settingsActionId: 'dataset.analyze',
      settingsActionDocKind: 'lab',
      logFilters: { level: 'all', category: 'all', query: '', scope: 'all' },
      pageContext: { page: '', view: '', selected: {}, filters: {}, visible: [] }
    }
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
    if(!d.actions && d.operations && typeof d.operations === 'object') d.actions=d.operations;
    d.actions = d.actions && typeof d.actions === 'object' ? d.actions : {};
    /* Completed Action history is diagnostic metadata, not a second copy of model
       outputs. Older persisted workspaces may contain full outputs/request bodies;
       discard those duplicates during normalization so long sessions stay small. */
    Object.keys(d.actions).forEach(function(actionId){const entry=d.actions[actionId];if(!entry||!Array.isArray(entry.runs))return;entry.runs=entry.runs.slice(-12).map(function(run){if(!run||typeof run!=='object')return run;const compact=Object.assign({},run);delete compact.outputs;delete compact.result;if(compact.requestMeta&&typeof compact.requestMeta==='object'){const meta={};Object.keys(compact.requestMeta).slice(-24).forEach(function(key){const m=compact.requestMeta[key]||{};meta[key]={model:m.model||'',provider:m.provider||'',thinkingMode:m.thinkingMode||'auto',requestId:m.requestId||'',requestLogId:m.requestLogId||'',latencyMs:m.latencyMs,ttftMs:m.ttftMs,tokensPerSecond:m.tokensPerSecond,streamed:!!m.streamed,usage:m.usage||null,finishReason:m.finishReason||''};});compact.requestMeta=meta;}if(Array.isArray(compact.attempts))compact.attempts=compact.attempts.slice(-8).map(function(x){return Object.assign({},x,{message:String(x&&x.message||'').slice(0,900)});});return compact;});});
    if(Object.prototype.hasOwnProperty.call(d,'operations')) delete d.operations;
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
    const exp = state.experiment;
    if (LF.DataModel && LF.DataModel.normalize) LF.DataModel.normalize(exp);
    exp.raw = exp.raw || {};
    ensureDerived(exp);
    Log.trace('ensure.experiment', { reason: reason, id: exp.id, blocks: exp.blocks && exp.blocks.length });
    return exp;
  }

  /** Mark NOMAD working projections stale after a relevant scope change. */
  function invalidateNomad(exp, scope) {
    if (SCOPE_INVALIDATES_NOMAD.indexOf(scope) < 0) return;
    const now = nowIso();
    exp.nomad = exp.nomad || {};
    exp.nomad.validation = null;
    exp.nomad.staleSince = now;
    exp.nomad.staleReason = scope;
    if (exp.nomad.upload) { exp.nomad.upload.stale = true; exp.nomad.upload.staleReason = scope; }
    Log.info('nomad.invalidated', { scope: scope, revision: exp.sync && exp.sync.revision || 0 });
  }

  function notify(reason) {
    Log.trace('state.notify', { reason: reason, route: state.ui.route, listeners: listeners.length, experimentId: state.experiment && state.experiment.id });
    listeners.forEach(function (fn) { try { fn(state, reason); } catch (err) { Log.error('state.listener-failed', { error: err, reason: reason }); } });
  }

  function subscribe(fn) { listeners.push(fn); Log.debug('state.subscribe', { listeners: listeners.length }); return function () { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; }

  /** Normalize navigation aliases before any workflow gate is evaluated.
   * `Experiment` is a safe entry point even before a ZIP exists; only the
   * downstream scientific steps require an imported source archive. */
  function normalizeRoute(route) {
    route = String(route || '');
    if (route === 'experiment-home' || route === 'experiment-understand') return 'experiment-import';
    if (route === 'experiment-changes') return 'experiment-nomad';
    return route;
  }

  function routeRequiresExperiment(route) {
    const normalized = normalizeRoute(route);
    return /^experiment-/.test(normalized) && normalized !== 'experiment-import';
  }

  function setRoute(route) {
    const previous = state.ui.route;
    route = normalizeRoute(route);
    ensureExperiment('route:' + route);
    state.ui.route = route;
    state.ui.uploadLanding = false;
    Log.info('route.changed', { from: previous, to: route });
    notify('route');
  }

  function setExperiment(exp, rawArchive) {
    state.experiment = exp || emptyExperiment();
    ensureExperiment('set');
    /* Never attach the caller's upload buffer directly to editable state.
       Importer/DataModel normally already captured a pristine snapshot; this
       fallback also clones so subsequent Working Copy edits cannot share it. */
    if (rawArchive && state.experiment.raw && !(state.experiment.raw.sourceArchive instanceof ArrayBuffer && state.experiment.raw.sourceArchive.byteLength)) {
      state.experiment.raw.sourceArchive = rawArchive instanceof ArrayBuffer ? rawArchive.slice(0) : rawArchive;
    }
    state.experiment.sync = state.experiment.sync || {};
    state.experiment.sync.savedRevision = Number(state.experiment.sync.revision || 0);
    state.experiment.sync.dirty = false;
    state.experiment.sync.savedAt = null;
    state.experiment.sync.savedKind = '';
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
    if (changeScope === 'dataset') {
      /* Scientific Working Copy edits invalidate every downstream evidence
         dossier/proposal that was built from the previous revision. */
      delete exp.datasetAnalysis;
      delete exp.aiCorrectionPlan;
      delete exp.designAnalysis;
      delete exp.aiDesignProposal;
      delete exp.aiDesignProposals;
      delete exp.analysisSummary;
      if (exp.analysis) delete exp.analysis.aiInterpretation;
      if (exp.nomad) delete exp.nomad.mappingPlan;
    } else if (changeScope === 'analysis') {
      /* Re-analysed metrics (e.g. a changed mismatch factor) invalidate the
         statistics bundle and AI interpretation derived from the old analysis. */
      delete exp.analysisSummary;
      if (exp.analysis) delete exp.analysis.aiInterpretation;
    } else if (changeScope === 'design') {
      delete exp.designAnalysis;
      if (exp.nomad) delete exp.nomad.mappingPlan;
    }
    invalidateNomad(exp, changeScope);
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


  /** Mark the current in-memory working-copy revision as explicitly saved/exported. */
  function markSaved(kind) {
    const exp = ensureExperiment('mark-saved');
    exp.sync = exp.sync || {};
    exp.sync.savedRevision = Number(exp.sync.revision || 0);
    exp.sync.dirty = false;
    exp.sync.savedAt = nowIso();
    exp.sync.savedKind = String(kind || 'working-copy');
    exp.sync.pendingScopes = [];
    Log.info('working-copy.saved', { revision: exp.sync.savedRevision, kind: exp.sync.savedKind });
    notify('saved');
    return exp;
  }

  function markDraft(scope) {
    const exp=ensureExperiment('draft:'+String(scope||'metadata')); exp.sync=exp.sync||{}; exp.sync.pendingScopes=Array.isArray(exp.sync.pendingScopes)?exp.sync.pendingScopes:[];
    const name=String(scope||'metadata'); if(!exp.sync.pendingScopes.includes(name))exp.sync.pendingScopes.push(name); exp.sync.dirty=true; exp.sync.lastChange=nowIso(); return exp;
  }

  function commitDraft(scope) {
    const exp=ensureExperiment('commit-draft'); exp.sync=exp.sync||{}; const pending=Array.isArray(exp.sync.pendingScopes)?exp.sync.pendingScopes:[];
    const scopes=scope?[String(scope)]:pending.slice(); let changed=false; scopes.forEach(function(name){const i=pending.indexOf(name);if(i>=0){pending.splice(i,1);changed=true;if(LF.DataModel&&LF.DataModel.touch)LF.DataModel.touch(exp,name);invalidateNomad(exp,name);}});
    exp.sync.pendingScopes=pending; if(changed)notify('touch'); return exp;
  }

  function commitAllDrafts(){return commitDraft();}

  function resetSession() {
    state.experiment=emptyExperiment(); state.actionRun=null; state.ui.route='experiment-import'; state.ui.uploadLanding=false; state.ui.resultsTab='overview'; state.ui.selectedMeasurementId=null; state.ui.curveSelection=[]; state.ui.selectedDesignDeviceId=null; state.ui.resultInspectorId=null; state.ui.pageContext={page:'',view:'',selected:{},filters:{},visible:[]}; notify('reset'); return state;
  }

  function isDirty() {
    const exp = ensureExperiment('dirty-check');
    return !!(exp.sync&&exp.sync.dirty) || Number(exp.sync && exp.sync.revision || 0) !== Number(exp.sync && exp.sync.savedRevision || 0) || !!(exp.sync&&exp.sync.pendingScopes&&exp.sync.pendingScopes.length);
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
    markSaved: markSaved,
    isDirty: isDirty,
    markDraft: markDraft,
    commitDraft: commitDraft,
    commitAllDrafts: commitAllDrafts,
    resetSession: resetSession
  };
}());
