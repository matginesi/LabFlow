'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/storage.js');
require('../../assets/js/knowledge/knowledge-base.js');
const science=require('../../knowledge-base/science.json');
const labflow=require('../../knowledge-base/labflow.json');
function assert(ok,msg){if(!ok)throw new Error(msg||'assertion failed');}
module.exports=function(t,LF){
  const seed={version:1,records:[].concat(science.records||[],labflow.records||[])};
  async function reset(){localStorage.clear();LF.KnowledgeSeed=seed;return LF.KnowledgeBase.initialize();}

  t['Knowledge Base starts ready from bundled records with no setup']=async function(){
    const info=await reset(),rows=LF.KnowledgeBase.search('inverted 2PACz C60 BCP silver stack',{collections:['science'],limit:5});
    assert(info.available===true&&info.active===true,'bundled library should be ready immediately');
    assert(info.records===55&&info.scienceRecords===46&&info.labflowRecords===9,'science/help collections counted');
    assert(info.storage==='bundled + browser overrides','simple storage model exposed');
    assert(rows.length>0&&rows[0].id==='kb_stack_inverted_2pacz_c60_bcp_ag','scientific search works without setup');
  };

  t['Knowledge Base has no directory sync or retrieval toggle API']=async function(){
    await reset();
    ['setEnabled','connectDirectory','refresh','disconnect'].forEach(function(name){assert(LF.KnowledgeBase[name]===undefined,name+' must not exist');});
    assert(LF.KnowledgeBase.status().active===true,'bundled lookup remains available');
  };

  t['Local records persist as small browser overrides']=async function(){
    await reset();
    const record=await LF.KnowledgeBase.upsert({kind:'material',collection:'science',name:'Internal material',data:{formula:'AB'}});
    const saved=JSON.parse(localStorage.getItem('labflow.knowledge.local'));
    assert(LF.KnowledgeBase.get(record.id).name==='Internal material','record available immediately');
    assert(saved.records.some(function(item){return item.id===record.id;}),'local record persisted as browser override');
    assert(LF.KnowledgeBase.origin(record.id).custom===true,'custom origin exposed');
  };

  t['Editing a bundled record creates a resettable local override']=async function(){
    await reset();
    const id='kb_labflow_workflow_overview',original=LF.KnowledgeBase.get(id).name;
    await LF.KnowledgeBase.upsert(Object.assign({},LF.KnowledgeBase.get(id),{name:'Locally edited workflow'}));
    assert(LF.KnowledgeBase.get(id).name==='Locally edited workflow','local edit wins by stable ID');
    assert(LF.KnowledgeBase.origin(id).overridden===true,'bundled override is explicit');
    await LF.KnowledgeBase.remove(id);
    assert(LF.KnowledgeBase.get(id).name===original,'reset restores bundled record');
    assert(LF.KnowledgeBase.origin(id).overridden===false,'override removed');
  };

  t['Bundled scientific records are sourced and every supported kind is represented']=async function(){
    await reset();
    const rows=LF.KnowledgeBase.all(),kinds=new Set(rows.map(function(record){return record.kind;})),scienceRows=rows.filter(function(record){return record.collection==='science';});
    assert(LF.KnowledgeBase.kinds.every(function(kind){return kinds.has(kind); }),'every supported kind represented');
    assert(scienceRows.every(function(record){return record.sources.length>0&&record.sources.some(function(source){return !!source.doi;});}),'scientific records carry bibliographic provenance');
  };

  t['Scientific retrieval ranks matches and retains source metadata']=async function(){
    await reset();
    const rows=LF.KnowledgeBase.search('inverted 2PACz C60 BCP silver stack',{collections:['science'],limit:5});
    assert(rows.length>0,'retrieval returned records');
    assert(rows[0].id==='kb_stack_inverted_2pacz_c60_bcp_ag','matching stack ranked first');
    assert(rows[0].retrieval.score>0,'score exposed');
    assert(rows[0].sources[0].doi==='10.1038/s41467-025-56409-5','source retained');
  };

  t['Assistant can retrieve LabFlow help separately from scientific knowledge']=async function(){
    await reset();
    const rows=LF.KnowledgeBase.search('How does LabFlow Save the Working Copy and export the original ZIP?',{collections:['labflow'],kinds:['guide'],limit:3});
    assert(rows.length>0&&rows[0].id==='kb_labflow_working_copy_save_export','LabFlow help guide ranked first');
    assert(rows[0].collection==='labflow','help collection remains explicit');
  };

  t['Knowledge Base exposes lookup only and never direct Design mutation']=async function(){
    await reset();
    assert(typeof LF.KnowledgeBase.search==='function'&&typeof LF.KnowledgeBase.context==='function','lookup APIs exposed');
    assert(LF.KnowledgeBase.applyToDesign===undefined,'Knowledge Base cannot mutate Design directly');
  };

  t['JSON import merges by stable ID and export remains versioned']=async function(){
    await reset();
    await LF.KnowledgeBase.importLibrary({version:1,records:[{id:'kb_stable',kind:'material',collection:'science',name:'First',data:{formula:'A'}}]});
    const out=await LF.KnowledgeBase.importLibrary({version:1,records:[{id:'kb_stable',kind:'material',collection:'science',name:'Updated',data:{formula:'B'}}]});
    assert(out.total>=51,'import merges into bundled library');
    assert(LF.KnowledgeBase.get('kb_stable').name==='Updated','stable ID replaced by imported version');
    assert(JSON.parse(LF.KnowledgeBase.exportLibrary()).version===1,'export remains versioned');
  };

  t['Legacy localStorage records migrate once into browser overrides']=async function(){
    localStorage.clear();LF.KnowledgeSeed=seed;
    localStorage.setItem('labflow.design.knowledge-base',JSON.stringify({version:1,records:[{id:'kb_legacy',kind:'material',collection:'science',name:'Legacy material',data:{formula:'AB'}}]}));
    await LF.KnowledgeBase.initialize();
    assert(LF.KnowledgeBase.get('kb_legacy').name==='Legacy material','legacy record migrated');
    assert(localStorage.getItem('labflow.design.knowledge-base')===null,'legacy key removed after migration');
    const saved=JSON.parse(localStorage.getItem('labflow.knowledge.local'));
    assert(saved.records.some(function(item){return item.id==='kb_legacy';}),'migrated record stored as local override');
  };

  t['Concept records support mechanism-oriented scientific searches']=async function(){
    await reset();
    const rows=LF.KnowledgeBase.search('ion migration degradation stability',{collections:['science'],kinds:['concept'],limit:4});
    assert(rows.length>0&&rows[0].id==='kb_concept_ion_migration','mechanism concept is retrievable');
  };
};
