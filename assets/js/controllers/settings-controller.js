/*
 * Bind Settings events to provider, storage, theme and diagnostics owners.
 * Boundary: Remain orchestration-only and do not duplicate feature state.
 */
(function(){
  'use strict';
  const LF=window.LabFlow=window.LabFlow||{};
  function value(id){const el=document.getElementById(id);return el?el.value:null;}
  function selectedValues(id){const el=document.getElementById(id);return el?Array.from(el.selectedOptions||[]).map(function(option){return option.value;}).filter(Boolean):[];}
  function splitList(text){return String(text||'').split(/[\n,;]/).map(function(item){return item.trim();}).filter(Boolean);}
  function downloadJson(name,data){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},500);}
  function nomadProfile(){const webUrl=value('nomadWebUrl').trim(),apiEndpoint=value('nomadApiEndpoint').trim(),
web=new URL(webUrl),api=new URL(apiEndpoint),local=u=>['localhost','127.0.0.1','::1','[::1]'].includes(u.hostname);
    if(!['http:','https:'].includes(web.protocol)||!['http:',
    'https:'].includes(api.protocol))throw new Error('NOMAD addresses must use HTTP or HTTPS.');
    if(web.username||web.password||api.username||api.password)throw new Error('Do not put credentials inside NOMAD URLs.');
    if(web.protocol!=='https:'&&!local(web))throw new Error('Use HTTPS for the NOMAD website unless it is local.');
    if(api.protocol!=='https:'&&!local(api))throw new Error('Use HTTPS for the NOMAD API unless it is local.');
    return{webUrl,apiEndpoint,web,api};}
  function formatBytes(value){
    const bytes=Number(value);
    if(!Number.isFinite(bytes)||bytes<0)return 'unknown';
    if(bytes<1024)return Math.round(bytes)+' B';
    const units=['KB','MB','GB','TB'];let n=bytes/1024,index=0;
    while(n>=1024&&index<units.length-1){n/=1024;index++;}
    return n.toFixed(n>=100?0:n>=10?1:2)+' '+units[index];
  }

  async function handleClick(e,ctx){
    const S=ctx.state,render=ctx.render;
    if(e.target.closest('#saveUserProfile')){LF.Storage.saveUserProfile({name:value('userName').trim(),organization:value('userOrganization').trim(),email:value('userEmail').trim()});LF.UI.message('Profile saved.','success');render();return true;}
    if(e.target.closest('#saveWorkspaceProfile')){
      try{
        const institution=String(value('workspaceInstitution')||'').trim();
        LF.Workspace.save({name:String(value('workspaceName')||'').trim(),institution:institution,description:String(value('workspaceDescription')||'').trim()});
        LF.Workspace.setRoleContact('data_responsible',{name:value('workspaceResponsibleName'),email:value('workspaceResponsibleEmail'),institution:institution});
        LF.Workspace.setRoleContact('parser_contact',{name:value('workspaceParserName'),email:value('workspaceParserEmail'),institution:institution});
        LF.Workspace.setRoleContact('plugin_contributor',{name:value('workspaceContributorName'),email:value('workspaceContributorEmail'),institution:institution});
        LF.Workspace.setLocationsFromNames(value('workspaceLocations'));
        LF.Workspace.setPrimaryStorage({name:'Primary laboratory storage',type:value('workspaceStorageType'),locationHint:value('workspaceStorageLocation'),institution:institution,backupPolicy:value('workspaceBackupPolicy'),retentionPolicy:value('workspaceRetentionPolicy')});
        if(S.state.experiment)LF.Workspace.bindExperiment(S.state.experiment,S.state.experiment.meta&&S.state.experiment.meta.processId);
        LF.UI.message('Scientific Workspace saved.','success');render();
      }catch(err){LF.UI.message('Workspace not saved: '+(err.message||String(err)),'error');}
      return true;
    }
    if(e.target.closest('#workspaceExportProfile')){
      try{downloadJson('labflow-data-management-profile.json',LF.Workspace.readyPvSummary());LF.UI.message('Data-management profile exported.','success');}
      catch(err){LF.UI.message('Profile export failed: '+(err.message||String(err)),'error');}
      return true;
    }
    if(e.target.closest('#workspaceAddProcess')){
      try{const item=LF.Workspace.addProcess({name:'New scientific process',kind:'measurement'});S.state.ui.settingsWorkspaceProcessId=item.id;LF.UI.message('Scientific Process created.','success');render();}
      catch(err){LF.UI.message('Process could not be created: '+(err.message||String(err)),'error');}
      return true;
    }
    if(e.target.closest('#workspaceDeleteProcess')){
      const id=String(S.state.ui.settingsWorkspaceProcessId||value('workspaceProcessSelect')||'');
      if(id&&await LF.UI.confirmAction('Delete this reusable scientific Process definition? Existing experiment measurements are not deleted.',{title:'Delete scientific Process',confirmLabel:'Delete process',danger:true})){
        LF.Workspace.removeProcess(id);S.state.ui.settingsWorkspaceProcessId='';LF.UI.message('Scientific Process deleted.','success');render();
      }
      return true;
    }
    if(e.target.closest('#saveWorkspaceProcess')){
      try{
        const id=String(S.state.ui.settingsWorkspaceProcessId||value('workspaceProcessSelect')||'');
        if(!id)throw new Error('Select or create a Process first.');
        LF.Workspace.updateProcess(id,{
          name:String(value('workspaceProcessName')||'').trim(),kind:value('workspaceProcessKind'),description:value('workspaceProcessDescription'),sampleTypes:splitList(value('workspaceProcessSampleTypes')),
          variables:LF.Workspace.parseQuantityLines(value('workspaceProcessVariables'),'controlled_variable'),observables:LF.Workspace.parseQuantityLines(value('workspaceProcessObservables'),'observable'),
          typicalFrequency:value('workspaceProcessFrequency'),typicalOutputSize:value('workspaceProcessOutputSize'),parallelCapacity:value('workspaceProcessParallelCapacity'),
          locationIds:selectedValues('workspaceProcessLocations'),storageProfileIds:selectedValues('workspaceProcessStorage'),instrumentIds:selectedValues('workspaceProcessInstruments'),softwareIds:selectedValues('workspaceProcessSoftware'),setupIds:selectedValues('workspaceProcessSetups'),outputFormatIds:selectedValues('workspaceProcessFormats'),
          metadataPolicy:{metadataLocation:value('workspaceProcessMetadataLocation'),sampleLinkage:{method:value('workspaceProcessLinkageMethod'),rule:value('workspaceProcessLinkageRule')}},notes:value('workspaceProcessNotes')
        });
        if(S.state.experiment&&(!S.state.experiment.meta||!S.state.experiment.meta.processId))LF.Workspace.bindExperiment(S.state.experiment,id);
        LF.UI.message('Scientific Process saved.','success');render();
      }catch(err){LF.UI.message('Process not saved: '+(err.message||String(err)),'error');}
      return true;
    }
    if(e.target.closest('#checkBrowserStorage')){const host=document.getElementById('browserStorageStatus');
if(host)host.innerHTML='<span>Storage use</span><strong>Checking…</strong><small>Reading this browser origin only.</small>';
      try{const info=await LF.Storage.storageStatus(),
      owned=Number(info.workspaceBytes||0)+Number(info.rawBytes||0)+Number(info.localBytes||0)+Number(info.sessionBytes||0),
      quota=info.browserQuota!=null?formatBytes(info.browserQuota):'not reported',
      origin=info.browserUsage!=null?formatBytes(info.browserUsage):'not reported';
      if(host)host.innerHTML='<span>LabFlow-owned data</span><strong>'+formatBytes(owned)+'</strong><small>RAW '+
      formatBytes(info.rawBytes)+' · workspace '+formatBytes(info.workspaceBytes)+' · preferences '+
      formatBytes(Number(info.localBytes||0)+Number(info.sessionBytes||0))+' · '+Number(info.rawItems||
      0)+' RAW archive'+(Number(info.rawItems||
      0)===1?'':'s')+'. Browser origin '+origin+' / quota '+quota+(info.persistent===null?'':(' · persistent storage '+
      (info.persistent?'yes':'no')))+'.</small>';
      }catch(err){if(host)host.innerHTML='<span>Storage use</span><strong>Unavailable</strong><small>'+String(err&&
      err.message||err)+'</small>';}return true;}
    if(e.target.closest('#clearLocalLabFlowData')){
if(!await LF.UI.confirmAction('Remove the current experiment, saved preferences, AI/NOMAD credentials, custom Knowledge Base entries and AI tool customizations from this browser?',
      {title:'Clear LabFlow data on this browser',confirmLabel:'Clear local data',danger:true}))return true;
      await LF.Storage.clearAllLocalData();S.resetSession();if(LF.PageContext)LF.PageContext.clear();window.location.reload();
      return true;}
    if(e.target.closest('#validateNomadProfile')){try{nomadProfile();LF.UI.message('NOMAD profile is valid. No network request was made.','success');}catch(err){LF.UI.message('NOMAD profile needs attention: '+(err.message||String(err)),'error');}return true;}
    if(e.target.closest('#saveNomadSettings')){try{
const profile=nomadProfile(),instance=value('nomadInstance').trim(),username=value('nomadUsername').trim(),
      token=value('nomadToken'),remember=!!document.getElementById('nomadRememberToken')?.checked;
      LF.Storage.saveNomadSettings({instance:instance||'NOMAD',webUrl:profile.webUrl,
      apiEndpoint:profile.apiEndpoint.replace(/\/$/,''),username});
      LF.Storage.saveNomadToken(token,{remember,endpoint:profile.apiEndpoint});
      LF.UI.message('NOMAD connection details saved locally. No data was uploaded.','success');render();
      }catch(err){LF.UI.message('NOMAD settings not saved: '+(err.message||String(err)),'error');}return true;}
    if(e.target.closest('#clearNomadToken')){LF.Storage.saveNomadToken('',{remember:false,endpoint:LF.Storage.getNomadSettings().apiEndpoint});LF.UI.message('NOMAD token cleared from this browser.','success');render();return true;}
    if(e.target.closest('#saveAssistantSettings')){LF.Storage.saveAssistantSettings({
      maxOutputTokens:Number(value('assistantMaxOutputTokens')),thinkingMode:value('assistantThinkingMode'),
      contextChars:Number(value('assistantContextChars'))});
      LF.UI.message('Assistant settings saved.','success');render();return true;}
    if(e.target.closest('#validateActionEditor')||e.target.closest('#saveActionEditor')){
const save=!!e.target.closest('#saveActionEditor'),
      btn=e.target.closest(save?'#saveActionEditor':'#validateActionEditor'),id=btn.dataset.actionId,
      defText=value('actionDefinitionEditor'),promptText=value('actionPromptEditor');try{const def=JSON.parse(defText);
      if(!def||def.id!==id)throw new Error('Action id must remain '+id+'.');
      if(!def.contract||!def.execution||!Array.isArray(def.execution.steps)||
      !def.execution.steps.length)throw new Error('Action definition requires contract and execution.steps.');
      def.title=value('actionTitleEditor')||def.title;def.short_title=value('actionShortTitleEditor')||def.short_title;
      def.purpose=value('actionPurposeEditor')||def.purpose;def.strategy=value('actionStrategyEditor')||def.strategy;
      const aiStep=def.execution.steps.find(step=>step&&step.type==='AI');
      if(aiStep){const thinking=value('actionStepThinking');if(thinking)aiStep.thinking=thinking;
      [['actionStepMaxInput','max_input_tokens'],['actionStepTargetOutput','target_output_tokens'],['actionStepMaxOutput',
      'max_output_tokens'],['actionStepRetries','max_retries']].forEach(pair=>{const raw=value(pair[0]);
      if(raw!==null&&raw!=='')aiStep[pair[1]]=Math.max(0,Number(raw)||0);});const deadline=value('actionStepDeadline');
      if(deadline!==null&&deadline!=='')aiStep.deadline_ms=Math.max(0,Number(deadline)||0)*1000;
      }LF.Storage.validateActionOverride&&LF.Storage.validateActionOverride(id,{definition:def,prompt:promptText});
      if(save){LF.Storage.saveActionOverride(id,{definition:def,prompt:promptText});
      LF.UI.message('Action customization saved.','success');render();
      }else LF.UI.message('Action customization is valid and stays inside the protected contract.','success');
      }catch(err){LF.UI.message((save?'Action not saved: ':'Action validation failed: ')+(err.message||String(err)),'error');
      }return true;}
    if(e.target.closest('#resetActionEditor')){const id=e.target.closest('#resetActionEditor').dataset.actionId;if(await LF.UI.confirmAction('Reset '+id+' to its source action.json and prompt.md?',{title:'Reset Action configuration',confirmLabel:'Reset Action'})){LF.Storage.resetActionOverride(id);LF.UI.message('Action reset to source definition.','success');render();}return true;}
    if(e.target.closest('#clearAssistantConversation')){
if(ctx.hasExperiment()&&await LF.UI.confirmAction('Clear the current Assistant conversation?',{
      title:'Clear Assistant conversation',confirmLabel:'Clear conversation',danger:true})){
      const d=LF.State.ensureDerived(S.state.experiment);d.chat={conversation:[]};ctx.markModified('ai');
      LF.UI.message('Assistant conversation cleared.','success');render();}return true;}
    if(e.target.closest('#saveLogSettings')){LF.Logger.saveSettings({
enabled:document.getElementById('logEnabled').checked,level:value('logLevel'),
      maxEntries:Number(value('logMaxEntries'))||2500,interactions:document.getElementById('logInteractions').checked,
      network:document.getElementById('logNetwork').checked});
      LF.UI.message('Logging settings applied. Reload only if you changed network instrumentation.','success');render();
      return true;}
    const level=e.target.closest('[data-log-level]');if(level){LF.LogsPage.setLevel(level.dataset.logLevel);render();return true;}const category=e.target.closest('[data-log-category]');if(category){LF.LogsPage.setCategory(category.dataset.logCategory);render();return true;}
    if(e.target.closest('#refreshLogs')){render();return true;
}if(e.target.closest('#downloadDiagnostics')){LF.Logger.downloadDiagnostics();return true;
      }if(e.target.closest('#downloadLogs')){LF.Logger.download();return true;
      }if(e.target.closest('#clearLogs')){if(await LF.UI.confirmAction('Clear all buffered LabFlow logs? Download them first if you need to keep this diagnostic history.',
      {title:'Clear runtime logs',confirmLabel:'Clear logs',danger:true})){LF.Logger.clear();render();}return true;}
    if(e.target.closest('#saveAiSettings')){LF.AISettings.saveFromForm();return true;}if(e.target.closest('#detectProviderModel')){LF.AISettings.detectModel();return true;}if(e.target.closest('#testAiConnection')){await LF.AISettings.testConnection(e.target.closest('#testAiConnection'));return true;}
    if(e.target.closest('#reanalyzeDataset')){ctx.refreshPipeline(S.state.experiment,'manual-review');render();LF.UI.message('Data checks refreshed.','success');return true;}
    return false;
  }
  function handleChange(e,ctx){
    if(e.target.id==='aiProvider'){LF.AISettings.selectProvider(e.target.value);return true;}
    if(e.target.id==='aiModelSelect'){
      const input=document.getElementById('aiModel');if(input)input.value=e.target.value;return true;
    }
    if(e.target.id==='workspaceProcessSelect'){
      ctx.state.state.ui.settingsWorkspaceProcessId=e.target.value;ctx.render();return true;
    }
    if(e.target.id==='logScopeFilter'){LF.LogsPage.setScope(e.target.value);ctx.render();return true;}
    return false;
  }
  function handleInput(e,ctx){if(e.target.id==='aiEndpoint'){LF.AISettings.decorate&&LF.AISettings.decorate();
return true;}if(e.target.id==='aiKey'){LF.AISettings.syncModelControls&&LF.AISettings.syncModelControls();return true;
    }if(e.target.id==='logSearch'){LF.LogsPage.setQuery(e.target.value);clearTimeout(handleInput._timer);
    handleInput._timer=setTimeout(function(){ctx.render();const search=document.getElementById('logSearch');
    if(search){search.focus();search.setSelectionRange(search.value.length,search.value.length);}},180);return true;
    }return false;}
  LF.SettingsController={handleClick,handleChange,handleInput,validateNomadProfile:nomadProfile};
})();
