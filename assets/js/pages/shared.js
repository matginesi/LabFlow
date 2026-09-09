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
    const ready=hasExperiment(),currentRoute=LF.State.state.route,current=Math.max(0,WORKFLOW_IDS.indexOf(currentRoute));
    return '<nav class="stepper experiment-strip no-print" aria-label="Experiment workflow">'+ROUTES.slice(0,4).map(function(item,i){const active=item.id===currentRoute,done=ready&&i<current,disabled=item.requiresExperiment&&!ready;return '<button type="button" class="step '+(active?'active ':'')+(done?'done ':'')+'" data-route="'+item.id+'" '+(active?'aria-current="step" ':'')+(disabled?'disabled aria-disabled="true"':'')+'><span class="step-index">'+(i+1)+'</span><strong>'+C.escapeHtml(item.label)+'</strong></button>';}).join('')+'</nav>';
  }

  function pageHead(title, subtitle, actions) {
    return '<div class="page-head"><div><h1 class="h1">'+C.escapeHtml(title)+'</h1><div class="meta">'+C.escapeHtml(subtitle||'')+'</div></div><div class="spacer"></div><div class="toolbar no-print">'+(actions||'')+'</div></div>';
  }
  function workflowHead(title, subtitle, actions) {
    const route=LF.State&&LF.State.state&&LF.State.state.route||'';
    return pageHead(title,subtitle,actions)+pageNavigation(route)+experimentStepper();
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
    return '<nav class="page-nav workflow-page-nav no-print" aria-label="Experiment page navigation">'+navigationButton('previous',previous,previousDisabled)+'<span class="page-nav-position">'+(index+1)+' / '+WORKFLOW_IDS.length+'</span>'+navigationButton('next',next,nextDisabled)+'</nav>';
  }

  function needExperiment() {
    return '<section class="page start-page">'+workflowHead('Upload experiment','Load the original laboratory ZIP to begin the Upload & Review → Results → Design → Export workflow.')+
      '<section class="panel upload-panel"><div class="panel-head"><div><h2 class="h2">RAW experiment source</h2><div class="meta">The ZIP is the only experiment entry point.</div></div><div class="spacer"></div>'+badge('local import','info')+'</div><div class="upload-workbench"><div class="upload-ingest"><div class="upload-source-mark" aria-hidden="true"><span>RAW</span><strong>ZIP</strong></div><div class="upload-copy"><h2>Choose the original experiment ZIP</h2><p>LabFlow preserves the uploaded bytes, inventories every path, and builds the LabFlow data representation used by the application.</p><div class="row-wrap"><button type="button" class="button primary upload-primary" data-open-dataset>Choose ZIP file</button><span class="help">Parsing, naming normalization, safe cleanup and scientific analysis are local and deterministic. AI is only requested explicitly when you choose an AI-assisted action.</span></div></div></div><dl class="upload-contract"><div><dt>Source</dt><dd>Byte-for-byte RAW snapshot · never rewritten</dd></div><div><dt>Processing</dt><dd>Local deterministic parsing and validation</dd></div><div><dt>Next decision</dt><dd>Review evidence and proposed corrections</dd></div></dl></div></section>'+
      '<div class="notice info upload-notice"><strong>Non-destructive workflow.</strong> RAW bytes are snapshotted at import and never renamed, rewritten or autosaved. LabFlow never rewrites the uploaded archive. The application works on its own structured representation, autosaves the session locally, and creates portable artifacts only from Export.</div></section>';
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
