'use strict';
const path=require('path');
function assert(actual,expected,label){if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error((label||'assert')+': expected '+JSON.stringify(expected)+' got '+JSON.stringify(actual));}
module.exports=function(t,LF,ctx){
  const root=ctx.root;
  require(path.join(root,'assets/js/ai/action-registry.js'));
  LF.DatasetCorrections=LF.DatasetCorrections||{};
  require(path.join(root,'assets/js/ai/action-guards.js'));
  LF.DesignModel={missingDomains:function(){return['solutions'];}};
  LF.ActionRunner={effective:function(id){return LF.ActionRegistry.action(id);}};
  require(path.join(root,'assets/js/ai/action-capabilities.js'));
  function exp(ambiguous){return{id:'exp_1',sync:{revision:0},measurements:[{id:'m1',sample:'S1',group:'G1',bestEff:20}],analysis:{summary:{measurements:1}},datasetAnalysis:{sourceRevision:0,ambiguousFindings:ambiguous?[{id:'f1'}]:[]},design:{devices:[{id:'d1',solutionIds:[],stack:[],process:{}}],solutions:[]}};}
  t['public catalog is global while route only changes recommendation']=function(){
    const e=exp(false);LF.State={state:{experiment:e,route:'experiment-export',ui:{route:'experiment-export',selectedDesignDeviceId:'d1',boxPlot:{groups:['G1']}}}};
    const exportIds=LF.ActionCapabilities.catalog().map(function(x){return x.id;}).sort();
    LF.State.state.route='experiment-design';LF.State.state.ui.route='experiment-design';
    const designIds=LF.ActionCapabilities.catalog().map(function(x){return x.id;}).sort();
    assert(exportIds,designIds,'page does not add or remove public Actions');
    assert(LF.ActionCapabilities.evaluate('design.infer').recommended,true,'Design is recommended on Design route');
  };
  t['semantic resolution is unavailable before execution when no ambiguity exists']=function(){
    const e=exp(false);LF.State={state:{experiment:e,route:'experiment-export',ui:{route:'experiment-export',selectedDesignDeviceId:'d1',boxPlot:{groups:[]}}}};
    const a=LF.ActionCapabilities.evaluate('dataset.resolve-ambiguities');
    assert(a.status,'unavailable','status');assert(a.available,false,'available');assert(a.reason,'No active semantic ambiguity requires an AI suggestion.','reason');
  };
  t['semantic resolution becomes available without changing page when ambiguity appears']=function(){
    const e=exp(true);LF.State={state:{experiment:e,route:'experiment-export',ui:{route:'experiment-export',selectedDesignDeviceId:'d1',boxPlot:{groups:[]}}}};
    const a=LF.ActionCapabilities.evaluate('dataset.resolve-ambiguities');
    assert(a.status,'available','status');assert(a.available,true,'available');assert(a.command,'/resolve','command');assert(a.recommended,true,'recommended in Export');
  };
  t['Design target binding lives in capability service and follows selected experiment']=function(){
    const e=exp(false);e.design.devices.push({id:'d2',solutionIds:[],stack:[],process:{}});LF.State={state:{experiment:e,route:'experiment-results',ui:{route:'experiment-results',selectedDesignDeviceId:'d2',boxPlot:{groups:[]}}}};
    const a=LF.ActionCapabilities.evaluate('design.infer');
    assert(a.params.deviceId,'d2','selected Design target');assert(a.recommended,false,'route affects priority only');assert(a.available,true,'Action remains executable off-page');
  };

  t['Results comparison bindings are manifest-driven and guard the same resolved selection']=function(){
    const e=exp(false);e.measurements=[{id:'m1',group:'G1'},{id:'m2',group:'G2'}];LF.State={state:{experiment:e,route:'experiment-export',ui:{route:'experiment-export',selectedDesignDeviceId:'d1',boxPlot:{groups:['G1','G2'],metric:'voc',direction:'rv',eligibleOnly:false}}}};
    const a=LF.ActionCapabilities.evaluate('results.compare');
    assert(a.params,{groups:['G1','G2'],metric:'voc',direction:'rv',eligibleOnly:false},'manifest state bindings');assert(a.available,true,'resolved selection passes guard');assert(a.recommended,false,'route changes priority only');
    LF.State.state.ui.boxPlot.groups=['G1'];const b=LF.ActionCapabilities.evaluate('results.compare');assert(b.available,false,'same guard sees updated binding');assert(b.reason,'Select at least two Results groups to compare.','exact blocker');
  };
  t['capability service contains no Action-id-specific resolver table']=function(){
    const src=require('fs').readFileSync(path.join(root,'assets/js/ai/action-capabilities.js'),'utf8');assert(src.includes('PARAM_RESOLVERS'),false,'no Action-specific resolver registry');assert(src.includes("'design.infer'"),false,'no Design special-case');assert(src.includes("'results.compare'"),false,'no Results special-case');
  };

  t['slash commands resolve from Action manifests rather than Assistant aliases']=function(){
    LF.State={state:{experiment:exp(true),route:'experiment-import',ui:{route:'experiment-import',selectedDesignDeviceId:'d1',boxPlot:{groups:[]}}}};
    assert(LF.ActionCapabilities.resolveCommand('/resolve'),'dataset.resolve-ambiguities','resolve command');
    assert(LF.ActionCapabilities.resolveCommand('/design'),'design.infer','design command');
    assert(LF.ActionCapabilities.resolveCommand('/action results.interpret'),'results.interpret','generic command');
  };
  return t;
};
