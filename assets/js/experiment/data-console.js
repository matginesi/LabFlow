(function () {
  'use strict';
  const LF = window.LabFlow = window.LabFlow || {};

  const TYPE_DOCS = {
    dataset: {
      meaning: 'One imported ZIP / batch. This is the ExperimentData aggregate root.',
      fields: ['id','meta','experiments[]','samples[]','runs[]','measurements[]','files[]','findings[]','analysis','design','sync']
    },
    experiment: {
      meaning: 'Logical experimental condition/group inside the dataset (for example N1, N2, N3, NEW, REF).',
      fields: ['id','name','isRef','sampleIds[]','runIds[]','measurementIds[]']
    },
    sample: {
      meaning: 'Physical sample/device/cell. Repeated JV files remain measurements of this sample.',
      fields: ['id','name','rawName','experimentId','experiment','position','cell','isRef','runIds[]','measurementIds[]']
    },
    run: {
      meaning: 'One acquisition session/directory for a sample.',
      fields: ['id','path','label','sampleId','sample','experimentId','experiment','measurementIds[]','evidencePaths[]']
    },
    measurement: {
      meaning: 'One JV acquisition/source file inside a run. FW and RV are scans of this same measurement.',
      fields: ['id','file','rawFile','path','experimentId','experiment','sampleId','sample','runId','sequence','position','cell','isRef','fw','rv','curve','source','bestEff','hysteresis','jscDiffPct','effDiffPct','qualityStatus','rankingEligible','flags[]','recoveries[]']
    },
    scan: {
      meaning: 'One FW or RV scan belonging to a measurement.',
      fields: ['voc (V)','jsc (mA/cm²)','vmpp (V)','jmpp (mA/cm²)','pmpp (mW/cm²)','rs (Ohm)','rsh (Ohm)','ff (%)','eff (%)']
    },
    curve: {
      meaning: 'Raw JV curve points kept under measurement.curve.fw / measurement.curve.rv.',
      fields: ['fw[] -> {x: voltage, y: currentDensity}','rv[] -> {x: voltage, y: currentDensity}']
    },
    finding: {
      meaning: 'Deterministic issue/observation linked to the current LabFlow Data.',
      fields: ['id','severity','type','title','detail','target','evidence[]','status','source','measurementId?']
    }
  };

  const COMMANDS = [
    ['current()', 'Exact ExperimentData instance held by application state'],
    ['summary()', 'Compact counts and deterministic result summary'],
    ['experiments(query?)', 'List/filter logical experiments'],
    ['samples(query?)', 'List/filter samples/cells'],
    ['runs(query?)', 'List/filter acquisition runs'],
    ['measurements(query?)', 'List/filter JV measurements'],
    ['experiment(ref)', 'Get one logical experiment by id/name'],
    ['sample(ref)', 'Get one sample by id/name'],
    ['run(ref)', 'Get one run by id/path/label'],
    ['measurement(ref)', 'Get one measurement by id/file/path'],
    ['get(ref) / inspect(ref)', 'Inspect a record with its related children'],
    ['best(sampleRef)', 'Best eligible measurement for one sample'],
    ['tree()', 'Hierarchy: Experiment → Sample → Run → Measurement'],
    ['describe(type)', 'Print field/meaning documentation for a data type'],
    ['types()', 'List documented domain types'],
    ['json({rows:n})', 'Serializable LabFlow Data view; limits block rows'],
    ['patch({...})', 'Apply one validated LabFlow Data block patch, then reanalyze'],
    ['setMismatchFactor(n)', 'Update mismatch factor and re-run deterministic analysis'],
    ['reanalyze()', 'Rebuild deterministic Results/brief indexes'],
    ['validate()', 'Validate ExperimentData hierarchy/link invariants'],
    ['pipeline()', 'Inspect logical pipeline plan and last execution trace'],
    ['schema()', 'Inspect canonical DomainSchema record/root contract'],
    ['ownership()', 'Inspect root-field owner/layer/persistence metadata'],
    ['derived()', 'Inspect derived projection dependencies/invalidation'],
    ['actions()', 'List current Action capability contracts'],
    ['actionData(actionId?, targetId?)', 'Inspect persisted Action proposals/annotations/status without mutating them'],
    ['contracts()', 'Inspect domain + pipeline + derived + Action contracts together'],
    ['help(topic?)', 'Print this guide; topic may be measurement, sample, run, scan…']
  ];

  function current() {
    const exp = LF.DataModel && LF.DataModel.getExperiment ? LF.DataModel.getExperiment() : (LF.State && LF.State.state && LF.State.state.experiment);
    return exp && LF.DataModel && LF.DataModel.hydrate ? LF.DataModel.hydrate(exp) : exp;
  }
  function need() { const exp=current(); if(!exp) throw new Error('No LabFlow experiment is loaded.'); return exp; }
  function summary() { const exp=need(); return typeof exp.summary==='function'?exp.summary():{}; }
  function experiments(query) { const exp=need(); return typeof exp.selectExperiments==='function'?exp.selectExperiments(query):exp.experiments||[]; }
  function samples(query) { const exp=need(); return typeof exp.selectSamples==='function'?exp.selectSamples(query):exp.samples||[]; }
  function runs(query) { const exp=need(); return typeof exp.selectRuns==='function'?exp.selectRuns(query):exp.runs||[]; }
  function measurements(query) { const exp=need(); return typeof exp.selectMeasurements==='function'?exp.selectMeasurements(query):exp.measurements||[]; }
  function experiment(ref) { const exp=need(); return typeof exp.experiment==='function'?exp.experiment(ref):null; }
  function sample(ref) { const exp=need(); return typeof exp.sample==='function'?exp.sample(ref):null; }
  function run(ref) { const exp=need(); return typeof exp.run==='function'?exp.run(ref):null; }
  function measurement(ref) { const exp=need(); return typeof exp.measurement==='function'?exp.measurement(ref):null; }
  function get(ref) { const exp=need(); return typeof exp.inspect==='function'?exp.inspect(ref):null; }
  function best(ref) { const exp=need(); return typeof exp.bestMeasurementForSample==='function'?exp.bestMeasurementForSample(ref):null; }
  function tree() { const exp=need(); return typeof exp.tree==='function'?exp.tree():[]; }
  function json(opts) { const exp=need(); return typeof exp.toWorkingJSON==='function'?exp.toWorkingJSON(opts||{}):(LF.DataModel&&LF.DataModel.toWorkingJSON?LF.DataModel.toWorkingJSON(exp,opts||{}):exp); }
  function reanalyze() {
    const exp=need(),out=typeof exp.reanalyze==='function'?exp.reanalyze():summary();
    if (LF.State && LF.State.notify) LF.State.notify('analysis');
    return out;
  }
  function setMismatchFactor(value) {
    const exp=need(),out=typeof exp.setMismatchFactor==='function'?exp.setMismatchFactor(value):null;
    if (LF.State && LF.State.invalidateNomad) LF.State.invalidateNomad(exp,'analysis');
    if (LF.State && LF.State.notify) LF.State.notify('analysis');
    return out||summary();
  }
  function patch(value) {
    const exp=need();
    if(!value||typeof value!=='object')throw new Error('patch() requires {blockId, operation, field?, from?, to?, reason?, evidence?}.');
    const out=typeof exp.applyPatch==='function'?exp.applyPatch(Object.assign({source:'console'},value)):null;
    if(!out||out.ok!==true)return out;
    exp.reanalyze();
    if (LF.State && LF.State.invalidateNomad) LF.State.invalidateNomad(exp,'dataset');
    if (LF.State && LF.State.notify) LF.State.notify('dataset');
    return out;
  }
  function validate(){const exp=need();const out=LF.DataContracts&&LF.DataContracts.validate?LF.DataContracts.validate(exp):{ok:false,errors:[{message:'DataContracts unavailable'}]};if(typeof console!=='undefined'&&console.table){console.info('[LabFlow.Data] contract '+(out.ok?'OK':'FAILED'));console.table((out.errors||[]).concat(out.warnings||[]));}return out;}
  function pipeline(){const exp=need();return{current:LF.DataPipeline&&LF.DataPipeline.status?LF.DataPipeline.status(exp):exp.pipeline||null,plan:LF.DataPipeline&&LF.DataPipeline.stages?LF.DataPipeline.stages():[]};}
  function schema(){return LF.DomainSchema&&LF.DomainSchema.contract?LF.DomainSchema.contract():null;}
  function ownership(){return LF.DomainSchema&&LF.DomainSchema.rootFields?LF.DomainSchema.rootFields():[];}
  function derived(){return LF.DerivedState&&LF.DerivedState.describe?LF.DerivedState.describe():[];}
  function actions(){return(LF.ActionRegistry&&LF.ActionRegistry.actions?LF.ActionRegistry.actions():[]).map(function(id){const d=LF.ActionRegistry.action(id),c=d.contract||{},e=d.execution||{};return{id:id,title:d.title,mode:e.mode,target:c.target,context:c.context,result:c.result,effect:c.effect,guards:(c.guards||[]).slice(),resultStep:e.result_step||'',steps:(e.steps||[]).map(function(x){return{id:x.id,type:x.type,tool:x.tool||'',schema:x.schema||'',validateWith:x.validate_with||''};})};});}
  function actionData(actionId,targetId){const exp=need();if(!LF.ActionData)return null;if(!actionId)return LF.ActionData.snapshot(exp);const id=String(actionId),target=targetId==null?'':String(targetId);return{proposal:LF.ActionData.proposal(exp,id,target),annotation:LF.ActionData.annotation(exp,id),status:LF.ActionData.status(exp,id,target)};}
  function contracts(){return{domain:schema(),pipeline:LF.DataPipeline&&LF.DataPipeline.stages?LF.DataPipeline.stages():[],derived:derived(),actions:actions()};}
  function types(){const fromContracts=LF.DataContracts&&LF.DataContracts.types?LF.DataContracts.types():[];return Array.from(new Set(Object.keys(TYPE_DOCS).concat(fromContracts)));}
  function describe(type) {
    const key=String(type||'').trim().toLowerCase(),contract=LF.DataContracts&&LF.DataContracts.describe?LF.DataContracts.describe(key):null,doc=TYPE_DOCS[key]||null;
    if(contract){const out={type:key,label:contract.label||key,meaning:contract.description||contract.meaning||'',required:(contract.required||[]).slice(),relations:Object.assign({},contract.relations||{})};if(typeof console!=='undefined'){if(console.groupCollapsed)console.groupCollapsed('[LabFlow.Data] '+key);if(console.info)console.info(out.meaning);if(console.table)console.table([{required:out.required.join(', '),relations:JSON.stringify(out.relations)}]);if(console.groupEnd)console.groupEnd();}return out;}
    
    if(!doc)return null;
    if(typeof console!=='undefined'){
      if(console.groupCollapsed)console.groupCollapsed('[LabFlow.Data] '+key);
      if(console.info)console.info(doc.meaning);
      if(console.table)console.table(doc.fields.map(function(field){return{field:field};}));
      if(console.groupEnd)console.groupEnd();
    }
    return {type:key,meaning:doc.meaning,fields:doc.fields.slice()};
  }
  function help(topic) {
    const key=String(topic||'').trim().toLowerCase();
    if(key&&TYPE_DOCS[key]){describe(key);return key+': '+TYPE_DOCS[key].meaning+'\n'+TYPE_DOCS[key].fields.join('\n');}
    const lines=[
      'LabFlow Data Console',
      'Hierarchy: dataset/batch -> experiment/condition -> sample/cell -> run -> measurement -> FW/RV scan -> result',
      '',
      'Examples:',
      '  LabFlow.Data.summary()',
      '  LabFlow.Data.samples({experiment:"N3"})',
      '  LabFlow.Data.measurements({sample:"N3_1_1A"})',
      '  LabFlow.Data.best("N3_1_1A")',
      '  LabFlow.Data.get("N3_1_1A")',
      '  LabFlow.Data.describe("measurement")',
      '  LabFlow.Data.validate()',
      '  LabFlow.Data.pipeline()',
      '  LabFlow.Data.schema()',
      '  LabFlow.Data.ownership()',
      '  LabFlow.Data.derived()',
      '  LabFlow.Data.actions()',
      '  LabFlow.Data.actionData("design.infer", "<device-id>")',
      '  LabFlow.Data.current().measurementsForExperiment("N3")',
      '',
      'Safe mutations:',
      '  LabFlow.Data.setMismatchFactor(1.02)',
      '  LabFlow.Data.patch({target:{kind:"block",id:"..."}, operation:"set", field:"data.rows.0.voc", to:1.12, reason:"manual correction"})',
      '  LabFlow.Data.reanalyze()',
      '',
      'Do not mutate arrays/records by direct assignment; use explicit LabFlow operations so revision/provenance stay valid.'
    ];
    if(typeof console!=='undefined'){
      if(console.groupCollapsed)console.groupCollapsed('[LabFlow.Data] console API');
      if(console.info)console.info(lines.join('\n'));
      if(console.table)console.table(COMMANDS.map(function(x){return{command:'LabFlow.Data.'+x[0],purpose:x[1]};}));
      if(console.info)console.info('Documented types: '+types().join(', ')+' · use LabFlow.Data.help("measurement")');
      if(console.groupEnd)console.groupEnd();
    }
    return lines.concat(['','Commands:']).concat(COMMANDS.map(function(x){return'  LabFlow.Data.'+x[0]+' -> '+x[1];})).join('\n');
  }

  LF.Data = {current:current,summary:summary,experiments:experiments,samples:samples,runs:runs,measurements:measurements,experiment:experiment,sample:sample,run:run,measurement:measurement,get:get,inspect:get,best:best,tree:tree,json:json,patch:patch,reanalyze:reanalyze,setMismatchFactor:setMismatchFactor,validate:validate,pipeline:pipeline,schema:schema,ownership:ownership,derived:derived,actions:actions,actionData:actionData,contracts:contracts,types:types,describe:describe,help:help};
}());
