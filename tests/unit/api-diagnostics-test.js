'use strict';
require('../../assets/js/ai/api-diagnostics.js');

function assert(actual,expected,label){if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error((label||'assert')+': expected '+JSON.stringify(expected)+' got '+JSON.stringify(actual));}

module.exports=function(t,LF){
  t['HTTP 400 model load failures get actionable local-provider guidance']=function(){
    const out=LF.AIDiagnostics.errorSummary({status:400,providerMessage:'Failed to load model "qwen/test". Error: Failed to load model.'});
    assert(out.category,'Model unavailable','category');
    assert(/provider/.test(out.next),true,'provider guidance');
    assert(/Detect/.test(out.next),true,'detect guidance');
  };
  t['provider context note is exposed through one documented API']=function(){
    assert(/directly from the browser/.test(LF.AIDiagnostics.contextNote()),true,'context note');
    assert(Object.prototype.hasOwnProperty.call(LF.AIDiagnostics,'environmentNote'),false,'obsolete alias removed');
  };
  t['reasoning-only connection probes get a specific output-limit diagnosis']=function(){
    const out=LF.AIDiagnostics.errorSummary({isContract:true,finishReason:'length'});
    assert(out.category,'Probe output limit','category');
    assert(/reasoning/.test(out.next),true,'reasoning guidance');
  };
  return t;
};
