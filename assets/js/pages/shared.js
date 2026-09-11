(function () {
  'use strict';

  const LF = window.LabFlow = window.LabFlow || {};
  const C = LF.Core;

  /* Shared page-shell fragments. Navigation metadata lives here so the
     sidebar, workflow strip and in-page Previous/Next controls use one order. */
  const ROUTES = [
    {id:'experiment-import', label:'Upload & Review', short:'Upload', requiresExperiment:false},
    {id:'experiment-results', label:'Results', short:'Results', requiresExperiment:true},
    {id:'experiment-design', label:'Design', short:'Design', requiresExperiment:true},
    {id:'experiment-export', label:'Export', short:'Export', requiresExperiment:true},
    {id:'cabinet', label:'Lab Cabinet', short:'Cabinet', requiresExperiment:false},
    {id:'documentation', label:'Documentation', short:'Docs', requiresExperiment:false},
    {id:'logs', label:'Logs', short:'Logs', requiresExperiment:false},
    {id:'ui-kit', label:'UI Kit', short:'UI Kit', requiresExperiment:false},
    {id:'settings', label:'Settings', short:'Settings', requiresExperiment:false}
  ];
  const WORKFLOW_IDS = ROUTES.slice(0,4).map(function(route){ return route.id; });

  function hasExperiment() {
    const exp = LF.State.ensureExperiment('availability');
    return !!(exp && exp.id && exp.raw && exp.raw.sourceArchive);
  }
  function ensureExperimentShape(exp) { return exp === LF.State.state.experiment ? LF.State.ensureExperiment('pages') : LF.DataModel.hydrate(exp); }
  function routeMeta(route){ return ROUTES.find(function(item){ return item.id===route; }) || null; }
  function routeTitle(route) { const meta=routeMeta(route); return meta ? meta.label : 'LabFlow'; }

  function experimentStepper() {
    const ready=hasExperiment(),currentRoute=LF.State.state.ui.route,current=Math.max(0,WORKFLOW_IDS.indexOf(currentRoute));
    return '<nav class="stepper experiment-strip no-print" aria-label="Experiment workflow">'+ROUTES.slice(0,4).map(function(item,i){const active=item.id===currentRoute,done=ready&&i<current,disabled=item.requiresExperiment&&!ready;return '<button type="button" class="step '+(active?'active ':'')+(done?'done ':'')+'" data-route="'+item.id+'" '+(active?'aria-current="step" ':'')+(disabled?'disabled aria-disabled="true"':'')+'><span class="step-index">'+(i+1)+'</span><strong>'+C.escapeHtml(item.label)+'</strong></button>';}).join('')+'</nav>';
  }

  function pageHead(title, subtitle, actions) {
    return '<div class="page-head"><div><h1 class="h1">'+C.escapeHtml(title)+'</h1><div class="meta">'+C.escapeHtml(subtitle||'')+'</div></div><div class="spacer"></div><div class="toolbar no-print">'+(actions||'')+'</div></div>';
  }
  function workflowHead(title, subtitle, actions) {
    const route=LF.State&&LF.State.state&&LF.State.state.ui.route||'';
    return pageNavigation(route)+pageHead(title,subtitle,actions)+experimentStepper();
  }

  function navigationButton(direction,item,disabled){
    const back=direction==='previous',label=back?'Previous':'Next',glyph=back?'←':'→';
    if(!item)return '<span class="page-nav-spacer" aria-hidden="true"></span>';
    return '<button class="button page-nav-button '+(back?'page-nav-previous':'page-nav-next')+'" type="button" data-route="'+item.id+'" '+(disabled?'disabled aria-disabled="true"':'')+'><span class="page-nav-arrow" aria-hidden="true">'+glyph+'</span><span class="page-nav-copy"><small>'+label+'</small><strong>'+C.escapeHtml(item.short||item.label)+'</strong></span></button>';
  }

  function pageNavigation(route) {
    const index=WORKFLOW_IDS.indexOf(String(route||''));
    if(index<0)return '';
    const previous=index>0?routeMeta(WORKFLOW_IDS[index-1]):null;
    const next=index<WORKFLOW_IDS.length-1?routeMeta(WORKFLOW_IDS[index+1]):null;
    const ready=hasExperiment();
    const previousDisabled=!!(previous&&previous.requiresExperiment&&!ready);
    const nextDisabled=!!(next&&next.requiresExperiment&&!ready);
    return '<nav class="page-nav workflow-page-nav no-print" aria-label="Experiment page navigation">'+navigationButton('previous',previous,previousDisabled)+'<span class="page-nav-position">Step '+(index+1)+' of '+WORKFLOW_IDS.length+'</span>'+navigationButton('next',next,nextDisabled)+'</nav>';
  }

  function needExperiment() {
    return '<section class="page start-page upload-start-page">'+workflowHead('Upload experiment','Choose the experiment ZIP to begin.')+
      '<section class="panel upload-start-card"><div class="upload-start-main"><div class="upload-source-mark" aria-hidden="true"><span>LAB</span><strong>ZIP</strong></div><div class="upload-copy"><span class="eyebrow">Experiment source</span><h2>Choose your experiment ZIP</h2><p>LabFlow will import the data and show anything that needs your attention before analysis.</p><div class="row-wrap"><button type="button" class="button primary upload-primary" data-open-dataset>Choose ZIP file</button><span class="upload-simple-note"><span data-icon="check" aria-hidden="true"></span> Your original file stays unchanged.</span></div></div></div><details class="upload-start-details"><summary>What happens next?</summary><div class="upload-next-steps"><div><strong>1</strong><span>Import the experiment</span></div><div><strong>2</strong><span>Review anything unusual</span></div><div><strong>3</strong><span>Explore Results</span></div></div></details></section></section>';
  }

  function badge(text,type){return '<span class="badge '+(type||'')+'">'+C.escapeHtml(text)+'</span>';}

  LF.PageShell = {
    routes: ROUTES.slice(),
    hasExperiment: hasExperiment,
    ensureExperimentShape: ensureExperimentShape,
    routeMeta: routeMeta,
    routeTitle: routeTitle,
    experimentStepper: experimentStepper,
    pageHead: pageHead,
    workflowHead: workflowHead,
    pageNavigation: pageNavigation,
    needExperiment: needExperiment,
    badge: badge
  };
})();
