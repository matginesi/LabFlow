'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/core.js');
require('../../assets/js/ai/action-registry.js');
require('../../assets/js/storage.js');
require('../../assets/js/pages/settings-page.js');
function assert(ok,msg){if(!ok)throw new Error(msg||'assertion failed');}
module.exports=function(t,LF){
  t['Actions catalog includes every executable Action including Assistant']=function(){
    const ids=LF.ActionRegistry.actions();
    assert(ids.includes('assistant.chat'),'Assistant missing from registry');
    assert(ids.includes('dataset.analyze'),'deterministic Action missing');
    assert(ids.includes('report.generate'),'report Action missing');
    assert(ids.includes('analysis.summarize'),'internal deterministic summary missing from registry');
    assert(ids.includes('analysis.enrich'),'shared experiment brief enrichment missing from registry');
    assert(ids.length===11,'expected all 11 Actions');
  };
  t['AI Actions declare bounded output targets and automatic enrichment is fail-fast']=function(){
    const defs=LF.ActionRegistry.actions().map(function(id){return LF.ActionRegistry.action(id);});
    defs.forEach(function(def){(def.steps||[]).filter(function(step){return step.type==='AI';}).forEach(function(step){assert(Number(step.max_output_tokens)>0,def.id+'/'+step.id+' missing output target');});});
    const enrich=LF.ActionRegistry.action('analysis.enrich').steps.find(function(step){return step.id==='enrich';});
    assert(enrich.max_output_tokens===3072,'analysis.enrich target must be 3072');
    assert(enrich.deadline_ms===90000,'analysis.enrich hard deadline must be 90s');
    assert(enrich.max_retries===0,'analysis.enrich must not retry automatically during import');
  };

  t['AI settings migrate obsolete thinking flags to a validated provider-neutral policy']=function(){
    localStorage.setItem('labflow.ai.settings',JSON.stringify({provider:'lmstudio',endpoint:'http://127.0.0.1:1234/v1',model:'local',thinking:true,thinkingMode:'unsupported'}));
    const migrated=LF.Storage.getAiSettings();
    assert(migrated.thinkingMode==='auto','invalid thinking mode must fall back to auto');
    assert(!Object.prototype.hasOwnProperty.call(migrated,'thinking'),'obsolete boolean thinking flag must not escape storage');
    LF.Storage.saveAiSettings(Object.assign({},migrated,{thinkingMode:'off'}));
    assert(LF.Storage.getAiSettings().thinkingMode==='off','validated explicit mode must persist');
    localStorage.removeItem('labflow.ai.settings');
  };

  t['Action runtime override changes effective definition and prompt and resets cleanly']=function(){
    const id='results.interpret',base=LF.ActionRegistry.action(id),sourcePrompt=LF.ActionRegistry.prompt(id);
    LF.Storage.saveActionOverride(id,{definition:Object.assign({},base,{title:'Runtime title'}),prompt:'Runtime prompt'});
    assert(LF.Storage.getEffectiveAction(id).title==='Runtime title','definition override not effective');
    assert(LF.Storage.getEffectivePrompt(id)==='Runtime prompt','prompt override not effective');
    LF.Storage.resetActionOverride(id);
    assert(LF.Storage.getEffectiveAction(id).title===base.title,'definition reset failed');
    assert(LF.Storage.getEffectivePrompt(id)===sourcePrompt,'prompt reset failed');
  };
  function actionSettingsState(kind,actionId){
    LF.State={state:{settingsSection:'actions',settingsActionDocKind:kind,settingsActionId:actionId,ui:{settingsActionId:actionId},experiment:{meta:{sourceName:'fixture.zip'}}}};
  }

  t['older browser Action overrides inherit new source safety fields']=function(){
    const id='analysis.enrich',base=LF.ActionRegistry.action(id),oldDef=JSON.parse(JSON.stringify(base));
    oldDef.steps=oldDef.steps.map(function(step){const copy=Object.assign({},step);delete copy.max_output_tokens;delete copy.deadline_ms;delete copy.max_retries;return copy;});
    LF.Storage.saveActionOverride(id,{definition:oldDef});
    const effective=LF.Storage.getEffectiveAction(id),step=effective.steps.find(function(x){return x.id==='enrich';});
    assert(step.max_output_tokens===3072,'source output target inherited');
    assert(step.deadline_ms===90000,'source deadline inherited');
    assert(step.max_retries===0,'source retry policy inherited');
    LF.Storage.resetActionOverride(id);
  };

  t['Settings exposes one Actions manager and no split AI helper surface']=function(){
    actionSettingsState('lab','dataset.analyze');
    const html=LF.SettingsPage.render();
    assert(html.indexOf('>Actions<')>=0,'Actions tab missing');
    assert(html.indexOf('AI Helpers')<0,'legacy AI Helpers surface remains');
    assert(html.indexOf('Operations Workshop')<0,'legacy Operations Workshop surface remains');
    assert(html.indexOf('No prompt required.')>=0,'deterministic Action prompt state missing');
  };

  t['Report Actions expose a document-kind select that drives data-action-kind']=function(){
    actionSettingsState('paper','report.generate');const paper=LF.SettingsPage.render();
    assert(paper.indexOf('id="actionReportDocKind"')>=0,'doc-kind select present for report.generate');
    assert(paper.indexOf('data-action="report.generate" data-action-kind="paper"')>=0,'Run carries paper kind');
    assert(paper.indexOf('<option value="paper" selected>')>=0,'paper option selected from state');
    actionSettingsState('lab','report.improve');const lab=LF.SettingsPage.render();
    assert(lab.indexOf('data-action="report.improve" data-action-kind="lab"')>=0,'Run carries lab kind');
    assert(lab.indexOf('<option value="lab" selected>')>=0,'lab option selected from state');
    actionSettingsState('lab','results.interpret');const other=LF.SettingsPage.render();
    assert(other.indexOf('actionReportDocKind')<0,'no doc-kind select for non-report Action');
    assert(other.indexOf('data-action="results.interpret"')>=0,'plain run preserved');
  };
};
