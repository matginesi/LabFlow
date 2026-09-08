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

  function receipt(exp) {
    const e=exp||LF.State.state.experiment;
    if(!e||!(e.meta&&e.meta.sourceName))return'';
    const sum=e.analysis&&e.analysis.summary||{},files=(e.manifest||[]).filter(function(x){return !x.directory;}),directories=(e.manifest||[]).length-files.length;
    const families=importFamilyCounts(e.manifest||[]),recoveries=(e.measurements||[]).reduce(function(total,m){return total+(m.recoveries||[]).length;},0),pipeline=e.pipeline||{},validation=pipeline.validation||{};
    const tree=(e.manifest||[]).filter(function(x){return !x.directory;}).slice(0,160).map(function(x){return '<div>'+C.escapeHtml(x.path)+' <span class="muted">['+C.escapeHtml(x.type)+']</span></div>';}).join('');
    return '<details class="panel compact-details upload-review-source"><summary class="panel-head"><div><span class="eyebrow">SOURCE ARCHIVE</span><strong>'+C.escapeHtml(e.meta.sourceName)+'</strong><div class="meta">'+C.bytes(e.meta.sourceSize)+' · '+files.length+' files · imported '+C.escapeHtml(importTimestamp(e.meta.createdAt))+'</div></div><div class="spacer"></div><span class="badge success">RAW preserved</span></summary><div class="panel-body stack"><div class="row-actions upload-review-source-actions"><button type="button" class="button compact" data-open-dataset>Replace ZIP</button></div><div class="metric-grid compact-metrics"><div class="metric"><div class="metric-label">Structure</div><div class="metric-value">'+(sum.experimentCount||(e.experiments||[]).length)+'</div><div class="metric-sub">experiments · '+(e.samples||[]).length+' samples · '+(sum.runCount||(e.runs||[]).length)+' runs</div></div><div class="metric"><div class="metric-label">Measurements</div><div class="metric-value">'+(sum.measurementCount||(e.measurements||[]).length)+'</div><div class="metric-sub">'+recoveries+' recoveries · '+files.length+' source files</div></div><div class="metric"><div class="metric-label">Pipeline</div><div class="metric-value metric-value-text">'+C.escapeHtml(pipeline.status||'ready')+'</div><div class="metric-sub">'+C.escapeHtml(validation.ok===false?'contract invalid':((pipeline.plan||[]).length+' deterministic stages · '+((validation.warnings||[]).length)+' warning(s)'))+'</div></div></div><div class="import-family-grid">'+importFamilyItem('Summary',families.summary,'FW, RV or general tables')+importFamilyItem('JV',families.jv,'measurements and curves')+importFamilyItem('Parameters',families.parameters,'acquisition evidence')+importFamilyItem('Tracking',families.tracking,'time-series evidence')+importFamilyItem('Other',families.other,'retained in manifest')+'</div><details class="compact-details"><summary>RAW manifest · '+files.length+' files</summary><div class="file-tree upload-review-manifest">'+tree+((e.manifest||[]).length>160?'<div class="muted">… '+((e.manifest||[]).length-160)+' more entries</div>':'')+'</div></details></div></details>';
  }

  function render(state, deps) {
    const d=deps||{},S=d.S||LF.State,shell=d.PageShell||LF.PageShell;
    if(!shell.hasExperiment())return shell.needExperiment();
    return LF.ReviewPanel.render({merged:true});
  }

  LF.ImportPage = { render: render, receipt: receipt };
})();