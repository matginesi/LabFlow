(function () {
  'use strict';

  const LF = window.LabFlow = window.LabFlow || {};
  const C = LF.Core;


  function clean(value) { return String(value == null ? '' : value).trim(); }
  function normalized(value) { return clean(value).toLowerCase().replace(/\s+/g, ' '); }
  function fillEmpty(target, source, fields) {
    fields.forEach(function (key) {
      if (!clean(target[key]) && clean(source[key])) target[key] = source[key];
    });
  }
  function splitNote(note) {
    const out = {};
    clean(note).split(/;\s*/).forEach(function (part) {
      const m = part.match(/^\s*([^:]{2,40})\s*:\s*(.+?)\s*$/);
      if (!m) return;
      out[normalized(m[1])] = clean(m[2]).replace(/[.]$/, '');
    });
    return out;
  }
  function layerRole(material, index, total) {
    const m = normalized(material);
    if (/glass|quartz|substrate/.test(m)) return 'Substrate';
    if (/ito|fto|azo/.test(m)) return 'Transparent electrode';
    if (/sno2|tio2|pcbm|c60|zno/.test(m)) return 'Electron transport';
    if (/perovskite|mapbi|fapbi|cs.*pb|absorber/.test(m)) return 'Absorber';
    if (/peai|pda|passivat/.test(m)) return 'Passivation';
    if (/spiro|ptaa|pedot|nio/.test(m)) return 'Hole transport';
    if (/\bau\b|gold|\bag\b|silver|aluminium|aluminum|carbon/.test(m)) return index === total - 1 ? 'Top contact' : 'Electrode';
    return 'Layer ' + (index + 1);
  }
  function parseSolution(label, text, evidence) {
    const raw = clean(text);
    if (!raw) return null;
    const inMatch = raw.match(/^(.*?)\s+(?:in|using)\s+(.+)$/i);
    const head = clean(inMatch ? inMatch[1] : raw);
    const solventPart = clean(inMatch ? inMatch[2] : '');
    const concentrationMatch = head.match(/(?:^|\s)(\d+(?:[.,]\d+)?\s*(?:M|mM|mg\s*\/\s*mL|mg\/mL|wt%|vol%))(?=\s|$)/i);
    let solutes = head;
    let concentration = concentrationMatch ? clean(concentrationMatch[1]) : '';
    if (concentrationMatch) solutes = clean(head.replace(concentrationMatch[0], ' '));
    let additives = '';
    const withMatch = (solventPart || head).match(/\s+with\s+(.+)$/i);
    let solvents = solventPart;
    if (withMatch) {
      additives = clean(withMatch[1]);
      solvents = clean(solventPart.replace(/\s+with\s+.+$/i, ''));
      if (!solventPart) solutes = clean(head.replace(/\s+with\s+.+$/i, ''));
    }
    return {
      name: label === 'passivation' ? 'Passivation solution' : 'Perovskite precursor',
      role: label === 'passivation' ? 'passivation' : 'absorber precursor',
      solutes: solutes,
      solvents: solvents,
      concentration: concentration,
      additives: additives,
      preparation: '',
      evidence: evidence,
      status: 'raw_evidence',
      confidence: 1,
      provenanceKind: 'evidence'
    };
  }
  function parseDesignNote(note, evidence) {
    const fields = splitNote(note), stackText = fields.stack || fields['device stack'] || '', layers = [];
    if (stackText) clean(stackText).split(/\s*\/\s*/).filter(Boolean).forEach(function (material, index, all) {
      layers.push({role:layerRole(material,index,all.length),material:clean(material),thickness:'',process:'',evidence:evidence,status:'raw_evidence',confidence:1,provenanceKind:'evidence'});
    });
    const solutions = [];
    const precursor = parseSolution('precursor', fields.precursor || fields['precursor solution'] || '', evidence);
    const passivation = parseSolution('passivation', fields.passivation || fields['passivation solution'] || '', evidence);
    if (precursor) solutions.push(precursor);
    if (passivation) solutions.push(passivation);
    const process = {
      coating: fields['spin coating'] || fields.coating || fields.deposition || '',
      annealing: fields.annealing || '',
      atmosphere: fields.atmosphere || '',
      notes: [fields.antisolvent ? 'Antisolvent: ' + fields.antisolvent : '', fields['post treatment'] ? 'Post-treatment: ' + fields['post treatment'] : ''].filter(Boolean).join('; ')
    };
    const useful = !!(layers.length || solutions.length || clean(process.coating) || clean(process.annealing) || clean(process.atmosphere) || clean(process.notes));
    return {useful:useful,stack:layers,solutions:solutions,process:process,raw:clean(note)};
  }
  function designEvidenceRecords(exp) {
    const rows = [], seen = new Set();
    (exp.auxiliaryEvidence || []).forEach(function (item) {
      const meta = item && item.meta || {}, candidates = [];
      Object.keys(meta).forEach(function (key) {
        if (/note|stack|precursor|solution|solvent|anneal|coating|fabricat|process|atmosphere/i.test(key)) candidates.push({key:key,value:meta[key]});
      });
      if (!candidates.length && item && item.note) candidates.push({key:'note',value:item.note});
      candidates.forEach(function (candidate) {
        const evidence = [item.path || item.file || '', candidate.key].filter(Boolean).join(' · '), parsed = parseDesignNote(candidate.value, evidence);
        if (!parsed.useful) return;
        const sample = clean(item.sample), group = clean(item.group) || sample;
        const signature = JSON.stringify({sample:sample,raw:parsed.raw});
        if (seen.has(signature)) return;
        seen.add(signature);
        rows.push({sample:sample,group:group,isRef:!!item.isRef,path:item.path||item.file||'',sourceKey:candidate.key,parsed:parsed});
      });
    });
    return rows;
  }
  function solutionSignature(solution) {
    return [solution.role,solution.solutes,solution.solvents,solution.concentration,solution.additives].map(normalized).join('|');
  }
  function designSignature(parsed) {
    return JSON.stringify({stack:(parsed.stack||[]).map(function(x){return normalized(x.material);}),solutions:(parsed.solutions||[]).map(solutionSignature),process:[parsed.process&&parsed.process.coating,parsed.process&&parsed.process.annealing,parsed.process&&parsed.process.atmosphere].map(normalized)});
  }
  function ensureRawSolution(design, src) {
    const sig = solutionSignature(src);
    let dst = (design.solutions || []).find(function (solution) { return solutionSignature(solution) === sig; });
    if (!dst) {
      dst = Object.assign({id:C.uid('sol')}, src);
      design.solutions.push(dst);
    } else {
      fillEmpty(dst, src, ['name','role','solutes','solvents','concentration','additives','preparation','evidence']);
    }
    if (!dst.status || dst.status === 'unknown') dst.status = 'raw_evidence';
    return dst;
  }
  function projectRawDesign(exp, force) {
    const design = exp.design;
    if (!force && design.sourceProjection && Number(design.sourceProjection.version) === 1) return design.evidenceSummary || design.sourceProjection.summary || {};
    const records = designEvidenceRecords(exp), groups = new Map();
    records.forEach(function (record) {
      const key = normalized(record.group) + '|' + designSignature(record.parsed);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(record);
    });
    groups.forEach(function (items) {
      const first = items[0], sampleNames = Array.from(new Set(items.map(function(x){return x.sample;}).filter(Boolean))), parsed = first.parsed;
      let device = (design.devices || []).find(function (d) { return sampleNames.some(function(name){return (d.sampleNames||[]).includes(name);}); });
      if (!device) {
        device = {id:C.uid('device'),name:first.group||sampleNames[0]||'Imported design',group:first.group||'',sampleNames:[],isRef:items.every(function(x){return x.isRef;}),solutionIds:[],stack:[],process:{},status:'raw_evidence',evidence:'',confidence:1};
        design.devices.push(device);
      }
      device.sampleNames = Array.from(new Set((device.sampleNames || []).concat(sampleNames)));
      if ((!device.name || device.name === device.sampleNames[0]) && first.group) device.name = first.group;
      if (!device.group) device.group = first.group || '';
      if (!clean(device.evidence) || /Detected from dataset sample identity/.test(device.evidence)) device.evidence = 'Recovered from source metadata · ' + items.map(function(x){return x.path;}).filter(Boolean).slice(0,2).join(' · ');
      if (!device.status || device.status === 'unknown') device.status = 'raw_evidence';
      device.process = Object.assign({coating:'',annealing:'',atmosphere:'',notes:''}, device.process || {});
      fillEmpty(device.process, parsed.process || {}, ['coating','annealing','atmosphere','notes']);
      device.stack = Array.isArray(device.stack) ? device.stack : [];
      if (!device.stack.length && (parsed.stack || []).length) device.stack = parsed.stack.map(function(layer){return Object.assign({id:C.uid('layer')},layer);});
      const solutionIds = (parsed.solutions || []).map(function (solution) { return ensureRawSolution(design, solution).id; });
      device.solutionIds = Array.from(new Set((device.solutionIds || []).concat(solutionIds)));
    });
    const covered = new Set();
    (design.devices || []).forEach(function(d){(d.sampleNames||[]).forEach(function(n){covered.add(n);});});
    design.evidenceSummary = {
      sourceRecords: records.length,
      parsedRecords: records.length,
      samplesCovered: Array.from(new Set(records.map(function(r){return r.sample;}).filter(Boolean))).length,
      experimentsRecovered: groups.size,
      sourceAvailable: records.length > 0
    };
    design.sourceEvidence = records.slice(0,48).map(function(r){return{sample:r.sample,group:r.group,path:r.path,note:r.parsed.raw};});
    design.sourceProjection = {version:1,projectedAt:new Date().toISOString(),summary:Object.assign({},design.evidenceSummary)};
    return design.evidenceSummary;
  }

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
    exp.design.evidenceSummary = exp.design.evidenceSummary || {sourceRecords:0,parsedRecords:0,samplesCovered:0,experimentsRecovered:0,sourceAvailable:false};

    projectRawDesign(exp);
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
    const ui = state.ui || state;
    if (!ui.reportMode || (ui.reportMode !== 'editor' && ui.reportMode !== 'preview')) ui.reportMode = 'editor';
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
    function fieldConfidence(value) { const out={};if(!value||typeof value!=='object'||Array.isArray(value))return out;Object.keys(value).forEach(function(key){const n=confidence(value[key]);if(n!=null)out[text(key)]=n;});return out; }
    function fieldDecisions(value) { return list(value).map(function(item){item=item&&typeof item==='object'?item:{};return{field:text(item.field),value:text(item.value),source:text(item.source),confidence:confidence(item.confidence),auto_apply:item.auto_apply===true,quantitative:item.quantitative===true,applied:item.applied===true,skipped:text(item.skipped)};}).filter(function(item){return item.field;}); }
    function layer(item) {
      item=item&&typeof item==='object'?item:{};
      return {role:text(item.role||item.layer||item.function||item.type),material:text(item.material||item.material_name||item.name||item.composition),thickness:text(item.thickness||item.thickness_nm),process:text(item.process||item.deposition),evidence:text(item.evidence||item.source),knowledge_refs:list(item.knowledge_refs||item.knowledgeRefs).map(text),confidence:confidence(item.confidence),field_confidence:fieldConfidence(item.field_confidence||item.fieldConfidence),field_decisions:fieldDecisions(item.field_decisions||item.fieldDecisions),provenance_kind:text(item.provenance_kind||item.provenanceKind),reason:text(item.reason),status:'ai_inferred'};
    }
    let solutionSource=source.solutions||source.formulations||source.recipes||source.solution_chemistry||source.solutionChemistry||source.chemistry||source.solution;
    if(solutionSource&&typeof solutionSource==='object'&&!Array.isArray(solutionSource)&&Array.isArray(solutionSource.solutions))solutionSource=solutionSource.solutions;
    const solutions=list(solutionSource).map(function (item,index) {
      item=item&&typeof item==='object'?item:{};
      return {name:text(item.name||item.title||item.solution_name||item.solutionName||('Solution '+(index+1))),role:text(item.role||item.type||item.function),solutes:text(item.solutes||item.solute||item.materials||item.precursors),solvents:text(item.solvents||item.solvent||item.solvent_system),concentration:text(item.concentration||item.composition||item.ratio||item.composition_or_concentration),additives:text(item.additives||item.additive),preparation:text(item.preparation||item.process||item.notes),evidence:text(item.evidence||item.source),knowledge_refs:list(item.knowledge_refs||item.knowledgeRefs).map(text),confidence:confidence(item.confidence),field_confidence:fieldConfidence(item.field_confidence||item.fieldConfidence),field_decisions:fieldDecisions(item.field_decisions||item.fieldDecisions),provenance_kind:text(item.provenance_kind||item.provenanceKind||item.source_kind),reason:text(item.reason||item.rationale),status:'ai_inferred'};
    });
    let deviceSource=source.devices||source.variants||source.device_variants||source.device;
    if(!deviceSource&&(source.device_stack||source.deviceStack||source.stack||source.layers))deviceSource={stack:source.device_stack||source.deviceStack||source.stack||source.layers,confidence:source.confidence,provenance_kind:source.provenance_kind||source.provenanceKind,reason:source.reason||source.rationale};
    const devices=list(deviceSource).map(function (item,index) {
      item=item&&typeof item==='object'?item:{};
      return {name:text(item.name||item.title||item.group||('Device '+(index+1))),sample_names:list(item.sample_names||item.sampleNames||item.samples).map(text),group:text(item.group),solution_names:list(item.solution_names||item.solutionNames||item.solutions).map(function(v){return typeof v==='object'?text(v.name):text(v);}),process:item.process&&typeof item.process==='object'?item.process:{notes:text(item.process)},stack:list(item.stack||item.layers||item.device_stack||item.deviceStack).map(layer),evidence:text(item.evidence||item.source),knowledge_refs:list(item.knowledge_refs||item.knowledgeRefs).map(text),confidence:confidence(item.confidence),field_confidence:fieldConfidence(item.field_confidence||item.fieldConfidence),field_decisions:fieldDecisions(item.field_decisions||item.fieldDecisions),provenance_kind:text(item.provenance_kind||item.provenanceKind||item.source_kind),reason:text(item.reason||item.rationale),status:'ai_inferred'};
    });
    const process=source.process&&typeof source.process==='object'?source.process:{};
    const coverage=source.coverage&&typeof source.coverage==='object'?source.coverage:{};
    return {summary:text(source.summary||source.assessment||'Design reconstruction ready for review.'),coverage:{input_experiments:Number(coverage.input_experiments)||0,proposed_experiments:Number(coverage.proposed_experiments)||devices.length,covered_sample_names:list(coverage.covered_sample_names).map(text),unmatched_sample_names:list(coverage.unmatched_sample_names).map(text)},solutions:solutions,devices:devices,process:{coating:process.coating||process.deposition||'',annealing:process.annealing||'',atmosphere:process.atmosphere||'',notes:process.notes||''},stack:list(source.stack||source.layers).map(layer),unknowns:list(source.unknowns||source.unresolved||source.missing).map(function(v){return typeof v==='object'?text(v.item||v.field||v.name||JSON.stringify(v)):text(v);})};
  }

  LF.ExperimentModel = {ensureShape:ensureShape, normalizeDesignProposal:normalizeDesignProposal, projectRawDesign:projectRawDesign, designEvidenceRecords:designEvidenceRecords, parseDesignNote:parseDesignNote};
}());
