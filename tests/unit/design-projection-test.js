'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/ai/prompt-bundle.js');
require('../../assets/js/experiment/data-model.js');
require('../../assets/js/data/parser.js');
require('../../assets/js/experiment/canonical-store.js');
require('../../assets/js/data/importer.js');
require('../../assets/js/experiment/model.js');
require('../../assets/js/ai/action-steps.js');
LabFlow.PageShell=LabFlow.PageShell||{badge:function(label,type){return '<span class=\"badge '+(type||'')+'\">'+label+'</span>';}};
LabFlow.PageContext=LabFlow.PageContext||{publish:function(){}};
require('../../assets/js/pages/design-page.js');
const fs=require('fs'),path=require('path');
function assert(ok,msg){if(!ok)throw new Error(msg||'assertion failed');}
module.exports=function(t,LF,env){
  function fixture(name){const b=fs.readFileSync(path.join(env.root,'TEST_DATA',name));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}
  t['Design projects explicit RAW recipe metadata into grouped experimental variants']=async function(){
    const exp=await LF.Importer.parseDataset(fixture('01_PRECISO_PERFETTO_COMPLETO.zip'),'clean.zip'),ui={};
    LF.ExperimentModel.ensureShape(exp,ui);
    assert(exp.design.evidenceSummary&&exp.design.evidenceSummary.sourceAvailable,'source design should be detected');
    assert(exp.design.devices.length===3,'replicates should collapse into three source-backed variants');
    const additive=exp.design.devices.find(function(d){return d.group==='ADDITIVE';});
    assert(additive&&additive.sampleNames.length===2,'ADDITIVE variant should contain both replicates');
    assert(additive.stack.length===7,'device stack should be recovered from source note');
    assert(additive.process.coating.indexOf('5000 rpm')>=0,'coating should be recovered');
    assert(additive.process.annealing.indexOf('100 C')>=0,'annealing should be recovered');
    assert(additive.process.atmosphere.indexOf('nitrogen')>=0,'atmosphere should be recovered');
    const linked=exp.design.solutions.filter(function(s){return additive.solutionIds.includes(s.id);});
    assert(linked.some(function(s){return /FA0\.85Cs0\.15/.test(s.solutes)&&s.solvents==='DMF:DMSO 4:1'&&s.concentration==='1.30 M';}),'precursor formulation should be parsed');
    assert(linked.some(function(s){return s.role==='passivation'&&s.solutes==='PEAI'&&s.solvents==='IPA';}),'passivation solution should be parsed');
    LF.CanonicalStore.build(exp);const analysis=LF.DesignAnalysis.build(exp,0);
    assert(analysis.summary.unresolvedSamples===0,'source-complete fixture should not report fake missing Design fields');
  };
  t['Design keeps measurement-only datasets useful without inventing source recipes']=async function(){
    const exp=await LF.Importer.parseDataset(fixture('2026_01_22.zip'),'legacy.zip'),ui={};
    LF.ExperimentModel.ensureShape(exp,ui);LF.CanonicalStore.build(exp);const analysis=LF.DesignAnalysis.build(exp,0);
    assert(exp.design.devices.length>0,'sample structure should still create experimental variants');
    assert(!exp.design.evidenceSummary.sourceAvailable,'SMU notes must not be mistaken for design recipes');
    assert(analysis.summary.unresolvedSamples>0,'missing recipe fields should stay explicitly unresolved');
    const selected=exp.design.devices[0],pack=LF.ContextBuilder?LF.ContextBuilder.pack('design',{exp:exp,params:{deviceId:selected.id}}):null;
    if(pack){assert(pack.design_evidence_summary.raw_design_evidence_found===false,'context must label absence of RAW design evidence');assert(Number(pack.design_evidence_summary.knowledge_records_found||0)>=0,'optional Knowledge Base result count is explicit');assert(['science_library','model_inference_only'].includes(pack.design_evidence_summary.knowledge_source),'simple knowledge source mode is explicit');}
  };
  t['Design page renders recovered source facts and a useful no-recipe state']=async function(){
    const clean=await LF.Importer.parseDataset(fixture('01_PRECISO_PERFETTO_COMPLETO.zip'),'clean.zip'),ui={};LF.ExperimentModel.ensureShape(clean,ui);const additive=clean.design.devices.find(function(d){return d.group==='ADDITIVE';});
    const html=LF.DesignPage.render({experiment:clean,selectedDeviceId:additive.id,stepper:'',pageHead:function(title,sub,actions){return '<header><h1>'+title+'</h1><p>'+sub+'</p>'+actions+'</header>';}});
    assert(/id=\"removeSelectedDevice\"/.test(html),'selected Design variant should expose a remove control');
    assert(/FA0\.85Cs0\.15Pb/.test(html),'recovered precursor should be visible in Design page');assert(/100 C 30 min/.test(html),'recovered annealing should be visible');assert(/SnO2/.test(html)&&/Spiro-OMeTAD/.test(html),'recovered stack should be visible');assert(/Design complete/.test(html),'complete source design should not ask AI to fill fake gaps');
    assert((html.match(/data-design-card=/g)||[]).length===clean.design.devices.length,'every experimental variant should have a coverage card');assert(/Choose one variant/.test(html),'variant chooser missing');assert(/data-action-sequence="design-all"/.test(html),'batched Fill all experiments control should be available when any variant is incomplete');assert(/Design complete/.test(html),'complete selected variant should report completion instead of offering redundant AI');
    const legacy=await LF.Importer.parseDataset(fixture('2026_01_22.zip'),'legacy.zip'),ui2={};LF.ExperimentModel.ensureShape(legacy,ui2);const selected=legacy.design.devices[0],html2=LF.DesignPage.render({experiment:legacy,selectedDeviceId:selected.id,stepper:'',pageHead:function(title,sub,actions){return '<header><h1>'+title+'</h1><p>'+sub+'</p>'+actions+'</header>';}});
    assert(/No recipe in source/.test(html2),'measurement-only source should be explained explicitly');assert(/Complete selected with AI/.test(html2),'AI completion should remain available for unresolved fields');assert(!/No experiment available/.test(html2),'measurement-only Design must not look empty/broken');
    assert(/design-variant-card missing/.test(html2),'incomplete variants should be visually tracked as missing');assert(/NEXT STEP/.test(html2)&&/required gap/.test(html2),'Design should tell the user what to do next');
    legacy.aiDesignProposals={};legacy.aiDesignProposals[selected.id]={targetDeviceId:selected.id,summary:'One uncertain suggestion',applicationSummary:{review_count:1,auto_applied_count:0,unresolved_count:0},solutions:[{name:'Candidate',applied:false,provenance_kind:'model_inference',confidence:0.6}],devices:[],unknowns:[]};const html3=LF.DesignPage.render({experiment:legacy,selectedDeviceId:selected.id,stepper:'',pageHead:function(title,sub,actions){return '<header><h1>'+title+'</h1><p>'+sub+'</p>'+actions+'</header>';}});assert(/Review suggestions below/.test(html3),'pending proposal should direct the user to review instead of encouraging another AI call');assert(/Review the panel directly below/.test(html3),'pending review guidance should be explicit');
  };
  t['Design source projection is idempotent and does not overwrite researcher edits on render']=async function(){
    const exp=await LF.Importer.parseDataset(fixture('01_PRECISO_PERFETTO_COMPLETO.zip'),'clean.zip'),ui={};LF.ExperimentModel.ensureShape(exp,ui);
    const dev=exp.design.devices.find(function(d){return d.group==='BASELINE';});dev.process.annealing='Researcher override';dev.status='user_confirmed';
    LF.ExperimentModel.ensureShape(exp,ui);
    assert(dev.process.annealing==='Researcher override','ordinary ensure/render must not reproject RAW over researcher state');
  };
};
