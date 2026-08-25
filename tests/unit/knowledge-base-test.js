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
  t['Knowledge Base persists versioned reusable records in library.json']=async function(){
    const handle=await connect(),record=await LF.KnowledgeBase.upsert({kind:'solution',name:'Baseline ink',tags:'reference, perovskite',sources:[{title:'Primary paper',doi:'10.1000/example',note:'Recipe'}],data:{role:'absorber',solutes:'FAI, PbI2',solvents:'DMF:DMSO'}}),loaded=LF.KnowledgeBase.get(record.id),library=JSON.parse(handle.content());
    assert(library.version===1,'library schema version');assert(library.records.length===1,'record persisted');assert(loaded.tags.length===2,'tags normalized');assert(loaded.sources[0].doi==='10.1000/example','source provenance preserved');assert(loaded.data.solvents==='DMF:DMSO','kind data preserved');
  };
  t['Versioned starter library contains sourced records for every supported kind']=function(){
    const library=LF.KnowledgeBase.normalizeLibrary(seedLibrary),kinds=new Set(library.records.map(function(record){return record.kind;}));
    assert(library.records.length===34,'expected expanded curated starter record count');assert(LF.KnowledgeBase.kinds.every(function(kind){return kinds.has(kind); }),'every supported record kind is represented');assert(library.records.every(function(record){return record.sources.length>0;}),'every curated record has a primary source');assert(library.records.every(function(record){return record.sources.every(function(source){return source.url&&source.doi;});}),'curated sources retain URL and DOI');
  };
  t['Knowledge retrieval ranks matching records and retains source metadata']=async function(){
    await connect(JSON.stringify(seedLibrary));const rows=LF.KnowledgeBase.search('inverted 2PACz C60 BCP silver stack',{limit:5});
    assert(rows.length>0,'retrieval returned records');assert(rows[0].id==='kb_stack_inverted_2pacz_c60_bcp_ag','matching stack ranked first');assert(rows[0].retrieval.score>0,'score exposed');assert(rows[0].sources[0].doi==='10.1038/s41467-025-56409-5','source retained');
  };
  t['Knowledge Base exposes retrieval only and never a direct Design mutation API']=function(){
    assert(typeof LF.KnowledgeBase.search==='function'&&typeof LF.KnowledgeBase.context==='function','RAG retrieval APIs are exposed');
    assert(LF.KnowledgeBase.applyToDesign===undefined,'direct Knowledge Base to Design mutation must not exist');
  };
  t['JSON import merges by stable record ID']=async function(){
    await connect();await LF.KnowledgeBase.importLibrary({version:1,records:[{id:'kb_stable',kind:'material',name:'First',data:{formula:'A'}}]});const out=await LF.KnowledgeBase.importLibrary({version:1,records:[{id:'kb_stable',kind:'material',name:'Updated',data:{formula:'B'}}]});assert(out.total===1,'stable ID merged');assert(LF.KnowledgeBase.get('kb_stable').name==='Updated','record replaced by imported version');assert(JSON.parse(LF.KnowledgeBase.exportLibrary()).version===1,'export remains versioned');
  };
  t['Legacy browser records migrate only after a folder is connected']=async function(){
    await LF.KnowledgeBase.disconnect();localStorage.setItem('labflow.design.knowledge-base',JSON.stringify({version:1,records:[{id:'kb_legacy',kind:'material',name:'Legacy material',data:{formula:'AB'}}]}));const handle=directory();await LF.KnowledgeBase.connectDirectory({handle:handle});assert(LF.KnowledgeBase.get('kb_legacy').name==='Legacy material','legacy record migrated');assert(localStorage.getItem('labflow.design.knowledge-base')===null,'legacy browser storage cleared after successful file write');assert(JSON.parse(handle.content()).records.length===1,'migrated record written to folder');
  };
};
