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
    assert(/configured endpoint|direct|relay/i.test(LF.AIDiagnostics.contextNote()),true,'context note');
    assert(Object.prototype.hasOwnProperty.call(LF.AIDiagnostics,'environmentNote'),false,'obsolete alias removed');
  };
  t['reasoning-only output limits get a non-network diagnosis']=function(){
    const out=LF.AIDiagnostics.errorSummary({isContract:true,finishReason:'length'});
    assert(out.category,'Model output limit','category');
    assert(/valid response envelope/.test(out.next),true,'HTTP success distinction');
  };
  t['local network failures prioritize server reachability before CORS']=function(){
    LF.Storage={getAiSettings:function(){return{provider:'lmstudio'};}};
    const out=LF.AIDiagnostics.errorSummary({isNetwork:true,providerId:'lmstudio',message:'Test connection could not read an HTTP response.'});
    assert(out.category,'Local endpoint unreachable','category');
    assert(/Serve on Local Network/.test(out.next),true,'server LAN guidance');
    assert(/CORS/.test(out.next),true,'CORS guidance');
  };
  return t;
};
