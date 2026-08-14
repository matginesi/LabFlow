'use strict';
const fs=require('fs'),path=require('path');
require('../../assets/js/logger.js');

function assert(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error((label||'assert')+': expected '+JSON.stringify(expected)+' got '+JSON.stringify(actual));
}

module.exports=function(t,LF){
  LF.Core=Object.assign(LF.Core||{},{fmt:function(v,d){return Number.isFinite(Number(v))?Number(v).toFixed(d==null?2:d):'—';},markdown:function(x){return String(x||'');},safeName:function(x){return String(x||'x');}});
  LF.State={state:{experiment:null}};
  LF.PageShell={hasExperiment:function(){return false;},needExperiment:function(){return '';},badge:function(x){return String(x);},workflowHead:function(){return '';}};
  require('../../assets/js/pages/results-page.js');

  t['Compare keeps ungrouped measurements selectable'] = function(){
    assert(LF.ResultsPage.groupName({group:''}),'Ungrouped','blank group');
    assert(LF.ResultsPage.groupName({group:null}),'Ungrouped','null group');
    assert(LF.ResultsPage.groupName({group:' A '}),'A','trim group');
  };

  t['quartiles retain raw values and identify whisker outliers'] = function(){
    const q=LF.ResultsPage.quartilesFull([1,2,2,3,100]);
    assert(q.n,5,'n');
    assert(q.med,2,'median');
    assert(q.outliers,[100],'outlier');
    assert(q.values,[1,2,2,3,100],'raw values');
  };

  t['JV Analyzer is a single-measurement diagnostic surface distinct from Overlay'] = function(){
    const source=fs.readFileSync(path.resolve(__dirname,'../../assets/js/pages/results-page.js'),'utf8');
    assert(source.includes('RAW scan integrity'),true,'analyzer diagnostics');
    assert(source.includes('FW / RV separation'),true,'scan separation diagnostics');
    assert(source.includes('curveOverlaySelection'),true,'overlay owns an independent selection set');
    assert(source.includes('data-curve-select'),true,'analyzer uses a single measurement selector');
  };
  return t;
};
