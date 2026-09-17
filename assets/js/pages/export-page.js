/*
 * Render NOMAD-first export workflow with on-demand projection inspection.
 * Boundary: Export presentation and projection overrides never mutate canonical scientific truth.
 */
(function(){
'use strict';
const LF=window.LabFlow=window.LabFlow||{},C=LF.Core,S=LF.State,PS=LF.PageShell;
function safe(v){return C.escapeHtml(String(v==null?'':v));}
function statusTone(status){return status==='ready'?'success':status==='blocked'?'danger':'warning';}
function actionState(id){
  return LF.ActionCapabilities&&LF.ActionCapabilities.evaluate
    ?LF.ActionCapabilities.evaluate(id):{available:true,reason:''};
}
function sourceBadge(source){
  source=String(source||'MISSING').toUpperCase();
  const tone=source==='OVERRIDE'?'warning':source==='EXPERIMENT'?'success':
    source==='MISSING'?'danger':source==='CABINET'?'info':'';
  return PS.badge(source,tone);
}
function fixControls(fix){
  if(!fix)return'';
  const label=safe(fix.label||'Resolve');
  if(fix.kind==='focus'){
    return '<button class="button compact" type="button" data-export-focus="'+
      safe(fix.target||'issues')+'">'+label+'</button>';
  }
  if(fix.kind==='route'){
    return '<button class="button compact" type="button" data-route="'+safe(fix.route)+'">'+label+'</button>';
  }
  if(fix.kind==='action'){
    const a=actionState(fix.action);
    return a.available
      ?'<button class="button primary compact" type="button" data-action="'+safe(fix.action)+'">'+label+'</button>'
      :'<span class="meta export-fix-note">'+safe(a.reason||'AI resolution is not applicable.')+'</span>';
  }
  if(fix.kind==='review_or_action'){
    const a=actionState(fix.action);
    return '<div class="row-wrap">'+
      (a.available?'<button class="button primary compact" type="button" data-action="'+
        safe(fix.action)+'">Resolve with AI</button>':'')+
      '<button class="button compact" type="button" data-route="'+safe(fix.route)+'">Review data</button>'+
      (a.available?'':'<span class="meta export-fix-note">AI is not applicable: '+safe(a.reason||'no active ambiguity')+'</span>')+
      '</div>';
  }
  if(fix.kind==='option'){
    return '<button class="button compact" type="button" data-export-option="'+safe(fix.option)+
      '" data-export-option-value="'+safe(String(fix.value))+'">'+label+'</button>';
  }
  if(fix.kind==='repair'){
    return '<button class="button compact" type="button" data-export-repair="'+safe(fix.id)+'">'+label+'</button>';
  }
  if(fix.kind==='refresh')return '<button class="button compact" type="button" data-export-refresh>'+label+'</button>';
  return'';
}
function issueList(validation){
  const problems=Array.isArray(validation.problems)?validation.problems:[];
  if(!problems.length){
    return '<div class="export-readiness-ok"><strong>Local NOMAD checks passed</strong>'+
      '<span>The current LabFlow data can be staged for export.</span></div>';
  }
  return '<div class="export-issues">'+problems.map(function(p){
    return '<article class="export-issue '+(p.severity==='blocking'?'danger':'warning')+'">'+
      '<div class="export-issue-copy"><strong>'+(p.severity==='blocking'?'Blocks export':'Review')+'</strong>'+
      '<span>'+safe(p.message)+'</span></div>'+fixControls(p.fix)+'</article>';
  }).join('')+'</div>';
}
function mappingTable(plan){
  const rows=(plan.mappings||[]).map(function(m){
    return '<tr><td>'+PS.badge(m.status,m.status==='mapped'?'success':m.status==='missing'?'warning':'')+'</td>'+
      '<td class="mono">'+safe(m.labflow_path||'')+'</td><td class="mono">'+safe(m.nomad_path||'')+'</td>'+
      '<td>'+safe(m.value_summary||'')+'</td></tr>';
  }).join('');
  return '<div class="table-wrap export-mapping-table"><table class="data-table dense-table">'+
    '<thead><tr><th>Status</th><th>LabFlow field</th><th>NOMAD field</th><th>Current value</th></tr></thead>'+
    '<tbody>'+rows+'</tbody></table></div>';
}
function projectionField(field,editing){
  const value=LF.ExportProjections.display(field.value),missing=!value;
  const need=field.required?'<span class="projection-required">required</span>':
    field.recommended?'<span class="projection-recommended">recommended</span>':'';
  const editor=editing&&field.editable!==false
    ?'<textarea class="projection-input" rows="'+(Array.isArray(field.value)||value.length>70?'3':'2')+
      '" data-projection-input="'+safe(field.id)+'" aria-label="'+safe(field.label)+'">'+safe(value)+'</textarea>'
    :'<div class="projection-value '+(missing?'is-missing':'')+'">'+
      (missing?'— Not available —':safe(value).replace(/\n/g,'<br>'))+'</div>';
  return '<div class="projection-field" data-field-id="'+safe(field.id)+'">'+
    '<div class="projection-field-head"><strong>'+safe(field.label)+'</strong>'+
    '<span class="projection-field-meta">'+need+sourceBadge(field.source)+'</span></div>'+editor+
    (field.note?'<small>'+safe(field.note)+'</small>':'')+'</div>';
}
function projectionSections(projection,editing){
  return (projection.sections||[]).map(function(sec){
    const missing=sec.fields.filter(function(f){return !LF.ExportProjections.display(f.value);}).length;
    const summary=missing?missing+' missing':sec.fields.length+' fields';
    return '<details class="projection-section-details"><summary><span>'+safe(sec.name)+'</span>'+
      '<small>'+summary+'</small></summary><div class="projection-section-fields">'+
      sec.fields.map(function(f){return projectionField(f,editing);}).join('')+'</div></details>';
  }).join('');
}
function projectionDrawer(kind,projection){
  const editing=String(S.state.ui.exportProjectionEdit||'')===kind;
  const overrideCount=Object.keys(LF.ExportProjections.overrides(kind)||{}).length;
  const r=projection.readiness||{},tone=r.score>=90?'success':r.score>=70?'warning':'danger';
  const open=editing?' open':'';
  const editActions=editing
    ?'<button class="button primary compact" type="button" data-projection-save="'+kind+'">Save overrides</button>'+
      '<button class="button compact" type="button" data-projection-cancel="'+kind+'">Cancel</button>'
    :'<button class="button compact" type="button" data-projection-edit="'+kind+'">Edit projection</button>';
  const reset=overrideCount
    ?'<button class="button ghost compact" type="button" data-projection-reset="'+kind+'">Reset '+overrideCount+
      ' override'+(overrideCount===1?'':'s')+'</button>':'';
  const exportActions=kind==='nomad'
    ?'<button class="button compact" type="button" data-projection-download="nomad" data-projection-format="json">JSON</button>'+
      '<button class="button compact" type="button" data-projection-download="nomad" data-projection-format="yaml">YAML</button>'
    :'<button class="button compact" type="button" data-projection-download="readypv" data-projection-format="json">JSON</button>'+
      '<button class="button compact" type="button" data-projection-copy="readypv" data-projection-format="text">Copy answers</button>';
  const missing=Number(r.requiredMissing||0)+Number(r.recommendedMissing||0);
  const summary=missing?missing+' fields need attention':'projection complete';
  const previewFormat=kind==='nomad'?'json':'text';
  const preview=LF.ExportProjections.serialize(kind,S.state.experiment,previewFormat).slice(0,12000);
  return '<details class="panel projection-drawer" data-projection-kind="'+kind+'"'+open+'><summary>'+ 
    '<div><span class="eyebrow">'+safe(projection.title)+'</span><strong>'+safe(projection.subtitle)+'</strong>'+ 
    '<small>'+safe(summary)+'</small></div><span class="projection-drawer-score status-'+tone+'">'+
    Number(r.score||0)+'%</span></summary><div class="projection-drawer-body">'+
    '<div class="projection-toolbar"><div class="row-wrap">'+editActions+reset+'</div><div class="row-wrap">'+
    exportActions+'</div></div>'+projectionSections(projection,editing)+
    '<details class="projection-preview"><summary>Machine-readable preview</summary><pre>'+safe(preview)+'</pre></details>'+ 
    '</div></details>';
}
function projectionWorkbench(exp){
  if(!LF.ExportProjections)return'';
  const nomad=LF.ExportProjections.nomad(exp),readypv=LF.ExportProjections.readyPv(exp);
  return '<section class="export-data-drawers"><div class="export-data-drawers-head"><div>'+ 
    '<span class="eyebrow">Inspect or override</span><h2 class="h2">Export data views</h2>'+ 
    '<div class="meta">Closed by default. Open only the projection you need to inspect or edit.</div></div>'+ 
    '<button class="button compact" type="button" data-export-refresh>Refresh</button></div>'+ 
    '<div class="export-data-drawer-grid">'+projectionDrawer('nomad',nomad)+projectionDrawer('readypv',readypv)+'</div>'+ 
    '</section>';
}
function preparationProposal(exp){
  if(!LF.ActionData)return'';
  const proposal=LF.ActionData.proposal(exp,'export.prepare','');
  if(!proposal)return'';
  const suggestions=Array.isArray(proposal.suggestions)?proposal.suggestions:[];
  const unresolved=Array.isArray(proposal.unresolved)?proposal.unresolved:[];
  const applied=!!proposal.applied;
  const rows=suggestions.map(function(item){
    const pct=Math.round(Math.max(0,Math.min(1,Number(item.confidence)||0))*100);
    return '<tr><td>'+safe(item.projection==='nomad'?'NOMAD':'Ready-PV')+'</td><td class="mono">'+
      safe(item.field_id)+'</td><td>'+safe(LF.ExportProjections.display(item.value))+'</td><td>'+ 
      safe(item.source_kind||'')+' · '+pct+'%</td></tr>';
  }).join('');
  return '<section class="export-ai-proposal"><div class="export-ai-proposal-head"><div>'+ 
    '<strong>AI metadata preparation</strong><span>'+safe(proposal.summary||'Review the export-only suggestions.')+'</span>'+ 
    '</div>'+PS.badge(applied?'applied':suggestions.length+' suggestions',applied?'success':'info')+'</div>'+ 
    (suggestions.length?'<div class="row-wrap">'+
      (applied?'':'<button class="button primary compact" type="button" data-export-apply-preparation>Apply export overrides</button>')+
      '<button class="button ghost compact" type="button" data-export-discard-preparation>Discard</button></div>':'')+
    '<details><summary>Review suggestions <small>'+suggestions.length+' proposed · '+unresolved.length+' unresolved</small></summary>'+ 
    (rows?'<div class="table-wrap"><table class="data-table dense-table"><thead><tr><th>Target</th><th>Field</th>'+ 
      '<th>Proposed value</th><th>Basis</th></tr></thead><tbody>'+rows+'</tbody></table></div>':
      '<div class="notice info compact-notice">No evidence-backed override was proposed.</div>')+
    '</details></section>';
}
function remediation(exp,validation){
  const audit=validation.audit||{},danger=audit.unresolvedDanger||[],incomplete=audit.incompletePatches||[];
  const focus=String(S.state.ui.exportFocus||''),openDanger=focus==='danger-findings'?' open':'',
    openProv=focus==='patch-provenance'?' open':'';
  if(!danger.length&&!incomplete.length)return'';
  const dangerRows=danger.slice(0,80).map(function(f){
    const id=String(f.measurementId||f.target||'');
    const m=(exp.measurements||[]).find(function(x){return String(x.id)===id;});
    const canExclude=!!m&&!m.excluded;
    return '<article class="export-remediation-row"><div><strong>'+safe(f.title||f.type||'Blocking finding')+'</strong>'+ 
      '<span>'+safe(f.detail||'This finding affects export readiness.')+'</span><small class="mono">'+safe(id||'dataset')+'</small>'+ 
      '</div><div class="row-wrap">'+(canExclude?'<button class="button compact" type="button" data-local-fix="exclude" '+
      'data-measurement-id="'+safe(m.id)+'">Exclude measurement</button>':'')+'</div></article>';
  }).join('');
  const provRows=incomplete.slice(0,40).map(function(p){
    return '<tr><td class="mono">'+safe(p.id||'—')+'</td><td>'+safe(p.patchType||'patch')+'</td><td>'+ 
      safe(p.reason||'Missing')+'</td><td>'+safe((p.evidence||[]).length?'present':'missing')+'</td></tr>';
  }).join('');
  return '<section class="panel export-remediation"><div class="panel-head"><div><span class="eyebrow">Resolve blockers</span>'+ 
    '<h2 class="h2">NOMAD readiness issues</h2></div></div><div class="panel-body stack">'+
    (danger.length?'<details id="exportDangerFindings"'+openDanger+'><summary><strong>'+danger.length+' blocking finding'+
      (danger.length===1?'':'s')+'</strong><small>Review before publication.</small></summary>'+ 
      '<div class="export-remediation-list">'+dangerRows+'</div></details>':'')+
    (incomplete.length?'<details id="exportPatchProvenance"'+openProv+'><summary><strong>'+incomplete.length+
      ' incomplete change record'+(incomplete.length===1?'':'s')+'</strong><small>Repair missing provenance.</small></summary>'+ 
      '<div class="row-wrap export-remediation-actions"><button class="button" type="button" '+
      'data-export-repair="complete-provenance">Repair change details</button></div><div class="table-wrap">'+
      '<table class="data-table dense-table"><thead><tr><th>Change</th><th>Type</th><th>Reason</th><th>Evidence</th>'+ 
      '</tr></thead><tbody>'+provRows+'</tbody></table></div></details>':'')+'</div></section>';
}
function nomadMission(exp,settings,validation,plan){
  const blocked=validation.status==='blocked';
  const problems=validation.problems||[];
  const blocking=problems.filter(function(x){return x.severity==='blocking';}).length;
  const mapped=(plan.mappings||[]).filter(function(x){return x.status==='mapped';}).length;
  const missing=(plan.mappings||[]).filter(function(x){return x.status==='missing';}).length;
  const prep=actionState('export.prepare');
  const status=validation.status==='ready'?'Ready for staging':validation.status==='review'?'Ready with warnings':'Needs attention';
  const next=blocked?'Resolve the blocking issues before creating the NOMAD package.':
    'Create the NOMAD package, inspect it if needed, then upload it to your NOMAD instance.';
  return '<section class="panel export-nomad-mission" id="nomadReadiness"><div class="panel-head"><div>'+ 
    '<span class="eyebrow">Primary workflow</span><h2 class="h2">Prepare for NOMAD</h2>'+ 
    '<div class="meta">'+safe(next)+'</div></div><div class="spacer"></div>'+ 
    PS.badge(validation.status,statusTone(validation.status))+'</div><div class="panel-body stack">'+ 
    '<div class="export-mission-status"><div><strong>'+safe(status)+'</strong><span>'+mapped+' mapped · '+missing+ 
    ' missing · '+blocking+' blocking</span></div><div class="export-nomad-actions">'+ 
    '<button type="button" class="button primary" id="exportNomadZip" '+(blocked?'disabled':'')+'>Export NOMAD package</button>'+ 
    '<button type="button" class="button" id="exportNomadEntry" '+(blocked?'disabled':'')+'>Entry YAML</button></div></div>'+ 
    '<div class="export-mission-ai"><div><strong>Metadata preparation</strong><span>'+ 
    (prep.available?'Use the export Action to fill only evidence-backed missing metadata as reviewable overrides.':safe(prep.reason))+
    '</span></div>'+(prep.available?'<button class="button compact" type="button" data-action="export.prepare">Prepare metadata with AI</button>':'')+
    '</div>'+preparationProposal(exp)+issueList(validation)+
    '<details class="export-options-details"><summary>Package options <small>'+(settings.includeRaw?'RAW':'no RAW')+' · '+ 
    (settings.includeDerived?'analysis tables':'no analysis tables')+'</small></summary><div class="export-option-grid">'+
    '<label class="export-option"><input type="checkbox" id="nomadRaw" '+(settings.includeRaw?'checked':'')+'><span>'+ 
    '<strong>Include RAW source</strong><small>Include the original source ZIP.</small></span></label>'+ 
    '<label class="export-option"><input type="checkbox" id="nomadDerived" '+(settings.includeDerived?'checked':'')+'><span>'+ 
    '<strong>Include analysis tables</strong><small>Include deterministic LabFlow tables.</small></span></label>'+ 
    '<button class="button compact" type="button" id="saveExportOptions">Apply options</button></div></details>'+ 
    '<details class="export-mapping-details"><summary><span>Mapping details</span><small>'+mapped+' mapped · '+missing+
    ' missing</small></summary>'+mappingTable(plan)+'</details></div></section>';
}
function secondaryTools(exp,nomadSettings,nomadToken){
  const patches=Number((exp.patches||[]).length);
  const sourceName=exp.meta&&exp.meta.sourceName||exp.raw&&exp.raw.sourceName||'Original source ZIP';
  const hasToken=!!String(nomadToken||'').trim();
  return '<section class="export-secondary-tools"><details class="panel export-tool-drawer"><summary><div>'+ 
    '<span class="eyebrow">Portable save</span><strong>LabFlow ZIP</strong><small>'+patches+' tracked changes · '+safe(sourceName)+
    '</small></div></summary><div class="export-tool-body"><p>Save the complete current LabFlow workspace locally.</p>'+ 
    '<button type="button" class="button" id="exportLabFlowZip">Export LabFlow ZIP</button></div></details>'+ 
    '<details class="panel export-tool-drawer"><summary><div><span class="eyebrow">NOMAD connection</span>'+ 
    '<strong>Direct upload</strong><small>'+(hasToken?'Credential configured':'Connector not active')+'</small></div></summary>'+ 
    '<div class="export-tool-body"><div class="notice info compact-notice"><strong>Local staging is active.</strong> '+ 
    'Direct browser upload is not implemented yet; no credential or data is sent from this control.</div>'+ 
    '<div class="row-wrap"><button type="button" class="button" id="openNomadSettings">NOMAD settings</button>'+ 
    '<button type="button" class="button primary" id="uploadNomadStub">Upload to NOMAD</button></div>'+ 
    '<small class="mono">'+safe(nomadSettings.apiEndpoint||'No API endpoint configured')+'</small></div></details></section>';
}
function render(){
  if(!PS.hasExperiment())return PS.needExperiment();
  const exp=PS.ensureExperimentShape(S.state.experiment),settings=LF.Storage.getExportSettings();
  const nomadSettings=LF.Storage.getNomadSettings();
  const nomadToken=LF.Storage.getNomadToken(nomadSettings.apiEndpoint);
  const plan=LF.NomadExport.ensureMapping(exp);
  const validation=LF.NomadExport.validate(exp,exp.raw&&exp.raw.sourceArchive);
  const projection=LF.ExportProjections?LF.ExportProjections.preparationContext(exp):null;
  if(LF.PageContext){
    LF.PageContext.publish('Export',{
      view:'NOMAD preparation',selected:{},filters:{includeRaw:!!settings.includeRaw,includeDerived:!!settings.includeDerived},
      visible:['nomad:'+validation.status,'nomad-missing:'+((projection&&projection.allowed_fields.nomad)||[]).length,
        'readypv-missing:'+((projection&&projection.allowed_fields.readypv)||[]).length]
    });
  }
  return '<section class="page export-page">'+PS.workflowHead('Export',
    'Prepare the current experiment for NOMAD first. Detailed NOMAD and Ready-PV data views stay closed until you need them.')+
    '<div class="export-summary-strip"><div><span>Experiment</span><strong>'+safe(exp.meta&&exp.meta.name||'Current experiment')+
    '</strong></div><div><span>NOMAD</span><strong class="status-'+statusTone(validation.status)+'">'+safe(validation.status)+
    '</strong></div><div><span>Mapped fields</span><strong>'+((plan.mappings||[]).filter(function(x){return x.status==='mapped';}).length)+
    ' / '+(plan.mappings||[]).length+'</strong></div></div>'+nomadMission(exp,settings,validation,plan)+
    remediation(exp,validation)+projectionWorkbench(exp)+secondaryTools(exp,nomadSettings,nomadToken)+'</section>';
}
LF.ExportPage={render:render};
}());
