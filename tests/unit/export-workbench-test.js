'use strict';
const fs=require('fs');
const path=require('path');
function assert(ok,msg){if(!ok)throw new Error(msg||'assertion failed');}
module.exports=function(t,LF,ctx){
  const root=ctx.root;
  const page=fs.readFileSync(path.join(root,'assets/js/pages/export-page.js'),'utf8');
  const context=fs.readFileSync(path.join(root,'assets/js/ai/context.js'),'utf8');
  const assistant=fs.readFileSync(path.join(root,'actions/assistant.chat/prompt.md'),'utf8');
  const assistantJs=fs.readFileSync(path.join(root,'assets/js/ai/assistant.js'),'utf8');
  const action=JSON.parse(fs.readFileSync(path.join(root,'actions/export.prepare/action.json'),'utf8'));
  t['Export page is NOMAD-first and projection values are closed by default']=function(){
    assert(page.includes('Primary workflow'),'primary NOMAD workflow missing');
    assert(page.includes('Prepare for NOMAD'),'NOMAD preparation heading missing');
    assert(page.includes('projection-drawer'),'projection drawer missing');
    assert(page.includes("const open=editing?' open':''"),'projection should open only while editing');
    assert(!page.includes('projection-workbench'),'old always-visible workbench must stay removed');
  };
  t['Export highlights required metadata and exposes the preparation Action as a primary CTA']=function(){
    assert(page.includes('Metadata needed'),'metadata priority card missing');
    assert(page.includes('Prepare missing metadata'),'primary export Action CTA missing');
    assert(page.includes('export-need-chip'),'required/recommended metadata chips missing');
    assert(page.includes('Show all metadata still needed'),'secondary missing fields must stay expandable');
  };
  t['Missing metadata and mapping details expose source fixes and export overrides']=function(){
    assert(page.includes('data-export-source-route'),'canonical source fix control missing');
    assert(page.includes('data-export-override-field'),'export override control missing');
    assert(page.includes('Edit Workspace')||page.includes('Edit source'),'Workspace source remediation missing');
    assert(page.includes('Open Cabinet'),'Cabinet source remediation missing');
    assert(page.includes('<th>Update</th>'),'mapping details update column missing');
  };
  t['Ready-PV remains a secondary on-demand projection']=function(){
    assert(page.includes("projectionDrawer('readypv',readypv)"),'Ready-PV drawer missing');
    assert(page.includes('Detailed NOMAD and Ready-PV data views stay closed until you need them.'),'Ready-PV should stay secondary to NOMAD preparation');
  };
  t['Export preparation is deterministic and review-only']=function(){
    assert(action.id==='export.prepare','Action id');
    assert(action.execution.mode==='deterministic','export preparation must not require a provider');
    assert(action.contract.context.profile==='export','export context profile');
    assert(action.contract.effect.mode==='store_proposal','Action must store a proposal');
    assert(action.ui.command==='/prepare-export','command');
    assert(action.execution.steps.every(function(step){return step.type==='DETERMINISTIC';}),'all export preparation steps are deterministic');
    assert(action.purpose.includes('without inventing values'),'manifest preserves source-of-truth boundary');
  };
  t['Assistant keeps deterministic export preparation discoverable without stuffing the Action catalog into prompts']=function(){
    assert(context.includes('primary_goal'),true,'export primary goal missing');
    assert(context.includes('preparationContext'),true,'projection context missing');
    assert(action.ui.command==='/prepare-export','export Action keeps its explicit command');
    assert(!assistant.includes('authoritative Action catalog'),'Assistant prompt must not carry the Action catalog');
    assert(assistantJs.includes('actionCatalog()'),'Actions remain discoverable through the Assistant UI');
  };
};
