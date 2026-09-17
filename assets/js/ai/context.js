/*
 * Build bounded authority-labelled Context Packs for Actions and Assistant.
 * Boundary: Keep experiment evidence, Cabinet references, KB references and Action output distinguishable.
 */
(function(){
  'use strict';
  const LF=window.LabFlow=window.LabFlow||{},Log=LF.Logger?LF.Logger.scope('context'):null;
  const STOP=new Set('the a an and or but for with from this that these those what why how which into about show tell compare explain ' +
    'please can could would should are is was were has have had del della delle degli dei di da in con per su tra fra un una uno il lo la i gli le e o che come cosa quale quali quanto perché'.split(' '));
  function expOf(){return(LF.DataModel&&LF.DataModel.getExperiment&&LF.DataModel.getExperiment())||(LF.State&&LF.State.state&&LF.State.state.experiment)||{};}
  function clean(v){return LF.PageContext&&LF.PageContext.cleanText?LF.PageContext.cleanText(v):String(v==null?'':v).replace(/%%LF(?:MD|CODE)[^%]*%%/g,'').trim();}
  function sanitize(v){if(v==null||typeof v==='number'||typeof v==='boolean')return v;if(typeof v==='string')return clean(v);if(Array.isArray(v))return v.map(sanitize);if(typeof v==='object'){const o={};Object.keys(v).forEach(function(k){o[k]=sanitize(v[k]);});return o;}return clean(v);}
  function stripPolicy(md){return clean(md).replace(/```json\s+(?:labflow-rules|labflow-ground-truth)\s*\n[\s\S]*?\n```/g,'[Machine-readable policy omitted; deterministic code already applies it.]');}
  function policy(id){return LF.PromptRegistry&&LF.PromptRegistry.promptText?stripPolicy(LF.PromptRegistry.promptText(id)):'';}
  function take(v,n){return(Array.isArray(v)?v:[]).slice(0,n);}
  function clip(v,n){const s=clean(v);return s.length>n?s.slice(0,n)+'…':s;}
  function words(text){return clean(text).toLowerCase().replace(/[^a-z0-9_\-.]+/g,' ').split(/\s+/).filter(function(x){return x.length>=3&&!STOP.has(x);}).slice(0,24);}
  function compact(v){return sanitize(LF.CanonicalStore&&LF.CanonicalStore.compact?LF.CanonicalStore.compact(v,360):v);}
  function pageContext(){
    const raw=LF.PageContext&&LF.PageContext.snapshot?LF.PageContext.snapshot():{},page=clean(raw&&raw.page),out={page:page,view:clean(raw&&raw.view),selected:sanitize(raw&&raw.selected||{}),filters:sanitize(raw&&raw.filters||{}),visible:take(raw&&raw.visible,16).map(clean)};


    if(page==='Settings'||page==='Logs')return out;
    if(raw&&raw.data&&typeof raw.data==='object')out.data=compact(raw.data);
    return out;
  }
  function dataState(exp){const sync=exp.sync||{},patches=exp.patches||[];return{basis:patches.length?'labflow_data_with_changes':'imported_data_interpretation',source_archive:exp.meta&&exp.meta.sourceName||'',revision:Number(sync.revision||0),applied_changes:patches.length};}
  function sharedBrief(exp){const b=LF.ExperimentBrief&&
LF.ExperimentBrief.ensure?LF.ExperimentBrief.ensure(exp):exp.experimentBrief||null;if(!b)return null;
    const d=b.deterministic||{},det={scope:sanitize(d.scope||{}),performance:sanitize(Object.assign({},d.performance||{},{
    top_reference:take(d.performance&&d.performance.top_reference,3),
    top_non_reference:take(d.performance&&d.performance.top_non_reference,3)}
    )),comparisons:sanitize(take(d.comparisons,8)),quality:sanitize(Object.assign({},d.quality||{},{
    anomalies:take(d.quality&&d.quality.anomalies,6)})),design:sanitize(d.design||{}
    ),unresolved:sanitize(take(d.unresolved,8))};
    return{input_signature:b.inputSignature||'',status:'deterministic',deterministic:det};}
  function actionCatalog(exp){if(!LF.ActionCapabilities||!LF.ActionCapabilities.assistantCatalog)return[];return LF.ActionCapabilities.assistantCatalog({exp:exp}).map(function(item){item.purpose=clip(item.purpose||'',260);item.blocked_reason=clip(item.blocked_reason||'',220);return item;});}
  function recentActionEvents(exp){const conv=(exp&&exp.derived&&exp.derived.chat&&exp.derived.chat.conversation)||[];
return conv.filter(function(m){return m&&m.role==='system'&&m.actionId;
    }).slice(-6).map(function(m){return{action_id:clean(m.actionId),title:clean(m.actionTitle||m.eventTitle),
    command:LF.ActionCapabilities&&LF.ActionCapabilities.command?LF.ActionCapabilities.command(m.actionId):'',
    status:m.error?'error':m.unavailable?'unavailable':'completed',route:clean(m.route||''),page:clean(m.page||''),
    output:clip(m.content,1200),created_at:m.createdAt||''};});}
  function chatMemory(exp){const settings=LF.Storage.getAssistantSettings?LF.Storage.getAssistantSettings():{
memoryTurns:6,memoryChars:6000,messageChars:1800,memoryEnabled:true};if(!settings.memoryEnabled)return[];
    const conv=(exp.derived&&exp.derived.chat&&exp.derived.chat.conversation)||[],messages=conv.filter(function(m){
    return(m.role==='user'||m.role==='assistant')&&(!m.state||m.state==='complete');
    }).slice(-Math.max(0,settings.memoryTurns*2)),out=[];let chars=0;for(let i=messages.length-1;i>=0;
    i--){const m=messages[i],content=clip(m.content,settings.messageChars);if(!content)continue;
    if(chars+content.length>settings.memoryChars)break;
    out.unshift({role:m.role,content:content,route:clean(m.route||''),page:clean(m.page||''),view:clean(m.view||'')});
    chars+=content.length;}return out;}
  function findingRef(f){return{id:f.id||'',type:f.type||'',severity:f.severity||'info',title:clean(f.title),detail:clip(f.detail,360),target:clean(f.target),measurement_id:f.measurementId||'',status:f.status||'open'};}
  function measurementRef(m){
    return{
      id:m.id||'',sample:clean(m.sample),group:clean(m.group),is_ref:!!m.isRef,file:clean(m.path||m.file),
      technique:clean(m.technique||'unknown'),quality:m.qualityStatus||'',eligible:!!m.rankingEligible,
      parameters:take(m.parameters,16).map(compact),observables:take(m.observables,20).map(compact),
      setup_ref:clean(m.setupRef),instrument_refs:take(m.instrumentRefs,12).map(clean),software_ref:clean(m.softwareRef),
      location_ref:clean(m.locationRef),sample_linkage:compact(m.sampleLinkage||null),best_efficiency:m.bestEff,
      hysteresis:m.hysteresis,fw:compact(m.fw||null),rv:compact(m.rv||null)
    };
  }
  function sampleRef(s){return{id:s.id||'',name:clean(s.name),aliases:take(s.aliases||[s.rawName],6).map(clean),group:clean(s.group),is_ref:!!s.isRef,measurement_ids:take(s.measurementIds,20)};}
  function boundValue(value,stringLimit,arrayLimit,keyLimit,depth){
    depth=Number(depth)||0;if(value==null||typeof value==='number'||typeof value==='boolean')return value;
    if(typeof value==='string')return clip(value,Math.max(48,stringLimit));
    if(Array.isArray(value))return value.slice(0,Math.max(1,arrayLimit)).map(function(item){return boundValue(item,stringLimit,arrayLimit,keyLimit,depth+1);});
    if(typeof value==='object'){
      if(depth>7)return '[bounded]';
      const out={},keys=Object.keys(value).slice(0,Math.max(4,keyLimit));
      keys.forEach(function(key){if(/^(rawText|content|data|rows|curve|curves|points)$/i.test(key))return;out[key]=boundValue(value[key],stringLimit,arrayLimit,keyLimit,depth+1);});
      return out;
    }
    return clip(value,stringLimit);
  }
  function budgetPack(obj,maxChars){
    maxChars=Math.max(1800,Number(maxChars)||14000);obj=sanitize(obj);let json=JSON.stringify(obj);if(json.length<=maxChars)return obj;
    if(obj&&obj.context_pack&&obj.context_pack.profile==='design')return designBudgetPack(obj,maxChars);
    const copy=JSON.parse(json),trim=['evidence','findings','measurements','samples','results','relations','history','provenance'];
    trim.forEach(function(k){if(JSON.stringify(copy).length<=maxChars)return;if(Array.isArray(copy[k]))copy[k]=copy[k].slice(0,Math.max(2,Math.min(10,Math.floor(copy[k].length/2))));});
    copy.context_notice='Context was deterministically bounded to fit the active model. Use a narrower Tool/Action to retrieve omitted detail.';
    if(JSON.stringify(copy).length<=maxChars)return copy;
    const levels=[
      {s:900,a:12,k:32},{s:600,a:10,k:26},{s:420,a:8,k:22},{s:280,a:6,k:18},{s:180,a:4,k:14},{s:110,a:3,k:10}
    ];
    for(const level of levels){const bounded=boundValue(copy,level.s,level.a,level.k,0);bounded.context_notice=copy.context_notice;if(JSON.stringify(bounded).length<=maxChars)return bounded;}
    const fallback={context_pack:boundValue(copy.context_pack||{},120,4,12,0),experiment:boundValue(copy.experiment||{},180,4,14,0),data_state:boundValue(copy.data_state||{},120,4,12,0),experiment_brief:boundValue(copy.experiment_brief||{},140,3,12,0),context_notice:copy.context_notice,omitted_detail:true};
    if(JSON.stringify(fallback).length<=maxChars)return fallback;
    return boundValue(fallback,80,2,8,0);
  }
  function compactDesignDomainCandidates(value){
    const out={solutions:[],stack:[],process:[]};
    ['solutions','stack','process'].forEach(function(domain){
      out[domain]=(value&&Array.isArray(value[domain])?value[domain]:[]).slice(0,2).map(function(entry){
        if(!entry||typeof entry!=='object')return entry;
        return{
          id:entry.id||'',kind:entry.kind||'',name:entry.name||'',title:entry.title||'',role:entry.role||'',
          solutes:entry.solutes||'',solvents:entry.solvents||'',additives:entry.additives||'',preparation:entry.preparation||'',
          layers:Array.isArray(entry.layers)?entry.layers.slice(0,10):undefined,
          coating:entry.coating||'',annealing:entry.annealing||'',atmosphere:entry.atmosphere||'',notes:entry.notes||'',
          design_hint:entry.design_hint||null
        };
      });
    });
    return out;
  }
  function designBudgetPack(obj,maxChars){
    maxChars=Math.max(3200,Number(maxChars)||14000);
    const full=sanitize(obj||{}),cab=full.cabinet||{},kb=full.knowledge||{};
    const essential={
      context_pack:full.context_pack||{},source_contract:full.source_contract||{},experiment:full.experiment||{},data_state:full.data_state||{},
      scope:full.scope||{},design_evidence_summary:full.design_evidence_summary||{},current_design:full.current_design||{},known_solutions:full.known_solutions||[],
      cabinet:{domain_candidates:compactDesignDomainCandidates(cab.domain_candidates),retrieval:cab.retrieval||{},note:cab.note||'',citation_contract:cab.citation_contract||''},
      knowledge:{domain_candidates:compactDesignDomainCandidates(kb.domain_candidates),retrieval:kb.retrieval||{},note:kb.note||'',citation_contract:kb.citation_contract||''},
      samples:(full.samples||[]).slice(0,6),evidence:(full.evidence||[]).slice(0,6),source_context:full.source_context||{},
      context_notice:full.context_notice||''
    };
    if(JSON.stringify(essential).length<=maxChars)return essential;
    essential.evidence=(essential.evidence||[]).slice(0,3);
    essential.samples=(essential.samples||[]).slice(0,3);
    if(essential.source_context&&essential.source_context.measurement_files)essential.source_context.measurement_files=essential.source_context.measurement_files.slice(0,6);
    if(JSON.stringify(essential).length<=maxChars)return essential;
    essential.evidence=[]; essential.samples=[];
    if(essential.source_context)essential.source_context={experiment:essential.source_context.experiment||{},source_design:essential.source_context.source_design||{}};
    if(JSON.stringify(essential).length<=maxChars)return essential;
    /* Keep Design reference candidates even under severe compaction: they are the deterministic
       fallback contract, whereas generic evidence/detail can be recovered elsewhere. */
    const bounded=boundValue(essential,180,3,18,0);
    bounded.cabinet=essential.cabinet; bounded.knowledge=essential.knowledge; bounded.scope=essential.scope;
    bounded.context_notice='Design context was compacted; structured Cabinet/Knowledge Base candidates were preserved.';
    return bounded;
  }

  function base(exp,profile){
    const sum=LF.CanonicalStore.summary(exp);
    return{
      context_pack:{profile:profile,source_revision:sum.revision,budgeted:true},
      source_contract:{
        experiment:'authoritative current-experiment data/evidence',
        actions:'persisted workflow outputs; proposals remain review-only until accepted',
        cabinet:'researcher-curated workspace reference; never experiment evidence',
        knowledge:'sourced general reference; never experiment evidence',
        history:'conversation context only',
        workspace:'researcher-defined data-generating environment and Process definitions; context, not measurement evidence'
      },
      experiment:{id:exp.id||'',name:clean(exp.meta&&exp.meta.name),workspace_id:clean(exp.meta&&exp.meta.workspaceId),process_id:clean(exp.meta&&exp.meta.processId),summary:sum},
      workspace:LF.Workspace&&LF.Workspace.compact?LF.Workspace.compact():null,
      data_state:dataState(exp),experiment_brief:sharedBrief(exp),page_context:pageContext()
    };
  }
  function relatedFromQuestion(exp,question){
const matches=LF.CanonicalStore.matchTerms(exp,question,12),ids=matches.map(function(x){return x.id;
    }),samples=ids.map(function(id){return LF.CanonicalStore.record(exp,id);
    }).filter(Boolean),names=new Set(samples.map(function(s){return String(s.name);
    })),measurements=(exp.measurements||[]).filter(function(m){return names.has(String(m.sample));}).slice(0,24);
    return{matches:matches,samples:samples,measurements:measurements,ids:ids};}
  function pageEntityIds(exp,ctx){const out=[];const s=ctx.selected||{};
[s.sample,s.measurement,s.finding,s.experiment,s.mapping].forEach(function(id){if(id){
    const e=LF.CanonicalStore.record(exp,id)||LF.CanonicalStore.sample(exp,id);if(e&&e.id)out.push(e.id);
    else out.push(String(id));}});if(Array.isArray(s.groups)){(exp.samples||[]).filter(function(x){
    return s.groups.includes(x.group);}).forEach(function(x){out.push(x.id);});}return Array.from(new Set(out));}
  function packChat(exp,opts){const q=clean(opts.question),out=base(exp,'chat',q),pc=out.page_context||{}
,related=relatedFromQuestion(exp,q),ids=related.ids.concat(pageEntityIds(exp,pc));
    const selectedMeasurement=(exp.measurements||[]).find(function(m){
    return String(m.id)===String(pc.selected&&pc.selected.measurement||'');});
    if(selectedMeasurement)ids.push(selectedMeasurement.id);const focus=[];
    if(selectedMeasurement)focus.push(selectedMeasurement);
    related.measurements.forEach(function(m){if(!focus.some(function(x){return x.id===m.id;}))focus.push(m);});
    out.samples=related.samples.slice(0,12).map(sampleRef);out.measurements=focus.slice(0,18).map(measurementRef);
    out.results={summary:compact(exp.analysis&&exp.analysis.summary||{}
    ),top_non_ref:take(exp.analysis&&exp.analysis.topNonRef,6),top_ref:take(exp.analysis&&exp.analysis.topRef,6)};
    out.action_catalog=actionCatalog(exp);out.action_outputs=LF.ActionData&&
    LF.ActionData.assistantContext?LF.ActionData.assistantContext(exp,{limit:8}):{items:[]};
    out.recent_actions=recentActionEvents(exp);
    const terms=words(q),open=(exp.findings||[]).filter(function(f){return f.status!=='resolved';
    }),matched=open.filter(function(f){const hay=clean([f.title,f.detail,f.target].join(' ')).toLowerCase();
    return terms.some(function(t){return hay.indexOf(t)>=0;
    })||ids.includes(String(f.measurementId||''))||ids.includes(String(f.id||''));});
    out.findings=(matched.length?matched:(pc.page==='Review data'?open.slice(0,10):[])).slice(0,12).map(findingRef);
    out.evidence=LF.CanonicalStore.evidence(exp,{record_ids:Array.from(new Set(ids)),terms:terms,limit:18}).map(function(e){
    return{id:e.id,type:e.type,fact:clean(e.fact),summary:clean(e.summary),source:clean(e.source_path||e.source_id)};});
    const designId=pc.selected&&pc.selected.experiment;
    out.design=designId?compact((exp.design&&exp.design.devices||[]).find(function(d){
    return String(d.id)===String(designId);})||null):null;
    if(pc.page==='Export'){
      const plan=exp.nomad&&exp.nomad.mappingPlan||{};
      const prep=LF.ExportProjections&&LF.ExportProjections.preparationContext
        ?LF.ExportProjections.preparationContext(exp):null;
      out.nomad={validation:compact(exp.nomad&&exp.nomad.validation||null),readiness:plan.readiness||'',
        missing:take(plan.missing,12)};
      out.export_projection=prep?compact(prep):null;
      out.export_assistant_rule='Prioritize NOMAD readiness and the smallest current blocker. Ready-PV is secondary. '+
        'When export.prepare is available, recommend /prepare-export for missing export metadata rather than inventing values.';
    }
    const referenceQuery=[q,JSON.stringify(pc),JSON.stringify(out.design||{}),JSON.stringify(out.results||{})].join(' ');
    if(LF.Cabinet)out.cabinet=LF.Cabinet.context(referenceQuery,{limit:6});
    if(LF.KnowledgeBase)out.knowledge=LF.KnowledgeBase.context(referenceQuery,{limit:8,minScore:2});
    out.history=chatMemory(exp);
    return budgetPack(out,opts.maxChars||14000);}
  function packAmbiguity(exp,opts){const out=base(exp,'ambiguity',''),collect=opts.collect||{}
,ids=(collect.finding_ids||[]).map(String),
    findings=(exp.datasetAnalysis&&exp.datasetAnalysis.ambiguousFindings||[]).filter(function(f){
    return ids.includes(String(f.id));}),measurementIds=findings.map(function(f){return String(f.measurementId||'');
    }).filter(Boolean),measurements=(exp.measurements||[]).filter(function(m){return measurementIds.includes(String(m.id));
    }),sampleIds=[];measurements.forEach(function(m){const s=LF.CanonicalStore.sample(exp,m.sample);
    if(s)sampleIds.push(s.id);});out.scope={
    instruction:'Resolve only these semantic ambiguities. Return unresolved when evidence is insufficient.',finding_ids:ids}
    ;out.findings=findings;out.measurements=measurements.map(measurementRef);
    out.samples=sampleIds.map(function(id){return LF.CanonicalStore.record(exp,id);}).filter(Boolean).map(sampleRef);
    out.evidence=LF.CanonicalStore.evidence(exp,{record_ids:sampleIds.concat(measurementIds),limit:20}).map(compact);
    return budgetPack(out,12000);}

  function designCabinetContext(baseQuery,missingDomains){
    if(!LF.Cabinet)return null;
    const specs={
      solutions:{query:'solution formulation precursor solvent solute chemistry',kinds:['solution']},
      stack:{query:'device stack architecture substrate contact transport absorber electrode',kinds:['stack','substrate','material']},
      process:{query:'process protocol coating deposition annealing atmosphere fabrication',kinds:['protocol']}
    },byId={},counts={solutions:0,stack:0,process:0},domainCandidates={solutions:[],stack:[],process:[]};
    (missingDomains||[]).forEach(function(domain){
      domain=String(domain||'').toLowerCase();const spec=specs[domain];if(!spec)return;
      const ctx=LF.Cabinet.context(spec.query+' '+String(baseQuery||''),{kinds:spec.kinds,limit:5});
      const items=(ctx&&ctx.items||[]).slice(0,5);counts[domain]=items.length;
      items.forEach(function(item){
        const id=String(item&&item.id||'');if(!id)return;
        if(!byId[id])byId[id]=item;
        if(domainCandidates[domain].length<4)domainCandidates[domain].push(item);
      });
    });
    return{
      items:Object.keys(byId).map(function(id){return byId[id];}).slice(0,12),
      domain_candidates:domainCandidates,
      retrieval:{requested_domains:(missingDomains||[]).slice(),domain_matches:counts,total:Object.keys(byId).length},
      note:'Researcher-curated reusable workspace resources. They are stronger than generic model inference but are not proof that the current experiment used them.',
      citation_contract:'When a Design candidate materially relies on a Cabinet resource, set provenance_kind to cabinet_reference and cite its exact id in evidence as CABINET:<id>.'
    };
  }

  function designKnowledgeContext(baseQuery,missingDomains){
    if(!LF.KnowledgeBase)return null;
    const specs={
      solutions:{query:'solution formulation precursor solvent solute chemistry photovoltaic',kinds:['formulation','material','process']},
      stack:{query:'device architecture stack layer substrate contact electrode transport selective absorber photovoltaic',kinds:['architecture','material']},
      process:{query:'fabrication process coating deposition annealing atmosphere evaporation solution processing',kinds:['process','material']}
    },counts={},selectedByDomain={solutions:[],stack:[],process:[]};

    function supportsHint(entry,domain){
      const hint=entry&&entry.design_hint;
      if(!hint)return false;
      if(domain==='solutions')return !!(hint.solution&&(hint.solution.solutes||hint.solution.solvents));
      if(domain==='stack')return Array.isArray(hint.stack)&&hint.stack.length>=3;
      if(domain==='process')return !!(hint.process&&[hint.process.coating,hint.process.annealing,hint.process.atmosphere,hint.process.notes].some(Boolean));
      return false;
    }
    function compactEntry(entry){
      return{
        id:entry.id,kind:entry.kind,title:entry.title,aliases:(entry.aliases||[]).slice(0,5),tags:(entry.tags||[]).slice(0,8),
        summary:clip(entry.summary||'',180),facts:(entry.facts||[]).slice(0,2).map(function(x){return clip(x,180);}),
        design_hint:entry.design_hint||null,cautions:(entry.cautions||[]).slice(0,1).map(function(x){return clip(x,140);}),
        sources:(entry.sources||[]).slice(0,1).map(function(src){
          return{title:clip(src&&src.title||'',120),year:src&&src.year||null,citation:clip(src&&src.citation||'',140),doi:clip(src&&src.doi||'',100)};
        })
      };
    }
    function unique(entries){
      const seen=new Set(),out=[];
      (entries||[]).forEach(function(entry){const id=String(entry&&entry.id||'');if(!id||seen.has(id))return;seen.add(id);out.push(entry);});
      return out;
    }

    (missingDomains||[]).forEach(function(domain){
      domain=String(domain||'').toLowerCase();const spec=specs[domain];if(!spec)return;
      const ctx=LF.KnowledgeBase.context(spec.query+' '+String(baseQuery||''),{kinds:spec.kinds,limit:18,minScore:2});
      const retrieved=(ctx&&ctx.entries||[]);
      const structured=typeof LF.KnowledgeBase.all==='function'&&typeof LF.KnowledgeBase.compactForAI==='function'
        ?LF.KnowledgeBase.all().filter(function(entry){
          return entry&&entry.status==='active'&&spec.kinds.includes(entry.kind)&&supportsHint(entry,domain);
        }).map(LF.KnowledgeBase.compactForAI):[];
      const combined=unique(retrieved.concat(structured));
      const preferred=combined.filter(function(entry){return supportsHint(entry,domain);});
      const general=combined.filter(function(entry){return !supportsHint(entry,domain);});
      selectedByDomain[domain]=preferred.slice(0,2).concat(general).slice(0,3).map(compactEntry);
      counts[domain]=selectedByDomain[domain].length;
    });

    const domainCandidates={solutions:[],stack:[],process:[]};
    Object.keys(domainCandidates).forEach(function(domain){
      domainCandidates[domain]=(selectedByDomain[domain]||[]).slice(0,2).map(function(entry){
        return{id:entry.id,kind:entry.kind,title:entry.title,design_hint:entry.design_hint||null};
      });
    });

    const entries=[],seen=new Set();
    function add(entry,domain){
      const id=String(entry&&entry.id||'');if(!id||seen.has(id)||entries.length>=6)return;
      seen.add(id);const item=Object.assign({},entry,{relevant_domains:[domain]});entries.push(item);
    }
    ['solutions','stack','process'].forEach(function(domain){(selectedByDomain[domain]||[]).slice(0,1).forEach(function(entry){add(entry,domain);});});
    ['solutions','stack','process'].forEach(function(domain){(selectedByDomain[domain]||[]).forEach(function(entry){add(entry,domain);});});

    return{
      entries:entries,
      domain_candidates:domainCandidates,
      retrieval:{requested_domains:(missingDomains||[]).slice(),domain_matches:counts,total:entries.length},
      note:'Reference knowledge only. It can support review candidates but is not evidence that the current experiment used these materials, architectures or processes.',
      citation_contract:'When a Design item materially relies on a supplied entry, set provenance_kind to knowledge_reference and put its exact id in evidence as KB:<id>. Never invent KB ids.'
    };
  }

  function designReferences(exp,deviceId,requestedDomains){
    const device=(exp&&exp.design&&exp.design.devices||[]).find(function(d){return String(d.id)===String(deviceId||'');})||null;
    if(!device)return{cabinet:null,knowledge:null,query:'',domains:[]};
    const domains=Array.from(new Set((requestedDomains&&requestedDomains.length?requestedDomains:
      (LF.DesignModel&&LF.DesignModel.pendingDomains?LF.DesignModel.pendingDomains(exp,device):[]))
      .map(function(x){return String(x||'').toLowerCase();}).filter(function(x){return ['solutions','stack','process'].includes(x);})));
    const linkedSolutions=(exp.design&&exp.design.solutions||[]).filter(function(sol){return(device.solutionIds||[]).includes(sol.id);});
    const query=[clean(exp.meta&&exp.meta.name),clean(exp.meta&&exp.meta.sourceName),clean(device.name),clean(device.group),
      (device.sampleNames||[]).join(' '),JSON.stringify(compact(device)),JSON.stringify(linkedSolutions.map(compact)),domains.join(' ')].join(' ');
    return{cabinet:designCabinetContext(query,domains),knowledge:designKnowledgeContext(query,domains),query:query,domains:domains};
  }

  function packDesignEvidence(exp,opts){
    const out=base(exp,'design','');
    const params=opts.params||{};
    const device=(exp.design&&exp.design.devices||[]).find(function(d){
      return String(d.id)===String(params.deviceId||'');
    })||null;
    if(!device){
      return budgetPack(Object.assign(out,{scope:{error:'No selected experiment'}}),10000);
    }

    const sampleEntities=(device.sampleNames||[])
      .map(function(name){return LF.CanonicalStore.sample(exp,name);})
      .filter(Boolean);
    const ids=sampleEntities.map(function(sample){return sample.id;});
    const designRows=exp.designAnalysis&&Array.isArray(exp.designAnalysis.samples)?exp.designAnalysis.samples:[];
    const selectedNames=new Set(device.sampleNames||[]);
    const evidenceUnknown=designRows
      .filter(function(row){return row&&row.sample&&selectedNames.has(row.sample.name);})
      .reduce(function(acc,row){return acc.concat(row.unknownFields||[]);},[]);
    const evidence=LF.CanonicalStore.evidence(exp,{record_ids:ids,limit:18}).map(compact);
    const designPattern=/solution|solvent|solute|formulat|precursor|stack|layer|material|substrate|electrode|contact|transport|perovskite|anneal|coating|deposition|process|atmosphere|glovebox|evaporation/i;
    const designEvidence=evidence.filter(function(item){
      return designPattern.test(JSON.stringify(item));
    });
    const missingDomains=LF.DesignModel&&LF.DesignModel.pendingDomains
      ?LF.DesignModel.pendingDomains(exp,device)
      :(LF.DesignModel&&LF.DesignModel.missingDomains?LF.DesignModel.missingDomains(exp,device):[]);

    out.scope={
      device_id:device.id,
      sample_names:(device.sampleNames||[]).slice(),
      manual_variant:!(device.sampleNames||[]).length,
      unknown_fields:missingDomains.slice(),
      source_unknowns:Array.from(new Set(evidenceUnknown))
    };
    out.design_evidence_summary={
      evidence_items:evidence.length,
      design_relevant_items:designEvidence.length,
      raw_design_evidence_found:designEvidence.length>0,
      inference_basis:designEvidence.length?'experiment_evidence_and_model_inference':'model_inference_only'
    };
    out.current_design=compact(device);
    out.known_solutions=(exp.design&&exp.design.solutions||[])
      .filter(function(sol){return(device.solutionIds||[]).includes(sol.id);})
      .map(compact);
    const refs=designReferences(exp,device.id,missingDomains);
    out.cabinet=refs.cabinet;
    out.samples=sampleEntities.map(sampleRef);
    out.evidence=designEvidence;
    out.source_context={
      experiment:{
        name:clean(exp.meta&&exp.meta.name),
        source:clean(exp.meta&&exp.meta.sourceName)
      },
      source_design:compact(exp.design&&exp.design.evidenceSummary||{}),
      measurement_files:(exp.measurements||[])
        .filter(function(m){return selectedNames.has(String(m.sample||''));})
        .slice(0,16)
        .map(function(m){
          return{
            sample:clean(m.sample),
            group:clean(m.group),
            file:clean(m.path||m.file),
            raw_sample:clean(m.rawSample),
            quality:m.qualityStatus||''
          };
        })
    };

    if(LF.KnowledgeBase){
      out.knowledge=refs.knowledge;
      out.design_evidence_summary.cabinet_entries=out.cabinet&&out.cabinet.items?out.cabinet.items.length:0;
      out.design_evidence_summary.cabinet_domains=out.cabinet&&out.cabinet.retrieval?out.cabinet.retrieval.domain_matches:{};
      out.design_evidence_summary.knowledge_entries=out.knowledge&&out.knowledge.entries?out.knowledge.entries.length:0;
      out.design_evidence_summary.knowledge_domains=out.knowledge&&out.knowledge.retrieval?out.knowledge.retrieval.domain_matches:{};
      if(!designEvidence.length&&out.design_evidence_summary.knowledge_entries){
        out.design_evidence_summary.inference_basis='knowledge_reference_and_model_inference';
      }
    }
    return budgetPack(out,18000);
  }
  function packResults(exp,opts){opts=opts||{};const out=base(exp,'results',''),a=exp.analysis||{};
out.results={summary:compact(a.summary||{}
    ),statistics:LF.AnalysisSummary&&LF.AnalysisSummary.ensure?compact(LF.AnalysisSummary.ensure(exp)):null,
    top_non_ref:take(a.topNonRef,10),top_ref:take(a.topRef,10),best_by_sample:take(a.bestBySample,40)};
    out.anomalies=(exp.measurements||[]).filter(function(m){
    return!m.excluded&&(m.qualityStatus!=='valid'||(m.flags||[]).length);}).slice(0,24).map(measurementRef);
    out.findings=(exp.findings||[]).filter(function(f){return f.status!=='resolved';}).slice(0,24).map(findingRef);
    return budgetPack(out,16000);}
  function comparisonStats(values){return LF.AnalysisSummary&&LF.AnalysisSummary.stats?LF.AnalysisSummary.stats(values):null;}
  function packResultsCompare(exp,opts){opts=opts||{};
const out=base(exp,'results_compare',''),p=opts.params||{}
    ,groups=(Array.isArray(p.groups)?p.groups:[]).map(String).filter(Boolean),metric=String(p.metric||'eff'),
    direction=String(p.direction||'both'),eligibleOnly=p.eligibleOnly!==false,
    factor=Number(exp.analysis&&exp.analysis.summary&&exp.analysis.summary.mismatchFactor)||1;
    function val(m,dir){const x=m&&m[dir],n=x&&Number(x[metric]);if(!Number.isFinite(n))return null;
    return(metric==='eff'||metric==='jsc')?n/factor:n;
    }out.selection={groups:groups,metric:metric,direction:direction,eligible_only:eligibleOnly};
    out.groups=groups.map(function(group){const ms=(exp.measurements||[]).filter(function(m){
    return!m.excluded&&(String(m.group||'').trim()||'Ungrouped')===group&&(!eligibleOnly||m.rankingEligible);
    }),fw=ms.map(function(m){return val(m,'fw');}).filter(Number.isFinite),rv=ms.map(function(m){return val(m,'rv');
    }).filter(Number.isFinite);return{name:group,measurements:ms.length,fw:direction==='rv'?null:comparisonStats(fw),
    rv:direction==='fw'?null:comparisonStats(rv),quality:{valid:ms.filter(function(m){return m.qualityStatus==='valid';
    }).length,review:ms.filter(function(m){return m.qualityStatus==='review';
    }).length,blocked:ms.filter(function(m){return m.qualityStatus==='blocked';}).length}};});
    out.findings=(exp.findings||[]).filter(function(f){return f.status!=='resolved';}).slice(0,16).map(findingRef);
    out.instruction='Compare only the selected groups using the supplied deterministic statistics. Do not infer unprovided fabrication causes as facts.';
    return budgetPack(out,9000);}
  function packDesign(exp,opts){
    const out=packDesignEvidence(exp,opts),id=String(opts&&opts.params&&opts.params.deviceId||''),device=(exp.design&&exp.design.devices||[]).find(function(item){return String(item.id)===id;})||null;
    if(!device||!out.scope)return out;
    const missing=LF.DesignModel&&LF.DesignModel.pendingDomains?LF.DesignModel.pendingDomains(exp,device):(LF.DesignModel&&LF.DesignModel.missingDomains?LF.DesignModel.missingDomains(exp,device):[]);
    out.scope.unknown_fields=Array.from(new Set((out.scope.unknown_fields||[]).concat(missing)));
    out.scope.instruction='For every domain in unknown_fields, prefer a useful review candidate. Use experiment evidence first, then cabinet.domain_candidates / cabinet.items, then knowledge.domain_candidates / knowledge.entries, then cautious qualitative model inference. ' +
      'unresolved_domains is the last resort when no coherent review candidate can be formed; do not use unresolved merely because experiment-specific proof is absent. Experiment evidence is authoritative. Cabinet and Knowledge Base are reference context, not proof of use. Prefer exact Cabinet resources over KB archetypes when both are compatible. ' +
      'Knowledge Base entries are deliberately retrieved by missing domain; use them before generic model memory when relevant, cite exact KB:<id> values, and keep knowledge-supported values review-only. ' +
      'A stack proposal must be a coherent device architecture, not one isolated absorber layer. Leave unsupported exact quantities unknown.';
    return out;
  }
  function packExport(exp,opts){
    opts=opts||{};
    const out=base(exp,'export','');
    const prep=LF.ExportProjections&&LF.ExportProjections.preparationContext
      ?LF.ExportProjections.preparationContext(exp)
      :{nomad:{missing:[]},readypv:{missing:[]},allowed_fields:{nomad:[],readypv:[]}};
    const missing=(prep.nomad&&prep.nomad.missing||[]).concat(prep.readypv&&prep.readypv.missing||[]);
    const query=[clean(exp.meta&&exp.meta.name),missing.map(function(f){return f.label||f.id;}).join(' ')].join(' ');
    out.export_projection={
      primary_goal:'Prepare the current experiment for NOMAD staging/export. Ready-PV is secondary.',
      nomad:prep.nomad,
      readypv:prep.readypv,
      allowed_fields:prep.allowed_fields,
      rule:'Suggestions are export-only overrides. Never rewrite canonical scientific data.'
    };
    if(LF.Cabinet)out.cabinet=LF.Cabinet.context(query,{limit:10});
    if(LF.KnowledgeBase)out.knowledge=LF.KnowledgeBase.context(query,{limit:8,minScore:2});
    out.action_outputs=LF.ActionData&&LF.ActionData.assistantContext
      ?LF.ActionData.assistantContext(exp,{limit:6}):{items:[]};
    return budgetPack(out,16000);
  }
  const PACKERS={chat:packChat,ambiguity:packAmbiguity,design:packDesign,results:packResults,
    results_compare:packResultsCompare,export:packExport};
  function registerProfile(name,fn){name=clean(name).toLowerCase();if(!name||typeof fn!=='function')throw new Error('Context profile requires name and function.');if(PACKERS[name])throw new Error('Context profile already registered: '+name);PACKERS[name]=fn;return name;}
  function profiles(){return Object.keys(PACKERS).sort();}
  function pack(profile,opts){opts=opts||{};const exp=opts.exp||expOf();LF.CanonicalStore.ensure(exp);profile=clean(profile||'generic').toLowerCase();if(profile==='assistant')profile='chat';const fn=PACKERS[profile];return fn?fn(exp,opts):budgetPack(base(exp,profile,opts.question||''),10000);}
  function profile(def){const declared=def&&def.contract&&def.contract.context&&clean(def.contract.context.profile);return declared||'generic';}
  function compactOutputContract(schemaId){
    if(schemaId!=='design_suggestion')return'';
    return [
      'Return exactly one compact JSON object and no Markdown.',
      'Use only these top-level keys: status, summary, solutions, stack, process, unresolved_domains, unknowns.',
      'Shape example (data instance, not schema):',
      '{"status":"suggested","summary":"...","solutions":[],"stack":[],"process":{"coating":"","annealing":"","atmosphere":"","notes":""},"unresolved_domains":[],"unknowns":[]}',
      'For each requested Design domain, either populate it usefully or include its exact name in unresolved_domains.',
      'Allowed provenance_kind values on scientific items are experiment, cabinet_reference, knowledge_reference, model_inference.',
      'Return only the scientific data instance; do not output schema or validation metadata.',
      'Use strict JSON literals only: true, false, null. Never use Python True, False or None.'
    ].join('\n');
  }
  function system(def,step){const parts=[];(def.policies||[]).forEach(function(id){const p=policy(id);
if(p)parts.push('# '+id.toUpperCase()+'\n\n'+p);});
    const prompt=LF.Storage&&LF.Storage.getEffectivePrompt?LF.Storage.getEffectivePrompt(def.id):(LF.ActionRegistry&&
    LF.ActionRegistry.prompt?LF.ActionRegistry.prompt(def.id):'');if(prompt)parts.push('# ACTION CONTRACT\n\n'+prompt);
    if(step&&step.output==='json'&&step.schema){const concise=compactOutputContract(step.schema);
      if(concise)parts.push('# OUTPUT CONTRACT\n\n'+concise);
      else{const schema=LF.ActionRegistry.schema(step.schema);parts.push('# OUTPUT CONTRACT\n\nReturn exactly one JSON value matching this schema.\n\n'+JSON.stringify(schema));}
    }return parts.join('\n\n---\n\n');}
  function build(def,step,opts){opts=opts||{};
const prof=profile(def),assistantMax=def.id==='assistant.chat'?(LF.Storage.getAssistantSettings?
    LF.Storage.getAssistantSettings().contextChars:14000):undefined,requestedMax=Number(opts.maxChars)||assistantMax;
    let ctx=pack(prof,{exp:expOf(),question:opts.userText||'',params:opts.params||{}
    ,selection:opts.selection||null,collect:opts.outputs&&opts.outputs.collect||{}
    ,workItem:opts.workItem||null,maxChars:requestedMax});if(requestedMax)ctx=budgetPack(ctx,requestedMax);
    let sys=system(def,step),retry=clean(opts.retryFeedback);if(retry)sys+='\n\n# RETRY CORRECTION\n'+clip(retry,5000);
    const req=clean(opts.userText),user='<research_context_pack>\n'+JSON.stringify(ctx)+'\n</research_context_pack>'+
    (req?'\n\n<user_request>\n'+req+'\n</user_request>':'');
    if(Log)Log.debug('build',{action:def.id,profile:prof,contextChars:user.length,budgetChars:requestedMax||null});
    return{messageList:[{role:'system',content:sys},{role:'user',content:user}],context:ctx,user:user};}
  LF.ContextBuilder={pack:pack,profiles:profiles,registerProfile:registerProfile,designReferences:designReferences};LF.ActionContext={build:build};
}());
