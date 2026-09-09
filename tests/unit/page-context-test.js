'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/core.js');
require('../../assets/js/page-context.js');
function assert(actual,expected,label){if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error((label||'assert')+': expected '+JSON.stringify(expected)+' got '+JSON.stringify(actual));}
module.exports=function(t,LF){
  function base(){const e={id:'e1',meta:{name:'Demo'},samples:[],measurements:[],findings:[],design:{solutions:[],devices:[]},actionData:{proposals:{},annotations:{},status:{}}};return e;}
  t['Design page snapshot reflects manual edits and current AI suggestion']=function(){const e=base();e.design.solutions=[{id:'s1',name:'Ink',role:'absorber',solutes:'FAI + PbI2',solvents:'DMF'}];e.design.devices=[{id:'d1',name:'Experiment 1',sampleNames:[],solutionIds:['s1'],stack:[{role:'ETL',material:'SnO2'}]}];LF.ActionData.setProposal(e,'design.infer','d1',{targetDeviceId:'d1',summary:'AI',solutions:[],devices:[{stack:[{role:'HTL',material:'PTAA'}]}]});LF.State={state:{experiment:e,ui:{route:'experiment-design',pageContext:{page:'Design Experiment',view:'Selected experiment',selected:{experiment:'d1'}},selectedDesignDeviceId:'d1'}}};let a=LF.PageContext.snapshot();assert(a.data.selected_experiment.stack[0].material,'SnO2','current stack');assert(a.data.selected_ai_suggestion.summary,'AI','current suggestion');e.design.devices[0].stack[0].material='TiO2';let b=LF.PageContext.snapshot();assert(b.data.selected_experiment.stack[0].material,'TiO2','manual edit is visible on next Assistant turn');};
  return t;
};
