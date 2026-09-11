(function () {
  'use strict';
  const LF = window.LabFlow;
  const C = LF.Core;
  const S = LF.State;
  const Log = LF.Logger.scope('app');
  const PS = LF.PageShell;
  const hasExperiment = PS.hasExperiment;
  const ensureExperimentShape = PS.ensureExperimentShape;
  const routeTitle = PS.routeTitle;
  const pageHead = PS.pageHead;
  const workflowHead = PS.workflowHead;
  const experimentStepper = PS.experimentStepper;
  const needExperiment = PS.needExperiment;
  const badge = PS.badge;
  let renderedRoute = '';
  const scrollMemory=new Map();
  let workspaceSaveTimer=0,workspaceSaveBusy=false,workspaceSavePending=false;
  let kbSettingsSearchTimer=0,logSearchTimer=0,curveSearchTimer=0,cabinetSearchTimer=0;
  let renderedScrollContext='',stableAnchorGeneration=0;
  function workspaceUiSnapshot(){const ui=S.state.ui||{};return{route:ui.route||'experiment-import',resultsTab:ui.resultsTab||'overview',selectedMeasurementId:ui.selectedMeasurementId||null,selectedDesignDeviceId:ui.selectedDesignDeviceId||null};}
  function knowledgeFormEntry(){const kb=LF.KnowledgeBase,id=S.state.ui&&S.state.ui.settingsKnowledgeId,existing=id&&id!=='__new__'?kb.get(id):null;return{id:existing&&existing.origin==='custom'?existing.id:undefined,kind:document.getElementById('kbKind').value,status:document.getElementById('kbStatus').value,title:document.getElementById('kbTitle').value,aliases:document.getElementById('kbAliases').value,tags:document.getElementById('kbTags').value,summary:document.getElementById('kbSummary').value,facts:document.getElementById('kbFacts').value,cautions:document.getElementById('kbCautions').value,related_ids:document.getElementById('kbRelatedIds').value,sources:kb.parseSourceLines(document.getElementById('kbSources').value),created_at:existing&&existing.created_at};}
  async function persistWorkspace(reason){if(!hasExperiment()||!LF.Storage||!LF.Storage.saveExperiment)return false;if(workspaceSaveBusy){workspaceSavePending=true;return false;}workspaceSaveBusy=true;try{await LF.Storage.saveExperiment(S.state.experiment,workspaceUiSnapshot());Log.debug('workspace.autosaved',{reason:reason||'state',revision:S.state.experiment.sync&&S.state.experiment.sync.revision||0});return true;}catch(err){Log.warn('workspace.autosave-failed',{reason:reason||'state',error:err});return false;}finally{workspaceSaveBusy=false;if(workspaceSavePending){workspaceSavePending=false;scheduleWorkspaceSave('pending');}}}
  function scheduleWorkspaceSave(reason){if(!hasExperiment())return;window.clearTimeout(workspaceSaveTimer);workspaceSaveTimer=window.setTimeout(function(){persistWorkspace(reason||'state');},700);}
  function restoreSavedUi(saved){const ui=saved&&saved.ui||{};if(ui.route==='logs')S.state.ui.settingsSection='diagnostics';else if(ui.route==='ui-kit')S.state.ui.settingsSection='ui-kit';if(ui.route)S.state.ui.route=S.normalizeRoute?S.normalizeRoute(ui.route):ui.route;if(ui.resultsTab)S.state.ui.resultsTab=ui.resultsTab;if(ui.selectedMeasurementId)S.state.ui.selectedMeasurementId=ui.selectedMeasurementId;if(ui.selectedDesignDeviceId)S.state.ui.selectedDesignDeviceId=ui.selectedDesignDeviceId;}

  function scrollContext(route){
    const ui=S.state.ui||{},id=String(route||ui.route||'');
    if(id==='experiment-results')return id+':'+String(ui.resultsTab||'overview');
    if(id==='settings')return id+':'+String(ui.settingsSection||'provider');
    if(id==='documentation')return id+':'+String(ui.docsSlug||'');
    if(id==='cabinet')return id+':'+String(ui.cabinetKind||'all');
    return id;
  }
  function scrollNodeKey(el,root,context){
    if(el.id)return String(context||'')+':id:'+el.id;
    const attrs=['data-scroll-memory','data-action-editor'];
    for(let i=0;i<attrs.length;i++){const v=el.getAttribute&&el.getAttribute(attrs[i]);if(v)return String(context||'')+':'+attrs[i]+':'+v;}
    const parts=[];let cur=el;while(cur&&cur!==root&&parts.length<7){const parent=cur.parentElement;if(!parent)break;const tag=(cur.tagName||'node').toLowerCase(),siblings=Array.from(parent.children).filter(function(x){return x.tagName===cur.tagName;}),idx=Math.max(0,siblings.indexOf(cur));parts.unshift(tag+':'+idx);cur=parent;}return String(context||'')+':path:'+parts.join('/');
  }
  const SCROLL_MEMORY_SELECTOR=['.table-wrap','.scroll-region','.scroll-x-region','.logs-table-wrap','.logs-focus-list','.design-variant-cards','.activity-checklist','.docs-document','[data-scroll-memory]'].join(',');
  function scrollMemoryNodes(root){if(!root||!root.querySelectorAll)return[];return Array.from(root.querySelectorAll(SCROLL_MEMORY_SELECTOR)).slice(0,80);}
  function captureScrollableState(root,context){
    scrollMemoryNodes(root).forEach(function(el){if(!el.scrollTop&&!el.scrollLeft)return;scrollMemory.set(scrollNodeKey(el,root,context),{top:el.scrollTop,left:el.scrollLeft});});
  }
  function restoreScrollableState(root,context){
    if(!root)return;const apply=function(){scrollMemoryNodes(root).forEach(function(el){const state=scrollMemory.get(scrollNodeKey(el,root,context));if(!state)return;if(el.scrollTop!==undefined)el.scrollTop=Math.min(state.top,Math.max(0,el.scrollHeight-el.clientHeight));if(el.scrollLeft!==undefined)el.scrollLeft=Math.min(state.left,Math.max(0,el.scrollWidth-el.clientWidth));});};apply();if(window.requestAnimationFrame)window.requestAnimationFrame(apply);
  }

  function renderWithStableAnchor(selector){
    const generation=++stableAnchorGeneration,route=S.state.ui.route;
    const main=document.getElementById('main');
    const before=main&&main.querySelector(selector),beforeTop=before&&before.getBoundingClientRect?before.getBoundingClientRect().top:null;
    render();
    if(!main)return;
    const align=function(){
      if(generation!==stableAnchorGeneration||S.state.ui.route!==route)return;
      const anchor=main.querySelector(selector);
      if(anchor&&anchor.getBoundingClientRect&&Number.isFinite(beforeTop))main.scrollTop+=anchor.getBoundingClientRect().top-beforeTop;
    };
    align();
    if(window.requestAnimationFrame)window.requestAnimationFrame(align);
    window.setTimeout(align,0);
  }

  function activateDesignProposal(deviceId){const exp=S.state.experiment;if(!exp||!LF.ActionData)return null;return LF.ActionData.proposal(exp,'design.infer',String(deviceId||''));}
  function selectedDesignProposal(){return activateDesignProposal(S.state.ui.selectedDesignDeviceId);}
  function ambiguityPlan(){return hasExperiment()&&LF.ActionData?LF.ActionData.proposal(S.state.experiment,'dataset.resolve-ambiguities'):null;}

  function renderDesign() {
    if (!hasExperiment()) return needExperiment();
    const experiment = ensureExperimentShape(S.state.experiment);
    activateDesignProposal(S.state.ui.selectedDesignDeviceId||experiment.design&&experiment.design.devices&&experiment.design.devices[0]&&experiment.design.devices[0].id);
    return LF.DesignPage.render({
      experiment: experiment,
      selectedDeviceId: S.state.ui.selectedDesignDeviceId,
      stepper: experimentStepper(),
      pageHead: pageHead,
      badge: badge,
      workflowHead: workflowHead
    });
  }




  /**
   * Commit the visible editor before switching document or exporting.
   * This makes the DOM-to-export boundary explicit even when a browser has not
   * yet delivered the final input event (IME, autofill and accessibility tools).
   */


  /* Render is intentionally synchronous: state changes produce one complete DOM view. */
  function renderPageContext(){const host=document.getElementById('topbarPageContext');if(!host)return;if(!hasExperiment()||!LF.PageContext){host.hidden=true;host.textContent='';return;}const text=LF.PageContext.summary();host.hidden=!text;host.textContent=text;}

  function renderModelStatus(){
    const host=document.getElementById('modelStatus'),detail=document.getElementById('modelStatusDetail');if(!host||!detail)return;
    const settings=LF.Storage.getAiSettings(),provider=LF.AIProviders&&LF.AIProviders[settings.provider]||{},ready=!!(settings.endpoint&&settings.model&&(!provider.keyRequired||LF.Storage.getApiKey(settings.provider))),displayModel=LF.Core&&LF.Core.modelDisplayName?LF.Core.modelDisplayName(settings.provider,settings.model):settings.model;
    host.classList.toggle('available',ready);host.classList.toggle('unavailable',!ready);
    detail.textContent=ready?displayModel:'Not configured';host.title=ready?'AI model available: '+displayModel:'Configure the AI provider in Settings';
  }

  function applyUiKitFilter(){
    if(!LF.UIKitInline||!LF.UIKitInline.apply)return 0;
    return LF.UIKitInline.apply(S.state);
  }


  function pageFailureHtml(route,error){
    const title=PS.routeTitle?PS.routeTitle(route):'Current page';
    const message=C.escapeHtml(error&&error.message||String(error||'Unknown rendering error'));
    const canRebuild=hasExperiment()&&['experiment-results','experiment-design','experiment-export'].includes(route);
    return '<section class="page page-error-recovery"><div class="notice danger"><strong>'+C.escapeHtml(title)+' could not be rendered.</strong><span>'+message+'</span></div><section class="panel"><div class="panel-head"><div><span class="eyebrow">Recovery</span><h2 class="h2">Fix this page here</h2><div class="meta">LabFlow will not send you back to Upload unless the source ZIP itself is missing.</div></div></div><div class="panel-body"><div class="row-wrap"><button type="button" class="button primary" data-retry-page>Retry page</button>'+(canRebuild?'<button type="button" class="button" data-rebuild-derived>Rebuild derived data</button>':'')+'<button type="button" class="button" data-route="logs">Open logs</button></div></div></section></section>';
  }

  function render() {
    if (hasExperiment()) ensureExperimentShape(S.state.experiment);
    const end=Log.timer('render',{route:S.state.ui.route,experimentId:S.state.experiment&&S.state.experiment.id,resultsTab:S.state.ui.resultsTab});
    const main=document.getElementById('main'); if(!main){end({skipped:'main-missing'},'warn');return;}
    const previousRoute=renderedRoute||S.state.ui.route,currentContext=scrollContext(S.state.ui.route),routeChanged=!!renderedRoute&&renderedRoute!==S.state.ui.route,contextChanged=!!renderedScrollContext&&renderedScrollContext!==currentContext,mainScrollTop=main.scrollTop;
    try{captureScrollableState(main,renderedScrollContext||scrollContext(previousRoute));}catch(err){Log.warn('render.scroll-capture-skipped',{route:previousRoute,error:err});}
    document.querySelectorAll('.nav-link[data-route]').forEach(function(a){const navRoute=a.dataset.route;const active=navRoute===S.state.ui.route;a.classList.toggle('active',active);});
    document.getElementById('topbarTitle').textContent=routeTitle(S.state.ui.route);document.getElementById('topbarSubtitle').textContent=hasExperiment()?S.state.experiment.meta.name:'No experiment loaded';
    renderModelStatus();
    const shell=document.querySelector('.app-shell'),assistant=document.getElementById('assistantPanel'),toggle=document.getElementById('assistantToggle');if(shell)shell.classList.toggle('assistant-closed',!S.state.ui.assistantOpen);if(assistant)assistant.hidden=!S.state.ui.assistantOpen;if(toggle){const assistantLabel=S.state.ui.assistantOpen?'Hide assistant':'Assistant';toggle.setAttribute('aria-pressed',S.state.ui.assistantOpen?'true':'false');toggle.innerHTML=(LF.Icons?LF.Icons.icon('message-square'):'')+'<span>'+assistantLabel+'</span>';}
    let html='';try{if(S.state.ui.route==='experiment-import')html=LF.ImportPage.render(S.state);else if(S.state.ui.route==='experiment-results')html=LF.ResultsPage.render(S.state);else if(S.state.ui.route==='experiment-design')html=renderDesign();else if(S.state.ui.route==='cabinet')html=LF.CabinetPage.render();else if(S.state.ui.route==='experiment-export')html=LF.ExportPage.render(S.state);else if(S.state.ui.route==='documentation')html=LF.DocsPage.render();else html=LF.SettingsPage.render();}catch(err){Log.error('render.page-failed',{route:S.state.ui.route,error:err});html=pageFailureHtml(S.state.ui.route,err);}
    main.innerHTML=html;
    try{renderPageContext();}catch(err){Log.warn('render.page-context-skipped',{route:S.state.ui.route,error:err});}
    try{C.bindFieldLabels(main);}catch(err){Log.warn('render.labels-skipped',{route:S.state.ui.route,error:err});}
    if(S.state.ui.route==='settings'&&S.state.ui.settingsSection==='ui-kit')try{const filter=document.getElementById('uiKitGlobalFilter');if(filter)filter.value=S.state.ui.uiKitFilter||'all';applyUiKitFilter();}catch(err){Log.warn('render.ui-kit-filter-skipped',{error:err});}
    if(S.state.ui.route==='documentation'&&LF.DocsPage)try{LF.DocsPage.apply(main);}catch(err){Log.warn('render.documentation-filter-skipped',{error:err});}
    if(S.state.ui.route==='settings'&&S.state.ui.settingsSection==='diagnostics'&&LF.LogsPage&&LF.LogsPage.bind)try{LF.LogsPage.bind(main);}catch(err){Log.warn('render.logs-bind-skipped',{error:err});}
    if(!renderedRoute||routeChanged)main.scrollTop=0;else main.scrollTop=mainScrollTop;
    renderedRoute=S.state.ui.route;renderedScrollContext=currentContext;
    if(!routeChanged&&!contextChanged)try{restoreScrollableState(main,currentContext);}catch(err){Log.warn('render.scroll-restore-skipped',{route:S.state.ui.route,error:err});}
    main.querySelectorAll('button:not([type])').forEach(function(b){b.type='button';});
    try{LF.AISettings.decorate();}catch(err){Log.warn('render.decorate-skipped',{route:S.state.ui.route,error:err});}
    try{LF.Theme.syncControls(LF.Theme.current());}catch(err){Log.warn('render.theme-sync-skipped',{route:S.state.ui.route,error:err});}
    Log.trace('render.html',{route:S.state.ui.route,chars:html.length});
    try{LF.Assistant.render();}catch(err){Log.warn('render.assistant-skipped',{route:S.state.ui.route,error:err});}
    try{if(LF.Icons)LF.Icons.hydrate(document);}catch(err){Log.warn('render.icons-skipped',{route:S.state.ui.route,error:err});}
    try{LF.ResultsPage.renderResultInspector();}catch(err){Log.warn('render.inspector-skipped',{route:S.state.ui.route,error:err});}
    if(LF.Math&&LF.Math.queueTypeset&&main.querySelector&&main.querySelector('.math-display,.math-inline'))LF.Math.queueTypeset(main,70);end({htmlChars:html.length});
  }

  function refreshPipeline(exp,reason){if(!LF.DataPipeline||!LF.DataPipeline.refresh)throw new Error('LabFlow.DataPipeline is unavailable.');return LF.DataPipeline.refresh(exp,{reason:reason||'app'});}

  function markModified(scope){
    if(!hasExperiment())return;
    const mutationScope=scope||'metadata',exp=S.state.experiment;
    if(mutationScope==='ai'){if(S.notify)S.notify('ai');return;}
    S.touch(mutationScope);
    if(mutationScope==='dataset'||mutationScope==='analysis'||mutationScope==='design')refreshPipeline(exp,'mutation:'+mutationScope);
  }

  function markDraft(scope){if(!hasExperiment())return;if(S.markDraft)S.markDraft(scope||'metadata');scheduleWorkspaceSave('draft:'+(scope||'metadata'));}
  function commitDraft(scope){if(!hasExperiment())return;if(S.commitDraft)S.commitDraft(scope);if(scope==='dataset'||scope==='design')refreshPipeline(S.state.experiment,'draft:'+scope);}
  function flushDrafts(){if(S.commitAllDrafts)S.commitAllDrafts();}

  function refreshDesignProjection(){
    if(LF.DesignPage&&LF.DesignPage.refreshProjection)LF.DesignPage.refreshProjection(S.state.experiment,S.state.ui.selectedDesignDeviceId,badge);
  }

  /* ---------- reviewed state mutations and local file operations ---------- */

  /** Update one ambiguity proposal decision. The Review page is rendered from
      state immediately after this call, so there is no parallel DOM state
      to keep in sync. */
  function updateProposalDecision(index, decision) {
    const plan=ambiguityPlan(),proposal=plan&&plan.proposals&&plan.proposals[index];
    if(!proposal)return;
    proposal.decision=decision;
    const accepted=plan.proposals.filter(function(item){return !item.applied&&(item.decision||'pending')==='accepted';}).length;
    markModified('ai');
    Log.info('review.proposal-decision',{index:index,decision:decision,accepted:accepted});
  }


  function discardRepairPlan(){if(!hasExperiment())return;if(LF.ActionData)LF.ActionData.removeProposal(S.state.experiment,'dataset.resolve-ambiguities');markModified('ai');render();LF.UI.message('AI correction proposals discarded. Deterministic findings, AI analysis and RAW data are unchanged.','info');}

  function activityDetails(file,extra){return Object.assign({File:file&&file.name||'',Size:file&&file.size?C.bytes(file.size):''},extra||{});}
  function importProgress(file,info){const p=info||{},raw=Number(p.progress),progress=Number.isFinite(raw)?Math.max(0,Math.min(.44,raw*.44)):0;LF.UI.activityUpdate({stage:p.stage||'Importing dataset',progress:progress,message:p.path||'',details:activityDetails(file,{Files:p.files||'',Current:p.current&&p.total?p.current+' / '+p.total:'',Path:p.path||''})});}

  async function importDataset(file){
    const end=Log.timer('dataset.import',{name:file&&file.name,size:file&&file.size,type:file&&file.type});
    LF.UI.activityStart({title:'Import experiment ZIP',subtitle:'Local parsing · RAW remains unchanged',kind:'ZIP',stage:'Reading source file',progress:.01,message:file&&file.name||'',details:activityDetails(file)});
    try{
      const buffer=await file.arrayBuffer();
      LF.UI.activityUpdate({stage:'Opening ZIP',progress:.03,details:{Bytes:buffer.byteLength}});
      const exp=await LF.Importer.parseDataset(buffer,file.name,function(info){importProgress(file,info);});
      exp.meta.sourceModifiedAt=file.lastModified?new Date(file.lastModified).toISOString():null;exp.meta.sourceType=file.type||'application/zip';exp.meta.importMethod='Local browser import · JSZip';
      LF.UI.activityUpdate({stage:'Analyzing measurements',progress:.48,message:'Deterministic facts first',details:{Measurements:exp.measurements.length,Samples:exp.samples.length}});
      exp.nomad=exp.nomad||{validation:null,upload:null,mappingPlan:null};
      S.setExperiment(exp);
      refreshPipeline(exp,'import');
      S.state.ui.resultsTab='overview';S.state.ui.resultsDataMode='all';S.state.ui.resultsJvMode='single';S.state.ui.resultsOverviewMetric='eff';S.state.ui.resultsOverviewDirection='best';S.state.ui.resultsOverviewStatistic='median';S.state.ui.curveSelection=exp.measurements[0]?[exp.measurements[0].id]:[];S.state.ui.curveOverlaySelection=[];S.state.ui.curveView='all';S.state.ui.curveGroup='all';S.state.ui.curveDirection='both';S.state.ui.curveEligibleOnly=false;S.state.ui.curveSearch='';S.state.ui.curveZoom=1;S.state.ui.pceDistributionZoom=1;
      const briefMode='deterministic';
      LF.UI.activityUpdate({stage:'Validating LabFlow Data',progress:.82,message:'Deterministic pipeline complete · no AI request during import',details:{Experiments:(exp.experiments||[]).length,Samples:exp.samples.length,Runs:(exp.runs||[]).length,Measurements:exp.measurements.length,Pipeline:exp.pipeline&&exp.pipeline.status||'ready'}});
      S.setRoute('experiment-import');
      end({experimentId:exp.id,samples:exp.samples.length,measurements:exp.measurements.length,findings:exp.findings.length,brief:briefMode,nextRoute:'experiment-import'},'info');
      LF.UI.activityFinish({message:'ZIP parsed and deterministic pipeline validated. Review is ready.',details:{Experiments:(exp.experiments||[]).length,Samples:exp.samples.length,Runs:(exp.runs||[]).length,Measurements:exp.measurements.length,Findings:exp.findings.length,'Experiment brief':briefMode,Pipeline:exp.pipeline&&exp.pipeline.status||'ready'}});
      LF.UI.message('Dataset imported. Review is ready.','success');
    }catch(err){Log.error('dataset.import-failed',{name:file&&file.name,error:err});end({error:err},'error');LF.UI.activityError(err);LF.UI.message(err.message||String(err),'error');}
  }

  async function exportLabFlowZip(){if(!hasExperiment())return;flushDrafts();const exp=S.state.experiment;LF.UI.activityStart({title:'Export LabFlow ZIP',kind:'ZIP',stage:'Building portable save',progress:.15,cancellable:false,details:{Experiment:exp.meta.name}});try{const blob=await LF.Export.save(exp);C.downloadBlob(blob,LF.Export.fileName(exp));LF.UI.activityFinish({message:'Portable LabFlow ZIP created. The source archive inside it is unchanged.',details:{Bytes:blob.size},holdMs:0});LF.UI.message('LabFlow ZIP exported.','success');}catch(err){Log.error('export.labflow-failed',{error:err});LF.UI.activityError(err);LF.UI.message(err.message||String(err),'error');}}
  function saveExportOptions(){LF.Storage.saveExportSettings(Object.assign({},LF.Storage.getExportSettings(),{includeRaw:document.getElementById('nomadRaw').checked,includeDerived:document.getElementById('nomadDerived').checked}));LF.UI.message('Export options saved.','success');}
  async function exportNomadEntry(){if(!hasExperiment())return;flushDrafts();try{LF.NomadExport.exportEntry(S.state.experiment);LF.UI.message('NOMAD entry exported.','success');}catch(err){Log.error('export.nomad-entry-failed',{error:err});LF.UI.message(err.message||String(err),'error');}}
  async function exportNomadZip(){if(!hasExperiment())return;flushDrafts();const exp=S.state.experiment;LF.UI.activityStart({title:'Export NOMAD ZIP',kind:'ZIP',stage:'Preparing NOMAD package',progress:.04,details:{Experiment:exp.meta.name}});try{await LF.NomadExport.exportZip(exp,exp.raw&&exp.raw.sourceArchive,function(info){LF.UI.activityUpdate({stage:info.stage,progress:info.progress,details:{Experiment:exp.meta.name}});});LF.UI.activityFinish({message:'NOMAD staging ZIP created from current LabFlow Data.',holdMs:0});}catch(err){Log.error('export.nomad-zip-failed',{error:err});LF.UI.activityError(err);LF.UI.message(err.message||String(err),'error');}}



  /** Update one Design proposal decision while preserving the current scroll. */
  function updateDesignProposalDecision(kind,index,decision){const proposal=selectedDesignProposal(),list=proposal&&(kind==='solution'?proposal.solutions:proposal.devices),item=list&&list[index];if(!item||item.applied)return;item.decision=decision;proposal.userEdited=true;proposal.updatedAt=new Date().toISOString();markModified('ai');const main=document.getElementById('main'),top=main?main.scrollTop:0;render();requestAnimationFrame(function(){if(main)main.scrollTop=top;});}

  function setFindingFilter(filter,button) {
    document.querySelectorAll('[data-finding-row]').forEach(function(row){row.hidden=filter!=='all'&&row.dataset.findingSeverity!==filter;});
    document.querySelectorAll('[data-finding-filter]').forEach(function(b){b.classList.toggle('primary',b===button);});
    Log.debug('validation.finding-filter',{filter:filter});
  }

  /* ---------- mobile navigation ---------- */
  function setMobileNav(open){const next=!!open;const mobile=!!(window.matchMedia&&window.matchMedia('(max-width:1100px)').matches);document.body.classList.toggle('mobile-nav-open',mobile&&next);const toggle=document.getElementById('mobileNavToggle');if(toggle){toggle.setAttribute('aria-expanded',mobile&&next?'true':'false');toggle.setAttribute('aria-label',mobile&&next?'Close navigation':'Open navigation');}const sidebar=document.getElementById('primarySidebar');if(sidebar){if(mobile)sidebar.setAttribute('aria-hidden',next?'false':'true');else sidebar.removeAttribute('aria-hidden');}}
  function closeMobileNav(){setMobileNav(false);}
  function syncMobileNav(){setMobileNav(document.body.classList.contains('mobile-nav-open'));}

  function chartTooltipNode(){let tip=document.getElementById('resultsChartTooltip');if(tip)return tip;tip=document.createElement('div');tip.id='resultsChartTooltip';tip.className='chart-tooltip';tip.setAttribute('role','status');tip.hidden=true;document.body.appendChild(tip);return tip;}
  function positionChartTooltip(tip,x,y){const gap=12,w=tip.offsetWidth||220,h=tip.offsetHeight||48,left=Math.min(window.innerWidth-w-gap,Math.max(gap,(Number(x)||0)+gap)),top=Math.min(window.innerHeight-h-gap,Math.max(gap,(Number(y)||0)+gap));tip.style.left=left+'px';tip.style.top=top+'px';}
  function showChartTooltip(target,event){if(!target||!target.dataset.chartTip)return;const tip=chartTooltipNode();tip.textContent=target.dataset.chartTip;tip.hidden=false;const box=target.getBoundingClientRect(),x=event&&Number.isFinite(event.clientX)?event.clientX:box.left+box.width/2,y=event&&Number.isFinite(event.clientY)?event.clientY:box.top+box.height/2;positionChartTooltip(tip,x,y);}
  function hideChartTooltip(){const tip=document.getElementById('resultsChartTooltip');if(tip)tip.hidden=true;}

  /* ---------- delegated user interaction ---------- */
  function bindEvents(){
    Log.debug('events.bind.start');
    document.addEventListener('click',function(e){const b=e.target&&e.target.closest?e.target.closest('button'):null;if(b&&!b.hasAttribute('type'))e.preventDefault();},true);
    document.addEventListener('click',async function(e){
      try {
        const route=e.target.closest('[data-route]');
        if(route){e.preventDefault();if(route.matches&&route.matches(':disabled')||route.getAttribute('aria-disabled')==='true')return;closeMobileNav();if(S.state.ui.route==='experiment-design')commitDraft('design');const target=route.dataset.route;if(S.routeRequiresExperiment&&S.routeRequiresExperiment(target)&&!hasExperiment()){S.setRoute('experiment-import');LF.UI.message('Upload the original ZIP to open this workflow step.','info');return;}S.setRoute(target);return;}
        const docLink=e.target.closest('[data-doc-slug]');if(docLink){e.preventDefault();S.state.ui.docsSlug=docLink.dataset.docSlug;renderWithStableAnchor('.docs-workbench');return;}
        const seriesToggle=e.target.closest('[data-chart-series-toggle]');if(seriesToggle){const wrap=seriesToggle.closest('.svg-chart-wrap')||seriesToggle.closest('.panel')||document,series=seriesToggle.dataset.chartSeriesToggle,next=!seriesToggle.classList.contains('active');seriesToggle.classList.toggle('active',next);seriesToggle.setAttribute('aria-pressed',String(next));wrap.querySelectorAll('[data-chart-series="'+series+'"]') .forEach(function(node){node.classList.toggle('chart-series-hidden',!next);});return;}
        const seriesAction=e.target.closest('[data-chart-series-action]');if(seriesAction){const wrap=seriesAction.closest('.panel')||document,show=seriesAction.dataset.chartSeriesAction!=='hide-all';wrap.querySelectorAll('[data-chart-series-toggle]').forEach(function(button){button.classList.toggle('active',show);button.setAttribute('aria-pressed',String(show));});wrap.querySelectorAll('[data-chart-series]').forEach(function(node){node.classList.toggle('chart-series-hidden',!show);});return;}
        const chartExport=e.target.closest('[data-chart-export]');if(chartExport){const format=chartExport.dataset.chartExport,id=chartExport.dataset.chartId,base=C.safeName(S.state.experiment&&S.state.experiment.meta&&S.state.experiment.meta.name||'labflow')+'_'+C.safeName(id||'chart');if(format==='svg')LF.ResultsPage.exportSvg(id,base+'.svg');else LF.ResultsPage.exportCanvas(id,base+'.png');return;}
        const chartCsv=e.target.closest('[data-chart-csv]');if(chartCsv){const kind=chartCsv.dataset.chartCsv,base=C.safeName(S.state.experiment&&S.state.experiment.meta&&S.state.experiment.meta.name||'labflow')+'_'+C.safeName(kind||'chart');LF.ResultsPage.exportChartCsv(kind,base+'.csv');return;}
        const copyDoc=e.target.closest('[data-copy-doc]');if(copyDoc){const ok=C.copyText(LF.DocsPage.markdownFor(copyDoc.dataset.copyDoc));LF.UI.message(ok?'Markdown copied.':'Could not copy Markdown.',ok?'success':'warning');return;}
        if(e.target.closest('[data-open-dataset]')){document.getElementById('datasetInput').click();return;}
        if(e.target.closest('[data-retry-page]')){render();return;}
        if(e.target.closest('[data-rebuild-derived]')){try{if(!hasExperiment())throw new Error('No experiment is loaded.');refreshPipeline(S.state.experiment,'page-recovery:'+S.state.ui.route);render();LF.UI.message('Derived data rebuilt from the current LabFlow Data.','success');}catch(err){Log.error('render.recovery-failed',{route:S.state.ui.route,error:err});LF.UI.message(err.message||String(err),'error');}return;}
        const pceZoom=e.target.closest('[data-pce-zoom]');if(pceZoom){const mode=pceZoom.dataset.pceZoom,current=Math.max(1,Math.min(4,Number(S.state.ui.pceDistributionZoom)||1));S.state.ui.pceDistributionZoom=mode==='reset'?1:mode==='in'?Math.min(4,current+.5):Math.max(1,current-.5);render();return;}
        const curveZoom=e.target.closest('[data-curve-zoom]');if(curveZoom){const mode=curveZoom.dataset.curveZoom,current=Math.max(1,Math.min(4,Number(S.state.ui.curveZoom)||1));S.state.ui.curveZoom=mode==='reset'?1:mode==='in'?Math.min(4,current+.5):Math.max(1,current-.5);render();return;}
        if(e.target.closest('#resetAll')){if(!await LF.UI.confirmAction('The persisted LabFlow session, action history, chat, Design state and RAW snapshot will be cleared. Provider, API key and theme preferences are kept.',{title:'Reset current session',confirmLabel:'Reset session',danger:true}))return;S.resetSession();S.state.ui.pceDistributionZoom=1;if(LF.Storage&&LF.Storage.clearSavedExperiment)await LF.Storage.clearSavedExperiment();if(LF.PageContext)LF.PageContext.clear();render();LF.UI.message('Session reset. Ready for a new ZIP.','info');return;}
        if(e.target.closest('#exportLabFlowZip')){await exportLabFlowZip();return;}
        if(e.target.closest('#exportNomadEntry')){exportNomadEntry();return;}
        if(e.target.closest('#exportNomadZip')){await exportNomadZip();return;}
        if(e.target.closest('#saveExportOptions')){saveExportOptions();render();return;}
        const exportOption=e.target.closest('[data-export-option]');if(exportOption){const settings=Object.assign({},LF.Storage.getExportSettings()),key=exportOption.dataset.exportOption,value=exportOption.dataset.exportOptionValue==='true';settings[key]=value;LF.Storage.saveExportSettings(settings);if(S.state.experiment&&S.state.experiment.nomad)S.state.experiment.nomad.mappingPlan=null;render();LF.UI.message('NOMAD package option updated.','success');return;}
        const exportFocus=e.target.closest('[data-export-focus]');if(exportFocus){S.state.ui.exportFocus=exportFocus.dataset.exportFocus||'';render();setTimeout(function(){const target=S.state.ui.exportFocus==='patch-provenance'?document.getElementById('exportPatchProvenance'):document.getElementById('exportDangerFindings');if(target&&target.scrollIntoView)target.scrollIntoView({behavior:'smooth',block:'center'});},0);return;}
        const exportRepair=e.target.closest('[data-export-repair]');if(exportRepair){const exp=S.state.experiment,id=exportRepair.dataset.exportRepair;if(id==='complete-provenance'&&LF.NomadExport&&LF.NomadExport.repairPatchProvenance){const count=LF.NomadExport.repairPatchProvenance(exp);markModified('metadata');render();LF.UI.message(count?('Completed change details for '+count+' '+(count===1?'record':'records')+'.'):'No change details needed repair.',count?'success':'info');return;}if(id==='restore-source-name'&&exp&&exp.raw&&exp.raw.sourceName){exp.meta=exp.meta||{};exp.meta.sourceName=exp.raw.sourceName;markModified('metadata');render();LF.UI.message('Source archive details restored from the original ZIP.','success');return;}LF.UI.message('This export issue needs researcher review.','warning');return;}
        if(e.target.closest('[data-export-refresh]')){const exp=S.currentExperiment?S.currentExperiment('nomad-recheck'):S.state.experiment;S.commitAllDrafts&&S.commitAllDrafts();LF.UI.activityStart({title:'Recheck NOMAD readiness',subtitle:'Deterministic local validation',kind:'LOCAL',stage:'Refreshing LabFlow Data',progress:.25,cancellable:false,response:'Rebuilding the current mapping and validation from the same ExperimentData used by Results, Design, Actions and Assistant.'});try{if(exp&&exp.nomad){exp.nomad.mappingPlan=null;exp.nomad.validation=null;}if(LF.DataPipeline&&LF.DataPipeline.refresh)LF.DataPipeline.refresh(exp,{reason:'nomad-recheck'});LF.UI.activityUpdate({stage:'Validating package',progress:.72});const validation=LF.NomadExport.validate(exp,exp.raw&&exp.raw.sourceArchive);render();LF.UI.activityFinish({message:validation.status==='blocked'?'NOMAD still needs attention.':'NOMAD readiness updated.',response:(validation.problems||[]).length?(validation.problems||[]).map(function(x){return (x.severity==='blocking'?'BLOCK':'REVIEW')+' · '+x.message;}).join('\n'):'Local staging checks passed.',details:{Status:validation.status,'Blocking issues':(validation.problems||[]).filter(function(x){return x.severity==='blocking';}).length,'Review items':(validation.problems||[]).filter(function(x){return x.severity!=='blocking';}).length},holdMs:0});}catch(error){LF.UI.activityError(error,{response:error.message||String(error),holdMs:0});}return;}
        if(e.target.closest('#mobileNavToggle')){setMobileNav(!document.body.classList.contains('mobile-nav-open'));return;}
        if(e.target.closest('#mobileNavShade')||e.target.closest('#sidebarDismiss')){closeMobileNav();return;}
        if(e.target.closest('#assistantClose')){S.state.ui.assistantOpen=false;LF.Storage.saveUiSettings({assistantOpen:false});render();return;}
        if(e.target.closest('#assistantToggle')){S.state.ui.assistantOpen=!S.state.ui.assistantOpen;LF.Storage.saveUiSettings({assistantOpen:S.state.ui.assistantOpen});render();return;}
        if(e.target.closest('[data-theme-toggle]')){LF.Theme.toggle();return;}
        const themeChoice=e.target.closest('[data-theme-choice]');if(themeChoice){LF.Theme.apply(themeChoice.dataset.themeChoice);return;}
        if(e.target.closest('#resultInspectorClose')){LF.ResultsPage.closeResultInspector();return;}

        const resultTab=e.target.closest('[data-result-tab]');if(resultTab){S.state.ui.resultsTab=resultTab.dataset.resultTab;renderWithStableAnchor('.results-main-tabs');return;}
        const dataMode=e.target.closest('[data-results-data-mode]');if(dataMode){S.state.ui.resultsDataMode=dataMode.dataset.resultsDataMode||'all';S.state.ui.resultsTab='all';renderWithStableAnchor('.results-main-tabs');return;}
        const jvMode=e.target.closest('[data-results-jv-mode]');if(jvMode){S.state.ui.resultsJvMode=jvMode.dataset.resultsJvMode||'single';S.state.ui.curveView=S.state.ui.resultsJvMode==='overlay'?'overlay':'single';S.state.ui.resultsTab='curves';renderWithStableAnchor('.results-main-tabs');return;}
        const quick=e.target.closest('[data-results-quick]');if(quick){const q=quick.dataset.resultsQuick;if(q==='jv'){S.state.ui.resultsJvMode='single';S.state.ui.curveView='single';S.state.ui.resultsTab='curves';}else if(q==='compare'){S.state.ui.resultsTab='boxplots';}else if(q==='warnings'){S.state.ui.resultsDataMode='warnings';S.state.ui.resultsTab='all';}else if(q==='top'){S.state.ui.resultsDataMode='top';S.state.ui.resultsTab='all';}else{S.state.ui.resultsDataMode='all';S.state.ui.resultsTab='all';}renderWithStableAnchor('.results-main-tabs');return;}
        const openDesignExperiment=e.target.closest('[data-open-design-experiment]');if(openDesignExperiment){S.state.ui.selectedDesignDeviceId=openDesignExperiment.dataset.openDesignExperiment;activateDesignProposal(S.state.ui.selectedDesignDeviceId);S.setRoute('experiment-design');return;}
        const designCard=e.target.closest('[data-design-select]');if(designCard){S.state.ui.selectedDesignDeviceId=designCard.dataset.designSelect;activateDesignProposal(S.state.ui.selectedDesignDeviceId);render();return;}
        const settingsSection=e.target.closest('[data-settings-section]');if(settingsSection){S.state.ui.settingsSection=settingsSection.dataset.settingsSection;render();const main=document.getElementById('main');if(main)main.scrollTop=0;return;}
        if(e.target.closest('#openNomadSettings')){S.state.ui.settingsSection='nomad';S.setRoute('settings');return;}
        if(e.target.closest('#uploadNomadStub')){LF.UI.message('Direct NOMAD upload is not implemented yet. The configured credentials were not used and no data was sent.','info','NOMAD upload');return;}
        const actionEditor=e.target.closest('[data-action-editor]');if(actionEditor){S.state.ui.settingsActionId=actionEditor.dataset.actionEditor;S.state.ui.settingsActionId=actionEditor.dataset.actionEditor;render();return;}
        const findingFilter=e.target.closest('[data-finding-filter]');if(findingFilter){setFindingFilter(findingFilter.dataset.findingFilter,findingFilter);return;}
        const applyReview=e.target.closest('[data-apply-review-proposal]');if(applyReview){
          const idx=Number(applyReview.dataset.applyReviewProposal),plan=ambiguityPlan(),p=plan&&plan.proposals&&plan.proposals[idx];
          if(p){try{const out=LF.DatasetCorrections.commitProposals(S.state.experiment,p,'ai',{actionId:'dataset.resolve-ambiguities',reason:'review-correction'});render();LF.UI.message('AI suggestion applied to '+out.changed+' '+(out.changed===1?'record':'records')+'.','success');}catch(err){p.applyError=err.message||String(err);Log.warn('review.proposal-apply-failed',{index:idx,error:err});render();LF.UI.message(p.applyError,'error');}}return;
        }
        if(e.target.closest('#applyAllAiCorrections')){
          const plan=ambiguityPlan(),items=plan&&plan.proposals||[],pending=items.filter(function(p){return !p.applied&&p.decision!=='rejected';});if(!pending.length){LF.UI.message('No accepted correction is waiting to be applied.','info');return;}
          try{const out=LF.DatasetCorrections.commitProposals(S.state.experiment,pending,'ai',{actionId:'dataset.resolve-ambiguities',reason:'review-corrections'});render();LF.UI.message('Applied '+(out.requested-out.failed)+' AI suggestion'+((out.requested-out.failed)===1?'':'s')+' to '+out.changed+' '+(out.changed===1?'record':'records')+(out.failed?' · '+out.failed+' could not be applied':''),out.failed?'warning':'success');}catch(err){render();LF.UI.message(err.message||String(err),'error');}return;
        }
        const reviewProposal=e.target.closest('[data-review-proposal]');if(reviewProposal){updateProposalDecision(Number(reviewProposal.dataset.reviewProposal),reviewProposal.dataset.decision||'pending');render();return;}
        if(e.target.closest('#applyAutomaticCleanup')){
          const exp=S.state.experiment,pending=LF.DatasetCorrections.safeFixes(exp);
          if(!pending.length){refreshPipeline(exp,'automatic-cleanup-refresh');render();LF.UI.message('No safe cleanup correction is waiting.','info');return;}
          const ok=await LF.UI.confirmAction('Apply '+pending.length+' safe correction'+(pending.length===1?'':'s')+' to the LabFlow Data? The original ZIP stays unchanged.',{title:'Apply safe corrections',confirmLabel:'Apply',cancelLabel:'Cancel'});if(!ok)return;
          try{const out=LF.DatasetCorrections.commitAutomaticSafeFixes(exp);render();LF.UI.message('Applied '+Number(out.lastApplied||0)+' safe correction'+(Number(out.lastApplied||0)===1?'':'s')+' to '+Number(out.targets||0)+' '+(Number(out.targets||0)===1?'record':'records')+'.','success');}catch(err){Log.warn('review.automatic-cleanup-apply-failed',{error:err});refreshPipeline(exp,'automatic-cleanup-recovery');render();LF.UI.message(err.message||String(err),'error');}return;
        }
        const reviewFix=e.target.closest('[data-apply-review-fix]');if(reviewFix){
          const items=S.state.experiment.datasetAnalysis&&S.state.experiment.datasetAnalysis.reviewFixes||[],fix=items[Number(reviewFix.dataset.applyReviewFix)];
          if(fix){try{const out=LF.DatasetCorrections.commitProposals(S.state.experiment,Object.assign({},fix),'user',{actionId:'review.exclude-measurement',reason:'review-exclusion'});render();LF.UI.message('Measurement excluded from analysis.','success');}catch(err){LF.UI.message(err.message||String(err),'error');}}return;
        }
        if(e.target.closest('#applyAllReviewFixes')){
          const items=(S.state.experiment.datasetAnalysis&&S.state.experiment.datasetAnalysis.reviewFixes||[]).slice();if(!items.length)return;
          if(!await LF.UI.confirmAction('Exclude '+items.length+' blocked measurement'+(items.length===1?'':'s')+' from scientific analysis and rankings? The source data remains unchanged and every exclusion is recorded.',{title:'Apply suggested exclusions',confirmLabel:'Apply exclusions',cancelLabel:'Cancel'}))return;
          try{const out=LF.DatasetCorrections.commitProposals(S.state.experiment,items.map(function(fix){return Object.assign({},fix);}), 'user',{actionId:'review.exclude-measurements',reason:'review-exclusions'});render();LF.UI.message((out.requested-out.failed)+' exclusion'+((out.requested-out.failed)===1?'':'s')+' committed'+(out.failed?' · '+out.failed+' failed':''),out.failed?'warning':'success');}catch(err){render();LF.UI.message(err.message||String(err),'error');}return;
        }
        const localFix=e.target.closest('[data-local-fix]');if(localFix){
          const m=S.state.experiment.measurements.find(function(x){return x.id===localFix.dataset.measurementId;});if(m){const exclude=localFix.dataset.localFix==='exclude',proposal={patch_type:exclude?'exclude_measurement':'restore_measurement',target:m.id,before:!!m.excluded,after:exclude,reason:'Review data local correction',evidence:['Researcher-confirmed local correction']};try{const out=LF.DatasetCorrections.commitProposals(S.state.experiment,proposal,'user',{actionId:'review.measurement-eligibility',reason:'review-correction'});render();LF.UI.message(exclude?'Measurement excluded from analysis.':'Measurement restored to analysis.','success');}catch(err){LF.UI.message(err.message||String(err),'error');}}return;
        }

        if(e.target.closest('#discardRepairPlan')){discardRepairPlan();return;}
        if(e.target.closest('#revalidateDataset')){refreshPipeline(S.state.experiment,'manual-refresh');if(LF.ActionData)LF.ActionData.removeProposal(S.state.experiment,'dataset.resolve-ambiguities');render();LF.UI.message('Data checks rebuilt from the current LabFlow Data.','success');return;}
        
        if(e.target.closest('#refreshDesignEvidence')){if(LF.DesignModel&&LF.DesignModel.projectSource)LF.DesignModel.projectSource(S.state.experiment,true);refreshPipeline(S.state.experiment,'design-source-refresh');render();LF.UI.message('Design information re-read from the source.','success');return;}
        if(e.target.closest('#applyAllDesignSuggestions')){try{const out=LF.DesignAnalysis.applyAll(S.state.experiment,S.state.ui.selectedDesignDeviceId);if(out.changed){markModified('design');render();LF.UI.message('Applied '+out.changed+' AI-proposed missing field'+(out.changed===1?'':'s')+' to Design.','success');}else{render();LF.UI.message('No missing field could be filled without overwriting existing values.','info');}}catch(err){LF.UI.message(err.message||String(err),'error');}return;}
        if(e.target.closest('#acceptAllDesignInferences')){const exp=S.state.experiment,count=Object.keys(LF.ActionData?LF.ActionData.proposals(exp,'design.infer'):{}).length;if(!count){LF.UI.message('No AI Design suggestions are waiting for acceptance.','info');return;}const ok=await LF.UI.confirmAction('Accept all '+count+' current AI Design suggestion'+(count===1?'':'s')+'? LabFlow fills only empty chemistry, architecture and process fields; existing researcher or source values stay unchanged. You can edit accepted values immediately afterwards.',{title:'Accept all Design suggestions',confirmLabel:'Accept all',cancelLabel:'Cancel'});if(!ok)return;try{const out=LF.DesignAnalysis.acceptAllProposals(exp);if(out.changed)markModified('design');else markModified('ai');(out.acceptedIds||[]).forEach(function(id){LF.ActionData.setStatus(exp,'design.infer',id,{state:'accepted',updatedAt:new Date().toISOString(),message:''});});(out.incomplete||[]).forEach(function(item){LF.ActionData.setStatus(exp,'design.infer',item.id,{state:'incomplete',updatedAt:new Date().toISOString(),message:'Still missing: '+(item.remaining||[]).join(', ')});});(out.failed||[]).forEach(function(item){LF.ActionData.setStatus(exp,'design.infer',item.id,{state:'error',updatedAt:new Date().toISOString(),message:item.message||'Accept failed'});});render();const issues=(out.incomplete||[]).length+(out.failed||[]).length,msg='Accepted '+out.accepted+' experiment suggestion'+(out.accepted===1?'':'s')+((out.incomplete||[]).length?' · '+out.incomplete.length+' still incomplete':'')+((out.failed||[]).length?' · '+out.failed.length+' failed':'')+'.';LF.UI.message(msg,issues?'warning':'success');}catch(err){LF.UI.message(err.message||String(err),'error');}return;}
        if(e.target.closest('#applyAcceptedDesignProposal')){try{const out=LF.DesignAnalysis.applyAccepted(S.state.experiment,S.state.ui.selectedDesignDeviceId);markModified('design');render();LF.UI.message('Applied '+(out.solutions+out.devices)+' accepted Design item(s).','success');}catch(err){LF.UI.message(err.message||String(err),'error');}return;}
        const applyDesignProposal=e.target.closest('[data-apply-design-proposal]');if(applyDesignProposal){try{const out=LF.DesignAnalysis.applyOne(S.state.experiment,applyDesignProposal.dataset.applyDesignProposal,Number(applyDesignProposal.dataset.proposalIndex),applyDesignProposal.dataset.proposalPart||'all',S.state.ui.selectedDesignDeviceId);markModified('design');render();LF.UI.message('AI suggestion applied to '+out.changed+' missing field'+(out.changed===1?'':'s')+'.','success');}catch(err){LF.UI.message(err.message||String(err),'error');}return;}
        const applyDesignDevice=e.target.closest('[data-apply-design-device]');if(applyDesignDevice){try{const out=LF.DesignAnalysis.applySelectedDevice(S.state.experiment,applyDesignDevice.dataset.applyDesignDevice,S.state.ui.selectedDesignDeviceId);markModified('design');render();LF.UI.message('Applied AI-suggested missing values to '+out.changed+' Design field(s) for the selected experiment.','success');}catch(err){LF.UI.message(err.message||String(err),'error');}return;}
        const acceptDesignExperiment=e.target.closest('[data-accept-design-experiment]');if(acceptDesignExperiment){try{const exp=S.state.experiment,out=LF.DesignAnalysis.acceptProposal(exp,acceptDesignExperiment.dataset.acceptDesignExperiment);if(out.changed)markModified('design');else markModified('ai');LF.ActionData.setStatus(exp,'design.infer',out.deviceId,{state:out.complete?'accepted':'incomplete',updatedAt:new Date().toISOString(),message:out.complete?'':'Still missing: '+(out.remaining||[]).join(', ')});render();LF.UI.message(out.complete?'AI suggestion accepted. The experiment Design is complete.':'AI values were accepted, but this older suggestion did not cover: '+(out.remaining||[]).join(', ')+'. Run Complete with AI once more for the remaining domains.',out.complete?'success':'warning');}catch(err){LF.UI.message(err.message||String(err),'error');}return;}
        const discardDesignExperiment=e.target.closest('[data-discard-design-experiment]');if(discardDesignExperiment){const exp=S.state.experiment,id=String(discardDesignExperiment.dataset.discardDesignExperiment||'');if(LF.ActionData){LF.ActionData.removeProposal(exp,'design.infer',id);LF.ActionData.setStatus(exp,'design.infer',id,{state:'idle',updatedAt:new Date().toISOString(),message:''});}markModified('ai');render();LF.UI.message('AI suggestion discarded.','info');return;}
        const openDesignCabinet=e.target.closest('[data-open-design-cabinet]');if(openDesignCabinet){S.state.ui.designCabinetPicker=openDesignCabinet.dataset.openDesignCabinet||'';render();return;}
        if(e.target.closest('[data-close-design-cabinet]')){S.state.ui.designCabinetPicker='';render();return;}
        const useCabinetItem=e.target.closest('[data-use-cabinet-item]');if(useCabinetItem){
          try{
            const exp=ensureExperimentShape(S.state.experiment),item=LF.Cabinet&&LF.Cabinet.get(useCabinetItem.dataset.useCabinetItem),dev=(exp.design.devices||[]).find(function(x){return String(x.id)===String(S.state.ui.selectedDesignDeviceId);})||(exp.design.devices||[])[0];if(!item||!dev){LF.UI.message('No Design experiment or Cabinet resource is available.','warning');return;}
            if(item.kind==='stack'&&(dev.stack||[]).length){const ok=await LF.UI.confirmAction('Replace the current stack for “'+(dev.name||'this experiment')+'” with a snapshot of “'+item.name+'” from Lab Cabinet? The current experiment values will be replaced, but the Cabinet item remains independent.',{title:'Use Cabinet stack',confirmLabel:'Replace stack',cancelLabel:'Cancel'});if(!ok)return;}
            const out=LF.Cabinet.applyToDesign(exp,dev.id,item.id,{replace:true});if(out.changed){S.state.ui.selectedDesignDeviceId=dev.id;markModified('design');S.state.ui.designCabinetPicker='';render();LF.UI.message('Applied Cabinet snapshot: '+item.name+'.','success');}else LF.UI.message('The selected Cabinet resource adds no new Design values.','info');
          }catch(err){LF.UI.message('Cabinet resource could not be applied: '+(err&&err.message||String(err)),'error');}
          return;
        }
        const saveSolutionCabinet=e.target.closest('[data-save-solution-cabinet]');if(saveSolutionCabinet){try{const item=LF.Cabinet.saveDesignSolution(S.state.experiment,saveSolutionCabinet.dataset.saveSolutionCabinet);S.state.ui.cabinetSelectedId=item.id;LF.UI.message('Saved “'+item.name+'” to Lab Cabinet.','success');}catch(err){LF.UI.message(err&&err.message||String(err),'error');}return;}
        if(e.target.closest('#saveStackCabinet')){try{const item=LF.Cabinet.saveDesignStack(S.state.experiment,S.state.ui.selectedDesignDeviceId);S.state.ui.cabinetSelectedId=item.id;LF.UI.message('Stack saved to Lab Cabinet.','success');}catch(err){LF.UI.message(err&&err.message||String(err),'error');}return;}
        if(e.target.closest('#saveProtocolCabinet')){try{const item=LF.Cabinet.saveDesignProtocol(S.state.experiment,S.state.ui.selectedDesignDeviceId);S.state.ui.cabinetSelectedId=item.id;LF.UI.message('Process protocol saved to Lab Cabinet.','success');}catch(err){LF.UI.message(err&&err.message||String(err),'error');}return;}

        const cabinetKind=e.target.closest('[data-cabinet-kind]');if(cabinetKind){S.state.ui.cabinetKind=cabinetKind.dataset.cabinetKind||'all';renderWithStableAnchor('.cabinet-filter-tabs');return;}
        const cabinetSelect=e.target.closest('[data-cabinet-select]');if(cabinetSelect){S.state.ui.cabinetSelectedId=cabinetSelect.dataset.cabinetSelect;render();return;}
        if(e.target.closest('#cabinetAddItem')){const select=document.getElementById('cabinetNewKind'),kind=select&&select.value||'material',item=LF.Cabinet.create(kind,{});S.state.ui.cabinetKind=kind;S.state.ui.cabinetSelectedId=item.id;render();return;}
        const cabinetDuplicate=e.target.closest('[data-cabinet-duplicate]');if(cabinetDuplicate){const item=LF.Cabinet.duplicate(cabinetDuplicate.dataset.cabinetDuplicate);S.state.ui.cabinetKind=item.kind;S.state.ui.cabinetSelectedId=item.id;render();LF.UI.message('Cabinet resource duplicated.','success');return;}
        if(e.target.closest('#cabinetExport')){const payload=LF.Cabinet.exportState(),blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='labflow-cabinet.json';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},0);LF.UI.message('Cabinet backup exported.','success');return;}
        if(e.target.closest('#cabinetImport')){const input=document.getElementById('cabinetImportFile');if(input)input.click();return;}
        const cabinetDelete=e.target.closest('[data-cabinet-delete]');if(cabinetDelete){const item=LF.Cabinet.get(cabinetDelete.dataset.cabinetDelete);if(!item)return;const ok=await LF.UI.confirmAction('Delete “'+item.name+'” from Lab Cabinet? Existing experiments that used it keep their copied snapshots.',{title:'Delete Cabinet resource',confirmLabel:'Delete',cancelLabel:'Cancel',danger:true});if(!ok)return;LF.Cabinet.remove(item.id);S.state.ui.cabinetSelectedId=null;render();LF.UI.message('Cabinet resource deleted. Existing experiment snapshots are unchanged.','success');return;}
        if(e.target.closest('#cabinetAddLayer')){const item=LF.Cabinet.get(S.state.ui.cabinetSelectedId);if(item&&item.kind==='stack'){const layers=(item.layers||[]).slice();layers.push({role:'',material:'',thickness:'',process:''});LF.Cabinet.update(item.id,{layers:layers});render();}return;}
        const cabinetRemoveLayer=e.target.closest('[data-cabinet-remove-layer]');if(cabinetRemoveLayer){const item=LF.Cabinet.get(S.state.ui.cabinetSelectedId);if(item&&item.kind==='stack'){const layers=(item.layers||[]).slice();layers.splice(Number(cabinetRemoveLayer.dataset.cabinetRemoveLayer),1);LF.Cabinet.update(item.id,{layers:layers});render();}return;}
        const cabinetUseDesign=e.target.closest('[data-cabinet-use-design]');if(cabinetUseDesign){try{if(!hasExperiment()){LF.UI.message('Upload an experiment before using Cabinet resources in Design.','info');return;}const exp=ensureExperimentShape(S.state.experiment),dev=(exp.design.devices||[]).find(function(x){return String(x.id)===String(S.state.ui.selectedDesignDeviceId);})||(exp.design.devices||[])[0],item=LF.Cabinet.get(cabinetUseDesign.dataset.cabinetUseDesign);if(!dev||!item){LF.UI.message('No Design experiment is available.','warning');return;}if(item.kind==='stack'&&(dev.stack||[]).length){const ok=await LF.UI.confirmAction('Replace the current stack for “'+(dev.name||'this experiment')+'” with “'+item.name+'”?',{title:'Use Cabinet stack',confirmLabel:'Replace stack',cancelLabel:'Cancel'});if(!ok)return;}const out=LF.Cabinet.applyToDesign(exp,dev.id,item.id,{replace:true});if(out.changed){S.state.ui.selectedDesignDeviceId=dev.id;markModified('design');S.setRoute('experiment-design');LF.UI.message('Cabinet snapshot applied to '+(dev.name||'Design')+'.','success');}else LF.UI.message('The selected Cabinet resource adds no new Design values.','info');}catch(err){LF.UI.message('Cabinet resource could not be applied: '+(err&&err.message||String(err)),'error');}return;}
        if(e.target.closest('#runNomadValidation')){LF.Nomad.validate(S.state.experiment,S.state.experiment.raw&&S.state.experiment.raw.sourceArchive);render();LF.UI.message('NOMAD validation refreshed.','success');return;}

        const openCurve=e.target.closest('[data-open-single-curve]');if(openCurve){e.preventDefault();e.stopPropagation();S.state.ui.selectedMeasurementId=openCurve.dataset.openSingleCurve;S.state.ui.curveSelection=[openCurve.dataset.openSingleCurve];S.state.ui.curveView='single';S.state.ui.resultsTab='curves';renderWithStableAnchor('.results-main-tabs');return;}
        const curveSelect=e.target.closest('[data-curve-select]');if(curveSelect){e.preventDefault();S.state.ui.selectedMeasurementId=curveSelect.dataset.curveSelect;S.state.ui.curveSelection=[curveSelect.dataset.curveSelect];render();return;}
        const row=e.target.closest('[data-measurement-row]');if(row){S.state.ui.selectedMeasurementId=row.dataset.measurementRow;const inlineDesktop=!!row.closest('.results-master-detail')&&window.matchMedia&&window.matchMedia('(min-width: 1181px)').matches;if(inlineDesktop){S.state.ui.resultInspectorId=null;render();}else{S.state.ui.resultInspectorId=row.dataset.measurementRow;LF.ResultsPage.renderResultInspector();}return;}
        const resolve=e.target.closest('[data-resolve-finding]');if(resolve){const f=S.state.experiment.findings.find(function(x){return x.id===resolve.dataset.resolveFinding;});if(f){f.status='resolved';Log.info('validation.finding-resolved',{id:f.id,code:f.code});markModified('validation');render();}return;}

        if(e.target.closest('#addDesignDevice')){
          const dev=LF.DesignModel.createDevice(S.state.experiment);
          S.state.ui.selectedDesignDeviceId=dev.id;
          Log.info('design.experiment-added',{id:dev.id});
          markModified('design');render();return;
        }
        if(e.target.closest('#removeSelectedDevice')){
          const exp=S.state.experiment,id=S.state.ui.selectedDesignDeviceId,dev=LF.DesignModel.device(exp,id);
          if(!dev)return;
          const ok=await LF.UI.confirmAction('Remove “'+(dev.name||dev.group||'this variant')+'” from the LabFlow Data? Source data is not deleted; source-derived variants can be reconstructed with Re-read source.',{title:'Remove Design variant',confirmLabel:'Remove variant',cancelLabel:'Cancel',danger:true});
          if(!ok)return;
          const out=LF.DesignModel.removeDevice(exp,id),removed=out.removed,next=out.next;
          if(LF.ActionData&&id){LF.ActionData.removeProposal(exp,'design.infer',id);LF.ActionData.removeStatus(exp,'design.infer',id);}
          S.state.ui.selectedDesignDeviceId=next?next.id:null;
          activateDesignProposal(S.state.ui.selectedDesignDeviceId);
          Log.info('design.device-removed',{id:id,samples:(removed&&removed.sampleNames||[]).length});
          markModified('design');render();LF.UI.message('Design variant removed.','success');return;
        }
        if(e.target.closest('#addSolution')){
          const solution=LF.DesignModel.createSolution(S.state.experiment,{},S.state.ui.selectedDesignDeviceId);
          Log.info('design.formulation-added',{id:solution.id,experimentId:S.state.ui.selectedDesignDeviceId||''});
          markModified('design');render();return;
        }
        const devicePick=e.target.closest('[data-design-device]');if(devicePick){S.state.ui.selectedDesignDeviceId=devicePick.dataset.designDevice;render();return;}
        if(e.target.closest('#addDeviceLayer')){
          LF.DesignModel.createDeviceLayer(S.state.experiment,S.state.ui.selectedDesignDeviceId,{});
          markModified('design');render();return;
        }
        const removeDeviceLayer=e.target.closest('[data-remove-device-layer]');if(removeDeviceLayer){
          LF.DesignModel.removeDeviceLayer(S.state.experiment,S.state.ui.selectedDesignDeviceId,Number(removeDeviceLayer.dataset.removeDeviceLayer));
          markModified('design');render();return;
        }
        const removeSolution=e.target.closest('[data-remove-solution]');if(removeSolution){
          const removed=LF.DesignModel.removeSolution(S.state.experiment,Number(removeSolution.dataset.removeSolution));
          Log.info('design.solution-removed',{index:Number(removeSolution.dataset.removeSolution),id:removed&&removed.id||''});
          markModified('design');render();return;
        }
        const designProposalDecision=e.target.closest('[data-design-proposal-decision]');if(designProposalDecision){updateDesignProposalDecision(designProposalDecision.dataset.designProposalDecision,Number(designProposalDecision.dataset.proposalIndex),designProposalDecision.dataset.decision||'pending');return;}
        if(e.target.closest('#acceptAllDesignProposal')){const proposal=selectedDesignProposal();if(proposal){(proposal.solutions||[]).concat(proposal.devices||[]).forEach(function(item){if(!item.applied&&(item.decision||'pending')==='pending')item.decision='accepted';});proposal.userEdited=true;proposal.updatedAt=new Date().toISOString();markModified('ai');render();}return;}
        if(e.target.closest('#discardDesignProposal')){const exp=S.state.experiment,id=S.state.ui.selectedDesignDeviceId;if(LF.ActionData&&id)LF.ActionData.removeProposal(exp,'design.infer',id);Log.info('design.proposal-discarded',{deviceId:id||''});markModified('ai');render();LF.UI.message('AI design proposal discarded.','info');return;}

        const kbPick=e.target.closest('[data-kb-entry]');if(kbPick){S.state.ui=S.state.ui||{};S.state.ui.settingsKnowledgeId=kbPick.dataset.kbEntry;render();return;}
        if(e.target.closest('#kbAddEntry')){S.state.ui=S.state.ui||{};S.state.ui.settingsKnowledgeId='__new__';render();return;}
        if(e.target.closest('#saveKbEntry')){const item=LF.KnowledgeBase.save(knowledgeFormEntry());S.state.ui.settingsKnowledgeId=item.id;LF.UI.message(item.status==='active'?'Knowledge saved and available to AI.':'Knowledge draft saved.','success');render();return;}
        if(e.target.closest('#duplicateKbEntry')){const btn=e.target.closest('#duplicateKbEntry'),id=btn.dataset.kbId||S.state.ui.settingsKnowledgeId,item=LF.KnowledgeBase.duplicate(id);S.state.ui.settingsKnowledgeId=item.id;LF.UI.message('Knowledge copied as a draft.','success');render();return;}
        if(e.target.closest('#deleteKbEntry')){const btn=e.target.closest('#deleteKbEntry'),id=btn.dataset.kbId||S.state.ui.settingsKnowledgeId,item=LF.KnowledgeBase.get(id);if(item&&await LF.UI.confirmAction('Delete “'+item.title+'” from the custom Knowledge Base?',{title:'Delete knowledge entry',confirmLabel:'Delete',danger:true})){LF.KnowledgeBase.remove(id);S.state.ui.settingsKnowledgeId='';LF.UI.message('Knowledge entry deleted.','success');render();}return;}
        if(e.target.closest('#exportKb')){const payload=LF.KnowledgeBase.exportJsonl('custom');C.downloadBlob(C.textBlob(payload,'application/x-ndjson;charset=utf-8'),'labflow-knowledge-base.jsonl');return;}
        if(e.target.closest('#importKb')){const input=document.getElementById('kbImportFile');if(input)input.click();return;}
        if(e.target.closest('#resetKbCustom')){if(await LF.UI.confirmAction('Clear every browser-local Knowledge Base entry? Export a backup first if you need to keep them.',{title:'Clear custom Knowledge Base',confirmLabel:'Clear custom KB',danger:true})){LF.KnowledgeBase.resetCustom();S.state.ui.settingsKnowledgeId='';LF.UI.message('Custom Knowledge Base cleared.','success');render();}return;}

        if(e.target.closest('#saveUserProfile')){LF.Storage.saveUserProfile({name:document.getElementById('userName').value.trim(),organization:document.getElementById('userOrganization').value.trim(),email:document.getElementById('userEmail').value.trim()});LF.UI.message('Profile saved.','success');render();return;}
        if(e.target.closest('#saveNomadSettings')){const instance=document.getElementById('nomadInstance').value.trim(),webUrl=document.getElementById('nomadWebUrl').value.trim(),apiEndpoint=document.getElementById('nomadApiEndpoint').value.trim(),username=document.getElementById('nomadUsername').value.trim(),token=document.getElementById('nomadToken').value;LF.Storage.saveNomadSettings({instance:instance||'NOMAD',webUrl:webUrl,apiEndpoint:apiEndpoint,username:username});LF.Storage.saveNomadToken(token);LF.UI.message('NOMAD settings saved locally. No data was uploaded.','success');render();return;}
        if(e.target.closest('#clearNomadToken')){LF.Storage.saveNomadToken('');LF.UI.message('NOMAD token cleared from this browser.','success');render();return;}
        if(e.target.closest('#saveAssistantSettings')){LF.Storage.saveAssistantSettings({memoryEnabled:document.getElementById('assistantMemoryEnabled').checked,memoryTurns:Number(document.getElementById('assistantMemoryTurns').value),memoryChars:Number(document.getElementById('assistantMemoryChars').value),messageChars:Number(document.getElementById('assistantMessageChars').value),maxOutputTokens:Number(document.getElementById('assistantMaxOutputTokens').value),temperature:Number(document.getElementById('assistantTemperature').value),contextChars:Number(document.getElementById('assistantContextChars').value)});LF.UI.message('Assistant settings saved.','success');render();return;}
        if(e.target.closest('#saveActionEditor')){const btn=e.target.closest('#saveActionEditor'),id=btn.dataset.actionId,defText=document.getElementById('actionDefinitionEditor').value,promptText=document.getElementById('actionPromptEditor').value;try{const def=JSON.parse(defText);if(!def||def.id!==id)throw new Error('Action id must remain '+id+'.');if(!def.contract||!def.execution||!Array.isArray(def.execution.steps)||!def.execution.steps.length)throw new Error('Action definition requires contract and execution.steps.');LF.Storage.saveActionOverride(id,{definition:def,prompt:promptText});LF.UI.message('Action runtime configuration saved.','success');render();}catch(err){LF.UI.message('Action not saved: '+(err.message||String(err)),'error');}return;}
        if(e.target.closest('#resetActionEditor')){const btn=e.target.closest('#resetActionEditor'),id=btn.dataset.actionId;if(await LF.UI.confirmAction('Reset '+id+' to its source action.json and prompt.md?',{title:'Reset Action configuration',confirmLabel:'Reset Action'})){LF.Storage.resetActionOverride(id);LF.UI.message('Action reset to source definition.','success');render();}return;}
        if(e.target.closest('#clearAssistantConversation')){if(hasExperiment()&&await LF.UI.confirmAction('Clear the current Assistant conversation and its memory?',{title:'Clear Assistant memory',confirmLabel:'Clear conversation',danger:true})){const d=LF.State.ensureDerived(S.state.experiment);d.chat=d.chat||{conversation:[]};d.chat.conversation=[];markModified('ai');LF.UI.message('Assistant conversation cleared.','success');render();}return;}
        if(e.target.closest('#saveLogSettings')){LF.Logger.saveSettings({enabled:document.getElementById('logEnabled').checked,level:document.getElementById('logLevel').value,maxEntries:Number(document.getElementById('logMaxEntries').value)||2500,interactions:document.getElementById('logInteractions').checked,network:document.getElementById('logNetwork').checked});LF.UI.message('Logging settings applied. Reload only if you changed network instrumentation.','success');render();return;}
        const logLevel=e.target.closest('[data-log-level]');if(logLevel){LF.LogsPage.setLevel(logLevel.dataset.logLevel);render();return;}
        const logCategory=e.target.closest('[data-log-category]');if(logCategory){LF.LogsPage.setCategory(logCategory.dataset.logCategory);render();return;}
        if(e.target.closest('#refreshLogs')){render();return;}
        if(e.target.closest('#downloadDiagnostics')){LF.Logger.downloadDiagnostics();return;}
        if(e.target.closest('#downloadLogs')){LF.Logger.download();return;}
        if(e.target.closest('#clearLogs')){if(await LF.UI.confirmAction('Clear all buffered LabFlow logs? Download them first if you need to keep this diagnostic history.',{title:'Clear runtime logs',confirmLabel:'Clear logs',danger:true})){LF.Logger.clear();render();}return;}
        if(e.target.closest('#saveAiSettings')){LF.AISettings.saveFromForm();return;}
        if(e.target.closest('#detectProviderModel')){LF.AISettings.detectModel();return;}
        if(e.target.closest('#testAiConnection')){await LF.AISettings.testConnection(e.target.closest('#testAiConnection'));return;}
        if(e.target.closest('#reanalyzeDataset')){refreshPipeline(S.state.experiment,'manual-review');render();LF.UI.message('Data checks refreshed.','success');return;}
        if(e.target.closest('#refreshNomadMapping')||e.target.closest('#rebuildNomadMapping')){LF.Nomad.buildMapping(S.state.experiment);LF.Nomad.validate(S.state.experiment,S.state.experiment.raw&&S.state.experiment.raw.sourceArchive);render();LF.UI.message('NOMAD mapping and local validation refreshed.','success');return;}
        if(e.target.closest('#exportMeasurementsCsv')){C.downloadBlob(C.textBlob(LF.Analysis.toCSV(S.state.experiment),'text/csv;charset=utf-8'),C.safeName(S.state.experiment.meta.name)+'_measurements.csv');return;}
        const canvasExport=e.target.closest('[data-export-canvas]');if(canvasExport){LF.ResultsPage.exportCanvas(canvasExport.dataset.exportCanvas,canvasExport.dataset.exportName||'labflow-chart.png');return;}
        if(e.target.closest('#exportCurvePng')){LF.ResultsPage.exportCanvas('curveCanvas',C.safeName(S.state.experiment.meta.name)+'_jv_curves.png');return;}
        if(e.target.closest('#boxSelectAll')){S.state.ui.boxPlot.groups=Array.from(new Set(S.state.experiment.measurements.map(function(m){return LF.ResultsPage.groupName(m);}))).sort();render();return;}
        if(e.target.closest('#boxSelectRef')){S.state.ui.boxPlot.groups=Array.from(new Set(S.state.experiment.measurements.filter(function(m){return m.isRef;}).map(function(m){return LF.ResultsPage.groupName(m);}))).sort();render();return;}
        if(e.target.closest('#boxClearGroups')){S.state.ui.boxPlot.groups=[];render();return;}
        if(e.target.closest('#exportBoxPng')){LF.ResultsPage.exportCanvas('boxCanvas',C.safeName(S.state.experiment.meta.name)+'_boxplots.png');return;}
      } catch(err) { Log.error('ui.click-handler-failed',{target:e.target&&e.target.id||e.target&&e.target.dataset||'',error:err}); LF.UI.message(err.message||String(err),'error'); }
    });

    document.addEventListener('change',function(e){
      try {
        if(e.target.id==='kbSettingsKind'){S.state.ui=S.state.ui||{};S.state.ui.settingsKnowledgeKind=e.target.value||'all';render();return;}
        if(e.target.id==='uiKitGlobalFilter'){S.state.ui.uiKitFilter=e.target.value||'all';applyUiKitFilter();return;}
        if(e.target.id==='docsSection'){S.state.ui.docsSection=e.target.value||'all';LF.DocsPage.apply(document.getElementById('main'));return;}
        if(e.target.id==='aiProvider'){LF.AISettings.selectProvider(e.target.value);return;}
        if(e.target.id==='aiModelSelect'){const input=document.getElementById('aiModel');if(input)input.value=e.target.value;return;}
        if(e.target.id==='logScopeFilter'){LF.LogsPage.setScope(e.target.value);render();return;}
        if(e.target.id==='designDeviceSelect'){S.state.ui.selectedDesignDeviceId=e.target.value;activateDesignProposal(S.state.ui.selectedDesignDeviceId);render();return;}
        if(e.target.id==='curveView'){S.state.ui.curveView=e.target.value;render();return;}
        if(e.target.id==='curveGroup'){S.state.ui.curveGroup=e.target.value;render();return;}
        if(e.target.id==='curveDirection'){S.state.ui.curveDirection=e.target.value;render();return;}
        if(e.target.id==='curveEligibleOnly'){S.state.ui.curveEligibleOnly=e.target.checked;render();return;}
        if(e.target.id==='curveMeasurement'){S.state.ui.selectedMeasurementId=e.target.value;render();return;}
        const curve=e.target.closest('[data-curve-check]');if(curve){S.state.ui.curveOverlaySelection=S.state.ui.curveOverlaySelection||[];if(curve.checked&&!S.state.ui.curveOverlaySelection.includes(curve.dataset.curveCheck))S.state.ui.curveOverlaySelection.push(curve.dataset.curveCheck);if(!curve.checked)S.state.ui.curveOverlaySelection=S.state.ui.curveOverlaySelection.filter(function(id){return id!==curve.dataset.curveCheck;});render();return;}
        const boxGroup=e.target.closest('[data-box-group]');if(boxGroup){const name=boxGroup.dataset.boxGroup;S.state.ui.boxPlot.groups=S.state.ui.boxPlot.groups||[];if(boxGroup.checked&&!S.state.ui.boxPlot.groups.includes(name))S.state.ui.boxPlot.groups.push(name);if(!boxGroup.checked)S.state.ui.boxPlot.groups=S.state.ui.boxPlot.groups.filter(function(x){return x!==name;});render();return;}
        if(e.target.id==='overviewMetric'){S.state.ui.resultsOverviewMetric=e.target.value||'eff';if(S.state.ui.resultsOverviewMetric==='hysteresis')S.state.ui.resultsOverviewDirection='best';render();return;}
        if(e.target.id==='overviewDirection'){S.state.ui.resultsOverviewDirection=e.target.value||'best';render();return;}
        if(e.target.id==='overviewStatistic'){S.state.ui.resultsOverviewStatistic=e.target.value||'median';render();return;}
        if(e.target.id==='boxMetric'){S.state.ui.boxPlot.metric=e.target.value;render();return;}
        if(e.target.id==='boxDirection'){S.state.ui.boxPlot.direction=e.target.value;render();return;}
        if(e.target.id==='boxEligibleOnly'){S.state.ui.boxPlot.eligibleOnly=e.target.checked;render();return;}
        if(e.target.id==='resultMismatchFactor'){const v=Number(e.target.value);if(v>0){S.state.experiment.analysisSettings=S.state.experiment.analysisSettings||{};S.state.experiment.analysisSettings.mismatchFactor=v;LF.Analysis.analyze(S.state.experiment);markModified('analysis');render();}return;}
        const confirmSolution=e.target.closest('[data-confirm-solution]');if(confirmSolution){if(LF.DesignModel.setSolutionStatus(S.state.experiment,Number(confirmSolution.dataset.confirmSolution),confirmSolution.checked)){markModified('design');render();}return;}
        const deviceSolution=e.target.closest('[data-device-solution-id]');if(deviceSolution){if(LF.DesignModel.setDeviceSolutionLinked(S.state.experiment,S.state.ui.selectedDesignDeviceId,deviceSolution.dataset.deviceSolutionId,deviceSolution.checked)){markDraft('design');refreshDesignProjection();}return;}
        const deviceSample=e.target.closest('[data-device-sample-name]');if(deviceSample){if(LF.DesignModel.setDeviceSampleAssigned(S.state.experiment,S.state.ui.selectedDesignDeviceId,deviceSample.dataset.deviceSampleName,deviceSample.checked)){markModified('design');render();}return;}
        if(e.target.id==='confirmSelectedDevice'){if(LF.DesignModel.setDeviceStatus(S.state.experiment,S.state.ui.selectedDesignDeviceId,e.target.checked)){markModified('design');render();}return;}
      } catch(err){Log.error('ui.change-handler-failed',{target:e.target&&e.target.id||'',error:err});}
    });

    document.addEventListener('input',function(e){
      try {
        if(e.target.id==='aiEndpoint'){if(LF.AISettings&&LF.AISettings.decorate)LF.AISettings.decorate();return;}
        if(e.target.id==='aiKey'){if(LF.AISettings&&LF.AISettings.syncModelControls)LF.AISettings.syncModelControls();return;}
        if(e.target.id==='kbSettingsSearch'){S.state.ui=S.state.ui||{};S.state.ui.settingsKnowledgeQuery=e.target.value;clearTimeout(kbSettingsSearchTimer);kbSettingsSearchTimer=setTimeout(function(){render();const input=document.getElementById('kbSettingsSearch');if(input){input.focus();input.setSelectionRange(input.value.length,input.value.length);}},150);return;}
        if(e.target.id==='uiKitGlobalSearch'){S.state.ui.uiKitQuery=e.target.value;applyUiKitFilter();return;}
        if(e.target.id==='docsSearch'){S.state.ui.docsQuery=e.target.value;LF.DocsPage.apply(document.getElementById('main'));return;}
        if(e.target.id==='logSearch'){LF.LogsPage.setQuery(e.target.value);clearTimeout(logSearchTimer);logSearchTimer=setTimeout(function(){render();const search=document.getElementById('logSearch');if(search){search.focus();search.setSelectionRange(search.value.length,search.value.length);}},180);return;}
        if(e.target.id==='curveSearch'){S.state.ui.curveSearch=e.target.value;clearTimeout(curveSearchTimer);curveSearchTimer=setTimeout(function(){render();},140);return;}
        if(e.target.id==='measurementSearch'){const q=e.target.value.trim().toLowerCase();document.querySelectorAll('#measurementTable tbody tr').forEach(function(tr){tr.hidden=q&&!tr.dataset.search.includes(q);});return;}
        if(e.target.id==='cabinetSearch'){S.state.ui.cabinetQuery=e.target.value;clearTimeout(cabinetSearchTimer);cabinetSearchTimer=setTimeout(function(){render();const input=document.getElementById('cabinetSearch');if(input){input.focus();input.setSelectionRange(input.value.length,input.value.length);}},160);return;}
        const cabinetField=e.target.closest('[data-cabinet-field]');if(cabinetField){const item=LF.Cabinet.get(S.state.ui.cabinetSelectedId);if(item){const key=cabinetField.dataset.cabinetField,value=key==='tags'?cabinetField.value.split(',').map(function(x){return x.trim();}).filter(Boolean):cabinetField.value;const patch={};patch[key]=value;LF.Cabinet.update(item.id,patch);}return;}
        const cabinetLayerField=e.target.closest('[data-cabinet-layer-field]');if(cabinetLayerField){const item=LF.Cabinet.get(S.state.ui.cabinetSelectedId);if(item&&item.kind==='stack'){const layers=(item.layers||[]).map(function(x){return Object.assign({},x);}),layer=layers[Number(cabinetLayerField.dataset.cabinetLayerIndex)];if(layer){layer[cabinetLayerField.dataset.cabinetLayerField]=cabinetLayerField.value;LF.Cabinet.update(item.id,{layers:layers});}}return;}
        const solField=e.target.closest('[data-solution-field]');if(solField){if(LF.DesignModel.updateSolutionField(S.state.experiment,Number(solField.dataset.solutionIndex),solField.dataset.solutionField,solField.value)){markDraft('design');refreshDesignProjection();}return;}
        const proposalSolutionField=e.target.closest('[data-proposal-solution-index]');if(proposalSolutionField){const proposal=selectedDesignProposal(),item=proposal&&proposal.solutions&&proposal.solutions[Number(proposalSolutionField.dataset.proposalSolutionIndex)];if(item){const field=proposalSolutionField.dataset.proposalField,previous=item[field];item[field]=proposalSolutionField.value;if(field==='name'&&String(previous)!==item.name)(proposal.devices||[]).forEach(function(device){device.solution_names=(device.solution_names||[]).map(function(name){return String(name)===String(previous)?item.name:name;});});if(item.applied){item.applied=false;item.decision='pending';}proposal.userEdited=true;proposal.updatedAt=new Date().toISOString();markModified('ai');}return;}
        const proposalLayerField=e.target.closest('[data-proposal-layer-field]');if(proposalLayerField){const proposal=selectedDesignProposal(),device=proposal&&proposal.devices&&proposal.devices[Number(proposalLayerField.dataset.proposalDeviceIndex)],layer=device&&device.stack&&device.stack[Number(proposalLayerField.dataset.proposalLayerIndex)];if(layer){layer[proposalLayerField.dataset.proposalLayerField]=proposalLayerField.value;if(device.applied){device.applied=false;device.decision='pending';}proposal.userEdited=true;proposal.updatedAt=new Date().toISOString();markModified('ai');}return;}
        const proposalProcessField=e.target.closest('[data-proposal-process-field]');if(proposalProcessField){const proposal=selectedDesignProposal(),item=proposal&&proposal.devices&&proposal.devices[Number(proposalProcessField.dataset.proposalDeviceIndex)];if(item){item.process=item.process||{};item.process[proposalProcessField.dataset.proposalProcessField]=proposalProcessField.value;if(item.applied){item.applied=false;item.decision='pending';}proposal.userEdited=true;proposal.updatedAt=new Date().toISOString();markModified('ai');}return;}
        const proposalDeviceField=e.target.closest('[data-proposal-device-index][data-proposal-field]');if(proposalDeviceField){const proposal=selectedDesignProposal(),item=proposal&&proposal.devices&&proposal.devices[Number(proposalDeviceField.dataset.proposalDeviceIndex)];if(item){const value=proposalDeviceField.dataset.proposalArray==='true'?proposalDeviceField.value.split(',').map(function(x){return x.trim();}).filter(Boolean):proposalDeviceField.value;item[proposalDeviceField.dataset.proposalField]=value;if(item.applied){item.applied=false;item.decision='pending';}proposal.userEdited=true;proposal.updatedAt=new Date().toISOString();markModified('ai');}return;}
        const deviceField=e.target.closest('[data-device-field]');if(deviceField){if(LF.DesignModel.updateDeviceField(S.state.experiment,S.state.ui.selectedDesignDeviceId,deviceField.dataset.deviceField,deviceField.value)){markDraft('design');refreshDesignProjection();}return;}
        const deviceLayerField=e.target.closest('[data-device-layer-field]');if(deviceLayerField){if(LF.DesignModel.updateDeviceLayerField(S.state.experiment,S.state.ui.selectedDesignDeviceId,Number(deviceLayerField.dataset.deviceLayerIndex),deviceLayerField.dataset.deviceLayerField,deviceLayerField.value)){markDraft('design');refreshDesignProjection();}return;}
        const deviceProcessField=e.target.closest('[data-device-process-field]');if(deviceProcessField){if(LF.DesignModel.updateDeviceProcessField(S.state.experiment,S.state.ui.selectedDesignDeviceId,deviceProcessField.dataset.deviceProcessField,deviceProcessField.value)){markDraft('design');refreshDesignProjection();}return;}
      } catch(err){Log.error('ui.input-handler-failed',{target:e.target&&e.target.id||'',error:err});}
    });

    document.addEventListener('change',async function(e){if(e.target&&e.target.id==='kbImportFile'){const file=e.target.files&&e.target.files[0];if(!file)return;try{const text=await file.text(),out=LF.KnowledgeBase.importJsonl(text,'merge');S.state.ui.settingsKnowledgeId='';render();LF.UI.message('Imported '+out.imported+' Knowledge Base entr'+(out.imported===1?'y':'ies')+' from JSONL.','success');}catch(err){LF.UI.message('Knowledge Base import failed: '+(err.message||String(err)),'error');}finally{e.target.value='';}return;}if(e.target&&e.target.id==='cabinetImportFile'){const file=e.target.files&&e.target.files[0];if(!file)return;try{const text=await file.text(),out=LF.Cabinet.importState(text,'merge');S.state.ui.cabinetSelectedId=null;S.state.ui.cabinetKind='all';render();LF.UI.message('Imported '+out.imported+' Cabinet resource'+(out.imported===1?'':'s')+'.','success');}catch(err){LF.UI.message('Cabinet import failed: '+(err.message||String(err)),'error');}finally{e.target.value='';}}});

    document.addEventListener('focusout',function(e){if(e.target&&e.target.closest&&e.target.closest('[data-solution-field],[data-device-field],[data-device-layer-field],[data-device-process-field]')){commitDraft('design');}if(e.target&&e.target.closest&&e.target.closest('[data-cabinet-field],[data-cabinet-layer-field]')&&S.state.ui.route==='cabinet')render();});

    function markSettingsDirty(e){const content=e.target&&e.target.closest&&e.target.closest('.settings-content[data-settings-persist="explicit"]'),status=document.getElementById('settingsSaveState');if(!content||!status||e.target.closest('[data-theme-choice]'))return;status.className='badge warning';status.textContent='Unsaved changes';}
    document.addEventListener('input',markSettingsDirty);
    document.addEventListener('change',markSettingsDirty);

    document.addEventListener('keydown',function(ev){if(ev.key==='Escape'&&!LF.UI.isActivityOpen()&&S.state.ui.resultInspectorId){LF.ResultsPage.closeResultInspector();}});

    document.addEventListener('submit',async function(e){
      if(e.target.id==='samplePatchForm'){
        e.preventDefault();
        try {
          const fd=new FormData(e.target),from=String(fd.get('from')||'').trim(),to=LF.Parser.canonicalSample(fd.get('to')),reason=String(fd.get('reason')||'').trim();if(!from||!to||!reason)return;
          const proposals=S.state.experiment.measurements.filter(function(m){return m.sample===from;}).map(function(m){return{patch_type:'sample_mapping',target:m.id,before:from,after:to,reason:reason,evidence:['Researcher-confirmed manual correction']};});
          if(!proposals.length)throw new Error('No measurement uses the selected current sample identity.');
          const out=LF.DatasetCorrections.commitProposals(S.state.experiment,proposals,'user',{actionId:'review.manual-sample-mapping',reason:'review-correction'});render();LF.UI.message('Sample updated in '+out.changed+' measurement'+(out.changed===1?'':'s')+'.','success');
        } catch(err){Log.error('validation.manual-mapping-failed',{error:err});LF.UI.message(err.message||String(err),'error');}
      }
    });

    document.addEventListener('pointerover',function(e){const target=e.target.closest&&e.target.closest('[data-chart-tip]');if(target)showChartTooltip(target,e);});
    document.addEventListener('pointermove',function(e){const target=e.target.closest&&e.target.closest('[data-chart-tip]'),tip=document.getElementById('resultsChartTooltip');if(target&&tip&&!tip.hidden)positionChartTooltip(tip,e.clientX,e.clientY);});
    document.addEventListener('pointerout',function(e){const target=e.target.closest&&e.target.closest('[data-chart-tip]');if(target&&!target.contains(e.relatedTarget))hideChartTooltip();});
    document.addEventListener('focusin',function(e){const target=e.target.closest&&e.target.closest('[data-chart-tip]');if(target)showChartTooltip(target);});
    document.addEventListener('focusout',function(e){const target=e.target.closest&&e.target.closest('[data-chart-tip]');if(target)hideChartTooltip();});

    document.getElementById('datasetInput').addEventListener('change',function(){const f=this.files[0];this.value='';if(f)importDataset(f);});
    Log.debug('events.bind.end');
  }

  /** Export an inline deterministic SVG chart as PNG. */

  /* ---------- bootstrap ---------- */
  async function init(){
    LF.Logger.installGlobalHooks();const end=Log.timer('init',{href:location.href,protocol:location.protocol});
    try{
      S.state.ui.route='experiment-import';S.state.ui.assistantOpen=window.innerWidth>1100&&LF.Storage.getUiSettings().assistantOpen===true;LF.Theme.apply(LF.Storage.getUiSettings().theme,false);
      /* ExperimentData is autosaved in IndexedDB for browser recovery. Reset session is the explicit clear boundary; provider/key/theme remain independent. */
      const saved=LF.Storage.loadExperiment?await LF.Storage.loadExperiment():null;
      let workspaceRestoreError=null;
      if(saved&&saved.experiment&&saved.experiment.id){
        try{
          const restored=LF.DataModel.restore(saved.experiment);
          S.setExperiment(restored,restored.raw&&restored.raw.sourceArchive);
          restoreSavedUi(saved);
          refreshPipeline(S.state.experiment,'workspace-restore');
          Log.info('workspace.restored',{route:S.state.ui.route,experimentId:S.state.experiment.id,savedAt:saved.savedAt||''});
        }catch(err){
          workspaceRestoreError=err;
          Log.error('workspace.restore-rejected',{error:err,savedAt:saved.savedAt||''});
          S.resetSession();
        }
      }else{
        const aiSettings=LF.Storage.getAiSettings();
        S.resetSession();
        Log.info('workspace.empty-session',{route:S.state.ui.route,persistentProvider:true,persistentApiKey:!!LF.Storage.getApiKey(aiSettings.provider)});
      }
      S.state.ui.assistantOpen=window.innerWidth>1100&&LF.Storage.getUiSettings().assistantOpen===true;LF.Theme.apply(LF.Storage.getUiSettings().theme,false);
      bindEvents();setMobileNav(false);window.addEventListener('resize',syncMobileNav,{passive:true});if(LF.ActionUI)LF.ActionUI.bind();LF.Assistant.bind();S.subscribe(function(_state,reason){if(reason!=='actionRun'&&reason!=='assistant')render();if(reason!=='actionRun')scheduleWorkspaceSave(reason||'state');});window.addEventListener('pagehide',function(){if(hasExperiment())persistWorkspace('pagehide');});document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden'&&hasExperiment())persistWorkspace('hidden');});render();if(workspaceRestoreError)LF.UI.message('The saved workspace could not be loaded. The stored copy was left untouched.','warning');end({route:S.state.ui.route,experimentId:hasExperiment()?S.state.experiment.id:'',logEntries:LF.Logger.entries().length},'info');
    }
    catch(err){Log.error('init.failed',{error:err});end({error:err},'error');throw err;}
  }
  document.addEventListener('DOMContentLoaded',init);
}());
