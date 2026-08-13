'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/core.js');
require('../../assets/js/ai/prompt-bundle.js');
require('../../assets/js/experiment/data-model.js');
require('../../assets/js/data/parser.js');
require('../../assets/js/data/importer.js');
require('../../assets/js/data/analysis.js');
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
  };

  t['real 2026_01_22 Compare renders group controls, boxplot and statistics'] = async function(){
    await ready('boxplots');const html=LF.ResultsPage.render();
    truthy(html.indexOf('id="boxCanvas"')>=0,'boxplot SVG');
    truthy(html.indexOf('Comparison statistics')>=0,'stats table');
    truthy(html.indexOf('data-box-group=')>=0,'group selectors');
    truthy(html.indexOf('boxSelectAll')>=0&&html.indexOf('boxClearGroups')>=0,'selection controls');
  };
  return t;
};
