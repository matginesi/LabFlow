(function () {
  'use strict';

  const LF = window.LabFlow = window.LabFlow || {};
  const C = LF.Core;

  /* Canonical editor defaults; never parses RAW or calculates scientific data. */
  function ensureShape(exp, uiState) {
    if (!exp) return exp;
    const state = uiState || {};

    exp.meta = Object.assign({name:'Untitled experiment',createdAt:null,modifiedAt:null,sourceName:'',sourceSize:0}, exp.meta || {});
    exp.raw = Object.assign({sourceName:exp.meta.sourceName||'',sourceSize:Number(exp.meta.sourceSize)||0,sourceArchive:null}, exp.raw || {});
    ['manifest','rawFormatEvidence','auxiliaryEvidence','samples','measurements','findings','patches','provenance'].forEach(function (key) {
      if (!Array.isArray(exp[key])) exp[key] = [];
    });
    exp.analysisSettings = Object.assign({mismatchFactor:1}, exp.analysisSettings || {});
    exp.analysis = exp.analysis || {};
    exp.analysis.summary = exp.analysis.summary || {};
    exp.analysis.bestBySample = Array.isArray(exp.analysis.bestBySample) ? exp.analysis.bestBySample : [];
    exp.analysis.topNonRef = Array.isArray(exp.analysis.topNonRef) ? exp.analysis.topNonRef : [];
    exp.analysis.topRef = Array.isArray(exp.analysis.topRef) ? exp.analysis.topRef : [];
    exp.ai = exp.ai || {};
    exp.ai.conversation = Array.isArray(exp.ai.conversation) ? exp.ai.conversation : [];
    exp.ai.workflows = exp.ai.workflows && typeof exp.ai.workflows === 'object' ? exp.ai.workflows : {};
    exp.sync = Object.assign({revision:0,preparedRevision:0,preparedAt:null,lastChange:null}, exp.sync || {});

    exp.samples.forEach(function (sample) {
      if (!sample.id) sample.id = C.uid('sample');
      sample.measurementIds = Array.isArray(sample.measurementIds) ? sample.measurementIds : [];
    });
    exp.measurements.forEach(function (measurement) {
      if (!measurement.id) measurement.id = C.uid('m');
      measurement.curve = measurement.curve || {};
      measurement.curve.fw = Array.isArray(measurement.curve.fw) ? measurement.curve.fw : [];
      measurement.curve.rv = Array.isArray(measurement.curve.rv) ? measurement.curve.rv : [];
      measurement.meta = measurement.meta || {};
      measurement.flags = Array.isArray(measurement.flags) ? measurement.flags : [];
      measurement.blockingFlags = Array.isArray(measurement.blockingFlags) ? measurement.blockingFlags : [];
      measurement.recoveries = Array.isArray(measurement.recoveries) ? measurement.recoveries : [];
    });

    exp.design = exp.design || {};
    exp.design.solutions = Array.isArray(exp.design.solutions) ? exp.design.solutions : [];
    exp.design.process = Object.assign({coating:'', annealing:'', atmosphere:'', notes:''}, exp.design.process || {});
    exp.design.processProvenance = exp.design.processProvenance || {};
    exp.design.stack = Array.isArray(exp.design.stack) ? exp.design.stack : [];
    exp.design.devices = Array.isArray(exp.design.devices) ? exp.design.devices : [];

    exp.design.stack.forEach(ensureLayer);
    exp.design.solutions.forEach(function (solution) {
      if (!solution.id) solution.id = C.uid('sol');
      if (solution.status == null) solution.status = 'unknown';
      if (solution.evidence == null) solution.evidence = '';
    });

    (exp.samples || []).forEach(function (sample) {
      const represented = exp.design.devices.some(function (device) {
        return Array.isArray(device.sampleNames) && device.sampleNames.includes(sample.name);
      });
      if (!represented) exp.design.devices.push(deviceFromSample(sample));
    });
    exp.design.devices.forEach(ensureDevice);

    if (!state.selectedDesignDeviceId || !exp.design.devices.some(function (device) { return device.id === state.selectedDesignDeviceId; })) {
      state.selectedDesignDeviceId = exp.design.devices[0] ? exp.design.devices[0].id : null;
    }

    exp.interpretationOverrides = exp.interpretationOverrides || {};
    exp.interpretationOverrides.fields = exp.interpretationOverrides.fields || {};
    exp.interpretationOverrides.units = exp.interpretationOverrides.units || {};
    exp.interpretationOverrides.scales = exp.interpretationOverrides.scales || {};
    exp.report = exp.report || {};
    const profile = LF.Storage && LF.Storage.getUserProfile ? LF.Storage.getUserProfile() : null;
    if (!String(exp.report.author || '').trim() && profile && profile.defaultAuthor) exp.report.author = profile.defaultAuthor;
    exp.nomad = Object.assign({validation:null,upload:null,mappingPlan:null}, exp.nomad || {});
    if (LF.Report && LF.Report.ensureReport) LF.Report.ensureReport(exp);
    if (!state.reportMode) state.reportMode = 'split';
    if (!state.boxPlot) state.boxPlot = {metric:'eff', direction:'both', groups:[], eligibleOnly:true, experimentId:null};
    return exp;
  }

  function ensureLayer(layer) {
    if (!layer.id) layer.id = C.uid('layer');
    if (layer.layer && !layer.role) layer.role = layer.layer;
    if (layer.status == null) layer.status = 'unknown';
    if (layer.evidence == null) layer.evidence = '';
    if (layer.process == null) layer.process = '';
  }

  function deviceFromSample(sample) {
    return {
      id: C.uid('device'),
      name: sample.name,
      group: sample.group || '',
      sampleNames: [sample.name],
      isRef: !!sample.isRef,
      solutionIds: [],
      stack: [],
      process: {},
      status: 'raw_evidence',
      evidence: 'Detected from dataset sample identity',
      confidence: 1
    };
  }

  function ensureDevice(device) {
    if (!device.id) device.id = C.uid('device');
    if (!Array.isArray(device.sampleNames)) device.sampleNames = [];
    if (!Array.isArray(device.solutionIds)) device.solutionIds = [];
    if (!Array.isArray(device.stack)) device.stack = [];
    device.process = Object.assign({coating:'', annealing:'', atmosphere:'', notes:''}, device.process || {});
    if (!device.status) device.status = 'unknown';
    if (device.evidence == null) device.evidence = '';
    device.stack.forEach(function (layer) {
      const hadStatus = !!layer.status;
      ensureLayer(layer);
      if (!hadStatus) layer.status = device.status === 'user_confirmed' ? 'user_confirmed' : 'ai_inferred';
      if (!layer.evidence) layer.evidence = device.evidence || '';
    });
  }

  /**
   * Accept harmless provider variations in Design JSON while preserving the
   * same evidence/status boundary. This normalizes shape; it does not infer or
   * invent scientific content.
   */
  function normalizeDesignProposal(raw) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    function list(value) { return Array.isArray(value) ? value : value ? [value] : []; }
    function text(value) { return value == null ? '' : typeof value === 'object' && value.value != null ? String(value.value) : String(value); }
    function confidence(value) { const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):null; }
    function layer(item) {
      item=item&&typeof item==='object'?item:{};
      return {role:text(item.role||item.layer||item.function),material:text(item.material||item.composition),thickness:text(item.thickness),process:text(item.process||item.deposition),evidence:text(item.evidence||item.source),confidence:confidence(item.confidence),status:'ai_inferred'};
    }
    const solutions=list(source.solutions||source.formulations||source.recipes).map(function (item,index) {
      item=item&&typeof item==='object'?item:{};
      return {name:text(item.name||item.title||('Solution '+(index+1))),role:text(item.role||item.type),solutes:text(item.solutes||item.materials),solvents:text(item.solvents||item.solvent),concentration:text(item.concentration||item.composition),additives:text(item.additives),preparation:text(item.preparation||item.process||item.notes),evidence:text(item.evidence||item.source),confidence:confidence(item.confidence),status:'ai_inferred'};
    });
    const devices=list(source.devices||source.variants||source.device_variants).map(function (item,index) {
      item=item&&typeof item==='object'?item:{};
      return {name:text(item.name||item.title||item.group||('Device '+(index+1))),sample_names:list(item.sample_names||item.sampleNames||item.samples).map(text),group:text(item.group),solution_names:list(item.solution_names||item.solutionNames||item.solutions).map(function(v){return typeof v==='object'?text(v.name):text(v);}),process:item.process&&typeof item.process==='object'?item.process:{notes:text(item.process)},stack:list(item.stack||item.layers).map(layer),evidence:text(item.evidence||item.source),confidence:confidence(item.confidence),status:'ai_inferred'};
    });
    const process=source.process&&typeof source.process==='object'?source.process:{};
    const coverage=source.coverage&&typeof source.coverage==='object'?source.coverage:{};
    return {summary:text(source.summary||source.assessment||'Design reconstruction ready for review.'),coverage:{input_experiments:Number(coverage.input_experiments)||0,proposed_experiments:Number(coverage.proposed_experiments)||devices.length,covered_sample_names:list(coverage.covered_sample_names).map(text),unmatched_sample_names:list(coverage.unmatched_sample_names).map(text)},solutions:solutions,devices:devices,process:{coating:process.coating||process.deposition||'',annealing:process.annealing||'',atmosphere:process.atmosphere||'',notes:process.notes||''},stack:list(source.stack||source.layers).map(layer),unknowns:list(source.unknowns||source.unresolved||source.missing).map(function(v){return typeof v==='object'?text(v.item||v.field||v.name||JSON.stringify(v)):text(v);})};
  }

  LF.ExperimentModel = {ensureShape:ensureShape, normalizeDesignProposal:normalizeDesignProposal};
}());
