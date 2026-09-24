'use strict';
/*
 * Browser Local model select contract: option labels are the catalogue names (never the cache key),
 * and picking a model — including a freshly added one — runs the compatibility check automatically.
 */
const path=require('path');
function assert(value,expected,label){
  if(arguments.length===2){label=expected;expected=true;}
  if(value!==expected)throw new Error((label||'assertion failed')+' · '+String(value));
}
function delay(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});}

const LF=global.LabFlow=global.LabFlow||{};
const CATALOGUE=[
  {id:'lfm2.5-350m-q4_k_m',name:'LFM2.5 350M · Q4_K_M',bundled:true},
  {id:'qwen3-0.6b-q8_0',name:'Qwen3 0.6B · Q8_0',bundled:false}
];

// Minimal form DOM: syncModelControls only needs the fields it reads or rebuilds.
const nodes={};
function node(id){
  return{id:id,value:'',hidden:false,textContent:'',disabled:false,dataset:{},options:[],
    setAttribute:function(key,val){this[key]=val;},
    closest:function(){return{dataset:{}};},
    appendChild:function(option){this.options.push(option);},
    replaceChildren:function(){this.options=[];}};
}
['aiProvider','aiModel','aiModelSelect','detectProviderModel','aiModelHint','aiKey'].forEach(function(id){nodes[id]=node(id);});
global.document={
  getElementById:function(id){return nodes[id]||null;},
  createElement:function(){return{value:'',textContent:''};},
  addEventListener:function(){}
};

LF.Logger={scope:function(){return{info:function(){},warn:function(){},error:function(){}};}};
LF.Core=LF.Core||{}; // modelDisplayName mirrors core.js: browser-local ids stay raw unless the catalogue names them.
LF.Core.modelDisplayName=function(providerId,model){return String(model==null?'':model);};
LF.Core.escapeHtml=LF.Core.escapeHtml||function(value){return String(value==null?'':value);};
LF.AIProviders={browserlocal:{id:'browserlocal',name:'Browser Local · GGUF',local:true,browserRuntime:true,endpoint:'browser://local',
  model:'lfm2.5-350m-q4_k_m',keyRequired:false,modelSelect:true,modelSelectLabel:'Cached / configured GGUF model'}};
const writes=[],checks=[],refreshes=[],messages=[];
LF.Storage={
  getAiSettings:function(){return{provider:'browserlocal',endpoint:'browser://local',model:writes.length?writes[writes.length-1].model:'lfm2.5-350m-q4_k_m'};},
  saveAiSettings:function(settings){writes.push({model:settings.model});}
};
LF.BrowserLocal={
  catalog:function(){return CATALOGUE.slice();},
  hasModel:function(id){return CATALOGUE.some(function(row){return row.id===id;});},
  compatibility:async function(id){checks.push(id);return{ok:true,architecture:'llama',quantization:'Q4_K_M',problems:[],warnings:[]};},
  refreshCache:async function(){refreshes.push(true);return{};}
};
LF.UI={message:function(message,type){messages.push({message:message,type:type});}};

require(path.join(__dirname,'../../assets/js/ai/settings.js'));
require(path.join(__dirname,'../../assets/js/controllers/settings-controller.js'));

function reset(){checks.length=0;refreshes.length=0;messages.length=0;writes.length=0;nodes.aiProvider.value='browserlocal';nodes.aiModelSelect.value='';nodes.aiModel.value='';}

module.exports=function(t){
  t['Browser Local select options carry catalogue names, not cache keys']=function(){
    nodes.aiProvider.value='browserlocal';
    LF.AISettings.syncModelControls(['lfm2.5-350m-q4_k_m','qwen3-0.6b-q8_0']);
    const option=function(value){return nodes.aiModelSelect.options.filter(function(item){return item.value===value;})[0];};
    assert(option('lfm2.5-350m-q4_k_m').textContent,'LFM2.5 350M · Q4_K_M','bundled model name');
    assert(option('qwen3-0.6b-q8_0').textContent,'Qwen3 0.6B · Q8_0','catalogue model name');
    // A model outside the catalogue has no friendly name yet: the id is the only honest label.
    LF.AISettings.syncModelControls(['lfm2.5-350m-q4_k_m','unknown-model']);
    assert(option('unknown-model').textContent,'unknown-model','unknown id falls back to itself');
  };

  t['Check compatibility reuses one path and refreshes the cache inventory']=async function(){
    reset();
    nodes.aiModelSelect.value='qwen3-0.6b-q8_0';
    const target={id:'browserLocalCheckModel',
      closest:function(selector){return selector.indexOf('#browserLocalCheckModel')>=0?target:null;}};
    let renders=0;
    await LF.SettingsController.handleClick({target:target},{state:{state:{}},render:function(){renders++;}});
    assert(checks.join(','),'qwen3-0.6b-q8_0','selected model checked');
    assert(refreshes.length,1,'cache inventory refreshed');
    assert(renders,1,'panel re-rendered');
    assert(messages[0]&&messages[0].type,'success','compatibility reported');
  };

  t['Selecting a model checks it automatically and makes it current']=async function(){
    reset();
    nodes.aiModel.value='lfm2.5-350m-q4_k_m';
    let renders=0;
    const handled=LF.SettingsController.handleChange({target:{id:'aiModelSelect',value:'qwen3-0.6b-q8_0'}},{state:{state:{}},render:function(){renders++;}});
    assert(handled,true,'change handled');
    assert(nodes.aiModel.value,'qwen3-0.6b-q8_0','hidden input mirrors the select');
    await delay(320);
    assert(checks.join(','),'qwen3-0.6b-q8_0','automatic compatibility check');
    assert(refreshes.length,1,'automatic cache refresh');
    assert(renders,1,'automatic re-render');
    assert(writes.length&&writes[writes.length-1].model,'qwen3-0.6b-q8_0','selected model persisted');
    assert(messages.length,0,'automatic check stays quiet');
  };

  t['A stale catalogue id is never checked or saved']=async function(){
    reset();
    const handled=LF.SettingsController.handleChange({target:{id:'aiModelSelect',value:'removed-model'}},{state:{state:{}},render:function(){}});
    assert(handled,true,'change handled');
    await delay(260);
    assert(checks.length,0,'unknown model is not checked');
    assert(writes.length,0,'unknown model is not persisted');
  };

  t['Another provider with a matching name never triggers the Browser Local check']=async function(){
    reset();
    LF.AIProviders.ollama={id:'ollama',name:'Ollama',local:true,modelSelect:true};
    nodes.aiProvider.value='ollama';
    LF.SettingsController.handleChange({target:{id:'aiModelSelect',value:'lfm2.5-350m-q4_k_m'}},{state:{state:{}},render:function(){}});
    await delay(260);
    assert(checks.length,0,'no browser-local check for another provider');
    assert(writes.length,0,'another provider keeps its own save flow');
  };
  return t;
};
