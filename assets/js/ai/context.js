/*
 * Build bounded authority-labelled Context Packs for Actions and Assistant.
 * Boundary: Keep experiment evidence, Cabinet references, KB references and Action output distinguishable.
 */
(function(){
  'use strict';
  const LF=window.LabFlow=window.LabFlow||{},Log=LF.Logger?LF.Logger.scope('context'):null;
  function expOf(){return(LF.DataModel&&LF.DataModel.getExperiment&&LF.DataModel.getExperiment())||(LF.State&&LF.State.state&&LF.State.state.experiment)||{};}
  function clean(v){return LF.PageContext&&LF.PageContext.cleanText?LF.PageContext.cleanText(v):String(v==null?'':v).replace(/%%LF(?:MD|CODE)[^%]*%%/g,'').trim();}
  function sanitize(v){if(v==null||typeof v==='number'||typeof v==='boolean')return v;if(typeof v==='string')return clean(v);if(Array.isArray(v))return v.map(sanitize);if(typeof v==='object'){const o={};Object.keys(v).forEach(function(k){o[k]=sanitize(v[k]);});return o;}return clean(v);}
  const MODEL_POLICY_SUMMARIES={
    'policy.data-ground-truth':'RAW/source evidence is authoritative. Never invent values, identities, units or mappings. Missing evidence stays unknown. Apply only the requested ambiguity task.',
    'policy.data-format-repair':'Only propose bounded semantic repairs supported by supplied evidence. Never fabricate numeric values or silently change scientific meaning.',
    'policy.scientific-provenance':'Keep experiment evidence, Cabinet references, Knowledge Base references and model inference distinct. Reference knowledge is not proof of what the current experiment used.',
    'policy.structured-output':'Return only the requested strict JSON value. No Markdown, commentary, schema text or hidden reasoning.'
  };
  function policy(id){return MODEL_POLICY_SUMMARIES[id]||'';}
  function take(v,n){return(Array.isArray(v)?v:[]).slice(0,n);}
  function clip(v,n){const s=clean(v);return s.length>n?s.slice(0,n)+'…':s;}
  function compact(v){return sanitize(LF.CanonicalStore&&LF.CanonicalStore.compact?LF.CanonicalStore.compact(v,360):v);}
  function pageContext(){
    const raw=LF.PageContext&&LF.PageContext.snapshot?LF.PageContext.snapshot():{},page=clean(raw&&raw.page),out={page:page,view:clean(raw&&raw.view),selected:sanitize(raw&&raw.selected||{}),filters:sanitize(raw&&raw.filters||{}),visible:take(raw&&raw.visible,16).map(clean)};


    if(page==='Settings'||page==='Logs')return out;
    if(raw&&raw.data&&typeof raw.data==='object')out.data=compact(raw.data);
    return out;
  }
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
    if(obj&&obj.design_evidence_summary&&obj.current_design)return designBudgetPack(obj,maxChars);
    const copy=JSON.parse(json),trim=['evidence','findings','measurements','samples','results','relations','history','provenance'];
    trim.forEach(function(k){if(JSON.stringify(copy).length<=maxChars)return;if(Array.isArray(copy[k]))copy[k]=copy[k].slice(0,Math.max(2,Math.min(10,Math.floor(copy[k].length/2))));});
    copy.context_notice='Context was deterministically bounded to fit the active model. Use a narrower Tool/Action to retrieve omitted detail.';
    if(JSON.stringify(copy).length<=maxChars)return copy;
    const levels=[
      {s:900,a:12,k:32},{s:600,a:10,k:26},{s:420,a:8,k:22},{s:280,a:6,k:18},{s:180,a:4,k:14},{s:110,a:3,k:10}
    ];
    for(const level of levels){const bounded=boundValue(copy,level.s,level.a,level.k,0);bounded.context_notice=copy.context_notice;if(JSON.stringify(bounded).length<=maxChars)return bounded;}
    const fallback={source_contract:boundValue(copy.source_contract||{},120,4,12,0),experiment:boundValue(copy.experiment||{},180,4,14,0),data_state:boundValue(copy.data_state||{},120,4,12,0),experiment_brief:boundValue(copy.experiment_brief||{},140,3,12,0),context_notice:copy.context_notice,omitted_detail:true};
    if(JSON.stringify(fallback).length<=maxChars)return fallback;
    return boundValue(fallback,80,2,8,0);
  }
  /* Assistant budget tiers, most expendable first:
     P3 previous_turn + facts_digest, P2 references, P1 facts/scope, P0 task. */
  function assistantBudgetPack(obj,maxChars){
    maxChars=Math.max(640,Number(maxChars)||4200);const full=sanitize(obj||{}),size=function(v){return JSON.stringify(v).length;};
    if(size(full)<=maxChars)return full;const copy=JSON.parse(JSON.stringify(full));delete copy.previous_turn;if(size(copy)<=maxChars)return copy;
    delete copy.facts_digest;if(size(copy)<=maxChars)return copy;
    if(copy.knowledge&&Array.isArray(copy.knowledge.entries))copy.knowledge.entries=copy.knowledge.entries.slice(0,2).map(function(v){return boundValue(v,160,3,12,0);});
    if(copy.cabinet&&Array.isArray(copy.cabinet.items))copy.cabinet.items=copy.cabinet.items.slice(0,2).map(function(v){return boundValue(v,140,3,10,0);});
    if(size(copy)<=maxChars)return copy;
    const levels=[{s:180,a:6,k:16},{s:120,a:4,k:12},{s:80,a:3,k:10},{s:56,a:2,k:8}];
    for(const level of levels){const bounded={task:boundValue(copy.task||{},level.s,level.a,level.k,0),scope:boundValue(copy.scope||{},level.s,level.a,level.k,0),facts:boundValue(copy.facts||{},level.s,level.a,level.k,0)};
      if(copy.knowledge)bounded.knowledge=boundValue(copy.knowledge,level.s,2,level.k,0);if(copy.cabinet)bounded.cabinet=boundValue(copy.cabinet,level.s,2,level.k,0);
      if(size(bounded)<=maxChars)return bounded;}
    return boundValue({task:copy.task||{},scope:copy.scope||{},facts:copy.facts||{}},48,1,6,0);
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
      source_contract:full.source_contract||{},experiment:full.experiment||{},
      scope:full.scope||{},design_evidence_summary:full.design_evidence_summary||{},current_design:full.current_design||{},known_solutions:full.known_solutions||[],
      cabinet:{domain_candidates:compactDesignDomainCandidates(cab.domain_candidates),retrieval:cab.retrieval||{},note:cab.note||'',citation_contract:cab.citation_contract||''},
      knowledge:{entries:(kb.entries||[]).slice(0,3),domain_candidates:compactDesignDomainCandidates(kb.domain_candidates),retrieval:kb.retrieval||{},note:kb.note||''},
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

  function sourceContract(){return{
    experiment:'authoritative current-experiment evidence',
    workspace:'researcher-defined context, not measurement evidence',
    cabinet:'reusable researcher-curated reference, not experiment evidence',
    knowledge:'general sourced reference, not experiment evidence',
    ai_proposal:'review-only until accepted'
  };}
  function actionBase(exp){
    return{source_contract:sourceContract(),experiment:{id:exp.id||'',name:clean(exp.meta&&exp.meta.name)}};
  }
  function packChat(_exp,opts){
    opts=opts||{};
    const supplied=opts.params&&opts.params.assistantPlan;
    if(!(supplied&&supplied.mode==='llm'&&supplied.context))throw new Error('assistant.chat requires a routed Assistant plan.');
    const requested=Number(opts.maxChars)||4200;
    return assistantBudgetPack(supplied.context,Math.min(requested,5200));
  }
  function packAmbiguity(exp,opts){const out=actionBase(exp),collect=opts.collect||{}
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
    return budgetPack(out,5200);}

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
        id:entry.id,kind:entry.kind,title:entry.title,aliases:(entry.aliases||[]).slice(0,4),
        tags:(entry.tags||[]).slice(0,6),design_hint:entry.design_hint||null
      };
    }
    function unique(entries){
      const seen=new Set(),out=[];
      (entries||[]).forEach(function(entry){const id=String(entry&&entry.id||'');if(!id||seen.has(id))return;seen.add(id);out.push(entry);});
      return out;
    }

    (missingDomains||[]).forEach(function(domain){
      domain=String(domain||'').toLowerCase();const spec=specs[domain];if(!spec)return;
      const ctx=LF.KnowledgeBase.designContext?LF.KnowledgeBase.designContext(spec.query+' '+String(baseQuery||''),{kinds:spec.kinds,limit:18,minScore:2}):LF.KnowledgeBase.context(spec.query+' '+String(baseQuery||''),{kinds:spec.kinds,limit:18,minScore:2});
      const retrieved=(ctx&&ctx.entries||[]);
      const structured=typeof LF.KnowledgeBase.all==='function'&&typeof LF.KnowledgeBase.compactForDesign==='function'
        ?LF.KnowledgeBase.all().filter(function(entry){
          return entry&&entry.status==='active'&&spec.kinds.includes(entry.kind)&&supportsHint(entry,domain);
        }).map(LF.KnowledgeBase.compactForDesign):[];
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
      note:'Compact reference candidates only. Bibliographic metadata is intentionally omitted from Design model context; KB ids remain internal provenance labels.'
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
    const out=actionBase(exp);
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
    const requestedDomains=opts&&opts.workItem&&Array.isArray(opts.workItem.required_domains)?opts.workItem.required_domains:null;
    const missingDomains=requestedDomains&&requestedDomains.length?requestedDomains:(LF.DesignModel&&LF.DesignModel.pendingDomains
      ?LF.DesignModel.pendingDomains(exp,device)
      :(LF.DesignModel&&LF.DesignModel.missingDomains?LF.DesignModel.missingDomains(exp,device):[]));

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
    return budgetPack(out,6200);
  }
  function packResults(exp,opts){opts=opts||{};const out=actionBase(exp),a=exp.analysis||{};
out.results={summary:compact(a.summary||{}
    ),statistics:LF.AnalysisSummary&&LF.AnalysisSummary.ensure?compact(LF.AnalysisSummary.ensure(exp)):null,
    top_non_ref:take(a.topNonRef,10),top_ref:take(a.topRef,10),best_by_sample:take(a.bestBySample,40)};
    out.anomalies=(exp.measurements||[]).filter(function(m){
    return!m.excluded&&(m.qualityStatus!=='valid'||(m.flags||[]).length);}).slice(0,24).map(measurementRef);
    out.findings=(exp.findings||[]).filter(function(f){return f.status!=='resolved';}).slice(0,24).map(findingRef);
    return budgetPack(out,6200);}
  function comparisonStats(values){return LF.AnalysisSummary&&LF.AnalysisSummary.stats?LF.AnalysisSummary.stats(values):null;}
  function packResultsCompare(exp,opts){opts=opts||{};
const out=actionBase(exp),p=opts.params||{}
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
    const selectedMeasurements=(exp.measurements||[]).filter(function(m){return groups.includes(String(m.group||'').trim()||'Ungrouped');});
    const measurementIds=new Set(selectedMeasurements.map(function(m){return String(m.id||'');}));
    const sampleNames=new Set(selectedMeasurements.map(function(m){return String(m.sample||'');}));
    out.evidence=selectedMeasurements.slice(0,24).map(function(m){return{id:m.id||'',sample:clean(m.sample),group:clean(m.group),quality:m.qualityStatus||'',eligible:!!m.rankingEligible};});
    out.findings=(exp.findings||[]).filter(function(f){const target=String(f.target||'');return f.status!=='resolved'&&(measurementIds.has(String(f.measurementId||''))||measurementIds.has(target)||sampleNames.has(target));}).slice(0,12).map(findingRef);
    out.instruction='Compare only the selected groups using the supplied deterministic statistics. Do not infer unprovided fabrication causes as facts.';
    return budgetPack(out,5200);}
  function packDesign(exp,opts){
    const out=packDesignEvidence(exp,opts),id=String(opts&&opts.params&&opts.params.deviceId||''),device=(exp.design&&exp.design.devices||[]).find(function(item){return String(item.id)===id;})||null;
    if(!device||!out.scope)return out;
    const requested=opts&&opts.workItem&&Array.isArray(opts.workItem.required_domains)?opts.workItem.required_domains:null;
    const missing=requested&&requested.length?requested:(LF.DesignModel&&LF.DesignModel.pendingDomains?LF.DesignModel.pendingDomains(exp,device):(LF.DesignModel&&LF.DesignModel.missingDomains?LF.DesignModel.missingDomains(exp,device):[]));
    out.scope.unknown_fields=Array.from(new Set(missing.map(function(x){return String(x||'').toLowerCase();})));
    out.scope.instruction='Complete only unknown_fields. Prefer experiment evidence, then Cabinet candidates, then compact Knowledge Base design hints. Use cautious qualitative model inference only when references do not provide a coherent candidate. Bibliographic citations are not part of this context; KB:<id> is only an internal provenance label. Leave unsupported exact quantities unknown.';
    return out;
  }
  function packExport(exp,opts){
    opts=opts||{};
    const out=actionBase(exp);
    const prep=LF.ExportProjections&&LF.ExportProjections.preparationContext
      ?LF.ExportProjections.preparationContext(exp)
      :{nomad:{missing:[]},readypv:{missing:[]},allowed_fields:{nomad:[],readypv:[]}};
    const missing=(prep.nomad&&prep.nomad.missing||[]).concat(prep.readypv&&prep.readypv.missing||[]);
    const fieldIds=missing.map(function(f){return String(f.id||'');}),query=[clean(exp.meta&&exp.meta.name),missing.map(function(f){return f.label||f.id;}).join(' ')].join(' ');
    out.export_projection={
      primary_goal:'Prepare the current experiment for NOMAD staging/export. Ready-PV is secondary.',
      nomad:prep.nomad,
      readypv:prep.readypv,
      allowed_fields:prep.allowed_fields,
      rule:'Suggestions are export-only overrides. Never rewrite canonical scientific data.'
    };
    const workspace=LF.Workspace&&LF.Workspace.current?LF.Workspace.current():null;
    const processId=exp.meta&&exp.meta.processId,process=workspace&&(workspace.processes||[]).find(function(item){return String(item.id)===String(processId||'');});
    const needsContacts=fieldIds.some(function(id){return /^contact\./.test(id);});
    const needsWorkspace=fieldIds.some(function(id){return /^contact\.(institution|name|email|parser|plugin)$|^storage\.|^samples\.locations$|^remarks\.|^data\.(workspace_name|institution)$/.test(id);});
    const needsProcess=fieldIds.some(function(id){return /^measured\.|^samples\.|^metadata\.|^instruments\.|^data\.(process_name|process_kind|instrument_refs|acquisition_software_refs|output_format_refs|measurement_techniques|notes)$/.test(id);});
    const cabinetKinds=[];
    if(fieldIds.some(function(id){return /instrument/.test(id);}))cabinetKinds.push('instrument','setup');
    if(fieldIds.some(function(id){return /software/.test(id);}))cabinetKinds.push('software');
    if(fieldIds.some(function(id){return /format|docs/.test(id);}))cabinetKinds.push('file_format');
    if(needsWorkspace&&workspace)out.workspace={id:workspace.id||'',name:workspace.name||'',institution:workspace.institution||'',description:workspace.description||'',locations:take(workspace.locations,12),storage_profiles:take(workspace.storageProfiles,8),contacts:needsContacts?take(workspace.contacts,12):[]};
    if(needsProcess&&process)out.process=compact(process);
    if(cabinetKinds.length&&LF.Cabinet)out.cabinet=LF.Cabinet.context(query,{kinds:Array.from(new Set(cabinetKinds)),limit:8});
    if(fieldIds.some(function(id){return /^measured\.description$|^data\.notes$/.test(id);})&&LF.KnowledgeBase)out.knowledge=LF.KnowledgeBase.context(query,{limit:4,minScore:2});
    return budgetPack(out,6000);
  }
  const PACKERS={chat:packChat,ambiguity:packAmbiguity,design:packDesign,results:packResults,
    results_compare:packResultsCompare,export:packExport};
  function registerProfile(name,fn){name=clean(name).toLowerCase();if(!name||typeof fn!=='function')throw new Error('Context profile requires name and function.');if(PACKERS[name])throw new Error('Context profile already registered: '+name);PACKERS[name]=fn;return name;}
  function profiles(){return Object.keys(PACKERS).sort();}
  function pack(profile,opts){opts=opts||{};const exp=opts.exp||expOf();LF.CanonicalStore.ensure(exp);profile=clean(profile||'generic').toLowerCase();if(profile==='assistant')profile='chat';const fn=PACKERS[profile];return fn?fn(exp,opts):budgetPack(actionBase(exp),10000);}
  function profile(def){const declared=def&&def.contract&&def.contract.context&&clean(def.contract.context.profile);return declared||'generic';}
  function compactOutputContract(schemaId){
    if(schemaId==='export_preparation')return 'Return one JSON object with: status, summary, suggestions[], unresolved[], warnings[]. Each suggestion has projection, field_id, value, source_kind, confidence, evidence. Each unresolved item has projection, field_id, reason and no value. Use only supplied allowed_fields.';
    if(schemaId==='results_comparison')return 'Return one JSON object with: status, groups[], summary, contrasts[], hypotheses[], limitations[], next_checks[]. Preserve selected group names exactly.';
    if(schemaId==='results_interpretation')return 'Return one JSON object with: status, summary, observations[], hypotheses[], limitations[], next_checks[]. Evidence must identify supplied deterministic facts.';
    if(schemaId==='dataset_corrections')return 'Return one compact JSON object with proposals[] and unresolved[]. Each proposal must reference one supplied finding_id and use only an allowed patch_type. Unsupported cases belong in unresolved[].';
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
    LF.Storage.getAssistantSettings().contextChars:4200):undefined,requestedMax=Number(opts.maxChars)||assistantMax;
    let ctx=pack(prof,{exp:expOf(),question:opts.userText||'',params:opts.params||{}
    ,selection:opts.selection||null,collect:opts.outputs&&opts.outputs.collect||{}
    ,workItem:opts.workItem||null,maxChars:requestedMax});if(requestedMax)ctx=budgetPack(ctx,requestedMax);
    let sys=system(def,step),retry=clean(opts.retryFeedback);if(retry)sys+='\n\n# RETRY CORRECTION\n'+clip(retry,900);
    const req=clean(opts.userText),digest=Array.isArray(ctx.facts_digest)?ctx.facts_digest.slice():[];
    // facts_digest reaches the model as flat text; the JSON pack stays machine-parseable and digest-free.
    const packJson=JSON.stringify(ctx,function(key,value){return key==='facts_digest'?undefined:value;});
    const digestBlock=digest.length?'\n\n<facts>\n'+digest.map(function(line){return String(line).replace(/[\r\n]+/g,' ');}).join('\n')+'\n</facts>':'';
    const user='<research_context_pack>\n'+packJson+'\n</research_context_pack>'+digestBlock+
    (req?'\n\n<user_request>\n'+req+'\n</user_request>':'');
    if(Log){
      const included=Object.keys(ctx),known=['workspace','process','page_context','experiment_brief','results','groups',
        'measurements','samples','findings','evidence','cabinet','knowledge','export_projection','action_outputs','history'],
        semanticBytes=typeof TextEncoder==='function'?new TextEncoder().encode(user).length:user.length;
      Log.info('context.profile',{actionId:def.id,profile:prof,estimatedTokens:Math.ceil(user.length/4),
        semanticContextBytes:semanticBytes,included:included,
        omitted:known.filter(function(key){return !Object.prototype.hasOwnProperty.call(ctx,key);})});
    }
    return{messageList:[{role:'system',content:sys},{role:'user',content:user}],context:ctx,user:user};}
  LF.ContextBuilder={pack:pack,profiles:profiles,registerProfile:registerProfile,designReferences:designReferences};LF.ActionContext={build:build};
}());
