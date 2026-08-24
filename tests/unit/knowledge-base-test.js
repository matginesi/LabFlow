'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/storage.js');
require('../../assets/js/knowledge/knowledge-base.js');
const seedLibrary=require('../../knowledge-base/library.json');
function assert(ok,msg){if(!ok)throw new Error(msg||'assertion failed');}
module.exports=function(t,LF){
  LF.Storage.saveKnowledgeDirectoryHandle=async function(){return true;};
  LF.Storage.clearKnowledgeDirectoryHandle=async function(){return true;};
  function directory(initial){let content=initial==null?null:String(initial);return{name:'knowledge-base',queryPermission:async function(){return'granted';},requestPermission:async function(){return'granted';},getFileHandle:async function(name,opts){if(name!=='library.json')throw new Error('unexpected file');if(content==null&&!(opts&&opts.create)){const e=new Error('missing');e.name='NotFoundError';throw e;}if(content==null)content='';return{getFile:async function(){return{text:async function(){return content;}};},createWritable:async function(){let next='';return{write:async function(value){next=String(value);},close:async function(){content=next;},abort:async function(){}};}};},content:function(){return content;}};}
  async function connect(initial){localStorage.clear();await LF.KnowledgeBase.disconnect();const handle=directory(initial);await LF.KnowledgeBase.connectDirectory({handle:handle});return handle;}
  function experiment(){return{design:{solutions:[],devices:[{id:'dev1',name:'Reference',solutionIds:[],stack:[],process:{coating:'researcher coating',annealing:'',atmosphere:'',notes:''},status:'user_confirmed'}]},patches:[]};}
  t['Knowledge Base persists versioned reusable records in library.json']=async function(){
    const handle=await connect(),record=await LF.KnowledgeBase.upsert({kind:'solution',name:'Baseline ink',tags:'reference, perovskite',sources:[{title:'Primary paper',doi:'10.1000/example',note:'Recipe'}],data:{role:'absorber',solutes:'FAI, PbI2',solvents:'DMF:DMSO'}}),loaded=LF.KnowledgeBase.get(record.id),library=JSON.parse(handle.content());
    assert(library.version===1,'library schema version');assert(library.records.length===1,'record persisted');assert(loaded.tags.length===2,'tags normalized');assert(loaded.sources[0].doi==='10.1000/example','source provenance preserved');assert(loaded.data.solvents==='DMF:DMSO','kind data preserved');
  };
  t['Versioned starter library contains sourced records for every supported kind']=function(){
    const library=LF.KnowledgeBase.normalizeLibrary(seedLibrary),kinds=new Set(library.records.map(function(record){return record.kind;}));
    assert(library.records.length===21,'expected curated starter record count');assert(LF.KnowledgeBase.kinds.every(function(kind){return kinds.has(kind); }),'every supported record kind is represented');assert(library.records.every(function(record){return record.sources.length>0;}),'every curated record has a primary source');assert(library.records.every(function(record){return record.sources.every(function(source){return source.url&&source.doi;});}),'curated sources retain URL and DOI');
  };
  t['Process application fills only empty fields and records provenance']=async function(){
    await connect();const record=await LF.KnowledgeBase.upsert({kind:'process',name:'Reference anneal',data:{coating:'AI should not replace',annealing:'100 C · 30 min',atmosphere:'N2'}}),exp=experiment(),out=LF.KnowledgeBase.applyToDesign(exp,'dev1',record.id),dev=exp.design.devices[0];
    assert(dev.process.coating==='researcher coating','existing researcher value protected');assert(dev.process.annealing==='100 C · 30 min','missing annealing filled');assert(dev.process.atmosphere==='N2','missing atmosphere filled');assert(out.changed===2,'only changed fields counted');assert(exp.patches.length===1&&exp.patches[0].type==='design_knowledge_apply','provenance patch created');assert(exp.patches[0].source==='knowledge_base','patch source is explicit');
  };
  t['Stack application refuses to overwrite an existing device stack']=async function(){
    await connect();const record=await LF.KnowledgeBase.upsert({kind:'stack',name:'n-i-p',data:{layers:[{role:'substrate',material:'ITO'},{role:'ETL',material:'SnO2'}]}}),exp=experiment();exp.design.devices[0].stack=[{id:'existing',role:'substrate',material:'FTO',status:'user_confirmed'}];let threw=false;try{LF.KnowledgeBase.applyToDesign(exp,'dev1',record.id);}catch(err){threw=/already has layers/.test(String(err.message));}assert(threw,'existing stack is protected');assert(exp.design.devices[0].stack[0].material==='FTO','stack unchanged');
  };
  t['Solution application links one provenance-marked formulation']=async function(){
    await connect();const record=await LF.KnowledgeBase.upsert({kind:'solution',name:'Ink A',data:{role:'absorber',solutes:'FAI',solvents:'DMF'}}),exp=experiment(),out=LF.KnowledgeBase.applyToDesign(exp,'dev1',record.id),solution=exp.design.solutions[0];assert(out.changed===2,'one formulation added and linked');assert(solution.status==='knowledge_base'&&solution.knowledgeBaseId===record.id,'solution provenance');assert(exp.design.devices[0].solutionIds[0]===solution.id,'solution linked to selected device');
  };
  t['JSON import merges by stable record ID']=async function(){
    await connect();await LF.KnowledgeBase.importLibrary({version:1,records:[{id:'kb_stable',kind:'material',name:'First',data:{formula:'A'}}]});const out=await LF.KnowledgeBase.importLibrary({version:1,records:[{id:'kb_stable',kind:'material',name:'Updated',data:{formula:'B'}}]});assert(out.total===1,'stable ID merged');assert(LF.KnowledgeBase.get('kb_stable').name==='Updated','record replaced by imported version');assert(JSON.parse(LF.KnowledgeBase.exportLibrary()).version===1,'export remains versioned');
  };
  t['Legacy browser records migrate only after a folder is connected']=async function(){
    await LF.KnowledgeBase.disconnect();localStorage.setItem('labflow.design.knowledge-base',JSON.stringify({version:1,records:[{id:'kb_legacy',kind:'material',name:'Legacy material',data:{formula:'AB'}}]}));const handle=directory();await LF.KnowledgeBase.connectDirectory({handle:handle});assert(LF.KnowledgeBase.get('kb_legacy').name==='Legacy material','legacy record migrated');assert(localStorage.getItem('labflow.design.knowledge-base')===null,'legacy browser storage cleared after successful file write');assert(JSON.parse(handle.content()).records.length===1,'migrated record written to folder');
  };
};
