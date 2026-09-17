'use strict';
const fs=require('fs');
const path=require('path');
function assert(ok,msg){if(!ok)throw new Error(msg||'assertion failed');}
module.exports=function(t,LF,ctx){
  const root=ctx.root;
  const page=fs.readFileSync(path.join(root,'assets/js/pages/export-page.js'),'utf8');
  const context=fs.readFileSync(path.join(root,'assets/js/ai/context.js'),'utf8');
  const assistant=fs.readFileSync(path.join(root,'actions/assistant.chat/prompt.md'),'utf8');
  const action=JSON.parse(fs.readFileSync(path.join(root,'actions/export.prepare/action.json'),'utf8'));
  const prompt=fs.readFileSync(path.join(root,'actions/export.prepare/prompt.md'),'utf8');
  t['Export page is NOMAD-first and projection values are closed by default']=function(){
    assert(page.includes('Primary workflow'),'primary NOMAD workflow missing');
    assert(page.includes('Prepare for NOMAD'),'NOMAD preparation heading missing');
    assert(page.includes('projection-drawer'),'projection drawer missing');
    assert(page.includes("const open=editing?' open':''"),'projection should open only while editing');
    assert(!page.includes('projection-workbench'),'old always-visible workbench must stay removed');
  };
  t['Export highlights required metadata and exposes the preparation Action as a primary CTA']=function(){
    assert(page.includes('Metadata needed'),'metadata priority card missing');
    assert(page.includes('Prepare missing metadata with AI'),'primary export Action CTA missing');
    assert(page.includes('export-need-chip'),'required/recommended metadata chips missing');
    assert(page.includes('Show all metadata still needed'),'secondary missing fields must stay expandable');
  };
  t['Ready-PV remains a secondary on-demand projection']=function(){
    assert(page.includes("projectionDrawer('readypv',readypv)"),'Ready-PV drawer missing');
    assert(page.includes('Detailed NOMAD and Ready-PV data views stay closed until you need them.'),'Ready-PV should stay secondary to NOMAD preparation');
  };
  t['Export preparation is a bounded review-only Action']=function(){
    assert(action.id==='export.prepare','Action id');
    assert(action.contract.context.profile==='export','export context profile');
    assert(action.contract.effect.mode==='store_proposal','Action must store a proposal');
    assert(action.ui.command==='/prepare-export','command');
    assert(action.execution.steps[0].validate_with==='export.validate-preparation','semantic validator');
    assert(prompt.includes('export-only'),'prompt must preserve source-of-truth boundary');
    assert(prompt.includes('Do not invent'),'prompt must prohibit invented metadata');
  };
  t['Assistant receives export projection context and prioritizes NOMAD']=function(){
    assert(context.includes('primary_goal'),true,'export primary goal missing');
    assert(context.includes('preparationContext'),true,'projection context missing');
    assert(assistant.includes('/prepare-export'),true,'Assistant export command missing');
    assert(assistant.includes('NOMAD preparation/upload as the primary workflow'),true,'Assistant priority missing');
  };
};
