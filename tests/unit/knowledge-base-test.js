'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/storage.js');
require('../../assets/js/knowledge/knowledge-base.js');
function assert(ok,msg){if(!ok)throw new Error(msg||'assertion failed');}
module.exports=function(t,LF){
  function experiment(){return{design:{solutions:[],devices:[{id:'dev1',name:'Reference',solutionIds:[],stack:[],process:{coating:'researcher coating',annealing:'',atmosphere:'',notes:''},status:'user_confirmed'}]},patches:[]};}
  t['Knowledge Base persists versioned reusable records separately']=function(){
    localStorage.clear();
    const record=LF.KnowledgeBase.upsert({kind:'solution',name:'Baseline ink',tags:'reference, perovskite',data:{role:'absorber',solutes:'FAI, PbI2',solvents:'DMF:DMSO'}}),loaded=LF.KnowledgeBase.get(record.id),library=LF.Storage.getKnowledgeBase();
    assert(library.version===1,'library schema version');assert(library.records.length===1,'record persisted');assert(loaded.tags.length===2,'tags normalized');assert(loaded.data.solvents==='DMF:DMSO','kind data preserved');
  };
  t['Process application fills only empty fields and records provenance']=function(){
    localStorage.clear();const record=LF.KnowledgeBase.upsert({kind:'process',name:'Reference anneal',data:{coating:'AI should not replace',annealing:'100 C · 30 min',atmosphere:'N2'}}),exp=experiment(),out=LF.KnowledgeBase.applyToDesign(exp,'dev1',record.id),dev=exp.design.devices[0];
    assert(dev.process.coating==='researcher coating','existing researcher value protected');assert(dev.process.annealing==='100 C · 30 min','missing annealing filled');assert(dev.process.atmosphere==='N2','missing atmosphere filled');assert(out.changed===2,'only changed fields counted');assert(exp.patches.length===1&&exp.patches[0].type==='design_knowledge_apply','provenance patch created');assert(exp.patches[0].source==='knowledge_base','patch source is explicit');
  };
  t['Stack application refuses to overwrite an existing device stack']=function(){
    localStorage.clear();const record=LF.KnowledgeBase.upsert({kind:'stack',name:'n-i-p',data:{layers:[{role:'substrate',material:'ITO'},{role:'ETL',material:'SnO2'}]}}),exp=experiment();exp.design.devices[0].stack=[{id:'existing',role:'substrate',material:'FTO',status:'user_confirmed'}];let threw=false;try{LF.KnowledgeBase.applyToDesign(exp,'dev1',record.id);}catch(err){threw=/already has layers/.test(String(err.message));}assert(threw,'existing stack is protected');assert(exp.design.devices[0].stack[0].material==='FTO','stack unchanged');
  };
  t['Solution application links one provenance-marked formulation']=function(){
    localStorage.clear();const record=LF.KnowledgeBase.upsert({kind:'solution',name:'Ink A',data:{role:'absorber',solutes:'FAI',solvents:'DMF'}}),exp=experiment(),out=LF.KnowledgeBase.applyToDesign(exp,'dev1',record.id),solution=exp.design.solutions[0];assert(out.changed===2,'one formulation added and linked');assert(solution.status==='knowledge_base'&&solution.knowledgeBaseId===record.id,'solution provenance');assert(exp.design.devices[0].solutionIds[0]===solution.id,'solution linked to selected device');
  };
  t['JSON import merges by stable record ID']=function(){
    localStorage.clear();LF.KnowledgeBase.importLibrary({version:1,records:[{id:'kb_stable',kind:'material',name:'First',data:{formula:'A'}}]});const out=LF.KnowledgeBase.importLibrary({version:1,records:[{id:'kb_stable',kind:'material',name:'Updated',data:{formula:'B'}}]});assert(out.total===1,'stable ID merged');assert(LF.KnowledgeBase.get('kb_stable').name==='Updated','record replaced by imported version');assert(JSON.parse(LF.KnowledgeBase.exportLibrary()).version===1,'export remains versioned');
  };
};
