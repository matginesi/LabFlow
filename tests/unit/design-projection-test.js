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
  t['Design page renders the simple solution-and-stack workbench for source and manual completion']=async function(){
    const clean=await LF.Importer.parseDataset(fixture('01_PRECISO_PERFETTO_COMPLETO.zip'),'clean.zip'),ui={};LF.ExperimentModel.ensureShape(clean,ui);const additive=clean.design.devices.find(function(d){return d.group==='ADDITIVE';});
    const html=LF.DesignPage.render({experiment:clean,selectedDeviceId:additive.id,stepper:'',pageHead:function(title,sub,actions){return '<header><h1>'+title+'</h1><p>'+sub+'</p>'+actions+'</header>';}});
    assert(/id="removeSelectedDevice"/.test(html),'selected Design experiment should expose a remove control');
    assert(/FA0\.85Cs0\.15Pb/.test(html),'recovered precursor should be visible in solution chemistry');
    assert(/SnO2/.test(html)&&/Spiro-OMeTAD/.test(html),'recovered stack should be visible');
    assert(/Solutions · solvents · solutes/.test(html)&&/Layer stack/.test(html),'two simple visual editors should be visible');
    assert(/design-chem-card/.test(html)&&/design-stack-diagram/.test(html),'solution chemistry and stack should have graphical views');
    assert((html.match(/data-design-card=/g)||[]).length===clean.design.devices.length,'every experimental variant should have one navigator card');
    assert(/data-action-sequence="design-all"/.test(html)&&/Suggest all with AI/.test(html),'one global Suggest all control should exist');
    assert(/Accept all suggestions/.test(html),'global acceptance control should exist');
    assert(!/Fabrication/.test(html)&&!/Proposal confidence/.test(html)&&!/NEXT STEP/.test(html),'old complex Design workflow should be absent');

    const legacy=await LF.Importer.parseDataset(fixture('2026_01_22.zip'),'legacy.zip'),ui2={};LF.ExperimentModel.ensureShape(legacy,ui2);const selected=legacy.design.devices[0],html2=LF.DesignPage.render({experiment:legacy,selectedDeviceId:selected.id,stepper:'',pageHead:function(title,sub,actions){return '<header><h1>'+title+'</h1><p>'+sub+'</p>'+actions+'</header>';}});
    assert(/No solution chemistry yet/.test(html2)&&/No device stack yet/.test(html2),'missing Design data should stay directly editable without AI');
    assert(/design-variant-card missing/.test(html2),'incomplete experiments should be visibly marked as needing a suggestion');
    assert(!/No experiment available/.test(html2),'measurement-only Design must not look empty or broken');

    legacy.aiDesignProposals={};legacy.aiDesignProposals[selected.id]={targetDeviceId:selected.id,summary:'One suggestion',solutions:[{name:'Candidate',solutes:'FAI + PbI2',solvents:'DMF',provenance_kind:'model_inference'}],devices:[{stack:[{role:'ETL',material:'SnO2'}]}],unknowns:[]};
    const html3=LF.DesignPage.render({experiment:legacy,selectedDeviceId:selected.id,stepper:'',pageHead:function(title,sub,actions){return '<header><h1>'+title+'</h1><p>'+sub+'</p>'+actions+'</header>';}});
    assert(/Review before accepting/.test(html3)&&/Accept experiment/.test(html3),'pending AI suggestion should have one explicit per-experiment acceptance path');
    assert(/Retry AI/.test(html3)&&/Discard/.test(html3),'suggestion can be retried or discarded without changing accepted work');
  };
  t['Design source projection is idempotent and does not overwrite researcher edits on render']=async function(){
    const exp=await LF.Importer.parseDataset(fixture('01_PRECISO_PERFETTO_COMPLETO.zip'),'clean.zip'),ui={};LF.ExperimentModel.ensureShape(exp,ui);
    const dev=exp.design.devices.find(function(d){return d.group==='BASELINE';});dev.process.annealing='Researcher override';dev.status='user_confirmed';
    LF.ExperimentModel.ensureShape(exp,ui);
    assert(dev.process.annealing==='Researcher override','ordinary ensure/render must not reproject RAW over researcher state');
  };
};
