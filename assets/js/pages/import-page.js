(function () {
  'use strict';

  const LF = window.LabFlow = window.LabFlow || {};
  const C = LF.Core;

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

  function importFamilyItem(label,count) {
    return '<div class="import-family"><span>'+C.escapeHtml(label)+'</span><strong>'+Number(count||0)+'</strong></div>';
  }

  function receipt(exp) {
    const e=exp||LF.State.state.experiment;
    if(!e||!(e.meta&&e.meta.sourceName))return'';
    const files=(e.manifest||[]).filter(function(x){return !x.directory;}),families=importFamilyCounts(e.manifest||[]);
    const tree=files.slice(0,160).map(function(x){return '<div>'+C.escapeHtml(x.path)+'</div>';}).join('');
    return '<section class="panel upload-source-card"><div class="upload-source-summary"><div class="upload-source-icon" aria-hidden="true"><span data-icon="package-check"></span></div><div class="upload-source-copy"><span class="eyebrow">Source archive</span><strong>'+C.escapeHtml(e.meta.sourceName)+'</strong><div class="meta">'+C.bytes(e.meta.sourceSize)+' · '+files.length+' files · imported '+C.escapeHtml(importTimestamp(e.meta.createdAt))+'</div></div><span class="badge success upload-source-preserved">Original preserved</span></div><details class="upload-source-details"><summary>Source details</summary><div class="panel-body stack"><div class="import-family-grid">'+importFamilyItem('Summary',families.summary)+importFamilyItem('JV',families.jv)+importFamilyItem('Parameters',families.parameters)+importFamilyItem('Tracking',families.tracking)+importFamilyItem('Other',families.other)+'</div><details class="compact-details"><summary>File list · '+files.length+'</summary><div class="file-tree upload-review-manifest">'+tree+(files.length>160?'<div class="muted">… '+(files.length-160)+' more files</div>':'')+'</div></details></div></details></section>';
  }

  function render(state, deps) {
    const d=deps||{},shell=d.PageShell||LF.PageShell;
    if(!shell.hasExperiment())return shell.needExperiment();
    return LF.ReviewPanel.render({merged:true});
  }

  LF.ImportPage = { render: render, receipt: receipt };
})();
