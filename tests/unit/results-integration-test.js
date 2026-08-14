'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/core.js');
require('../../assets/js/ai/prompt-bundle.js');
require('../../assets/js/experiment/data-model.js');
require('../../assets/js/data/parser.js');
require('../../assets/js/data/importer.js');
require('../../assets/js/data/analysis.js');
require('../../assets/js/data/analysis-summary.js');
const fs=require('fs'),path=require('path');

function assert(actual, expected, label){if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error((label||'assert')+': expected '+JSON.stringify(expected)+' got '+JSON.stringify(actual));}
function truthy(value,label){if(!value)throw new Error((label||'assert')+': expected truthy');}

module.exports=function(t,LF,env){
  function fixture(){const b=fs.readFileSync(path.join(env.root,'TEST_DATA','2026_01_22.zip'));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}
  async function ready(tab){
    const exp=await LF.Importer.parseDataset(fixture(),'2026_01_22.zip');LF.Analysis.analyze(exp);
    LF.State={state:{experiment:exp,resultsTab:tab||'overview',boxPlot:{metric:'eff',direction:'both',groups:[],eligibleOnly:true,experimentId:null},curveSelection:[],curveView:'all',curveGroup:'all',curveDirection:'both',curveEligibleOnly:false,curveSearch:''}};
    LF.PageShell={hasExperiment:function(){return true;},needExperiment:function(){return'';},badge:function(text,kind){return'<span class="badge '+(kind||'')+'">'+LF.Core.escapeHtml(text)+'</span>';},workflowHead:function(){return'<header></header>';}};
    delete require.cache[require.resolve('../../assets/js/pages/results-page.js')];require('../../assets/js/pages/results-page.js');return exp;
  }

  t['real 2026_01_22 Results overview renders SVG charts without layout timing'] = async function(){
    const exp=await ready('overview'),html=LF.ResultsPage.render();
    truthy(exp.measurements.length>=70,'fixture measurements');
    truthy((html.match(/class="results-svg/g)||[]).length>=3,'overview SVG charts');
    assert(html.indexOf('<canvas'),-1,'no render-time canvas');
    truthy(html.indexOf('Top devices')>=0,'overview ranking table');
  };

  t['real 2026_01_22 measurement table keeps warnings readable and mobile-stackable'] = async function(){
    await ready('measurements');const html=LF.ResultsPage.render();
    truthy(html.indexOf('quality-col')>=0,'warning column');
    truthy(html.indexOf('stack-table')>=0,'mobile table mode');
    truthy(html.indexOf('data-label="Warnings"')>=0,'mobile warning label');
    truthy(html.indexOf('results-master-detail')>=0,'desktop master/detail layout');
    truthy(html.indexOf('result-inline-inspector')>=0,'inline measurement detail');
  };

  t['real 2026_01_22 JV Analyzer diagnoses one measurement instead of duplicating Overlay'] = async function(){
    await ready('curves');const html=LF.ResultsPage.render();
    truthy(html.indexOf('Select one JV scan')>=0,'single selector heading');
    truthy(html.indexOf('jv-analyzer-list')>=0,'single selector rail');
    truthy(html.indexOf('data-curve-select=')>=0,'single measurement controls');
    truthy(html.indexOf('RAW scan integrity')>=0,'raw integrity diagnostics');
    truthy(html.indexOf('FW / RV separation')>=0,'scan separation diagnostics');
    truthy(html.indexOf('id=\"curveCanvas\"')>=0,'curve chart');
    assert(html.indexOf('data-curve-check='),-1,'analyzer has no multi-select checkboxes');
  };

  t['real 2026_01_22 Compare renders group controls, boxplot and statistics'] = async function(){
    await ready('boxplots');const html=LF.ResultsPage.render();
    truthy(html.indexOf('id="boxCanvas"')>=0,'boxplot SVG');
    truthy(html.indexOf('Comparison statistics')>=0,'stats table');
    truthy(html.indexOf('data-box-group=')>=0,'group selectors');
    truthy(html.indexOf('boxSelectAll')>=0&&html.indexOf('boxClearGroups')>=0,'selection controls');
  };

  function synExp(){
    return {id:'syn',sync:{revision:0},analysisSettings:{mismatchFactor:2},measurements:[
      {id:'m1',sample:'A1',group:'A',excluded:false,rankingEligible:true,fw:{voc:1,jsc:40,ff:.8,eff:36},rv:{voc:1,jsc:40,ff:.8,eff:40}},
      {id:'m2',sample:'A2',group:'A',excluded:false,rankingEligible:true,fw:{voc:1,jsc:40,ff:.8,eff:38},rv:{voc:1,jsc:40,ff:.8,eff:44}},
      {id:'m3',sample:'B1',group:'B',excluded:false,rankingEligible:true,fw:{voc:1,jsc:40,ff:.8,eff:30},rv:{voc:1,jsc:40,ff:.8,eff:32}},
      {id:'m4',sample:'B2',group:'B',excluded:false,rankingEligible:true,fw:{voc:1,jsc:40,ff:.8,eff:28},rv:{voc:1,jsc:40,ff:.8,eff:30}}
    ],analysis:{summary:{}},findings:[]};
  }
  function stateFor(e){
    return {experiment:e,resultsTab:'boxplots',boxPlot:{metric:'eff',direction:'both',groups:['A','B'],eligibleOnly:true,experimentId:e.id},curveSelection:[],curveView:'all',curveGroup:'all',curveDirection:'both',curveEligibleOnly:false,curveSearch:''};
  }
  function boxState(state){LF.State={state:state||stateFor(synExp())};delete require.cache[require.resolve('../../assets/js/pages/results-page.js')];require('../../assets/js/pages/results-page.js');}

  t['compareData yields per-scan FW/RV medians for each group'] = function(){
    boxState();const data=LF.ResultsPage.compareData(LF.State.state.experiment);
    assert(data.length,2,'two groups');
    assert(data[0].name,'A','group A first');
    assert(data[0].stats.fw.med,18.5,'A FW median (eff/2)');
    assert(data[0].stats.rv.med,21,'A RV median');
    assert(data[1].stats.fw.med,14.5,'B FW median');
    assert(data[1].stats.rv.med,15.5,'B RV median');
    assert(data[0].count,4,'both scans counted');
  };

  t['boxSvg draws a side-by-side box group per scan direction'] = function(){
    boxState();const data=LF.ResultsPage.compareData(LF.State.state.experiment),html=LF.ResultsPage.boxSvg(data,'testBox');
    truthy((html.match(/data-direction="both"/g)||[]).length===2,'both groups render FW+RV boxes');
    truthy((html.match(/box-rect/g)||[]).length===4,'four boxes total (FW+RV per group)');
    truthy(html.indexOf('Forward (FW)')>=0&&html.indexOf('Reverse (RV)')>=0,'per-scan legend');
    truthy(html.indexOf('n=4')>=0,'compact per-group counts');
    truthy(html.indexOf('viewBox=\"0 0 560 238\"')>=0,'compact chart geometry');
  };

  t['Compare statistics reuse the fresh bundle as single source'] = function(){
    const e=synExp();e.analysisSummary=LF.AnalysisSummary.collect(e);boxState(stateFor(e));
    truthy(LF.AnalysisSummary.fresh(e),'bundle fresh');
    const html=LF.ResultsPage.render(),data=LF.ResultsPage.compareData(e);
    truthy(html.indexOf('18.500 ± 0.500')>=0,'bundle FW A median±IQR in table');
    truthy(html.indexOf('21.000 ± 1.000')>=0,'bundle RV A median±IQR in table');
    truthy(html.indexOf('FW median±IQR')>=0&&html.indexOf('RV min–max')>=0,'per-scan columns');
    assert(data[0].stats.fw.med,18.5,'compareData unchanged alongside bundle');
  };
  return t;
};
