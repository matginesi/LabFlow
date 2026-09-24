'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/core.js');
require('../../assets/js/storage.js');
require('../../assets/js/ai/providers.js');
require('../../assets/js/ai/api-diagnostics.js');
require('../../assets/js/ai/settings.js');
function assert(actual,expected,label){if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error((label||'assert')+': expected '+JSON.stringify(expected)+' got '+JSON.stringify(actual));}

function makeElement(value){return{value:value==null?'':String(value),textContent:'',hidden:false,disabled:false,checked:true,dataset:{},options:[],children:[],className:'',placeholder:'',replaceChildren:function(){this.options=[];this.children=[];},appendChild:function(node){this.children.push(node);if(node&&node.tagName==='OPTION')this.options.push(node);},setAttribute:function(name,val){this[name]=String(val);},removeAttribute:function(name){delete this[name];},focus:function(){this.focused=true;},closest:function(){return null;}};}

function activityUI(events){return{
  message:function(message,type,title){events.push({kind:'message',message:message,type:type,title:title});},
  activityStart:function(payload){events.push({kind:'start',payload:payload});},
  activityUpdate:function(payload){events.push({kind:'update',payload:payload});},
  activityFinish:function(payload){events.push({kind:'finish',payload:payload});},
  activityError:function(error,payload){events.push({kind:'error',error:error,payload:payload});},
  isActivityOpen:function(){return false;}
};}
function lastEvent(events,kind){return events.slice().reverse().find(function(event){return event.kind===kind;});}

function installForm(LF,values){
  values=values||{};
  const elements={
    aiProvider:makeElement(values.provider||'openrouter'),
    aiEndpoint:makeElement(values.endpoint||'https://visible.example/v1/chat/completions'),
    aiKey:makeElement(values.apiKey||''),
    aiModel:makeElement(values.model||''),
    aiModelSelect:makeElement(values.model||''),
    detectProviderModel:makeElement(''),
    aiModelList:makeElement(''),
    aiModelHint:makeElement(''),
    testAiConnection:makeElement(''),
    aiThinkingMode:makeElement('auto'),
    aiStreaming:Object.assign(makeElement(''),{checked:true}),
    aiInactivityTimeout:makeElement('90'),
    aiMaxOutputTokensCap:makeElement('0')
  };
  elements.aiModel.hidden=true;elements.aiModelSelect.hidden=false;
  if(values.model){const option={tagName:'OPTION',value:String(values.model),textContent:String(values.model)};elements.aiModelSelect.options.push(option);}
  const oldDocument=global.document;
  global.document={
    getElementById:function(id){return elements[id]||null;},
    querySelectorAll:function(){return[];},
    querySelector:function(){return null;},
    createElement:function(tag){const node=makeElement('');node.tagName=String(tag).toUpperCase();return node;}
  };
  return{elements:elements,restore:function(){if(oldDocument===undefined)delete global.document;else global.document=oldDocument;}};
}

module.exports=function(t,LF){
  t['Detect uses the visible unsaved OpenRouter endpoint/key, discovers a model, then requires a real chat probe']=async function(){
    localStorage.clear();localStorage.setItem('labflow.ai.settings',JSON.stringify({provider:'removed-provider',endpoint:'https://saved.invalid/v1',model:'saved-model'}));
    const form=installForm(LF,{provider:'openrouter',endpoint:'https://visible.example/v1/chat/completions',apiKey:'visible-key',model:''});
    const oldAI=LF.AI,oldUI=LF.UI;let listArgs=null,probeArgs=null,events=[];
    LF.AI={
      listModels:async function(provider,endpoint,key){listArgs={provider:provider,endpoint:endpoint,key:key};return{models:[LF.AIProviders.openrouter.model,'meta/other'],entries:[],loadedModels:[]};},
      testConnection:async function(opts){probeArgs=Object.assign({},opts);return{ok:true,model:opts.model};},
      resolveModelCapabilities:async function(){return{source:'test'};}
    };
    LF.UI=activityUI(events);
    try{
      const models=await LF.AISettings.detectModel();
      assert(models,[LF.AIProviders.openrouter.model,'meta/other'],'discovered models');
      assert(listArgs,{provider:'openrouter',endpoint:'https://visible.example/v1/chat/completions',key:'visible-key'},'catalogue uses visible unsaved values');
      assert(probeArgs.provider,'openrouter','probe provider');assert(probeArgs.endpoint,'https://visible.example/v1/chat/completions','probe endpoint');assert(probeArgs.apiKey,'visible-key','probe key');assert(probeArgs.model,LF.AIProviders.openrouter.model,'discovered model is really probed');
      assert(!!lastEvent(events,'start'),true,'Detect opens Action Totem');assert(!!lastEvent(events,'finish'),true,'Detect finishes Action Totem');assert(events.some(function(e){return e.kind==='message';}),false,'Detect does not use Message Totem');
    }finally{LF.AI=oldAI;LF.UI=oldUI;form.restore();localStorage.clear();}
  };

  t['Detect surfaces real probe token telemetry instead of synthetic step speed']=async function(){
    localStorage.clear();const form=installForm(LF,{provider:'openrouter',endpoint:LF.AIProviders.openrouter.endpoint,apiKey:'or-key',model:LF.AIProviders.openrouter.model});
    const oldAI=LF.AI,oldUI=LF.UI;let events=[];
    LF.AI={listModels:async function(){return{models:[LF.AIProviders.openrouter.model],entries:[],loadedModels:[]};},testConnection:async function(opts){return{ok:true,model:opts.model,elapsedMs:40,tokensPerSecond:25,usage:{completionTokens:4,answerTokens:3,reasoningTokens:1,estimated:false}};},resolveModelCapabilities:async function(){return{source:'test'};}};
    LF.UI=activityUI(events);
    try{await LF.AISettings.detectModel();const telemetry=events.filter(function(e){return e.kind==='update'&&e.payload&&e.payload.stream;}).pop();assert(!!telemetry,true,'probe publishes stream telemetry');assert(telemetry.payload.stream.completionTokens,4,'completion tokens');assert(telemetry.payload.stream.rate,25,'real token rate');assert(telemetry.payload.stream.budgetTokens,LF.AIProviders.openrouter.connectionTestMaxTokens||64,'connection probe budget');assert(Object.prototype.hasOwnProperty.call(telemetry.payload,'speed'),false,'no synthetic step/s speed');}
    finally{LF.AI=oldAI;LF.UI=oldUI;form.restore();localStorage.clear();}
  };

  t['Detect fails closed before network access when a required provider key is missing']=async function(){
    localStorage.clear();const form=installForm(LF,{provider:'openrouter',endpoint:LF.AIProviders.openrouter.endpoint,apiKey:'',model:''});
    const oldAI=LF.AI,oldUI=LF.UI;let networkCalls=0,events=[];
    LF.AI={listModels:async function(){networkCalls++;return{models:['x']};},testConnection:async function(){networkCalls++;return{ok:true};}};
    LF.UI=activityUI(events);
    try{const result=await LF.AISettings.detectModel();assert(result,[],'failed Detect returns empty list');assert(networkCalls,0,'missing key blocks network work');assert(!!lastEvent(events,'start'),true,'Action Totem opens before validation');assert(!!lastEvent(events,'error'),true,'validation failure ends in Action Totem error');assert(/API key/i.test(lastEvent(events,'error').payload.response),true,'key error is explicit');assert(events.some(function(e){return e.kind==='message';}),false,'no Message Totem for Detect');}
    finally{LF.AI=oldAI;LF.UI=oldUI;form.restore();localStorage.clear();}
  };

  t['OpenRouter Detect can verify the configured model when catalogue access alone is unavailable']=async function(){
    localStorage.clear();const configured=LF.AIProviders.openrouter.model,form=installForm(LF,{provider:'openrouter',endpoint:LF.AIProviders.openrouter.endpoint,apiKey:'or-key',model:configured});
    const oldAI=LF.AI,oldUI=LF.UI;let probeArgs=null,events=[];
    LF.AI={listModels:async function(){const error=new TypeError('Failed to fetch');error.providerId='openrouter';error.phase='models';throw error;},testConnection:async function(opts){probeArgs=Object.assign({},opts);return{ok:true,model:opts.model,elapsedMs:12,transport:'direct'};},resolveModelCapabilities:async function(){return{reasoningStatus:'unknown',source:'provider default'};}};
    LF.UI=activityUI(events);
    try{const models=await LF.AISettings.detectModel();assert(models,[configured],'verified configured model remains available after catalogue fallback');assert(probeArgs.model,configured,'configured OpenRouter model receives the authoritative chat probe');assert(!!lastEvent(events,'finish'),true,'successful live probe finishes Detect');assert(/catalogue could not be read/i.test(lastEvent(events,'finish').payload.response),true,'fallback is disclosed rather than hidden');}
    finally{LF.AI=oldAI;LF.UI=oldUI;form.restore();localStorage.clear();}
  };

  t['Detect cannot report success when the real provider probe fails even after catalogue discovery']=async function(){
    localStorage.clear();const form=installForm(LF,{provider:'openrouter',endpoint:LF.AIProviders.openrouter.endpoint,apiKey:'or-key',model:LF.AIProviders.openrouter.model});
    const oldAI=LF.AI,oldUI=LF.UI;let events=[];
    LF.AI={listModels:async function(){return{models:[LF.AIProviders.openrouter.model],entries:[],loadedModels:[]};},testConnection:async function(){throw new Error('network unreachable');},resolveModelCapabilities:async function(){throw new Error('must not reach capabilities');}};
    LF.UI=activityUI(events);
    try{const result=await LF.AISettings.detectModel();assert(result,[],'probe failure is failed Detect');assert(!!lastEvent(events,'error'),true,'probe failure uses Action Totem error');assert(!!lastEvent(events,'finish'),false,'no false successful Action Totem');}
    finally{LF.AI=oldAI;LF.UI=oldUI;form.restore();localStorage.clear();}
  };


  t['Detect uses an exact llama.cpp LAN endpoint and requires both catalogue and chat probe']=async function(){
    localStorage.clear();const endpoint='http://fedora.local:8080/v1',form=installForm(LF,{provider:'llamacpp',endpoint:endpoint,apiKey:'',model:''});
    const oldAI=LF.AI,oldUI=LF.UI;let listArgs=null,probeArgs=null,events=[];
    LF.AI={listModels:async function(provider,url,key){listArgs={provider:provider,endpoint:url,key:key};return{models:['local/model'],loadedModels:['local/model'],entries:[]};},testConnection:async function(opts){probeArgs=Object.assign({},opts);return{ok:true,model:opts.model};},resolveModelCapabilities:async function(){return{source:'test'};}};
    LF.UI=activityUI(events);
    try{const models=await LF.AISettings.detectModel();assert(models,['local/model'],'LAN model discovered');assert(listArgs,{provider:'llamacpp',endpoint:endpoint,key:''},'llama.cpp catalogue uses visible LAN endpoint');assert(probeArgs.provider,'llamacpp','probe provider');assert(probeArgs.endpoint,endpoint,'probe exact LAN endpoint');assert(probeArgs.model,'local/model','probe returned LAN model');assert(!!lastEvent(events,'finish'),true,'LAN Detect finishes Action Totem');assert(events.some(function(e){return e.kind==='message';}),false,'LAN Detect does not use Message Totem');}
    finally{LF.AI=oldAI;LF.UI=oldUI;form.restore();localStorage.clear();}
  };

  t['Every built-in provider requiring credentials fails Detect before AI calls when its visible key is empty']=async function(){
    const required=LF.AIProviderList.filter(function(provider){return provider.keyRequired===true;}).map(function(provider){return provider.id;});
    const oldAI=LF.AI,oldUI=LF.UI;let calls=0,events=[];LF.AI={listModels:async function(){calls++;return{models:['x']};},testConnection:async function(){calls++;return{ok:true};}};LF.UI=activityUI(events);
    try{for(const providerId of required){localStorage.clear();events.length=0;const p=LF.AIProviders[providerId],form=installForm(LF,{provider:providerId,endpoint:p.endpoint,apiKey:'',model:p.model||''});try{const result=await LF.AISettings.detectModel();assert(result,[],providerId+' Detect fails');assert(!!lastEvent(events,'error'),true,providerId+' ends in Action Totem error');assert(/API key/i.test(lastEvent(events,'error').payload.response),true,providerId+' explains missing key');assert(events.some(function(e){return e.kind==='message';}),false,providerId+' does not emit Message Totem');}finally{form.restore();}}assert(calls,0,'no provider network helper called without required credentials');}
    finally{LF.AI=oldAI;LF.UI=oldUI;localStorage.clear();}
  };

  t['Local provider display names never expose a local suffix']=function(){
    ['ollama','lmstudio','llamacpp'].forEach(function(id){assert(/\(local\)/i.test(LF.AIProviders[id].name),false,id+' display name');});
  };

  t['Save & test does not persist visible settings when the live probe fails']=async function(){
    localStorage.clear();LF.Storage.saveAiSettings({provider:'openai',endpoint:'https://saved.example/v1/chat/completions',model:'saved-model'});LF.Storage.saveApiKey('saved-key','openai',{endpoint:'https://saved.example/v1/chat/completions',remember:true});
    const form=installForm(LF,{provider:'openrouter',endpoint:'https://broken.example/v1/chat/completions',apiKey:'bad-key',model:'broken-model'}),button=makeElement('');button.textContent='Save & test';
    const oldAI=LF.AI,oldUI=LF.UI;let events=[];
    LF.AI={testConnection:async function(){const error=new Error('Failed to fetch');error.isNetwork=true;error.providerId='openrouter';error.phase='chat';throw error;}};
    LF.UI=activityUI(events);
    try{await LF.AISettings.testConnection(button);const saved=LF.Storage.getAiSettings();assert(saved.provider,'openai','previous provider retained');assert(saved.endpoint,'https://saved.example/v1/chat/completions','previous endpoint retained');assert(saved.model,'saved-model','previous model retained');assert(LF.Storage.getApiKey('openai','https://saved.example/v1/chat/completions'),'saved-key','previous key retained');assert(!!lastEvent(events,'error'),true,'failure uses Action Totem');assert(events.some(function(e){return e.kind==='message';}),false,'Save & test does not use Message Totem');}
    finally{LF.AI=oldAI;LF.UI=oldUI;form.restore();localStorage.clear();}
  };

  t['GLM Save persists the selected provider instead of reverting to the previously saved local provider']=function(){
    localStorage.clear();LF.Storage.saveAiSettings({provider:'llamacpp',endpoint:LF.AIProviders.llamacpp.endpoint,model:'local-model',thinkingMode:'auto',streaming:true,inactivityTimeoutMs:90000,maxOutputTokensCap:0});
    const form=installForm(LF,{provider:'glm',endpoint:LF.AIProviders.glm.endpoint,apiKey:'glm-key',model:'glm-4.7-flash'});
    const oldUI=LF.UI;LF.UI={message:function(){}};
    try{const saved=LF.AISettings.saveFromForm({toast:false});assert(saved.provider,'glm','visible GLM provider persisted');assert(saved.endpoint,LF.AIProviders.glm.endpoint,'GLM endpoint persisted');assert(saved.model,'glm-4.7-flash','GLM model persisted');assert(LF.Storage.getAiSettings().provider,'glm','stored provider remains GLM');}
    finally{LF.UI=oldUI;form.restore();localStorage.clear();}
  };

  t['GLM Save & test probes and persists the exact visible GLM configuration']=async function(){
    localStorage.clear();LF.Storage.saveAiSettings({provider:'llamacpp',endpoint:LF.AIProviders.llamacpp.endpoint,model:'local-model',thinkingMode:'auto',streaming:true,inactivityTimeoutMs:90000,maxOutputTokensCap:0});
    const form=installForm(LF,{provider:'glm',endpoint:LF.AIProviders.glm.endpoint,apiKey:'glm-key',model:'glm-4.7-flash'}),button=makeElement('');button.textContent='Save & test';
    const oldAI=LF.AI,oldUI=LF.UI;let probeArgs=null,events=[];
    LF.AI={testConnection:async function(opts){probeArgs=Object.assign({},opts);return{ok:true,model:opts.model,elapsedMs:8,transport:'direct'};}};LF.UI=activityUI(events);
    try{await LF.AISettings.testConnection(button);const saved=LF.Storage.getAiSettings();assert(probeArgs.provider,'glm','GLM is probed');assert(probeArgs.endpoint,LF.AIProviders.glm.endpoint,'GLM endpoint is probed');assert(probeArgs.model,'glm-4.7-flash','GLM model is probed');assert(probeArgs.apiKey,'glm-key','GLM key is probed');assert(saved.provider,'glm','GLM remains selected after persistence');assert(saved.endpoint,LF.AIProviders.glm.endpoint,'saved GLM endpoint');assert(saved.model,'glm-4.7-flash','saved GLM model');}
    finally{LF.AI=oldAI;LF.UI=oldUI;form.restore();localStorage.clear();}
  };

  t['Save & test stores and probes the exact visible configuration through the Action Totem']=async function(){
    localStorage.clear();const form=installForm(LF,{provider:'openrouter',endpoint:'https://visible-save.example/v1/chat/completions',apiKey:'save-key',model:'meta/model'}),button=makeElement('');button.textContent='Save & test';
    const oldAI=LF.AI,oldUI=LF.UI;let probeArgs=null,events=[];
    LF.AI={testConnection:async function(opts){probeArgs=Object.assign({},opts);return{ok:true,model:opts.model};}};
    LF.UI=activityUI(events);
    try{await LF.AISettings.testConnection(button);const saved=LF.Storage.getAiSettings();assert(saved.provider,'openrouter','saved provider');assert(saved.endpoint,'https://visible-save.example/v1/chat/completions','saved endpoint');assert(saved.model,'meta/model','saved model');assert(probeArgs.provider,'openrouter','probe provider');assert(probeArgs.endpoint,saved.endpoint,'probe exact endpoint');assert(probeArgs.model,saved.model,'probe exact model');assert(probeArgs.apiKey,'save-key','probe exact current key');assert(!!lastEvent(events,'start'),true,'Save & test opens Action Totem');assert(!!lastEvent(events,'finish'),true,'Save & test finishes Action Totem');assert(events.some(function(e){return e.kind==='message';}),false,'Save & test does not use Message Totem');}
    finally{LF.AI=oldAI;LF.UI=oldUI;form.restore();localStorage.clear();}
  };
  t['GLM Detect reports Zhipu 1305 as a rate limit rather than a local-network failure']=async function(){
    localStorage.clear();const form=installForm(LF,{provider:'glm',endpoint:LF.AIProviders.glm.endpoint,apiKey:'glm-key',model:'glm-4.7-flash'});const oldAI=LF.AI,oldUI=LF.UI;let events=[];
    LF.AI={testConnection:async function(){return{ok:false,reachable:true,rateLimited:true,status:429,providerCode:'1305',providerMessage:'traffic limit',retryAfterMs:0};},resolveModelCapabilities:async function(){throw new Error('must not resolve capabilities');}};LF.UI=activityUI(events);
    try{const result=await LF.AISettings.detectModel();assert(result,[],'rate limited Detect returns no catalogue');const failure=lastEvent(events,'error');assert(!!failure,true,'rate limit uses Action Totem error');assert(failure.payload.message,'Rate limit','rate limit category preserved');assert(/1305|traffic/i.test(failure.payload.response),true,'Zhipu traffic-limit code is visible');assert(/Local endpoint unreachable/i.test(failure.payload.message||''),false,'must not be classified as local endpoint');}
    finally{LF.AI=oldAI;LF.UI=oldUI;form.restore();localStorage.clear();}
  };
  t['GLM connection probe has a finite hard timeout']=function(){assert(LF.AIProviders.glm.connectionTestTimeoutMs<=30000,true,'GLM connection test deadline');};

};
