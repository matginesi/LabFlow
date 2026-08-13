'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/ai/operation-registry.js');
require('../../assets/js/storage.js');
function assert(ok,msg){if(!ok)throw new Error(msg||'assertion failed');}
module.exports=function(t,LF){
  t['Workshop catalog source includes every executable operation including Assistant']=function(){
    const ids=LF.OperationRegistry.operations();
    assert(ids.includes('assistant.chat'),'Assistant missing from registry');
    assert(ids.includes('dataset.analyze'),'deterministic operation missing');
    assert(ids.includes('report.generate'),'report operation missing');
    assert(ids.length===9,'expected all 9 operations');
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
};
