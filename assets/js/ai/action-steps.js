(function(){
  'use strict';
  const LF=window.LabFlow=window.LabFlow||{},C=LF.Core;
  function compact(v){return LF.CanonicalStore&&LF.CanonicalStore.compact?LF.CanonicalStore.compact(v,420):v;}
  function clip(v,n){const s=String(v==null?'':v);return s.length>(n||500)?s.slice(0,n||500)+'…':s;}
  function rebuildSamples(exp){
    const previous=new Map((exp.samples||[]).map(function(s){return[String(s.id||s.name),s];})),byId=new Map(),byName=new Map();
    (exp.measurements||[]).forEach(function(m){
      const key=String(m.sampleId||m.sample||'');if(!key)return;
      let sample=byId.get(key)||byName.get(String(m.sample||''));
      if(!sample){
        const prev=previous.get(key)||Array.from(previous.values()).find(function(x){return String(x.name||'')===String(m.sample||'');})||{};
        sample={kind:'sample',id:m.sampleId||prev.id||C.uid('sample'),name:m.sample||prev.name||'',rawName:prev.rawName||m.rawSample||m.sample||'',aliases:(prev.aliases||[]).slice(),group:m.group||prev.group||'',experiment:m.experiment||prev.experiment||m.group||'',experimentId:m.experimentId||prev.experimentId||'',position:m.position||prev.position||'',cell:m.cell||prev.cell||'',isRef:m.isRef!=null?!!m.isRef:!!prev.isRef,runIds:[],measurementIds:[]};
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
  function activeAmbiguity(exp,findingId){const id=String(findingId||''),current=Number(exp.sync&&exp.sync.revision||0);let a=exp.datasetAnalysis;if(a&&Number(a.sourceRevision)===current)return(a.ambiguousFindings||[]).find(function(f){return String(f.id||'')===id;})||null;if(LF.CanonicalStore&&LF.CanonicalStore.ensure){a=datasetAnalysis(exp,current);return(a.ambiguousFindings||[]).find(function(f){return String(f.id||'')===id;})||null;}return(exp.findings||[]).find(function(f){return String(f.id||'')===id&&f.status!=='resolved';})||null;}
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
  function recordProposalPatches(exp,p,source,matches,field){
    const targets=matches&&matches.length?matches:[null],type=String(p.patch_type||''),reviewedBy=LF.State&&LF.State.state.user&&LF.State.state.user.name||'';
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
      matches.forEach(function(m){m.sample=canonical;m.group=LF.Parser.groupFromSample(canonical);m.isRef=LF.Parser.isReference(canonical);changed++;});
    }else if(type==='group_mapping')matches.forEach(function(m){m.group=String(after||'').trim();changed++;});
    else if(type==='reference_classification'){const val=after===true||String(after).toLowerCase()==='true'||LF.Parser.isReference(String(after||''));matches.forEach(function(m){m.isRef=val;changed++;});}
    else if(type==='exclude_measurement'||type==='restore_measurement')matches.forEach(function(m){m.excluded=type==='exclude_measurement';changed++;});
    else if(type==='metadata_value'&&field)matches.forEach(function(m){m.meta=m.meta||{};m.meta[field]=after;changed++;});
    else if(type==='field_mapping'){const key=String(p.target||field||'field');exp.interpretationOverrides.fields[key]=after;changed=1;}
    else if(type==='unit_mapping'){const key=String(field||p.target||'field');exp.interpretationOverrides.units[key]=after;changed=1;}
    else if(type==='scale_factor'){const factor=Number(after),parts=field.split('.');if(Number.isFinite(factor)&&factor!==0){matches.forEach(function(m){const dirs=parts.length===2?[parts[0]]:['fw','rv'],key=parts.length===2?parts[1]:parts[0];dirs.forEach(function(d){if(m[d]&&Number.isFinite(Number(m[d][key])))m[d][key]=Number(m[d][key])*factor;});changed++;});if(field)exp.interpretationOverrides.scales[field]=factor;}}
    else if(type==='derived_metric_recovery'){const val=Number(after),parts=field.split('.');if(Number.isFinite(val)&&field)matches.forEach(function(m){const d=parts.length===2?parts[0]:'fw',key=parts.length===2?parts[1]:parts[0];m[d]=m[d]||{};m[d][key]=val;changed++;});}
    if(!changed)throw new Error('No unambiguous target matched this proposal.');
    recordProposalPatches(exp,p,source,matches,field);
    if(source==='ai')markFindingResolved(exp,p,source);p.applied=true;p.decision='accepted';p.appliedAt=new Date().toISOString();return changed;
  }
  function safeFixes(exp){const fixes=[],seen=new Set();function add(p){const k=[p.patch_type,p.target,p.field||'',JSON.stringify(p.after)].join('|');if(seen.has(k))return;seen.add(k);p.safe=true;p.requires_human_review=false;p.confidence=1;fixes.push(p);}(exp.measurements||[]).forEach(function(m){const group=LF.Parser.groupFromSample(m.sample||'');if(!String(m.group||'').trim()&&String(group||'').trim())add({patch_type:'group_mapping',target:m.id,before:m.group||'',after:group,reason:'Group is deterministically derivable from the canonical sample identifier.',evidence:[m.sample]});});return fixes;}
  function reviewFixes(exp){return(exp.measurements||[]).filter(function(m){return m.qualityStatus==='blocked'&&!m.excluded;}).map(function(m){return{patch_type:'exclude_measurement',target:m.id,before:false,after:true,reason:'Exclude this blocked measurement from scientific analysis and rankings.',evidence:(m.blockingFlags||[]).map(function(x){return x.evidence||x.label;}).filter(Boolean).slice(0,3),safe:false,requires_human_review:true,confidence:1};});}
  function withdrawAutomaticExclusions(exp){let changed=0;const patches=exp.patches||[];(patches||[]).forEach(function(patch){if(patch.source!=='automatic'||patch.patchType!=='exclude_measurement'||patch.status==='withdrawn')return;const id=String(patch.target&&patch.target.id||patch.target||''),measurement=(exp.measurements||[]).find(function(item){return String(item.id)===id;}),confirmed=patches.some(function(other){return other!==patch&&other.source!=='automatic'&&other.patchType==='exclude_measurement'&&other.status==='applied'&&String(other.target&&other.target.id||other.target||'')===id;});patch.status='withdrawn';patch.reviewStatus='required';patch.revertedAt=new Date().toISOString();if(measurement&&measurement.excluded&&!confirmed){measurement.excluded=false;changed++;}});return changed;}
  function applyAutomaticSafeFixes(exp){
    const withdrawn=withdrawAutomaticExclusions(exp),fixes=safeFixes(exp),applied=[];let targets=0;
    fixes.forEach(function(fix){try{const copy=Object.assign({},fix);targets+=applyProposal(exp,copy,'automatic');applied.push(copy);}catch(err){/* Keep unmappable fixes visible instead of forcing them. */}});
    if((applied.length||withdrawn)&&LF.DataModel&&LF.DataModel.touch)LF.DataModel.touch(exp,'dataset');
    const automaticPatches=(exp.patches||[]).filter(function(x){return x.source==='automatic'&&x.status==='applied';});
    exp.autoCleanup={applied:automaticPatches.length,lastApplied:applied.length,withdrawn:withdrawn,targets:targets,items:automaticPatches.map(function(x){return{patch_type:x.patchType,target:x.target&&x.target.id||x.target,after:x.to,reason:x.reason,evidence:(x.evidence||[]).slice(0,3)};}),updatedAt:new Date().toISOString()};return exp.autoCleanup;
  }

  function findingRecord(f){return{id:String(f.id||''),type:f.type||'',severity:f.severity||'info',title:f.title||'',detail:clip(f.detail||'',600),target:f.target||'',measurementId:f.measurementId||'',evidence:(f.evidence||[]).slice(0,3),status:f.status||'open',source:f.source||'deterministic'};}
  function classifyFinding(f,safeIds){if(f.status==='resolved')return'resolved';if(f.measurementId&&safeIds.has(String(f.measurementId)))return'safe';const type=String(f.type||''),text=[f.title,f.detail,f.target].join(' ').toLowerCase();if(type==='measurement-quality'||/^(encoding|parse|missing-summary|direction-pair|no-measurements|naming|naming-normalized)$/.test(type))return'informational';if(/^(identity|sample-mapping|group-mapping|reference-classification)$/.test(type)||/ambiguous|cannot determine|uncertain identity|unknown sample|unresolved mapping/.test(text))return'ambiguous';return'informational';}
  function datasetAnalysis(exp,revision){const cs=LF.CanonicalStore.ensure(exp),summary=LF.CanonicalStore.summary(exp),fixes=safeFixes(exp),suggestions=reviewFixes(exp),normalizedFiles=(exp.files||[]).filter(function(f){return String(f.rawName||f.name||'')!==String(f.name||'');}).map(function(f){return{id:f.id,rawName:f.rawName||'',canonicalName:f.name||'',rawPath:f.rawPath||f.path||'',canonicalPath:f.canonicalPath||f.path||''};}),safeIds=new Set();fixes.forEach(function(p){proposalMeasurements(exp,p).forEach(function(m){safeIds.add(String(m.id));});});const findings=(exp.findings||[]).filter(function(f){return f.status!=='resolved';}).map(function(f){const x=findingRecord(f);x.classification=classifyFinding(f,safeIds);return x;}),measurementById=new Map((exp.measurements||[]).map(function(m){return[String(m.id||''),m];})),pendingDangerFindings=findings.filter(function(f){if(f.severity!=='danger')return false;if(!f.measurementId)return true;const m=measurementById.get(String(f.measurementId||''));return !m||!m.excluded;}),blockingFindings=pendingDangerFindings.filter(function(f){return !f.measurementId||!safeIds.has(String(f.measurementId));}),ambiguous=findings.filter(function(f){return f.classification==='ambiguous';}),info=findings.filter(function(f){return f.classification==='informational';}),families={};(exp.files||[]).forEach(function(f){const k=f.family||f.type||'unknown';families[k]=(families[k]||0)+1;});return{generatedAt:new Date().toISOString(),sourceRevision:Number(revision)||0,status:blockingFindings.length?'blocked':fixes.length?'cleanup_required':(suggestions.length||ambiguous.length||findings.length)?'review':'ok',summary:{files:summary.files,samples:summary.samples,measurements:summary.measurements,openFindings:findings.length,blockingFindings:blockingFindings.length,pendingDangerFindings:pendingDangerFindings.length,safeFixes:fixes.length,reviewFixes:suggestions.length,canonicalNames:normalizedFiles.length,ambiguousFindings:ambiguous.length,informationalFindings:info.length,evidence:summary.evidence,relations:summary.relations,aliases:summary.aliases},archive:{name:cs.experiment.name,source:cs.experiment.sourceName,fileFamilies:Object.keys(families).sort().map(function(k){return{family:k,count:families[k]};})},deterministicResults:compact(exp.analysis&&exp.analysis.summary||{}),samples:(exp.samples||[]).map(function(s){return{id:s.id,name:s.name,aliases:(s.aliases||[]).slice(0,8),group:s.group||'',isRef:!!s.isRef,measurementIds:(s.measurementIds||[]).slice()}}),measurements:(exp.measurements||[]).map(function(m){return{id:m.id,sample:m.sample,file:m.path||m.file||'',qualityStatus:m.qualityStatus||'',rankingEligible:!!m.rankingEligible,bestEff:m.bestEff};}),findings:findings,safeFixes:fixes,reviewFixes:suggestions,filenameNormalizations:normalizedFiles,ambiguousFindings:ambiguous,informationalFindings:info,evidenceSummary:{count:summary.evidence,types:(cs.evidence||[]).reduce(function(o,e){o[e.type]=(o[e.type]||0)+1;return o;},{})},coverage:{samples:true,measurements:true,findings:true,evidenceGraph:true}};}
  function designAnalysis(exp,revision){
    LF.CanonicalStore.ensure(exp);
    const design=exp.design||{},devices=design.devices||[],solutions=design.solutions||[],source=design.evidenceSummary||{};
    function gaps(d){return LF.DesignModel&&LF.DesignModel.missingDomains?LF.DesignModel.missingDomains(exp,d):[];}
    const items=(exp.samples||[]).map(function(s){const d=devices.find(function(x){return(x.sampleIds||[]).includes(s.id);})||null,unknown=gaps(d),ev=LF.CanonicalStore.evidence(exp,{record_ids:[s.id],limit:24});return{sample:{id:s.id,name:s.name,group:s.group||'',isRef:!!s.isRef},currentDevice:d?compact(d):null,evidenceIds:ev.map(function(e){return e.id;}),designEvidenceIds:ev.filter(function(e){return /design|stack|precursor|solution|anneal|coating|atmosphere/i.test([e.fact,e.summary].join(' '));}).map(function(e){return e.id;}),unknownFields:unknown};});
    const deviceRows=devices.map(function(d){const linked=(d.solutionIds||[]).map(function(id){return solutions.find(function(s){return String(s.id)===String(id);});}).filter(Boolean);return{id:d.id,name:d.name||'',group:d.group||'',sampleIds:(d.sampleIds||[]).slice(),sampleNames:(d.sampleNames||[]).slice(),status:d.status||'',known:{stackLayers:(d.stack||[]).length,solutions:linked.length},unknownFields:gaps(d),sourceEvidence:!!(d.status==='raw_evidence'||/Recovered from source/.test(String(d.evidence||'')))};});
    const unresolved=items.filter(function(x){return x.unknownFields.length;});
    return{generatedAt:new Date().toISOString(),sourceRevision:Number(revision)||0,summary:{samples:items.length,devices:devices.length,solutions:solutions.length,sourceDesignRecords:Number(source.sourceRecords||0),samplesCoveredBySource:Number(source.samplesCovered||0),unresolvedSamples:unresolved.length,unknownFields:unresolved.reduce(function(n,x){return n+x.unknownFields.length;},0)},devices:deviceRows,samples:items};
  }
  function pipelineRefresh(exp,reason){if(!LF.DataPipeline||!LF.DataPipeline.refresh)throw new Error('LabFlow.DataPipeline is not loaded.');const pipeline=LF.DataPipeline.refresh(exp,{reason:reason||'action'});return{analysis:exp.analysis,dataset:exp.datasetAnalysis,design:exp.designAnalysis,pipeline:pipeline,status:pipeline&&pipeline.status||'',validation:pipeline&&pipeline.validation||null};}
  function looksQuantitative(value){
    const v=String(value==null?'':value).trim();if(!v)return false;
    if(/^[-+]?\d+(?:[.,]\d+)?$/.test(v))return true;
    if(/(?:^|[\s(])[-+]?\d+(?:[.,]\d+)?\s*[:/]\s*\d+(?:[.,]\d+)?(?:$|[\s),])/i.test(v))return true;
    return /(?:^|[\s(])[-+]?\d+(?:[.,]\d+)?(?:e[-+]?\d+)?\s*(?:°\s*C|°C|C\b|K\b|ms\b|s\b|sec\b|seconds?\b|min\b|minutes?\b|h\b|hours?\b|rpm\b|rps\b|nm\b|µm\b|um\b|mm\b|cm\b|mL\b|µL\b|uL\b|mg\b|kg\b|g\b|mM\b|M\b|mol\b|wt%|vol%|%|torr\b|Pa\b|kPa\b|mbar\b|bar\b|psi\b|Hz\b|kHz\b|MHz\b|mV\b|V\b|mA\b|A\b|mW\b|W\b)/i.test(v);
  }
  function canonicalDesignSource(item,inherited){let raw=String(item&&item.provenance_kind||item&&item.provenanceKind||item&&item.source||inherited||'').toLowerCase().trim();const evidence=String(item&&item.evidence||'').trim();if(raw==='raw_evidence'||raw==='source'||raw==='evidence'||raw==='mixed')raw=evidence?'experiment':'model_inference';if(raw==='knowledge_reference')return /(?:^|[\s,;])KB:[A-Za-z0-9._:-]+/.test(evidence)?'knowledge_reference':'model_inference';return raw==='experiment'?'experiment':'model_inference';}
  function designConfidence(item,field){const map=item&&item.field_confidence&&typeof item.field_confidence==='object'?item.field_confidence:{},raw=Object.prototype.hasOwnProperty.call(map,field)?Number(map[field]):Number(item&&item.confidence);return Number.isFinite(raw)?Math.max(0,Math.min(1,raw)):null;}
  function fieldDecision(item,field){return(item&&Array.isArray(item.field_decisions)?item.field_decisions:[]).find(function(x){return String(x&&x.field||'')===String(field);})||null;}
  function autoApplyAllowed(item,field,value,inherited,manual){if(value==null||String(value).trim()==='')return false;if(manual)return true;const decision=fieldDecision(item,field);if(decision)return decision.auto_apply===true;const source=canonicalDesignSource(item,inherited),confidence=designConfidence(item,field),supported=source==='experiment'&&!!String(item&&item.evidence||'').trim(),hasSource=!!String(item&&item.provenance_kind||item&&item.provenanceKind||inherited||'').trim();if(source==='knowledge_reference')return false;if(confidence==null)return!!supported||!hasSource;return confidence>=0.75&&(!looksQuantitative(value)||supported);}
  function sanitizeDesignProposal(proposal){const stats={reviewOnlyQuantities:0,modelOnlyItems:0,knowledgeItems:0,autoApply:0,review:0,unresolved:(proposal.unknowns||[]).length};function annotate(item,fields,inheritedSource){if(!item||typeof item!=='object')return;const directEvidence=String(item.evidence||'').trim(),declared=canonicalDesignSource(item,inheritedSource),source=declared==='experiment'&&directEvidence?'experiment':declared==='knowledge_reference'?'knowledge_reference':'model_inference';if(source==='model_inference')stats.modelOnlyItems++;if(source==='knowledge_reference')stats.knowledgeItems++;item.provenance_kind=source;item.field_decisions=[];(fields||[]).forEach(function(entry){const field=typeof entry==='string'?entry:entry.field,value=typeof entry==='string'?item[field]:entry.value;if(value==null||String(value).trim()==='')return;const confidence=designConfidence(item,field),quantitative=looksQuantitative(value),supported=source==='experiment'&&!!directEvidence,autoApply=source==='knowledge_reference'?false:(confidence!=null&&confidence>=0.75&&(!quantitative||supported)),decision={field:field,value:String(value),source:source,confidence:confidence,auto_apply:autoApply,quantitative:quantitative,applied:false,skipped:''};item.field_decisions.push(decision);if(autoApply)stats.autoApply++;else{stats.review++;if(quantitative&&!supported)stats.reviewOnlyQuantities++;}});}
    (proposal.solutions||[]).forEach(function(item){annotate(item,['name','role','solutes','solvents','concentration','additives','preparation']);});
    (proposal.devices||[]).forEach(function(device){const process=device.process||{};annotate(device,[{field:'solutions',value:(device.solution_names||[]).join(', ')},{field:'coating',value:process.coating},{field:'annealing',value:process.annealing},{field:'atmosphere',value:process.atmosphere},{field:'notes',value:process.notes}]);(device.stack||[]).forEach(function(layer){annotate(layer,['role','material','thickness','process'],device.provenance_kind);});});
    proposal.applicationSummary={auto_apply_count:stats.autoApply,review_count:stats.review,unresolved_count:stats.unresolved};return stats;
  }
  function designApplicationSummary(proposal){const out={auto_apply_count:0,auto_applied_count:0,review_count:0,unresolved_count:(proposal&&proposal.unknowns||[]).length};function add(item){(item&&item.field_decisions||[]).forEach(function(d){if(d.skipped==='existing')return;if(d.applied)out.auto_applied_count++;else if(d.auto_apply)out.auto_apply_count++;else out.review_count++;});}(proposal&&proposal.solutions||[]).forEach(add);(proposal&&proposal.devices||[]).forEach(function(d){add(d);(d.stack||[]).forEach(add);});return out;}
  function applicableDesignFields(proposal,unknownFields){
    const wanted=new Set((unknownFields||[]).map(function(x){return String(x).toLowerCase();})),device=proposal&&proposal.devices&&proposal.devices[0]||{},solutions=proposal&&proposal.solutions||[],fields=[];
    /* The Action already targets one selected experiment. A useful chemistry
       proposal does not need the model to repeat a device→solution linkage just
       to pass validation; the deterministic store/apply step owns that target. */
    if(wanted.has('solutions')&&solutions.some(function(sol){return[sol&&sol.solutes,sol&&sol.solvents].some(function(v){return String(v||'').trim();});}))fields.push('solutions');
    if(wanted.has('stack')){const assessment=LF.DesignModel&&LF.DesignModel.stackAssessment?LF.DesignModel.stackAssessment(device.stack||[]):null;if(assessment&&assessment.complete)fields.push('stack');}
    const process=device.process||proposal&&proposal.process||{};if(wanted.has('process')&&[process.coating,process.annealing,process.atmosphere,process.notes].some(function(v){return String(v||'').trim();}))fields.push('process');
    return fields;
  }

  function confidencePct(v){const n=Number(v);return Number.isFinite(n)?Math.round(Math.max(0,Math.min(1,n))*100)+'%':'—';}
  function mdList(items,render){return(items||[]).length?(items||[]).map(function(x){return'- '+render(x);}).join('\n'):'- None';}
  function resultsInterpretationMarkdown(v){const lines=['### Summary',String(v.summary||'').trim()||'No summary returned.','', '### Evidence-backed observations',mdList(v.observations,function(x){return String(x.statement||'')+' *(confidence '+confidencePct(x.confidence)+(x.evidence&&x.evidence.length?' · evidence: '+x.evidence.join('; '):'')+')*';}),'','### Hypotheses',mdList(v.hypotheses,function(x){return String(x.statement||'')+' *(confidence '+confidencePct(x.confidence)+(x.basis&&x.basis.length?' · basis: '+x.basis.join('; '):'')+')*';}),'','### Limitations',mdList(v.limitations,function(x){return String(x);}), '','### Next checks',mdList(v.next_checks,function(x){return String(x);})];return lines.join('\n');}
  function resultsSelection(ctx){const p=ctx&&ctx.params||{};return{groups:(Array.isArray(p.groups)?p.groups:[]).map(String).filter(Boolean),metric:String(p.metric||'eff'),direction:String(p.direction||'both'),eligibleOnly:p.eligibleOnly!==false};}
  function resultsSelectionKey(s){return JSON.stringify({groups:(s.groups||[]).slice().sort(),metric:s.metric,direction:s.direction,eligibleOnly:!!s.eligibleOnly});}
  function resultsComparisonMarkdown(v,s){const lines=['### '+(v.status==='insufficient_evidence'?'Comparison limited':'Comparison summary'),String(v.summary||'').trim()||'No summary returned.','', '**Selection:** '+(s.groups||[]).join(' vs ')+' · '+s.metric+' · '+s.direction+(s.eligibleOnly?' · eligible only':''),'','### Supported contrasts',mdList(v.contrasts,function(x){return String(x.statement||'')+' *(confidence '+confidencePct(x.confidence)+(x.evidence&&x.evidence.length?' · evidence: '+x.evidence.join('; '):'')+')*';}),'','### Hypotheses',mdList(v.hypotheses,function(x){return String(x.statement||'')+' *(confidence '+confidencePct(x.confidence)+(x.basis&&x.basis.length?' · basis: '+x.basis.join('; '):'')+')*';}),'','### Limitations',mdList(v.limitations,function(x){return String(x);}), '','### Next checks',mdList(v.next_checks,function(x){return String(x);})];return lines.join('\n');}

  const steps={
    'dataset.collect-ambiguities':function(ctx){const a=ctx.exp.datasetAnalysis,current=Number(ctx.exp.sync&&ctx.exp.sync.revision||0);if(!a||Number(a.sourceRevision)!==current)pipelineRefresh(ctx.exp,'dataset.resolve-ambiguities');const list=(ctx.exp.datasetAnalysis.ambiguousFindings||[]).slice(0,12);if(!list.length)throw new Error('No semantic ambiguity requires AI resolution.');return{finding_ids:list.map(function(f){return f.id;}),scheduled:list.length,remaining:Math.max(0,(ctx.exp.datasetAnalysis.ambiguousFindings||[]).length-list.length)};},
    'dataset.store-corrections':function(ctx){const value=ctx.lastResult;if(!value||typeof value!=='object')throw new Error('Ambiguity resolution returned no structured result.');const current=Number(ctx.exp.sync&&ctx.exp.sync.revision||0);if(!ctx.exp.datasetAnalysis||Number(ctx.exp.datasetAnalysis.sourceRevision)!==current)pipelineRefresh(ctx.exp,'dataset.resolve-ambiguities.store');const open=ctx.exp.datasetAnalysis.ambiguousFindings||[],byId=new Map(open.map(function(f){return[String(f.id||''),f];})),incoming=Array.isArray(value.proposals)?value.proposals:[],valid=[],unresolved=Array.isArray(value.unresolved)?value.unresolved.slice():[],allowed=new Set(['sample_mapping','group_mapping','reference_classification','field_mapping','unit_mapping','metadata_value']),usedFindings=new Set();function reject(p,reason){unresolved.push({target:String(p&&p.target||p&&p.finding_id||'unknown'),reason:reason,evidence:(p&&p.evidence||[]).slice(0,3)});}incoming.forEach(function(p){p=p&&typeof p==='object'?p:{};let finding=byId.get(String(p.finding_id||''));if(!finding){const target=norm(p.target),matches=open.filter(function(f){return[target,norm(p.before)].filter(Boolean).some(function(t){return[norm(f.id),norm(f.target),norm(f.measurementId)].includes(t);});});if(matches.length===1){finding=matches[0];p.finding_id=finding.id;}}if(!finding){reject(p,'Proposal does not map to exactly one currently open deterministic ambiguity.');return;}if(usedFindings.has(String(finding.id||''))){reject(p,'More than one AI proposal targeted the same deterministic ambiguity.');return;}if(!allowed.has(String(p.patch_type||''))){reject(p,'Patch type is not permitted for AI semantic ambiguity repair.');return;}const needsMeasurement=/^(sample_mapping|group_mapping|reference_classification|metadata_value)$/.test(String(p.patch_type||''));p.target=String(needsMeasurement&&finding.measurementId?finding.measurementId:(p.target||finding.target||finding.measurementId||''));p.before=p.before==null?(finding.target||''):p.before;p.requires_human_review=true;p.decision='pending';p.applied=false;delete p.applyError;if(needsMeasurement&&!proposalMeasurements(ctx.exp,p).length){reject(p,'No canonical measurement target can be resolved for this proposal.');return;}usedFindings.add(String(finding.id||''));valid.push(p);});value.proposals=valid;value.unresolved=unresolved;value.sourceRevision=ctx.sourceRevision;value.generatedAt=new Date().toISOString();value.validation={received:incoming.length,applicable:valid.length,rejected:incoming.length-valid.length};LF.ActionData.setProposal(ctx.exp,'dataset.resolve-ambiguities','',value);return{stored:true,proposals:valid.length,rejected:incoming.length-valid.length,unresolved:unresolved.length};},
    'results.store-interpretation':function(ctx){const value=ctx.outputs.interpret||ctx.lastResult;if(!value||typeof value!=='object')throw new Error('The Results interpretation is empty.');const markdown=resultsInterpretationMarkdown(value);LF.ActionData.setAnnotation(ctx.exp,'results.interpret',{data:value,markdown:markdown,generatedAt:new Date().toISOString(),sourceRevision:ctx.sourceRevision});return{stored:true,observations:(value.observations||[]).length,hypotheses:(value.hypotheses||[]).length,status:value.status||'interpreted'};},
    'results.validate-comparison':function(ctx){
      const value=ctx.candidate||ctx.outputs.compare||ctx.lastResult||{},selection=resultsSelection(ctx),expected=selection.groups||[];
      if(expected.length<2)throw new Error('Select at least two Results groups to compare.');
      value.groups=expected.slice();
      if(value.status==='compared'&&!(value.contrasts||[]).length&&!(value.hypotheses||[]).length)value.status='insufficient_evidence';
      return value;
    },
    'results.store-comparison':function(ctx){const value=ctx.outputs.compare||ctx.lastResult;if(!value||typeof value!=='object')throw new Error('The Results comparison is empty.');const selection=resultsSelection(ctx),markdown=resultsComparisonMarkdown(value,selection);LF.ActionData.setAnnotation(ctx.exp,'results.compare',{data:value,markdown:markdown,selection:selection,selectionKey:resultsSelectionKey(selection),generatedAt:new Date().toISOString(),sourceRevision:ctx.sourceRevision});return{stored:true,groups:(value.groups||[]).length,contrasts:(value.contrasts||[]).length,status:value.status||'compared'};},
    'design.collect-selected':function(ctx){const exp=ctx.exp,current=Number(exp.sync&&exp.sync.revision||0);if(!exp.designAnalysis||Number(exp.designAnalysis.sourceRevision)!==current)exp.designAnalysis=designAnalysis(exp,current);const id=String(ctx.params&&ctx.params.deviceId||''),dev=(exp.design&&exp.design.devices||[]).find(function(d){return String(d.id)===id;});if(!dev)throw new Error('Select one experiment first.');const unknown=LF.DesignModel&&LF.DesignModel.missingDomains?LF.DesignModel.missingDomains(exp,dev):[];if(!unknown.length)throw new Error('This experiment already has solution chemistry, a complete device architecture and fabrication-process information.');return{device_id:id,sample_names:(dev.sampleNames||[]).slice(),manual_variant:!(dev.sampleNames||[]).length,unknown_fields:unknown,current_design:compact(dev),source_design:compact(exp.design&&exp.design.evidenceSummary||{})};},
    'design.validate-coverage':function(ctx){
      const proposal=LF.DesignModel.normalizeProposal(ctx.candidate||ctx.outputs.infer||ctx.lastResult||{}),scope=ctx.outputs.collect||{},wanted=Array.from(new Set((scope.sample_names||[]).map(String).filter(Boolean)));
      if(!String(scope.device_id||''))throw new Error('The selected Design experiment is unavailable.');
      proposal.devices=proposal.devices.slice(0,1);
      /* The public Action result is solutions + stack + process. Device identity
         belongs to LabFlow, so maintain one deterministic internal wrapper for
         application/UI without asking the model to echo IDs or sample names. */
      if(!proposal.devices[0])proposal.devices=[{name:'',sample_names:[],solution_names:[],process:{},stack:[],provenance_kind:'model_inference',confidence:null,reason:''}];
      const targetProposal=proposal.devices[0];
      targetProposal.sample_names=wanted.slice();
      if((proposal.stack||[]).length&&!(targetProposal.stack||[]).length)targetProposal.stack=proposal.stack.slice();
      const topProcess=proposal.process||{};targetProposal.process=targetProposal.process||{};['coating','annealing','atmosphere','notes','evidence','reason','provenance_kind'].forEach(function(k){if(!String(targetProposal.process[k]==null?'':targetProposal.process[k]).trim()&&String(topProcess[k]==null?'':topProcess[k]).trim())targetProposal.process[k]=topProcess[k];});if(targetProposal.process.confidence==null&&topProcess.confidence!=null)targetProposal.process.confidence=topProcess.confidence;
      if((proposal.solutions||[]).length&&!(targetProposal.solution_names||[]).length)targetProposal.solution_names=(proposal.solutions||[]).map(function(sol){return sol.name;}).filter(Boolean);
      sanitizeDesignProposal(proposal);
      const required=(scope.unknown_fields||[]).map(function(x){return String(x).toLowerCase();}),applicable=applicableDesignFields(proposal,required),missingRequired=required.filter(function(field){return !applicable.includes(field);});
      /* A partial Design answer used to pass as soon as any one domain was useful.
         That made chemistry disappear whenever the model returned stack/process first.
         For a suggested result, require every currently-missing domain. The thrown
         contract error feeds the exact gaps back into the bounded AI retry. */
      if(missingRequired.length){
        const labels=missingRequired.map(function(field){return field==='solutions'?'solutions: return at least one qualitative formulation with non-empty solutes and/or solvents':field==='stack'?'stack: return a coherent qualitative device stack':'process: return at least one qualitative coating/annealing/atmosphere/notes field';});
        const err=new Error('Design inference did not cover every missing domain: '+missingRequired.join(', ')+'.');
        err.code='MODEL_OUTPUT_INVALID';err.isContract=true;err.validationErrors=labels;throw err;
      }
      proposal.status='suggested';
      proposal.validation={targetDeviceId:String(scope.device_id||''),manualVariant:!!scope.manual_variant,applicableFields:applicable,unresolvedCount:(proposal.unknowns||[]).length};
      return proposal;
    },
    'design.store-proposal':function(ctx){
      const p=LF.DesignModel.normalizeProposal(ctx.outputs.infer||ctx.lastResult),deviceId=String(ctx.params&&ctx.params.deviceId||ctx.outputs.collect&&ctx.outputs.collect.device_id||'');
      (p.solutions||[]).concat(p.devices||[]).forEach(function(x){x.decision='pending';x.applied=false;});
      p.sourceRevision=ctx.sourceRevision;p.targetDeviceId=deviceId;p.generatedAt=new Date().toISOString();p.cabinetMatches=LF.Cabinet&&LF.Cabinet.matchProposal?LF.Cabinet.matchProposal(p):[];
      if(LF.ContextBuilder&&LF.ContextBuilder.pack){const pack=LF.ContextBuilder.pack('design',{exp:ctx.exp,params:{deviceId:deviceId}});if(pack&&pack.design_evidence_summary)p.contextBasis=pack.design_evidence_summary;}
      p.applicationSummary=designApplicationSummary(p);
      if(deviceId){LF.ActionData.setProposal(ctx.exp,'design.infer',deviceId,p);LF.ActionData.setStatus(ctx.exp,'design.infer',deviceId,{state:'suggested',updatedAt:p.generatedAt,message:''});}
      return{stored:true,status:p.status,targetDeviceId:deviceId,devices:p.devices.length,solutions:p.solutions.length,unresolvedCount:(p.unknowns||[]).length};
    }
  };
  function markDesignDecision(item,field,state){const d=fieldDecision(item,field);if(!d)return;if(state==='applied'){d.applied=true;d.skipped='';}else if(state)d.skipped=state;}
  function decisionsComplete(item,fields){const wanted=new Set(fields||[]),list=(item&&item.field_decisions||[]).filter(function(d){return!wanted.size||wanted.has(d.field);});return list.length>0&&list.every(function(d){return d.applied||d.skipped==='existing';});}
  function fillMissing(dst,src,fields,sourceItem,inheritedProvenance,manual){let n=0;fields.forEach(function(k){const cur=dst[k],next=src[k];if(cur!=null&&String(cur).trim()!==''){markDesignDecision(sourceItem||src,k,'existing');return;}if(autoApplyAllowed(sourceItem||src,k,next,inheritedProvenance,manual)){dst[k]=next;markDesignDecision(sourceItem||src,k,'applied');n++;}});return n;}
  function fillMetadata(dst,src){let n=0;['evidence','confidence','provenance_kind','reason'].forEach(function(k){const cur=dst[k],next=src[k];if((cur==null||String(cur).trim()==='')&&next!=null&&String(next).trim()!==''){dst[k]=next;n++;}});return n;}
  function activeDesignProposal(exp,targetId){const preferred=String(targetId||LF.State&&LF.State.state&&LF.State.state.selectedDesignDeviceId||''),direct=preferred&&LF.ActionData?LF.ActionData.proposal(exp,'design.infer',preferred):null;if(direct)return direct;const map=LF.ActionData?LF.ActionData.proposals(exp,'design.infer'):{};const first=Object.keys(map||{})[0];return first?map[first]:null;}
  function proposalDeviceTarget(exp,src,proposal){
    const targetId=String(proposal&&proposal.targetDeviceId||''),names=(src.sample_names||[]).map(String);
    let dst=targetId&&(exp.design.devices||[]).find(function(d){return String(d.id)===targetId;});
    if(!dst)dst=(exp.design.devices||[]).find(function(d){return names.some(function(n){return(d.sampleNames||[]).includes(n);});})||(exp.design.devices||[]).find(function(d){return String(d.name||'').toLowerCase()===String(src.name||'').toLowerCase();});
    if(!dst){const sampleIds=(exp.samples||[]).filter(function(s){return names.includes(s.name);}).map(function(s){return s.id;});dst=LF.DomainSchema.create('design_device',{sampleIds:sampleIds,sampleNames:names.slice(),solutionIds:[],stack:[],process:{coating:'',annealing:'',atmosphere:'',notes:''},status:'ai_inferred',provenanceKind:'model_inference'});exp.design.devices.push(dst);}
    return dst;
  }

  function designSolutionTarget(exp,src){
    const fields=['role','solutes','solvents','concentration','additives'],name=norm(src&&src.name),solutions=exp.design&&exp.design.solutions||[];
    function compatible(sol){for(let i=0;i<fields.length;i++){const a=norm(sol&&sol[fields[i]]),b=norm(src&&src[fields[i]]);if(a&&b&&a!==b)return false;}return true;}
    let dst=solutions.find(function(sol){return name&&norm(sol.name)===name&&compatible(sol);});
    if(!dst){const scientific=fields.some(function(field){return norm(src&&src[field]);});if(scientific)dst=solutions.find(function(sol){return compatible(sol)&&fields.some(function(field){return norm(sol&&sol[field])&&norm(sol[field])===norm(src&&src[field]);});});}
    return dst||null;
  }
  const appliedSolutionTargets=new WeakMap();
  function applyDesignSolution(exp,src,manual,strictTarget){const fields=['name','role','solutes','solvents','concentration','additives','preparation'],name=norm(src&&src.name),key=norm((src&&src.name||'')+'|'+(src&&src.role||''));let dst=strictTarget?designSolutionTarget(exp,src):(exp.design.solutions||[]).find(function(sol){return(name&&norm(sol.name)===name)||norm((sol.name||'')+'|'+(sol.role||''))===key;}),created=false;if(!dst){dst=LF.DomainSchema.create('design_solution',{status:'ai_inferred',provenanceKind:'model_inference'});exp.design.solutions.push(dst);created=true;}let n=fillMissing(dst,src,fields,src,null,manual);if(n)n+=fillMetadata(dst,src);if(!n&&created)exp.design.solutions=exp.design.solutions.filter(function(x){return x!==dst;});if(dst&&dst.id)appliedSolutionTargets.set(src,dst.id);if(n){dst.status=dst.status==='user_confirmed'?'user_confirmed':'ai_inferred';dst.aiAssisted=true;dst.aiAssistedAt=new Date().toISOString();src.applied=decisionsComplete(src,fields);src.appliedSome=true;src.decision=src.applied?'accepted':'pending';}return n;}
  function applyDesignStack(dst,src,manual){
    const proposed=src.stack||[],current=dst.stack||[];let n=0;
    if(!proposed.length)return n;
    const partial=LF.DesignModel&&LF.DesignModel.stackAssessment&&!LF.DesignModel.stackAssessment(current).complete&&proposed.length>=3;
    if(partial){
      const remaining=current.slice(),merged=[];
      proposed.forEach(function(sl){const material=String(sl.material||'').trim().toLowerCase(),role=String(sl.role||'').trim().toLowerCase();let index=remaining.findIndex(function(dl){return material&&String(dl.material||'').trim().toLowerCase()===material;});if(index<0)index=remaining.findIndex(function(dl){return role&&String(dl.role||'').trim().toLowerCase()===role;});const dl=index>=0?remaining.splice(index,1)[0]:LF.DomainSchema.create('design_layer',{status:'ai_inferred',provenanceKind:sl.provenance_kind||src.provenance_kind||'model_inference'}),before=n;n+=fillMissing(dl,sl,['role','material','thickness','process'],sl,src.provenance_kind,manual);if(n>before)n+=fillMissing(dl,sl,['evidence','reason'],sl,src.provenance_kind,manual);if(index>=0||n>before)merged.push(dl);});
      if(merged.length){dst.stack=merged.concat(remaining);n++;}
      return n;
    }
    proposed.forEach(function(sl,i){let dl=current[i],created=false;if(!dl){dl=LF.DomainSchema.create('design_layer',{status:'ai_inferred',provenanceKind:sl.provenance_kind||src.provenance_kind||'model_inference'});current.push(dl);created=true;}const before=n;n+=fillMissing(dl,sl,['role','material','thickness','process'],sl,src.provenance_kind,manual);if(n>before)n+=fillMissing(dl,sl,['evidence','reason'],sl,src.provenance_kind,manual);if(created&&n===before)current.pop();});
    dst.stack=current;return n;
  }
  function applyDesignDevice(exp,src,part,manual,proposal){const dst=proposalDeviceTarget(exp,src,proposal),names=(src.sample_names||[]).map(String),sampleIds=(exp.samples||[]).filter(function(s){return names.includes(s.name);}).map(function(s){return s.id;});let n=0;dst.sampleIds=Array.from(new Set((dst.sampleIds||[]).concat(sampleIds)));const resolvedNames=(dst.sampleIds||[]).map(function(id){const sample=(exp.samples||[]).find(function(s){return s.id===id;});return sample&&sample.name||'';}).filter(Boolean);dst.sampleNames=resolvedNames.length?resolvedNames:Array.from(new Set((dst.sampleNames||[]).concat(names).filter(Boolean)));if(part==='all'||part==='identity'){n+=fillMissing(dst,src,['name','group'],src,null,manual);if(n)n+=fillMissing(dst,src,['evidence','confidence','reason'],src,null,manual);if(!dst.provenanceKind&&src.provenance_kind){dst.provenanceKind=src.provenance_kind;n++;}}
    if(part==='all'||part==='solutions'){const ids=[];(src.solution_names||[]).forEach(function(name){const proposalSolution=proposal&&(proposal.solutions||[]).find(function(sol){return norm(sol&&sol.name)===norm(name);}),mappedId=proposalSolution&&appliedSolutionTargets.get(proposalSolution),target=mappedId&&(exp.design.solutions||[]).find(function(sol){return String(sol.id)===String(mappedId);})||proposalSolution&&designSolutionTarget(exp,proposalSolution);if(target&&!ids.includes(target.id))ids.push(target.id);else if(!proposalSolution){const matches=(exp.design.solutions||[]).filter(function(sol){return norm(sol.name)===norm(name);});if(matches.length===1&&!ids.includes(matches[0].id))ids.push(matches[0].id);}});ids.forEach(function(id){if(!(dst.solutionIds||[]).includes(id)){dst.solutionIds=dst.solutionIds||[];dst.solutionIds.push(id);n++;}});if(ids.length)markDesignDecision(src,'solutions','applied');}
    if(part==='all'||part==='process'){dst.process=dst.process||{};n+=fillMissing(dst.process,src.process||{},['coating','annealing','atmosphere','notes'],src,null,manual);}
    if(part==='all'||part==='stack')n+=applyDesignStack(dst,src,manual);
    if(n){if(dst.status!=='user_confirmed')dst.status='ai_inferred';dst.aiAssisted=true;dst.aiAssistedAt=new Date().toISOString();if(part==='all'){src.applied=decisionsComplete(src);src.decision=src.applied?'accepted':'pending';}src.appliedParts=src.appliedParts||{};const partFields=part==='process'?['coating','annealing','atmosphere','notes']:part==='solutions'?['solutions']:[];src.appliedParts[part]=part==='stack'?(src.stack||[]).every(function(layer){return decisionsComplete(layer);}):decisionsComplete(src,partFields);}return n;}
  function applyOneDesign(exp,kind,index,part,targetId){const p=activeDesignProposal(exp,targetId);if(!p)throw new Error('No AI design proposal is available.');let changed=0;if(kind==='solution'){const src=(p.solutions||[])[index];if(!src)throw new Error('Design solution proposal not found.');changed=applyDesignSolution(exp,src,true);}else{const src=(p.devices||[])[index];if(!src)throw new Error('Design device proposal not found.');changed=applyDesignDevice(exp,src,part||'all',true,p);}if(!changed)throw new Error('The proposed values are already present or protected by researcher-entered values.');exp.design.status='reviewing';return{changed:changed,summary:designApplicationSummary(p)};}
  function applyAllDesign(exp,targetId){const p=activeDesignProposal(exp,targetId);if(!p)throw new Error('No AI design proposal is available.');let changed=0,items=0;(p.solutions||[]).forEach(function(src){if(src.applied)return;const n=applyDesignSolution(exp,src,false);changed+=n;if(n)items++;});(p.devices||[]).forEach(function(src){const parts=src.appliedParts||{};if(src.solution_names&&src.solution_names.length&&!parts.solutions){const n=applyDesignDevice(exp,src,'solutions',false,p);changed+=n;if(n)items++;}if(src.process&&Object.keys(src.process).some(function(k){return String(src.process[k]==null?'':src.process[k]).trim()!=='';})&&!parts.process){const n=applyDesignDevice(exp,src,'process',false,p);changed+=n;if(n)items++;}if(src.stack&&src.stack.length&&!parts.stack){const n=applyDesignDevice(exp,src,'stack',false,p);changed+=n;if(n)items++;}});exp.design.status='reviewing';const summary=designApplicationSummary(p);p.applicationSummary=summary;return{changed:changed,items:items,autoApplied:summary.auto_applied_count,review:summary.review_count,unresolved:summary.unresolved_count};}
  function applyAllDesignProposals(exp){const map=LF.ActionData?LF.ActionData.proposals(exp,'design.infer'):{},ids=Object.keys(map||{});let changed=0,items=0,proposals=0;ids.forEach(function(id){const proposal=map[id];if(!proposal)return;const out=applyAllDesign(exp,id);if(out.changed){changed+=out.changed;items+=out.items||0;proposals++;}});exp.design.status='reviewing';return{changed:changed,items:items,proposals:proposals,totalProposals:ids.length};}
  function acceptDesignProposal(exp,deviceId,options){
    const id=String(deviceId||''),p=LF.ActionData&&LF.ActionData.proposal(exp,'design.infer',id);
    if(!p)throw new Error('No AI suggestion is available for this experiment.');
    let changed=0;
    (p.solutions||[]).forEach(function(sol){changed+=applyDesignSolution(exp,sol,true,!!(options&&options.distinctSolutions));});
    const d=p.devices&&p.devices[0];
    if(d){changed+=applyDesignDevice(exp,d,'solutions',true,p);changed+=applyDesignDevice(exp,d,'process',true,p);changed+=applyDesignDevice(exp,d,'stack',true,p);}
    const target=(exp.design&&exp.design.devices||[]).find(function(x){return String(x.id)===id;}),remaining=target&&LF.DesignModel&&LF.DesignModel.missingDomains?LF.DesignModel.missingDomains(exp,target):[];
    const complete=!!target&&!remaining.length,now=new Date().toISOString();
    if(target&&complete){
      target.validatedAt=now;target.validationSource='researcher_accept_ai';target.status='user_confirmed';
      (target.stack||[]).forEach(function(layer){if(layer.status==='ai_inferred')layer.status='user_confirmed';});
      (target.solutionIds||[]).forEach(function(solutionId){const sol=(exp.design.solutions||[]).find(function(x){return String(x.id)===String(solutionId);});if(sol&&sol.status==='ai_inferred')sol.status='user_confirmed';});
    }
    /* Acceptance is a commit of the proposal values. If an old/stale proposal
       still cannot satisfy the current Design completeness rule, discard that
       exhausted proposal and expose the remaining domains for a fresh inference
       instead of incorrectly labelling the experiment Accepted. */
    LF.ActionData.removeProposal(exp,'design.infer',id);
    LF.ActionData.setStatus(exp,'design.infer',id,{state:complete?'accepted':'incomplete',updatedAt:now,message:complete?'':'Still missing: '+remaining.join(', ')});
    exp.design.status='reviewing';
    return{changed:changed,deviceId:id,complete:complete,remaining:remaining};
  }
  function acceptAllDesignProposals(exp){
    const map=LF.ActionData?LF.ActionData.proposals(exp,'design.infer'):{},ids=Object.keys(map||{});let changed=0,accepted=0,failed=[],incomplete=[],acceptedIds=[];
    ids.forEach(function(id){try{const out=acceptDesignProposal(exp,id,{distinctSolutions:true});changed+=out.changed;if(out.complete){accepted++;acceptedIds.push(id);}else incomplete.push({id:id,remaining:(out.remaining||[]).slice()});}catch(err){failed.push({id:id,message:err&&err.message||String(err)});}});
    return{changed:changed,accepted:accepted,acceptedIds:acceptedIds,incomplete:incomplete,failed:failed,total:ids.length};
  }
  function applyAcceptedDesign(exp,targetId){const p=activeDesignProposal(exp,targetId);if(!p)throw new Error('No AI design proposal is available.');const acceptedSolutions=(p.solutions||[]).filter(function(x){return x.decision==='accepted'&&!x.applied;}),acceptedDevices=(p.devices||[]).filter(function(x){return x.decision==='accepted'&&!x.applied;});if(!acceptedSolutions.length&&!acceptedDevices.length)throw new Error('Accept at least one design proposal first.');let changed=0;acceptedSolutions.forEach(function(src){changed+=applyDesignSolution(exp,src,true);});acceptedDevices.forEach(function(src){changed+=applyDesignDevice(exp,src,'all',true,p);});exp.design.status='reviewing';return{solutions:acceptedSolutions.length,devices:acceptedDevices.length,changed:changed};}
  function applySelectedDevice(exp, deviceId, targetId) {const p=activeDesignProposal(exp,targetId);if(!p)throw new Error('No AI design proposal is available.');const src=(p.devices||[]).find(function(d){return d.id===deviceId;})||(p.devices||[]).find(function(d){return String(d.name)===String(deviceId);});if(!src)throw new Error('Selected experiment proposal not found.');let changed=0;(p.solutions||[]).forEach(function(sol){if((src.solution_names||[]).some(function(n){return norm(sol.name)===norm(n);}))changed+=applyDesignSolution(exp,sol,true);});changed+=applyDesignDevice(exp,src,'all',true,p);if(!changed)throw new Error('The proposed values are already present or protected by researcher-entered values.');exp.design.status='reviewing';return{changed:changed};}
  LF.ActionSteps=steps;
  const actionStepTools={
    'dataset.collect-ambiguities':{domain:'dataset',access:'read'},
    'dataset.store-corrections':{domain:'dataset',access:'write'},
    'design.collect-selected':{domain:'design',access:'read'},
    'design.validate-coverage':{domain:'design',access:'read'},
    'design.store-proposal':{domain:'design',access:'write'},
    'results.store-interpretation':{domain:'results',access:'write'},
    'results.validate-comparison':{domain:'results',access:'read'},
    'results.store-comparison':{domain:'results',access:'write'}
  };
  LF.ActionStepTools=actionStepTools;
  if(LF.ToolRegistry&&LF.ToolRegistry.registerActionStep){
    Object.keys(actionStepTools).forEach(function(id){if(!LF.ToolRegistry.definition(id))LF.ToolRegistry.registerActionStep(id,actionStepTools[id]);});
  }
  LF.ActionStepRegistry={
    ids:function(){return Object.keys(steps);},
    has:function(id){return typeof steps[id]==='function';},
    register:function(id,fn,meta){
      if(!id||typeof fn!=='function')throw new Error('Action step id and function are required.');
      if(steps[id])throw new Error('Action step already registered: '+id);
      steps[id]=fn;
      if(LF.ToolRegistry&&LF.ToolRegistry.registerActionStep)LF.ToolRegistry.registerActionStep(id,meta||{});
      return id;
    }
  };
  LF.DatasetCorrections={applyProposal:applyProposal,rebuildSamples:rebuildSamples,proposalMeasurements:proposalMeasurements,safeFixes:safeFixes,reviewFixes:reviewFixes,applyAutomaticSafeFixes:applyAutomaticSafeFixes,analysis:datasetAnalysis};
  LF.DesignAnalysis={build:designAnalysis,applyAccepted:applyAcceptedDesign,applyOne:applyOneDesign,applyAll:applyAllDesign,applyAllProposals:applyAllDesignProposals,acceptProposal:acceptDesignProposal,acceptAllProposals:acceptAllDesignProposals,applySelectedDevice:applySelectedDevice,isQuantitative:looksQuantitative,sanitizeProposal:sanitizeDesignProposal,summarizeProposal:designApplicationSummary};
}());
