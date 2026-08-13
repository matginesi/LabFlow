'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/core.js');
require('../../assets/js/ai/operation-registry.js');
require('../../assets/js/storage.js');
require('../../assets/js/pages/settings-page.js');
function assert(ok,msg){if(!ok)throw new Error(msg||'assertion failed');}
module.exports=function(t,LF){
  t['Workshop catalog source includes every executable operation including Assistant']=function(){
    const ids=LF.OperationRegistry.operations();
    assert(ids.includes('assistant.chat'),'Assistant missing from registry');
    assert(ids.includes('dataset.analyze'),'deterministic operation missing');
    assert(ids.includes('report.generate'),'report operation missing');
    assert(ids.includes('analysis.summarize'),'internal deterministic summary missing from registry');
    assert(ids.length===10,'expected all 10 operations');
  };
  t['Workshop runtime override changes effective definition and prompt and resets cleanly']=function(){
    const id='results.interpret',base=LF.OperationRegistry.operation(id),sourcePrompt=LF.OperationRegistry.prompt(id);
    LF.Storage.saveOperationOverride(id,{definition:Object.assign({},base,{title:'Runtime title'}),prompt:'Runtime prompt'});
    assert(LF.Storage.getEffectiveOperation(id).title==='Runtime title','definition override not effective');
    assert(LF.Storage.getEffectivePrompt(id)==='Runtime prompt','prompt override not effective');
    LF.Storage.resetOperationOverride(id);
    assert(LF.Storage.getEffectiveOperation(id).title===base.title,'definition reset failed');
    assert(LF.Storage.getEffectivePrompt(id)===sourcePrompt,'prompt reset failed');
  };
  function workshopState(kind,opId){
    LF.State={state:{settingsSection:'operations',settingsOperationDocKind:kind,settingsOperationId:opId,ui:{settingsOperationId:opId},experiment:{meta:{sourceName:'fixture.zip'}}}};
  }
  t['Report operations expose a document-kind select that drives data-operation-kind']=function(){
    workshopState('paper','report.generate');const paper=LF.SettingsPage.render();
    assert(paper.indexOf('id="operationReportDocKind"')>=0,'doc-kind select present for report.generate');
    assert(paper.indexOf('data-operation="report.generate" data-operation-kind="paper"')>=0,'Run carries paper kind');
    assert(paper.indexOf('<option value="paper" selected>')>=0,'paper option selected from state');
    workshopState('lab','report.improve');const lab=LF.SettingsPage.render();
    assert(lab.indexOf('data-operation="report.improve" data-operation-kind="lab"')>=0,'Run carries lab kind');
    assert(lab.indexOf('<option value="lab" selected>')>=0,'lab option selected from state');
    workshopState('lab','results.interpret');const other=LF.SettingsPage.render();
    assert(other.indexOf('operationReportDocKind')<0,'no doc-kind select for non-report operation');
    assert(other.indexOf('data-operation="results.interpret"')>=0,'plain run preserved');
  };
};
