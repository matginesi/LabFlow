'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/core.js');
require('../../assets/js/data/analysis.js');
require('../../assets/js/data/analysis-summary.js');
require('../../assets/js/report/report.js');
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
  return t;
};
