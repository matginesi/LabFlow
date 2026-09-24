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
let blobLoads=0;
let loadBytes=0;

function u32(value){const bytes=new Uint8Array(4);new DataView(bytes.buffer).setUint32(0,value,true);return bytes;}
function u64(value){const bytes=new Uint8Array(8);new DataView(bytes.buffer).setBigUint64(0,BigInt(value),true);return bytes;}
function ggufString(value){const encoded=new TextEncoder().encode(String(value));const out=new Uint8Array(8+encoded.length);new DataView(out.buffer).setBigUint64(0,BigInt(encoded.length),true);out.set(encoded,8);return out;}
function ggufHeader(options){
  options=options||{};
  const architecture=options.architecture||'llama';
  const pairs=[
    ['general.architecture',8,architecture],
    ['general.name',8,options.name||'Tiny Test'],
    ['general.file_type',4,options.fileType==null?15:options.fileType],
    [architecture+'.context_length',4,options.contextLength||4096]
  ];
  const chunks=[new Uint8Array([0x47,0x47,0x55,0x46]),u32(options.version||3),u64(0),u64(pairs.length)];
  pairs.forEach(function(pair){
    chunks.push(ggufString(pair[0]),u32(pair[1]));
    if(pair[1]===8)chunks.push(ggufString(pair[2]));
    else if(pair[1]===4)chunks.push(u32(pair[2]));
    else chunks.push(u64(pair[2]));
  });
  const total=chunks.reduce(function(sum,chunk){return sum+chunk.length;},0),out=new Uint8Array(total);
  let offset=0;chunks.forEach(function(chunk){out.set(chunk,offset);offset+=chunk.length;});
  return out;
}
function ggufFile(options,name){
  const bytes=ggufHeader(options);
  if(typeof File==='function')return new File([bytes],name||'tiny.gguf',{type:'application/octet-stream'});
  const blob=new Blob([bytes],{type:'application/octet-stream'});
  try{Object.defineProperty(blob,'name',{value:name||'tiny.gguf'});}catch(_){}
  return blob;
}

class FakeModel{
  constructor(url,size){this.url=url;this.size=size||229000000;this.valid=true;this.bytes=ggufHeader();}
  validate(){return this.valid?'valid':'invalid';}
  async open(){return [new Blob([this.bytes])];}
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
  getModelMetadata(){return {hparams:{nVocab:100,nCtxTrain:4096,nEmbd:64,nLayer:4},meta:{'general.architecture':'llama','general.name':'Fake Tiny','general.file_type':'15'}};}
  async loadModel(modelOrBlobs,options){
    loadOptions.push(Object.assign({},options));
    if(Array.isArray(modelOrBlobs)){blobLoads++;this.loadedFromBlob=true;loadBytes=(modelOrBlobs[0]&&modelOrBlobs[0].size)||0;}
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
    assert(custom.source,'url','URL source');
    assert(LF.BrowserLocal.catalog().length,2,'catalogue includes custom model');
    LF.BrowserLocal.removeModelDefinition(custom.id);
    assert(LF.BrowserLocal.catalog().length,1,'custom model definition removed');
  };

  t['GGUF compatibility inspection reads header metadata and rejects non-GGUF bytes']=function(){
    const good=LF.BrowserLocal.inspectGguf(ggufHeader({architecture:'lfm2',fileType:15,contextLength:8192}));
    assert(good.ok,true,'compatible header');
    assert(good.architecture,'lfm2','architecture');
    assert(good.quantization,'Q4_K_M','quantization label');
    assert(good.contextLength,8192,'context length');
    assert(good.version,3,'gguf version');
    const bad=LF.BrowserLocal.inspectGguf(new Uint8Array(32));
    assert(bad.ok,false,'non-GGUF bytes rejected');
    assert(bad.problems.length>0,true,'problem reported');
  };

  t['an uploaded GGUF joins the catalogue and loads through the local Blob path']=async function(){
    cached=[];mode='normal';loadOptions=[];downloads=0;inferenceFailures=0;blobLoads=0;loadBytes=0;resetSettings();
    await LF.BrowserLocal._resetForTests();
    localStorage.removeItem('labflow.browser-local.models');
    const file=ggufFile({architecture:'llama',contextLength:4096},'research-tiny-Q4_K_M.gguf');
    const row=await LF.BrowserLocal.addModelFromFile(file,'Research Tiny');
    assert(row.source,'file','file source');
    assert(LF.BrowserLocal.catalog().length,2,'catalogue includes the uploaded model');
    const settings=LF.Storage.getAiSettings();settings.model=row.id;LF.Storage.saveAiSettings(settings);
    const ready=await LF.BrowserLocal.ensureReady({force:true,autoDownload:false});
    assert(ready.status,'ready','uploaded model ready');
    assert(blobLoads,1,'wllama received the Blob payload');
    assert(loadBytes,file.size,'the uploaded file was used directly');
    assert(downloads,0,'no network download for an uploaded file');
    assert(ready.compatibility&&ready.compatibility.ok,true,'post-load compatibility report');
    const report=await LF.BrowserLocal.compatibility(row.id);
    assert(report.ok,true,'uploaded file compatibility');
    assert(report.architecture,'llama','uploaded architecture');
    LF.BrowserLocal.removeModelDefinition(row.id);
  };

  t['startup follows the selected custom URL model instead of the bundled default']=async function(){
    cached=[];mode='normal';loadOptions=[];downloads=0;inferenceFailures=0;blobLoads=0;resetSettings();
    await LF.BrowserLocal._resetForTests();
    localStorage.removeItem('labflow.browser-local.models');
    const custom=LF.BrowserLocal.addModel('https://models.example/research-small-Q4_K_M.gguf','Research Small');
    const settings=LF.Storage.getAiSettings();settings.model=custom.id;LF.Storage.saveAiSettings(settings);
    assert(LF.BrowserLocal.hasModel(custom.id),true,'catalogue knows the selected model');
    const ready=await LF.BrowserLocal.ensureReady({force:true,autoDownload:true});
    assert(downloads,1,'one download');
    assert(cached.some(function(m){return m.url===custom.url;}),true,'the selected model was downloaded');
    assert(cached.some(function(m){return m.url===LF.BrowserLocal.defaultModel.url;}),false,'the bundled default was not downloaded');
    assert(ready.status,'ready','ready with the selected model');
    assert(ready.modelName||LF.BrowserLocal.state().modelName,'Research Small','selected model name is reported');
    LF.BrowserLocal.removeModelDefinition(custom.id);
  };

  t['a stale selected model id fails closed instead of downloading the bundled default']=async function(){
    cached=[];mode='normal';loadOptions=[];downloads=0;inferenceFailures=0;resetSettings();
    await LF.BrowserLocal._resetForTests();
    localStorage.removeItem('labflow.browser-local.models');
    assert(LF.BrowserLocal.hasModel('gone'),false,'unknown id is not in the catalogue');
    const checked=await LF.BrowserLocal.check('gone');
    assert(checked.status,'error','unknown id reports an error state');
    assert(!!checked.error,true,'unknown id reports an actionable message');
    let message='';
    try{await LF.BrowserLocal.ensureReady({force:true,modelId:'gone'});}
    catch(error){message=String(error&&error.message||error);}
    assert(/not in the catalogue/.test(message),true,'ensureReady rejects the stale id');
    assert(downloads,0,'nothing was downloaded');
    assert(cached.length,0,'no model was cached');
  };

  t['a cached URL model can be inspected and removed through the cache inventory']=async function(){
    cached=[];mode='normal';loadOptions=[];downloads=0;inferenceFailures=0;resetSettings();
    await LF.BrowserLocal._resetForTests();
    localStorage.removeItem('labflow.browser-local.models');
    await LF.BrowserLocal.startup();
    const report=await LF.BrowserLocal.compatibility(LF.BrowserLocal.defaultModel.id);
    assert(report.ok,true,'cached model compatibility from cached bytes');
    await LF.BrowserLocal.refreshCache();
    const entries=LF.BrowserLocal.state().cacheEntries||[];
    assert(entries.some(function(item){return item.id===LF.BrowserLocal.defaultModel.id&&item.cached;}),true,'inventory lists the cached default model');
    await LF.BrowserLocal.removeCached(LF.BrowserLocal.defaultModel.id);
    const after=await LF.BrowserLocal.cacheInventory();
    assert(after.every(function(item){return !item.cached;}),true,'cache entry removed');
  };

  t['a detached uploaded file reports a compatibility problem instead of downloading']=async function(){
    cached=[];mode='normal';loadOptions=[];downloads=0;inferenceFailures=0;blobLoads=0;resetSettings();
    await LF.BrowserLocal._resetForTests();
    localStorage.removeItem('labflow.browser-local.models');
    const file=ggufFile({},'detached.gguf');
    const row=await LF.BrowserLocal.addModelFromFile(file,'Detached');
    await LF.BrowserLocal.removeCached(row.id);
    const report=await LF.BrowserLocal.compatibility(row.id);
    assert(report.ok,false,'detached file is not compatible');
    assert(/again/.test(report.problems.join(' ')),true,'re-attach guidance');
    const settings=LF.Storage.getAiSettings();settings.model=row.id;LF.Storage.saveAiSettings(settings);
    const state=await LF.BrowserLocal.ensureReady({force:true});
    assert(state.cached,false,'no cached bytes after detach');
    assert(downloads,0,'detached file never triggers a download');
    assert(cached.length,0,'the bundled default is not downloaded instead');
    LF.BrowserLocal.removeModelDefinition(row.id);
  };
};
