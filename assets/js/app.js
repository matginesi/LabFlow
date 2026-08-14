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

  function scrollNodeKey(el,root,route){
    if(el.classList&&el.classList.contains('experiment-strip'))return'global:experiment-strip';
    if(el.id)return String(route||'')+':id:'+el.id;
    const attrs=['data-result-tab','data-changes-tab','data-action-editor'];
    for(let i=0;i<attrs.length;i++){const v=el.getAttribute&&el.getAttribute(attrs[i]);if(v)return String(route||'')+':'+attrs[i]+':'+v;}
    const parts=[];let cur=el;while(cur&&cur!==root&&parts.length<7){const parent=cur.parentElement;if(!parent)break;const tag=(cur.tagName||'node').toLowerCase(),siblings=Array.from(parent.children).filter(function(x){return x.tagName===cur.tagName;}),idx=Math.max(0,siblings.indexOf(cur));parts.unshift(tag+':'+idx);cur=parent;}return String(route||'')+':path:'+parts.join('/');
  }
  function captureScrollableState(root,route){
    if(!root)return;root.querySelectorAll('*').forEach(function(el){const vertical=el.scrollHeight>el.clientHeight+1,horizontal=el.scrollWidth>el.clientWidth+1;if(!(vertical||horizontal))return;if(!el.scrollTop&&!el.scrollLeft)return;scrollMemory.set(scrollNodeKey(el,root,route),{top:el.scrollTop,left:el.scrollLeft});});
  }
  function restoreScrollableState(root,route){
    if(!root)return;const apply=function(){root.querySelectorAll('*').forEach(function(el){const state=scrollMemory.get(scrollNodeKey(el,root,route));if(!state)return;if(el.scrollHeight>el.clientHeight+1)el.scrollTop=Math.min(state.top,Math.max(0,el.scrollHeight-el.clientHeight));if(el.scrollWidth>el.clientWidth+1)el.scrollLeft=Math.min(state.left,Math.max(0,el.scrollWidth-el.clientWidth));});};apply();if(window.requestAnimationFrame)window.requestAnimationFrame(apply);
  }

  function renderDesign() {
    if (!hasExperiment()) return needExperiment();
    const experiment = ensureExperimentShape(S.state.experiment);
    return LF.DesignPage.render({
      experiment: experiment,
      selectedDeviceId: S.state.selectedDesignDeviceId,
      stepper: experimentStepper(),
      pageHead: pageHead,
      badge: badge
    });
  }


  function applyMarkdownTool(tool) {
    const el=document.getElementById('reportMarkdown');
    if(!el) return;
    const start=el.selectionStart||0,end=el.selectionEnd||0,value=el.value||'',selected=value.slice(start,end);
    let replacement=selected,selectStart=start,selectEnd=end;
    function wrap(a,b,placeholder){const body=selected||placeholder;replacement=a+body+b;selectStart=start+a.length;selectEnd=selectStart+body.length;}
    if(tool==='h2') { const body=selected||'Section title'; replacement='## '+body+'\n\n'; selectStart=start+3; selectEnd=selectStart+body.length; }
    else if(tool==='h3') { const body=selected||'Subsection title'; replacement='### '+body+'\n\n'; selectStart=start+4; selectEnd=selectStart+body.length; }
    else if(tool==='bold') wrap('**','**','important text');
    else if(tool==='italic') wrap('_','_','emphasized text');
    else if(tool==='quote') { const body=(selected||'Evidence-based note').split(/\r?\n/).map(function(line){return '> '+line;}).join('\n'); replacement=body+'\n\n'; selectStart=start; selectEnd=start+body.length; }
    else if(tool==='ul'||tool==='list') { const body=(selected||'First item\nSecond item').split(/\r?\n/).map(function(line){return '- '+line;}).join('\n'); replacement=body+'\n\n'; selectStart=start; selectEnd=start+body.length; }
    else if(tool==='table') { replacement='| Field | Value | Evidence |\n|---|---|---|\n| Example |  |  |\n\n'; selectStart=start; selectEnd=start+replacement.length-2; }
    else if(tool==='code') wrap('`','`','value');
    else if(tool==='link'){const body=selected||'link text';replacement='['+body+'](https://example.org)';selectStart=start+1;selectEnd=selectStart+body.length;}
    else if(tool==='inline-math'){const body=selected||'\\eta = \\frac{P_{out}}{P_{in}}';replacement='$'+body+'$';selectStart=start+1;selectEnd=selectStart+body.length;}
    else if(tool==='block-math'){const body=selected||'\\mathrm{PCE} = \\frac{V_{OC} J_{SC} FF}{P_{in}}';replacement='$$\n'+body+'\n$$\n\n';selectStart=start+3;selectEnd=selectStart+body.length;}
    else return;
    el.setRangeText(replacement,start,end,'end');
    el.focus();
    el.setSelectionRange(selectStart,selectEnd);
    const exp=S.state.experiment;LF.Report.setActiveMarkdown(exp,el.value);markDraft('report');const preview=document.getElementById('reportMarkdownRendered');if(preview){preview.innerHTML=C.markdown(el.value);if(LF.Math&&LF.Math.queueTypeset)LF.Math.queueTypeset(preview,40);}
    Log.debug('report.markdown-tool',{tool:tool,selectionChars:selected.length,replacementChars:replacement.length});
  }

  /**
   * Commit the visible editor before switching document or exporting.
   * This makes the DOM-to-export boundary explicit even when a browser has not
   * yet delivered the final input event (IME, autofill and accessibility tools).
   */
  function syncActiveReportEditor(reason) {
    if(!hasExperiment())return null;
    const el=document.getElementById('reportMarkdown'),before=LF.Report.activeMarkdown(S.state.experiment);
    if(el&&el.value!==before){LF.Report.setActiveMarkdown(S.state.experiment,el.value);markDraft('report');}commitDraft('report');
    const info=LF.Report.documentInfo(S.state.experiment);
    Log.info('report.editor-synchronized',{reason:reason||'manual',document:info.label,words:info.words,chars:info.chars,changed:!!(el&&el.value!==before),updatedAt:info.updatedAt});
    return info;
  }


  /* Render is intentionally synchronous: state changes produce one complete DOM view. */
  /**
   * Display the executable UI contract without replacing the application shell.
   * The framed document hides only its duplicate sidebar and topbar.
   */
  function renderUiKit() {
    return '<section class="ui-kit-host" aria-label="LabFlow UI Kit"><iframe class="ui-kit-frame" src="ui-kit.html" title="LabFlow component and layout catalog"></iframe></section>';
  }

  /** The global topbar owns route-specific tools; pages never add a second chrome row. */
  function renderWorkingCopyState(){
    const status=document.getElementById('workingCopyState'),save=document.getElementById('saveWorkingCopy'),exportButton=document.getElementById('exportWorkingCopy');
    if(!status||!save)return;
    if(!hasExperiment()){status.hidden=true;save.hidden=true;if(exportButton)exportButton.hidden=true;return;}
    const exp=S.state.experiment,sync=exp.sync||{},dirty=S.isDirty?S.isDirty():!!sync.dirty;
    status.hidden=false;save.hidden=false;if(exportButton)exportButton.hidden=false;save.disabled=false;
    status.className='working-copy-state '+(dirty?'dirty':'saved');
    status.textContent=dirty?'Working copy · not saved':'Working copy · saved internally';
    save.textContent='Save';
    if(exportButton)exportButton.textContent='Export ZIP';
  }

  function renderPageContext(){const host=document.getElementById('topbarPageContext');if(!host)return;if(!hasExperiment()||!LF.PageContext){host.hidden=true;host.textContent='';return;}const text=LF.PageContext.summary();host.hidden=!text;host.textContent=text;}

  function bindReportImproveSelection(){
    const el=document.getElementById('reportMarkdown'),btn=document.getElementById('reportImproveSelection');
    if(!el||!btn)return;
    function sync(){btn.disabled=!(el.selectionStart!==el.selectionEnd);}
    sync();
    el.addEventListener('mouseup',sync);
    el.addEventListener('keyup',sync);
    el.addEventListener('input',sync);
  }
  function renderModelStatus(){
    const host=document.getElementById('modelStatus'),detail=document.getElementById('modelStatusDetail');if(!host||!detail)return;
    const settings=LF.Storage.getAiSettings(),provider=LF.AIProviders&&LF.AIProviders[settings.provider]||{},ready=!!(settings.endpoint&&settings.model&&(!provider.keyRequired||LF.Storage.getApiKey()));
    host.classList.toggle('available',ready);host.classList.toggle('unavailable',!ready);
    detail.textContent=ready?settings.model:'Not configured';host.title=ready?'AI model available: '+settings.model:'Configure the AI provider in Settings';
  }

  function renderTopbarContext(){
    const host=document.getElementById('topbarContext');if(!host)return;
    if(S.state.route!=='ui-kit'){host.hidden=true;host.innerHTML='';return;}
    host.hidden=false;
    host.innerHTML='<div class="topbar-search"><label class="sr-only" for="uiKitGlobalSearch">Search UI patterns</label><input class="input" id="uiKitGlobalSearch" type="search" autocomplete="off" placeholder="Search patterns…" value="'+C.escapeHtml(S.state.uiKitQuery||'')+'"></div><label class="sr-only" for="uiKitGlobalFilter">Pattern family</label><select class="select topbar-filter" id="uiKitGlobalFilter"><option value="all">All patterns</option><option value="core">Core UI</option><option value="workflow">Workflow</option><option value="data">Scientific data</option><option value="ai">AI & actions</option><option value="system">System pages</option></select><span class="topbar-result-count" id="uiKitGlobalCount" aria-live="polite">Loading…</span>';
    document.getElementById('uiKitGlobalFilter').value=S.state.uiKitFilter||'all';
  }

  function postUiKitFilter(){
    const frame=document.querySelector('.ui-kit-frame');
    if(frame&&frame.contentWindow)frame.contentWindow.postMessage({type:'labflow-ui-kit-filter',query:S.state.uiKitQuery||'',filter:S.state.uiKitFilter||'all'},'*');
  }

  function bindUiKitFrame(){
    const frame=document.querySelector('.ui-kit-frame');if(!frame)return;
    frame.addEventListener('load',postUiKitFilter,{once:true});
  }

  function render() {
    if (hasExperiment()) ensureExperimentShape(S.state.experiment);
    const end=Log.timer('render',{route:S.state.route,experimentId:S.state.experiment&&S.state.experiment.id,resultsTab:S.state.resultsTab});
    const main=document.getElementById('main'); if(!main){end({skipped:'main-missing'},'warn');return;}
    const previousRoute=renderedRoute||S.state.route;
    captureScrollableState(main,previousRoute);
    document.querySelectorAll('.nav-link[data-route]').forEach(function(a){const navRoute=a.dataset.route;const active=navRoute==='experiment-home'?/^experiment-/.test(S.state.route):navRoute===S.state.route;a.classList.toggle('active',active);});
    document.getElementById('topbarTitle').textContent=routeTitle(S.state.route);document.getElementById('topbarSubtitle').textContent=hasExperiment()?S.state.experiment.meta.name:'No experiment loaded';
    renderTopbarContext();
    renderWorkingCopyState();
    renderModelStatus();
    const shell=document.querySelector('.app-shell'),assistant=document.getElementById('assistantPanel'),toggle=document.getElementById('assistantToggle');if(shell)shell.classList.toggle('assistant-closed',!S.state.assistantOpen);if(assistant)assistant.hidden=!S.state.assistantOpen;if(toggle){const assistantLabel=S.state.assistantOpen?'Hide assistant':'Assistant';toggle.setAttribute('aria-pressed',S.state.assistantOpen?'true':'false');toggle.innerHTML=(LF.Icons?LF.Icons.icon('message-square'):'')+'<span>'+assistantLabel+'</span>';}
    let html='';if(S.state.route==='experiment-import')html=LF.ImportPage.render(S.state);else if(S.state.route==='experiment-understand')html=LF.UnderstandPage.render(S.state);else if(S.state.route==='experiment-results')html=LF.ResultsPage.render(S.state);else if(S.state.route==='experiment-design')html=renderDesign();else if(S.state.route==='experiment-report')html=LF.ReportPage.render(S.state);else if(S.state.route==='experiment-changes')html=LF.ChangesPage.render(S.state);else if(S.state.route==='experiment-nomad')html=LF.NomadPage.render(S.state);else if(S.state.route==='logs')html=LF.LogsPage.render();else if(S.state.route==='ui-kit')html=renderUiKit();else html=LF.SettingsPage.render();
    main.innerHTML=html;
    renderPageContext();
    bindReportImproveSelection();
    C.bindFieldLabels(main);
    if(S.state.route==='ui-kit')bindUiKitFrame();
    if(renderedRoute!==S.state.route)main.scrollTop=0;
    renderedRoute=S.state.route;
    restoreScrollableState(main,S.state.route);
    main.querySelectorAll('button:not([type])').forEach(function(b){b.type='button';});
    LF.AISettings.decorate();
    LF.Theme.syncControls(LF.Theme.current());
    Log.trace('render.html',{route:S.state.route,chars:html.length});
    LF.Assistant.render();if(LF.Icons)LF.Icons.hydrate(document);LF.ResultsPage.renderResultInspector();if(LF.Math&&LF.Math.queueTypeset)LF.Math.queueTypeset(document,70);end({htmlChars:html.length});
  }

  function markModified(scope){
    if(!hasExperiment())return;
    const mutationScope=scope||'metadata',exp=S.state.experiment;
    /* Chat/proposal review is transient assistant state, not a scientific Working Copy revision. */
    if(mutationScope==='ai'){if(S.notify)S.notify('ai');return;}
    S.touch(mutationScope);
    if((mutationScope==='dataset'||mutationScope==='analysis')&&LF.DatasetCorrections&&LF.DatasetCorrections.refresh){LF.DatasetCorrections.refresh(exp);}
    else if(mutationScope==='design'){if(LF.CanonicalStore)LF.CanonicalStore.build(exp);if(LF.DesignAnalysis)exp.designAnalysis=LF.DesignAnalysis.build(exp,exp.sync&&exp.sync.revision||0);}
  }
  function markDraft(scope){if(!hasExperiment())return; if(S.markDraft)S.markDraft(scope||'metadata'); renderWorkingCopyState();}
  function commitDraft(scope){if(!hasExperiment())return; if(S.commitDraft)S.commitDraft(scope); if(scope==='dataset'&&LF.DatasetCorrections&&LF.DatasetCorrections.refresh)LF.DatasetCorrections.refresh(S.state.experiment); if(scope==='design'){if(LF.CanonicalStore)LF.CanonicalStore.build(S.state.experiment);if(LF.DesignAnalysis)S.state.experiment.designAnalysis=LF.DesignAnalysis.build(S.state.experiment,S.state.experiment.sync&&S.state.experiment.sync.revision||0);} renderWorkingCopyState();}
  function flushDrafts(){if(S.commitAllDrafts)S.commitAllDrafts();}

  function refreshDesignProjection(){
    if(LF.DesignPage&&LF.DesignPage.refreshProjection)LF.DesignPage.refreshProjection(S.state.experiment,S.state.selectedDesignDeviceId,badge);
  }

  /* ---------- reviewed state mutations and local file operations ---------- */
  function rebuildSamples(exp){const end=Log.timer('samples.rebuild',{experimentId:exp&&exp.id,measurements:exp&&exp.measurements?exp.measurements.length:0});const map=new Map();exp.measurements.forEach(function(m){if(!map.has(m.sample))map.set(m.sample,{id:C.uid('sample'),name:m.sample,rawName:m.rawSample||m.sample,group:m.group,isRef:m.isRef,measurementIds:[]});map.get(m.sample).measurementIds.push(m.id);});exp.samples=Array.from(map.values());end({samples:exp.samples.length});return exp.samples;}

  /** Update one proposal decision without replacing the page DOM or losing scroll/focus. */
  function updateProposalDecision(index, decision) {
    const exp=S.state.experiment,plan=exp.aiCorrectionPlan,proposal=plan&&plan.proposals&&plan.proposals[index];
    if(!proposal)return;
    proposal.decision=decision;
    const card=document.querySelector('[data-proposal-index="'+index+'"]');
    if(card){card.classList.remove('pending','accepted','rejected');card.classList.add(decision);const status=card.querySelector('.repair-proposal-head .badge');if(status){status.textContent=decision;status.className='badge '+(decision==='accepted'?'ai':decision==='pending'?'warning':'');}card.querySelectorAll('[data-review-proposal]').forEach(function(button){const selected=button.dataset.decision===decision;button.classList.toggle('primary',selected);button.classList.toggle('ghost',button.dataset.decision==='rejected'&&!selected);button.setAttribute('aria-pressed',selected?'true':'false');});}
    const counts={pending:0,accepted:0,rejected:0,applied:0};plan.proposals.forEach(function(item){const key=item.applied?'applied':(item.decision||'pending');counts[key]=(counts[key]||0)+1;});
    Object.keys(counts).forEach(function(key){const node=document.querySelector('[data-decision-count="'+key+'"]');if(node)node.textContent=counts[key];});
    markModified('ai');Log.info('review.proposal-decision',{index:index,decision:decision,accepted:counts.accepted});
  }


  function discardRepairPlan(){if(!hasExperiment())return;delete S.state.experiment.aiCorrectionPlan;markModified('ai');render();LF.UI.toast('AI correction proposals discarded. Deterministic findings, AI analysis and RAW data are unchanged.','info');}

  function activityDetails(file,extra){return Object.assign({File:file&&file.name||'',Size:file&&file.size?C.bytes(file.size):''},extra||{});}
  function importProgress(file,info){const p=info||{};LF.UI.activityUpdate({stage:p.stage||'Importing dataset',progress:p.progress,message:p.path||'',details:activityDetails(file,{Files:p.files||'',Current:p.current&&p.total?p.current+' / '+p.total:'',Path:p.path||''})});}

  function aiConfiguredSilently(){const s=LF.Storage&&LF.Storage.getAiSettings?LF.Storage.getAiSettings():{},p=(LF.AIProviders&&LF.AIProviders[s.provider])||{},key=LF.Storage&&LF.Storage.getApiKey?LF.Storage.getApiKey():'';return !!(s.endpoint&&s.model&&(!p.keyRequired||key));}

  async function importDataset(file){
    const end=Log.timer('dataset.import',{name:file&&file.name,size:file&&file.size,type:file&&file.type});
    LF.UI.activityStart({title:'Import experiment ZIP',subtitle:'Local parsing · RAW remains unchanged',kind:'ZIP',stage:'Reading source file',progress:.01,message:file&&file.name||'',details:activityDetails(file)});
    try{
      const buffer=await file.arrayBuffer();
      LF.UI.activityUpdate({stage:'Opening ZIP',progress:.03,details:{Bytes:buffer.byteLength}});
      const exp=await LF.Importer.parseDataset(buffer,file.name,function(info){importProgress(file,info);});
      exp.meta.sourceModifiedAt=file.lastModified?new Date(file.lastModified).toISOString():null;exp.meta.sourceType=file.type||'application/zip';exp.meta.importMethod='Local browser import · JSZip';
      LF.UI.activityUpdate({stage:'Analyzing measurements',progress:.93,message:'Deterministic facts first',details:{Measurements:exp.measurements.length,Samples:exp.samples.length}});
      LF.ExperimentModel.ensureShape(exp,S.state);
      if(LF.DatasetCorrections&&LF.DatasetCorrections.refresh)LF.DatasetCorrections.refresh(exp);
      if(LF.ExperimentBrief&&LF.ExperimentBrief.ensure)LF.ExperimentBrief.ensure(exp);
      /* Fresh documents are deliberately empty. Drafting is an explicit action in Report Studio. */
      exp.report=exp.report||{};exp.report.kind='lab';exp.report.labMarkdown='';exp.report.paperMarkdown='';exp.report.markdown='';exp.report.labUpdatedAt=null;exp.report.paperUpdatedAt=null;
      exp.nomad=exp.nomad||{validation:null,upload:null,mappingPlan:null};
      if(LF.Changes&&LF.Changes.captureBaseline)LF.Changes.captureBaseline(exp);
      S.setExperiment(exp);
      S.state.resultsTab='overview';S.state.curveSelection=exp.measurements[0]?[exp.measurements[0].id]:[];S.state.curveOverlaySelection=[];S.state.curveView='all';S.state.curveGroup='all';S.state.curveDirection='both';S.state.curveEligibleOnly=false;S.state.curveSearch='';
      let briefMode='deterministic',briefAiStatus='not used';
      if(aiConfiguredSilently()&&LF.ActionRunner){
        const action=LF.ActionRunner.effective?LF.ActionRunner.effective('analysis.enrich'):null,settings=LF.Storage.getAiSettings();
        LF.UI.activityUpdate({stage:'Enriching experiment context',progress:.975,message:'Building the shared scientific Experiment Brief used by Design, Results, Report and Assistant.',showAiTrace:true,response:'Provider output will appear here.',responseIsJson:false,details:{Measurements:exp.measurements.length,Samples:exp.samples.length,Action:'analysis.enrich',Engine:'AI-assisted',Provider:settings.provider,Model:settings.model},steps:(action&&action.steps||[]).map(function(st){return{id:st.id,label:(st.label||st.id).replace(/[-_]/g,' '),status:'pending',note:st.type};})});
        const enriched=await LF.ActionRunner.run('analysis.enrich',{
          onStep:function(st){LF.UI.activityUpdate({stage:'Experiment brief · '+(st.status==='active'?'running ':'completed ')+st.id,progress:st.status==='done'?.992:.982,stepId:st.id,stepStatus:st.status,stepNote:st.note||''});},
          onRequest:function(info){LF.UI.activityUpdate({request:JSON.stringify(info.request,null,2),requestIsJson:true,showAiTrace:true,details:{'AI checkpoint':info.stepId}});},
          onProgress:function(p){const stream=p.content||p.reasoning||'';LF.UI.activityUpdate({stage:'Experiment brief · model response',response:stream||'Waiting for model output…',responseIsJson:false,stream:{active:true,status:'streaming',events:Number(p.meaningfulEvents)||p.events,bytes:p.bytes,ttftMs:p.ttftMs,tokens:Math.ceil(String(stream).length/4),budgetTokens:p.budgetTokens||null}});}
        });
        if(enriched&&enriched.status==='done'){briefMode='deterministic + AI';briefAiStatus='completed';LF.UI.activityUpdate({response:(enriched.aiOutput!=null&&typeof enriched.aiOutput==='object')?JSON.stringify(enriched.aiOutput,null,2):String(enriched.aiOutput!=null?enriched.aiOutput:(enriched.result||'Completed.')),responseIsJson:!!(enriched.aiOutput!=null&&typeof enriched.aiOutput==='object'),stream:{active:false,status:'complete'}});}
        else{briefAiStatus='failed · deterministic brief kept';LF.UI.activityUpdate({response:'## Experiment Brief enrichment unavailable\n\n'+((enriched&&enriched.message)||'The AI enrichment did not complete. The deterministic Experiment Brief remains valid.'),responseIsJson:false,stream:{active:false,status:'error'}});Log.warn('dataset.import-brief-enrichment-skipped',{status:enriched&&enriched.status,code:enriched&&enriched.code,message:enriched&&enriched.message});}
      }
      S.setRoute('experiment-import');
      end({experimentId:exp.id,samples:exp.samples.length,measurements:exp.measurements.length,findings:exp.findings.length,brief:briefMode,nextRoute:'experiment-import'},'info');
      LF.UI.activityFinish({message:'ZIP parsed. Review is ready.',details:{Measurements:exp.measurements.length,Samples:exp.samples.length,Findings:exp.findings.length,'Experiment brief':briefMode,'AI enrichment':briefAiStatus}});
      LF.UI.toast('Dataset imported. Review is ready.','success');
    }catch(err){Log.error('dataset.import-failed',{name:file&&file.name,error:err});end({error:err},'error');LF.UI.activityError(err);LF.UI.toast(err.message||String(err),'error');}
  }

  async function saveWorkingCopy(){
    if(!hasExperiment())return;
    flushDrafts();const exp=S.state.experiment;
    LF.UI.activityStart({title:'Save LabFlow state',kind:'LOCAL',stage:'Persisting internal representation',progress:.22,cancellable:false,details:{Experiment:exp.meta.name,Revision:exp.sync&&exp.sync.revision||0}});
    const previousSync=Object.assign({},exp.sync||{});
    try{
      if(S.markSaved)S.markSaved('internal-workspace');
      const saved=await LF.Storage.saveExperiment(exp,S.state.ui||{});
      LF.UI.activityFinish({message:'Internal LabFlow representation saved in this browser.',details:{Revision:exp.sync&&exp.sync.revision||0,Saved:saved.savedAt},holdMs:0});
      LF.UI.toast('LabFlow state saved internally.','success');
    }catch(err){exp.sync=Object.assign(exp.sync||{},previousSync);Log.error('working-copy.save-failed',{error:err});LF.UI.activityError(err);LF.UI.toast(err.message||String(err),'error');}
  }
  async function exportWorkingCopy(){
    if(!hasExperiment())return;
    flushDrafts();const exp=S.state.experiment;
    LF.UI.activityStart({title:'Export working copy',kind:'ZIP',stage:'Building export ZIP',progress:.15,cancellable:false,details:{Experiment:exp.meta.name,Revision:exp.sync&&exp.sync.revision||0}});
    try{const blob=await LF.Export.modified(exp);C.downloadBlob(blob,LF.Export.fileName(exp,'working-copy'));LF.UI.activityFinish({message:'Export ZIP created from the current LabFlow representation.',details:{Revision:exp.sync&&exp.sync.revision||0,Bytes:blob.size},holdMs:0});LF.UI.toast('Working Copy exported as ZIP.','success');}
    catch(err){Log.error('working-copy.export-failed',{error:err});LF.UI.activityError(err);LF.UI.toast(err.message||String(err),'error');}
  }

  async function downloadNomadPackage(){
    if(!hasExperiment())return;flushDrafts();const exp=S.state.experiment;LF.UI.activityStart({title:'Export NOMAD ZIP',subtitle:'Deterministic local package generation',kind:'ZIP',stage:'Preparing files',progress:.02,details:{Experiment:exp.meta.name,Measurements:exp.measurements.length}});
    try{await LF.Nomad.exportZip(exp,exp.raw&&exp.raw.sourceArchive,function(info){LF.UI.activityUpdate({stage:info.stage,progress:info.progress,message:'',details:{Experiment:exp.meta.name}});});LF.UI.activityFinish({message:'NOMAD ZIP created from the current working copy. LabFlow changes remain unsaved until Save working copy is used.'});}
    catch(err){Log.error('nomad.export-failed',{error:err});LF.UI.activityError(err);LF.UI.toast(err.message||String(err),'error');}
  }

  async function simulateNomadUpload(){
    if(!hasExperiment())return;const exp=S.state.experiment;saveNomadSettings();
    LF.UI.activityStart({title:'NOMAD upload simulation',subtitle:'Staging → upload → processing → entries',kind:'NOMAD',stage:'Validating staging package',progress:.04,details:{Experiment:exp.meta.name,Instance:LF.Storage.getNomadSettings().instance}});
    try{const upload=await LF.Nomad.simulateUpload(exp,S.state.experiment.raw&&S.state.experiment.raw.sourceArchive,function(info){LF.UI.activityUpdate({stage:info.stage,progress:info.progress,message:info.message||'',details:{Experiment:exp.meta.name,Instance:LF.Storage.getNomadSettings().instance}});});markModified('nomad');render();LF.UI.activityFinish({message:'Demo upload processed. The exact simulated ZIP is available for manual download.',details:{Upload:upload.uploadId,Entries:upload.entries,Bytes:upload.bytes,Published:'No'}});LF.UI.toast('NOMAD demo upload completed. Nothing was sent remotely.','success');}
    catch(err){Log.error('nomad.upload-simulation-failed',{error:err});LF.UI.activityError(err);LF.UI.toast(err.message||String(err),'error');}
  }

  function downloadMockNomadPackage(){
    try{LF.Nomad.downloadMockPackage(S.state.experiment);LF.UI.toast('Exact simulated upload ZIP downloaded.','success');}
    catch(err){Log.error('nomad.mock-package-download-failed',{error:err});LF.UI.toast(err.message||String(err),'error');}
  }

  async function downloadReportDocx(){
    const exp=S.state.experiment,doc=syncActiveReportEditor('docx-export');LF.UI.activityStart({title:'Export '+doc.shortLabel+' DOCX',subtitle:doc.label+' from the current editor',kind:'REPORT',stage:'Preparing '+doc.shortLabel.toLowerCase(),progress:.02,details:{Experiment:exp.meta.name,Document:doc.label,Words:doc.words,Characters:doc.chars}});
    try{await LF.Report.exportDocx(exp,function(info){LF.UI.activityUpdate({stage:info.stage,progress:info.progress,message:'',details:{Experiment:exp.meta.name,Document:doc.label,Words:doc.words}});});LF.UI.activityFinish({message:doc.label+' DOCX created from '+doc.words+' words.'});}
    catch(err){Log.error('report.docx-failed',{error:err});LF.UI.activityError(err);LF.UI.toast(err.message||String(err),'error');}
  }

  async function downloadReportPdf(){
    const exp=S.state.experiment,doc=syncActiveReportEditor('pdf-export');LF.UI.activityStart({title:'Export '+doc.shortLabel+' PDF',subtitle:doc.label+' from the current editor',kind:'REPORT',stage:'Preparing '+doc.shortLabel.toLowerCase(),progress:.02,details:{Experiment:exp.meta.name,Document:doc.label,Words:doc.words,Characters:doc.chars}});
    try{await LF.Report.exportPdf(exp,function(info){LF.UI.activityUpdate({stage:info.stage,progress:info.progress,message:'',details:{Experiment:exp.meta.name,Document:doc.label,Words:doc.words}});});LF.UI.activityFinish({message:doc.label+' PDF created from '+doc.words+' words.'});}
    catch(err){Log.error('report.pdf-failed',{error:err});LF.UI.activityError(err);LF.UI.toast(err.message||String(err),'error');}
  }


  function saveNomadSettings(){Log.debug('settings.nomad.save-request');LF.Storage.saveNomadSettings({instance:document.getElementById('nomadInstance').value.trim(),endpoint:document.getElementById('nomadEndpoint').value.trim(),includeRaw:document.getElementById('nomadRaw').checked,includeDerived:document.getElementById('nomadDerived').checked,includeReport:document.getElementById('nomadReport').checked});LF.UI.toast('NOMAD settings saved.','success');}


  /** Update one Design proposal decision while preserving the current scroll. */
  function updateDesignProposalDecision(kind,index,decision){const proposal=S.state.experiment&&S.state.experiment.aiDesignProposal,list=proposal&&(kind==='solution'?proposal.solutions:proposal.devices),item=list&&list[index];if(!item||item.applied)return;item.decision=decision;proposal.userEdited=true;proposal.updatedAt=new Date().toISOString();markModified('ai');const main=document.getElementById('main'),top=main?main.scrollTop:0;render();requestAnimationFrame(function(){if(main)main.scrollTop=top;});}

  function setFindingFilter(filter,button) {
    document.querySelectorAll('[data-finding-row]').forEach(function(row){row.hidden=filter!=='all'&&row.dataset.findingSeverity!==filter;});
    document.querySelectorAll('[data-finding-filter]').forEach(function(b){b.classList.toggle('primary',b===button);});
    Log.debug('validation.finding-filter',{filter:filter});
  }

  /* ---------- mobile navigation ---------- */
  function setMobileNav(open){const next=!!open;document.body.classList.toggle('mobile-nav-open',next);const toggle=document.getElementById('mobileNavToggle');if(toggle){toggle.setAttribute('aria-expanded',next?'true':'false');toggle.setAttribute('aria-label',next?'Close navigation':'Open navigation');}const sidebar=document.getElementById('primarySidebar');if(sidebar)sidebar.setAttribute('aria-hidden',(!next&&window.matchMedia&&window.matchMedia('(max-width:1100px)').matches)?'true':'false');}
  function closeMobileNav(){setMobileNav(false);}

  /* ---------- delegated user interaction ---------- */
  function bindEvents(){
    Log.debug('events.bind.start');
    document.addEventListener('click',function(e){const b=e.target&&e.target.closest?e.target.closest('button'):null;if(b&&!b.hasAttribute('type'))e.preventDefault();},true);
    document.addEventListener('click',async function(e){
      try {
        const route=e.target.closest('[data-route]');
        if(route){e.preventDefault();if(route.matches&&route.matches(':disabled')||route.getAttribute('aria-disabled')==='true')return;closeMobileNav();if(S.state.route==='experiment-report')syncActiveReportEditor('route-change');else if(S.state.route==='experiment-design')commitDraft('design');const target=route.dataset.route;if(S.routeRequiresExperiment&&S.routeRequiresExperiment(target)&&!hasExperiment()){S.setRoute('experiment-import');LF.UI.toast('Upload the original ZIP to open this workflow step.','info');return;}S.setRoute(target);return;}
        if(e.target.closest('[data-open-dataset]')){document.getElementById('datasetInput').click();return;}
        if(e.target.closest('#saveWorkingCopy')){await saveWorkingCopy();renderWorkingCopyState();return;}
        if(e.target.closest('#exportWorkingCopy')){await exportWorkingCopy();return;}
        if(e.target.closest('#resetAll')){if(!await LF.UI.confirmAction('Unsaved Working Copy changes, action history, chat, report/design state and the in-memory RAW snapshot will be cleared. Provider, API key and theme preferences are kept.',{title:'Reset current session',confirmLabel:'Reset session',danger:true}))return;S.resetSession();if(LF.Storage&&LF.Storage.clearSavedExperiment)await LF.Storage.clearSavedExperiment();if(LF.PageContext)LF.PageContext.clear();render();LF.UI.toast('Session reset. Ready for a new ZIP.','info');return;}
        if(e.target.closest('#mobileNavToggle')){setMobileNav(!document.body.classList.contains('mobile-nav-open'));return;}
        if(e.target.closest('#mobileNavShade')){closeMobileNav();return;}
        if(e.target.closest('#assistantClose')){S.state.assistantOpen=false;LF.Storage.saveUiSettings({assistantOpen:false});render();return;}
        if(e.target.closest('#assistantToggle')){S.state.assistantOpen=!S.state.assistantOpen;LF.Storage.saveUiSettings({assistantOpen:S.state.assistantOpen});render();return;}
        if(e.target.closest('[data-theme-toggle]')){LF.Theme.toggle();return;}
        const themeChoice=e.target.closest('[data-theme-choice]');if(themeChoice){LF.Theme.apply(themeChoice.dataset.themeChoice);return;}
        if(e.target.closest('#resultInspectorClose')){LF.ResultsPage.closeResultInspector();return;}

        const resultTab=e.target.closest('[data-result-tab]');if(resultTab){S.state.resultsTab=resultTab.dataset.resultTab;render();return;}
        const changesTab=e.target.closest('[data-changes-tab]');if(changesTab){S.state.changesTab=changesTab.dataset.changesTab;render();return;}
        const openDesignExperiment=e.target.closest('[data-open-design-experiment]');if(openDesignExperiment){S.state.selectedDesignDeviceId=openDesignExperiment.dataset.openDesignExperiment;S.setRoute('experiment-design');return;}
        const settingsSection=e.target.closest('[data-settings-section]');if(settingsSection){S.state.settingsSection=settingsSection.dataset.settingsSection;render();return;}
        const actionEditor=e.target.closest('[data-action-editor]');if(actionEditor){S.state.settingsActionId=actionEditor.dataset.actionEditor;S.state.ui.settingsActionId=actionEditor.dataset.actionEditor;render();return;}
        const findingFilter=e.target.closest('[data-finding-filter]');if(findingFilter){setFindingFilter(findingFilter.dataset.findingFilter,findingFilter);return;}
        const reportMode=e.target.closest('[data-report-mode]');if(reportMode){S.state.reportMode=reportMode.dataset.reportMode;render();return;}
        const reportKind=e.target.closest('[data-report-kind]');if(reportKind){syncActiveReportEditor('document-switch');LF.Report.setKind(S.state.experiment,reportKind.dataset.reportKind);render();return;}
        const reportOperation=e.target.closest('button[data-action="report.generate"],button[data-action="report.improve"]');if(reportOperation){syncActiveReportEditor('before-ai-writing-help');const k=reportOperation.dataset.actionKind;if(k==='paper'||k==='lab')LF.Report.setKind(S.state.experiment,k);S.state.reportMode='editor';}
        const markdownTool=e.target.closest('[data-markdown-tool]');if(markdownTool){applyMarkdownTool(markdownTool.dataset.markdownTool);return;}
        const applyReview=e.target.closest('[data-apply-review-proposal]');if(applyReview){
          const idx=Number(applyReview.dataset.applyReviewProposal),plan=S.state.experiment.aiCorrectionPlan,p=plan&&plan.proposals&&plan.proposals[idx];
          if(p){try{const changed=LF.DatasetCorrections.applyProposal(S.state.experiment,p,'ai');LF.DatasetCorrections.rebuildSamples(S.state.experiment);markModified('dataset');if(LF.DatasetCorrections.refresh)LF.DatasetCorrections.refresh(S.state.experiment);render();LF.UI.toast('AI correction applied to the working copy ('+changed+' target'+(changed===1?'':'s')+').','success');}catch(err){p.applyError=err.message||String(err);Log.warn('review.proposal-apply-failed',{index:idx,error:err});render();LF.UI.toast(p.applyError,'error');}}return;
        }
        const safeFixButton=e.target.closest('[data-apply-safe-fix]');if(safeFixButton){
          const analysis=S.state.experiment.datasetAnalysis,fix=analysis&&analysis.safeFixes&&analysis.safeFixes[Number(safeFixButton.dataset.applySafeFix)];
          if(fix){try{const changed=LF.DatasetCorrections.applyProposal(S.state.experiment,Object.assign({},fix),'deterministic');LF.DatasetCorrections.rebuildSamples(S.state.experiment);markModified('dataset');if(LF.DatasetCorrections.refresh)LF.DatasetCorrections.refresh(S.state.experiment);render();LF.UI.toast('Safe correction applied ('+changed+' target'+(changed===1?'':'s')+').','success');}catch(err){LF.UI.toast(err.message||String(err),'error');}}return;
        }
        const ignoreSafeFix=e.target.closest('[data-ignore-safe-fix]');if(ignoreSafeFix){const fix=S.state.experiment.datasetAnalysis&&S.state.experiment.datasetAnalysis.safeFixes&&S.state.experiment.datasetAnalysis.safeFixes[Number(ignoreSafeFix.dataset.ignoreSafeFix)];if(fix){fix.decision='rejected';render();LF.UI.toast('Safe correction left unapplied.','info');}return;}
        if(e.target.closest('#applyAllAiCorrections')){
          const plan=S.state.experiment.aiCorrectionPlan,items=plan&&plan.proposals||[];let applied=0,targets=0,errors=0;
          items.forEach(function(p){if(p.applied||p.decision==='rejected')return;try{targets+=LF.DatasetCorrections.applyProposal(S.state.experiment,p,'ai');applied++;delete p.applyError;}catch(err){p.applyError=err.message||String(err);errors++;}});
          if(applied){LF.DatasetCorrections.rebuildSamples(S.state.experiment);markModified('dataset');if(LF.DatasetCorrections.refresh)LF.DatasetCorrections.refresh(S.state.experiment);}
          render();LF.UI.toast(applied+' AI proposal'+(applied===1?'':'s')+' applied'+(errors?' · '+errors+' could not be mapped':''),errors?'warning':'success');return;
        }
        const reviewProposal=e.target.closest('[data-review-proposal]');if(reviewProposal){updateProposalDecision(Number(reviewProposal.dataset.reviewProposal),reviewProposal.dataset.decision||'pending');render();return;}
        if(e.target.closest('#runReportAiAction')){const select=document.getElementById('reportAiAction'),value=select&&select.value||'';if(!value)return;syncActiveReportEditor('before-ai-edit');const parts=value.split(':');if(parts[0]==='generate')await LF.ActionUI.run('report.generate','',{params:{document_kind:parts[1]||'lab'}});else await LF.ActionUI.run('report.improve','',{params:{mode:parts[1]||'scientific_review'}});S.state.reportMode='editor';render();LF.UI.toast('AI changes applied to the active document text.','success');return;}
        const localFix=e.target.closest('[data-local-fix]');if(localFix){
          const m=S.state.experiment.measurements.find(function(x){return x.id===localFix.dataset.measurementId;});if(m){const exclude=localFix.dataset.localFix==='exclude';m.excluded=exclude;S.state.experiment.patches=S.state.experiment.patches||[];S.state.experiment.patches.push({id:C.uid('patch'),type:exclude?'exclude_measurement':'restore_measurement',target:m.id,from:!exclude,to:exclude,source:'user',reason:'Review data local correction',createdAt:new Date().toISOString()});markModified('dataset');if(LF.DatasetCorrections&&LF.DatasetCorrections.refresh)LF.DatasetCorrections.refresh(S.state.experiment);render();LF.UI.toast(exclude?'Measurement excluded from rankings.':'Measurement restored to rankings.','success');}return;
        }

        if(e.target.closest('#discardRepairPlan')){discardRepairPlan();return;}
        if(e.target.closest('#revalidateDataset')){LF.DatasetCorrections.refresh(S.state.experiment);delete S.state.experiment.aiCorrectionPlan;render();LF.UI.toast('Canonical analysis rebuilt from the current Working Copy.','success');return;}
        
        if(e.target.closest('#refreshDesignEvidence')){if(LF.CanonicalStore)LF.CanonicalStore.build(S.state.experiment);S.state.experiment.designAnalysis=LF.DesignAnalysis.build(S.state.experiment,S.state.experiment.sync&&S.state.experiment.sync.revision||0);render();LF.UI.toast('Deterministic Design evidence refreshed.','success');return;}
        if(e.target.closest('#applyAllDesignSuggestions')){try{const out=LF.DesignAnalysis.applyAll(S.state.experiment);if(out.changed){markModified('design');render();LF.UI.toast('Applied '+out.changed+' AI-proposed missing field'+(out.changed===1?'':'s')+' to Design.','success');}else{render();LF.UI.toast('No missing field could be filled without overwriting existing values.','info');}}catch(err){LF.UI.toast(err.message||String(err),'error');}return;}
        if(e.target.closest('#applyAcceptedDesignProposal')){try{const out=LF.DesignAnalysis.applyAccepted(S.state.experiment);markModified('design');render();LF.UI.toast('Applied '+(out.solutions+out.devices)+' accepted Design item(s).','success');}catch(err){LF.UI.toast(err.message||String(err),'error');}return;}
        const applyDesignProposal=e.target.closest('[data-apply-design-proposal]');if(applyDesignProposal){try{const out=LF.DesignAnalysis.applyOne(S.state.experiment,applyDesignProposal.dataset.applyDesignProposal,Number(applyDesignProposal.dataset.proposalIndex),applyDesignProposal.dataset.proposalPart||'all');markModified('design');render();LF.UI.toast('AI suggestion applied to '+out.changed+' missing field'+(out.changed===1?'':'s')+'.','success');}catch(err){LF.UI.toast(err.message||String(err),'error');}return;}
        const applyDesignDevice=e.target.closest('[data-apply-design-device]');if(applyDesignDevice){try{const out=LF.DesignAnalysis.applySelectedDevice(S.state.experiment,applyDesignDevice.dataset.applyDesignDevice);markModified('design');render();LF.UI.toast('Applied AI-suggested missing values to '+out.changed+' Design field(s) for the selected experiment.','success');}catch(err){LF.UI.toast(err.message||String(err),'error');}return;}
        if(e.target.closest('#runNomadValidation')){LF.Nomad.validate(S.state.experiment,S.state.experiment.raw&&S.state.experiment.raw.sourceArchive);render();LF.UI.toast('NOMAD validation refreshed.','success');return;}

        const openCurve=e.target.closest('[data-open-single-curve]');if(openCurve){e.preventDefault();e.stopPropagation();S.state.selectedMeasurementId=openCurve.dataset.openSingleCurve;S.state.curveSelection=[openCurve.dataset.openSingleCurve];S.state.curveView='single';S.state.resultsTab='curves';render();return;}
        const row=e.target.closest('[data-measurement-row]');if(row){S.state.selectedMeasurementId=row.dataset.measurementRow;const inlineDesktop=!!row.closest('.results-master-detail')&&window.matchMedia&&window.matchMedia('(min-width: 1181px)').matches;if(inlineDesktop){S.state.resultInspectorId=null;render();}else{S.state.resultInspectorId=row.dataset.measurementRow;LF.ResultsPage.renderResultInspector();}return;}
        const resolve=e.target.closest('[data-resolve-finding]');if(resolve){const f=S.state.experiment.findings.find(function(x){return x.id===resolve.dataset.resolveFinding;});if(f){f.status='resolved';Log.info('validation.finding-resolved',{id:f.id,code:f.code});markModified('validation');render();}return;}

        if(e.target.closest('#addDesignDevice')){const d=ensureExperimentShape(S.state.experiment).design,dev={id:C.uid('device'),name:'New experiment',group:'',sampleNames:[],isRef:false,solutionIds:[],stack:[],process:{coating:'',annealing:'',atmosphere:'',notes:''},status:'user_confirmed',evidence:'User entry',confidence:1};d.devices.push(dev);S.state.selectedDesignDeviceId=dev.id;Log.info('design.experiment-added',{count:d.devices.length});markModified('design');render();return;}
        if(e.target.closest('#removeSelectedDevice')){const d=ensureExperimentShape(S.state.experiment).design,id=S.state.selectedDesignDeviceId,idx=d.devices.findIndex(function(x){return x.id===id;});if(idx>=0){const removed=d.devices.splice(idx,1)[0];S.state.selectedDesignDeviceId=d.devices[0]?d.devices[0].id:null;Log.info('design.device-removed',{id:id,samples:(removed.sampleNames||[]).length});markModified('design');render();}return;}
        if(e.target.closest('#addSolution')){const d=ensureExperimentShape(S.state.experiment).design,solution={id:C.uid('sol'),name:'New formulation',role:'',solutes:'',solvents:'',concentration:'',additives:'',preparation:'',evidence:'User entry',status:'user_confirmed'},dev=d.devices.find(function(item){return item.id===S.state.selectedDesignDeviceId;});d.solutions.push(solution);if(dev){dev.solutionIds=dev.solutionIds||[];dev.solutionIds.push(solution.id);}Log.info('design.formulation-added',{count:d.solutions.length,experimentId:dev&&dev.id||''});markModified('design');render();return;}
        const devicePick=e.target.closest('[data-design-device]');if(devicePick){S.state.selectedDesignDeviceId=devicePick.dataset.designDevice;render();return;}
        if(e.target.closest('#addDeviceLayer')){const d=ensureExperimentShape(S.state.experiment).design,dev=d.devices.find(function(x){return x.id===S.state.selectedDesignDeviceId;});if(dev){dev.stack.push({id:C.uid('layer'),role:'',material:'',thickness:'',process:'',evidence:'User entry',status:'user_confirmed'});dev.status='user_confirmed';markModified('design');render();}return;}
        const removeDeviceLayer=e.target.closest('[data-remove-device-layer]');if(removeDeviceLayer){const d=ensureExperimentShape(S.state.experiment).design,dev=d.devices.find(function(x){return x.id===S.state.selectedDesignDeviceId;});if(dev){dev.stack.splice(Number(removeDeviceLayer.dataset.removeDeviceLayer),1);dev.status='user_confirmed';markModified('design');render();}return;}
        const removeSolution=e.target.closest('[data-remove-solution]');if(removeSolution){const i=Number(removeSolution.dataset.removeSolution);S.state.experiment.design.solutions.splice(i,1);Log.info('design.solution-removed',{index:i});markModified('design');render();return;}
        const removeLayer=e.target.closest('[data-remove-layer]');if(removeLayer){const i=Number(removeLayer.dataset.removeLayer);S.state.experiment.design.stack.splice(i,1);Log.info('design.layer-removed',{index:i});markModified('design');render();return;}
        const moveLayer=e.target.closest('[data-move-layer]');if(moveLayer){const i=Number(moveLayer.dataset.moveLayer),dir=moveLayer.dataset.direction==='up'?1:-1,j=i+dir,arr=S.state.experiment.design.stack;if(j>=0&&j<arr.length){const tmp=arr[i];arr[i]=arr[j];arr[j]=tmp;Log.info('design.layer-moved',{from:i,to:j});markModified('design');render();}return;}
        if(e.target.closest('#addLayer')){S.state.experiment.design.stack.push({id:C.uid('layer'),role:'',material:'',thickness:'',process:'',evidence:'User entry',notes:'',status:'user_confirmed'});Log.info('design.layer-added',{count:S.state.experiment.design.stack.length});markModified('design');render();return;}
        const designProposalDecision=e.target.closest('[data-design-proposal-decision]');if(designProposalDecision){updateDesignProposalDecision(designProposalDecision.dataset.designProposalDecision,Number(designProposalDecision.dataset.proposalIndex),designProposalDecision.dataset.decision||'pending');return;}
        if(e.target.closest('#acceptAllDesignProposal')){const proposal=S.state.experiment.aiDesignProposal;if(proposal){(proposal.solutions||[]).concat(proposal.devices||[]).forEach(function(item){if(!item.applied&&(item.decision||'pending')==='pending')item.decision='accepted';});proposal.userEdited=true;proposal.updatedAt=new Date().toISOString();markModified('ai');render();}return;}
        if(e.target.closest('#discardDesignProposal')){delete S.state.experiment.aiDesignProposal;Log.info('design.proposal-discarded');markModified('ai');render();LF.UI.toast('AI design proposal discarded.','info');return;}

        if(e.target.closest('#saveUserProfile')){LF.Storage.saveUserProfile({name:document.getElementById('userName').value.trim()||'Matteo Ginesi',defaultAuthor:document.getElementById('userDefaultAuthor').value.trim()||document.getElementById('userName').value.trim()||'Matteo Ginesi',organization:document.getElementById('userOrganization').value.trim(),email:document.getElementById('userEmail').value.trim()});if(hasExperiment()){const r=LF.Report.ensureReport(S.state.experiment);if(!r.author){r.author=LF.Storage.getUserProfile().defaultAuthor;markModified('report');}}LF.UI.toast('Profile saved.','success');render();return;}
        if(e.target.closest('#saveAssistantSettings')){LF.Storage.saveAssistantSettings({memoryEnabled:document.getElementById('assistantMemoryEnabled').checked,memoryTurns:Number(document.getElementById('assistantMemoryTurns').value),memoryChars:Number(document.getElementById('assistantMemoryChars').value),messageChars:Number(document.getElementById('assistantMessageChars').value),maxOutputTokens:Number(document.getElementById('assistantMaxOutputTokens').value),temperature:Number(document.getElementById('assistantTemperature').value),contextChars:Number(document.getElementById('assistantContextChars').value)});LF.UI.toast('Assistant settings saved.','success');render();return;}
        if(e.target.closest('#saveActionEditor')){const btn=e.target.closest('#saveActionEditor'),id=btn.dataset.actionId,defText=document.getElementById('actionDefinitionEditor').value,promptText=document.getElementById('actionPromptEditor').value;try{const def=JSON.parse(defText);if(!def||def.id!==id)throw new Error('Action id must remain '+id+'.');if(!Array.isArray(def.steps)||!def.steps.length)throw new Error('Action definition requires at least one step.');LF.Storage.saveActionOverride(id,{definition:def,prompt:promptText});LF.UI.toast('Action runtime configuration saved.','success');render();}catch(err){LF.UI.toast('Action not saved: '+(err.message||String(err)),'error');}return;}
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
        if(e.target.closest('#loadProviderModels')){LF.AISettings.loadModels();return;}
        if(e.target.closest('#testAiConnection')){await LF.AISettings.testConnection(e.target.closest('#testAiConnection'));return;}
        if(e.target.closest('#saveNomadSettings')){saveNomadSettings();if(hasExperiment()){LF.Nomad.validate(S.state.experiment);markModified('nomad');render();}return;}
        if(e.target.closest('#downloadNomadPackage')){downloadNomadPackage();return;}
        if(e.target.closest('#nomadDemoUpload')){await simulateNomadUpload();return;}
        if(e.target.closest('#downloadMockNomadPackage')){downloadMockNomadPackage();return;}
        if(e.target.closest('#exportMeasurementsCsv')){C.downloadBlob(C.textBlob(LF.Analysis.toCSV(S.state.experiment),'text/csv;charset=utf-8'),C.safeName(S.state.experiment.meta.name)+'_measurements.csv');return;}
        const canvasExport=e.target.closest('[data-export-canvas]');if(canvasExport){LF.ResultsPage.exportCanvas(canvasExport.dataset.exportCanvas,canvasExport.dataset.exportName||'labflow-chart.png');return;}
        if(e.target.closest('#reportMd')){const doc=syncActiveReportEditor('markdown-export'),result=LF.Report.exportMarkdown(S.state.experiment);LF.UI.toast(doc.label+' exported from '+result.words+' words.','success');return;}
        if(e.target.closest('#reportTex')){const doc=syncActiveReportEditor('latex-export');LF.Report.exportLatex(S.state.experiment);LF.UI.toast(doc.label+' exported as LaTeX.','success');return;}
        if(e.target.closest('#reportDocx')){downloadReportDocx();return;}
        if(e.target.closest('#reportPdf')){downloadReportPdf();return;}
        if(e.target.closest('#exportCurvePng')){LF.ResultsPage.exportCanvas('curveCanvas',C.safeName(S.state.experiment.meta.name)+'_jv_curves.png');return;}
        if(e.target.closest('#boxSelectAll')){S.state.boxPlot.groups=Array.from(new Set(S.state.experiment.measurements.map(function(m){return LF.ResultsPage.groupName(m);}))).sort();render();return;}
        if(e.target.closest('#boxSelectRef')){S.state.boxPlot.groups=Array.from(new Set(S.state.experiment.measurements.filter(function(m){return m.isRef;}).map(function(m){return LF.ResultsPage.groupName(m);}))).sort();render();return;}
        if(e.target.closest('#boxClearGroups')){S.state.boxPlot.groups=[];render();return;}
        if(e.target.closest('#exportBoxPng')){LF.ResultsPage.exportCanvas('boxCanvas',C.safeName(S.state.experiment.meta.name)+'_boxplots.png');return;}
      } catch(err) { Log.error('ui.click-handler-failed',{target:e.target&&e.target.id||e.target&&e.target.dataset||'',error:err}); LF.UI.toast(err.message||String(err),'error'); }
    });

    document.addEventListener('change',function(e){
      try {
        if(e.target.id==='uiKitGlobalFilter'){S.state.uiKitFilter=e.target.value||'all';postUiKitFilter();return;}
        if(e.target.id==='aiProvider'){LF.AISettings.selectProvider(e.target.value);return;}
        if(e.target.id==='logScopeFilter'){LF.LogsPage.setScope(e.target.value);render();return;}
        if(e.target.id==='designDeviceSelect'){S.state.selectedDesignDeviceId=e.target.value;render();return;}
        if(e.target.id==='actionReportDocKind'){S.state.settingsActionDocKind=e.target.value==='paper'?'paper':'lab';if(S.persist)S.persist();render();return;}
        if(e.target.id==='markdownBlockStyle'){if(e.target.value)applyMarkdownTool(e.target.value);e.target.value='';return;}
        if(e.target.id==='curveView'){S.state.curveView=e.target.value;render();return;}
        if(e.target.id==='curveGroup'){S.state.curveGroup=e.target.value;render();return;}
        if(e.target.id==='curveDirection'){S.state.curveDirection=e.target.value;render();return;}
        if(e.target.id==='curveEligibleOnly'){S.state.curveEligibleOnly=e.target.checked;render();return;}
        if(e.target.id==='curveMeasurement'){S.state.selectedMeasurementId=e.target.value;render();return;}
        const curveSelect=e.target.closest('[data-curve-select]');if(curveSelect){S.state.selectedMeasurementId=curveSelect.dataset.curveSelect;S.state.curveSelection=[curveSelect.dataset.curveSelect];render();return;}
        const curve=e.target.closest('[data-curve-check]');if(curve){S.state.curveOverlaySelection=S.state.curveOverlaySelection||[];if(curve.checked&&!S.state.curveOverlaySelection.includes(curve.dataset.curveCheck))S.state.curveOverlaySelection.push(curve.dataset.curveCheck);if(!curve.checked)S.state.curveOverlaySelection=S.state.curveOverlaySelection.filter(function(id){return id!==curve.dataset.curveCheck;});render();return;}
        const boxGroup=e.target.closest('[data-box-group]');if(boxGroup){const name=boxGroup.dataset.boxGroup;S.state.boxPlot.groups=S.state.boxPlot.groups||[];if(boxGroup.checked&&!S.state.boxPlot.groups.includes(name))S.state.boxPlot.groups.push(name);if(!boxGroup.checked)S.state.boxPlot.groups=S.state.boxPlot.groups.filter(function(x){return x!==name;});render();return;}
        if(e.target.id==='boxMetric'){S.state.boxPlot.metric=e.target.value;render();return;}
        if(e.target.id==='boxDirection'){S.state.boxPlot.direction=e.target.value;render();return;}
        if(e.target.id==='boxEligibleOnly'){S.state.boxPlot.eligibleOnly=e.target.checked;render();return;}
        if(e.target.id==='resultMismatchFactor'){const v=Number(e.target.value);if(v>0){S.state.experiment.analysisSettings=S.state.experiment.analysisSettings||{};S.state.experiment.analysisSettings.mismatchFactor=v;LF.Analysis.analyze(S.state.experiment);markModified('analysis');render();}return;}
        const confirmSolution=e.target.closest('[data-confirm-solution]');if(confirmSolution){const sol=S.state.experiment.design.solutions[Number(confirmSolution.dataset.confirmSolution)];if(sol){sol.status=confirmSolution.checked?'user_confirmed':'unknown';markModified('design');render();}return;}
        const confirmLayer=e.target.closest('[data-confirm-layer]');if(confirmLayer){const layer=S.state.experiment.design.stack[Number(confirmLayer.dataset.confirmLayer)];if(layer){layer.status=confirmLayer.checked?'user_confirmed':'unknown';markModified('design');render();}return;}
        const deviceSolution=e.target.closest('[data-device-solution-id]');if(deviceSolution){const d=ensureExperimentShape(S.state.experiment).design,dev=d.devices.find(function(x){return x.id===S.state.selectedDesignDeviceId;});if(dev){const id=deviceSolution.dataset.deviceSolutionId;dev.solutionIds=dev.solutionIds||[];if(deviceSolution.checked&&!dev.solutionIds.includes(id))dev.solutionIds.push(id);if(!deviceSolution.checked)dev.solutionIds=dev.solutionIds.filter(function(x){return x!==id;});dev.status='user_confirmed';markDraft('design');refreshDesignProjection();}return;}
        const deviceSample=e.target.closest('[data-device-sample-name]');if(deviceSample){const d=ensureExperimentShape(S.state.experiment).design,dev=d.devices.find(function(x){return x.id===S.state.selectedDesignDeviceId;}),name=deviceSample.dataset.deviceSampleName;if(dev){dev.sampleNames=dev.sampleNames||[];if(deviceSample.checked){d.devices.forEach(function(other){if(other.id!==dev.id)other.sampleNames=(other.sampleNames||[]).filter(function(x){return x!==name;});});if(!dev.sampleNames.includes(name))dev.sampleNames.push(name);d.devices=d.devices.filter(function(other){return other.id===dev.id||other.status!=='raw_evidence'||(other.sampleNames||[]).length>0;});}else dev.sampleNames=dev.sampleNames.filter(function(x){return x!==name;});dev.status='user_confirmed';markModified('design');render();}return;}
        if(e.target.id==='confirmSelectedDevice'){const d=ensureExperimentShape(S.state.experiment).design,dev=d.devices.find(function(x){return x.id===S.state.selectedDesignDeviceId;});if(dev){dev.status=e.target.checked?'user_confirmed':'raw_evidence';markModified('design');render();}return;}
        const reportFigure=e.target.closest('[data-report-figure]');if(reportFigure){LF.Report.setFigure(S.state.experiment,reportFigure.dataset.reportFigure,reportFigure.checked);markModified('report');render();return;}
        const reportOption=e.target.closest('[data-report-option]');if(reportOption){const r=LF.Report.ensureReport(S.state.experiment);r[reportOption.dataset.reportOption]=reportOption.checked;r.updatedAt=new Date().toISOString();markDraft('report');return;}
      } catch(err){Log.error('ui.change-handler-failed',{target:e.target&&e.target.id||'',error:err});}
    });

    document.addEventListener('input',function(e){
      try {
        if(e.target.id==='uiKitGlobalSearch'){S.state.uiKitQuery=e.target.value;postUiKitFilter();return;}
        if(e.target.id==='logSearch'){LF.LogsPage.setQuery(e.target.value);clearTimeout(S.state._logSearchTimer);S.state._logSearchTimer=setTimeout(function(){render();const search=document.getElementById('logSearch');if(search){search.focus();search.setSelectionRange(search.value.length,search.value.length);}},180);return;}
        if(e.target.id==='curveSearch'){S.state.curveSearch=e.target.value;clearTimeout(S.state._curveSearchTimer);S.state._curveSearchTimer=setTimeout(function(){render();},140);return;}
        if(e.target.id==='measurementSearch'){const q=e.target.value.trim().toLowerCase();document.querySelectorAll('#measurementTable tbody tr').forEach(function(tr){tr.hidden=q&&!tr.dataset.search.includes(q);});return;}
        if(e.target.id==='reportMarkdown'){
          LF.Report.setActiveMarkdown(S.state.experiment,e.target.value);const preview=document.getElementById('reportMarkdownRendered');if(preview){preview.classList.toggle('report-preview-empty',!e.target.value.trim());preview.classList.toggle('markdown-view',!!e.target.value.trim());preview.innerHTML=e.target.value.trim()?C.markdown(e.target.value):'<strong>No document content yet.</strong><span>The preview stays empty until you write or create a draft.</span>';if(LF.Math&&LF.Math.queueTypeset)LF.Math.queueTypeset(preview,180);}const hint=document.querySelector('.report-empty-hint');if(hint)hint.hidden=!!e.target.value.trim();const wc=document.getElementById('reportSaveState');if(wc)wc.textContent=((e.target.value.trim().match(/\S+/g)||[]).length)+' words';markDraft('report');
          const info=LF.Report.documentInfo(S.state.experiment),count=document.getElementById('reportWordCount'),status=document.getElementById('reportExportStatus'),saved=document.getElementById('reportSaveState');if(count)count.textContent=info.words+' words · '+info.chars+' characters';const len=document.getElementById('reportPreviewLength');if(len)len.textContent=info.words+' words';if(status)status.textContent='Current editor text · '+info.words+' words';if(saved)saved.textContent='Saved now · export ready';return;
        }
        const reportTitle=e.target.closest('[data-report-title]');if(reportTitle){LF.Report.setActiveTitle(S.state.experiment,reportTitle.value);markDraft('report');const cover=document.querySelector('.report-preview-cover strong');if(cover)cover.textContent=reportTitle.value;return;}
        const reportMeta=e.target.closest('[data-report-meta]');if(reportMeta){const r=LF.Report.ensureReport(S.state.experiment);r[reportMeta.dataset.reportMeta]=reportMeta.value;r.updatedAt=new Date().toISOString();markDraft('report');return;}
        const solField=e.target.closest('[data-solution-field]');if(solField){const sol=S.state.experiment.design.solutions[Number(solField.dataset.solutionIndex)];if(sol){sol[solField.dataset.solutionField]=solField.value;sol.userEdited=true;sol.status='user_confirmed';markDraft('design');refreshDesignProjection();}return;}
        const proposalSolutionField=e.target.closest('[data-proposal-solution-index]');if(proposalSolutionField){const proposal=S.state.experiment.aiDesignProposal,item=proposal&&proposal.solutions&&proposal.solutions[Number(proposalSolutionField.dataset.proposalSolutionIndex)];if(item){const field=proposalSolutionField.dataset.proposalField,previous=item[field];item[field]=proposalSolutionField.value;if(field==='name'&&String(previous)!==item.name)(proposal.devices||[]).forEach(function(device){device.solution_names=(device.solution_names||[]).map(function(name){return String(name)===String(previous)?item.name:name;});});if(item.applied){item.applied=false;item.decision='pending';}proposal.userEdited=true;proposal.updatedAt=new Date().toISOString();markModified('ai');}return;}
        const proposalLayerField=e.target.closest('[data-proposal-layer-field]');if(proposalLayerField){const proposal=S.state.experiment.aiDesignProposal,device=proposal&&proposal.devices&&proposal.devices[Number(proposalLayerField.dataset.proposalDeviceIndex)],layer=device&&device.stack&&device.stack[Number(proposalLayerField.dataset.proposalLayerIndex)];if(layer){layer[proposalLayerField.dataset.proposalLayerField]=proposalLayerField.value;if(device.applied){device.applied=false;device.decision='pending';}proposal.userEdited=true;proposal.updatedAt=new Date().toISOString();markModified('ai');}return;}
        const proposalProcessField=e.target.closest('[data-proposal-process-field]');if(proposalProcessField){const proposal=S.state.experiment.aiDesignProposal,item=proposal&&proposal.devices&&proposal.devices[Number(proposalProcessField.dataset.proposalDeviceIndex)];if(item){item.process=item.process||{};item.process[proposalProcessField.dataset.proposalProcessField]=proposalProcessField.value;if(item.applied){item.applied=false;item.decision='pending';}proposal.userEdited=true;proposal.updatedAt=new Date().toISOString();markModified('ai');}return;}
        const proposalDeviceField=e.target.closest('[data-proposal-device-index][data-proposal-field]');if(proposalDeviceField){const proposal=S.state.experiment.aiDesignProposal,item=proposal&&proposal.devices&&proposal.devices[Number(proposalDeviceField.dataset.proposalDeviceIndex)];if(item){const value=proposalDeviceField.dataset.proposalArray==='true'?proposalDeviceField.value.split(',').map(function(x){return x.trim();}).filter(Boolean):proposalDeviceField.value;item[proposalDeviceField.dataset.proposalField]=value;if(item.applied){item.applied=false;item.decision='pending';}proposal.userEdited=true;proposal.updatedAt=new Date().toISOString();markModified('ai');}return;}
        const deviceField=e.target.closest('[data-device-field]');if(deviceField){const d=ensureExperimentShape(S.state.experiment).design,dev=d.devices.find(function(x){return x.id===S.state.selectedDesignDeviceId;});if(dev){dev[deviceField.dataset.deviceField]=deviceField.value;dev.status='user_confirmed';markDraft('design');refreshDesignProjection();}return;}
        const deviceLayerField=e.target.closest('[data-device-layer-field]');if(deviceLayerField){const d=ensureExperimentShape(S.state.experiment).design,dev=d.devices.find(function(x){return x.id===S.state.selectedDesignDeviceId;}),item=dev&&dev.stack[Number(deviceLayerField.dataset.deviceLayerIndex)];if(item){item[deviceLayerField.dataset.deviceLayerField]=deviceLayerField.value;item.status='user_confirmed';dev.status='user_confirmed';markDraft('design');refreshDesignProjection();}return;}
        const deviceProcessField=e.target.closest('[data-device-process-field]');if(deviceProcessField){const d=ensureExperimentShape(S.state.experiment).design,dev=d.devices.find(function(x){return x.id===S.state.selectedDesignDeviceId;});if(dev){dev.process=dev.process||{};dev.process[deviceProcessField.dataset.deviceProcessField]=deviceProcessField.value;dev.status='user_confirmed';markDraft('design');refreshDesignProjection();}return;}
        const processField=e.target.closest('[data-process-field]');if(processField){S.state.experiment.design.process[processField.dataset.processField]=processField.value;S.state.experiment.design.processProvenance=S.state.experiment.design.processProvenance||{};S.state.experiment.design.processProvenance[processField.dataset.processField]={status:'user_confirmed',evidence:'User entry'};markDraft('design');refreshDesignProjection();return;}
        const layerField=e.target.closest('[data-layer-field]');if(layerField){const item=S.state.experiment.design.stack[Number(layerField.dataset.layerIndex)];if(item){item[layerField.dataset.layerField]=layerField.value;if(item.status==='ai_inferred')item.status='user_confirmed';markDraft('design');}return;}
      } catch(err){Log.error('ui.input-handler-failed',{target:e.target&&e.target.id||'',error:err});}
    });

    document.addEventListener('focusout',function(e){if(e.target&&e.target.id==='reportMarkdown'){commitDraft('report');return;}if(e.target&&e.target.closest&&e.target.closest('[data-solution-field],[data-device-field],[data-device-layer-field],[data-device-process-field],[data-process-field],[data-layer-field]')){commitDraft('design');}});

    document.addEventListener('submit',function(e){
      if(e.target.id==='samplePatchForm'){
        e.preventDefault();
        try {
          const fd=new FormData(e.target),from=String(fd.get('from')||'').trim(),to=LF.Parser.canonicalSample(fd.get('to')),reason=String(fd.get('reason')||'').trim();if(!from||!to||!reason)return;
          let changed=0;S.state.experiment.measurements.forEach(function(m){if(m.sample===from){m.sample=to;m.group=LF.Parser.groupFromSample(to);m.isRef=LF.Parser.isReference(to);changed++;}});
          if(!changed)throw new Error('No measurement uses the selected current sample identity.');
          S.state.experiment.patches.push({id:C.uid('patch'),type:'sample_mapping',target:from,from:from,to:to,source:'user',reason:reason,evidence:['Researcher-confirmed manual correction'],reviewStatus:'accepted',createdAt:new Date().toISOString()});
          if(LF.DatasetCorrections&&LF.DatasetCorrections.rebuildSamples)LF.DatasetCorrections.rebuildSamples(S.state.experiment);else rebuildSamples(S.state.experiment);markModified('dataset');if(LF.DatasetCorrections&&LF.DatasetCorrections.refresh)LF.DatasetCorrections.refresh(S.state.experiment);render();LF.UI.toast('Canonical sample mapping applied to '+changed+' measurement'+(changed===1?'':'s')+'.','success');
        } catch(err){Log.error('validation.manual-mapping-failed',{error:err});LF.UI.toast(err.message||String(err),'error');}
      }
    });

    const inspectorShade=document.getElementById('resultInspectorShade');if(inspectorShade)inspectorShade.addEventListener('click',function(ev){if(ev.target===inspectorShade)LF.ResultsPage.closeResultInspector();});document.addEventListener('keydown',function(ev){if(ev.key==='Escape'&&document.body.classList.contains('mobile-nav-open')){closeMobileNav();return;}if(ev.key==='Escape'&&!LF.UI.isActivityOpen()&&S.state.resultInspectorId){LF.ResultsPage.closeResultInspector();}});
    window.addEventListener('message',function(event){const frame=document.querySelector('.ui-kit-frame');if(!frame||event.source!==frame.contentWindow||!event.data||event.data.type!=='labflow-ui-kit-count')return;const count=document.getElementById('uiKitGlobalCount');if(count)count.textContent=Number(event.data.count||0)+' pattern'+(Number(event.data.count)===1?'':'s');});
    document.getElementById('datasetInput').addEventListener('change',function(){const f=this.files[0];this.value='';if(f)importDataset(f);});
    Log.debug('events.bind.end');
  }

  /** Export an inline deterministic SVG chart as PNG. */

  /* ---------- bootstrap ---------- */
  async function init(){
    LF.Logger.installGlobalHooks();const end=Log.timer('init',{href:location.href,protocol:location.protocol});
    try{
      S.state.route='experiment-import';S.state.assistantOpen=window.innerWidth>1100&&LF.Storage.getUiSettings().assistantOpen!==false;LF.Theme.apply(LF.Storage.getUiSettings().theme,false);
      /* Provider credentials/preferences are browser-persistent, but scientific
         Working Copy state is deliberately session-only. Every page load starts
         at Upload & Review with no ZIP attached. */
      S.resetSession();S.state.assistantOpen=window.innerWidth>1100&&LF.Storage.getUiSettings().assistantOpen!==false;LF.Theme.apply(LF.Storage.getUiSettings().theme,false);
      if(LF.Storage.clearSavedExperiment)await LF.Storage.clearSavedExperiment();
      Log.info('workspace.fresh-session',{route:S.state.route,persistentProvider:true,persistentApiKey:!!LF.Storage.getApiKey()});
      bindEvents();setMobileNav(false);window.addEventListener('resize',function(){if(window.innerWidth>1100)closeMobileNav();},{passive:true});if(LF.ActionUI)LF.ActionUI.bind();LF.Assistant.bind();S.subscribe(function(){render();});render();end({route:S.state.route,logEntries:LF.Logger.entries().length},'info');
    }
    catch(err){Log.error('init.failed',{error:err});end({error:err},'error');throw err;}
  }
  document.addEventListener('DOMContentLoaded',init);
}());
