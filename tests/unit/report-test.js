'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/report/report.js');
function assert(actual,expected,label){if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error((label||'assert')+': expected '+JSON.stringify(expected)+' got '+JSON.stringify(actual));}
module.exports=function(t,LF){
  LF.Analysis={designOf:function(e){return e.design||{};},analysisOf:function(e){return e.analysis||{};},measurementsOf:function(e){return e.measurements||[];},findingsOf:function(e){return e.findings||[];},samplesOf:function(e){return e.samples||[];},settingsOf:function(){return 1;},manifestOf:function(e){return e.files||[];}};
  LF.PromptRegistry={effectiveRules:function(){return{pair_checks:{hysteresis_abs_warning:.3}};}};
  LF.Storage={getUserProfile:function(){return{};}};
  function exp(){return{meta:{name:'Demo',sourceName:'demo.zip'},design:{solutions:[],devices:[],stack:[]},analysis:{summary:{},bestBySample:[]},findings:[],samples:[],measurements:[],report:{kind:'lab',labMarkdown:'# Old',labUpdatedAt:'set',paperMarkdown:'# Paper',paperUpdatedAt:'set',figureSelection:{pceDistribution:false,hysteresisDistribution:false,bestJvmCurve:false,efficiencyHysteresis:false,topEfficiency:false,groupComparison:false}}};}
  t['active document can be replaced directly'] = function(){const e=exp();LF.Report.setActiveMarkdown(e,'# New');assert(LF.Report.activeMarkdown(e),'# New','new text');};
  t['report model uses the current editor Markdown as its exact text source'] = function(){const e=exp();LF.Report.setActiveMarkdown(e,'# Editor source\n\nOnly this text.');const model=LF.Report.reportModel(e);assert(model.markdown,'# Editor source\n\nOnly this text.','model markdown');assert(model.figures.length,0,'disabled figures stay out');};
  t['paper and laboratory documents remain separate'] = function(){const e=exp();LF.Report.setKind(e,'paper');LF.Report.setActiveMarkdown(e,'# Changed paper');LF.Report.setKind(e,'lab');assert(LF.Report.activeMarkdown(e),'# Old','lab kept');LF.Report.setKind(e,'paper');assert(LF.Report.activeMarkdown(e),'# Changed paper','paper kept');};
  return t;
};
