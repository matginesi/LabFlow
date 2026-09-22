'use strict';
require('../../assets/js/ai/errors.js');
require('../../assets/js/ai/stream.js');
require('../../assets/js/ai/actions.js');
require('../../assets/js/ai/action-ui.js');

function assert(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error((label||'assert')+': expected '+JSON.stringify(expected)+' got '+JSON.stringify(actual));
}
function truthy(value,label){if(!value)throw new Error(label||'expected truthy value');}

module.exports=function(t,LF){
  t['canonical token budget separates answer and completion limits']=async function(){
    LF.AI=LF.AI||{};
    LF.AI.estimatePromptTokens=function(){return 100;};
    const capability={contextWindow:8192,maxOutputTokens:4096,reasoningStatus:'optional'};
    const budget=await LF.ActionRunner.budgetFor(
      [{role:'user',content:'test'}],
      {maxOutputTokensCap:0},
      {output:'text',min_output_tokens:200,target_output_tokens:600,max_output_tokens:1200},
      null,1200,capability,{capability:'optional',effective:'on'},null
    );
    assert(budget.tokenBudget.input.estimated,100,'estimated input');
    assert(budget.tokenBudget.answer.minimumReserve,200,'minimum answer reserve');
    assert(budget.tokenBudget.answer.target,600,'answer target');
    assert(budget.tokenBudget.answer.maximum,1200,'declared maximum answer');
    assert(budget.tokenBudget.answer.request,1066,'effective answer request');
    assert(budget.tokenBudget.completion.reasoningReserve,1024,'reasoning reserve');
    assert(budget.tokenBudget.completion.requestLimit,2090,'answer plus reasoning completion request');
    truthy(budget.tokenBudget.completion.requestLimit>budget.tokenBudget.answer.maximum,
      'completion request may exceed answer maximum when reasoning needs headroom');
  };

  t['reasoning-off Action does not reserve hidden reasoning tokens on an optional reasoner']=async function(){
    LF.AI=LF.AI||{};
    LF.AI.estimatePromptTokens=function(){return 80;};
    const budget=await LF.ActionRunner.budgetFor(
      [{role:'user',content:'extract JSON'}],
      {maxOutputTokensCap:0},
      {output:'json',min_output_tokens:128,target_output_tokens:384,max_output_tokens:768},
      null,768,{contextWindow:4096,maxOutputTokens:2048,reasoningStatus:'optional'},
      {capability:'optional',effective:'off'},null
    );
    assert(budget.tokenBudget.completion.reasoningReserve,0,'strict-off reasoning reserve');
    assert(budget.tokenBudget.completion.requestLimit,budget.tokenBudget.answer.request,
      'strict-off completion equals answer request');
  };

  t['non-reasoning model does not add hidden completion headroom']=async function(){
    LF.AI=LF.AI||{};
    LF.AI.estimatePromptTokens=function(){return 50;};
    const budget=await LF.ActionRunner.budgetFor(
      [{role:'user',content:'test'}],
      {maxOutputTokensCap:0},
      {output:'text',min_output_tokens:128,target_output_tokens:512,max_output_tokens:1024},
      null,1024,{contextWindow:4096,maxOutputTokens:2048,reasoningStatus:'none'},
      {capability:'none',effective:'off'},null
    );
    assert(budget.tokenBudget.completion.reasoningReserve,0,'no reasoning reserve');
    assert(budget.tokenBudget.completion.requestLimit,budget.tokenBudget.answer.request,
      'completion equals answer request');
  };

  t['totem streaming progress is completion-budget based rather than answer-target based']=function(){
    const progress=LF.ActionUI.streamFraction({completionTokens:900,targetTokens:100,budgetTokens:1800});
    assert(progress.budget,1800,'completion budget denominator');
    assert(progress.tokens,900,'completion tokens numerator');
    truthy(progress.fraction<0.7,'answer target must not make completion progress look exhausted');
  };

  t['stream telemetry reports answer reasoning and completion separately']=async function(){
    const encoder=new TextEncoder();
    const chunks=[encoder.encode('data: {"choices":[{"delta":{"content":"final","reasoning_content":"thinking"}}],"usage":{"completion_tokens":20,"completion_tokens_details":{"reasoning_tokens":12}}}\n\n'),encoder.encode('data: [DONE]\n\n')];
    let index=0,last=null;
    const response={body:{getReader:function(){return{
      read:async function(){return index<chunks.length?{done:false,value:chunks[index++]}:{done:true};},
      cancel:async function(){}
    };}}};
    await LF.AIStream.readEventStream(response,function(){},function(p){last=p;},function(){},0,100,null,'test');
    truthy(last,'progress callback');
    assert(last.completionTokens,20,'completion tokens');
    assert(last.reasoningTokens,12,'reasoning tokens');
    assert(last.answerTokens,8,'answer tokens');
    assert(last.completionEstimated,false,'completion is exact');
    assert(last.answerEstimated,false,'answer is exact when provider reports reasoning details');
  };

  return t;
};
