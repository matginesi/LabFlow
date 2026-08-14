
'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/core.js');
require('../../assets/js/report/report.js');
require('../../assets/js/pages/changes-page.js');
function assert(actual,expected,label){if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error((label||'assert')+': expected '+JSON.stringify(expected)+' got '+JSON.stringify(actual));}
module.exports=function(t,LF){
  LF.Storage={getUserProfile:function(){return{};}};
  function exp(){return{id:'e',meta:{name:'Demo',sourceName:'demo.zip'},sync:{revision:0},measurements:[],interpretationOverrides:{},analysisSettings:{mismatchFactor:1},design:{solutions:[],devices:[],status:'unknown'},report:{kind:'lab',labMarkdown:'# Baseline',paperMarkdown:'# Paper'}};}
  t['manual report text differs from import baseline immediately'] = function(){const e=exp();LF.Changes.captureBaseline(e);LF.Report.setActiveMarkdown(e,'# Baseline\n\nManual sentence.');const changes=LF.Changes.compute(e),doc=changes.find(function(x){return x.text&&x.kind==='lab';});assert(!!doc,true,'lab text diff exists');assert(doc.after.indexOf('Manual sentence.')>=0,true,'current manual text compared');assert(e.documentEdits[0].source,'user','manual provenance');};
  t['paper figure choice is audited independently from report choice'] = function(){const e=exp();LF.Changes.captureBaseline(e);LF.Report.setFigure(e,'pceDistribution',false,'paper');const changes=LF.Changes.compute(e);assert(changes.some(function(x){return x.path==='figures.paper.pceDistribution';}),true,'paper figure diff');assert(changes.some(function(x){return x.path==='figures.lab.pceDistribution';}),false,'lab figure unchanged');};
  t['legacy baseline migration does not invent figure changes'] = function(){const e=exp();LF.Changes.captureBaseline(e);delete e.changeBaseline.report.figures;e.changeBaseline.version=2;LF.Changes.ensureBaseline(e);const changes=LF.Changes.compute(e).filter(function(x){return /^figures\./.test(x.path);});assert(changes.length,0,'legacy baseline adopts current figure state once');};
  t['large document diff is bounded'] = function(){const a=Array.from({length:1000},function(_,i){return'a '+i;}).join('\n'),b=Array.from({length:1000},function(_,i){return'b '+i;}).join('\n'),d=LF.Changes.lineDiff(a,b);assert(d.length<370,true,'bounded diff rows');assert(d.some(function(x){return x.kind==='skip';}),true,'hidden lines marker');};
  return t;
};
