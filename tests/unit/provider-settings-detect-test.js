'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/core.js');
require('../../assets/js/storage.js');
require('../../assets/js/ai/providers.js');
require('../../assets/js/ai/settings.js');
function assert(actual,expected,label){if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error((label||'assert')+': expected '+JSON.stringify(expected)+' got '+JSON.stringify(actual));}

function makeElement(value){return{value:value==null?'':String(value),textContent:'',hidden:false,disabled:false,checked:true,dataset:{},options:[],children:[],className:'',placeholder:'',replaceChildren:function(){this.options=[];this.children=[];},appendChild:function(node){this.children.push(node);if(node&&node.tagName==='OPTION')this.options.push(node);},setAttribute:function(name,val){this[name]=String(val);},removeAttribute:function(name){delete this[name];},focus:function(){this.focused=true;},closest:function(){return null;}};}
function installForm(LF,values){
  values=values||{};
  const elements={
    aiProvider:makeElement(values.provider||'nvidia'),
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
  t['Detect uses the visible unsaved NVIDIA endpoint/key, discovers a model, then requires a real chat probe']=async function(){
    localStorage.clear();localStorage.setItem('labflow.ai.settings',JSON.stringify({provider:'zai',endpoint:'https://saved.invalid/v1',model:'saved-model'}));
    const form=installForm(LF,{provider:'nvidia',endpoint:'https://visible.example/v1/chat/completions',apiKey:'visible-key',model:''});
    const oldAI=LF.AI,oldUI=LF.UI;let listArgs=null,probeArgs=null,messages=[];
    LF.AI={
      listModels:async function(provider,endpoint,key){listArgs={provider:provider,endpoint:endpoint,key:key};return{models:[LF.AIProviders.nvidia.model,'meta/other'],entries:[],loadedModels:[]};},
      testConnection:async function(opts){probeArgs=Object.assign({},opts);return{ok:true,model:opts.model};},
      resolveModelCapabilities:async function(){return{source:'test'};}
    };
    LF.UI={message:function(message,type,title){messages.push({message:message,type:type,title:title});}};
    try{
      const models=await LF.AISettings.detectModel();
      assert(models,[LF.AIProviders.nvidia.model,'meta/other'],'discovered models');
      assert(listArgs,{provider:'nvidia',endpoint:'https://visible.example/v1/chat/completions',key:'visible-key'},'catalogue uses visible unsaved values');
      assert(probeArgs.provider,'nvidia','probe provider');assert(probeArgs.endpoint,'https://visible.example/v1/chat/completions','probe endpoint');assert(probeArgs.apiKey,'visible-key','probe key');assert(probeArgs.model,LF.AIProviders.nvidia.model,'discovered model is really probed');
      assert(messages[messages.length-1].type,'success','Detect success uses Message Totem');
    }finally{LF.AI=oldAI;LF.UI=oldUI;form.restore();localStorage.clear();}
  };

  t['Detect fails closed before network access when a required provider key is missing']=async function(){
    localStorage.clear();const form=installForm(LF,{provider:'nvidia',endpoint:LF.AIProviders.nvidia.endpoint,apiKey:'',model:''});
    const oldAI=LF.AI,oldUI=LF.UI;let networkCalls=0,messages=[];
    LF.AI={listModels:async function(){networkCalls++;return{models:['x']};},testConnection:async function(){networkCalls++;return{ok:true};}};
    LF.UI={message:function(message,type,title){messages.push({message:message,type:type,title:title});}};
    try{const result=await LF.AISettings.detectModel();assert(result,[],'failed Detect returns empty list');assert(networkCalls,0,'missing key blocks network work');assert(messages.length,1,'one Message Totem');assert(messages[0].type,'error','error Message Totem');assert(/API key/i.test(messages[0].message),true,'key error is explicit');}
    finally{LF.AI=oldAI;LF.UI=oldUI;form.restore();localStorage.clear();}
  };

  t['Detect cannot report success when the real provider probe fails even after catalogue discovery']=async function(){
    localStorage.clear();const form=installForm(LF,{provider:'nvidia',endpoint:LF.AIProviders.nvidia.endpoint,apiKey:'nv-key',model:LF.AIProviders.nvidia.model});
    const oldAI=LF.AI,oldUI=LF.UI;let messages=[];
    LF.AI={listModels:async function(){return{models:[LF.AIProviders.nvidia.model],entries:[],loadedModels:[]};},testConnection:async function(){throw new Error('network unreachable');},resolveModelCapabilities:async function(){throw new Error('must not reach capabilities');}};
    LF.UI={message:function(message,type,title){messages.push({message:message,type:type,title:title});}};
    try{const result=await LF.AISettings.detectModel();assert(result,[],'probe failure is failed Detect');assert(messages[messages.length-1].type,'error','probe failure Message Totem');assert(messages.some(function(item){return item.type==='success';}),false,'no false green state');}
    finally{LF.AI=oldAI;LF.UI=oldUI;form.restore();localStorage.clear();}
  };


  t['Detect uses an exact llama.cpp LAN endpoint and requires both catalogue and chat probe']=async function(){
    localStorage.clear();const endpoint='http://fedora.local:8080/v1',form=installForm(LF,{provider:'llamacpp',endpoint:endpoint,apiKey:'',model:''});
    const oldAI=LF.AI,oldUI=LF.UI;let listArgs=null,probeArgs=null,messages=[];
    LF.AI={listModels:async function(provider,url,key){listArgs={provider:provider,endpoint:url,key:key};return{models:['local/model'],loadedModels:['local/model'],entries:[]};},testConnection:async function(opts){probeArgs=Object.assign({},opts);return{ok:true,model:opts.model};},resolveModelCapabilities:async function(){return{source:'test'};}};
    LF.UI={message:function(message,type,title){messages.push({message:message,type:type,title:title});}};
    try{const models=await LF.AISettings.detectModel();assert(models,['local/model'],'LAN model discovered');assert(listArgs,{provider:'llamacpp',endpoint:endpoint,key:''},'llama.cpp catalogue uses visible LAN endpoint');assert(probeArgs.provider,'llamacpp','probe provider');assert(probeArgs.endpoint,endpoint,'probe exact LAN endpoint');assert(probeArgs.model,'local/model','probe returned LAN model');assert(messages[messages.length-1].type,'success','LAN Detect result uses Message Totem');}
    finally{LF.AI=oldAI;LF.UI=oldUI;form.restore();localStorage.clear();}
  };

  t['Every built-in provider requiring credentials fails Detect before AI calls when its visible key is empty']=async function(){
    const required=LF.AIProviderList.filter(function(provider){return provider.keyRequired===true;}).map(function(provider){return provider.id;});
    const oldAI=LF.AI,oldUI=LF.UI;let calls=0,messages=[];LF.AI={listModels:async function(){calls++;return{models:['x']};},testConnection:async function(){calls++;return{ok:true};}};LF.UI={message:function(message,type,title){messages.push({message:message,type:type,title:title});}};
    try{for(const providerId of required){localStorage.clear();messages=[];const p=LF.AIProviders[providerId],form=installForm(LF,{provider:providerId,endpoint:p.endpoint,apiKey:'',model:''});try{const result=await LF.AISettings.detectModel();assert(result,[],providerId+' Detect fails');assert(messages.length,1,providerId+' emits one Message Totem');assert(messages[0].type,'error',providerId+' Totem is error');assert(/API key/i.test(messages[0].message),true,providerId+' explains missing key');}finally{form.restore();}}assert(calls,0,'no provider network helper called without required credentials');}
    finally{LF.AI=oldAI;LF.UI=oldUI;localStorage.clear();}
  };

  t['Local provider display names never expose a local suffix']=function(){
    ['ollama','lmstudio','llamacpp'].forEach(function(id){assert(/\(local\)/i.test(LF.AIProviders[id].name),false,id+' display name');});
  };

  t['Save & test does not persist visible settings when the live probe fails']=async function(){
    localStorage.clear();LF.Storage.saveAiSettings({provider:'zai',endpoint:'https://saved.example/v1/chat/completions',model:'saved-model'});LF.Storage.saveApiKey('saved-key','zai');
    const form=installForm(LF,{provider:'nvidia',endpoint:'https://broken.example/v1/chat/completions',apiKey:'bad-key',model:'broken-model'}),button=makeElement('');button.textContent='Save & test';
    const oldAI=LF.AI,oldUI=LF.UI;let messages=[];
    LF.AI={testConnection:async function(){const error=new Error('Failed to fetch');error.isNetwork=true;error.providerId='nvidia';error.phase='chat';throw error;}};
    LF.UI={message:function(message,type,title){messages.push({message:message,type:type,title:title});}};
    try{await LF.AISettings.testConnection(button);const saved=LF.Storage.getAiSettings();assert(saved.provider,'zai','previous provider retained');assert(saved.endpoint,'https://saved.example/v1/chat/completions','previous endpoint retained');assert(saved.model,'saved-model','previous model retained');assert(LF.Storage.getApiKey('zai'),'saved-key','previous key retained');assert(messages[messages.length-1].type,'error','failure uses Message Totem');}
    finally{LF.AI=oldAI;LF.UI=oldUI;form.restore();localStorage.clear();}
  };

  t['Save & test stores and probes the exact visible configuration and reports through Message Totem']=async function(){
    localStorage.clear();const form=installForm(LF,{provider:'nvidia',endpoint:'https://visible-save.example/v1/chat/completions',apiKey:'save-key',model:'meta/model'}),button=makeElement('');button.textContent='Save & test';
    const oldAI=LF.AI,oldUI=LF.UI;let probeArgs=null,messages=[];
    LF.AI={testConnection:async function(opts){probeArgs=Object.assign({},opts);return{ok:true,model:opts.model};}};
    LF.UI={message:function(message,type,title){messages.push({message:message,type:type,title:title});}};
    try{await LF.AISettings.testConnection(button);const saved=LF.Storage.getAiSettings();assert(saved.provider,'nvidia','saved provider');assert(saved.endpoint,'https://visible-save.example/v1/chat/completions','saved endpoint');assert(saved.model,'meta/model','saved model');assert(probeArgs.provider,'nvidia','probe provider');assert(probeArgs.endpoint,saved.endpoint,'probe exact endpoint');assert(probeArgs.model,saved.model,'probe exact model');assert(probeArgs.apiKey,'save-key','probe exact current key');assert(messages[messages.length-1].type,'success','success Message Totem');}
    finally{LF.AI=oldAI;LF.UI=oldUI;form.restore();localStorage.clear();}
  };
};
