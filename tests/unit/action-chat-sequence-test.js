'use strict';
const fs=require('fs');
const path=require('path');
function assert(ok,msg){if(!ok)throw new Error(msg||'assertion failed');}
module.exports=function(t,LF){
  const root=path.resolve(__dirname,'../..');
  const uiPath=path.join(root,'assets/js/ai/action-ui.js');
  const assistantSource=fs.readFileSync(path.join(root,'assets/js/ai/assistant.js'),'utf8');
  const reportSource=fs.readFileSync(path.join(root,'assets/js/pages/report-page.js'),'utf8');

  function loadUi(runImpl){
    delete require.cache[require.resolve(uiPath)];
    let messages=[];
    LF.Storage={
      getAiSettings:function(){return{endpoint:'http://127.0.0.1:1234/v1',model:'test-model',provider:'lmstudio'};},
      getApiKey:function(){return'';}
    };
    LF.AIProviders={lmstudio:{keyRequired:false}};
    LF.State={state:{experiment:{id:'exp',derived:{chat:{conversation:[]}}},ui:{}},ensureExperiment:function(){return this.state.experiment;}};
    LF.PageContext={summary:function(){return'Report · Paper';}};
    LF.UI={activityStart:function(){},activityUpdate:function(){},activityFinish:function(){},activityError:function(){},toast:function(){}};
    LF.Assistant={addActionMessage:function(m){messages.push(m);return m;},render:function(){}};
    LF.ActionRunner={
      effective:function(id){if(id==='report.improve')return{id:id,title:'AI writing help',short_title:'Writing help',output:'text',steps:[{id:'edit',type:'AI'}]};return{id:id,title:id,output:'text',steps:[]};},
      isRunning:function(){return false;},cancel:function(){return true;},retry:function(cb){return runImpl('report.improve',cb);},run:function(id,cb){return runImpl(id,cb);}
    };
    require(uiPath);
    return{messages:messages};
  }

  t['Completed visible text Actions publish their actual result into Assistant chat']=async function(){
    const env=loadUi(function(id,cb){return Promise.resolve({status:'done',actionId:id,aiOutput:'Evidence-backed interpretation.',result:{stored:true},requestMeta:{edit:{model:'test-model',provider:'lmstudio',usage:{promptTokens:10,completionTokens:5,totalTokens:15}}}});});
    const out=await LF.ActionUI.run('report.improve','',{params:{document_kind:'paper',mode:'paper_results'}});
    assert(out.status==='done','Action did not finish');
    assert(env.messages.length===1,'Action should publish one chat message');
    assert(env.messages[0].content==='Evidence-backed interpretation.','text Action result not preserved');
    assert(env.messages[0].actionTitle==='Writing help','Action title not attached');
    assert(env.messages[0].usage&&env.messages[0].usage.totalTokens===15,'Action token metadata not attached');
    assert(assistantSource.includes("Action · '+m.actionTitle"),'Action source not visible in chat telemetry');
  };

  t['Report and Paper All helpers execute section modes sequentially and aggregate one chat result']=async function(){
    const calls=[];
    const env=loadUi(function(id,cb){calls.push(cb.params.mode);return Promise.resolve({status:'done',actionId:id,aiOutput:'Edited '+cb.params.mode,result:{stored:true},requestMeta:{}});});
    const out=await LF.ActionUI.runSequence('report-all',{dataset:{actionKind:'paper'}});
    const expected=['paper_abstract','paper_introduction','paper_methods','paper_results','paper_discussion','paper_limitations','paper_conclusions'];
    assert(JSON.stringify(calls)===JSON.stringify(expected),'Paper All order mismatch: '+JSON.stringify(calls));
    assert(out&&out.status==='done','All sequence did not complete');
    assert(env.messages.length===1,'All should aggregate to one chat message');
    assert(env.messages[0].content.includes('Completed 7 / 7'),'All completion count missing');
    assert(env.messages[0].content.includes('### Abstract')&&env.messages[0].content.includes('### Conclusions'),'All section results missing');
    assert((reportSource.match(/data-action-sequence="report-all"/g)||[]).length===2,'Report/Paper All buttons missing');
  };
  return t;
};
