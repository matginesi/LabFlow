'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/core.js');
require('../../assets/js/ai/action-registry.js');
require('../../assets/js/ai/structured.js');
require('../../assets/js/ai/actions.js');

function assert(ok,msg){if(!ok)throw new Error(msg||'assertion failed');}

module.exports=function(t,LF){
  t['Design ActionRunner accepts bounded labelled chemistry when provider does not return JSON'] = async function(){
    const exp={id:'exp_design_recovery',sync:{revision:0},derived:{actions:{},chat:{conversation:[]}}};
    const def={
      id:'test.design-recovery',
      contract:{context:{profile:'design',scope:'selected_design_experiment'},result:{format:'json',schema:'design_suggestion',kind:'proposal'},effect:{mode:'read_only',writes:[]},guards:[]},
      execution:{mode:'ai',result_step:'infer',steps:[{id:'infer',type:'AI',output:'json',schema:'design_suggestion',provider_schema:false,thinking:'off',max_output_tokens:800,target_output_tokens:400,min_output_tokens:80,max_input_tokens:3000,max_retries:0}]}
    };
    let built=null;
    LF.Storage={getEffectiveAction:function(){return def;},getAiSettings:function(){return{provider:'custom',endpoint:'https://example.test/v1',model:'small-model',streaming:false,maxOutputTokensCap:0,thinkingMode:'auto'};}};
    LF.ActionContext={build:function(){return{context:{},messageList:[{role:'user',content:'Infer only missing solution chemistry.'}]};}};
    LF.State={state:{experiment:exp},ensureDerived:function(e){e.derived=e.derived||{};e.derived.actions=e.derived.actions||{};e.derived.chat=e.derived.chat||{conversation:[]};},startActionRun:function(){},endActionRun:function(){},touch:function(){},notify:function(){}};
    LF.AI={
      acceptController:function(){},
      estimatePromptTokens:function(){return 40;},
      estimateTokens:function(x){return Math.ceil(String(x||'').length/4);},
      resolveModelCapabilities:async function(){return{maxOutputTokens:4096,contextWindow:8192,reasoningStatus:'none'};},
      buildRequest:function(opts){built=opts;return opts;},
      send:async function(){return{content:'Solution role: absorber precursor\nSolvents: DMF + DMSO\nCoating: spin coating\nAtmosphere: inert atmosphere',finishReason:'stop'};}
    };
    const out=await LF.ActionRunner.run(def.id);
    assert(out.status==='done','ActionRunner should recover a valid Design result');
    assert(out.aiOutput&&out.aiOutput.solutions&&out.aiOutput.solutions.length===1,'recovered solution missing');
    assert(out.aiOutput.solutions[0].solvents==='DMF + DMSO','recovered solvents were not preserved');
    assert(out.aiOutput.process&&out.aiOutput.process.coating==='spin coating','recovered process was not preserved');
    assert(built&&built.jsonMode===true,'structured request should still request JSON mode where supported');
    assert(built.jsonSchema==null,'Design must not force provider-side strict schema');
  };
  return t;
};
