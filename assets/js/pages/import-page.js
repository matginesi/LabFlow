(function () {
  'use strict';

  const LF = window.LabFlow = window.LabFlow || {};
  const C = LF.Core;

  /*
   * Import (Step 1) route.
   * Receives live deps at render time so the module stays testable and app.js
   * keeps only event routing. `deps` = { C, S, Log, PageShell } but tolerant to
   * any subset via LF defaults.
   */

  function importTimestamp(value) {
    const date=new Date(value||'');
    return Number.isNaN(date.getTime())?'Not recorded':date.toLocaleString();
  }

  function importFamilyCounts(manifest) {
    const counts={summary:0,jv:0,parameters:0,tracking:0,other:0};
    (manifest||[]).forEach(function(entry){
      if(entry.directory)return;
      if(entry.type==='summary'||entry.type==='summary-fw'||entry.type==='summary-rv')counts.summary++;
      else if(Object.prototype.hasOwnProperty.call(counts,entry.type))counts[entry.type]++;
      else counts.other++;
    });
    return counts;
  }

  function importFamilyItem(label,count,description) {
    return '<div class="import-family"><span>'+C.escapeHtml(label)+'</span><strong>'+Number(count||0)+'</strong><small>'+C.escapeHtml(description)+'</small></div>';
  }

  function render(state, deps) {
    const d=deps||{},C=d.C||LF.Core,S=d.S||LF.State,Log=d.Log||(LF.Logger&&LF.Logger.scope('import-page'))||null;
    const shell=d.PageShell||LF.PageShell;
    if(!shell.hasExperiment())return shell.needExperiment();
    const e=S.state.experiment,sum=e.analysis.summary||{},files=e.manifest.filter(function(x){return !x.directory;}),directories=e.manifest.length-files.length;
    const families=importFamilyCounts(e.manifest),recoveries=e.measurements.reduce(function(total,m){return total+(m.recoveries||[]).length;},0);
    const tree=e.manifest.filter(function(x){return !x.directory;}).slice(0,220).map(function(x){return '<div>'+C.escapeHtml(x.path)+' <span class="muted">['+C.escapeHtml(x.type)+']</span></div>';}).join('');
    return '<section class="page">'+shell.workflowHead('Uploaded ZIP','Deterministic receipt for the immutable source archive and its local working interpretation.','<button type="button" class="button" data-open-dataset>Replace ZIP</button><button type="button" class="button primary" data-route="experiment-understand">Open Review</button>')+
      '<div class="metric-grid compact-metrics"><div class="metric"><div class="metric-label">RAW archive</div><div class="metric-value metric-value-text">'+C.escapeHtml(e.meta.sourceName)+'</div><div class="metric-sub">'+C.bytes(e.meta.sourceSize)+'</div></div><div class="metric"><div class="metric-label">Inventory</div><div class="metric-value">'+files.length+'</div><div class="metric-sub">'+directories+' directories retained</div></div><div class="metric"><div class="metric-label">Parsed dataset</div><div class="metric-value">'+(sum.measurementCount||e.measurements.length)+'</div><div class="metric-sub">'+e.samples.length+' samples · '+recoveries+' recoveries</div></div><div class="metric"><div class="metric-label">Review status</div><div class="metric-value">'+(sum.findingCount||0)+'</div><div class="metric-sub">'+(sum.blockedCount||0)+' safety-stopped measurements</div></div></div>'+
      '<section class="panel import-receipt"><div class="panel-head"><div><h2 class="h2">Local import receipt</h2><div class="meta">What LabFlow received and how it produced the current view.</div></div><div class="spacer"></div>'+shell.badge('RAW preserved','success')+'</div><div class="panel-body import-receipt-body"><div class="import-path" aria-label="Deterministic import stages"><div class="import-stage done"><span>1</span><div><strong>Read archive</strong><small>Browser memory</small></div></div><div class="import-stage done"><span>2</span><div><strong>Inventory files</strong><small>'+files.length+' entries classified</small></div></div><div class="import-stage done"><span>3</span><div><strong>Parse evidence</strong><small>Local deterministic rules</small></div></div><div class="import-stage done"><span>4</span><div><strong>Build working view</strong><small>RAW unchanged</small></div></div></div><dl class="import-facts"><div><dt>Imported</dt><dd>'+C.escapeHtml(importTimestamp(e.meta.createdAt))+'</dd></div><div><dt>Source modified</dt><dd>'+C.escapeHtml(importTimestamp(e.meta.sourceModifiedAt))+'</dd></div><div><dt>Method</dt><dd>'+C.escapeHtml(e.meta.importMethod||'Local browser import')+'</dd></div><div><dt>AI calls</dt><dd>None</dd></div></dl></div></section>'+
      '<section class="panel"><div class="panel-head"><div><h2 class="h2">Archive overview</h2><div class="meta">File families detected from paths and known format markers.</div></div><div class="spacer"></div>'+shell.badge('deterministic','info')+'</div><div class="panel-body import-family-grid">'+importFamilyItem('Summary',families.summary,'FW, RV or general tables')+importFamilyItem('JV',families.jv,'measurements and curves')+importFamilyItem('Parameters',families.parameters,'acquisition evidence')+importFamilyItem('Tracking',families.tracking,'time-series evidence')+importFamilyItem('Other',families.other,'retained in manifest')+'</div></section>'+
      '<div class="notice info upload-notice"><strong>Next step: Review.</strong> LabFlow opened Review automatically after import. This page remains the source receipt; use it to inspect what entered the workflow or replace the archive.</div>'+
      '<details class="panel compact-details"><summary class="panel-head"><strong>RAW manifest</strong><span class="meta">'+files.length+' files · optional detail</span></summary><div class="panel-body file-tree">'+tree+(e.manifest.length>220?'<div class="muted">… '+(e.manifest.length-220)+' more entries</div>':'')+'</div></details></section>';
  }

  LF.ImportPage = { render: render };
})();