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
      dst = LF.DomainSchema.create('design_solution',src);
      design.solutions.push(dst);
    } else {
      fillEmpty(dst, src, ['name','role','solutes','solvents','concentration','additives','preparation','evidence']);
    }
    if (!dst.status || dst.status === 'unknown') dst.status = 'raw_evidence';
    return dst;
  }
  function projectRawDesign(exp, force) {
    const design = exp.design;
    if (!force && design.sourceProjection) return design.evidenceSummary || design.sourceProjection.summary || {};
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
        const experiment=(exp.experiments||[]).find(function(x){return clean(x.name)===clean(first.group);})||null;
        const sampleIds=(exp.samples||[]).filter(function(s){return sampleNames.includes(s.name);}).map(function(s){return s.id;});
        device = LF.DomainSchema.create('design_device',{name:first.group||sampleNames[0]||'Imported design',group:first.group||'',experimentId:experiment&&experiment.id||'',sampleIds:sampleIds,sampleNames:sampleNames,isRef:items.every(function(x){return x.isRef;}),solutionIds:[],stack:[],process:{},status:'raw_evidence',evidence:'',confidence:1,provenanceKind:'evidence'});
        design.devices.push(device);
      }
      device.sampleIds = Array.from(new Set((device.sampleIds || []).concat((exp.samples||[]).filter(function(s){return sampleNames.includes(s.name);}).map(function(s){return s.id;}))));
      device.sampleNames = Array.from(new Set((device.sampleNames || []).concat(sampleNames)));
      if ((!device.name || device.name === device.sampleNames[0]) && first.group) device.name = first.group;
      if (!device.group) device.group = first.group || '';
      if (!clean(device.evidence) || /Detected from dataset sample identity/.test(device.evidence)) device.evidence = 'Recovered from source metadata · ' + items.map(function(x){return x.path;}).filter(Boolean).slice(0,2).join(' · ');
      if (!device.status || device.status === 'unknown') device.status = 'raw_evidence';
      device.process = Object.assign({coating:'',annealing:'',atmosphere:'',notes:''}, device.process || {});
      fillEmpty(device.process, parsed.process || {}, ['coating','annealing','atmosphere','notes']);
      device.stack = Array.isArray(device.stack) ? device.stack : [];
      if (!device.stack.length && (parsed.stack || []).length) device.stack = parsed.stack.map(function(layer){return LF.DomainSchema.create('design_layer',layer);});
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
    design.sourceProjection = {projectedAt:new Date().toISOString(),summary:Object.assign({},design.evidenceSummary)};
    return design.evidenceSummary;
  }

  /* Design is a projection owned by this module. Core domain normalization is
     exclusively DataModel/DomainSchema responsibility. */
  function ensure(exp) {
    if (!exp) return exp;
    if (LF.DataModel && LF.DataModel.hydrate) exp = LF.DataModel.hydrate(exp);
    const DS=LF.DomainSchema;
    exp.design = exp.design && typeof exp.design === 'object' ? exp.design : {};
    exp.design.solutions = Array.isArray(exp.design.solutions) ? exp.design.solutions.map(function(x){return DS.create('design_solution',x);}) : [];
    exp.design.stack = Array.isArray(exp.design.stack) ? exp.design.stack.map(function(x){return DS.create('design_layer',x);}) : [];
    exp.design.devices = Array.isArray(exp.design.devices) ? exp.design.devices.map(function(x){return DS.create('design_device',x);}) : [];
    exp.design.process = Object.assign({coating:'', annealing:'', atmosphere:'', notes:''}, exp.design.process || {});
    exp.design.evidenceSummary = Object.assign({sourceRecords:0,parsedRecords:0,samplesCovered:0,experimentsRecovered:0,sourceAvailable:false}, exp.design.evidenceSummary || {});

    projectRawDesign(exp);
    const experiments = exp.experiments || [];
    experiments.forEach(function (experiment) {
      const sampleIds=(experiment.sampleIds||[]).slice();
      const matches=exp.design.devices.filter(function(device){return device.experimentId===experiment.id || (device.sampleIds||[]).some(function(id){return sampleIds.includes(id);});});
      if(!matches.length)exp.design.devices.push(deviceFromExperiment(experiment,exp.samples||[]));
      else if(matches.length===1){matches[0].experimentId=experiment.id;matches[0].sampleIds=Array.from(new Set((matches[0].sampleIds||[]).concat(sampleIds)));}
    });
    exp.design.devices=exp.design.devices.map(function(device){return ensureDevice(device,exp);});
    return exp;
  }

  
  
  function deviceFromExperiment(experiment, samples) {
    const sampleNames = Array.isArray(experiment.sampleNames) && experiment.sampleNames.length
      ? experiment.sampleNames.slice()
      : (samples || []).filter(function (sample) { return sample.experimentId === experiment.id || clean(sample.experiment || sample.group) === clean(experiment.name); }).map(function (sample) { return sample.name; });
    return LF.DomainSchema.create('design_device', {
      name: experiment.name,
      group: experiment.name || '',
      experimentId: experiment.id || '',
      sampleIds: (experiment.sampleIds || []).slice(),
      sampleNames: Array.from(new Set(sampleNames.filter(Boolean))),
      isRef: !!experiment.isRef,
      solutionIds: [], stack: [], process: {}, status: 'raw_evidence',
      evidence: 'Detected from dataset experiment hierarchy', confidence: 1, provenanceKind:'evidence'
    });
  }

  function ensureDevice(device, exp) {
    device=LF.DomainSchema.create('design_device',device||{});
    if(device.experimentId){
      const experiment=(exp.experiments||[]).find(function(x){return x.id===device.experimentId;});
      if(experiment){device.group=device.group||experiment.name;device.name=device.name||experiment.name;device.sampleIds=Array.from(new Set((device.sampleIds||[]).concat(experiment.sampleIds||[])));}
    }
    const sampleById=new Map((exp.samples||[]).map(function(s){return[s.id,s];}));
    device.sampleNames=(device.sampleIds||[]).map(function(id){const sample=sampleById.get(id);return sample&&sample.name||'';}).filter(Boolean);
    device.stack=(device.stack||[]).map(function(layer){return LF.DomainSchema.create('design_layer',layer);});
    return device;
  }

  function stackAssessment(stack) {
    const layers=(Array.isArray(stack)?stack:[]).filter(function(layer){return clean(layer&&layer.role)||clean(layer&&layer.material);});
    const roles=layers.map(function(layer){return normalized(layer.role+' '+layer.material);});
    const hasAbsorber=roles.some(function(value){return /absorber|perovskite|photoactive|active layer/.test(value);});
    const hasBoundary=roles.some(function(value){return /substrate|electrode|contact|ito|fto|metal|gold|silver|carbon/.test(value);});
    const hasTransport=roles.some(function(value){return /transport|etl|htl|sno2|tio2|nio|ptaa|spiro|c60|pcbm/.test(value);});
    return {complete:layers.length>=3&&hasAbsorber&&hasBoundary&&hasTransport,layers:layers.length,hasAbsorber:hasAbsorber,hasBoundary:hasBoundary,hasTransport:hasTransport};
  }

  function missingDomains(exp,device) {
    const design=exp&&exp.design||{},ids=new Set(device&&device.solutionIds||[]),solutions=(design.solutions||[]).filter(function(solution){return ids.has(solution.id);}),process=device&&device.process||{},missing=[];
    if(!solutions.some(function(solution){return clean(solution.solutes)||clean(solution.solvents);}))missing.push('solutions');
    if(!stackAssessment(device&&device.stack).complete)missing.push('stack');
    if(![process.coating,process.annealing,process.atmosphere,process.notes].some(function(value){return clean(value);}))missing.push('process');
    return missing;
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
      return {role:text(item.role||item.layer||item.function||item.type),material:text(item.material||item.material_name||item.name||item.composition),thickness:text(item.thickness||item.thickness_nm),process:text(item.process||item.deposition),evidence:text(item.evidence||item.source),confidence:confidence(item.confidence),field_confidence:fieldConfidence(item.field_confidence||item.fieldConfidence),field_decisions:fieldDecisions(item.field_decisions||item.fieldDecisions),provenance_kind:text(item.provenance_kind||item.provenanceKind),reason:text(item.reason),status:'ai_inferred'};
    }
    let solutionSource=source.solutions||source.formulations||source.recipes||source.solution_chemistry||source.solutionChemistry||source.chemistry||source.solution;
    if(solutionSource&&typeof solutionSource==='object'&&!Array.isArray(solutionSource)&&Array.isArray(solutionSource.solutions))solutionSource=solutionSource.solutions;
    const solutions=list(solutionSource).map(function (item,index) {
      item=item&&typeof item==='object'?item:{};
      return {name:text(item.name||item.title||item.solution_name||item.solutionName||('Solution '+(index+1))),role:text(item.role||item.type||item.function),solutes:text(item.solutes||item.solute||item.materials||item.precursors),solvents:text(item.solvents||item.solvent||item.solvent_system),concentration:text(item.concentration||item.composition||item.ratio||item.composition_or_concentration),additives:text(item.additives||item.additive),preparation:text(item.preparation||item.process||item.notes),evidence:text(item.evidence||item.source),confidence:confidence(item.confidence),field_confidence:fieldConfidence(item.field_confidence||item.fieldConfidence),field_decisions:fieldDecisions(item.field_decisions||item.fieldDecisions),provenance_kind:text(item.provenance_kind||item.provenanceKind||item.source_kind),reason:text(item.reason||item.rationale),status:'ai_inferred'};
    });
    let deviceSource=source.devices||source.variants||source.device_variants||source.device;
    if(!deviceSource&&(source.device_stack||source.deviceStack||source.stack||source.layers||source.process))deviceSource={stack:source.device_stack||source.deviceStack||source.stack||source.layers,process:source.process||{},confidence:source.confidence,provenance_kind:source.provenance_kind||source.provenanceKind,reason:source.reason||source.rationale};
    const devices=list(deviceSource).map(function (item,index) {
      item=item&&typeof item==='object'?item:{};
      const proc=item.process&&typeof item.process==='object'?item.process:{notes:text(item.process)};return {name:text(item.name||item.title||item.group||('Device '+(index+1))),sample_names:list(item.sample_names||item.sampleNames||item.samples).map(text),group:text(item.group),solution_names:list(item.solution_names||item.solutionNames||item.solutions).map(function(v){return typeof v==='object'?text(v.name):text(v);}),process:{coating:text(proc.coating||proc.deposition),annealing:text(proc.annealing),atmosphere:text(proc.atmosphere),notes:text(proc.notes),evidence:text(proc.evidence||item.evidence||item.source),confidence:confidence(proc.confidence!=null?proc.confidence:item.confidence),provenance_kind:text(proc.provenance_kind||proc.provenanceKind||item.provenance_kind||item.provenanceKind||item.source_kind),reason:text(proc.reason||proc.rationale||item.reason||item.rationale)},stack:list(item.stack||item.layers||item.device_stack||item.deviceStack).map(layer),evidence:text(item.evidence||item.source),confidence:confidence(item.confidence),field_confidence:fieldConfidence(item.field_confidence||item.fieldConfidence),field_decisions:fieldDecisions(item.field_decisions||item.fieldDecisions),provenance_kind:text(item.provenance_kind||item.provenanceKind||item.source_kind),reason:text(item.reason||item.rationale),status:'ai_inferred'};
    });
    const process=source.process&&typeof source.process==='object'?source.process:{};
    const coverage=source.coverage&&typeof source.coverage==='object'?source.coverage:{};
    return {status:'suggested',summary:text(source.summary||source.assessment||'Design suggestion ready for review.'),coverage:{input_experiments:Number(coverage.input_experiments)||0,proposed_experiments:Number(coverage.proposed_experiments)||devices.length,covered_sample_names:list(coverage.covered_sample_names).map(text),unmatched_sample_names:list(coverage.unmatched_sample_names).map(text)},solutions:solutions,devices:devices,process:{coating:text(process.coating||process.deposition),annealing:text(process.annealing),atmosphere:text(process.atmosphere),notes:text(process.notes),evidence:text(process.evidence||process.source),confidence:confidence(process.confidence),provenance_kind:text(process.provenance_kind||process.provenanceKind||process.source_kind),reason:text(process.reason||process.rationale)},stack:list(source.stack||source.layers).map(layer),unknowns:list(source.unknowns||source.unresolved||source.missing).map(function(v){return typeof v==='object'?text(v.item||v.field||v.name||JSON.stringify(v)):text(v);})};
  }

  LF.DesignModel = {ensure:ensure, normalizeProposal:normalizeDesignProposal, projectSource:projectRawDesign, evidenceRecords:designEvidenceRecords, parseDesignNote:parseDesignNote, stackAssessment:stackAssessment, missingDomains:missingDomains};
}());
