(function () {
  'use strict';

  const LF = window.LabFlow = window.LabFlow || {};
  const C = LF.Core;

  /*
   * Shared page-shell fragments for workflow routes.
   * These builders are deliberately small strings shared by every workflow
   * page so the composition contract stays identical across routes.
   */

  function hasExperiment() {
    const exp = LF.State.ensureExperiment('availability');
    return !!(exp && exp.id && exp.raw && exp.raw.sourceArchive);
  }
  function ensureExperimentShape(exp) { return exp === LF.State.state.experiment ? LF.State.ensureExperiment('pages') : LF.ExperimentModel.ensureShape(exp, LF.State.state); }

  function routeTitle(route) {
    return ({'experiment-import':'Upload','experiment-understand':'Review data','experiment-results':'Results','experiment-design':'Design','experiment-report':'Report','experiment-changes':'Changes','experiment-nomad':'NOMAD',settings:'Settings',logs:'Logs','ui-kit':'UI Kit'})[route] || 'LabFlow';
  }

  function experimentStepper() {
    const steps=[['experiment-import','1','Upload'],['experiment-understand','2','Review'],['experiment-results','3','Results'],['experiment-design','4','Design'],['experiment-report','5','Report'],['experiment-changes','6','Changes'],['experiment-nomad','7','NOMAD']];
    const ready=hasExperiment(),routeIndex=steps.findIndex(function(x){return LF.State.state.route===x[0];}),current=ready&&routeIndex>=0?routeIndex:0;
    return '<nav class="stepper experiment-strip no-print" aria-label="Experiment workflow">'+steps.map(function(x,i){const active=i===current,done=ready&&i<current,disabled=!ready&&i>0;return '<button type="button" class="step '+(active?'active ':'')+(done?'done ':'')+'" data-route="'+x[0]+'" '+(active?'aria-current="step" ':'')+(disabled?'disabled aria-disabled="true"':'')+'><span class="step-index">'+x[1]+'</span><strong>'+x[2]+'</strong></button>';}).join('')+'</nav>';
  }

  function pageHead(title, subtitle, actions) {
    return '<div class="page-head"><div><h1 class="h1">'+C.escapeHtml(title)+'</h1><div class="meta">'+C.escapeHtml(subtitle||'')+'</div></div><div class="spacer"></div><div class="toolbar no-print">'+(actions||'')+'</div></div>';
  }

  function workflowHead(title, subtitle, actions) {
    return pageHead(title,subtitle,actions)+experimentStepper();
  }

  function needExperiment() {
    return '<section class="page start-page">'+workflowHead('Upload experiment','Load the original laboratory ZIP to begin the RAW → Review → Results → Design → Report → NOMAD workflow.')+
      '<section class="panel upload-panel"><div class="panel-head"><div><h2 class="h2">RAW experiment source</h2><div class="meta">The ZIP is the only experiment entry point.</div></div><div class="spacer"></div>'+badge('local import','info')+'</div><div class="upload-workbench"><div class="upload-ingest"><div class="upload-source-mark" aria-hidden="true"><span>RAW</span><strong>ZIP</strong></div><div class="upload-copy"><h2>Choose the original experiment ZIP</h2><p>LabFlow preserves the uploaded bytes, inventories every path, and builds a separate working interpretation for review.</p><div class="row-wrap"><button type="button" class="button primary upload-primary" data-open-dataset>Choose ZIP file</button><span class="help">No model call is made during import.</span></div></div></div><dl class="upload-contract"><div><dt>Source</dt><dd>Byte-for-byte RAW snapshot · never rewritten</dd></div><div><dt>Processing</dt><dd>Local deterministic parsing and validation</dd></div><div><dt>Next decision</dt><dd>Review evidence and proposed corrections</dd></div></dl></div></section>'+
      '<div class="notice info upload-notice"><strong>Non-destructive workflow.</strong> RAW bytes are snapshotted at import and never renamed, rewritten or autosaved. Corrections affect only the Working Copy. Save persists the internal LabFlow representation in this browser; Export creates a ZIP explicitly.</div></section>';
  }

  function badge(text,type){return '<span class="badge '+(type||'')+'">'+C.escapeHtml(text)+'</span>';}

  LF.PageShell = {
    hasExperiment: hasExperiment,
    ensureExperimentShape: ensureExperimentShape,
    routeTitle: routeTitle,
    experimentStepper: experimentStepper,
    pageHead: pageHead,
    workflowHead: workflowHead,
    needExperiment: needExperiment,
    badge: badge
  };
})();