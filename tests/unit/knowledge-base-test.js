'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/core.js');
require('../../assets/js/storage.js');
require('../../assets/js/knowledge/kb-bundle.js');
require('../../assets/js/knowledge/knowledge-base.js');
module.exports=function(t,LF){
  function reset(){localStorage.removeItem('labflow.knowledge');LF.KnowledgeBase.resetCustom();}
  t['Bundled Knowledge Base is populated from the JSONL source bundle']=function(){
    const stats=LF.KnowledgeBase.stats();
    if(stats.bundled!==95)throw new Error('Expected 88 scientific and 7 documentation KB records, got '+stats.bundled);
    const guide=LF.KnowledgeBase.search('getting started LabFlow upload ZIP',{kinds:['guide'],limit:8});
    if(!guide.some(function(x){return x.id==='guide.getting-started';}))throw new Error('Generated application guide is not retrievable');
    const tokenGuide=LF.KnowledgeBase.get('guide.ai-tokens-and-rate-limits'),facts=(tokenGuide&&tokenGuide.facts||[]).join(' ');
    if(facts.includes('-->'))throw new Error('Markdown diagrams must not leak into application-guide facts');
    if(!facts.includes('actions/*/action.json'))throw new Error('Documentation code paths must remain intact in application-guide facts');
  };
  t['Knowledge drafts persist as browser-local JSONL but are excluded from AI retrieval']=function(){
    reset();const item=LF.KnowledgeBase.save({kind:'material',title:'Tin oxide',summary:'Electron-selective material.',status:'draft',tags:'SnO2, ETL'});
    if(!LF.KnowledgeBase.get(item.id))throw new Error('Draft did not persist');
    if(LF.KnowledgeBase.search('SnO2',{limit:8}).some(function(x){return x.id===item.id;}))throw new Error('Draft leaked into AI retrieval');
    const raw=localStorage.getItem('labflow.knowledge')||'';
    if(!raw.trim()||raw.trim().startsWith('{"schemaVersion"'))throw new Error('Knowledge localStorage must be JSONL records, not the old wrapper object');
    const rows=raw.trim().split(/\r?\n/).map(JSON.parse);
    if(rows.length!==1||rows[0].id!==item.id)throw new Error('Browser-local JSONL did not preserve the saved entry');
  };
  t['Active knowledge requires a traceable source']=function(){reset();let threw=false;try{LF.KnowledgeBase.save({kind:'concept',title:'Fill factor',summary:'A photovoltaic performance metric.',status:'active'});}catch(err){threw=/source/i.test(String(err.message));}if(!threw)throw new Error('Unsourced active knowledge must fail closed');};
  t['Active sourced knowledge is searchable and assistant markers resolve only real ids']=function(){reset();const item=LF.KnowledgeBase.save({id:'concept.test-fill-factor',kind:'concept',title:'Test fill factor reference',aliases:'TESTFF',tags:'JV_TEST, photovoltaic',summary:'A photovoltaic performance metric used only by this regression test.',facts:['Used with Voc and Jsc when discussing device performance.'],status:'active',sources:[{title:'Reference paper',doi:'10.1234/example.1',year:2024,authors:'A. Author'}]});const found=LF.KnowledgeBase.search('TESTFF JV_TEST',{limit:8});if(!found.some(function(x){return x.id===item.id;}))throw new Error('Active knowledge was not retrieved');const refs=LF.KnowledgeBase.referencesFromText('Relevant statement [KB:concept.test-fill-factor]. Fake [KB:not-real].');if(refs.length!==1||refs[0].id!==item.id)throw new Error('KB citation resolution is not fail-closed');};
  t['Knowledge JSONL import export preserves custom entries and validates sources']=function(){
    reset();LF.KnowledgeBase.save({id:'process.spin',kind:'process',title:'Spin coating',summary:'A solution deposition process.',status:'active',sources:[{title:'Process reference',citation:'Book chapter 4'}]});
    const exported=LF.KnowledgeBase.exportJsonl('custom');
    if(exported.trim().split(/\r?\n/).length!==1)throw new Error('Expected one JSONL record');
    if(JSON.parse(exported.trim()).id!=='process.spin')throw new Error('Exported JSONL record mismatch');
    LF.KnowledgeBase.resetCustom();const out=LF.KnowledgeBase.importJsonl(exported,'merge');
    if(out.imported!==1)throw new Error('Expected one imported entry');if(!LF.KnowledgeBase.get('process.spin'))throw new Error('Imported entry missing');
  };
  t['Knowledge JSONL import reports the failing line']=function(){
    reset();let threw=false;try{LF.KnowledgeBase.importJsonl('{"id":"ok"}\nnot-json\n','merge');}catch(err){threw=/line 2/i.test(String(err.message));}if(!threw)throw new Error('Malformed JSONL must report its line number');
  };

  t['Knowledge JSONL import is bounded and skips bundled ids instead of shadowing them']=function(){
    reset();
    const bundled=LF.KnowledgeBase.get('concept.pce');if(!bundled)throw new Error('Bundled reference missing');
    const row=JSON.stringify({id:'concept.pce',kind:'concept',title:'Attempted replacement',summary:'Must not shadow built-in.',status:'draft'});
    const out=LF.KnowledgeBase.importJsonl(row,'merge');
    if(out.imported!==0||out.skippedBuiltIn!==1)throw new Error('Bundled id must be skipped');
    if(LF.KnowledgeBase.get('concept.pce').title!=='Power conversion efficiency')throw new Error('Bundled reference was shadowed');
  };
  t['Knowledge JSONL rejects duplicate explicit ids in one file']=function(){
    reset();const row=JSON.stringify({id:'concept.dupe',kind:'concept',title:'Duplicate',summary:'Draft.',status:'draft'});let threw=false;
    try{LF.KnowledgeBase.importJsonl(row+'\n'+row+'\n','merge');}catch(err){threw=/duplicate/i.test(String(err.message));}
    if(!threw)throw new Error('Duplicate explicit JSONL ids must fail closed');
  };
};
