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
