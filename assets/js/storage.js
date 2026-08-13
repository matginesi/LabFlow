(function(){
  'use strict';
  const LF=window.LabFlow=window.LabFlow||{};
  const Log=LF.Logger.scope('storage');
  function read(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch(err){Log.warn('local.read-failed',{key:key,error:err});return fallback;}}
  function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(err){Log.warn('local.write-failed',{key:key,error:err});return false;}}
  function getAiSettings(){
    const defaults={provider:'zai',endpoint:'https://api.z.ai/api/paas/v4/chat/completions',model:'glm-4.7-flash',temperature:0.7,thinking:false,streaming:true,inactivityTimeoutMs:90000};
    const out=Object.assign({},defaults,read('labflow.ai.settings',{}));out.endpoint=String(out.endpoint||'').replace(/\/chat\/completions(?:\/chat\/completions)+\/?$/i,'/chat/completions');if(out.provider==='zai'&&/api\.z\.ai\/api\/paas\/v4\/?$/i.test(out.endpoint))out.endpoint=out.endpoint.replace(/\/?$/,'/chat/completions');out.thinking=false;out.streaming=out.streaming!==false;out.inactivityTimeoutMs=Math.max(15000,Math.min(600000,Number(out.inactivityTimeoutMs)||90000));return out;
  }
  function saveAiSettings(v){write('labflow.ai.settings',v);Log.info('ai-settings.saved',{provider:v&&v.provider,model:v&&v.model});}
  function getAssistantSettings(){const d={memoryEnabled:true,memoryTurns:6,memoryChars:6000,messageChars:1800,contextChars:12000,maxOutputTokens:8000,temperature:0.4},o=Object.assign({},d,read('labflow.assistant.settings',{}));o.memoryEnabled=o.memoryEnabled!==false;o.memoryTurns=Math.max(0,Math.min(20,Number(o.memoryTurns)||0));o.memoryChars=Math.max(500,Math.min(32000,Number(o.memoryChars)||d.memoryChars));o.messageChars=Math.max(250,Math.min(8000,Number(o.messageChars)||d.messageChars));o.contextChars=Math.max(2000,Math.min(48000,Number(o.contextChars)||d.contextChars));o.maxOutputTokens=Math.max(128,Math.min(32768,Number(o.maxOutputTokens)||d.maxOutputTokens));o.temperature=Math.max(0,Math.min(2,Number(o.temperature)));if(!Number.isFinite(o.temperature))o.temperature=d.temperature;return o;}
  function saveAssistantSettings(v){const next=Object.assign({},getAssistantSettings(),v||{});write('labflow.assistant.settings',next);return getAssistantSettings();}
  function getApiKey(){try{return localStorage.getItem('labflow.ai.key')||'';}catch(_){return'';}}
  function saveApiKey(key){try{if(key)localStorage.setItem('labflow.ai.key',key);else localStorage.removeItem('labflow.ai.key');}catch(err){Log.warn('api-key.save-failed',{error:err});}}
  function getEffectiveOperation(id){return LF.OperationRegistry&&LF.OperationRegistry.operation?LF.OperationRegistry.operation(id):null;}
  function getUserProfile(){return Object.assign({name:'Matteo Ginesi',organization:'',email:'',defaultAuthor:'Matteo Ginesi'},read('labflow.user.profile',{}));}
  function saveUserProfile(v){write('labflow.user.profile',Object.assign({},getUserProfile(),v||{}));}
  function getUiSettings(){return Object.assign({assistantOpen:true,theme:'instrument'},read('labflow.ui.settings',{}));}
  function saveUiSettings(v){write('labflow.ui.settings',Object.assign({},getUiSettings(),v||{}));}
  function getNomadSettings(){return Object.assign({instance:'NOMAD Central',endpoint:'https://nomad-lab.eu/prod/v1/api/v1',includeRaw:true,includeDerived:true,includeReport:true},read('labflow.nomad.settings',{}));}
  function saveNomadSettings(v){write('labflow.nomad.settings',v);}
  LF.Storage={getAiSettings:getAiSettings,saveAiSettings:saveAiSettings,getAssistantSettings:getAssistantSettings,saveAssistantSettings:saveAssistantSettings,getApiKey:getApiKey,saveApiKey:saveApiKey,getEffectiveOperation:getEffectiveOperation,getUserProfile:getUserProfile,saveUserProfile:saveUserProfile,getUiSettings:getUiSettings,saveUiSettings:saveUiSettings,getNomadSettings:getNomadSettings,saveNomadSettings:saveNomadSettings};
}());
