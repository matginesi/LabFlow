'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/core.js');
require('../../assets/js/data/analysis.js');
require('../../assets/js/data/analysis-summary.js');
require('../../assets/js/report/report.js');
require('../../assets/js/ai/action-steps.js');
function assert(actual,expected,label){if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error((label||'assert')+': expected '+JSON.stringify(expected)+' got '+JSON.stringify(actual));}
/* Figure builders rasterize to canvas; provide a deterministic DOM/canvas stub for Node. */
if (typeof document === 'undefined') {
  global.document = {
    createElement: function (tag) {
      const ctx = new Proxy({}, { get: function () { return function () {}; }, set: function () { return true; } });
      return { width: 0, height: 0, getContext: function () { return ctx; }, toDataURL: function () { return 'data:image/png;base64,' + String(tag || 'canvas').toUpperCase(); } };
    }
  };
}
module.exports=function(t,LF){
  LF.PromptRegistry={effectiveRules:function(){return{
    metric_ranges:{ff:{min:0,max:1,severity:'warning'},efficiency:{min:0,max:100,severity:'warning'},voc:{min:0,max:2,severity:'warning'},jsc_abs:{max:100,severity:'warning'}},
    pair_checks:{hysteresis_abs_warning:.3,jsc_difference_percent_warning:50,efficiency_difference_percent_warning:50},
    ranking:{exclude_danger_findings:true,require_finite_efficiency:true}
  };}};
  LF.Storage={getUserProfile:function(){return{};}};
  function exp(){return{meta:{name:'Demo',sourceName:'demo.zip'},design:{solutions:[],devices:[],stack:[]},analysis:{summary:{},bestBySample:[]},findings:[],samples:[],measurements:[],report:{kind:'lab',labMarkdown:'# Old',labUpdatedAt:'set',paperMarkdown:'# Paper',paperUpdatedAt:'set',figureSelection:{pceDistribution:false,hysteresisDistribution:false,bestJvmCurve:false,efficiencyHysteresis:false,topEfficiency:false,groupComparison:false}}};}
  function expWithData(){
    return { id:'exp', meta:{name:'Demo',sourceName:'demo.zip'}, sync:{revision:1}, analysisSettings:{mismatchFactor:1}, samples:[{id:'s1',name:'DEVICE A'},{id:'s2',name:'DEVICE B'}],
      measurements:[
        { id:'m1', file:'a.txt', sample:'DEVICE A', group:'A', isRef:false, fw:{voc:1,jsc:20,ff:.7,eff:20}, rv:{voc:1,jsc:20,ff:.7,eff:20}, bestEff:20, hysteresis:.05, curve:{fw:[{x:0,y:0},{x:1,y:1}],rv:[]} },
        { id:'m2', file:'b.txt', sample:'DEVICE B', group:'A', isRef:false, fw:{voc:1,jsc:20,ff:.7,eff:22}, rv:{voc:1,jsc:20,ff:.7,eff:22}, bestEff:22, hysteresis:.03, curve:{fw:[],rv:[{x:0,y:0},{x:1,y:1}]} }
      ], findings:[], files:[], manifest:[], patches:[], analysis:{summary:{},bestBySample:[],topNonRef:[],topRef:[]}, design:{solutions:[],devices:[],stack:[]}, report:{kind:'lab',labMarkdown:'# Lab',labUpdatedAt:'set',paperMarkdown:'# Paper',paperUpdatedAt:'set'} };
  }
  t['fresh report documents start empty until the researcher drafts or writes'] = function(){const e={meta:{name:'Demo',sourceName:'demo.zip'},design:{solutions:[],devices:[],stack:[]},analysis:{summary:{},bestBySample:[]},findings:[],samples:[],measurements:[],report:{}};const r=LF.Report.ensureReport(e);assert(r.labMarkdown,'','lab starts empty');assert(r.paperMarkdown,'','paper starts empty');assert(LF.Report.activeMarkdown(e),'','active source starts empty');};
  t['active document can be replaced directly'] = function(){const e=exp();LF.Report.setActiveMarkdown(e,'# New');assert(LF.Report.activeMarkdown(e),'# New','new text');};
  t['report model uses the current editor Markdown as its exact text source'] = function(){const e=exp();LF.Report.setActiveMarkdown(e,'# Editor source\n\nOnly this text.');const model=LF.Report.reportModel(e);assert(model.markdown,'# Editor source\n\nOnly this text.','model markdown');assert(model.figures.length,0,'disabled figures stay out');};
  t['paper and laboratory documents remain separate'] = function(){const e=exp();LF.Report.setKind(e,'paper');LF.Report.setActiveMarkdown(e,'# Changed paper');LF.Report.setKind(e,'lab');assert(LF.Report.activeMarkdown(e),'# Old','lab kept');LF.Report.setKind(e,'paper');assert(LF.Report.activeMarkdown(e),'# Changed paper','paper kept');};

  t['report and paper keep independent figure selections'] = function(){const e=expWithData();LF.Report.setKind(e,'lab');LF.Report.setFigure(e,'pceDistribution',false);LF.Report.setKind(e,'paper');assert(LF.Report.figureSelection(e,'paper').pceDistribution,true,'paper keeps default');LF.Report.setFigure(e,'hysteresisDistribution',false);assert(LF.Report.figureSelection(e,'lab').hysteresisDistribution,true,'lab unaffected by paper');assert(LF.Report.figureSelection(e,'lab').pceDistribution,false,'lab choice retained');};
  t['manual and AI document edits are attributed separately'] = function(){const e=exp();LF.Report.setActiveMarkdown(e,'# Manual');LF.Report.setActiveMarkdown(e,'# AI','ai');assert(e.documentEdits.length,2,'two edit sessions');assert(e.documentEdits[0].source,'user','manual source');assert(e.documentEdits[1].source,'ai','ai source');};
  t['figure previews are memoized and shared with reportModel'] = function(){
    const e=expWithData();LF.Analysis.analyze(e);
    const p1=LF.Report.reportFigurePreviews(e),p2=LF.Report.reportFigurePreviews(e);
    assert(p1===p2,true,'second call returns the cached array');
    const model=LF.Report.reportModel(e);
    assert(model.figures===p1,true,'reportModel figures share the preview cache');
    assert(p1.length>0,true,'figures generated for a dataset with values');
    assert(p1.every(function(f){return f.dataUrl;}),true,'every figure carries a dataUrl');
  };
  t['fresh bundle statistics equal measurement-computed statistics'] = function(){
    const legacy=expWithData();LF.Analysis.analyze(legacy);
    const fresh=expWithData();LF.Analysis.analyze(fresh);fresh.analysisSummary=LF.AnalysisSummary.collect(fresh);
    assert(LF.AnalysisSummary.fresh(fresh),true,'bundle fresh after store');
    const lm=LF.Report.reportModel(legacy),fm=LF.Report.reportModel(fresh);
    assert(fm.statistics.effRV.median,lm.statistics.effRV.median,'bundle == legacy effRV median');
    assert(fm.statistics.effFW.median,lm.statistics.effFW.median,'bundle == legacy effFW median');
    assert(fm.statistics.hysteresisAbsPct.median,lm.statistics.hysteresisAbsPct.median,'bundle == legacy hysteresis median');
    assert(fm.statistics.effRV.std,lm.statistics.effRV.std,'bundle == legacy effRV std');
  };
  t['bundle groupStatistics carry the vendor median fields from scans'] = function(){
    const e=expWithData();LF.Analysis.analyze(e);e.analysisSummary=LF.AnalysisSummary.collect(e);
    const m=LF.Report.reportModel(e);
    const g=(m.groupStatistics||[])[0];
    assert(g && typeof g.name,'string','group present');
    assert(g.medianEff,g.scans.rv.median,'medianEff from scans.rv median');
    assert(g.minEff,g.scans.rv.min,'minEff from scans.rv min');
    assert(g.maxEff,g.scans.rv.max,'maxEff from scans.rv max');
    assert(g.medianVoc,1,'medianVoc still resolved for the vendor');
  };

  t['Paper draft work units carry substantive word targets for adaptive output budgets']=function(){
    const e=expWithData();
    for(let i=0;i<70;i++)e.measurements.push(Object.assign({},e.measurements[0],{id:'extra'+i,sample:'DEVICE A'}));
    const out=LF.ActionSteps['report.collect-draft-blocks']({exp:e,params:{document_kind:'paper'}});
    const discussion=(out.blocks||[]).find(function(x){return x.id==='discussion';});
    assert(!!discussion,true,'discussion block exists');
    assert(discussion.target_words>=1000,true,'discussion gets substantive target');
    assert(discussion.min_words<discussion.target_words&&discussion.max_words>discussion.target_words,true,'word target has useful range');
  };

  t['Report AI block storage restores expected heading levels and titles']=function(){
    const e=exp();
    const collected={kind:'lab',blocks:[{headings:['# Laboratory report']},{headings:['## Results']},{headings:['### Interpretation']}]};
    LF.ActionSteps['report.store-draft-blocks']({exp:e,params:{document_kind:'lab'},outputs:{collect:collected,draft:['### Wrong title\n\nIntro.','# Another wrong heading\n\nMeasured data.','## Wrong interpretation\n\nMeaning.']}});
    const md=LF.Report.activeMarkdown(e);
    assert(md.includes('# Laboratory report\n\nIntro.'),true,'document heading normalized');
    assert(md.includes('## Results\n\nMeasured data.'),true,'section heading normalized');
    assert(md.includes('### Interpretation\n\nMeaning.'),true,'subheading normalized');
    assert(md.includes('Wrong title'),false,'provider heading text removed');
  };

  t['Report draft store accepts block arrays and legacy single-block output']=function(){
    const lab=exp(),paper=exp();
    let out=LF.ActionSteps['report.store-draft-blocks']({exp:lab,params:{document_kind:'lab'},outputs:{collect:{kind:'lab'},draft:['# Lab draft','## Results\n\nMeasured result.']}});
    assert(out.blocks,2,'array block count');
    assert(LF.Report.activeMarkdown(lab),'# Lab draft\n\n## Results\n\nMeasured result.\n','array blocks stored');
    out=LF.ActionSteps['report.store-draft-blocks']({exp:paper,params:{document_kind:'paper'},outputs:{collect:{kind:'paper'},draft:'# Paper draft\n\n## Abstract\n\nEvidence-backed abstract.'},lastResult:'# ignored fallback'});
    assert(out.blocks,1,'single block count');
    assert(LF.Report.documentInfo(paper).kind,'paper','paper remains active');
    assert(LF.Report.activeMarkdown(paper),'# Paper draft\n\n## Abstract\n\nEvidence-backed abstract.\n','single block stored');
  };

  t['report Markdown preserves LaTeX in preview and TeX export'] = function(){
    const source='## Scan comparison\n\nInline $J_{SC}$ is retained.\n\n$$\n\\Delta \\mathrm{PCE} = \\frac{PCE_{RV}}{PCE_{FW}}\n$$';
    const html=LF.Core.markdown(source),tex=LF.Report.toLatex(source);
    assert(html.includes('math-inline'),true,'inline math protected in preview');assert(html.includes('math-display'),true,'display math protected in preview');
    assert(tex.includes('$J_{SC}$'),true,'inline LaTeX preserved');assert(tex.includes('\\frac{PCE_{RV}}{PCE_{FW}}'),true,'display formula preserved');assert(tex.includes('\\section{Scan comparison}'),true,'heading converted');
  };
  return t;
};
