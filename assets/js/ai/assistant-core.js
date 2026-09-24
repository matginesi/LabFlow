/*
 * Small-model Assistant core.
 * Boundary: scope and experiment facts are deterministic. Natural-language intent is classified by one tiny,
 * language-agnostic provider request only when an explicit local command is not used.
 */
(function(){
'use strict';
const LF=window.LabFlow=window.LabFlow||{};
const Log=LF.Logger?LF.Logger.scope('assistant-memory'):null;
const LOCAL_INTENTS=new Set(['missing','count','best','anomalies','summary','status','clarify']);
const INTENTS=new Set(['missing','count','best','anomalies','summary','status','compare','explain','design_review','scientific','clarify']);
const TARGETS=new Set(['current','measurements','samples','experiments','findings','pce','design','results','export','review','experiment']);
function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
function lower(v){return clean(v).toLowerCase();}
function take(v,n){return(Array.isArray(v)?v:[]).slice(0,n);}

/* Session-only Assistant memory.
   `derived` is persisted inside the saved workspace, so conversation focus and the router
   cache deliberately live in module state instead. State.resetSession() and clearing the
   conversation both call clearMemory(); nothing here is ever serialized with an experiment. */
const session={experimentId:'',memory:null};
function emptyMemory(experimentId){
  return{experimentId:String(experimentId||''),focus:null,lastIntent:'',lastTarget:'',lastFocusAt:'',routeCache:[]};
}
function memoryFor(exp){
  const id=String(exp&&exp.id||'');
  if(!session.memory||session.experimentId!==id){session.experimentId=id;session.memory=emptyMemory(id);}
  return session.memory;
}
function clearMemory(){session.experimentId='';session.memory=null;if(Log)Log.info('memory.clear',{});}
function memorySnapshot(){return session.memory?JSON.parse(JSON.stringify(session.memory)):null;}
function noteTurn(patch){
  const memory=session.memory;if(!memory)return null;
  Object.assign(memory,patch||{});
  delete memory.turn;
  if(Array.isArray(memory.routeCache)&&memory.routeCache.length>32)memory.routeCache=memory.routeCache.slice(-32);
  if(Log)Log.info('memory.update',{focusKind:memory.focus&&memory.focus.kind||'',focusId:memory.focus&&memory.focus.id||'',
    lastIntent:memory.lastIntent||'',lastTarget:memory.lastTarget||'',cacheEntries:memory.routeCache.length});
  return memory;
}
function normalizeText(value){return clean(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();}
function entityList(exp){
  const out=[];
  function push(kind,id,label,aliases){
    const name=clean(label)||clean(id);if(!name)return;
    const keys=[],nameKey=normalizeText(name);
    if(nameKey.length>=3)keys.push(nameKey);
    [].concat(aliases||[]).forEach(function(alias){const key=normalizeText(alias);if(key.length>=3&&keys.indexOf(key)<0)keys.push(key);});
    if(keys.length)out.push({kind:kind,id:String(id||''),label:name,keys:keys});
  }
  (exp&&exp.samples||[]).forEach(function(s){push('sample',s.id,s.name,[s.rawName]);});
  (exp&&exp.measurements||[]).forEach(function(m){push('measurement',m.id,m.sample||m.file,[m.file,m.rawSample,m.path]);});
  (exp&&exp.experiments||[]).forEach(function(e){push('group',e.id,e.name,[]);});
  (exp&&exp.design&&exp.design.devices||[]).forEach(function(d){push('design_device',d.id,d.name,[d.group]);});
  return out;
}
// Language-agnostic entity linking: it matches canonical LabFlow identifiers only, never a word lexicon.
function resolveEntities(exp,text,scope,limit){
  const hay=normalizeText(text);if(!hay)return[];
  const padded=' '+hay+' ';
  const matches=entityList(exp).filter(function(entity){return entity.keys.some(function(key){return padded.indexOf(' '+key+' ')>=0;});});
  matches.sort(function(a,b){return b.label.length-a.label.length;});
  const seen=new Set(),out=[];
  matches.forEach(function(entity){const id=entity.kind+':'+entity.id;if(seen.has(id))return;seen.add(id);out.push({kind:entity.kind,id:entity.id,label:entity.label});});
  return out.slice(0,Math.max(1,Number(limit)||3));
}
function selectionFocus(exp,scope){
  const selected=scope&&scope.selected||{},deviceId=selected.experiment||'';
  const device=(exp&&exp.design&&exp.design.devices||[]).find(function(d){return String(d.id)===String(deviceId);});
  if(device)return{kind:'design_device',id:device.id,label:clean(device.name)||clean(device.group)||device.id};
  const measurementId=selected.measurement||'';
  const measurement=(exp&&exp.measurements||[]).find(function(m){return String(m.id)===String(measurementId);});
  if(measurement)return{kind:'measurement',id:measurement.id,label:clean(measurement.sample)||clean(measurement.file)||measurement.id};
  return null;
}
function focusFor(exp,text,scope){
  const matched=resolveEntities(exp,text,scope,3),order=['sample','measurement','design_device','group'];
  for(const kind of order){const hit=matched.find(function(item){return item.kind===kind;});if(hit)return hit;}
  // Page selection is promoted only for short messages without a named entity, so general questions stay unbiased.
  return normalizeText(text).split(' ').filter(Boolean).length<=8?selectionFocus(exp,scope):null;
}
function routeCacheKey(text,scope){return normalizeText(scope&&scope.page)+'|'+normalizeText(scope&&scope.view)+'|'+normalizeText(text).slice(0,160);}
function cachedRoute(text,scope){
  const memory=session.memory;if(!memory)return null;
  const key=routeCacheKey(text,scope),hit=(memory.routeCache||[]).find(function(item){return item.key===key;});
  if(!hit)return null;
  hit.hits=Number(hit.hits||0)+1;hit.at=new Date().toISOString();
  if(Log)Log.info('memory.route-cache',{page:scope&&scope.page||'',hits:hit.hits});
  return JSON.parse(JSON.stringify(hit.route));
}
function rememberRoute(text,scope,route){
  if(!session.memory||!route||route.intent==='clarify')return null;
  const key=routeCacheKey(text,scope),cache=session.memory.routeCache||(session.memory.routeCache=[]),existing=cache.find(function(item){return item.key===key;});
  if(existing){existing.route=JSON.parse(JSON.stringify(route));existing.at=new Date().toISOString();return existing;}
  const entry={key:key,route:JSON.parse(JSON.stringify(route)),hits:0,at:new Date().toISOString()};cache.push(entry);return entry;
}
// The tiny router stays the single intent authority; this only recovers a dropped follow-up.
function refineRoute(route,exp,text,scope){
  const normalized=normalizeRoute(route);if(normalized.intent!=='clarify')return normalized;
  const memory=session.memory;
  if(memory&&memory.lastIntent&&!resolveEntities(exp,text,scope,1).length){
    const prior=normalizeRoute({intent:memory.lastIntent,target:memory.lastTarget||'current',followup:true});
    if(Log)Log.info('memory.route-recovered',{intent:prior.intent,target:prior.target});
    return prior;
  }
  return normalized;
}

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
function focusedMeasurements(exp,text,focus){
  const all=exp&&exp.measurements||[],rows=[];
  if(focus&&focus.kind==='sample')all.forEach(function(m){if(rows.length<4&&clean(m.sample)===clean(focus.label))rows.push(m);});
  else if(focus&&focus.kind==='measurement')all.forEach(function(m){if(String(m.id)===String(focus.id))rows.push(m);});
  else if(focus&&focus.kind==='group')all.forEach(function(m){if(rows.length<4&&clean(m.group)===clean(focus.label))rows.push(m);});
  if(!rows.length){const terms=tokenize(text);if(terms.length)all.forEach(function(m){if(rows.length>=4)return;const hay=lower([m.sample,m.group,m.path,m.file].join(' '));if(terms.some(function(t){return hay.indexOf(t)>=0;}))rows.push(m);});}
  return take(rows,4).map(function(m){return{id:m.id||'',sample:m.sample||'',group:m.group||'',quality:m.qualityStatus||'',eligible:!!m.rankingEligible,best_efficiency:m.bestEff,fw:compact(m.fw),rv:compact(m.rv),hysteresis:m.hysteresis};});
}
function focusRef(exp,focus){
  if(!focus)return null;
  if(focus.kind==='sample'){const base=(exp.samples||[]).find(function(s){return String(s.id)===String(focus.id);})||{};return{kind:'sample',id:focus.id,label:focus.label,group:clean(base.group),is_ref:!!base.isRef,measurement_count:take(base.measurementIds,40).length};}
  if(focus.kind==='measurement'){const m=(exp.measurements||[]).find(function(x){return String(x.id)===String(focus.id);})||{};return{kind:'measurement',id:focus.id,label:focus.label,sample:clean(m.sample),group:clean(m.group),quality:m.qualityStatus||'',eligible:!!m.rankingEligible,best_efficiency:m.bestEff};}
  if(focus.kind==='design_device'){const d=(exp.design&&exp.design.devices||[]).find(function(x){return String(x.id)===String(focus.id);})||{};return{kind:'design_device',id:focus.id,label:focus.label,samples:take(d.sampleNames,8)};}
  if(focus.kind==='group'){const count=(exp.measurements||[]).filter(function(m){return clean(m.group)===clean(focus.label);}).length;return{kind:'group',id:focus.id,label:focus.label,measurement_count:count};}
  return{kind:focus.kind,id:focus.id,label:focus.label};
}
// Section choice follows intent and target first; the open page is only a secondary signal.
function factSectionWanted(kind,intentName,target,page){
  if(target===kind)return true;
  if(kind==='results')return intentName==='explain'||intentName==='compare'||intentName==='scientific'||intentName==='best'||intentName==='anomalies'||page.indexOf('result')>=0||target==='pce';
  if(kind==='design')return intentName==='design_review'||target==='design'||page.indexOf('design')>=0;
  if(kind==='review')return target==='review'||target==='findings'||page.indexOf('upload')>=0||page.indexOf('review')>=0;
  if(kind==='export')return target==='export'||page.indexOf('export')>=0;
  return false;
}
function llmFacts(exp,text,scope,intentName,target,focus){
  const page=lower(scope&&scope.page),intent=String(intentName||''),wantedTarget=lower(target||'current');
  const bundle=LF.AnalysisSummary&&LF.AnalysisSummary.ensure?LF.AnalysisSummary.ensure(exp):{},summary=exp&&exp.analysis&&exp.analysis.summary||{};
  const facts={experiment:{name:clean(exp&&exp.meta&&exp.meta.name),samples:Number(summary.sampleCount||(exp&&exp.samples||[]).length||0),measurements:Number(summary.measurementCount||(exp&&exp.measurements||[]).length||0)},scope:scope};
  const entity=focus||focusFor(exp,text,scope);
  if(entity)facts.focus=focusRef(exp,entity);
  if(factSectionWanted('design',intent,wantedTarget,page)){
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
  if(factSectionWanted('results',intent,wantedTarget,page)){
    facts.results={summary:compact(summary),quality:compact(bundle.advanced&&bundle.advanced.quality||{}),paired_scans:compact(bundle.advanced&&bundle.advanced.pairedScans||{}),reproducibility:take(bundle.advanced&&bundle.advanced.reproducibility,6),correlations:take(bundle.advanced&&bundle.advanced.correlations,6),top_non_reference:take(bundle.topNonRef,4),top_reference:take(bundle.topRef,3)};
  }
  if(entity){const ms=focusedMeasurements(exp,text,entity);if(ms.length)facts.measurements=ms;}
  if(factSectionWanted('review',intent,wantedTarget,page))facts.open_findings=take((exp.findings||[]).filter(function(f){return f.status!=='resolved';}),6).map(function(f){return{id:f.id||'',severity:f.severity||'',title:f.title||'',detail:clean(f.detail).slice(0,220),target:f.target||''};});
  if(factSectionWanted('export',intent,wantedTarget,page)){const x=exportMissing(exp);facts.export={nomad_missing:listLabels(x.nomad,8),readypv_missing:listLabels(x.readypv,6)};}
  return facts;
}
// Compact scalar digest for tiny models: rendered as flat text while the JSON pack keeps validation data.
function digestLines(ctx){
  const facts=ctx&&ctx.facts||{},lines=[],push=function(key,value){if(value==null||value==='')return;lines.push(key+'='+String(value));};
  push('page',ctx&&ctx.scope&&ctx.scope.page);
  push('intent',ctx&&ctx.task&&ctx.task.intent);
  if(ctx&&ctx.focus)push('focus',String(ctx.focus.kind||'')+':'+String(ctx.focus.label||ctx.focus.id||''));
  const summary=facts.results&&facts.results.summary||{},quality=facts.results&&facts.results.quality||{},paired=facts.results&&facts.results.paired_scans||{};
  push('samples',summary.sampleCount);push('measurements',summary.measurementCount);
  push('eligible',Number.isFinite(Number(quality.eligible))?Number(quality.eligible):summary.eligibleCount);
  if(Number.isFinite(Number(summary.bestEfficiency)))push('best_pce',Number(summary.bestEfficiency).toFixed(2));
  push('best_sample',summary.bestSample);
  if(Number.isFinite(Number(paired.count)))push('paired_scans',Number(paired.count));
  if(paired.absDeltaPce&&Number.isFinite(Number(paired.absDeltaPce.median)))push('paired_median_delta',Number(paired.absDeltaPce.median).toFixed(2));
  if(Array.isArray(facts.open_findings))push('open_findings',facts.open_findings.length);
  if(facts.design)push('design_missing',take(facts.design.missing_domains,4).join(','));
  if(facts.export)push('nomad_missing',take(facts.export.nomad_missing,4).length);
  return lines.slice(0,14);
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
  scope=scope||currentScope(exp);
  memoryFor(exp);
  route=refineRoute(route,exp,text,scope);
  const focus=focusFor(exp,text,scope);
  if(LOCAL_INTENTS.has(route.intent)){
    const local=localAnswerFromRoute(exp,scope,route);
    if(local){local.focus=focus;return local;}
  }
  const facts=llmFacts(exp,text,scope,route.intent,route.target,focus),refs=references(route,text),previous=lastTurn(exp,route);
  const instruction=route.intent==='design_review'
    ?'Review the supplied Design facts. Separate observation from hypothesis and mention missing domains before speculation.'
    :'Answer the researcher using only supplied facts and explicitly supplied references.';
  const ctx={task:{intent:route.intent,instruction:instruction},scope:scope,facts:facts};
  if(focus)ctx.focus={kind:focus.kind,id:focus.id,label:focus.label};
  if(refs.knowledge)ctx.knowledge=refs.knowledge;
  if(refs.cabinet)ctx.cabinet=refs.cabinet;
  if(previous)ctx.previous_turn=previous;
  const digest=digestLines(ctx);if(digest.length)ctx.facts_digest=digest;
  const fallback=route.intent==='design_review'?missingAnswer(exp,scope,'design').answer:'I do not have enough verified evidence to answer this safely. Please narrow the question or inspect the current LabFlow state.';
  return{mode:'llm',intent:route.intent,scope:scope,context:ctx,pack:ctx,focus:focus,fallback:fallback,reason:'Intent router selected a bounded provider answer.',route:route};
}

/* Envelope parsing keeps the model output machine-checkable without adding a second provider call.
   Labels are fixed ASCII tokens; the answer prose stays in the researcher's language. */
function envelopeLabel(line){
  const match=/^\s*[*_#>•\-\s]*([A-Za-z]+)[*_]*\s*[:\-–]\s*[*_]*\s*(.*)$/.exec(String(line||''));
  if(!match)return null;
  const key=match[1].toUpperCase();
  if(key!=='ANSWER'&&key!=='BASIS'&&key!=='UNKNOWN')return null;
  return{key:key.toLowerCase(),rest:match[2]};
}
function parseEnvelope(text){
  const lines=String(text==null?'':text).replace(/\r\n/g,'\n').split('\n'),parts={answer:[],basis:[],unknown:[]};
  let current=null,found=false;
  lines.forEach(function(line){
    const label=envelopeLabel(line);
    if(label){current=label.key;found=true;if(label.rest)parts[current].push(label.rest);return;}
    if(current)parts[current].push(line);
  });
  if(!found)return null;
  const join=function(values){return values.join('\n').trim();};
  const basis=join(parts.basis).split(/[,;\n]+/).map(function(item){return clean(item).replace(/^[-*•]\s*/,'');}).filter(Boolean);
  return{answer:join(parts.answer),basis:basis,unknown:join(parts.unknown),raw:String(text||'')};
}
function numberTokens(value){const out=[],re=/-?\d+(?:[.,]\d+)?/g;let match;const raw=String(value==null?'':value);
  while((match=re.exec(raw)))out.push(match[0].replace(',','.'));return out;}
function knownNumbers(value,depth,out){
  depth=depth||0;out=out||[];
  if(depth>6||value==null)return out;
  if(typeof value==='number'&&Number.isFinite(value)){out.push(value);return out;}
  if(typeof value==='string'){numberTokens(value).forEach(function(token){const n=Number(token);if(Number.isFinite(n))out.push(n);});return out;}
  if(Array.isArray(value)){value.slice(0,40).forEach(function(item){knownNumbers(item,depth+1,out);});return out;}
  if(typeof value==='object'){Object.keys(value).slice(0,40).forEach(function(key){knownNumbers(value[key],depth+1,out);});}
  return out;
}
function numberSupported(token,known){
  const n=Number(token);if(!Number.isFinite(n))return true;
  return known.some(function(value){return Math.abs(value-n)<=Math.max(0.05,Math.abs(value)*0.01);});
}
function packKeys(pack){
  const keys=new Set(),walk=function(value,path,depth){
    if(depth>5||value==null)return;
    if(Array.isArray(value)){if(path)keys.add(path);value.slice(0,20).forEach(function(item){walk(item,path,depth+1);});return;}
    if(typeof value==='object'){Object.keys(value).slice(0,60).forEach(function(key){const next=path?path+'.'+key:key;keys.add(next);walk(value[key],next,depth+1);});}
  };
  walk(pack||{},'',0);
  return keys;
}
function validateEnvelope(envelope,pack,question){
  if(!envelope||!envelope.answer)return{ok:false,reason:'missing_answer',unknownBasis:[],unsupportedNumbers:[]};
  const keys=packKeys(pack),leafs=new Set(Array.from(keys).map(function(key){return key.split('.').pop();}));
  const unknownBasis=(envelope.basis||[]).filter(function(key){const k=clean(key);if(!k)return false;const leaf=k.split('.').pop();return !keys.has(k)&&!leafs.has(leaf);});
  const known=knownNumbers(pack,0,[]);numberTokens(question||'').forEach(function(token){const n=Number(token);if(Number.isFinite(n))known.push(n);});
  const numbers=numberTokens(envelope.answer);
  const unsupported=numbers.filter(function(token){return !numberSupported(token,known);});
  // A tiny model that produced numbers none of which exist in the pack is not grounded enough to show.
  const severe=numbers.length>0&&unsupported.length===numbers.length;
  return{ok:!severe&&!unknownBasis.length,severe:severe,unknownBasis:unknownBasis,unsupportedNumbers:unsupported};
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
  normalizeRoute:normalizeRoute,classify:classify,planFromRoute:planFromRoute,llmFacts:llmFacts,
  resolveEntities:resolveEntities,focusFor:focusFor,digestLines:digestLines,
  parseEnvelope:parseEnvelope,validateEnvelope:validateEnvelope,
  memory:memoryFor,memorySnapshot:memorySnapshot,noteTurn:noteTurn,clearMemory:clearMemory,
  cachedRoute:cachedRoute,rememberRoute:rememberRoute,refineRoute:refineRoute
};
}());
