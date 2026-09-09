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
  function workspaceUiSnapshot(){return{route:S.state.route||S.state.ui&&S.state.ui.route||'experiment-import',resultsTab:S.state.resultsTab||S.state.ui&&S.state.ui.resultsTab||'overview',selectedMeasurementId:S.state.selectedMeasurementId||S.state.ui&&S.state.ui.selectedMeasurementId||null,selectedDesignDeviceId:S.state.selectedDesignDeviceId||S.state.ui&&S.state.ui.selectedDesignDeviceId||null};}
  async function persistWorkspace(reason){if(!hasExperiment()||!LF.Storage||!LF.Storage.saveExperiment)return false;if(workspaceSaveBusy){workspaceSavePending=true;return false;}workspaceSaveBusy=true;try{await LF.Storage.saveExperiment(S.state.experiment,workspaceUiSnapshot());Log.debug('workspace.autosaved',{reason:reason||'state',revision:S.state.experiment.sync&&S.state.experiment.sync.revision||0});return true;}catch(err){Log.warn('workspace.autosave-failed',{reason:reason||'state',error:err});return false;}finally{workspaceSaveBusy=false;if(workspaceSavePending){workspaceSavePending=false;scheduleWorkspaceSave('pending');}}}
  function scheduleWorkspaceSave(reason){if(!hasExperiment())return;window.clearTimeout(workspaceSaveTimer);workspaceSaveTimer=window.setTimeout(function(){persistWorkspace(reason||'state');},700);}
  function restoreSavedUi(saved){const ui=saved&&saved.ui||{};if(ui.route)S.state.route=S.normalizeRoute?S.normalizeRoute(ui.route):ui.route;if(ui.resultsTab)S.state.resultsTab=ui.resultsTab;if(ui.selectedMeasurementId)S.state.selectedMeasurementId=ui.selectedMeasurementId;if(ui.selectedDesignDeviceId)S.state.selectedDesignDeviceId=ui.selectedDesignDeviceId;}

  function scrollNodeKey(el,root,route){
    if(el.classList&&el.classList.contains('experiment-strip'))return'global:experiment-strip';
    if(el.id)return String(route||'')+':id:'+el.id;
    const attrs=['data-result-tab','data-action-editor'];
    for(let i=0;i<attrs.length;i++){const v=el.getAttribute&&el.getAttribute(attrs[i]);if(v)return String(route||'')+':'+attrs[i]+':'+v;}
    const parts=[];let cur=el;while(cur&&cur!==root&&parts.length<7){const parent=cur.parentElement;if(!parent)break;const tag=(cur.tagName||'node').toLowerCase(),siblings=Array.from(parent.children).filter(function(x){return x.tagName===cur.tagName;}),idx=Math.max(0,siblings.indexOf(cur));parts.unshift(tag+':'+idx);cur=parent;}return String(route||'')+':path:'+parts.join('/');
  }
  const SCROLL_MEMORY_SELECTOR=['.table-wrap','.scroll-region','.scroll-x-region','.logs-table-wrap','.logs-focus-list','.design-variant-cards','.activity-checklist','.docs-document','[data-scroll-memory]'].join(',');
  function scrollMemoryNodes(root){if(!root)return[];const nodes=[root];if(root.querySelectorAll)Array.from(root.querySelectorAll(SCROLL_MEMORY_SELECTOR)).slice(0,80).forEach(function(el){if(!nodes.includes(el))nodes.push(el);});return nodes;}
  function captureScrollableState(root,route){
    scrollMemoryNodes(root).forEach(function(el){if(!el.scrollTop&&!el.scrollLeft)return;scrollMemory.set(scrollNodeKey(el,root,route),{top:el.scrollTop,left:el.scrollLeft});});
  }
  function restoreScrollableState(root,route){
    if(!root)return;const apply=function(){scrollMemoryNodes(root).forEach(function(el){const state=scrollMemory.get(scrollNodeKey(el,root,route));if(!state)return;if(el.scrollTop!==undefined)el.scrollTop=Math.min(state.top,Math.max(0,el.scrollHeight-el.clientHeight));if(el.scrollLeft!==undefined)el.scrollLeft=Math.min(state.left,Math.max(0,el.scrollWidth-el.clientWidth));});};apply();if(window.requestAnimationFrame)window.requestAnimationFrame(apply);
  }

  function renderKeepingAnchor(selector){
    const main=document.getElementById('main'),anchor=main&&main.querySelector(selector),before=anchor&&anchor.getBoundingClientRect?anchor.getBoundingClientRect().top:null;
    render();
    if(before==null||!main)return;
    const restore=function(){const next=main.querySelector(selector);if(!next||!next.getBoundingClientRect)return;const delta=next.getBoundingClientRect().top-before;if(Math.abs(delta)>1)main.scrollTop+=delta;};
    if(window.requestAnimationFrame)window.requestAnimationFrame(restore);else restore();
  }

  function activateDesignProposal(deviceId){const exp=S.state.experiment;if(!exp||!LF.ActionData)return null;return LF.ActionData.proposal(exp,'design.infer',String(deviceId||''));}
  function selectedDesignProposal(){return activateDesignProposal(S.state.selectedDesignDeviceId);}
  function ambiguityPlan(){return hasExperiment()&&LF.ActionData?LF.ActionData.proposal(S.state.experiment,'dataset.resolve-ambiguities'):null;}

  function renderDesign() {
    if (!hasExperiment()) return needExperiment();
    const experiment = ensureExperimentShape(S.state.experiment);
    activateDesignProposal(S.state.selectedDesignDeviceId||experiment.design&&experiment.design.devices&&experiment.design.devices[0]&&experiment.design.devices[0].id);
    return LF.DesignPage.render({
      experiment: experiment,
      selectedDeviceId: S.state.selectedDesignDeviceId,
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
  /**
   * Render the executable UI contract inside the application shell.
   * Never iframe ui-kit.html: browsers give sibling file:// documents opaque
   * origins, which prevents their CSS/JS assets from loading when framed.
   */
  function renderUiKit() {
    if(!LF.UIKitInline||!LF.UIKitInline.render)throw new Error('Inline UI Kit renderer is unavailable.');
    return LF.UIKitInline.render();
  }


  function renderPageContext(){const host=document.getElementById('topbarPageContext');if(!host)return;if(!hasExperiment()||!LF.PageContext){host.hidden=true;host.textContent='';return;}const text=LF.PageContext.summary();host.hidden=!text;host.textContent=text;}

  function renderModelStatus(){
    const host=document.getElementById('modelStatus'),detail=document.getElementById('modelStatusDetail');if(!host||!detail)return;
    const settings=LF.Storage.getAiSettings(),provider=LF.AIProviders&&LF.AIProviders[settings.provider]||{},ready=!!(settings.endpoint&&settings.model&&(!provider.keyRequired||LF.Storage.getApiKey(settings.provider))),displayModel=LF.Core&&LF.Core.modelDisplayName?LF.Core.modelDisplayName(settings.provider,settings.model):settings.model;
    host.classList.toggle('available',ready);host.classList.toggle('unavailable',!ready);
    detail.textContent=ready?displayModel:'Not configured';host.title=ready?'AI model available: '+displayModel:'Configure the AI provider in Settings';
  }

  function renderTopbarContext(){
    const host=document.getElementById('topbarContext');if(!host)return;
    if(S.state.route!=='ui-kit'){host.hidden=true;host.innerHTML='';return;}
    host.hidden=false;
    host.innerHTML='<div class="topbar-search"><label class="sr-only" for="uiKitGlobalSearch">Search UI patterns</label><input class="input" id="uiKitGlobalSearch" type="search" autocomplete="off" placeholder="Search patterns…" value="'+C.escapeHtml(S.state.uiKitQuery||'')+'"></div><label class="sr-only" for="uiKitGlobalFilter">Pattern family</label><select class="select topbar-filter" id="uiKitGlobalFilter"><option value="all">All patterns</option><option value="core">Core UI</option><option value="workflow">Workflow</option><option value="data">Scientific data</option><option value="ai">AI & actions</option><option value="system">System pages</option></select><span class="topbar-result-count" id="uiKitGlobalCount" aria-live="polite">Loading…</span>';
    document.getElementById('uiKitGlobalFilter').value=S.state.uiKitFilter||'all';
  }

  function applyUiKitFilter(){
    if(!LF.UIKitInline||!LF.UIKitInline.apply)return 0;
    return LF.UIKitInline.apply(S.state);
  }


  function pageFailureHtml(route,error){
    const title=PS.routeTitle?PS.routeTitle(route):'Current page';
    const message=C.escapeHtml(error&&error.message||String(error||'Unknown rendering error'));
    const canRebuild=hasExperiment()&&['experiment-results','experiment-design','experiment-export'].includes(route);
    return '<section class="page page-error-recovery"><div class="notice danger"><strong>'+C.escapeHtml(title)+' could not be rendered.</strong><span>'+message+'</span></div><section class="panel"><div class="panel-head"><div><span class="eyebrow">RECOVERY</span><h2 class="h2">Fix this page here</h2><div class="meta">LabFlow will not send you back to Upload unless the source ZIP itself is missing.</div></div></div><div class="panel-body"><div class="row-wrap"><button type="button" class="button primary" data-retry-page>Retry page</button>'+(canRebuild?'<button type="button" class="button" data-rebuild-derived>Rebuild derived data</button>':'')+'<button type="button" class="button" data-route="logs">Open logs</button></div></div></section></section>';
  }

  function render() {
    if (hasExperiment()) ensureExperimentShape(S.state.experiment);
    const end=Log.timer('render',{route:S.state.route,experimentId:S.state.experiment&&S.state.experiment.id,resultsTab:S.state.resultsTab});
    const main=document.getElementById('main'); if(!main){end({skipped:'main-missing'},'warn');return;}
    const previousRoute=renderedRoute||S.state.route;
    try{captureScrollableState(main,previousRoute);}catch(err){Log.warn('render.scroll-capture-skipped',{route:previousRoute,error:err});}
    document.querySelectorAll('.nav-link[data-route]').forEach(function(a){const navRoute=a.dataset.route;const active=navRoute===S.state.route;a.classList.toggle('active',active);});
    document.getElementById('topbarTitle').textContent=routeTitle(S.state.route);document.getElementById('topbarSubtitle').textContent=hasExperiment()?S.state.experiment.meta.name:'No experiment loaded';
    renderTopbarContext();
    renderModelStatus();
    const shell=document.querySelector('.app-shell'),assistant=document.getElementById('assistantPanel'),toggle=document.getElementById('assistantToggle');if(shell)shell.classList.toggle('assistant-closed',!S.state.assistantOpen);if(assistant)assistant.hidden=!S.state.assistantOpen;if(toggle){const assistantLabel=S.state.assistantOpen?'Hide assistant':'Assistant';toggle.setAttribute('aria-pressed',S.state.assistantOpen?'true':'false');toggle.innerHTML=(LF.Icons?LF.Icons.icon('message-square'):'')+'<span>'+assistantLabel+'</span>';}
    let html='';try{if(S.state.route==='experiment-import')html=LF.ImportPage.render(S.state);else if(S.state.route==='experiment-results')html=LF.ResultsPage.render(S.state);else if(S.state.route==='experiment-design')html=renderDesign();else if(S.state.route==='cabinet')html=LF.CabinetPage.render();else if(S.state.route==='experiment-export')html=LF.ExportPage.render(S.state);else if(S.state.route==='logs')html=LF.LogsPage.render();else if(S.state.route==='documentation')html=LF.DocsPage.render();else if(S.state.route==='ui-kit')html=renderUiKit();else html=LF.SettingsPage.render();}catch(err){Log.error('render.page-failed',{route:S.state.route,error:err});html=pageFailureHtml(S.state.route,err);}
    main.innerHTML=html;
    try{renderPageContext();}catch(err){Log.warn('render.page-context-skipped',{route:S.state.route,error:err});}
    try{C.bindFieldLabels(main);}catch(err){Log.warn('render.labels-skipped',{route:S.state.route,error:err});}
    if(S.state.route==='ui-kit')try{applyUiKitFilter();}catch(err){Log.warn('render.ui-kit-filter-skipped',{error:err});}
    if(S.state.route==='documentation'&&LF.DocsPage)try{LF.DocsPage.apply(main);}catch(err){Log.warn('render.documentation-filter-skipped',{error:err});}
    if(S.state.route==='logs'&&LF.LogsPage&&LF.LogsPage.bind)try{LF.LogsPage.bind(main);}catch(err){Log.warn('render.logs-bind-skipped',{error:err});}
    if(renderedRoute!==S.state.route)main.scrollTop=0;
    renderedRoute=S.state.route;
    try{restoreScrollableState(main,S.state.route);}catch(err){Log.warn('render.scroll-restore-skipped',{route:S.state.route,error:err});}
    main.querySelectorAll('button:not([type])').forEach(function(b){b.type='button';});
    try{LF.AISettings.decorate();}catch(err){Log.warn('render.decorate-skipped',{route:S.state.route,error:err});}
    try{LF.Theme.syncControls(LF.Theme.current());}catch(err){Log.warn('render.theme-sync-skipped',{route:S.state.route,error:err});}
    Log.trace('render.html',{route:S.state.route,chars:html.length});
    try{LF.Assistant.render();}catch(err){Log.warn('render.assistant-skipped',{route:S.state.route,error:err});}
    try{if(LF.Icons)LF.Icons.hydrate(document);}catch(err){Log.warn('render.icons-skipped',{route:S.state.route,error:err});}
    try{LF.ResultsPage.renderResultInspector();}catch(err){Log.warn('render.inspector-skipped',{route:S.state.route,error:err});}
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
    if(LF.DesignPage&&LF.DesignPage.refreshProjection)LF.DesignPage.refreshProjection(S.state.experiment,S.state.selectedDesignDeviceId,badge);
  }

  /* ---------- reviewed state mutations and local file operations ---------- */

  /** Update one proposal decision without replacing the page DOM or losing scroll/focus. */
  function updateProposalDecision(index, decision) {
    const exp=S.state.experiment,plan=ambiguityPlan(),proposal=plan&&plan.proposals&&plan.proposals[index];
    if(!proposal)return;
    proposal.decision=decision;
    const card=document.querySelector('[data-proposal-index="'+index+'"]');
    if(card){card.classList.remove('pending','accepted','rejected');card.classList.add(decision);const status=card.querySelector('.repair-proposal-head .badge');if(status){status.textContent=decision;status.className='badge '+(decision==='accepted'?'ai':decision==='pending'?'warning':'');}card.querySelectorAll('[data-review-proposal]').forEach(function(button){const selected=button.dataset.decision===decision;button.classList.toggle('primary',selected);button.classList.toggle('ghost',button.dataset.decision==='rejected'&&!selected);button.setAttribute('aria-pressed',selected?'true':'false');});}
    const counts={pending:0,accepted:0,rejected:0,applied:0};plan.proposals.forEach(function(item){const key=item.applied?'applied':(item.decision||'pending');counts[key]=(counts[key]||0)+1;});
    Object.keys(counts).forEach(function(key){const node=document.querySelector('[data-decision-count="'+key+'"]');if(node)node.textContent=counts[key];});
    markModified('ai');Log.info('review.proposal-decision',{index:index,decision:decision,accepted:counts.accepted});
  }


  function discardRepairPlan(){if(!hasExperiment())return;if(LF.ActionData)LF.ActionData.removeProposal(S.state.experiment,'dataset.resolve-ambiguities');markModified('ai');render();LF.UI.toast('AI correction proposals discarded. Deterministic findings, AI analysis and RAW data are unchanged.','info');}

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
      S.state.resultsTab='overview';S.state.resultsDataMode='all';S.state.resultsJvMode='single';S.state.resultsOverviewMetric='eff';S.state.resultsOverviewDirection='best';S.state.resultsOverviewStatistic='median';S.state.curveSelection=exp.measurements[0]?[exp.measurements[0].id]:[];S.state.curveOverlaySelection=[];S.state.curveView='all';S.state.curveGroup='all';S.state.curveDirection='both';S.state.curveEligibleOnly=false;S.state.curveSearch='';S.state.curveZoom=1;S.state.pceDistributionZoom=1;
      const briefMode='deterministic';
      LF.UI.activityUpdate({stage:'Validating LabFlow Data',progress:.82,message:'Deterministic pipeline complete · no AI request during import',details:{Experiments:(exp.experiments||[]).length,Samples:exp.samples.length,Runs:(exp.runs||[]).length,Measurements:exp.measurements.length,Pipeline:exp.pipeline&&exp.pipeline.status||'ready'}});
      S.setRoute('experiment-import');
      end({experimentId:exp.id,samples:exp.samples.length,measurements:exp.measurements.length,findings:exp.findings.length,brief:briefMode,nextRoute:'experiment-import'},'info');
      LF.UI.activityFinish({message:'ZIP parsed and deterministic pipeline validated. Review is ready.',details:{Experiments:(exp.experiments||[]).length,Samples:exp.samples.length,Runs:(exp.runs||[]).length,Measurements:exp.measurements.length,Findings:exp.findings.length,'Experiment brief':briefMode,Pipeline:exp.pipeline&&exp.pipeline.status||'ready'}});
      LF.UI.toast('Dataset imported. Review is ready.','success');
    }catch(err){Log.error('dataset.import-failed',{name:file&&file.name,error:err});end({error:err},'error');LF.UI.activityError(err);LF.UI.toast(err.message||String(err),'error');}
  }

  async function exportLabFlowZip(){if(!hasExperiment())return;flushDrafts();const exp=S.state.experiment;LF.UI.activityStart({title:'Export LabFlow ZIP',kind:'ZIP',stage:'Building portable save',progress:.15,cancellable:false,details:{Experiment:exp.meta.name,Revision:exp.sync&&exp.sync.revision||0}});try{const blob=await LF.Export.save(exp);C.downloadBlob(blob,LF.Export.fileName(exp));LF.UI.activityFinish({message:'Portable LabFlow ZIP created. The source archive inside it is unchanged.',details:{Bytes:blob.size,Revision:exp.sync&&exp.sync.revision||0},holdMs:0});LF.UI.toast('LabFlow ZIP exported.','success');}catch(err){Log.error('export.labflow-failed',{error:err});LF.UI.activityError(err);LF.UI.toast(err.message||String(err),'error');}}
  function saveExportOptions(){LF.Storage.saveExportSettings(Object.assign({},LF.Storage.getExportSettings(),{includeRaw:document.getElementById('nomadRaw').checked,includeDerived:document.getElementById('nomadDerived').checked}));LF.UI.toast('Export options saved.','success');}
  async function exportNomadEntry(){if(!hasExperiment())return;flushDrafts();try{LF.NomadExport.exportEntry(S.state.experiment);LF.UI.toast('NOMAD entry exported.','success');}catch(err){Log.error('export.nomad-entry-failed',{error:err});LF.UI.toast(err.message||String(err),'error');}}
  async function exportNomadZip(){if(!hasExperiment())return;flushDrafts();const exp=S.state.experiment;LF.UI.activityStart({title:'Export NOMAD ZIP',kind:'ZIP',stage:'Preparing NOMAD package',progress:.04,details:{Experiment:exp.meta.name}});try{await LF.NomadExport.exportZip(exp,exp.raw&&exp.raw.sourceArchive,function(info){LF.UI.activityUpdate({stage:info.stage,progress:info.progress,details:{Experiment:exp.meta.name}});});LF.UI.activityFinish({message:'NOMAD staging ZIP created from current LabFlow Data.',holdMs:0});}catch(err){Log.error('export.nomad-zip-failed',{error:err});LF.UI.activityError(err);LF.UI.toast(err.message||String(err),'error');}}



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
        if(route){e.preventDefault();if(route.matches&&route.matches(':disabled')||route.getAttribute('aria-disabled')==='true')return;closeMobileNav();if(S.state.route==='experiment-design')commitDraft('design');const target=route.dataset.route;if(S.routeRequiresExperiment&&S.routeRequiresExperiment(target)&&!hasExperiment()){S.setRoute('experiment-import');LF.UI.toast('Upload the original ZIP to open this workflow step.','info');return;}S.setRoute(target);return;}
        const docLink=e.target.closest('[data-doc-slug]');if(docLink){e.preventDefault();S.state.docsSlug=docLink.dataset.docSlug;render();return;}
        const seriesToggle=e.target.closest('[data-chart-series-toggle]');if(seriesToggle){const wrap=seriesToggle.closest('.svg-chart-wrap')||seriesToggle.closest('.panel')||document,series=seriesToggle.dataset.chartSeriesToggle,next=!seriesToggle.classList.contains('active');seriesToggle.classList.toggle('active',next);seriesToggle.setAttribute('aria-pressed',String(next));wrap.querySelectorAll('[data-chart-series="'+series+'"]') .forEach(function(node){node.classList.toggle('chart-series-hidden',!next);});return;}
        const seriesAction=e.target.closest('[data-chart-series-action]');if(seriesAction){const wrap=seriesAction.closest('.panel')||document,show=seriesAction.dataset.chartSeriesAction!=='hide-all';wrap.querySelectorAll('[data-chart-series-toggle]').forEach(function(button){button.classList.toggle('active',show);button.setAttribute('aria-pressed',String(show));});wrap.querySelectorAll('[data-chart-series]').forEach(function(node){node.classList.toggle('chart-series-hidden',!show);});return;}
        const chartExport=e.target.closest('[data-chart-export]');if(chartExport){const format=chartExport.dataset.chartExport,id=chartExport.dataset.chartId,base=C.safeName(S.state.experiment&&S.state.experiment.meta&&S.state.experiment.meta.name||'labflow')+'_'+C.safeName(id||'chart');if(format==='svg')LF.ResultsPage.exportSvg(id,base+'.svg');else LF.ResultsPage.exportCanvas(id,base+'.png');return;}
        const chartCsv=e.target.closest('[data-chart-csv]');if(chartCsv){const kind=chartCsv.dataset.chartCsv,base=C.safeName(S.state.experiment&&S.state.experiment.meta&&S.state.experiment.meta.name||'labflow')+'_'+C.safeName(kind||'chart');LF.ResultsPage.exportChartCsv(kind,base+'.csv');return;}
        const copyDoc=e.target.closest('[data-copy-doc]');if(copyDoc){const ok=C.copyText(LF.DocsPage.markdownFor(copyDoc.dataset.copyDoc));LF.UI.toast(ok?'Markdown copied.':'Could not copy Markdown.',ok?'success':'warning');return;}
        if(e.target.closest('[data-open-dataset]')){document.getElementById('datasetInput').click();return;}
        if(e.target.closest('[data-retry-page]')){render();return;}
        if(e.target.closest('[data-rebuild-derived]')){try{if(!hasExperiment())throw new Error('No experiment is loaded.');refreshPipeline(S.state.experiment,'page-recovery:'+S.state.route);render();LF.UI.toast('Derived data rebuilt from the current LabFlow Data.','success');}catch(err){Log.error('render.recovery-failed',{route:S.state.route,error:err});LF.UI.toast(err.message||String(err),'error');}return;}
        const pceZoom=e.target.closest('[data-pce-zoom]');if(pceZoom){const mode=pceZoom.dataset.pceZoom,current=Math.max(1,Math.min(4,Number(S.state.pceDistributionZoom)||1));S.state.pceDistributionZoom=mode==='reset'?1:mode==='in'?Math.min(4,current+.5):Math.max(1,current-.5);render();return;}
        const curveZoom=e.target.closest('[data-curve-zoom]');if(curveZoom){const mode=curveZoom.dataset.curveZoom,current=Math.max(1,Math.min(4,Number(S.state.curveZoom)||1));S.state.curveZoom=mode==='reset'?1:mode==='in'?Math.min(4,current+.5):Math.max(1,current-.5);renderKeepingAnchor('.results-main-tabs');return;}
        if(e.target.closest('#resetAll')){if(!await LF.UI.confirmAction('The persisted LabFlow session, action history, chat, Design state and RAW snapshot will be cleared. Provider, API key and theme preferences are kept.',{title:'Reset current session',confirmLabel:'Reset session',danger:true}))return;S.resetSession();S.state.pceDistributionZoom=1;if(LF.Storage&&LF.Storage.clearSavedExperiment)await LF.Storage.clearSavedExperiment();if(LF.PageContext)LF.PageContext.clear();render();LF.UI.toast('Session reset. Ready for a new ZIP.','info');return;}
        if(e.target.closest('#exportLabFlowZip')){await exportLabFlowZip();return;}
        if(e.target.closest('#exportNomadEntry')){exportNomadEntry();return;}
        if(e.target.closest('#exportNomadZip')){await exportNomadZip();return;}
        if(e.target.closest('#saveExportOptions')){saveExportOptions();render();return;}
        const exportOption=e.target.closest('[data-export-option]');if(exportOption){const settings=Object.assign({},LF.Storage.getExportSettings()),key=exportOption.dataset.exportOption,value=exportOption.dataset.exportOptionValue==='true';settings[key]=value;LF.Storage.saveExportSettings(settings);if(S.state.experiment&&S.state.experiment.nomad)S.state.experiment.nomad.mappingPlan=null;render();LF.UI.toast('NOMAD package option updated.','success');return;}
        const exportFocus=e.target.closest('[data-export-focus]');if(exportFocus){S.state.ui.exportFocus=exportFocus.dataset.exportFocus||'';render();setTimeout(function(){const target=S.state.ui.exportFocus==='patch-provenance'?document.getElementById('exportPatchProvenance'):document.getElementById('exportDangerFindings');if(target&&target.scrollIntoView)target.scrollIntoView({behavior:'smooth',block:'center'});},0);return;}
        const exportRepair=e.target.closest('[data-export-repair]');if(exportRepair){const exp=S.state.experiment,id=exportRepair.dataset.exportRepair;if(id==='complete-provenance'&&LF.NomadExport&&LF.NomadExport.repairPatchProvenance){const count=LF.NomadExport.repairPatchProvenance(exp);markModified('metadata');render();LF.UI.toast(count?('Reconstructed provenance for '+count+' patch record'+(count===1?'':'s')+'.'):'No provenance repair was needed.',count?'success':'info');return;}if(id==='restore-source-name'&&exp&&exp.raw&&exp.raw.sourceName){exp.meta=exp.meta||{};exp.meta.sourceName=exp.raw.sourceName;markModified('metadata');render();LF.UI.toast('Source archive metadata restored from the preserved RAW provenance.','success');return;}LF.UI.toast('This export issue needs researcher review.','warning');return;}
        if(e.target.closest('[data-export-refresh]')){const exp=S.currentExperiment?S.currentExperiment('nomad-recheck'):S.state.experiment;S.commitAllDrafts&&S.commitAllDrafts();LF.UI.activityStart({title:'Recheck NOMAD readiness',subtitle:'Deterministic local validation',kind:'LOCAL',stage:'Refreshing LabFlow Data',progress:.25,cancellable:false,response:'Rebuilding the current mapping and validation from the same ExperimentData used by Results, Design, Actions and Assistant.'});try{if(exp&&exp.nomad){exp.nomad.mappingPlan=null;exp.nomad.validation=null;}if(LF.DataPipeline&&LF.DataPipeline.refresh)LF.DataPipeline.refresh(exp,{reason:'nomad-recheck'});LF.UI.activityUpdate({stage:'Validating package',progress:.72});const validation=LF.NomadExport.validate(exp,exp.raw&&exp.raw.sourceArchive);render();LF.UI.activityFinish({message:validation.status==='blocked'?'NOMAD still needs attention.':'NOMAD readiness updated.',response:(validation.problems||[]).length?(validation.problems||[]).map(function(x){return (x.severity==='blocking'?'BLOCK':'REVIEW')+' · '+x.message;}).join('\n'):'Local staging checks passed.',details:{Status:validation.status,'Blocking issues':(validation.problems||[]).filter(function(x){return x.severity==='blocking';}).length,'Review items':(validation.problems||[]).filter(function(x){return x.severity!=='blocking';}).length},holdMs:0});}catch(error){LF.UI.activityError(error,{response:error.message||String(error),holdMs:0});}return;}
        if(e.target.closest('#mobileNavToggle')){setMobileNav(!document.body.classList.contains('mobile-nav-open'));return;}
        if(e.target.closest('#mobileNavShade')||e.target.closest('#sidebarDismiss')){closeMobileNav();return;}
        if(e.target.closest('#assistantClose')){S.state.assistantOpen=false;LF.Storage.saveUiSettings({assistantOpen:false});render();return;}
        if(e.target.closest('#assistantToggle')){S.state.assistantOpen=!S.state.assistantOpen;LF.Storage.saveUiSettings({assistantOpen:S.state.assistantOpen});render();return;}
        if(e.target.closest('[data-theme-toggle]')){LF.Theme.toggle();return;}
        const themeChoice=e.target.closest('[data-theme-choice]');if(themeChoice){LF.Theme.apply(themeChoice.dataset.themeChoice);return;}
        if(e.target.closest('#resultInspectorClose')){LF.ResultsPage.closeResultInspector();return;}

        const resultTab=e.target.closest('[data-result-tab]');if(resultTab){S.state.resultsTab=resultTab.dataset.resultTab;renderKeepingAnchor('.results-main-tabs');return;}
        const dataMode=e.target.closest('[data-results-data-mode]');if(dataMode){S.state.resultsDataMode=dataMode.dataset.resultsDataMode||'all';S.state.resultsTab='all';renderKeepingAnchor('.results-main-tabs');return;}
        const jvMode=e.target.closest('[data-results-jv-mode]');if(jvMode){S.state.resultsJvMode=jvMode.dataset.resultsJvMode||'single';S.state.curveView=S.state.resultsJvMode==='overlay'?'overlay':'single';S.state.resultsTab='curves';renderKeepingAnchor('.results-main-tabs');return;}
        const quick=e.target.closest('[data-results-quick]');if(quick){const q=quick.dataset.resultsQuick;if(q==='jv'){S.state.resultsJvMode='single';S.state.curveView='single';S.state.resultsTab='curves';}else if(q==='compare'){S.state.resultsTab='boxplots';}else if(q==='warnings'){S.state.resultsDataMode='warnings';S.state.resultsTab='all';}else if(q==='top'){S.state.resultsDataMode='top';S.state.resultsTab='all';}else{S.state.resultsDataMode='all';S.state.resultsTab='all';}renderKeepingAnchor('.results-main-tabs');return;}
        const openDesignExperiment=e.target.closest('[data-open-design-experiment]');if(openDesignExperiment){S.state.selectedDesignDeviceId=openDesignExperiment.dataset.openDesignExperiment;activateDesignProposal(S.state.selectedDesignDeviceId);S.setRoute('experiment-design');return;}
        const designCard=e.target.closest('[data-design-select]');if(designCard){S.state.selectedDesignDeviceId=designCard.dataset.designSelect;activateDesignProposal(S.state.selectedDesignDeviceId);render();return;}
        const settingsSection=e.target.closest('[data-settings-section]');if(settingsSection){S.state.settingsSection=settingsSection.dataset.settingsSection;render();return;}
        const actionEditor=e.target.closest('[data-action-editor]');if(actionEditor){S.state.settingsActionId=actionEditor.dataset.actionEditor;S.state.ui.settingsActionId=actionEditor.dataset.actionEditor;render();return;}
        const findingFilter=e.target.closest('[data-finding-filter]');if(findingFilter){setFindingFilter(findingFilter.dataset.findingFilter,findingFilter);return;}
        const applyReview=e.target.closest('[data-apply-review-proposal]');if(applyReview){
          const idx=Number(applyReview.dataset.applyReviewProposal),plan=ambiguityPlan(),p=plan&&plan.proposals&&plan.proposals[idx];
          if(p){try{const changed=LF.DatasetCorrections.applyProposal(S.state.experiment,p,'ai');LF.DatasetCorrections.rebuildSamples(S.state.experiment);markModified('dataset');refreshPipeline(S.state.experiment,'review-correction');render();LF.UI.toast('AI correction applied to the LabFlow Data ('+changed+' target'+(changed===1?'':'s')+').','success');}catch(err){p.applyError=err.message||String(err);Log.warn('review.proposal-apply-failed',{index:idx,error:err});render();LF.UI.toast(p.applyError,'error');}}return;
        }
        if(e.target.closest('#applyAllAiCorrections')){
          const plan=ambiguityPlan(),items=plan&&plan.proposals||[];let applied=0,targets=0,errors=0;
          items.forEach(function(p){if(p.applied||p.decision==='rejected')return;try{targets+=LF.DatasetCorrections.applyProposal(S.state.experiment,p,'ai');applied++;delete p.applyError;}catch(err){p.applyError=err.message||String(err);errors++;}});
          if(applied){LF.DatasetCorrections.rebuildSamples(S.state.experiment);markModified('dataset');refreshPipeline(S.state.experiment,'review-correction');}
          render();LF.UI.toast(applied+' AI proposal'+(applied===1?'':'s')+' applied'+(errors?' · '+errors+' could not be mapped':''),errors?'warning':'success');return;
        }
        const reviewProposal=e.target.closest('[data-review-proposal]');if(reviewProposal){updateProposalDecision(Number(reviewProposal.dataset.reviewProposal),reviewProposal.dataset.decision||'pending');render();return;}
        const reviewFix=e.target.closest('[data-apply-review-fix]');if(reviewFix){
          const items=S.state.experiment.datasetAnalysis&&S.state.experiment.datasetAnalysis.reviewFixes||[],fix=items[Number(reviewFix.dataset.applyReviewFix)];
          if(fix){try{LF.DatasetCorrections.applyProposal(S.state.experiment,Object.assign({},fix),'user');LF.DatasetCorrections.rebuildSamples(S.state.experiment);markModified('dataset');refreshPipeline(S.state.experiment,'review-exclusion');render();LF.UI.toast('Measurement excluded after review.','success');}catch(err){LF.UI.toast(err.message||String(err),'error');}}return;
        }
        if(e.target.closest('#applyAllReviewFixes')){
          const items=(S.state.experiment.datasetAnalysis&&S.state.experiment.datasetAnalysis.reviewFixes||[]).slice();if(!items.length)return;
          if(!await LF.UI.confirmAction('Exclude '+items.length+' blocked measurement'+(items.length===1?'':'s')+' from scientific analysis and rankings? The source data remains unchanged and every exclusion is recorded.',{title:'Apply suggested exclusions',confirmLabel:'Apply exclusions',cancelLabel:'Cancel'}))return;
          let applied=0,errors=0;items.forEach(function(fix){try{LF.DatasetCorrections.applyProposal(S.state.experiment,Object.assign({},fix),'user');applied++;}catch(_){errors++;}});if(applied){LF.DatasetCorrections.rebuildSamples(S.state.experiment);markModified('dataset');refreshPipeline(S.state.experiment,'review-exclusions');}render();LF.UI.toast(applied+' exclusion'+(applied===1?'':'s')+' applied'+(errors?' · '+errors+' failed':''),errors?'warning':'success');return;
        }
        const localFix=e.target.closest('[data-local-fix]');if(localFix){
          const m=S.state.experiment.measurements.find(function(x){return x.id===localFix.dataset.measurementId;});if(m){const exclude=localFix.dataset.localFix==='exclude';m.excluded=exclude;LF.DataModel.addPatch(S.state.experiment,{patchType:exclude?'exclude_measurement':'restore_measurement',target:{kind:'measurement',id:m.id},operation:'set',field:'excluded',from:!exclude,to:exclude,source:'user',reason:'Review data local correction',status:'applied',reviewStatus:'accepted',appliedAt:new Date().toISOString()},{touch:false});markModified('dataset');refreshPipeline(S.state.experiment,'review-correction');render();LF.UI.toast(exclude?'Measurement excluded from rankings.':'Measurement restored to rankings.','success');}return;
        }

        if(e.target.closest('#discardRepairPlan')){discardRepairPlan();return;}
        if(e.target.closest('#revalidateDataset')){refreshPipeline(S.state.experiment,'manual-refresh');if(LF.ActionData)LF.ActionData.removeProposal(S.state.experiment,'dataset.resolve-ambiguities');render();LF.UI.toast('Canonical analysis rebuilt from the current LabFlow Data.','success');return;}
        
        if(e.target.closest('#refreshDesignEvidence')){if(LF.DesignModel&&LF.DesignModel.projectSource)LF.DesignModel.projectSource(S.state.experiment,true);refreshPipeline(S.state.experiment,'design-source-refresh');render();LF.UI.toast('Design evidence re-read from the original source metadata.','success');return;}
        if(e.target.closest('#applyAllDesignSuggestions')){try{const out=LF.DesignAnalysis.applyAll(S.state.experiment,S.state.selectedDesignDeviceId);if(out.changed){markModified('design');render();LF.UI.toast('Applied '+out.changed+' AI-proposed missing field'+(out.changed===1?'':'s')+' to Design.','success');}else{render();LF.UI.toast('No missing field could be filled without overwriting existing values.','info');}}catch(err){LF.UI.toast(err.message||String(err),'error');}return;}
        if(e.target.closest('#acceptAllDesignInferences')){const exp=S.state.experiment,count=Object.keys(LF.ActionData?LF.ActionData.proposals(exp,'design.infer'):{}).length;if(!count){LF.UI.toast('No AI Design suggestions are waiting for acceptance.','info');return;}const ok=await LF.UI.confirmAction('Accept all '+count+' current AI Design suggestion'+(count===1?'':'s')+'? LabFlow fills only empty chemistry, architecture and process fields; existing researcher or source values stay unchanged. You can edit accepted values immediately afterwards.',{title:'Accept all Design suggestions',confirmLabel:'Accept all',cancelLabel:'Cancel'});if(!ok)return;try{const out=LF.DesignAnalysis.acceptAllProposals(exp);markModified('design');render();LF.UI.toast('Accepted '+out.accepted+' experiment suggestion'+(out.accepted===1?'':'s')+(out.failed.length?' · '+out.failed.length+' failed':'')+'.',out.failed.length?'warning':'success');}catch(err){LF.UI.toast(err.message||String(err),'error');}return;}
        if(e.target.closest('#applyAcceptedDesignProposal')){try{const out=LF.DesignAnalysis.applyAccepted(S.state.experiment,S.state.selectedDesignDeviceId);markModified('design');render();LF.UI.toast('Applied '+(out.solutions+out.devices)+' accepted Design item(s).','success');}catch(err){LF.UI.toast(err.message||String(err),'error');}return;}
        const applyDesignProposal=e.target.closest('[data-apply-design-proposal]');if(applyDesignProposal){try{const out=LF.DesignAnalysis.applyOne(S.state.experiment,applyDesignProposal.dataset.applyDesignProposal,Number(applyDesignProposal.dataset.proposalIndex),applyDesignProposal.dataset.proposalPart||'all',S.state.selectedDesignDeviceId);markModified('design');render();LF.UI.toast('AI suggestion applied to '+out.changed+' missing field'+(out.changed===1?'':'s')+'.','success');}catch(err){LF.UI.toast(err.message||String(err),'error');}return;}
        const applyDesignDevice=e.target.closest('[data-apply-design-device]');if(applyDesignDevice){try{const out=LF.DesignAnalysis.applySelectedDevice(S.state.experiment,applyDesignDevice.dataset.applyDesignDevice,S.state.selectedDesignDeviceId);markModified('design');render();LF.UI.toast('Applied AI-suggested missing values to '+out.changed+' Design field(s) for the selected experiment.','success');}catch(err){LF.UI.toast(err.message||String(err),'error');}return;}
        const acceptDesignExperiment=e.target.closest('[data-accept-design-experiment]');if(acceptDesignExperiment){try{const out=LF.DesignAnalysis.acceptProposal(S.state.experiment,acceptDesignExperiment.dataset.acceptDesignExperiment);markModified('design');render();LF.UI.toast('AI suggestion accepted. You can edit or validate the values directly below.','success');}catch(err){LF.UI.toast(err.message||String(err),'error');}return;}
        const discardDesignExperiment=e.target.closest('[data-discard-design-experiment]');if(discardDesignExperiment){const exp=S.state.experiment,id=String(discardDesignExperiment.dataset.discardDesignExperiment||'');if(LF.ActionData){LF.ActionData.removeProposal(exp,'design.infer',id);LF.ActionData.setStatus(exp,'design.infer',id,{state:'idle',updatedAt:new Date().toISOString(),message:''});}markModified('ai');render();LF.UI.toast('AI suggestion discarded.','info');return;}
        const openDesignCabinet=e.target.closest('[data-open-design-cabinet]');if(openDesignCabinet){S.state.ui.designCabinetPicker=openDesignCabinet.dataset.openDesignCabinet||'';render();return;}
        if(e.target.closest('[data-close-design-cabinet]')){S.state.ui.designCabinetPicker='';render();return;}
        const useCabinetItem=e.target.closest('[data-use-cabinet-item]');if(useCabinetItem){
          try{
            const exp=ensureExperimentShape(S.state.experiment),item=LF.Cabinet&&LF.Cabinet.get(useCabinetItem.dataset.useCabinetItem),dev=(exp.design.devices||[]).find(function(x){return String(x.id)===String(S.state.selectedDesignDeviceId);})||(exp.design.devices||[])[0];if(!item||!dev){LF.UI.toast('No Design experiment or Cabinet resource is available.','warning');return;}
            if(item.kind==='stack'&&(dev.stack||[]).length){const ok=await LF.UI.confirmAction('Replace the current stack for “'+(dev.name||'this experiment')+'” with a snapshot of “'+item.name+'” from Lab Cabinet? The current experiment values will be replaced, but the Cabinet item remains independent.',{title:'Use Cabinet stack',confirmLabel:'Replace stack',cancelLabel:'Cancel'});if(!ok)return;}
            const out=LF.Cabinet.applyToDesign(exp,dev.id,item.id,{replace:true});if(out.changed){S.state.selectedDesignDeviceId=dev.id;markModified('design');S.state.ui.designCabinetPicker='';render();LF.UI.toast('Applied Cabinet snapshot: '+item.name+'.','success');}else LF.UI.toast('The selected Cabinet resource adds no new Design values.','info');
          }catch(err){LF.UI.toast('Cabinet resource could not be applied: '+(err&&err.message||String(err)),'error');}
          return;
        }
        const saveSolutionCabinet=e.target.closest('[data-save-solution-cabinet]');if(saveSolutionCabinet){try{const item=LF.Cabinet.saveDesignSolution(S.state.experiment,saveSolutionCabinet.dataset.saveSolutionCabinet);S.state.ui.cabinetSelectedId=item.id;LF.UI.toast('Saved “'+item.name+'” to Lab Cabinet.','success');}catch(err){LF.UI.toast(err&&err.message||String(err),'error');}return;}
        if(e.target.closest('#saveStackCabinet')){try{const item=LF.Cabinet.saveDesignStack(S.state.experiment,S.state.selectedDesignDeviceId);S.state.ui.cabinetSelectedId=item.id;LF.UI.toast('Stack saved to Lab Cabinet.','success');}catch(err){LF.UI.toast(err&&err.message||String(err),'error');}return;}
        if(e.target.closest('#saveProtocolCabinet')){try{const item=LF.Cabinet.saveDesignProtocol(S.state.experiment,S.state.selectedDesignDeviceId);S.state.ui.cabinetSelectedId=item.id;LF.UI.toast('Process protocol saved to Lab Cabinet.','success');}catch(err){LF.UI.toast(err&&err.message||String(err),'error');}return;}

        const cabinetKind=e.target.closest('[data-cabinet-kind]');if(cabinetKind){S.state.ui.cabinetKind=cabinetKind.dataset.cabinetKind||'all';render();return;}
        const cabinetSelect=e.target.closest('[data-cabinet-select]');if(cabinetSelect){S.state.ui.cabinetSelectedId=cabinetSelect.dataset.cabinetSelect;render();return;}
        if(e.target.closest('#cabinetAddItem')){const select=document.getElementById('cabinetNewKind'),kind=select&&select.value||'material',item=LF.Cabinet.create(kind,{});S.state.ui.cabinetKind=kind;S.state.ui.cabinetSelectedId=item.id;render();return;}
        const cabinetDuplicate=e.target.closest('[data-cabinet-duplicate]');if(cabinetDuplicate){const item=LF.Cabinet.duplicate(cabinetDuplicate.dataset.cabinetDuplicate);S.state.ui.cabinetKind=item.kind;S.state.ui.cabinetSelectedId=item.id;render();LF.UI.toast('Cabinet resource duplicated.','success');return;}
        if(e.target.closest('#cabinetExport')){const payload=LF.Cabinet.exportState(),blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='labflow-cabinet.json';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},0);LF.UI.toast('Cabinet backup exported.','success');return;}
        if(e.target.closest('#cabinetImport')){const input=document.getElementById('cabinetImportFile');if(input)input.click();return;}
        const cabinetDelete=e.target.closest('[data-cabinet-delete]');if(cabinetDelete){const item=LF.Cabinet.get(cabinetDelete.dataset.cabinetDelete);if(!item)return;const ok=await LF.UI.confirmAction('Delete “'+item.name+'” from Lab Cabinet? Existing experiments that used it keep their copied snapshots.',{title:'Delete Cabinet resource',confirmLabel:'Delete',cancelLabel:'Cancel',danger:true});if(!ok)return;LF.Cabinet.remove(item.id);S.state.ui.cabinetSelectedId=null;render();LF.UI.toast('Cabinet resource deleted. Existing experiment snapshots are unchanged.','success');return;}
        if(e.target.closest('#cabinetAddLayer')){const item=LF.Cabinet.get(S.state.ui.cabinetSelectedId);if(item&&item.kind==='stack'){const layers=(item.layers||[]).slice();layers.push({role:'',material:'',thickness:'',process:''});LF.Cabinet.update(item.id,{layers:layers});render();}return;}
        const cabinetRemoveLayer=e.target.closest('[data-cabinet-remove-layer]');if(cabinetRemoveLayer){const item=LF.Cabinet.get(S.state.ui.cabinetSelectedId);if(item&&item.kind==='stack'){const layers=(item.layers||[]).slice();layers.splice(Number(cabinetRemoveLayer.dataset.cabinetRemoveLayer),1);LF.Cabinet.update(item.id,{layers:layers});render();}return;}
        const cabinetUseDesign=e.target.closest('[data-cabinet-use-design]');if(cabinetUseDesign){try{if(!hasExperiment()){LF.UI.toast('Upload an experiment before using Cabinet resources in Design.','info');return;}const exp=ensureExperimentShape(S.state.experiment),dev=(exp.design.devices||[]).find(function(x){return String(x.id)===String(S.state.selectedDesignDeviceId);})||(exp.design.devices||[])[0],item=LF.Cabinet.get(cabinetUseDesign.dataset.cabinetUseDesign);if(!dev||!item){LF.UI.toast('No Design experiment is available.','warning');return;}if(item.kind==='stack'&&(dev.stack||[]).length){const ok=await LF.UI.confirmAction('Replace the current stack for “'+(dev.name||'this experiment')+'” with “'+item.name+'”?',{title:'Use Cabinet stack',confirmLabel:'Replace stack',cancelLabel:'Cancel'});if(!ok)return;}const out=LF.Cabinet.applyToDesign(exp,dev.id,item.id,{replace:true});if(out.changed){S.state.selectedDesignDeviceId=dev.id;markModified('design');S.setRoute('experiment-design');LF.UI.toast('Cabinet snapshot applied to '+(dev.name||'Design')+'.','success');}else LF.UI.toast('The selected Cabinet resource adds no new Design values.','info');}catch(err){LF.UI.toast('Cabinet resource could not be applied: '+(err&&err.message||String(err)),'error');}return;}
        if(e.target.closest('#runNomadValidation')){LF.Nomad.validate(S.state.experiment,S.state.experiment.raw&&S.state.experiment.raw.sourceArchive);render();LF.UI.toast('NOMAD validation refreshed.','success');return;}

        const openCurve=e.target.closest('[data-open-single-curve]');if(openCurve){e.preventDefault();e.stopPropagation();S.state.selectedMeasurementId=openCurve.dataset.openSingleCurve;S.state.curveSelection=[openCurve.dataset.openSingleCurve];S.state.curveView='single';S.state.resultsTab='curves';renderKeepingAnchor('.results-main-tabs');return;}
        const row=e.target.closest('[data-measurement-row]');if(row){S.state.selectedMeasurementId=row.dataset.measurementRow;const inlineDesktop=!!row.closest('.results-master-detail')&&window.matchMedia&&window.matchMedia('(min-width: 1181px)').matches;if(inlineDesktop){S.state.resultInspectorId=null;render();}else{S.state.resultInspectorId=row.dataset.measurementRow;LF.ResultsPage.renderResultInspector();}return;}
        const resolve=e.target.closest('[data-resolve-finding]');if(resolve){const f=S.state.experiment.findings.find(function(x){return x.id===resolve.dataset.resolveFinding;});if(f){f.status='resolved';Log.info('validation.finding-resolved',{id:f.id,code:f.code});markModified('validation');render();}return;}

        if(e.target.closest('#addDesignDevice')){const d=ensureExperimentShape(S.state.experiment).design,dev={id:C.uid('device'),name:'New experiment',group:'',sampleNames:[],isRef:false,solutionIds:[],stack:[],process:{coating:'',annealing:'',atmosphere:'',notes:''},status:'user_confirmed',evidence:'User entry',confidence:1};d.devices.push(dev);S.state.selectedDesignDeviceId=dev.id;Log.info('design.experiment-added',{count:d.devices.length});markModified('design');render();return;}
        if(e.target.closest('#removeSelectedDevice')){const exp=S.state.experiment,d=ensureExperimentShape(exp).design,id=S.state.selectedDesignDeviceId,idx=d.devices.findIndex(function(x){return x.id===id;}),dev=idx>=0?d.devices[idx]:null;if(!dev)return;const ok=await LF.UI.confirmAction('Remove “'+(dev.name||dev.group||'this variant')+'” from the LabFlow Data? Source data is not deleted; source-derived variants can be reconstructed with Re-read source.',{title:'Remove Design variant',confirmLabel:'Remove variant',cancelLabel:'Cancel',danger:true});if(!ok)return;const removed=d.devices.splice(idx,1)[0];if(LF.ActionData&&id){LF.ActionData.removeProposal(exp,'design.infer',id);LF.ActionData.removeStatus(exp,'design.infer',id);}const next=d.devices[Math.min(idx,d.devices.length-1)]||d.devices[0]||null;S.state.selectedDesignDeviceId=next?next.id:null;activateDesignProposal(S.state.selectedDesignDeviceId);Log.info('design.device-removed',{id:id,samples:(removed.sampleNames||[]).length,remaining:d.devices.length});markModified('design');render();LF.UI.toast('Design variant removed.','success');return;}
        if(e.target.closest('#addSolution')){const d=ensureExperimentShape(S.state.experiment).design,solution={id:C.uid('sol'),name:'New formulation',role:'',solutes:'',solvents:'',concentration:'',additives:'',preparation:'',evidence:'User entry',status:'user_confirmed'},dev=d.devices.find(function(item){return item.id===S.state.selectedDesignDeviceId;});d.solutions.push(solution);if(dev){dev.solutionIds=dev.solutionIds||[];dev.solutionIds.push(solution.id);}Log.info('design.formulation-added',{count:d.solutions.length,experimentId:dev&&dev.id||''});markModified('design');render();return;}
        const devicePick=e.target.closest('[data-design-device]');if(devicePick){S.state.selectedDesignDeviceId=devicePick.dataset.designDevice;render();return;}
        if(e.target.closest('#addDeviceLayer')){const d=ensureExperimentShape(S.state.experiment).design,dev=d.devices.find(function(x){return x.id===S.state.selectedDesignDeviceId;});if(dev){dev.stack.push({id:C.uid('layer'),role:'',material:'',thickness:'',process:'',evidence:'User entry',status:'user_confirmed'});dev.status='user_confirmed';markModified('design');render();}return;}
        const removeDeviceLayer=e.target.closest('[data-remove-device-layer]');if(removeDeviceLayer){const d=ensureExperimentShape(S.state.experiment).design,dev=d.devices.find(function(x){return x.id===S.state.selectedDesignDeviceId;});if(dev){dev.stack.splice(Number(removeDeviceLayer.dataset.removeDeviceLayer),1);dev.status='user_confirmed';markModified('design');render();}return;}
        const removeSolution=e.target.closest('[data-remove-solution]');if(removeSolution){const i=Number(removeSolution.dataset.removeSolution),design=S.state.experiment.design,removed=design.solutions[i];design.solutions.splice(i,1);if(removed)(design.devices||[]).forEach(function(dev){dev.solutionIds=(dev.solutionIds||[]).filter(function(id){return String(id)!==String(removed.id);});});Log.info('design.solution-removed',{index:i,id:removed&&removed.id||''});markModified('design');render();return;}
        const removeLayer=e.target.closest('[data-remove-layer]');if(removeLayer){const i=Number(removeLayer.dataset.removeLayer);S.state.experiment.design.stack.splice(i,1);Log.info('design.layer-removed',{index:i});markModified('design');render();return;}
        const moveLayer=e.target.closest('[data-move-layer]');if(moveLayer){const i=Number(moveLayer.dataset.moveLayer),dir=moveLayer.dataset.direction==='up'?1:-1,j=i+dir,arr=S.state.experiment.design.stack;if(j>=0&&j<arr.length){const tmp=arr[i];arr[i]=arr[j];arr[j]=tmp;Log.info('design.layer-moved',{from:i,to:j});markModified('design');render();}return;}
        if(e.target.closest('#addLayer')){S.state.experiment.design.stack.push({id:C.uid('layer'),role:'',material:'',thickness:'',process:'',evidence:'User entry',notes:'',status:'user_confirmed'});Log.info('design.layer-added',{count:S.state.experiment.design.stack.length});markModified('design');render();return;}
        const designProposalDecision=e.target.closest('[data-design-proposal-decision]');if(designProposalDecision){updateDesignProposalDecision(designProposalDecision.dataset.designProposalDecision,Number(designProposalDecision.dataset.proposalIndex),designProposalDecision.dataset.decision||'pending');return;}
        if(e.target.closest('#acceptAllDesignProposal')){const proposal=selectedDesignProposal();if(proposal){(proposal.solutions||[]).concat(proposal.devices||[]).forEach(function(item){if(!item.applied&&(item.decision||'pending')==='pending')item.decision='accepted';});proposal.userEdited=true;proposal.updatedAt=new Date().toISOString();markModified('ai');render();}return;}
        if(e.target.closest('#discardDesignProposal')){const exp=S.state.experiment,id=S.state.selectedDesignDeviceId;if(LF.ActionData&&id)LF.ActionData.removeProposal(exp,'design.infer',id);Log.info('design.proposal-discarded',{deviceId:id||''});markModified('ai');render();LF.UI.toast('AI design proposal discarded.','info');return;}

        if(e.target.closest('#saveUserProfile')){LF.Storage.saveUserProfile({name:document.getElementById('userName').value.trim()||'Matteo Ginesi',organization:document.getElementById('userOrganization').value.trim(),email:document.getElementById('userEmail').value.trim()});LF.UI.toast('Profile saved.','success');render();return;}
        if(e.target.closest('#saveAssistantSettings')){LF.Storage.saveAssistantSettings({memoryEnabled:document.getElementById('assistantMemoryEnabled').checked,memoryTurns:Number(document.getElementById('assistantMemoryTurns').value),memoryChars:Number(document.getElementById('assistantMemoryChars').value),messageChars:Number(document.getElementById('assistantMessageChars').value),maxOutputTokens:Number(document.getElementById('assistantMaxOutputTokens').value),temperature:Number(document.getElementById('assistantTemperature').value),contextChars:Number(document.getElementById('assistantContextChars').value)});LF.UI.toast('Assistant settings saved.','success');render();return;}
        if(e.target.closest('#saveActionEditor')){const btn=e.target.closest('#saveActionEditor'),id=btn.dataset.actionId,defText=document.getElementById('actionDefinitionEditor').value,promptText=document.getElementById('actionPromptEditor').value;try{const def=JSON.parse(defText);if(!def||def.id!==id)throw new Error('Action id must remain '+id+'.');if(!def.contract||!def.execution||!Array.isArray(def.execution.steps)||!def.execution.steps.length)throw new Error('Action definition requires contract and execution.steps.');LF.Storage.saveActionOverride(id,{definition:def,prompt:promptText});LF.UI.toast('Action runtime configuration saved.','success');render();}catch(err){LF.UI.toast('Action not saved: '+(err.message||String(err)),'error');}return;}
        if(e.target.closest('#resetActionEditor')){const btn=e.target.closest('#resetActionEditor'),id=btn.dataset.actionId;if(await LF.UI.confirmAction('Reset '+id+' to its source action.json and prompt.md?',{title:'Reset Action configuration',confirmLabel:'Reset Action'})){LF.Storage.resetActionOverride(id);LF.UI.toast('Action reset to source definition.','success');render();}return;}
        if(e.target.closest('#clearAssistantConversation')){if(hasExperiment()&&await LF.UI.confirmAction('Clear the current Assistant conversation and its memory?',{title:'Clear Assistant memory',confirmLabel:'Clear conversation',danger:true})){const d=LF.State.ensureDerived(S.state.experiment);d.chat=d.chat||{conversation:[]};d.chat.conversation=[];markModified('ai');LF.UI.toast('Assistant conversation cleared.','success');render();}return;}
        if(e.target.closest('#saveLogSettings')){LF.Logger.saveSettings({enabled:document.getElementById('logEnabled').checked,level:document.getElementById('logLevel').value,maxEntries:Number(document.getElementById('logMaxEntries').value)||2500,interactions:document.getElementById('logInteractions').checked,network:document.getElementById('logNetwork').checked});LF.UI.toast('Logging settings applied. Reload only if you changed network instrumentation.','success');render();return;}
        const logLevel=e.target.closest('[data-log-level]');if(logLevel){LF.LogsPage.setLevel(logLevel.dataset.logLevel);render();return;}
        const logCategory=e.target.closest('[data-log-category]');if(logCategory){LF.LogsPage.setCategory(logCategory.dataset.logCategory);render();return;}
        if(e.target.closest('#refreshLogs')){render();return;}
        if(e.target.closest('#downloadDiagnostics')){LF.Logger.downloadDiagnostics();return;}
        if(e.target.closest('#downloadLogs')){LF.Logger.download();return;}
        if(e.target.closest('#clearLogs')){if(await LF.UI.confirmAction('Clear all buffered LabFlow logs? Download them first if you need to keep this diagnostic history.',{title:'Clear runtime logs',confirmLabel:'Clear logs',danger:true})){LF.Logger.clear();render();}return;}
        if(e.target.closest('#saveAiSettings')){LF.AISettings.saveFromForm();return;}
        if(e.target.closest('#detectProviderModel')){LF.AISettings.detectModel();return;}
        if(e.target.closest('#testAiConnection')){await LF.AISettings.testConnection(e.target.closest('#testAiConnection'));return;}
        if(e.target.closest('#reanalyzeDataset')){refreshPipeline(S.state.experiment,'manual-review');render();LF.UI.toast('Deterministic data pipeline refreshed.','success');return;}
        if(e.target.closest('#refreshNomadMapping')||e.target.closest('#rebuildNomadMapping')){LF.Nomad.buildMapping(S.state.experiment);LF.Nomad.validate(S.state.experiment,S.state.experiment.raw&&S.state.experiment.raw.sourceArchive);render();LF.UI.toast('NOMAD mapping and local validation refreshed.','success');return;}
        if(e.target.closest('#exportMeasurementsCsv')){C.downloadBlob(C.textBlob(LF.Analysis.toCSV(S.state.experiment),'text/csv;charset=utf-8'),C.safeName(S.state.experiment.meta.name)+'_measurements.csv');return;}
        const canvasExport=e.target.closest('[data-export-canvas]');if(canvasExport){LF.ResultsPage.exportCanvas(canvasExport.dataset.exportCanvas,canvasExport.dataset.exportName||'labflow-chart.png');return;}
        if(e.target.closest('#exportCurvePng')){LF.ResultsPage.exportCanvas('curveCanvas',C.safeName(S.state.experiment.meta.name)+'_jv_curves.png');return;}
        if(e.target.closest('#boxSelectAll')){S.state.boxPlot.groups=Array.from(new Set(S.state.experiment.measurements.map(function(m){return LF.ResultsPage.groupName(m);}))).sort();render();return;}
        if(e.target.closest('#boxSelectRef')){S.state.boxPlot.groups=Array.from(new Set(S.state.experiment.measurements.filter(function(m){return m.isRef;}).map(function(m){return LF.ResultsPage.groupName(m);}))).sort();render();return;}
        if(e.target.closest('#boxClearGroups')){S.state.boxPlot.groups=[];render();return;}
        if(e.target.closest('#exportBoxPng')){LF.ResultsPage.exportCanvas('boxCanvas',C.safeName(S.state.experiment.meta.name)+'_boxplots.png');return;}
      } catch(err) { Log.error('ui.click-handler-failed',{target:e.target&&e.target.id||e.target&&e.target.dataset||'',error:err}); LF.UI.toast(err.message||String(err),'error'); }
    });

    document.addEventListener('change',function(e){
      try {
        if(e.target.id==='uiKitGlobalFilter'){S.state.uiKitFilter=e.target.value||'all';applyUiKitFilter();return;}
        if(e.target.id==='docsSection'){S.state.docsSection=e.target.value||'all';LF.DocsPage.apply(document.getElementById('main'));return;}
        if(e.target.id==='aiProvider'){LF.AISettings.selectProvider(e.target.value);return;}
        if(e.target.id==='aiModelSelect'){const input=document.getElementById('aiModel');if(input)input.value=e.target.value;return;}
        if(e.target.id==='logScopeFilter'){LF.LogsPage.setScope(e.target.value);render();return;}
        if(e.target.id==='designDeviceSelect'){S.state.selectedDesignDeviceId=e.target.value;activateDesignProposal(S.state.selectedDesignDeviceId);render();return;}
        if(e.target.id==='curveView'){S.state.curveView=e.target.value;render();return;}
        if(e.target.id==='curveGroup'){S.state.curveGroup=e.target.value;render();return;}
        if(e.target.id==='curveDirection'){S.state.curveDirection=e.target.value;render();return;}
        if(e.target.id==='curveEligibleOnly'){S.state.curveEligibleOnly=e.target.checked;render();return;}
        if(e.target.id==='curveMeasurement'){S.state.selectedMeasurementId=e.target.value;render();return;}
        const curveSelect=e.target.closest('[data-curve-select]');if(curveSelect){S.state.selectedMeasurementId=curveSelect.dataset.curveSelect;S.state.curveSelection=[curveSelect.dataset.curveSelect];render();return;}
        const curve=e.target.closest('[data-curve-check]');if(curve){S.state.curveOverlaySelection=S.state.curveOverlaySelection||[];if(curve.checked&&!S.state.curveOverlaySelection.includes(curve.dataset.curveCheck))S.state.curveOverlaySelection.push(curve.dataset.curveCheck);if(!curve.checked)S.state.curveOverlaySelection=S.state.curveOverlaySelection.filter(function(id){return id!==curve.dataset.curveCheck;});render();return;}
        const boxGroup=e.target.closest('[data-box-group]');if(boxGroup){const name=boxGroup.dataset.boxGroup;S.state.boxPlot.groups=S.state.boxPlot.groups||[];if(boxGroup.checked&&!S.state.boxPlot.groups.includes(name))S.state.boxPlot.groups.push(name);if(!boxGroup.checked)S.state.boxPlot.groups=S.state.boxPlot.groups.filter(function(x){return x!==name;});render();return;}
        if(e.target.id==='overviewMetric'){S.state.resultsOverviewMetric=e.target.value||'eff';if(S.state.resultsOverviewMetric==='hysteresis')S.state.resultsOverviewDirection='best';render();return;}
        if(e.target.id==='overviewDirection'){S.state.resultsOverviewDirection=e.target.value||'best';render();return;}
        if(e.target.id==='overviewStatistic'){S.state.resultsOverviewStatistic=e.target.value||'median';render();return;}
        if(e.target.id==='boxMetric'){S.state.boxPlot.metric=e.target.value;render();return;}
        if(e.target.id==='boxDirection'){S.state.boxPlot.direction=e.target.value;render();return;}
        if(e.target.id==='boxEligibleOnly'){S.state.boxPlot.eligibleOnly=e.target.checked;render();return;}
        if(e.target.id==='resultMismatchFactor'){const v=Number(e.target.value);if(v>0){S.state.experiment.analysisSettings=S.state.experiment.analysisSettings||{};S.state.experiment.analysisSettings.mismatchFactor=v;LF.Analysis.analyze(S.state.experiment);markModified('analysis');render();}return;}
        const confirmSolution=e.target.closest('[data-confirm-solution]');if(confirmSolution){const sol=S.state.experiment.design.solutions[Number(confirmSolution.dataset.confirmSolution)];if(sol){sol.status=confirmSolution.checked?'user_confirmed':'unknown';markModified('design');render();}return;}
        const confirmLayer=e.target.closest('[data-confirm-layer]');if(confirmLayer){const layer=S.state.experiment.design.stack[Number(confirmLayer.dataset.confirmLayer)];if(layer){layer.status=confirmLayer.checked?'user_confirmed':'unknown';markModified('design');render();}return;}
        const deviceSolution=e.target.closest('[data-device-solution-id]');if(deviceSolution){const d=ensureExperimentShape(S.state.experiment).design,dev=d.devices.find(function(x){return x.id===S.state.selectedDesignDeviceId;});if(dev){const id=deviceSolution.dataset.deviceSolutionId;dev.solutionIds=dev.solutionIds||[];if(deviceSolution.checked&&!dev.solutionIds.includes(id))dev.solutionIds.push(id);if(!deviceSolution.checked)dev.solutionIds=dev.solutionIds.filter(function(x){return x!==id;});dev.status='user_confirmed';markDraft('design');refreshDesignProjection();}return;}
        const deviceSample=e.target.closest('[data-device-sample-name]');if(deviceSample){const d=ensureExperimentShape(S.state.experiment).design,dev=d.devices.find(function(x){return x.id===S.state.selectedDesignDeviceId;}),name=deviceSample.dataset.deviceSampleName;if(dev){dev.sampleNames=dev.sampleNames||[];if(deviceSample.checked){d.devices.forEach(function(other){if(other.id!==dev.id)other.sampleNames=(other.sampleNames||[]).filter(function(x){return x!==name;});});if(!dev.sampleNames.includes(name))dev.sampleNames.push(name);d.devices=d.devices.filter(function(other){return other.id===dev.id||other.status!=='raw_evidence'||(other.sampleNames||[]).length>0;});}else dev.sampleNames=dev.sampleNames.filter(function(x){return x!==name;});dev.status='user_confirmed';markModified('design');render();}return;}
        if(e.target.id==='confirmSelectedDevice'){const d=ensureExperimentShape(S.state.experiment).design,dev=d.devices.find(function(x){return x.id===S.state.selectedDesignDeviceId;});if(dev){dev.status=e.target.checked?'user_confirmed':'raw_evidence';markModified('design');render();}return;}
      } catch(err){Log.error('ui.change-handler-failed',{target:e.target&&e.target.id||'',error:err});}
    });

    document.addEventListener('input',function(e){
      try {
        if(e.target.id==='aiKey'){if(LF.AISettings&&LF.AISettings.syncModelControls)LF.AISettings.syncModelControls();return;}
        if(e.target.id==='uiKitGlobalSearch'){S.state.uiKitQuery=e.target.value;applyUiKitFilter();return;}
        if(e.target.id==='docsSearch'){S.state.docsQuery=e.target.value;LF.DocsPage.apply(document.getElementById('main'));return;}
        if(e.target.id==='logSearch'){LF.LogsPage.setQuery(e.target.value);clearTimeout(S.state._logSearchTimer);S.state._logSearchTimer=setTimeout(function(){render();const search=document.getElementById('logSearch');if(search){search.focus();search.setSelectionRange(search.value.length,search.value.length);}},180);return;}
        if(e.target.id==='curveSearch'){S.state.curveSearch=e.target.value;clearTimeout(S.state._curveSearchTimer);S.state._curveSearchTimer=setTimeout(function(){render();},140);return;}
        if(e.target.id==='measurementSearch'){const q=e.target.value.trim().toLowerCase();document.querySelectorAll('#measurementTable tbody tr').forEach(function(tr){tr.hidden=q&&!tr.dataset.search.includes(q);});return;}
        if(e.target.id==='cabinetSearch'){S.state.ui.cabinetQuery=e.target.value;clearTimeout(S.state._cabinetSearchTimer);S.state._cabinetSearchTimer=setTimeout(function(){render();const input=document.getElementById('cabinetSearch');if(input){input.focus();input.setSelectionRange(input.value.length,input.value.length);}},160);return;}
        const cabinetField=e.target.closest('[data-cabinet-field]');if(cabinetField){const item=LF.Cabinet.get(S.state.ui.cabinetSelectedId);if(item){const key=cabinetField.dataset.cabinetField,value=key==='tags'?cabinetField.value.split(',').map(function(x){return x.trim();}).filter(Boolean):cabinetField.value;const patch={};patch[key]=value;LF.Cabinet.update(item.id,patch);}return;}
        const cabinetLayerField=e.target.closest('[data-cabinet-layer-field]');if(cabinetLayerField){const item=LF.Cabinet.get(S.state.ui.cabinetSelectedId);if(item&&item.kind==='stack'){const layers=(item.layers||[]).map(function(x){return Object.assign({},x);}),layer=layers[Number(cabinetLayerField.dataset.cabinetLayerIndex)];if(layer){layer[cabinetLayerField.dataset.cabinetLayerField]=cabinetLayerField.value;LF.Cabinet.update(item.id,{layers:layers});}}return;}
        const solField=e.target.closest('[data-solution-field]');if(solField){const sol=S.state.experiment.design.solutions[Number(solField.dataset.solutionIndex)];if(sol){sol[solField.dataset.solutionField]=solField.value;sol.userEdited=true;sol.status='user_confirmed';markDraft('design');refreshDesignProjection();}return;}
        const proposalSolutionField=e.target.closest('[data-proposal-solution-index]');if(proposalSolutionField){const proposal=selectedDesignProposal(),item=proposal&&proposal.solutions&&proposal.solutions[Number(proposalSolutionField.dataset.proposalSolutionIndex)];if(item){const field=proposalSolutionField.dataset.proposalField,previous=item[field];item[field]=proposalSolutionField.value;if(field==='name'&&String(previous)!==item.name)(proposal.devices||[]).forEach(function(device){device.solution_names=(device.solution_names||[]).map(function(name){return String(name)===String(previous)?item.name:name;});});if(item.applied){item.applied=false;item.decision='pending';}proposal.userEdited=true;proposal.updatedAt=new Date().toISOString();markModified('ai');}return;}
        const proposalLayerField=e.target.closest('[data-proposal-layer-field]');if(proposalLayerField){const proposal=selectedDesignProposal(),device=proposal&&proposal.devices&&proposal.devices[Number(proposalLayerField.dataset.proposalDeviceIndex)],layer=device&&device.stack&&device.stack[Number(proposalLayerField.dataset.proposalLayerIndex)];if(layer){layer[proposalLayerField.dataset.proposalLayerField]=proposalLayerField.value;if(device.applied){device.applied=false;device.decision='pending';}proposal.userEdited=true;proposal.updatedAt=new Date().toISOString();markModified('ai');}return;}
        const proposalProcessField=e.target.closest('[data-proposal-process-field]');if(proposalProcessField){const proposal=selectedDesignProposal(),item=proposal&&proposal.devices&&proposal.devices[Number(proposalProcessField.dataset.proposalDeviceIndex)];if(item){item.process=item.process||{};item.process[proposalProcessField.dataset.proposalProcessField]=proposalProcessField.value;if(item.applied){item.applied=false;item.decision='pending';}proposal.userEdited=true;proposal.updatedAt=new Date().toISOString();markModified('ai');}return;}
        const proposalDeviceField=e.target.closest('[data-proposal-device-index][data-proposal-field]');if(proposalDeviceField){const proposal=selectedDesignProposal(),item=proposal&&proposal.devices&&proposal.devices[Number(proposalDeviceField.dataset.proposalDeviceIndex)];if(item){const value=proposalDeviceField.dataset.proposalArray==='true'?proposalDeviceField.value.split(',').map(function(x){return x.trim();}).filter(Boolean):proposalDeviceField.value;item[proposalDeviceField.dataset.proposalField]=value;if(item.applied){item.applied=false;item.decision='pending';}proposal.userEdited=true;proposal.updatedAt=new Date().toISOString();markModified('ai');}return;}
        const deviceField=e.target.closest('[data-device-field]');if(deviceField){const d=ensureExperimentShape(S.state.experiment).design,dev=d.devices.find(function(x){return x.id===S.state.selectedDesignDeviceId;});if(dev){dev[deviceField.dataset.deviceField]=deviceField.value;dev.status='user_confirmed';markDraft('design');refreshDesignProjection();}return;}
        const deviceLayerField=e.target.closest('[data-device-layer-field]');if(deviceLayerField){const d=ensureExperimentShape(S.state.experiment).design,dev=d.devices.find(function(x){return x.id===S.state.selectedDesignDeviceId;}),item=dev&&dev.stack[Number(deviceLayerField.dataset.deviceLayerIndex)];if(item){item[deviceLayerField.dataset.deviceLayerField]=deviceLayerField.value;item.status='user_confirmed';dev.status='user_confirmed';markDraft('design');refreshDesignProjection();}return;}
        const deviceProcessField=e.target.closest('[data-device-process-field]');if(deviceProcessField){const d=ensureExperimentShape(S.state.experiment).design,dev=d.devices.find(function(x){return x.id===S.state.selectedDesignDeviceId;});if(dev){const field=deviceProcessField.dataset.deviceProcessField;dev.process=dev.process||{};dev.process[field]=deviceProcessField.value;dev.processProvenance=dev.processProvenance||{};dev.processProvenance[field]={status:'user_confirmed',evidence:'User entry'};dev.status='user_confirmed';markDraft('design');refreshDesignProjection();}return;}
        const processField=e.target.closest('[data-process-field]');if(processField){S.state.experiment.design.process[processField.dataset.processField]=processField.value;S.state.experiment.design.processProvenance=S.state.experiment.design.processProvenance||{};S.state.experiment.design.processProvenance[processField.dataset.processField]={status:'user_confirmed',evidence:'User entry'};markDraft('design');refreshDesignProjection();return;}
        const layerField=e.target.closest('[data-layer-field]');if(layerField){const item=S.state.experiment.design.stack[Number(layerField.dataset.layerIndex)];if(item){item[layerField.dataset.layerField]=layerField.value;if(item.status==='ai_inferred')item.status='user_confirmed';markDraft('design');}return;}
      } catch(err){Log.error('ui.input-handler-failed',{target:e.target&&e.target.id||'',error:err});}
    });

    document.addEventListener('change',async function(e){if(e.target&&e.target.id==='cabinetImportFile'){const file=e.target.files&&e.target.files[0];if(!file)return;try{const text=await file.text(),out=LF.Cabinet.importState(text,'merge');S.state.ui.cabinetSelectedId=null;S.state.ui.cabinetKind='all';render();LF.UI.toast('Imported '+out.imported+' Cabinet resource'+(out.imported===1?'':'s')+'.','success');}catch(err){LF.UI.toast('Cabinet import failed: '+(err.message||String(err)),'error');}finally{e.target.value='';}}});

    document.addEventListener('focusout',function(e){if(e.target&&e.target.closest&&e.target.closest('[data-solution-field],[data-device-field],[data-device-layer-field],[data-device-process-field],[data-process-field],[data-layer-field]')){commitDraft('design');}if(e.target&&e.target.closest&&e.target.closest('[data-cabinet-field],[data-cabinet-layer-field]')&&S.state.route==='cabinet')render();});

    document.addEventListener('keydown',function(ev){if(ev.key==='Escape'&&!LF.UI.isActivityOpen()&&S.state.resultInspectorId){LF.ResultsPage.closeResultInspector();}});

    document.addEventListener('submit',async function(e){
      if(e.target.id==='samplePatchForm'){
        e.preventDefault();
        try {
          const fd=new FormData(e.target),from=String(fd.get('from')||'').trim(),to=LF.Parser.canonicalSample(fd.get('to')),reason=String(fd.get('reason')||'').trim();if(!from||!to||!reason)return;
          let changed=0;S.state.experiment.measurements.forEach(function(m){if(m.sample===from){m.sample=to;m.group=LF.Parser.groupFromSample(to);m.isRef=LF.Parser.isReference(to);changed++;}});
          if(!changed)throw new Error('No measurement uses the selected current sample identity.');
          LF.DataModel.addPatch(S.state.experiment,{patchType:'sample_mapping',target:{kind:'dataset',id:S.state.experiment.id},operation:'set',field:'sample_mapping',from:from,to:to,source:'user',reason:reason,evidence:['Researcher-confirmed manual correction'],reviewStatus:'accepted',status:'applied',appliedAt:new Date().toISOString()},{touch:false});
          LF.DatasetCorrections.rebuildSamples(S.state.experiment);markModified('dataset');refreshPipeline(S.state.experiment,'review-correction');render();LF.UI.toast('Canonical sample mapping applied to '+changed+' measurement'+(changed===1?'':'s')+'.','success');
        } catch(err){Log.error('validation.manual-mapping-failed',{error:err});LF.UI.toast(err.message||String(err),'error');}
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
      S.state.route='experiment-import';S.state.assistantOpen=window.innerWidth>1100&&LF.Storage.getUiSettings().assistantOpen===true;LF.Theme.apply(LF.Storage.getUiSettings().theme,false);
      /* ExperimentData is autosaved in IndexedDB for browser recovery. Reset session is the explicit clear boundary; provider/key/theme remain independent. */
      const saved=LF.Storage.loadExperiment?await LF.Storage.loadExperiment():null;
      if(saved&&saved.experiment&&saved.experiment.id){S.setExperiment(saved.experiment,saved.experiment.raw&&saved.experiment.raw.sourceArchive);restoreSavedUi(saved);try{refreshPipeline(S.state.experiment,'workspace-restore');}catch(err){Log.warn('workspace.restore-pipeline-failed',{experimentId:S.state.experiment.id,error:err});}Log.info('workspace.restored',{route:S.state.route,experimentId:S.state.experiment.id,savedAt:saved.savedAt||''});}
      else{const aiSettings=LF.Storage.getAiSettings();S.resetSession();Log.info('workspace.empty-session',{route:S.state.route,persistentProvider:true,persistentApiKey:!!LF.Storage.getApiKey(aiSettings.provider)});}
      S.state.assistantOpen=window.innerWidth>1100&&LF.Storage.getUiSettings().assistantOpen===true;LF.Theme.apply(LF.Storage.getUiSettings().theme,false);
      bindEvents();setMobileNav(false);window.addEventListener('resize',syncMobileNav,{passive:true});if(LF.ActionUI)LF.ActionUI.bind();LF.Assistant.bind();S.subscribe(function(_state,reason){if(reason!=='actionRun'&&reason!=='assistant')render();if(reason!=='actionRun')scheduleWorkspaceSave(reason||'state');});window.addEventListener('pagehide',function(){if(hasExperiment())persistWorkspace('pagehide');});document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden'&&hasExperiment())persistWorkspace('hidden');});render();end({route:S.state.route,experimentId:hasExperiment()?S.state.experiment.id:'',logEntries:LF.Logger.entries().length},'info');
    }
    catch(err){Log.error('init.failed',{error:err});end({error:err},'error');throw err;}
  }
  document.addEventListener('DOMContentLoaded',init);
}());
