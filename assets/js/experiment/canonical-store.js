(function(){
  'use strict';
  const LF=window.LabFlow=window.LabFlow||{};
  const C=LF.Core||{};
  const cache=new WeakMap();

  function clean(v){return String(v==null?'':v).trim();}
  function norm(v){return clean(v).toLowerCase().replace(/\\/g,'/').replace(/[^a-z0-9]+/g,' ').trim();}
  function compact(value,max){
    if(value==null||typeof value==='number'||typeof value==='boolean')return value;
    if(typeof value==='string'){const s=String(value);return s.length>(max||420)?s.slice(0,max||420)+'…':s;}
    if(Array.isArray(value))return value.slice(0,24).map(function(x){return compact(x,max);});
    if(typeof value==='object'){const out={};Object.keys(value).slice(0,28).forEach(function(k){if(/^(rawText|content|data|rows|curve|curves|points)$/i.test(k))return;out[k]=compact(value[k],max);});return out;}
    return String(value);
  }
  function pathOf(x){return clean(x&&((x.path)||(x.file&&x.file.path)||(x.source&&x.source.path)||x.file||x.source));}
  function evidenceSummary(x){
    if(x==null)return'';
    if(typeof x==='string')return compact(x,360);
    const preferred=['fact','summary','label','title','detail','kind','type','format','sample','direction','value','reason'];
    const parts=[];preferred.forEach(function(k){if(x[k]!=null&&x[k]!==''&&parts.length<5)parts.push(k+': '+compact(x[k],180));});
    return parts.length?parts.join(' · '):compact(JSON.stringify(compact(x,160)),360);
  }
  function inferEntityIds(exp,value){
    const hay=norm(typeof value==='string'?value:JSON.stringify(compact(value,220))),ids=[];
    if(!hay)return ids;
    (exp.samples||[]).forEach(function(s){const aliases=[s.name,s.rawName].concat(s.aliases||[]).map(norm).filter(function(x){return x.length>1;});if(aliases.some(function(a){return hay.indexOf(a)>=0;}))ids.push(s.id);});
    return Array.from(new Set(ids));
  }
  function fileByPath(exp,path){const n=norm(path),base=norm(clean(path).replace(/\\/g,'/').split('/').pop());return(exp.files||[]).find(function(f){return norm(f.path)===n||(base&&norm(f.name)===base);})||null;}
  function addEvidence(out,item){if(!item||!item.id)return;if(!out.some(function(x){return x.id===item.id;}))out.push(item);}
  function buildEvidence(exp){
    const out=[];
    (exp.files||[]).forEach(function(f){addEvidence(out,{id:'ev:file:'+f.id,type:'file',source_id:f.id,source_path:f.path||f.name||'',entity_ids:inferEntityIds(exp,f.path||f.name||''),fact:'source file',summary:[f.family||f.type||'unknown',f.path||f.name||''].filter(Boolean).join(' · '),locator:{path:f.path||f.name||''}});});
    (exp.rawFormatEvidence||[]).forEach(function(x,i){const path=pathOf(x),f=fileByPath(exp,path);addEvidence(out,{id:'ev:format:'+i,type:'format',source_id:f&&f.id||'',source_path:path,entity_ids:inferEntityIds(exp,x),fact:'format evidence',summary:evidenceSummary(x),locator:path?{path:path}:null});});
    (exp.auxiliaryEvidence||[]).forEach(function(x,i){const path=pathOf(x),f=fileByPath(exp,path);addEvidence(out,{id:'ev:aux:'+i,type:'auxiliary',source_id:f&&f.id||'',source_path:path,entity_ids:inferEntityIds(exp,x),fact:'auxiliary evidence',summary:evidenceSummary(x),locator:path?{path:path}:null});});
    (exp.findings||[]).forEach(function(f){(f.evidence||[]).forEach(function(ev,i){addEvidence(out,{id:'ev:finding:'+String(f.id||i)+':'+i,type:'finding',source_id:String(f.id||''),source_path:'',entity_ids:inferEntityIds(exp,[f.target,ev]),fact:f.title||f.type||'finding evidence',summary:compact(ev,360),locator:{finding_id:String(f.id||'')}});});});
    return out;
  }
  function buildRelations(exp,evidence){
    const out=[],seen=new Set();
    function add(type,from,to,meta){if(!from||!to)return;const key=type+'|'+from+'|'+to;if(seen.has(key))return;seen.add(key);out.push({id:'rel:'+out.length,type:type,from:from,to:to,meta:meta||{}});}
    const samples=exp.samples||[],files=exp.files||[],measurements=exp.measurements||[];
    const sampleByName=new Map();samples.forEach(function(s){[s.name,s.rawName].concat(s.aliases||[]).map(norm).filter(Boolean).forEach(function(a){sampleByName.set(a,s);});});
    measurements.forEach(function(m){const sample=sampleByName.get(norm(m.sample))||sampleByName.get(norm(m.rawSample));if(sample)add('sample_measurement',sample.id,m.id);const f=fileByPath(exp,m.path||m.file);if(f)add('measurement_file',m.id,f.id);if(sample&&f)add('sample_file',sample.id,f.id);});
    evidence.forEach(function(ev){(ev.entity_ids||[]).forEach(function(id){add('entity_evidence',id,ev.id);});if(ev.source_id)add('file_evidence',ev.source_id,ev.id);});
    (exp.design&&exp.design.devices||[]).forEach(function(d){(d.sampleNames||[]).forEach(function(name){const s=sampleByName.get(norm(name));if(s)add('sample_design',s.id,d.id);});});
    return out;
  }
  function buildAliases(exp){
    return(exp.samples||[]).map(function(s){const values=[s.name,s.rawName].concat(s.aliases||[]);(exp.measurements||[]).forEach(function(m){if(norm(m.sample)===norm(s.name)){if(m.rawSample)values.push(m.rawSample);(m.sampleAliases||[]).forEach(function(a){values.push(a);});}});const aliases=Array.from(new Set(values.map(clean).filter(Boolean)));s.aliases=aliases.slice();return{entity_id:s.id,kind:'sample',canonical:s.name||'',aliases:aliases};});
  }
  function indexes(exp,evidence,relations){
    const idx={byId:new Map(),evidenceByEntity:new Map(),relationsByNode:new Map(),sampleByAlias:new Map()};
    (exp.files||[]).concat(exp.samples||[],exp.measurements||[],exp.findings||[],exp.design&&exp.design.devices||[]).forEach(function(x){if(x&&x.id)idx.byId.set(String(x.id),x);});
    evidence.forEach(function(ev){idx.byId.set(ev.id,ev);(ev.entity_ids||[]).forEach(function(id){if(!idx.evidenceByEntity.has(id))idx.evidenceByEntity.set(id,[]);idx.evidenceByEntity.get(id).push(ev);});});
    relations.forEach(function(r){[r.from,r.to].forEach(function(id){if(!idx.relationsByNode.has(id))idx.relationsByNode.set(id,[]);idx.relationsByNode.get(id).push(r);});});
    (exp.samples||[]).forEach(function(s){(s.aliases||[s.name]).forEach(function(a){idx.sampleByAlias.set(norm(a),s);});});
    return idx;
  }
  function build(exp){
    if(!exp||typeof exp!=='object')return null;
    const aliases=buildAliases(exp),evidence=buildEvidence(exp),relations=buildRelations(exp,evidence),revision=Number(exp.sync&&exp.sync.revision||0);
    const store={version:1,revision:revision,generatedAt:new Date().toISOString(),experiment:{id:exp.id||'',name:exp.meta&&exp.meta.name||'',sourceName:exp.meta&&exp.meta.sourceName||''},files:exp.files||[],samples:exp.samples||[],measurements:exp.measurements||[],findings:exp.findings||[],patches:exp.patches||[],design:exp.design||{},evidence:evidence,relations:relations,aliases:aliases};
    exp.canonical=store;cache.set(exp,{revision:revision,store:store,index:indexes(exp,evidence,relations)});return store;
  }
  function ensure(exp){const hit=cache.get(exp),rev=Number(exp&&exp.sync&&exp.sync.revision||0);if(hit&&hit.revision===rev&&exp.canonical===hit.store)return hit.store;return build(exp);}
  function index(exp){ensure(exp);return(cache.get(exp)||{}).index||null;}
  function summary(exp){const s=ensure(exp)||{};return{revision:s.revision||0,files:(s.files||[]).length,samples:(s.samples||[]).length,measurements:(s.measurements||[]).length,findings:(s.findings||[]).filter(function(f){return f.status!=='resolved';}).length,evidence:(s.evidence||[]).length,relations:(s.relations||[]).length,aliases:(s.aliases||[]).reduce(function(n,x){return n+(x.aliases||[]).length;},0)};}
  function entity(exp,id){const idx=index(exp);return idx&&idx.byId.get(String(id))||null;}
  function sample(exp,nameOrId){const idx=index(exp);return entity(exp,nameOrId)||(idx&&idx.sampleByAlias.get(norm(nameOrId)))||null;}
  function related(exp,id,type){const idx=index(exp);const list=idx&&idx.relationsByNode.get(String(id))||[];return type?list.filter(function(r){return r.type===type;}):list.slice();}
  function evidence(exp,opts){opts=opts||{};const store=ensure(exp),ids=new Set((opts.entity_ids||opts.entityIds||[]).map(String)),types=new Set((opts.types||[]).map(String)),terms=(opts.terms||[]).map(norm).filter(Boolean),limit=Math.max(1,Number(opts.limit)||20);let rows=(store&&store.evidence||[]).filter(function(ev){if(ids.size&&!Array.from(ids).some(function(id){return(ev.entity_ids||[]).includes(id)||ev.source_id===id;}))return false;if(types.size&&!types.has(ev.type))return false;if(terms.length){const hay=norm([ev.fact,ev.summary,ev.source_path].join(' '));if(!terms.some(function(t){return hay.indexOf(t)>=0;}))return false;}return true;});return rows.slice(0,limit);}
  function matchTerms(exp,text,limit){const terms=norm(text).split(' ').filter(function(x){return x.length>=3;}),store=ensure(exp),out=[];if(!terms.length)return out;(store.samples||[]).forEach(function(s){const hay=norm([s.name,s.rawName,s.group,(s.aliases||[]).join(' ')].join(' '));if(terms.some(function(t){return hay.indexOf(t)>=0;}))out.push({kind:'sample',id:s.id,name:s.name,group:s.group||''});});return out.slice(0,limit||12);}
  LF.CanonicalStore={build:build,ensure:ensure,summary:summary,entity:entity,sample:sample,related:related,evidence:evidence,matchTerms:matchTerms,compact:compact};
}());
