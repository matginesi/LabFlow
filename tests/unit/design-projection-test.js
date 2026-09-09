'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/ai/prompt-bundle.js');
require('../../assets/js/experiment/data-model.js');
require('../../assets/js/data/parser.js');
require('../../assets/js/experiment/canonical-store.js');
require('../../assets/js/data/importer.js');
require('../../assets/js/experiment/design-model.js');
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
    LF.DesignModel.ensure(exp,ui);
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
    const exp=await LF.Importer.parseDataset(fixture('2026_01_22.zip'),'dataset.zip'),ui={};
    LF.DesignModel.ensure(exp,ui);LF.CanonicalStore.build(exp);const analysis=LF.DesignAnalysis.build(exp,0);
    assert(exp.design.devices.length===5,'measurement-only fixture should expose five logical experiments, not one Design card per result/sample');
    assert(exp.design.devices.map(function(d){return d.group;}).sort().join(',' )==='N1,N2,N3,NEW,REF','logical experiment names should follow source naming convention');
    assert(!exp.design.evidenceSummary.sourceAvailable,'SMU notes must not be mistaken for design recipes');
    assert(analysis.summary.unresolvedSamples>0,'missing recipe fields should stay explicitly unresolved');
    const selected=exp.design.devices[0],pack=LF.ContextBuilder?LF.ContextBuilder.pack('design',{exp:exp,params:{deviceId:selected.id}}):null;
    if(pack){assert(pack.design_evidence_summary.raw_design_evidence_found===false,'context must label absence of RAW design evidence');assert(pack.design_evidence_summary.inference_basis==='model_inference_only','model-only fallback is explicit when source Design evidence is absent');}
  };
  t['Design page renders the simple chemistry-stack-process workbench for source and manual completion']=async function(){
    const clean=await LF.Importer.parseDataset(fixture('01_PRECISO_PERFETTO_COMPLETO.zip'),'clean.zip'),ui={};LF.DesignModel.ensure(clean,ui);const additive=clean.design.devices.find(function(d){return d.group==='ADDITIVE';});
    const html=LF.DesignPage.render({experiment:clean,selectedDeviceId:additive.id,stepper:'',pageHead:function(title,sub,actions){return '<header><h1>'+title+'</h1><p>'+sub+'</p>'+actions+'</header>';}});
    assert(/id="removeSelectedDevice"/.test(html),'selected Design experiment should expose a remove control');
    assert(/FA0\.85Cs0\.15Pb/.test(html),'recovered precursor should be visible in solution chemistry');
    assert(/SnO2/.test(html)&&/Spiro-OMeTAD/.test(html),'recovered stack should be visible');
    assert(/Solutions · solvents · solutes/.test(html)&&/Layer stack/.test(html)&&/Fabrication process/.test(html),'three researcher-facing Design editors should be visible');
    assert(/design-chem-card/.test(html)&&/design-stack-diagram/.test(html),'solution chemistry and stack should have graphical views');
    assert((html.match(/data-design-card=/g)||[]).length===clean.design.devices.length,'every experimental variant should have one navigator card');
    assert(/data-action-sequence="design-all"/.test(html)&&/Complete all missing with AI/.test(html),'one bulk completion control should exist when multiple experiments need work');
    assert(/Accept all/.test(html),'global acceptance control should exist');
    assert(!/Proposal confidence/.test(html)&&!/NEXT STEP/.test(html),'old complex Design state-machine workflow should be absent');

    const current=await LF.Importer.parseDataset(fixture('2026_01_22.zip'),'dataset.zip'),ui2={};LF.DesignModel.ensure(current,ui2);const selected=current.design.devices[0],html2=LF.DesignPage.render({experiment:current,selectedDeviceId:selected.id,stepper:'',pageHead:function(title,sub,actions){return '<header><h1>'+title+'</h1><p>'+sub+'</p>'+actions+'</header>';}});
    assert(/No solution chemistry yet/.test(html2)&&/No device stack yet/.test(html2)&&/Fabrication process/.test(html2),'missing Design data should stay directly editable without AI');
    assert(/design-variant-card missing/.test(html2),'incomplete experiments should be visibly marked as needing a suggestion');
    assert(!/No experiment available/.test(html2),'measurement-only Design must not look empty or broken');

    LF.ActionData.setProposal(current,'design.infer',selected.id,{targetDeviceId:selected.id,summary:'One suggestion',solutions:[{name:'Candidate',solutes:'FAI + PbI2',solvents:'DMF',provenance_kind:'model_inference'}],devices:[{stack:[{role:'ETL',material:'SnO2'}]}],unknowns:[]});
    const html3=LF.DesignPage.render({experiment:current,selectedDeviceId:selected.id,stepper:'',pageHead:function(title,sub,actions){return '<header><h1>'+title+'</h1><p>'+sub+'</p>'+actions+'</header>';}});
    assert(/Review before accepting/.test(html3)&&/Accept experiment/.test(html3),'pending AI suggestion should have one explicit per-experiment acceptance path');
    assert(!/Retry AI|Retry inference/.test(html3)&&/Discard/.test(html3),'a valid proposal is accepted or discarded; it does not expose a duplicate retry control');
    LF.ActionData.removeProposal(current,'design.infer',selected.id);LF.ActionData.setStatus(current,'design.infer',selected.id,{state:'error',message:'provider failed after internal retries'});
    const html4=LF.DesignPage.render({experiment:current,selectedDeviceId:selected.id,stepper:'',pageHead:function(title,sub,actions){return '<header><h1>'+title+'</h1><p>'+sub+'</p>'+actions+'</header>';}});
    assert((html4.match(/Retry inference/g)||[]).length===1,'an exhausted selected experiment must expose exactly one Retry inference control');
  };
  t['Design source projection is idempotent and does not overwrite researcher edits on render']=async function(){
    const exp=await LF.Importer.parseDataset(fixture('01_PRECISO_PERFETTO_COMPLETO.zip'),'clean.zip'),ui={};LF.DesignModel.ensure(exp,ui);
    const dev=exp.design.devices.find(function(d){return d.group==='BASELINE';});dev.process.annealing='Researcher override';dev.status='user_confirmed';
    LF.DesignModel.ensure(exp,ui);
    assert(dev.process.annealing==='Researcher override','ordinary ensure/render must not reproject RAW over researcher state');
  };
};
