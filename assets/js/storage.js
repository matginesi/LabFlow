(function(){
  'use strict';
  const LF=window.LabFlow=window.LabFlow||{};
  const Log=LF.Logger.scope('storage');
  const DB_NAME='labflow.workspace.current', EXP_STORE='workspace';
  const API_KEY_STORE='labflow.ai.keys';
  const CABINET_STORE='labflow.cabinet';
  const KNOWLEDGE_STORE='labflow.knowledge';
  const NOMAD_SETTINGS_STORE='labflow.nomad.settings';
  const NOMAD_TOKEN_STORE='labflow.nomad.token';
  function read(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch(err){Log.warn('local.read-failed',{key:key,error:err});return fallback;}}
  function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(err){Log.warn('local.write-failed',{key:key,error:err});return false;}}
  function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
  function getAiSettings(){
    const defaults={provider:'zai',endpoint:'https://api.z.ai/api/paas/v4/chat/completions',model:'glm-4.7-flash',temperature:0.7,thinkingMode:'auto',streaming:true,inactivityTimeoutMs:90000,maxOutputTokensCap:0};
    const out=Object.assign({},defaults,read('labflow.ai.settings',{}));out.endpoint=String(out.endpoint||'').replace(/\/chat\/completions(?:\/chat\/completions)+\/?$/i,'/chat/completions');out.model=String(out.model||'').trim();out.thinkingMode=['auto','off','on'].includes(out.thinkingMode)?out.thinkingMode:'auto';out.streaming=out.streaming!==false;out.inactivityTimeoutMs=Math.max(15000,Math.min(600000,Number(out.inactivityTimeoutMs)||90000));out.maxOutputTokensCap=Math.max(0,Math.min(1048576,Number(out.maxOutputTokensCap)||0));return out;
  }
  function saveAiSettings(v){write('labflow.ai.settings',v);Log.info('ai-settings.saved',{provider:v&&v.provider,model:v&&v.model});}
  function getAssistantSettings(){const d={memoryEnabled:true,memoryTurns:6,memoryChars:6000,messageChars:1800,contextChars:12000,maxOutputTokens:0,temperature:0.4},raw=read('labflow.assistant.settings',{}),o=Object.assign({},d,raw);o.memoryEnabled=o.memoryEnabled!==false;o.memoryTurns=Math.max(0,Math.min(20,Number(o.memoryTurns)||0));o.memoryChars=Math.max(500,Math.min(32000,Number(o.memoryChars)||d.memoryChars));o.messageChars=Math.max(250,Math.min(8000,Number(o.messageChars)||d.messageChars));o.contextChars=Math.max(2000,Math.min(48000,Number(o.contextChars)||d.contextChars));o.maxOutputTokens=Math.max(0,Math.min(1048576,Number(o.maxOutputTokens)||0));o.temperature=Math.max(0,Math.min(2,Number(o.temperature)));if(!Number.isFinite(o.temperature))o.temperature=d.temperature;return o;}
  function saveAssistantSettings(v){const next=Object.assign({},getAssistantSettings(),v||{});write('labflow.assistant.settings',next);return getAssistantSettings();}
  function apiKeys(){const keys=read(API_KEY_STORE,{});return keys&&typeof keys==='object'&&!Array.isArray(keys)?keys:{};}
  function getApiKey(providerId){try{const provider=String(providerId||getAiSettings().provider||'zai');return String(apiKeys()[provider]||'');}catch(_){return'';}}
  function saveApiKey(key,providerId){try{const provider=String(providerId||getAiSettings().provider||'zai'),keys=apiKeys();if(key)keys[provider]=String(key);else delete keys[provider];const stored=write(API_KEY_STORE,keys);if(!stored)Log.warn('api-key.save-failed',{provider:provider});return stored;}catch(err){Log.warn('api-key.save-failed',{error:err});return false;}}

  /* Browser-local Action overrides are valid only for the source contract they
     were edited from. This prevents stale localStorage overrides from silently
     replacing a newer action.json / prompt.md after an application update. */
  function actionOverrides(){const current=read('labflow.action.overrides',{});return current&&typeof current==='object'&&!Array.isArray(current)?current:{};}
  function hashText(value){let h=2166136261,s=String(value||'');for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return('00000000'+(h>>>0).toString(16)).slice(-8);}
  function actionSourceSignature(id){if(!LF.ActionRegistry||!LF.ActionRegistry.action)return'';const base=LF.ActionRegistry.action(id);if(!base)return'';const prompt=LF.ActionRegistry.prompt?LF.ActionRegistry.prompt(id):'';return hashText(JSON.stringify(base)+'\n'+String(prompt||''));}
  function getActionOverride(id){const all=actionOverrides(),raw=all&&all[id];if(!raw)return null;const current=actionSourceSignature(id);if(current&&raw.sourceSignature!==current)return null;return clone(raw);}
  function saveActionOverride(id,override){const all=actionOverrides(),sourceSignature=actionSourceSignature(id);all[id]=Object.assign({},all[id]||{},clone(override||{}),{sourceSignature:sourceSignature,updatedAt:new Date().toISOString()});write('labflow.action.overrides',all);Log.info('action.override-saved',{actionId:id,hasDefinition:!!(override&&override.definition),hasPrompt:override&&typeof override.prompt==='string'});return getActionOverride(id);}
  function resetActionOverride(id){const all=actionOverrides();delete all[id];write('labflow.action.overrides',all);Log.info('action.override-reset',{actionId:id});}
  function getEffectiveAction(id){const base=LF.ActionRegistry&&LF.ActionRegistry.action?LF.ActionRegistry.action(id):null,ov=getActionOverride(id);if(!base)return null;if(!ov||!ov.definition)return base;const custom=clone(ov.definition),merged=Object.assign({},base,custom,{id:base.id});merged.contract=Object.assign({},base.contract||{},custom.contract||{});merged.execution=Object.assign({},base.execution||{},custom.execution||{});const customSteps=custom.execution&&custom.execution.steps,baseSteps=base.execution&&base.execution.steps||[];if(Array.isArray(customSteps)){const baseById={};baseSteps.forEach(function(step){if(step&&step.id)baseById[step.id]=step;});merged.execution.steps=customSteps.map(function(step){const source=step&&step.id&&baseById[step.id]||{};return Object.assign({},source,step||{});});}return merged;}
  function getEffectivePrompt(id){const ov=getActionOverride(id);if(ov&&typeof ov.prompt==='string')return ov.prompt;return LF.ActionRegistry&&LF.ActionRegistry.prompt?LF.ActionRegistry.prompt(id):'';}

  function getUserProfile(){return Object.assign({name:'Matteo Ginesi',organization:'',email:''},read('labflow.user.profile',{}));}
  function saveUserProfile(v){write('labflow.user.profile',Object.assign({},getUserProfile(),v||{}));}
  function getUiSettings(){return Object.assign({assistantOpen:false,theme:'instrument'},read('labflow.ui.settings',{}));}
  function saveUiSettings(v){write('labflow.ui.settings',Object.assign({},getUiSettings(),v||{}));}

  function getCabinetState(){
    const raw=read(CABINET_STORE,{items:[],updatedAt:null});
    return raw&&typeof raw==='object'&&!Array.isArray(raw)?clone(raw):{items:[],updatedAt:null};
  }
  function saveCabinetState(value){
    const payload=clone(value&&typeof value==='object'?value:{items:[]})||{items:[]};
    payload.items=Array.isArray(payload.items)?payload.items:[];
    payload.updatedAt=new Date().toISOString();
    const ok=write(CABINET_STORE,payload);
    if(ok)Log.info('cabinet.saved',{items:payload.items.length});
    return ok;
  }


  function parseKnowledgeJsonl(raw){
    const text=String(raw||'').trim();
    if(!text)return{entries:[]};
    const entries=[];
    text.split(/\r?\n/).forEach(function(line,index){
      const value=line.trim();if(!value)return;
      try{const item=JSON.parse(value);if(!item||typeof item!=='object'||Array.isArray(item))throw new Error('line must be a JSON object');entries.push(item);}catch(err){throw new Error('Invalid Knowledge Base JSONL at line '+(index+1)+': '+(err.message||String(err)));}
    });
    return{entries:entries};
  }
  function knowledgeJsonl(entries){return(Array.isArray(entries)?entries:[]).map(function(item){return JSON.stringify(item);}).join('\n');}
  function getKnowledgeState(){
    try{
      const raw=localStorage.getItem(KNOWLEDGE_STORE),parsed=parseKnowledgeJsonl(raw);
      return{schemaVersion:1,entries:clone(parsed.entries),format:'jsonl'};
    }catch(err){Log.warn('knowledge.read-failed',{key:KNOWLEDGE_STORE,error:err});return{schemaVersion:1,entries:[],format:'jsonl'};}
  }
  function saveKnowledgeState(value){
    const payload=clone(value&&typeof value==='object'?value:{entries:[]})||{entries:[]},entries=Array.isArray(payload.entries)?payload.entries:[];
    try{localStorage.setItem(KNOWLEDGE_STORE,knowledgeJsonl(entries));Log.info('knowledge.saved',{entries:entries.length,format:'jsonl'});return true;}catch(err){Log.warn('knowledge.write-failed',{key:KNOWLEDGE_STORE,error:err});return false;}
  }

  function getExportSettings(){const raw=read('labflow.export.settings',{});return{includeRaw:raw.includeRaw!==false,includeDerived:raw.includeDerived!==false};}
  function saveExportSettings(v){write('labflow.export.settings',v);}

  function getNomadSettings(){
    const defaults={instance:'NOMAD Central',webUrl:'https://nomad-lab.eu/prod/v1/gui/',apiEndpoint:'https://nomad-lab.eu/prod/v1/api/v1',username:''};
    const out=Object.assign({},defaults,read(NOMAD_SETTINGS_STORE,{}));
    ['instance','webUrl','apiEndpoint','username'].forEach(function(k){out[k]=String(out[k]||'').trim();});
    return out;
  }
  function saveNomadSettings(v){const next=Object.assign({},getNomadSettings(),v||{});write(NOMAD_SETTINGS_STORE,next);Log.info('nomad-settings.saved',{instance:next.instance,apiEndpoint:next.apiEndpoint,hasUsername:!!next.username});return getNomadSettings();}
  function getNomadToken(){return String(read(NOMAD_TOKEN_STORE,'')||'');}
  function saveNomadToken(token){const value=String(token||'');const ok=write(NOMAD_TOKEN_STORE,value);if(ok)Log.info('nomad-token.saved',{configured:!!value});return ok;}

  function db(){return new Promise(function(resolve,reject){if(!window.indexedDB){reject(new Error('IndexedDB is unavailable in this browser.'));return;}const req=indexedDB.open(DB_NAME);req.onupgradeneeded=function(){const d=req.result;if(!d.objectStoreNames.contains(EXP_STORE))d.createObjectStore(EXP_STORE);};req.onsuccess=function(){resolve(req.result);};req.onerror=function(){reject(req.error||new Error('Could not open LabFlow workspace storage.'));};});}
  async function saveExperiment(exp,ui){const d=await db();return new Promise(function(resolve,reject){const tx=d.transaction(EXP_STORE,'readwrite'),store=tx.objectStore(EXP_STORE),payload={savedAt:new Date().toISOString(),experiment:(LF.DataModel&&LF.DataModel.serialize?LF.DataModel.serialize(exp):exp),ui:{route:ui&&ui.route||'experiment-import',resultsTab:ui&&ui.resultsTab||'overview',selectedMeasurementId:ui&&ui.selectedMeasurementId||null,selectedDesignDeviceId:ui&&ui.selectedDesignDeviceId||null}};store.put(payload,'current');tx.oncomplete=function(){d.close();resolve(payload);};tx.onerror=function(){const err=tx.error||new Error('Could not save the LabFlow workspace.');d.close();reject(err);};});}
  async function loadExperiment(){try{const d=await db();return await new Promise(function(resolve,reject){const tx=d.transaction(EXP_STORE,'readonly'),req=tx.objectStore(EXP_STORE).get('current');req.onsuccess=function(){const v=req.result||null;d.close();resolve(v);};req.onerror=function(){const err=req.error||new Error('Could not read saved LabFlow workspace.');d.close();reject(err);};});}catch(err){Log.warn('workspace.load-failed',{error:err});return null;}}
  async function clearSavedExperiment(){try{const d=await db();return await new Promise(function(resolve,reject){const tx=d.transaction(EXP_STORE,'readwrite');tx.objectStore(EXP_STORE).delete('current');tx.oncomplete=function(){d.close();resolve(true);};tx.onerror=function(){const err=tx.error||new Error('Could not clear saved LabFlow workspace.');d.close();reject(err);};});}catch(err){Log.warn('workspace.clear-failed',{error:err});return false;}}

  LF.Storage={getAiSettings:getAiSettings,saveAiSettings:saveAiSettings,getAssistantSettings:getAssistantSettings,saveAssistantSettings:saveAssistantSettings,getApiKey:getApiKey,saveApiKey:saveApiKey,getActionOverride:getActionOverride,saveActionOverride:saveActionOverride,resetActionOverride:resetActionOverride,getEffectiveAction:getEffectiveAction,getEffectivePrompt:getEffectivePrompt,getUserProfile:getUserProfile,saveUserProfile:saveUserProfile,getUiSettings:getUiSettings,saveUiSettings:saveUiSettings,getExportSettings:getExportSettings,saveExportSettings:saveExportSettings,getNomadSettings:getNomadSettings,saveNomadSettings:saveNomadSettings,getNomadToken:getNomadToken,saveNomadToken:saveNomadToken,getCabinetState:getCabinetState,saveCabinetState:saveCabinetState,getKnowledgeState:getKnowledgeState,saveKnowledgeState:saveKnowledgeState,saveExperiment:saveExperiment,loadExperiment:loadExperiment,clearSavedExperiment:clearSavedExperiment};
}());
