(function(){
  'use strict';
  const LF=window.LabFlow=window.LabFlow||{},C=LF.Core,Log=LF.Logger.scope('knowledge-base');
  const KINDS=['material','solution','process','stack','concept','guide'];
  let bundled={version:1,records:[],updatedAt:null},local={version:1,records:[],updatedAt:null},library={version:1,records:[],updatedAt:null};

  function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
  function text(v){return String(v==null?'':v).trim();}
  function list(v){return Array.isArray(v)?v.map(text).filter(Boolean):text(v).split(',').map(text).filter(Boolean);}
  function terms(v){return Array.from(new Set(text(v).toLowerCase().replace(/[^a-z0-9+_.-]+/g,' ').split(/\s+/).filter(function(x){return x.length>=2&&!['the','and','for','with','from','into','per','this','that','device','sample'].includes(x);}))).slice(0,48);}
  function normalizeSource(input){input=input&&typeof input==='object'?input:{};return{title:text(input.title),url:text(input.url),doi:text(input.doi),note:text(input.note)};}
  function emptyData(kind){
    if(kind==='solution')return{role:'',solutes:'',solvents:'',concentration:'',additives:'',preparation:''};
    if(kind==='process')return{coating:'',annealing:'',atmosphere:'',notes:''};
    if(kind==='stack')return{layers:[]};
    if(kind==='concept')return{topic:'',principle:'',implications:'',cautions:''};
    if(kind==='guide')return{topic:'',content:'',steps:'',notes:''};
    return{role:'',formula:'',supplier:'',purity:'',notes:''};
  }
  function defaultCollection(kind){return kind==='guide'?'labflow':'science';}
  function normalizeRecord(input){
    input=input&&typeof input==='object'?input:{};
    const kind=KINDS.includes(input.kind)?input.kind:'material',now=new Date().toISOString(),data=Object.assign(emptyData(kind),clone(input.data||{}));
    if(kind==='stack')data.layers=(Array.isArray(data.layers)?data.layers:[]).map(function(layer){return{role:text(layer&&layer.role),material:text(layer&&layer.material),thickness:text(layer&&layer.thickness),process:text(layer&&layer.process)};}).filter(function(layer){return layer.role||layer.material||layer.thickness||layer.process;});
    return{id:text(input.id)||C.uid('kb'),kind:kind,collection:['science','labflow'].includes(input.collection)?input.collection:defaultCollection(kind),name:text(input.name)||'Untitled record',summary:text(input.summary),tags:list(input.tags),sources:(Array.isArray(input.sources)?input.sources:[]).map(normalizeSource).filter(function(source){return source.title||source.url||source.doi||source.note;}),data:data,createdAt:text(input.createdAt)||now,updatedAt:text(input.updatedAt)||now};
  }
  function normalizeLibrary(value){if(!value||typeof value!=='object'||!Array.isArray(value.records))return{version:1,records:[],updatedAt:null};return{version:1,records:value.records.map(normalizeRecord),updatedAt:text(value.updatedAt)||null};}
  function merge(){
    const byId=new Map();
    (bundled.records||[]).forEach(function(record){const clean=normalizeRecord(record);byId.set(clean.id,clean);});
    (local.records||[]).forEach(function(record){const clean=normalizeRecord(record);byId.set(clean.id,clean);});
    const timestamps=[text(bundled.updatedAt),text(local.updatedAt)].filter(Boolean).sort();
    library={version:1,records:Array.from(byId.values()),updatedAt:timestamps.length?timestamps[timestamps.length-1]:null};
  }
  function persistLocal(){local.updatedAt=new Date().toISOString();if(LF.Storage&&LF.Storage.saveLocalKnowledgeLibrary)LF.Storage.saveLocalKnowledgeLibrary(local);merge();}
  function status(){
    const records=library.records||[],science=records.filter(function(r){return r.collection==='science';}).length,labflow=records.filter(function(r){return r.collection==='labflow';}).length;
    return{available:records.length>0,active:records.length>0,records:records.length,scienceRecords:science,labflowRecords:labflow,bundledRecords:(bundled.records||[]).length,localRecords:(local.records||[]).length,storage:'bundled + browser overrides',updatedAt:library.updatedAt};
  }
  function load(){return clone(library);}
  function all(){return clone(library.records);}
  function get(id){const found=library.records.find(function(record){return record.id===String(id);});return found?clone(found):null;}
  function origin(id){const key=String(id),hasBundled=bundled.records.some(function(r){return r.id===key;}),hasLocal=local.records.some(function(r){return r.id===key;});return{bundled:hasBundled,local:hasLocal,custom:hasLocal&&!hasBundled,overridden:hasLocal&&hasBundled};}
  async function initialize(){
    bundled=normalizeLibrary(LF.KnowledgeSeed||{version:1,records:[]});
    local=normalizeLibrary(LF.Storage&&LF.Storage.getLocalKnowledgeLibrary?LF.Storage.getLocalKnowledgeLibrary():{version:1,records:[]});
    const legacy=LF.Storage&&LF.Storage.takeLegacyKnowledgeLibrary?LF.Storage.takeLegacyKnowledgeLibrary():null;
    if(legacy&&Array.isArray(legacy.records)&&legacy.records.length){
      const byId=new Map(local.records.map(function(r){return[r.id,r];}));legacy.records.map(normalizeRecord).forEach(function(r){byId.set(r.id,r);});local.records=Array.from(byId.values());persistLocal();
      Log.info('legacy.imported',{records:legacy.records.length});
    }else merge();
    Log.info('ready',status());return status();
  }
  async function upsert(input){
    const record=normalizeRecord(input),index=local.records.findIndex(function(item){return item.id===record.id;}),base=bundled.records.find(function(item){return item.id===record.id;});
    if(base&&!input.collection)record.collection=base.collection;
    record.updatedAt=new Date().toISOString();
    if(index>=0){record.createdAt=local.records[index].createdAt||record.createdAt;local.records[index]=record;}else{if(base)record.createdAt=base.createdAt||record.createdAt;local.records.unshift(record);}
    persistLocal();Log.info('record.saved',{id:record.id,kind:record.kind,collection:record.collection});return clone(record);
  }
  async function remove(id){
    const key=String(id),before=local.records.length;local.records=local.records.filter(function(record){return record.id!==key;});
    if(local.records.length===before)return false;
    persistLocal();Log.info('record.local-reset',{id:key});return true;
  }
  async function importLibrary(value){
    const parsed=typeof value==='string'?JSON.parse(value):value,imported=normalizeLibrary(parsed),byId=new Map(local.records.map(function(r){return[r.id,r];}));
    imported.records.forEach(function(r){byId.set(r.id,r);});local.records=Array.from(byId.values());persistLocal();return{imported:imported.records.length,total:library.records.length};
  }
  function exportLibrary(){return JSON.stringify(load(),null,2);}
  function designRelevance(record,device,design){
    if(!record||!device)return{useful:false,reason:'No selected experiment'};
    if(record.kind==='concept')return{useful:true,reason:'Scientific context for interpretation or design review'};
    if(record.kind==='material')return{useful:true,reason:'Material context for formulation or stack retrieval'};
    if(record.kind==='solution'){const linked=(design.solutions||[]).some(function(sol){return text(sol.name).toLowerCase()===text(record.name).toLowerCase()&&(device.solutionIds||[]).includes(sol.id);});return{useful:!linked,reason:linked?'Already represented in current Design':'Candidate context for a missing formulation'};}
    if(record.kind==='stack')return{useful:!(device.stack||[]).length&&record.data.layers.length>0,reason:(device.stack||[]).length?'Current Design already has a stack':record.data.layers.length?'Candidate context for a missing stack':'Record has no layers'};
    if(record.kind==='process'){const missing=['coating','annealing','atmosphere','notes'].filter(function(field){return !text(device.process&&device.process[field])&&text(record.data[field]);});return{useful:missing.length>0,reason:missing.length?'Context for missing '+missing.join(', '):'No matching Design gap'};}
    return{useful:false,reason:'LabFlow help is not scientific Design evidence'};
  }
  function search(query,options){
    options=options||{};const wanted=terms(query),allowed=new Set(Array.isArray(options.kinds)&&options.kinds.length?options.kinds:KINDS),collections=new Set(Array.isArray(options.collections)&&options.collections.length?options.collections:['science','labflow']),device=options.device||null,design=options.design||{solutions:[]},max=Math.max(1,Math.min(40,Number(options.limit)||12));
    return library.records.filter(function(record){return allowed.has(record.kind)&&collections.has(record.collection);}).map(function(record){
      const name=text(record.name).toLowerCase(),tags=(record.tags||[]).join(' ').toLowerCase(),summary=text(record.summary).toLowerCase(),data=JSON.stringify(record.data||{}).toLowerCase(),sources=(record.sources||[]).map(function(s){return[s.title,s.note,s.doi].join(' ');}).join(' ').toLowerCase(),matched=[];let score=0;
      wanted.forEach(function(term){let hit=0;if(name.includes(term))hit+=8;if(tags.includes(term))hit+=6;if(summary.includes(term))hit+=3;if(data.includes(term))hit+=2;if(sources.includes(term))hit+=1;if(hit){score+=hit;matched.push(term);}});
      if(wanted.length&&name.includes(text(query).toLowerCase()))score+=12;
      if(device){const state=designRelevance(record,device,design);if(state.useful)score+=3;}
      if(wanted.includes('stack')||wanted.includes('layer'))score+=record.kind==='stack'?5:record.kind==='material'?2:0;
      if(wanted.some(function(x){return['solution','formulation','precursor','ink','solvent'].includes(x);}))score+=record.kind==='solution'?5:record.kind==='material'?2:0;
      if(wanted.some(function(x){return['process','coating','annealing','atmosphere','spin'].includes(x);}))score+=record.kind==='process'?5:0;
      if(wanted.some(function(x){return['why','mechanism','stability','degradation','defect','recombination','migration','passivation'].includes(x);}))score+=record.kind==='concept'?5:0;
      return{record:record,score:score,matched:matched};
    }).filter(function(item){return!wanted.length||item.score>0;}).sort(function(a,b){return b.score-a.score||b.matched.length-a.matched.length||String(a.record.name).localeCompare(String(b.record.name));}).slice(0,max).map(function(item){return Object.assign(clone(item.record),{retrieval:{score:item.score,matched_terms:item.matched.slice(0,12)}});});
  }
  function context(device,design,limit,query,options){
    const fallback=[device&&device.name,device&&device.group,device&&device.sampleNames,device&&device.process,device&&device.stack,(design&&design.solutions||[]).filter(function(s){return(device&&device.solutionIds||[]).includes(s.id);})].map(function(v){return typeof v==='string'?v:JSON.stringify(v||'');}).join(' '),searchOptions=Object.assign({collections:['science']},options||{},{device:device,design:design||{solutions:[]},limit:limit}),rows=search(text(query)||fallback,searchOptions);
    return rows.map(function(record){const state=device?designRelevance(record,device,design||{solutions:[]}):{useful:false,reason:''};return{id:record.id,kind:record.kind,collection:record.collection,name:record.name,summary:record.summary,tags:record.tags,sources:record.sources,data:record.data,design_gap_relevant:state.useful,relevance_reason:state.reason,retrieval:record.retrieval};});
  }
  LF.KnowledgeBase={kinds:KINDS.slice(),emptyData:emptyData,normalizeSource:normalizeSource,normalizeRecord:normalizeRecord,normalizeLibrary:normalizeLibrary,status:status,initialize:initialize,load:load,all:all,get:get,origin:origin,upsert:upsert,remove:remove,importLibrary:importLibrary,exportLibrary:exportLibrary,designRelevance:designRelevance,search:search,context:context};
}());
