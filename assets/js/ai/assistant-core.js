/*
 * Small-model Assistant core.
 * Boundary: scope and experiment facts are deterministic. Natural-language intent is classified by one tiny,
 * language-agnostic provider request only when an explicit local command is not used.
 */
(function(){
'use strict';
const LF=window.LabFlow=window.LabFlow||{};
const LOCAL_INTENTS=new Set(['missing','count','best','anomalies','summary','status','clarify']);
const INTENTS=new Set(['missing','count','best','anomalies','summary','status','compare','explain','design_review','scientific','clarify']);
const TARGETS=new Set(['current','measurements','samples','experiments','findings','pce','design','results','export','review','experiment']);
function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
function lower(v){return clean(v).toLowerCase();}
function take(v,n){return(Array.isArray(v)?v:[]).slice(0,n);}
function compact(v,depth){
  depth=depth||0;
  if(v==null||typeof v==='number'||typeof v==='boolean')return v;
  if(typeof v==='string')return v.length>240?v.slice(0,240)+'…':v;
  if(Array.isArray(v))return v.slice(0,8).map(function(x){return compact(x,depth+1);});
  if(typeof v==='object'){
    if(depth>4)return'[bounded]';
    const out={};
    Object.keys(v).slice(0,16).forEach(function(k){
      if(/^(rawText|sourceArchive|curve|curves|points|rows|data)$/i.test(k))return;
      out[k]=compact(v[k],depth+1);
    });
    return out;
  }
  return clean(v);
}
function currentScope(exp){
  const snap=LF.PageContext&&LF.PageContext.snapshot?LF.PageContext.snapshot():{},state=LF.State&&LF.State.state||{},ui=state.ui||{},page=clean(snap.page)||({
    'experiment-results':'Results','experiment-design':'Design','experiment-export':'Export','experiment-import':'Upload & Review','settings':'Settings'
  }[ui.route||state.route]||'Experiment'),selected=Object.assign({},snap.selected||{});
  if(!selected.experiment&&ui.selectedDesignDeviceId)selected.experiment=ui.selectedDesignDeviceId;
  if(!selected.measurement&&ui.selectedMeasurementId)selected.measurement=ui.selectedMeasurementId;
  return{page:page,view:clean(snap.view),selected:selected};
}
function selectedDesign(exp,scope){
  const devices=exp&&exp.design&&exp.design.devices||[],id=scope&&scope.selected&&scope.selected.experiment||'';
  return devices.find(function(d){return String(d.id)===String(id);})||devices[0]||null;
}
function designMissing(exp,scope){
  const device=selectedDesign(exp,scope);
  if(!device)return{kind:'design',available:false,missing:[],acknowledged:[],device:null};
  const missing=LF.DesignModel&&LF.DesignModel.missingDomains?LF.DesignModel.missingDomains(exp,device):[],pending=LF.DesignModel&&LF.DesignModel.pendingDomains?LF.DesignModel.pendingDomains(exp,device):missing,ack=missing.filter(function(x){return!pending.includes(x);});
  return{kind:'design',available:true,device:device,missing:pending,acknowledged:ack,complete:pending.length===0};
}
function exportMissing(exp){
  if(!LF.ExportProjections||!LF.ExportProjections.preparationContext)return{kind:'export',available:false,nomad:[],readypv:[]};
  const p=LF.ExportProjections.preparationContext(exp)||{},nomad=take(p.nomad&&p.nomad.missing,20),readypv=take(p.readypv&&p.readypv.missing,20);
  return{kind:'export',available:true,nomad:nomad,readypv:readypv,complete:nomad.length===0&&readypv.length===0};
}
function reviewMissing(exp){
  const open=(exp&&exp.findings||[]).filter(function(f){return f.status!=='resolved';});
  return{kind:'review',available:true,open:open,complete:open.length===0};
}
function resultsState(exp){
  const bundle=LF.AnalysisSummary&&LF.AnalysisSummary.ensure?LF.AnalysisSummary.ensure(exp):{},summary=exp&&exp.analysis&&exp.analysis.summary||{},findings=bundle.findings||{},advanced=bundle.advanced||{},measurements=exp&&exp.measurements||[],unusable=measurements.filter(function(m){return m.excluded||m.rankingEligible===false||m.qualityStatus&&m.qualityStatus!=='valid';});
  return{kind:'results',available:true,summary:summary,findings:findings,advanced:advanced,anomalies:bundle.anomalies||[],unusable:unusable,complete:Number(summary.measurementCount||measurements.length)>0&&Number(findings.open||0)===0};
}
function missingState(exp,scope,target){
  const t=lower(target),page=lower(scope&&scope.page);
  if(t==='design'||(!t||t==='current')&&page.indexOf('design')>=0)return designMissing(exp,scope);
  if(t==='export'||(!t||t==='current')&&page.indexOf('export')>=0)return exportMissing(exp);
  if(t==='review'||(!t||t==='current')&&(page.indexOf('upload')>=0||page.indexOf('review')>=0))return reviewMissing(exp);
  if(t==='results'||(!t||t==='current')&&page.indexOf('result')>=0)return resultsState(exp);
  return{kind:'experiment',available:true,review:reviewMissing(exp),design:designMissing(exp,scope),export:exportMissing(exp)};
}
function listLabels(items,max){return take(items,max||6).map(function(x){return clean(x&&x.label||x&&x.title||x&&x.id||x&&x.name);}).filter(Boolean);}
function missingAnswer(exp,scope,target){
  const state=missingState(exp,scope,target),page=lower(scope&&scope.page);
  if((target==='current'||!target)&&(page.indexOf('settings')>=0||page.indexOf('cabinet')>=0))return{answer:'This page has no single completeness state. Choose Design, Results, Review, or export metadata.',reason:'The current page has no deterministic completeness contract.'};
  if(state.kind==='design'){
    if(!state.available)return{answer:'No Design Experiment is selected.',reason:'Current Design scope has no selected experiment.'};
    const name=clean(state.device&&state.device.name)||clean(state.device&&state.device.group)||'current experiment',labels={solutions:'solution chemistry',stack:'device stack',process:'fabrication process'};
    if(!state.missing.length)return{answer:'**'+name+'** has no pending Design domains.',reason:'Current Design completeness was checked deterministically.'};
    const rows=state.missing.map(function(x){return'- '+(labels[x]||x);});
    return{answer:'**'+name+'** is still missing:\n\n'+rows.join('\n')+(state.acknowledged.length?'\n\nOther missing domains were already reviewed and acknowledged as unknown.':''),reason:'Missing Design domains were read from the deterministic Design model.'};
  }
  if(state.kind==='export'){
    const n=state.nomad||[],r=state.readypv||[];
    if(!n.length&&!r.length)return{answer:'No required export metadata is currently missing.',reason:'Export projection completeness was checked deterministically.'};
    const parts=[];
    if(n.length)parts.push('**NOMAD**: '+listLabels(n,8).join(', ')+(n.length>8?' …':''));
    if(r.length)parts.push('**Ready-PV**: '+listLabels(r,6).join(', ')+(r.length>6?' …':''));
    return{answer:'Metadata still to complete:\n\n'+parts.join('\n\n'),reason:'Missing export fields were read from the deterministic export projection.'};
  }
  if(state.kind==='review'){
    const open=state.open||[];
    if(!open.length)return{answer:'There are no open findings in the current review.',reason:'Open findings were checked deterministically.'};
    return{answer:'There are **'+open.length+' open findings**. First items:\n\n'+take(open,6).map(function(f){return'- '+clean(f.title||f.type||f.id);}).join('\n'),reason:'Open review findings were checked deterministically.'};
  }
  if(state.kind==='results'){
    const open=Number(state.findings&&state.findings.open||0),unusable=(state.unusable||[]).length,measurements=Number(state.summary&&state.summary.measurementCount||0);
    if(!measurements)return{answer:'There are no analyzable measurements in Results yet.',reason:'Results availability was checked deterministically.'};
    if(!open&&!unusable)return{answer:'Results has analyzed measurements and no deterministic item currently requires attention.',reason:'Results quality and findings were checked deterministically.'};
    const bits=[];
    if(open)bits.push('**'+open+' open findings**');
    if(unusable)bits.push('**'+unusable+' measurements not ranking-eligible / needing review**');
    return{answer:'Results still has '+bits.join(' and ')+'.',reason:'Results quality and findings were checked deterministically.'};
  }
  const parts=[];
  if(state.review&&state.review.open&&state.review.open.length)parts.push('open findings: '+state.review.open.length);
  if(state.design&&state.design.missing&&state.design.missing.length)parts.push('missing Design domains: '+state.design.missing.join(', '));
  if(state.export&&state.export.nomad&&state.export.nomad.length)parts.push('missing NOMAD fields: '+state.export.nomad.length);
  if(parts.length)return{answer:'Current experiment status: '+parts.join(' · ')+'.',reason:'Current experiment completeness was checked deterministically.'};
  return{answer:'No deterministic missing items are visible in the current experiment.',reason:'Current experiment completeness was checked deterministically.'};
}
function explicitCommand(text){
  const raw=clean(text);if(raw.charAt(0)!=='/')return null;
  const parts=raw.slice(1).toLowerCase().split(/\s+/),cmd=parts[0]||'',arg=parts[1]||'current';
  if(cmd==='missing')return{intent:'missing',target:TARGETS.has(arg)?arg:'current'};
  if(cmd==='summary')return{intent:'summary',target:'experiment'};
  if(cmd==='status')return{intent:'status',target:'experiment'};
  if(cmd==='best')return{intent:'best',target:'pce'};
  if(cmd==='anomalies')return{intent:'anomalies',target:'measurements'};
  if(cmd==='count'&&['measurements','samples','experiments','findings'].includes(arg))return{intent:'count',target:arg};
  return null;
}
function localAnswerFromRoute(exp,scope,route){
  route=route||{};const kind=route.intent,target=route.target||'current',bundle=LF.AnalysisSummary&&LF.AnalysisSummary.ensure?LF.AnalysisSummary.ensure(exp):{},summary=exp&&exp.analysis&&exp.analysis.summary||{},advanced=bundle.advanced||{},findings=bundle.findings||{};
  function done(answer,source,reason){return{mode:'local',intent:kind,scope:scope,answer:answer,source:source,reason:reason||('Matched deterministic '+source+'.'),route:route};}
  if(kind==='missing'){const m=missingAnswer(exp,scope,target);return done(m.answer,'missing state',m.reason);}
  if(kind==='count'){
    if(target==='measurements')return done('**'+Number(summary.measurementCount||0)+' measurements** in the current experiment.','measurement count');
    if(target==='samples')return done('**'+Number(summary.sampleCount||0)+' samples** in the current experiment.','sample count');
    if(target==='experiments')return done('**'+Number(summary.experimentCount||0)+' experiment groups** in the current dataset.','experiment count');
    if(target==='findings')return done('**'+Number(findings.open||0)+' open findings** in the current experiment.','finding count');
    return done('Choose what to count: measurements, samples, experiment groups, or findings.','clarification','Count intent needs a concrete target.');
  }
  if(kind==='best'){
    const value=Number(summary.bestEfficiency),sample=clean(summary.bestSample),group=clean(summary.bestExperiment);
    if(Number.isFinite(value))return done('Best eligible PCE: **'+value.toFixed(2)+'%**'+(sample?' · **'+sample+'**':'')+(group?' · **'+group+'**':'')+'.','Results ranking');
    return done('There is no ranking-eligible PCE in the current experiment.','Results ranking');
  }
  if(kind==='anomalies'){
    const rows=Array.isArray(bundle.anomalies)?bundle.anomalies:[];
    if(!rows.length)return done('No deterministic measurement anomalies are currently listed.','anomaly summary');
    const names=take(rows,5).map(function(x){return clean(x.sample||x.measurement||x.id||x.title||'measurement');});
    return done('**'+rows.length+' deterministic anomalies** are currently listed: '+names.join(', ')+(rows.length>5?' …':'')+'.','anomaly summary');
  }
  if(kind==='summary'||kind==='status'){
    const measurements=Number(summary.measurementCount||0),eligible=Number(advanced.quality&&advanced.quality.eligible||summary.eligibleCount||0),open=Number(findings.open||0),lines=['Current status: **'+measurements+' measurements**, **'+eligible+' ranking-eligible**, **'+open+' open findings**.'];
    if(Number.isFinite(Number(summary.bestEfficiency)))lines.push('Best eligible PCE: **'+Number(summary.bestEfficiency).toFixed(2)+'%**'+(summary.bestSample?' ('+summary.bestSample+')':'')+'.');
    if(advanced.pairedScans&&Number(advanced.pairedScans.count)>0&&Number.isFinite(Number(advanced.pairedScans.absDeltaPce&&advanced.pairedScans.absDeltaPce.median)))lines.push('Paired FW/RV scans: **'+advanced.pairedScans.count+'**, median |ΔPCE| **'+Number(advanced.pairedScans.absDeltaPce.median).toFixed(2)+' pp**.');
    return done(lines.join('\n\n'),'experiment summary');
  }
  if(kind==='clarify')return done('The request is too broad to answer safely. Specify the current item or ask for missing fields, status, counts, anomalies, a comparison, or a scientific explanation.','clarification','The intent router requested clarification.');
  return null;
}
function routeMessages(text,scope){
  const system=[
    'You are a tiny intent router for LabFlow. Classify the user message regardless of language. Do not answer the question.',
    'Return JSON only with keys intent, target, knowledge, cabinet, followup, search_terms.',
    'intent: missing | count | best | anomalies | summary | status | compare | explain | design_review | scientific | clarify.',
    'target: current | measurements | samples | experiments | findings | pce | design | results | export | review | experiment.',
    'Use missing for absent/incomplete information; count for quantities; best for ranking/PCE; anomalies for problems/outliers.',
    'Use summary/status for factual overview; compare/explain/design_review/scientific for interpretation; clarify only when no meaningful request can be inferred.',
    'knowledge=true only for background scientific knowledge/literature. cabinet=true only for reusable LabFlow references.',
    'followup=true only when the message depends on the previous turn. If retrieval is needed, search_terms is a very short English scientific query; otherwise empty.'
  ].join(' ');
  return[{role:'system',content:system},{role:'user',content:JSON.stringify({page:scope.page||'Experiment',view:scope.view||'',question:clean(text)})}];
}
function normalizeRoute(value){
  const v=value&&typeof value==='object'?value:{},intent=INTENTS.has(String(v.intent||'').toLowerCase())?String(v.intent).toLowerCase():'clarify',target=TARGETS.has(String(v.target||'').toLowerCase())?String(v.target).toLowerCase():'current';
  return{intent:intent,target:target,knowledge:v.knowledge===true,cabinet:v.cabinet===true,followup:v.followup===true,search_terms:clean(v.search_terms).slice(0,160)};
}
function parseRouteContent(text){
  let parsed=null;
  if(LF.StructuredOutput&&LF.StructuredOutput.parse){const out=LF.StructuredOutput.parse(text);parsed=out&&out.value||null;}
  if(!parsed)try{parsed=JSON.parse(String(text||'').trim());}catch(_){}
  return normalizeRoute(parsed);
}
async function classify(text,scope,opts){
  opts=opts||{};
  if(!LF.AI||!LF.AI.buildRequest||!LF.AI.send)throw new Error('Assistant intent router is unavailable.');
  const messages=routeMessages(text,scope),inputTokens=LF.AI.estimatePromptTokens?LF.AI.estimatePromptTokens(messages):null,spec=LF.AI.buildRequest({messages:messages,stream:false,maxTokens:96,temperature:0,jsonMode:true,thinkingMode:'off',guardThinking:true,timeoutMs:20000,hardTimeoutMs:25000});
  if(opts.onRequest)opts.onRequest({request:spec,inputTokens:inputTokens,maxTokens:96});
  const response=await LF.AI.send(spec,{label:'assistant.route'}),route=parseRouteContent(response.content);
  return{route:route,response:response,inputTokens:inputTokens,messages:messages};
}
function tokenize(text){return clean(text).toLowerCase().replace(/[^\p{L}\p{N}_\-.]+/gu,' ').split(/\s+/).filter(function(x){return x.length>=3;}).slice(0,24);}
function focusedMeasurements(exp,text){
  const terms=tokenize(text);if(!terms.length)return[];
  return take((exp.measurements||[]).filter(function(m){const hay=lower([m.sample,m.group,m.path,m.file].join(' '));return terms.some(function(t){return hay.indexOf(t)>=0;});}),4).map(function(m){return{id:m.id||'',sample:m.sample||'',group:m.group||'',quality:m.qualityStatus||'',eligible:!!m.rankingEligible,best_efficiency:m.bestEff,fw:compact(m.fw),rv:compact(m.rv),hysteresis:m.hysteresis};});
}
function llmFacts(exp,text,scope,intentName){
  const page=lower(scope.page),bundle=LF.AnalysisSummary&&LF.AnalysisSummary.ensure?LF.AnalysisSummary.ensure(exp):{},summary=exp.analysis&&exp.analysis.summary||{},facts={experiment:{name:clean(exp.meta&&exp.meta.name),samples:Number(summary.sampleCount||(exp.samples||[]).length||0),measurements:Number(summary.measurementCount||(exp.measurements||[]).length||0)},scope:scope};
  if(page.indexOf('design')>=0||intentName==='design_review'){
    const d=designMissing(exp,scope),device=d.device,ids=new Set(device&&device.solutionIds||[]);
    facts.design=device?{
      name:device.name||'',samples:take(device.sampleNames,8),missing_domains:d.missing,
      acknowledged_unknown_domains:d.acknowledged,
      solutions:(exp.design&&exp.design.solutions||[]).filter(function(s){return ids.has(s.id);}).slice(0,5).map(function(s){
        return{name:s.name||'',role:s.role||'',solutes:s.solutes||'',solvents:s.solvents||'',additives:s.additives||''};
      }),
      stack:take(device.stack,10).map(function(x){return{role:x.role||'',material:x.material||'',thickness:x.thickness||''};}),
      process:compact(device.process||{})
    }:null;
  }
  if(page.indexOf('result')>=0||intentName==='explain'||intentName==='compare'||intentName==='scientific'){
    facts.results={summary:compact(summary),quality:compact(bundle.advanced&&bundle.advanced.quality||{}),paired_scans:compact(bundle.advanced&&bundle.advanced.pairedScans||{}),reproducibility:take(bundle.advanced&&bundle.advanced.reproducibility,6),correlations:take(bundle.advanced&&bundle.advanced.correlations,6),top_non_reference:take(bundle.topNonRef,4),top_reference:take(bundle.topRef,3)};
    const ms=focusedMeasurements(exp,text);if(ms.length)facts.measurements=ms;
  }
  if(page.indexOf('upload')>=0||page.indexOf('review')>=0)facts.open_findings=take((exp.findings||[]).filter(function(f){return f.status!=='resolved';}),6).map(function(f){return{id:f.id||'',severity:f.severity||'',title:f.title||'',detail:clean(f.detail).slice(0,220),target:f.target||''};});
  if(page.indexOf('export')>=0){const x=exportMissing(exp);facts.export={nomad_missing:listLabels(x.nomad,8),readypv_missing:listLabels(x.readypv,6)};}
  return facts;
}
function references(route,text){
  const out={},query=clean(route&&route.search_terms)||clean(text);
  if(route&&route.knowledge&&LF.KnowledgeBase){const k=LF.KnowledgeBase.context(query,{limit:3,minScore:8});if(k&&k.entries&&k.entries.length)out.knowledge={entries:k.entries.slice(0,3)};}
  if(route&&route.cabinet&&LF.Cabinet){const c=LF.Cabinet.context(query,{limit:3});if(c&&c.items&&c.items.length)out.cabinet={items:c.items.slice(0,3)};}
  return out;
}
function lastTurn(exp,route){
  if(!(route&&route.followup))return null;
  const conv=exp&&exp.derived&&exp.derived.chat&&exp.derived.chat.conversation||[],items=conv.filter(function(m){return(m.role==='user'||m.role==='assistant')&&m.state!=='error'&&m.state!=='cancelled'&&clean(m.content);}).slice(-2);
  if(!items.length)return null;
  return items.map(function(m){return{role:m.role,content:clean(m.content).slice(0,420)};});
}
function planFromRoute(exp,text,route,scope){
  scope=scope||currentScope(exp);route=normalizeRoute(route);
  if(LOCAL_INTENTS.has(route.intent)){
    const local=localAnswerFromRoute(exp,scope,route);if(local)return local;
  }
  const facts=llmFacts(exp,text,scope,route.intent),refs=references(route,text),previous=lastTurn(exp,route);
  const instruction=route.intent==='design_review'
    ?'Review the supplied Design facts. Separate observation from hypothesis and mention missing domains before speculation.'
    :'Answer the researcher using only supplied facts and explicitly supplied references.';
  const ctx={task:{intent:route.intent,instruction:instruction},scope:scope,facts:facts};
  if(refs.knowledge)ctx.knowledge=refs.knowledge;
  if(refs.cabinet)ctx.cabinet=refs.cabinet;
  if(previous)ctx.previous_turn=previous;
  const fallback=route.intent==='design_review'?missingAnswer(exp,scope,'design').answer:'I do not have enough verified evidence to answer this safely. Please narrow the question or inspect the current LabFlow state.';
  return{mode:'llm',intent:route.intent,scope:scope,context:ctx,fallback:fallback,reason:'Intent router selected a bounded provider answer.',route:route};
}
function initialPlan(exp,text){
  const scope=currentScope(exp),route=explicitCommand(text);
  if(route){const local=localAnswerFromRoute(exp,scope,route);if(local)return local;}
  return{mode:'route',scope:scope,reason:'Natural-language request requires language-agnostic intent routing.'};
}
function localAnswer(exp,text){const p=initialPlan(exp,text);return p&&p.mode==='local'?p:null;}
LF.AssistantCore={
  scope:currentScope,missingState:missingState,initialPlan:initialPlan,explicitCommand:explicitCommand,
  localAnswer:localAnswer,localAnswerFromRoute:localAnswerFromRoute,routeMessages:routeMessages,
  normalizeRoute:normalizeRoute,classify:classify,planFromRoute:planFromRoute,llmFacts:llmFacts
};
}());
