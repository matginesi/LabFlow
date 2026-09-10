(function () {
  'use strict';
  /* Deterministic NOMAD staging service. It validates and packages the
     canonical experiment locally; the upload surface is an explicit browser
     simulation and never performs a hidden network request. */
  const LF = window.LabFlow = window.LabFlow || {};
  const C = LF.Core;
  const Log = LF.Logger.scope('export-nomad');
  const SCHEMA_FILE='labflow_schema.archive.yaml';
  const ENTRY_FILE='experiment.archive.yaml';
  const SCHEMA_REFERENCE='../upload/raw/'+SCHEMA_FILE+'#LabFlowExperiment';

  function yamlString(value) { return '"'+String(value==null?'':value).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n')+'"'; }
  function yamlStrings(values){return '['+(values||[]).map(yamlString).join(', ')+']';}
  function yamlNumbers(values){return '['+(values||[]).map(function(value){return Number.isFinite(Number(value))?String(Number(value)):'null';}).join(', ')+']';}
  const A = LF.Analysis;
    function nomadPlan(exp) {
    return exp && exp.nomad && exp.nomad.mappingPlan && typeof exp.nomad.mappingPlan === 'object' ? exp.nomad.mappingPlan : null;
  }


  function exportOptionsSignature(settings){return JSON.stringify({includeRaw:!!(settings&&settings.includeRaw),includeDerived:!!(settings&&settings.includeDerived)});}

  function buildMapping(exp){
    const settings=LF.Storage.getExportSettings(),analysis=A.analysisOf(exp)||{},summary=analysis.summary||{},measurements=(A.measurementsOf(exp)||[]).filter(function(m){return!m.excluded;}),samples=A.samplesOf(exp)||[];
    const exported=measurements.filter(function(m){return Number.isFinite(Number(m.bestEff));});
    function row(nomadPath,labflowPath,value,required,note){
      const disabled=value&&value.__disabled===true,actual=disabled?'':value,missing=!disabled&&(actual==null||actual===''||(Array.isArray(actual)&&!actual.length));
      return {
        nomad_path:nomadPath,
        labflow_path:labflowPath,
        status:disabled?'disabled':missing?'missing':'mapped',
        required:!!required,
        value:disabled?null:actual,
        value_summary:disabled?'not included':Array.isArray(actual)?actual.length+' values':String(actual==null?'':actual),
        note:note||''
      };
    }
    const rows=[
      row('data.m_def','NOMAD schema reference',SCHEMA_REFERENCE,true,'Custom schema entry reference'),
      row('data.experiment_name','meta.name',exp.meta&&exp.meta.name,true),
      row('data.source_file','meta.sourceName',exp.meta&&exp.meta.sourceName,true),
      row('data.working_revision','sync.revision',Number(exp.sync&&exp.sync.revision||0),true),
      row('data.sample_count','samples.length',samples.length,true),
      row('data.measurement_count','measurements.length',measurements.length,true),
      row('data.eligible_measurement_count','measurements[].rankingEligible',exported.filter(function(x){return x.rankingEligible!==false;}).length,true),
      row('data.best_efficiency','measurements[].bestEff',exported.length?Math.max.apply(null,exported.map(function(x){return Number(x.bestEff);})):null,false),
      row('data.sample_names','samples[].name',samples.map(function(x){return x.name;}),true),
      row('data.measurement_ids','measurements[].id',exported.map(function(x){return x.id;}),true),
      row('data.measurement_samples','measurements[].sample',exported.map(function(x){return x.sample;}),true),
      row('data.measurement_efficiencies','measurements[].bestEff',exported.map(function(x){return Number(x.bestEff);}),true),
      row('data.measurement_quality','measurements[].qualityStatus',exported.map(function(x){return x.qualityStatus||'unknown';}),true),
      row('data.provenance_file','generated','metadata/provenance.json',true),
      row('data.canonical_table_file','generated',settings.includeDerived?'derived/measurements.csv':{__disabled:true},false),
      row('data.raw_source_file','raw.sourceArchive',settings.includeRaw?'raw/source.zip':{__disabled:true},false),
      row('data.notes','generated','Generated from LabFlow Data; the uploaded source archive remains immutable provenance.',false)
    ];
    const requiredMissing=rows.filter(function(x){return x.required&&x.status==='missing';});
    const reviewRows=rows.filter(function(x){return x.status==='missing';});
    return {
      format:'labflow-nomad-mapping',
      summary:'LabFlow data mapped deterministically to one NOMAD custom-schema entry.',
      sourceRevision:Number(exp.sync&&exp.sync.revision||0),
      optionsSignature:exportOptionsSignature(settings),
      generatedAt:new Date().toISOString(),
      schemaFile:SCHEMA_FILE,
      entryFile:ENTRY_FILE,
      schemaReference:SCHEMA_REFERENCE,
      mappings:rows,
      missing:reviewRows.map(function(x){return{field:x.nomad_path,required:x.required,reason:'No canonical value is currently available.',labflow_path:x.labflow_path};}),
      readiness:requiredMissing.length?'blocked':reviewRows.length?'review':'ready'
    };
  }

  function ensureMapping(exp){
    const currentRevision=Number(exp&&exp.sync&&exp.sync.revision||0),existing=nomadPlan(exp),settings=LF.Storage.getExportSettings(),signature=exportOptionsSignature(settings);
    if(existing&&Number(existing.sourceRevision)===currentRevision&&existing.format==='labflow-nomad-mapping'&&existing.optionsSignature===signature)return existing;
    const plan=buildMapping(exp);
    exp.nomad=exp.nomad||{};exp.nomad.mappingPlan=plan;
    return plan;
  }

  function mappingValue(plan,path,fallback){
    const row=(plan&&plan.mappings||[]).find(function(x){return x.nomad_path===path;});
    return row&&row.status!=='disabled'?row.value:fallback;
  }

  function schemaYaml() {
    return [
      'definitions:',
      '  name: LabFlow Perovskite Experiment (prototype)',
      '  sections:',
      '    LabFlowExperiment:',
      '      base_sections:',
      '        - nomad.datamodel.data.EntryData',
      '      quantities:',
      '        experiment_name:',
      '          type: str',
      '        source_file:',
      '          type: str',
      '        working_revision:',
      '          type: int',
      '        sample_count:',
      '          type: int',
      '        measurement_count:',
      '          type: int',
      '        eligible_measurement_count:',
      '          type: int',
      '        best_efficiency:',
      '          type: float',
      '          unit: percent',
      '        sample_names:',
      '          type: str',
      "          shape: ['*']",
      '        measurement_ids:',
      '          type: str',
      "          shape: ['*']",
      '        measurement_samples:',
      '          type: str',
      "          shape: ['*']",
      '        measurement_efficiencies:',
      '          type: float',
      "          shape: ['*']",
      '          unit: percent',
      '        measurement_quality:',
      '          type: str',
      "          shape: ['*']",
      '        provenance_file:',
      '          type: str',
      '        canonical_table_file:',
      '          type: str',
      '        raw_source_file:',
      '          type: str',
      '        notes:',
      '          type: str',
      ''
    ].join('\n');
  }

  function dataYaml(exp,settings,preparedPlan) {
    const plan=preparedPlan||ensureMapping(exp);
    function v(path,fallback){return mappingValue(plan,path,fallback);}
    return [
      '# LabFlow staging archive for NOMAD.',
      '# Generated deterministically from the same mapping_plan.json shown in the LabFlow UI.',
      '# Validate the custom schema against the target NOMAD deployment before publication.',
      'data:',
      '  m_def: '+yamlString(v('data.m_def',SCHEMA_REFERENCE)),
      '  experiment_name: '+yamlString(v('data.experiment_name','')),
      '  source_file: '+yamlString(v('data.source_file','')),
      '  working_revision: '+Number(v('data.working_revision',0)),
      '  sample_count: '+Number(v('data.sample_count',0)),
      '  measurement_count: '+Number(v('data.measurement_count',0)),
      '  eligible_measurement_count: '+Number(v('data.eligible_measurement_count',0)),
      '  best_efficiency: '+(Number.isFinite(Number(v('data.best_efficiency',null)))?String(Number(v('data.best_efficiency',null))):'null'),
      '  sample_names: '+yamlStrings(v('data.sample_names',[])),
      '  measurement_ids: '+yamlStrings(v('data.measurement_ids',[])),
      '  measurement_samples: '+yamlStrings(v('data.measurement_samples',[])),
      '  measurement_efficiencies: '+yamlNumbers(v('data.measurement_efficiencies',[])),
      '  measurement_quality: '+yamlStrings(v('data.measurement_quality',[])),
      '  provenance_file: '+yamlString(v('data.provenance_file','metadata/provenance.json')),
      '  canonical_table_file: '+yamlString(v('data.canonical_table_file','')),
      '  raw_source_file: '+yamlString(v('data.raw_source_file','')),
      '  notes: '+yamlString(v('data.notes','Generated from the LabFlow canonical LabFlow Data.')),
      ''
    ].join('\n');
  }

  function readme(exp) {
    return '# LabFlow NOMAD staging package\n\nExperiment: '+exp.meta.name+'\n\nThis package keeps RAW, canonical/derived data and correction provenance separate. Inspect `manifest.json`, `metadata/patches.json`, `metadata/provenance.json`, `'+SCHEMA_FILE+'` and `'+ENTRY_FILE+'` before manual upload. The current POC simulates the remote upload step and does not publish anything. Validate processing against the selected NOMAD deployment before publication.\n';
  }

  function findingMeasurement(exp,f){const id=String(f&&f.measurementId||f&&f.target||'');return (A.measurementsOf(exp)||[]).find(function(m){return String(m.id)===id;})||null;}

  function correctionAudit(exp){
    const review=LF.ActionData&&LF.ActionData.proposal(exp,'dataset.resolve-ambiguities')||{},proposals=review.proposals||[],patches=exp.patches||[],findings=A.findingsOf(exp);
    return {
      unresolvedDanger:findings.filter(function(item){if(item.status==='resolved'||item.severity!=='danger')return false;const m=findingMeasurement(exp,item);return !m||m.excluded!==true;}),
      acceptedUnapplied:proposals.filter(function(item){return item.decision==='accepted'&&!item.applied;}),
      pending:proposals.filter(function(item){return !item.applied&&(item.decision||'pending')==='pending';}),
      incompletePatches:patches.filter(function(item){return !item.id||!item.patchType||!item.source||!item.createdAt||!item.reason||!(item.evidence&&item.evidence.length);})
    };
  }

  function validate(exp,rawArchive){
    const issues=[],warnings=[],problems=[];
    function problem(code,message,fix){issues.push(message);problems.push({code:code,severity:'blocking',message:message,fix:fix||null});}
    function warning(code,message,fix){warnings.push(message);problems.push({code:code,severity:'warning',message:message,fix:fix||null});}
    if(!exp||!exp.id)return {status:'blocked',issues:['No experiment is loaded.'],warnings:[],problems:[{code:'no_experiment',severity:'blocking',message:'No experiment is loaded.',fix:{kind:'route',route:'experiment-import',label:'Upload experiment'}}],checks:{schemaReference:SCHEMA_REFERENCE},checkedAt:new Date().toISOString()};
    const plan=ensureMapping(exp);
    const settings=LF.Storage.getExportSettings(),audit=correctionAudit(exp);
    const measurements=A.measurementsOf(exp), analysis=A.analysisOf(exp);
    if(!exp.meta||!exp.meta.sourceName)problem('source_metadata_missing','Source archive metadata is missing.',exp.raw&&exp.raw.sourceName?{kind:'repair',id:'restore-source-name',label:'Restore source name'}:{kind:'route',route:'experiment-import',label:'Review source'});
    if(!(measurements||[]).length)problem('measurements_missing','No parsed measurements are available.',{kind:'route',route:'experiment-import',label:'Return to Upload & Review'});
    if(settings.includeRaw&&!rawArchive)problem('raw_source_unavailable','RAW source is requested for export but the source archive is unavailable.',{kind:'option',option:'includeRaw',value:false,label:'Export without RAW'});
    if(settings.includeDerived&&!(analysis&&analysis.summary))problem('derived_unavailable','Derived export is requested but deterministic analysis is unavailable.',{kind:'option',option:'includeDerived',value:false,label:'Export without derived tables'});
    if(audit.unresolvedDanger.length)problem('danger_findings',audit.unresolvedDanger.length+' unresolved danger finding(s) block a clean NOMAD staging state.',{kind:'focus',target:'danger-findings',label:'Inspect here'});
    if(audit.acceptedUnapplied.length)problem('accepted_unapplied',audit.acceptedUnapplied.length+' accepted correction(s) have not been applied to the LabFlow data representation.',{kind:'focus',target:'accepted-corrections',label:'Inspect here'});
    if(audit.pending.length)warning('pending_corrections',audit.pending.length+' correction proposal(s) remain pending review.',{kind:'focus',target:'pending-corrections',label:'Inspect here'});
    if(audit.incompletePatches.length)warning('patch_provenance',audit.incompletePatches.length+' applied patch record(s) have incomplete reason/evidence provenance.',{kind:'focus',target:'patch-provenance',label:'Inspect here'});
    const requiredMissing=(plan.mappings||[]).filter(function(x){return x.required&&x.status!=='mapped';});
    if(requiredMissing.length)problem('required_mapping_missing',requiredMissing.length+' required NOMAD mapping field(s) are missing.',{kind:'route',route:'experiment-import',label:'Review missing data',fields:requiredMissing.map(function(x){return x.labflow_path;})});
    const finiteRows=(measurements||[]).filter(function(m){return Number.isFinite(Number(m.bestEff));});
    const ids=new Set(),duplicates=[];finiteRows.forEach(function(m){if(ids.has(String(m.id)))duplicates.push(m.id);ids.add(String(m.id));});
    if(duplicates.length)problem('duplicate_measurement_ids',duplicates.length+' duplicate canonical measurement ID(s) would make the NOMAD entry ambiguous.',{kind:'route',route:'experiment-import',label:'Review measurement identity'});
    if(finiteRows.some(function(m){return !String(m.sample||'').trim();}))problem('measurement_sample_missing','One or more exportable measurements have no canonical sample identity.',{kind:'review_or_action',route:'experiment-import',action:'dataset.resolve-ambiguities',label:'Resolve sample identity'});
    const designItems=[].concat((A.designOf(exp).solutions)||[],(A.designOf(exp).stack)||[]);
    const inferred=designItems.filter(function(x){return x.status==='ai_inferred';}).length;
    const unknown=designItems.filter(function(x){return !x.status||x.status==='unknown';}).length;
    if(inferred)warning('design_ai_inferred',inferred+' experimental-design item(s) are AI-inferred and must remain labelled as such.',{kind:'route',route:'experiment-design',label:'Review Design'});
    if(unknown)warning('design_unconfirmed',unknown+' experimental-design item(s) remain unconfirmed.',{kind:'route',route:'experiment-design',label:'Review Design'});
    const schemaText=schemaYaml(),entryText=dataYaml(exp,settings,plan),schemaContractOk=/LabFlowExperiment:/.test(schemaText)&&schemaText.indexOf('base_sections:')>=0&&schemaText.indexOf('nomad.datamodel.data.EntryData')>=0&&entryText.indexOf('m_def: '+yamlString(SCHEMA_REFERENCE))>=0;
    if(!schemaContractOk)problem('schema_contract_invalid','The generated NOMAD schema and entry reference are inconsistent.',{kind:'refresh',label:'Rebuild mapping'});
    const result={audit:audit,status:issues.length?'blocked':warnings.length?'review':'ready',issues:issues,warnings:warnings,problems:problems,checks:{schemaReference:SCHEMA_REFERENCE,schemaContractOk:schemaContractOk,unresolvedDanger:audit.unresolvedDanger.length,acceptedUnapplied:audit.acceptedUnapplied.length,pendingCorrections:audit.pending.length,incompletePatchProvenance:audit.incompletePatches.length,mappedFields:(plan.mappings||[]).filter(function(x){return x.status==='mapped';}).length,missingFields:(plan.mappings||[]).filter(function(x){return x.status==='missing';}).length},checkedAt:new Date().toISOString()};
    exp.nomad=exp.nomad||{};exp.nomad.validation=result;return result;
  }

  function repairPatchProvenance(exp){
    const audit=correctionAudit(exp),rows=audit.incompletePatches||[];
    rows.forEach(function(p){
      p.source=String(p.source||'system');
      p.createdAt=p.createdAt||p.appliedAt||new Date().toISOString();
      if(!p.reason)p.reason='Reconstructed from the applied '+String(p.patchType||'data')+' patch recorded in LabFlow Data.';
      if(!Array.isArray(p.evidence)||!p.evidence.length){const target=p.target&&p.target.id?String(p.target.kind||'record')+':'+String(p.target.id):'current LabFlow Data';p.evidence=['Applied patch metadata · '+target+(p.field?' · '+p.field:'')];p.provenanceQuality='reconstructed';}
    });
    return rows.length;
  }

  function provenanceSnapshot(exp){return {format:'labflow-provenance',experimentId:exp.id,dataBasis:(exp.patches||[]).length?'LabFlow data with tracked changes':'Imported data interpretation',source:{name:exp.meta&&exp.meta.sourceName||'',size:exp.raw&&exp.raw.sourceSize||0,immutable:true},revision:exp.sync&&exp.sync.revision||0,statusVocabulary:['RAW','parsed','derived','recovered','AI inferred','user confirmed','missing','excluded'],patchCount:(exp.patches||[]).length,generatedAt:new Date().toISOString()};
  }

  function packageManifest(exp,settings,validation,files){const plan=ensureMapping(exp);return {format:'labflow-nomad-staging',generatedAt:new Date().toISOString(),experimentId:exp.id,experimentName:exp.meta.name,dataState:{basis:(exp.patches||[]).length?'LabFlow data with tracked changes':'Imported data interpretation',revision:exp.sync&&exp.sync.revision||0,appliedChanges:(exp.patches||[]).length,rawImmutable:true},missingInformation:{mapping:(plan.missing||[]).length,validationIssues:(validation.issues||[]).length,validationWarnings:(validation.warnings||[]).length},schemaReference:SCHEMA_REFERENCE,validation:validation,options:settings,files:files.map(function(path){return{path:path,role:path===ENTRY_FILE?'nomad_entry':path===SCHEMA_FILE?'nomad_schema':path==='raw/source.zip'?'immutable_raw':path==='derived/measurements.csv'?'canonical_table':path.indexOf('metadata/')===0?'provenance_or_review':'supporting'};})};
  }

  async function buildPackage(exp, rawArchive, onProgress) {
    const progress=typeof onProgress==='function'?onProgress:function(){};
    const settings=LF.Storage.getExportSettings(),plan=ensureMapping(exp),validation=validate(exp,rawArchive);
    if(validation.status==='blocked')throw new Error('NOMAD export is blocked: '+String((validation.issues||[])[0]||'resolve the readiness issues first.'));
    progress({stage:'Preparing staging files',progress:.12});
    const zip=new JSZip();
    zip.file('README.md',readme(exp));
    zip.file(SCHEMA_FILE,schemaYaml());
    zip.file(ENTRY_FILE,dataYaml(exp,settings,plan));
    const working = (LF.DataModel && LF.DataModel.toWorkingJSON) ? LF.DataModel.toWorkingJSON(exp,{rows:null}) : exp;
    zip.file('metadata/labflow_experiment.json',C.safeJson(working,2));
    zip.file('metadata/patches.json',C.safeJson({patches:exp.patches||[]},2));
    zip.file('metadata/provenance.json',C.safeJson(provenanceSnapshot(exp),2));
    if(LF.Export&&LF.Export.canonicalSnapshot)zip.file('metadata/canonical.json',C.safeJson(LF.Export.canonicalSnapshot(exp),2));
    if(plan)zip.file('metadata/mapping_plan.json',C.safeJson(plan,2));
    if(settings.includeDerived){zip.file('derived/measurements.csv',LF.Analysis.toCSV(exp,{excludeExcluded:true}));zip.file('derived/analysis.json',C.safeJson({analysis:A.analysisOf(exp),analysisSummary:LF.AnalysisSummary&&LF.AnalysisSummary.ensure?LF.AnalysisSummary.ensure(exp):null},2));}
    if(settings.includeRaw&&rawArchive)zip.file('raw/source.zip',rawArchive);
    const packageFiles=Object.keys(zip.files).concat(['manifest.json']);
    zip.file('manifest.json',C.safeJson(packageManifest(exp,settings,validation,packageFiles),2));
    Log.info('package.contents',{settings:settings,files:Object.keys(zip.files)});progress({stage:'Building ZIP package',progress:.28});
    const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:4}},function(meta){progress({stage:meta.currentFile?'Packing '+meta.currentFile:'Building ZIP package',progress:.28+(Number(meta.percent||0)/100)*.68});});
    progress({stage:'Package ready',progress:1});return blob;
  }

  function exportEntry(exp){const settings=LF.Storage.getExportSettings(),plan=ensureMapping(exp),validation=validate(exp,exp.raw&&exp.raw.sourceArchive);if(validation.status==='blocked')throw new Error('NOMAD export is blocked. Resolve the listed issues first.');const text=dataYaml(exp,settings,plan),blob=new Blob([text],{type:'text/yaml;charset=utf-8'}),filename=C.safeName(exp.meta.name)+'_nomad.archive.yaml';C.downloadBlob(blob,filename);Log.info('export.entry',{filename:filename,bytes:blob.size});return blob;}

  async function exportZip(exp, rawArchive, onProgress) {
    const end=Log.timer('export.zip',{experimentId:exp&&exp.id,name:exp&&exp.meta&&exp.meta.name});
    const blob=await buildPackage(exp,rawArchive,onProgress);const filename=C.safeName(exp.meta.name)+'_nomad_staging.zip';C.downloadBlob(blob,filename);end({filename:filename,bytes:blob.size},'info');return blob;
  }


  LF.NomadExport = { exportEntry:exportEntry, exportZip:exportZip, buildPackage:buildPackage, validate:validate,correctionAudit:correctionAudit,repairPatchProvenance:repairPatchProvenance, buildMapping:buildMapping, ensureMapping:ensureMapping, schemaYaml:schemaYaml, dataYaml:dataYaml };
}());
