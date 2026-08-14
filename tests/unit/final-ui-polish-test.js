'use strict';
const fs=require('fs'),path=require('path');
function assert(actual,expected,label){if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error((label||'assert')+': expected '+JSON.stringify(expected)+' got '+JSON.stringify(actual));}
module.exports=function(t){
  const root=path.resolve(__dirname,'../..');
  const results=fs.readFileSync(path.join(root,'assets/js/pages/results-page.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'assets/css/app.css'),'utf8');
  const settings=fs.readFileSync(path.join(root,'assets/js/ai/settings.js'),'utf8');
  const app=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

  t['PCE distribution has a compact diagnostic layout with bounded zoom']=function(){
    assert(results.includes('data-pce-zoom="in"'),true,'zoom in control');
    assert(results.includes('histogramStats'),true,'distribution statistics');
    assert(results.includes('chart-stat-median'),true,'median marker');
    assert(results.includes('S.state.pceDistributionZoom||1'),true,'zoom state');
    assert(css.includes('.overview-pce-panel'),true,'narrow PCE panel style');
  };

  t['Action checklist is height bounded and scrollable']=function(){
    assert(css.includes('max-height:148px'),true,'desktop checklist height');
    assert(css.includes('overflow-y:auto'),true,'checklist scroll');
    assert(css.includes('scrollbar-gutter:stable'),true,'stable scrollbar');
  };

  t['Detect provider metadata uses the Action totem lifecycle']=function(){
    assert(settings.includes("title:'Detect model capabilities'"),true,'detect totem title');
    assert(settings.includes("stepId:'capability'"),true,'capability checkpoint');
    assert(settings.includes("LF.UI.activityFinish({message:'Provider metadata detection completed.'"),true,'detect terminal totem');
  };

  t['Working Copy restores from IndexedDB and Reset is the explicit clear boundary']=function(){
    assert(app.includes('await LF.Storage.loadExperiment()'),true,'load persisted experiment');
    assert(app.includes("scheduleWorkspaceSave('draft:"),true,'draft autosave');
    assert(app.includes("persistWorkspace('pagehide')"),true,'pagehide persistence');
    assert(app.includes('LF.Storage.clearSavedExperiment'),true,'reset clears persistent workspace');
    assert(html.includes('class="button danger compact reset-session-button"'),true,'visible reset control');
  };
  return t;
};
