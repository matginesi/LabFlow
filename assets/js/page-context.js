(function(){
  'use strict';
  const LF=window.LabFlow=window.LabFlow||{};
  function cleanText(v){return String(v==null?'':v).replace(/%%LF(?:MD|CODE)[^%]*%%/g,'').replace(/\u0000LF(?:MD|CODE)[^\u0000]*\u0000/g,'').trim();}
  function clone(v){try{return JSON.parse(JSON.stringify(v||{}));}catch(_){return{};}}
  function state(){return LF.State&&LF.State.state||null;}
  function uiState(){const s=state();return s&&s.ui?s.ui:null;}
  function clip(v,n){const s=cleanText(v);return s.length>(n||12000)?s.slice(0,n||12000)+'…':s;}
  function take(v,n){return(Array.isArray(v)?v:[]).slice(0,n);}
  function compact(v){
    if(v==null||typeof v==='number'||typeof v==='boolean')return v;
    if(typeof v==='string')return clip(v,1800);
    if(Array.isArray(v))return v.slice(0,40).map(compact);
    if(typeof v==='object'){const out={};Object.keys(v).slice(0,50).forEach(function(k){if(/^(rawText|sourceArchive|data|rows|curve|curves|points)$/i.test(k))return;out[k]=compact(v[k]);});return out;}
    return cleanText(v);
  }
  function publish(page,payload){const ui=uiState();if(!ui)return{};const ctx=Object.assign({page:String(page||''),view:'',selected:{},filters:{},visible:[],updatedAt:new Date().toISOString()},clone(payload));ctx.page=cleanText(ctx.page);ctx.view=cleanText(ctx.view);ui.pageContext=ctx;return ctx;}
  function clear(){const ui=uiState();if(ui)ui.pageContext={page:'',view:'',selected:{},filters:{},visible:[],updatedAt:new Date().toISOString()};}
  function linkedSolutions(exp,device){const ids=new Set(device&&device.solutionIds||[]);return(exp.design&&exp.design.solutions||[]).filter(function(s){return ids.has(s.id);});}
  function pageData(){
    const s=state(),exp=s&&s.experiment||{},route=s&&s.route||s&&s.ui&&s.ui.route||'';
    if(!exp||!exp.id)return{};
    if(route==='experiment-import'||route==='experiment-understand')return{experiment:{name:exp.meta&&exp.meta.name||'',source:exp.meta&&exp.meta.sourceName||'',files:(exp.files||[]).length,samples:(exp.samples||[]).length,measurements:(exp.measurements||[]).length},review:{findings:take(exp.findings,30).map(compact),open_findings:(exp.findings||[]).filter(function(f){return f.status!=='resolved';}).length,analysis:compact(exp.datasetAnalysis&&exp.datasetAnalysis.summary||exp.analysis&&exp.analysis.summary||{})}};
    if(route==='experiment-results'){
      const selected=(exp.measurements||[]).find(function(m){return String(m.id)===String(s.selectedMeasurementId||'');});
      return{tab:s.resultsTab||'overview',summary:compact(exp.analysis&&exp.analysis.summary||{}),top_non_ref:take(exp.analysis&&exp.analysis.topNonRef,8).map(compact),top_ref:take(exp.analysis&&exp.analysis.topRef,8).map(compact),selected_measurement:compact(selected||null),statistics:compact(exp.analysisSummary||null)};
    }
    if(route==='experiment-design'){
      const dev=(exp.design&&exp.design.devices||[]).find(function(d){return String(d.id)===String(s.selectedDesignDeviceId||'');})||(exp.design&&exp.design.devices||[])[0]||null;
      const proposals=exp.aiDesignProposals&&typeof exp.aiDesignProposals==='object'?exp.aiDesignProposals:{};
      return{selected_experiment:compact(dev),selected_solutions:dev?linkedSolutions(exp,dev).map(compact):[],selected_ai_suggestion:dev?compact(proposals[dev.id]||null):null,ai_status:dev?compact(exp.designAiStatus&&exp.designAiStatus[dev.id]||null):null,experiments:take(exp.design&&exp.design.devices,40).map(function(d){return{id:d.id,name:d.name||'',samples:take(d.sampleNames,12),solutions:linkedSolutions(exp,d).map(function(x){return{name:x.name,role:x.role,solutes:x.solutes,solvents:x.solvents};}),stack:take(d.stack,14).map(function(x){return{role:x.role,material:x.material,thickness:x.thickness};}),ai_status:compact(exp.designAiStatus&&exp.designAiStatus[d.id]||null),has_suggestion:!!proposals[d.id]};})};
    }
    if(route==='experiment-report'&&LF.Report){
      const info=LF.Report.documentInfo?LF.Report.documentInfo(exp):{kind:exp.report&&exp.report.activeKind||'lab',markdown:''};
      const selection=LF.Report.figureSelection?LF.Report.figureSelection(exp,info.kind):exp.report&&exp.report.figureSelection||{};
      return{document:{kind:info.kind,label:info.label||'',words:info.words||0,chars:info.chars||0,updated_at:info.updatedAt||'',markdown:clip(info.markdown||'',18000)},figures:compact(selection),report_data:LF.Report.reportContextData?compact(LF.Report.reportContextData(exp)):null};
    }
    if(route==='experiment-nomad'){
      const plan=exp.nomad&&exp.nomad.mappingPlan||{};
      return{readiness:plan.readiness||'',missing:take(plan.missing,30).map(compact),validation:compact(exp.nomad&&exp.nomad.validation||null),mapping_count:Array.isArray(plan.mappings)?plan.mappings.length:0};
    }
    if(route==='knowledge-base'&&LF.KnowledgeBase){const st=LF.KnowledgeBase.status?LF.KnowledgeBase.status():{};return{library:compact(st),records:(LF.KnowledgeBase.all?LF.KnowledgeBase.all():[]).slice(0,12).map(function(r){return{id:r.id,collection:r.collection,kind:r.kind,name:r.name,summary:clip(r.summary,280)};})};}
    if(route==='settings'&&LF.Storage){const ai=clone(LF.Storage.getAiSettings?LF.Storage.getAiSettings():{});delete ai.apiKey;delete ai.key;return{ai:compact(ai)};}
    if(route==='logs'&&LF.Logger&&LF.Logger.entries){const entries=LF.Logger.entries();return{entries:entries.length,recent:entries.slice(-20).map(compact)};}
    return{experiment:{name:exp.meta&&exp.meta.name||'',samples:(exp.samples||[]).length,measurements:(exp.measurements||[]).length}};
  }
  function snapshot(){const ui=uiState(),base=clone(ui&&ui.pageContext||{});base.data=pageData();base.updatedAt=new Date().toISOString();return base;}
  function summary(ctx){ctx=ctx||snapshot();const parts=[];if(ctx.page)parts.push(ctx.page);if(ctx.view)parts.push(ctx.view);const s=ctx.selected||{};['experiment','sample','measurement','group','finding','component','document','mapping'].forEach(function(k){if(s[k])parts.push(cleanText(s[k]));});return parts.filter(Boolean).join(' · ')||'Current page';}
  LF.PageContext={publish:publish,clear:clear,snapshot:snapshot,summary:summary,cleanText:cleanText,pageData:pageData};
}());
