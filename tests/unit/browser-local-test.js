'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/core.js');
require('../../assets/js/ai/providers.js');
require('../../assets/js/storage.js');

const LF=global.LabFlow;
let cached=[];
let mode='normal';
let loadOptions=[];
let downloads=0;
let inferenceFailures=0;

class FakeModel{
  constructor(url,size){this.url=url;this.size=size||229000000;this.valid=true;}
  validate(){return this.valid?'valid':'invalid';}
  async remove(){this.valid=false;cached=cached.filter(item=>item!==this);}
}
class FakeWllama{
  constructor(){
    this.loaded=false;
    this.modelManager={
      getModels:async()=>cached.slice(),
      getModelOrDownload:async(source,options)=>{
        downloads++;
        const url=source&&source.url||String(source||'');
        if(options&&options.progressCallback){
          options.progressCallback({loaded:100,total:200});
          options.progressCallback({loaded:200,total:200});
        }
        let model=cached.find(item=>item.url===url);
        if(!model){model=new FakeModel(url);cached.push(model);}
        return model;
      },
      clear:async()=>{cached=[];}
    };
  }
  isSupportWebGPU(){return true;}
  isModelLoaded(){return this.loaded;}
  async loadModel(_model,options){
    loadOptions.push(Object.assign({},options));
    if(mode==='load-fail-gpu'&&Number(options&&options.n_gpu_layers)>0)throw new Error('fake WebGPU load failure');
    this.loaded=true;
    this.cpu=Number(options&&options.n_gpu_layers)===0;
  }
  async createChatCompletion(request){
    const warm=request&&request.messages&&request.messages[0]&&request.messages[0].content==='Reply with exactly: OK';
    if(mode==='infer-fail-gpu'&&!this.cpu&&!warm&&inferenceFailures===0){inferenceFailures++;throw new Error('fake WebGPU inference failure');}
    if(request&&request.stream){
      return (async function*(){
        yield {choices:[{delta:{content:'hel'}}]};
        yield {choices:[{delta:{content:'lo'},finish_reason:'stop'}],usage:{prompt_tokens:10,completion_tokens:2,total_tokens:12}};
      }());
    }
    return {choices:[{message:{content:warm?'OK':'hello'},finish_reason:'stop'}],usage:{prompt_tokens:3,completion_tokens:1,total_tokens:4}};
  }
  async exit(){this.loaded=false;}
}
LF.__browserLocalModuleLoader=async()=>({Wllama:FakeWllama});
require('../../assets/js/ai/browser-local.js');

function assert(value,expected,message){
  if(arguments.length===2){message=expected;expected=true;}
  if(typeof expected==='object'&&expected!==null){
    if(JSON.stringify(value)!==JSON.stringify(expected))throw new Error(message+' · '+JSON.stringify(value));
    return;
  }
  if(value!==expected)throw new Error((message||'assertion failed')+' · '+String(value)+' !== '+String(expected));
}
function resetSettings(){
  localStorage.clear();
  LF.Storage.saveAiSettings({
    provider:'browserlocal',endpoint:'browser://local',model:'lfm2.5-350m-q4_k_m',
    streaming:true,thinkingMode:'off',browserLocalAutoDownload:true,browserLocalAutoWarmup:true,
    browserLocalPreferWebGPU:true,browserLocalContextWindow:4096
  });
}
module.exports=function(t){
  t['Browser Local default is one official GGUF model']=function(){
    const model=LF.BrowserLocal.defaultModel;
    assert(model.id,'lfm2.5-350m-q4_k_m','default model id');
    assert(/LFM2\.5-350M-Q4_K_M\.gguf$/.test(model.url),true,'default GGUF URL');
    assert(model.sha256,'7e6f72643caafc9a68256686638c4d7916f2cec76d1df478d4c3ddcd95a6aed4','default SHA-256 metadata');
    assert(LF.BrowserLocal.catalog().length,1,'fresh catalogue size');
  };

  t['startup downloads the missing GGUF, loads WebGPU and warms once']=async function(){
    cached=[];mode='normal';loadOptions=[];downloads=0;inferenceFailures=0;resetSettings();
    await LF.BrowserLocal._resetForTests();
    const ready=await LF.BrowserLocal.startup();
    assert(ready.status,'ready','ready status');
    assert(ready.cached,true,'cached after startup');
    assert(ready.loaded,true,'loaded after startup');
    assert(ready.warmed,true,'warmed after startup');
    assert(ready.backend,'WebGPU','WebGPU preferred');
    assert(downloads,1,'one model download');
    assert(loadOptions.some(item=>item.n_gpu_layers===99999),true,'GPU layers requested');
  };

  t['WebGPU load failure falls back to WASM CPU on the same cached GGUF']=async function(){
    cached=[];mode='load-fail-gpu';loadOptions=[];downloads=0;resetSettings();
    await LF.BrowserLocal._resetForTests();
    const ready=await LF.BrowserLocal.ensureReady({force:true});
    assert(ready.status,'ready','fallback ready');
    assert(ready.backend,'WASM CPU','CPU fallback backend');
    assert(loadOptions.some(item=>item.n_gpu_layers===99999),true,'GPU attempted');
    assert(loadOptions.some(item=>item.n_gpu_layers===0),true,'CPU fallback attempted');
    assert(downloads,1,'same model downloaded once');
  };

  t['WebGPU inference failure before output retries once on WASM CPU']=async function(){
    cached=[];mode='infer-fail-gpu';loadOptions=[];downloads=0;inferenceFailures=0;resetSettings();
    await LF.BrowserLocal._resetForTests();
    await LF.BrowserLocal.ensureReady({force:true});
    const result=await LF.BrowserLocal.chat({messages:[{role:'user',content:'test'}],maxTokens:16,stream:true});
    assert(result.content,'hello','fallback response');
    assert(result.backend,'WASM CPU','inference fallback backend');
    assert(inferenceFailures,1,'single GPU inference failure');
    assert(loadOptions.some(item=>item.n_gpu_layers===0),true,'CPU was loaded after inference failure');
  };

  t['custom GGUF definitions are catalogue-only until downloaded']=async function(){
    localStorage.removeItem('labflow.browser-local.models');
    const custom=LF.BrowserLocal.addModel('https://models.example/research-small-Q4_K_M.gguf','Research Small');
    assert(custom.bundled,false,'custom marker');
    assert(LF.BrowserLocal.catalog().length,2,'catalogue includes custom model');
    LF.BrowserLocal.removeModelDefinition(custom.id);
    assert(LF.BrowserLocal.catalog().length,1,'custom model definition removed');
  };
};
