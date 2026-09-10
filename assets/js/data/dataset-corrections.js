(function () {
  'use strict';

  const LF = window.LabFlow = window.LabFlow || {};
  if (!LF.Core || !LF.DomainSchema || !LF.DataModel || !LF.Parser || !LF.CanonicalStore || !LF.DataContracts || !LF.DerivedState || !LF.DesignModel) {
    throw new Error('dataset-corrections.js requires Core, DomainSchema, DataModel, Parser, CanonicalStore, DataContracts, DerivedState and DesignModel.');
  }
  const Log = LF.Logger ? LF.Logger.scope('dataset-corrections') : null;

  function compact(v){return LF.CanonicalStore.compact(v,420);}
  function clip(v,n){const s=String(v==null?'':v);return s.length>(n||500)?s.slice(0,n||500)+'…':s;}
  function rebuildSamples(exp){
    const previous=new Map((exp.samples||[]).map(function(s){return[String(s.id||s.name),s];})),byId=new Map(),byName=new Map();
    (exp.measurements||[]).forEach(function(m){
      const key=String(m.sampleId||m.sample||'');if(!key)return;
      let sample=byId.get(key)||byName.get(String(m.sample||''));
      if(!sample){
        const prev=previous.get(key)||Array.from(previous.values()).find(function(x){return String(x.name||'')===String(m.sample||'');})||{};
        sample=LF.DomainSchema.create('sample',{id:m.sampleId||prev.id||'',name:m.sample||prev.name||'',rawName:prev.rawName||m.rawSample||m.sample||'',aliases:(prev.aliases||[]).slice(),group:m.group||prev.group||'',experiment:m.experiment||prev.experiment||m.group||'',experimentId:m.experimentId||prev.experimentId||'',position:m.position||prev.position||'',cell:m.cell||prev.cell||'',isRef:m.isRef!=null?!!m.isRef:!!prev.isRef,runIds:[],measurementIds:[]});
        byId.set(String(sample.id),sample);byName.set(String(sample.name),sample);
      }
      if(!sample.measurementIds.includes(m.id))sample.measurementIds.push(m.id);
      if(m.runId&&!sample.runIds.includes(m.runId))sample.runIds.push(m.runId);
      [m.rawSample].concat(m.sampleAliases||[]).filter(Boolean).forEach(function(a){if(a!==sample.name&&!sample.aliases.includes(a))sample.aliases.push(a);});
    });
    exp.samples=Array.from(byId.values());
    const sampleIds=new Set(exp.samples.map(function(x){return String(x.id);}));
    (exp.experiments||[]).forEach(function(x){x.sampleIds=(x.sampleIds||[]).filter(function(id){return sampleIds.has(String(id));});x.measurementIds=[];x.runIds=[];});
    exp.samples.forEach(function(sample){const ex=(exp.experiments||[]).find(function(x){return String(x.id)===String(sample.experimentId)||String(x.name)===String(sample.experiment||sample.group);});if(ex){sample.experimentId=ex.id;sample.experiment=ex.name;sample.group=ex.name;if(!ex.sampleIds.includes(sample.id))ex.sampleIds.push(sample.id);}});
    (exp.runs||[]).forEach(function(run){const sample=byId.get(String(run.sampleId))||byName.get(String(run.sample||''));if(sample){run.sampleId=sample.id;run.sample=sample.name;run.experimentId=sample.experimentId;run.experiment=sample.experiment;if(!sample.runIds.includes(run.id))sample.runIds.push(run.id);const ex=(exp.experiments||[]).find(function(x){return String(x.id)===String(run.experimentId);});if(ex&&!ex.runIds.includes(run.id))ex.runIds.push(run.id);}});
    (exp.measurements||[]).forEach(function(m){const sample=byId.get(String(m.sampleId))||byName.get(String(m.sample||''));if(sample){m.sampleId=sample.id;m.sample=sample.name;m.experimentId=sample.experimentId;m.experiment=sample.experiment;m.group=sample.experiment;const ex=(exp.experiments||[]).find(function(x){return String(x.id)===String(m.experimentId);});if(ex&&!ex.measurementIds.includes(m.id))ex.measurementIds.push(m.id);}});
    return exp.samples;
  }

  function norm(v){return String(v==null?'':(v&&typeof v==='object'&&!Array.isArray(v)?(v.value!=null?v.value:(v.id||v.path||v.name||'')):v)).trim().replace(/\\/g,'/').replace(/\s+/g,' ').toLowerCase();}
  function proposalMeasurements(exp,p){
    const explicitIds=[p&&p.target,p&&p.measurement_id].map(norm).filter(Boolean),exact=(exp.measurements||[]).filter(function(m){return explicitIds.includes(norm(m.id));});
    if(exact.length)return exact;
    const raw=[p&&p.target,p&&p.before,p&&p.measurement_id,p&&p.file,p&&p.sample,p&&p.finding_id],tokens=raw.map(norm).filter(Boolean);
    const findingTokens=[];
    (exp.findings||[]).forEach(function(f){
      const ids=[f.id,f.target,f.measurementId].map(norm).filter(Boolean);
      if(tokens.some(function(t){return ids.includes(t);})){
        [f.measurementId,f.target].map(norm).filter(Boolean).forEach(function(x){findingTokens.push(x);});
      }
    });
    const sampleTokens=[];
    (exp.samples||[]).forEach(function(sample){
      const ids=[sample.id,sample.name,sample.rawName].concat(sample.aliases||[]).map(norm).filter(Boolean);
      if(tokens.concat(findingTokens).some(function(t){return ids.includes(t);})){
        ids.forEach(function(x){sampleTokens.push(x);});
      }
    });
    const all=Array.from(new Set(tokens.concat(findingTokens,sampleTokens)));
    return(exp.measurements||[]).filter(function(m){
      const vals=[m.id,m.file,m.path,m.sample,m.rawSample,m.group].concat(m.sampleAliases||[]).map(norm).filter(Boolean);
      return all.some(function(t){return vals.some(function(v){return v===t||v.split('/').pop()===t;});});
    });
  }
  function activeAmbiguity(exp,findingId){const id=String(findingId||''),current=Number(exp.sync&&exp.sync.revision||0);let a=exp.datasetAnalysis;if(a&&Number(a.sourceRevision)===current)return(a.ambiguousFindings||[]).find(function(f){return String(f.id||'')===id;})||null;a=datasetAnalysis(exp,current);return(a.ambiguousFindings||[]).find(function(f){return String(f.id||'')===id;})||null;}
  function markFindingResolved(exp,p,source){if(!p||!p.finding_id)return;const f=(exp.findings||[]).find(function(x){return String(x.id||'')===String(p.finding_id);});if(!f)return;f.status='resolved';f.resolution={source:source||'ai',patch_type:p.patch_type,after:p.after,reason:p.reason||'',resolvedAt:new Date().toISOString()};}
  function patchTargetFor(exp,type,match){
    if(match)return{kind:'measurement',id:match.id};
    return{kind:'dataset',id:exp.id};
  }
  function patchField(type,field){
    if(type==='sample_mapping')return'sample';if(type==='group_mapping')return'group';if(type==='reference_classification')return'isRef';
    if(type==='exclude_measurement'||type==='restore_measurement')return'excluded';if(type==='metadata_value')return'meta.'+field;
    if(type==='field_mapping')return'interpretationOverrides.fields.'+field;if(type==='unit_mapping')return'interpretationOverrides.units.'+field;
    if(type==='scale_factor')return'interpretationOverrides.scales.'+field;if(type==='derived_metric_recovery')return field;return field||'';
  }
  function ensureExperimentGroup(exp,label){
    const name=String(label||'').trim();if(!name)throw new Error('The proposed experiment group is empty.');
    let target=(exp.experiments||[]).find(function(item){return norm(item.name)===norm(name);});
    if(!target)target=LF.DataModel.addRecord(exp,'experiment',{name:name,isRef:LF.Parser.isReference(name),sampleIds:[],sampleNames:[],runIds:[],measurementIds:[]});
    return target;
  }
  function applyGroupMapping(exp,matches,after){
    const target=ensureExperimentGroup(exp,after),sampleIds=new Set(),measurementIds=new Set();let changed=0,relationChanged=false;
    matches.forEach(function(match){if(match.sampleId)sampleIds.add(String(match.sampleId));else{const sample=(exp.samples||[]).find(function(item){return norm(item.name)===norm(match.sample);});if(sample)sampleIds.add(String(sample.id));}});
    (exp.measurements||[]).forEach(function(m){if(sampleIds.has(String(m.sampleId||''))||matches.includes(m))measurementIds.add(String(m.id));});
    (exp.samples||[]).forEach(function(sample){if(!sampleIds.has(String(sample.id)))return;if(String(sample.experimentId)!==String(target.id)||sample.experiment!==target.name||sample.group!==target.name||!!sample.isRef!==!!target.isRef)relationChanged=true;sample.experimentId=target.id;sample.experiment=target.name;sample.group=target.name;sample.isRef=!!target.isRef;});
    (exp.runs||[]).forEach(function(run){if(!sampleIds.has(String(run.sampleId||'')))return;if(String(run.experimentId)!==String(target.id)||run.experiment!==target.name)relationChanged=true;run.experimentId=target.id;run.experiment=target.name;});
    (exp.measurements||[]).forEach(function(m){if(!measurementIds.has(String(m.id)))return;if(String(m.experimentId)!==String(target.id)||m.experiment!==target.name||m.group!==target.name||!!m.isRef!==!!target.isRef)changed++;m.experimentId=target.id;m.experiment=target.name;m.group=target.name;m.isRef=!!target.isRef;});
    (exp.auxiliaryEvidence||[]).forEach(function(item){if(!sampleIds.has(String(item.sampleId||'')))return;item.experimentId=target.id;item.experiment=target.name;item.group=target.name;item.isRef=!!target.isRef;});
    if (LF.DesignModel.syncDatasetGroupLinks(exp, Array.from(sampleIds), target)) relationChanged = true;
    return{changed:changed||(relationChanged?1:0),target:target,sampleIds:Array.from(sampleIds)};
  }
  function recordProposalPatches(exp,p,source,matches,field){
    const targets=matches&&matches.length?matches:[null],type=String(p.patch_type||''),reviewedBy=LF.State&&LF.State.state.user&&LF.State.state.user.name||'';
    if(type==='group_mapping'){
      const sampleIds=Array.from(new Set(targets.map(function(match){return match&&match.sampleId||'';}).filter(Boolean)));
      (sampleIds.length?sampleIds:[null]).forEach(function(sampleId){LF.DataModel.addPatch(exp,{patchType:type,target:sampleId?{kind:'sample',id:sampleId}:{kind:'dataset',id:exp.id},operation:'set',field:'group',from:p.before,to:p.after,source:source||'ai',findingId:p.finding_id||'',reason:p.reason||'',evidence:p.evidence||[],confidence:p.confidence,reviewedBy:reviewedBy,reviewStatus:'accepted',status:'applied',appliedAt:new Date().toISOString()},{touch:false});});
      return;
    }
    targets.forEach(function(match){
      const before=match?(type==='exclude_measurement'||type==='restore_measurement'?!!p.before:p.before):p.before;
      LF.DataModel.addPatch(exp,{patchType:type,target:patchTargetFor(exp,type,match),operation:'set',field:patchField(type,field||String(p.target||'')),from:before,to:p.after,source:source||'ai',findingId:p.finding_id||'',reason:p.reason||'',evidence:p.evidence||[],confidence:p.confidence,reviewedBy:reviewedBy,reviewStatus:'accepted',status:'applied',appliedAt:new Date().toISOString()},{touch:false});
    });
  }
  function applyProposal(exp,p,source){
    if(source==='ai'){const finding=activeAmbiguity(exp,p&&p.finding_id);if(!finding)throw new Error('This AI proposal no longer resolves an active ambiguity in the current revision. Re-run AI suggestions.');}
    const type=String(p.patch_type||''),raw=p.after,after=raw&&typeof raw==='object'&&!Array.isArray(raw)&&raw.value!=null?raw.value:raw,matches=proposalMeasurements(exp,p),field=String(p.field||'').trim();let changed=0;
    if(type==='sample_mapping'){
      const canonical=LF.Parser.canonicalSample(after);if(!canonical)throw new Error('The proposed sample name is empty.');
      matches.forEach(function(m){const group=LF.Parser.groupFromSample(canonical),isRef=LF.Parser.isReference(canonical);if(m.sample===canonical&&m.group===group&&!!m.isRef===!!isRef)return;m.sample=canonical;m.group=group;m.isRef=isRef;changed++;});
    }else if(type==='group_mapping'){changed=applyGroupMapping(exp,matches,after).changed;}
    else if(type==='reference_classification'){const val=after===true||String(after).toLowerCase()==='true'||LF.Parser.isReference(String(after||''));matches.forEach(function(m){if(!!m.isRef===val)return;m.isRef=val;changed++;});}
    else if(type==='exclude_measurement'||type==='restore_measurement')matches.forEach(function(m){const value=type==='exclude_measurement';if(!!m.excluded===value)return;m.excluded=value;changed++;});
    else if(type==='metadata_value'&&field)matches.forEach(function(m){m.meta=m.meta||{};if(JSON.stringify(m.meta[field])===JSON.stringify(after))return;m.meta[field]=after;changed++;});
    else if(type==='field_mapping'){const key=String(p.target||field||'field');if(JSON.stringify(exp.interpretationOverrides.fields[key])!==JSON.stringify(after)){exp.interpretationOverrides.fields[key]=after;changed=1;}}
    else if(type==='unit_mapping'){const key=String(field||p.target||'field');if(JSON.stringify(exp.interpretationOverrides.units[key])!==JSON.stringify(after)){exp.interpretationOverrides.units[key]=after;changed=1;}}
    else if(type==='scale_factor'){const factor=Number(after),parts=field.split('.');if(Number.isFinite(factor)&&factor!==0){matches.forEach(function(m){const dirs=parts.length===2?[parts[0]]:['fw','rv'],key=parts.length===2?parts[1]:parts[0];dirs.forEach(function(d){if(m[d]&&Number.isFinite(Number(m[d][key])))m[d][key]=Number(m[d][key])*factor;});changed++;});if(field)exp.interpretationOverrides.scales[field]=factor;}}
    else if(type==='derived_metric_recovery'){const val=Number(after),parts=field.split('.');if(Number.isFinite(val)&&field)matches.forEach(function(m){const d=parts.length===2?parts[0]:'fw',key=parts.length===2?parts[1]:parts[0];m[d]=m[d]||{};m[d][key]=val;changed++;});}
    if(!changed)throw new Error('No unambiguous target matched this proposal.');
    recordProposalPatches(exp,p,source,matches,field);
    if(source==='ai')markFindingResolved(exp,p,source);p.applied=true;p.decision='accepted';p.appliedAt=new Date().toISOString();return changed;
  }
  function mutationFingerprint(exp){
    return JSON.stringify({
      experiments:(exp.experiments||[]).map(function(x){return[x.id,x.name,x.isRef,x.sampleIds,x.runIds,x.measurementIds];}),
      samples:(exp.samples||[]).map(function(x){return[x.id,x.name,x.experimentId,x.experiment,x.group,x.isRef,x.runIds,x.measurementIds,x.meta];}),
      runs:(exp.runs||[]).map(function(x){return[x.id,x.sampleId,x.experimentId,x.experiment,x.measurementIds];}),
      measurements:(exp.measurements||[]).map(function(x){return[x.id,x.sample,x.sampleId,x.experiment,x.experimentId,x.group,x.isRef,x.excluded,x.meta,x.fw,x.rv];}),
      designDevices:(exp.design&&exp.design.devices||[]).map(function(x){return[x.id,x.experimentId,x.group,x.isRef,x.sampleIds];}),
      interpretationOverrides:exp.interpretationOverrides||{}
    });
  }
  function finishDatasetCommit(exp,before,meta){
    rebuildSamples(exp);
    const beforeRevision=Number(exp.sync&&exp.sync.revision||0);
    LF.DataModel.touch(exp,'dataset');
    LF.DerivedState.invalidate(exp,'dataset');
    const pipeline=pipelineRefresh(exp,meta.reason||'dataset-correction-commit'),validation=LF.DataContracts.assert(exp);
    if(mutationFingerprint(exp)===before){const error=new Error('The correction did not survive canonical refresh. No successful mutation was committed.');error.code='DATA_MUTATION_NOT_COMMITTED';throw error;}
    const out=Object.assign({executed:true,committed:true,changed:0,failed:0,revisionBefore:beforeRevision,revisionAfter:Number(exp.sync&&exp.sync.revision||0),pipelineStatus:pipeline&&pipeline.status||'',validationOk:validation.ok!==false},meta);
    if(Log)Log.info('dataset.commit',out);
    if(LF.State&&LF.State.state&&LF.State.state.experiment===exp&&LF.State.notify)LF.State.notify('touch');
    return out;
  }
  function commitProposals(exp,proposals,source,options){
    if(LF.State&&LF.State.state&&LF.State.state.experiment&&LF.State.state.experiment!==exp)throw new Error('Dataset corrections must target the canonical ExperimentData.');
    const list=Array.isArray(proposals)?proposals:[proposals],before=mutationFingerprint(exp),patchesBefore=(exp.patches||[]).length;let changed=0,failed=0;const errors=[];
    list.filter(Boolean).forEach(function(proposal){try{changed+=applyProposal(exp,proposal,source);delete proposal.applyError;}catch(error){failed++;proposal.applyError=error&&error.message||String(error);errors.push(proposal.applyError);}});
    if(!changed){const error=new Error(errors[0]||'No correction changed the current LabFlow Data.');error.code='DATA_MUTATION_NOOP';error.failures=errors;throw error;}
    return finishDatasetCommit(exp,before,{actionId:options&&options.actionId||'',source:source||'user',reason:options&&options.reason||'dataset-correction-commit',requested:list.filter(Boolean).length,changed:changed,failed:failed,patchesAdded:(exp.patches||[]).length-patchesBefore,errors:errors.slice(0,6)});
  }
  function safeFixes(exp){const fixes=[],seen=new Set();function add(p){const k=[p.patch_type,p.target,p.field||'',JSON.stringify(p.after)].join('|');if(seen.has(k))return;seen.add(k);p.safe=true;p.requires_human_review=false;p.confidence=1;fixes.push(p);}(exp.measurements||[]).forEach(function(m){const group=LF.Parser.groupFromSample(m.sample||'');if(!String(m.group||'').trim()&&String(group||'').trim())add({patch_type:'group_mapping',target:m.id,before:m.group||'',after:group,reason:'Group is deterministically derivable from the canonical sample identifier.',evidence:[m.sample]});});return fixes;}
  function reviewFixes(exp){return(exp.measurements||[]).filter(function(m){return m.qualityStatus==='blocked'&&!m.excluded;}).map(function(m){return{patch_type:'exclude_measurement',target:m.id,before:false,after:true,reason:'Exclude this blocked measurement from scientific analysis and rankings.',evidence:(m.blockingFlags||[]).map(function(x){return x.evidence||x.label;}).filter(Boolean).slice(0,3),safe:false,requires_human_review:true,confidence:1};});}
  function automaticCleanupState(exp,extra){
    const fixes=safeFixes(exp),automaticPatches=(exp.patches||[]).filter(function(x){return x.source==='automatic'&&x.status==='applied';});let pendingTargets=0;
    fixes.forEach(function(fix){pendingTargets+=proposalMeasurements(exp,fix).length;});
    exp.autoCleanup={applied:automaticPatches.length,pending:fixes.length,pendingTargets:pendingTargets,lastApplied:Number(extra&&extra.lastApplied||0),targets:Number(extra&&extra.targets!=null?extra.targets:pendingTargets),items:fixes.map(function(x){return{patch_type:x.patch_type,target:x.target,after:x.after,reason:x.reason,evidence:(x.evidence||[]).slice(0,3)};}),appliedItems:automaticPatches.map(function(x){return{patch_type:x.patchType,target:x.target&&x.target.id||x.target,after:x.to,reason:x.reason,evidence:(x.evidence||[]).slice(0,3)};}),updatedAt:new Date().toISOString()};return exp.autoCleanup;
  }
  function prepareAutomaticSafeFixes(exp){return automaticCleanupState(exp);}
  function applyAutomaticSafeFixes(exp){
    const fixes=safeFixes(exp),applied=[];let targets=0;
    fixes.forEach(function(fix){try{const copy=Object.assign({},fix);targets+=applyProposal(exp,copy,'automatic');applied.push(copy);}catch(err){/* Leave any unmappable item pending instead of forcing it. */}});
    return automaticCleanupState(exp,{lastApplied:applied.length,targets:targets});
  }
  function commitAutomaticSafeFixes(exp){
    if(LF.State&&LF.State.state&&LF.State.state.experiment&&LF.State.state.experiment!==exp)throw new Error('Safe cleanup must target the canonical ExperimentData.');
    const before=mutationFingerprint(exp),patchesBefore=(exp.patches||[]).length,out=applyAutomaticSafeFixes(exp);
    if(!Number(out.lastApplied||0)){const error=new Error('No pending safe cleanup correction changed the current LabFlow Data.');error.code='DATA_MUTATION_NOOP';throw error;}
    return Object.assign(out,finishDatasetCommit(exp,before,{actionId:'review.safe-cleanup',source:'automatic',reason:'automatic-cleanup-commit',requested:Number(out.lastApplied||0),changed:Number(out.targets||0),failed:0,patchesAdded:(exp.patches||[]).length-patchesBefore}));
  }

  function findingRecord(f){return{id:String(f.id||''),type:f.type||'',severity:f.severity||'info',title:f.title||'',detail:clip(f.detail||'',600),target:f.target||'',measurementId:f.measurementId||'',evidence:(f.evidence||[]).slice(0,3),status:f.status||'open',source:f.source||'deterministic'};}
  function classifyFinding(f,safeIds){if(f.status==='resolved')return'resolved';if(f.measurementId&&safeIds.has(String(f.measurementId)))return'safe';const type=String(f.type||''),text=[f.title,f.detail,f.target].join(' ').toLowerCase();if(type==='measurement-quality'||/^(encoding|parse|missing-summary|direction-pair|no-measurements|naming|naming-normalized)$/.test(type))return'informational';if(/^(identity|sample-mapping|group-mapping|reference-classification)$/.test(type)||/ambiguous|cannot determine|uncertain identity|unknown sample|unresolved mapping/.test(text))return'ambiguous';return'informational';}
  function datasetAnalysis(exp,revision){const cs=LF.CanonicalStore.ensure(exp),summary=LF.CanonicalStore.summary(exp),fixes=safeFixes(exp),suggestions=reviewFixes(exp),normalizedFiles=(exp.files||[]).filter(function(f){return String(f.rawName||f.name||'')!==String(f.name||'');}).map(function(f){return{id:f.id,rawName:f.rawName||'',canonicalName:f.name||'',rawPath:f.rawPath||f.path||'',canonicalPath:f.canonicalPath||f.path||''};}),safeIds=new Set();fixes.forEach(function(p){proposalMeasurements(exp,p).forEach(function(m){safeIds.add(String(m.id));});});const findings=(exp.findings||[]).filter(function(f){return f.status!=='resolved';}).map(function(f){const x=findingRecord(f);x.classification=classifyFinding(f,safeIds);return x;}),measurementById=new Map((exp.measurements||[]).map(function(m){return[String(m.id||''),m];})),pendingDangerFindings=findings.filter(function(f){if(f.severity!=='danger')return false;if(!f.measurementId)return true;const m=measurementById.get(String(f.measurementId||''));return !m||!m.excluded;}),blockingFindings=pendingDangerFindings.filter(function(f){return !f.measurementId||!safeIds.has(String(f.measurementId));}),ambiguous=findings.filter(function(f){return f.classification==='ambiguous';}),info=findings.filter(function(f){return f.classification==='informational';}),families={};(exp.files||[]).forEach(function(f){const k=f.family||f.type||'unknown';families[k]=(families[k]||0)+1;});return{generatedAt:new Date().toISOString(),sourceRevision:Number(revision)||0,status:blockingFindings.length?'blocked':fixes.length?'cleanup_required':(suggestions.length||ambiguous.length||findings.length)?'review':'ok',summary:{files:summary.files,samples:summary.samples,measurements:summary.measurements,openFindings:findings.length,blockingFindings:blockingFindings.length,pendingDangerFindings:pendingDangerFindings.length,safeFixes:fixes.length,reviewFixes:suggestions.length,canonicalNames:normalizedFiles.length,ambiguousFindings:ambiguous.length,informationalFindings:info.length,evidence:summary.evidence,relations:summary.relations,aliases:summary.aliases},archive:{name:cs.experiment.name,source:cs.experiment.sourceName,fileFamilies:Object.keys(families).sort().map(function(k){return{family:k,count:families[k]};})},deterministicResults:compact(exp.analysis&&exp.analysis.summary||{}),samples:(exp.samples||[]).map(function(s){return{id:s.id,name:s.name,aliases:(s.aliases||[]).slice(0,8),group:s.group||'',isRef:!!s.isRef,measurementIds:(s.measurementIds||[]).slice()}}),measurements:(exp.measurements||[]).map(function(m){return{id:m.id,sample:m.sample,file:m.path||m.file||'',qualityStatus:m.qualityStatus||'',rankingEligible:!!m.rankingEligible,bestEff:m.bestEff};}),findings:findings,safeFixes:fixes,reviewFixes:suggestions,filenameNormalizations:normalizedFiles,ambiguousFindings:ambiguous,informationalFindings:info,evidenceSummary:{count:summary.evidence,types:(cs.evidence||[]).reduce(function(o,e){o[e.type]=(o[e.type]||0)+1;return o;},{})},coverage:{samples:true,measurements:true,findings:true,evidenceGraph:true}};}

  function pipelineRefresh(exp, reason) {
    if (!LF.DataPipeline || !LF.DataPipeline.refresh) throw new Error('LabFlow.DataPipeline is unavailable.');
    return LF.DataPipeline.refresh(exp, { reason: reason || 'dataset-corrections' });
  }

  LF.DatasetCorrections = {
    applyProposal: applyProposal,
    commitProposals: commitProposals,
    rebuildSamples: rebuildSamples,
    proposalMeasurements: proposalMeasurements,
    safeFixes: safeFixes,
    reviewFixes: reviewFixes,
    prepareAutomaticSafeFixes: prepareAutomaticSafeFixes,
    applyAutomaticSafeFixes: applyAutomaticSafeFixes,
    commitAutomaticSafeFixes: commitAutomaticSafeFixes,
    analysis: datasetAnalysis
  };
}());
