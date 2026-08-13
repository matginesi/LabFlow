(function () {
  'use strict';
  /* Deterministic NOMAD staging service. It validates and packages the
     canonical experiment locally; the upload surface is an explicit browser
     simulation and never performs a hidden network request. */
  const LF = window.LabFlow = window.LabFlow || {};
  const C = LF.Core;
  const Log = LF.Logger.scope('nomad');
  const SCHEMA_FILE='labflow_schema.archive.yaml';
  const ENTRY_FILE='experiment.archive.yaml';
  const SCHEMA_REFERENCE='../upload/raw/'+SCHEMA_FILE+'#/definitions/section_definitions/0';
  let lastMockPackage=null;

  function yamlString(value) { return '"'+String(value==null?'':value).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n')+'"'; }
  function yamlStrings(values){return '['+(values||[]).map(yamlString).join(', ')+']';}
  function yamlNumbers(values){return '['+(values||[]).map(function(value){return Number.isFinite(Number(value))?String(Number(value)):'null';}).join(', ')+']';}
  function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});}
  const A = LF.Analysis;
  function nomadState(exp) {
    return exp && exp.nomad && typeof exp.nomad === 'object' ? exp.nomad : {};
  }
  function nomadPlan(exp) {
    return exp && exp.nomad && exp.nomad.mappingPlan && typeof exp.nomad.mappingPlan === 'object' ? exp.nomad.mappingPlan : null;
  }


  function buildMapping(exp){
    const settings=LF.Storage.getNomadSettings(),analysis=A.analysisOf(exp)||{},summary=analysis.summary||{},measurements=A.measurementsOf(exp)||[],samples=A.samplesOf(exp)||[];
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
      row('data.labflow_schema_version','canonical.format','1.0',true),
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
      row('data.notes','generated','Generated from the LabFlow canonical Working Copy; original file identities remain provenance.',false)
    ];
    const requiredMissing=rows.filter(function(x){return x.required&&x.status==='missing';});
    const reviewRows=rows.filter(function(x){return x.status==='missing';});
    return {
      format:'labflow-nomad-mapping-v2',
      summary:'Canonical LabFlow fields mapped deterministically to one self-contained NOMAD custom-schema entry.',
      sourceRevision:Number(exp.sync&&exp.sync.revision||0),
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
    const currentRevision=Number(exp&&exp.sync&&exp.sync.revision||0),existing=nomadPlan(exp);
    if(existing&&Number(existing.sourceRevision)===currentRevision&&existing.format==='labflow-nomad-mapping-v2')return existing;
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
      '        labflow_schema_version:',
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
      '  labflow_schema_version: '+yamlString(v('data.labflow_schema_version','1.0')),
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
      '  notes: '+yamlString(v('data.notes','Generated from the LabFlow canonical Working Copy.')),
      ''
    ].join('\n');
  }

  function readme(exp) {
    return '# LabFlow NOMAD staging package\n\nExperiment: '+exp.meta.name+'\n\nThis package keeps RAW, canonical/derived data and correction provenance separate. Inspect `manifest.json`, `metadata/patches.json`, `metadata/provenance.json`, `'+SCHEMA_FILE+'` and `'+ENTRY_FILE+'` before manual upload. The current POC simulates the remote upload step and does not publish anything. Validate processing against the selected NOMAD deployment before publication.\n';
  }

  function correctionAudit(exp){
    const review=exp.aiCorrectionPlan||{},proposals=review.proposals||[],patches=exp.patches||[],findings=A.findingsOf(exp);
    return {
      unresolvedDanger:findings.filter(function(item){return item.status!=='resolved'&&item.severity==='danger';}),
      acceptedUnapplied:proposals.filter(function(item){return item.decision==='accepted'&&!item.applied;}),
      pending:proposals.filter(function(item){return !item.applied&&(item.decision||'pending')==='pending';}),
      incompletePatches:patches.filter(function(item){return !item.id||!item.type||!item.source||!item.createdAt||!item.reason||!(item.evidence&&item.evidence.length);})
    };
  }

  function validate(exp,rawArchive){
    const issues=[],warnings=[];
    if(!exp||!exp.id)return {status:'blocked',issues:['No experiment is loaded.'],warnings:[],checks:{schemaReference:SCHEMA_REFERENCE},checkedAt:new Date().toISOString()};
    const plan=ensureMapping(exp);
    const settings=LF.Storage.getNomadSettings(),audit=correctionAudit(exp);
    const measurements=A.measurementsOf(exp), analysis=A.analysisOf(exp);
    const nomad=nomadState(exp);
    if(!exp.meta||!exp.meta.sourceName)issues.push('Source archive metadata is missing.');
    if(!(measurements||[]).length)issues.push('No parsed measurements are available.');
    if(settings.includeRaw&&!rawArchive)issues.push('RAW source is requested for export but the source archive is unavailable.');
    if(settings.includeDerived&&!(analysis&&analysis.summary))issues.push('Derived export is requested but deterministic analysis is unavailable.');
    if(audit.unresolvedDanger.length)issues.push(audit.unresolvedDanger.length+' unresolved danger finding(s) block a clean NOMAD staging state.');
    if(audit.acceptedUnapplied.length)issues.push(audit.acceptedUnapplied.length+' accepted correction(s) have not been applied to the working interpretation.');
    if(audit.pending.length)warnings.push(audit.pending.length+' correction proposal(s) remain pending review.');
    if(audit.incompletePatches.length)warnings.push(audit.incompletePatches.length+' applied patch record(s) have incomplete reason/evidence provenance.');
    const requiredMissing=(plan.mappings||[]).filter(function(x){return x.required&&x.status!=='mapped';});
    if(requiredMissing.length)issues.push(requiredMissing.length+' required NOMAD mapping field(s) are missing.');
    const finiteRows=(measurements||[]).filter(function(m){return Number.isFinite(Number(m.bestEff));});
    const ids=new Set(),duplicates=[];finiteRows.forEach(function(m){if(ids.has(String(m.id)))duplicates.push(m.id);ids.add(String(m.id));});
    if(duplicates.length)issues.push(duplicates.length+' duplicate canonical measurement ID(s) would make the NOMAD entry ambiguous.');
    if(finiteRows.some(function(m){return !String(m.sample||'').trim();}))issues.push('One or more exportable measurements have no canonical sample identity.');
    const designItems=[].concat((A.designOf(exp).solutions)||[],(A.designOf(exp).stack)||[]);
    const inferred=designItems.filter(function(x){return x.status==='ai_inferred';}).length;
    const unknown=designItems.filter(function(x){return !x.status||x.status==='unknown';}).length;
    if(inferred)warnings.push(inferred+' experimental-design item(s) are AI-inferred and must remain labelled as such.');
    if(unknown)warnings.push(unknown+' experimental-design item(s) remain unconfirmed.');
    const schemaContractOk=/LabFlowExperiment:/.test(schemaYaml())&&dataYaml(exp,settings,plan).indexOf('m_def: '+yamlString(SCHEMA_REFERENCE))>=0;
    if(!schemaContractOk)issues.push('The NOMAD schema-to-entry reference does not match the packaged schema definition.');
    const report=LF.Report&&LF.Report.activeMarkdown?LF.Report.activeMarkdown(exp):exp.report&&exp.report.markdown||'';
    if(!String(report||'').trim())warnings.push('The report document is empty.');
    const result={status:issues.length?'blocked':warnings.length?'review':'ready',issues:issues,warnings:warnings,checks:{schemaReference:SCHEMA_REFERENCE,schemaContractOk:schemaContractOk,unresolvedDanger:audit.unresolvedDanger.length,acceptedUnapplied:audit.acceptedUnapplied.length,pendingCorrections:audit.pending.length,incompletePatchProvenance:audit.incompletePatches.length,mappedFields:(plan.mappings||[]).filter(function(x){return x.status==='mapped';}).length,missingFields:(plan.mappings||[]).filter(function(x){return x.status==='missing';}).length},checkedAt:new Date().toISOString()};
    const targetExp=exp;targetExp.nomad=targetExp.nomad||{};targetExp.nomad.validation=result;return result;
  }

  function provenanceSnapshot(exp){
    return {format:'labflow-provenance',experimentId:exp.id,dataBasis:((LF.State&&LF.State.isDirty&&LF.State.isDirty())||(exp.patches||[]).length)?'Modified Working Copy':'Original import interpretation',source:{name:exp.meta&&exp.meta.sourceName||'',size:exp.raw&&exp.raw.sourceSize||0,immutable:true},workingRevision:exp.sync&&exp.sync.revision||0,savedRevision:exp.sync&&exp.sync.savedRevision||0,workingDirty:LF.State&&LF.State.isDirty?LF.State.isDirty():!!(exp.sync&&exp.sync.dirty),statusVocabulary:['RAW','parsed','derived','recovered','AI inferred','user confirmed','missing','excluded'],patchCount:(exp.patches||[]).length,generatedAt:new Date().toISOString()};
  }

  function packageManifest(exp,settings,validation,files){
    const plan=ensureMapping(exp),dirty=LF.State&&LF.State.isDirty?LF.State.isDirty():!!(exp.sync&&exp.sync.dirty);return {format:'labflow-nomad-staging',generatedAt:new Date().toISOString(),experimentId:exp.id,experimentName:exp.meta.name,dataState:{basis:dirty||(exp.patches||[]).length?'Modified Working Copy':'Original import interpretation',revision:exp.sync&&exp.sync.revision||0,savedRevision:exp.sync&&exp.sync.savedRevision||0,dirty:dirty,appliedChanges:(exp.patches||[]).length,rawImmutable:true},missingInformation:{mapping:(plan.missing||[]).length,validationIssues:(validation.issues||[]).length,validationWarnings:(validation.warnings||[]).length},schemaReference:SCHEMA_REFERENCE,validation:validation,options:settings,files:files.map(function(path){return{path:path,role:path===ENTRY_FILE?'nomad_entry':path===SCHEMA_FILE?'nomad_schema':path==='raw/source.zip'?'immutable_raw':path==='derived/measurements.csv'?'canonical_table':path.indexOf('metadata/')===0?'provenance_or_review':'supporting'};})};
  }

  async function buildPackage(exp, rawArchive, onProgress) {
    const progress=typeof onProgress==='function'?onProgress:function(){};
    const settings=LF.Storage.getNomadSettings(),plan=ensureMapping(exp),validation=validate(exp,rawArchive);
    if(LF.Report&&LF.Report.syncDesignEvidence)LF.Report.syncDesignEvidence(exp);progress({stage:'Preparing staging files',progress:.12});
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
    if(settings.includeDerived){zip.file('derived/measurements.csv',LF.Analysis.toCSV(exp));zip.file('derived/analysis.json',C.safeJson({analysis:A.analysisOf(exp),analysisSummary:LF.AnalysisSummary&&LF.AnalysisSummary.ensure?LF.AnalysisSummary.ensure(exp):null},2));}
    if(settings.includeReport){zip.file('report/laboratory-report.md',exp.report&&exp.report.labMarkdown||'');zip.file('report/paper-draft.md',exp.report&&exp.report.paperMarkdown||'');if(LF.Report&&LF.Report.activeMarkdown)zip.file('report/active-document.md',LF.Report.activeMarkdown(exp)||'');}
    if(settings.includeRaw&&rawArchive)zip.file('raw/source.zip',rawArchive);
    const packageFiles=Object.keys(zip.files).concat(['manifest.json']);
    zip.file('manifest.json',C.safeJson(packageManifest(exp,settings,validation,packageFiles),2));
    Log.info('package.contents',{settings:settings,files:Object.keys(zip.files)});progress({stage:'Building ZIP package',progress:.28});
    const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:4}},function(meta){progress({stage:meta.currentFile?'Packing '+meta.currentFile:'Building ZIP package',progress:.28+(Number(meta.percent||0)/100)*.68});});
    progress({stage:'Package ready',progress:1});return blob;
  }

  async function exportZip(exp, rawArchive, onProgress) {
    const end=Log.timer('export.zip',{experimentId:exp&&exp.id,name:exp&&exp.meta&&exp.meta.name});
    const blob=await buildPackage(exp,rawArchive,onProgress);const filename=C.safeName(exp.meta.name)+'_nomad_staging.zip';C.downloadBlob(blob,filename);end({filename:filename,bytes:blob.size},'info');return blob;
  }

  async function simulateUpload(exp,rawArchive,onProgress){
    const progress=typeof onProgress==='function'?onProgress:function(){};
    const validation=validate(exp,rawArchive);if(validation.status==='blocked')throw new Error('NOMAD staging validation is blocked. Resolve the listed issues before upload.');
    progress({stage:'Validating staging package',progress:.08,message:'Checking experiment, mapping and provenance'});await sleep(180);
    const blob=await buildPackage(exp,rawArchive,function(info){progress({stage:info.stage,progress:.1+info.progress*.42,message:'Preparing files for upload'});});
    progress({stage:'Creating upload',progress:.58,message:'Simulating POST to the configured NOMAD /uploads resource'});await sleep(260);
    const uploadId='demo_'+C.uid('upload').replace(/[^A-Za-z0-9_-]/g,'').slice(-18);
    const filename=C.safeName(exp.meta.name)+'_nomad_mock_'+uploadId+'.zip';
    lastMockPackage={experimentId:exp.id,uploadId:uploadId,blob:blob,filename:filename};
    exp.nomad=exp.nomad||{};exp.nomad.upload={mode:'demo',uploadId:uploadId,status:'processing',processStatus:'RUNNING',published:false,entries:0,bytes:blob.size,createdAt:new Date().toISOString(),instance:(LF.Storage.getNomadSettings()||{}).instance||''};
    progress({stage:'Processing upload',progress:.74,message:'NOMAD would inspect uploaded raw files and create/process entries'});await sleep(420);
    exp.nomad.upload.processStatus='SUCCESS';exp.nomad.upload.status='processed';exp.nomad.upload.entries=1;exp.nomad.upload.completedAt=new Date().toISOString();
    progress({stage:'Inspecting generated entries',progress:.92,message:'Upload processed · publication remains a separate action'});await sleep(220);
    progress({stage:'Upload ready for review',progress:1,message:'Demo upload complete'});
    Log.info('upload.simulated',{uploadId:uploadId,bytes:blob.size,entries:1});return exp.nomad.upload;
  }

  function hasMockPackage(exp){return !!(lastMockPackage&&exp&&lastMockPackage.experimentId===exp.id&&exp.nomad&&exp.nomad.upload&&lastMockPackage.uploadId===exp.nomad.upload.uploadId);}
  function downloadMockPackage(exp){
    if(!hasMockPackage(exp))throw new Error('The exact mock-upload package is not available in this browser session. Run the upload simulation again.');
    C.downloadBlob(lastMockPackage.blob,lastMockPackage.filename);
    Log.info('upload.package-downloaded',{uploadId:lastMockPackage.uploadId,filename:lastMockPackage.filename,bytes:lastMockPackage.blob.size});
    return lastMockPackage.blob;
  }

  LF.Nomad = { exportZip:exportZip, buildPackage:buildPackage, validate:validate, buildMapping:buildMapping, ensureMapping:ensureMapping, simulateUpload:simulateUpload, hasMockPackage:hasMockPackage, downloadMockPackage:downloadMockPackage, schemaYaml:schemaYaml, dataYaml:dataYaml, schemaReference:SCHEMA_REFERENCE };
}());
