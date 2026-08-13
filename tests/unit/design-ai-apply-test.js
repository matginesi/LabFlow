'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/ai/operation-steps.js');
function assert(ok,msg){if(!ok)throw new Error(msg||'assertion failed');}
module.exports=function(t,LF){
  t['AI Design apply fills missing solution fields without overwriting researcher values']=function(){
    const exp={design:{status:'reviewing',solutions:[{id:'s1',name:'Ink A',role:'absorber',solutes:'USER-SOLUTE',solvents:'',concentration:'',status:'user_confirmed'}],devices:[]},aiDesignProposal:{solutions:[{name:'Ink A',role:'absorber',solutes:'AI-SOLUTE',solvents:'DMF:DMSO',concentration:'1.2 M',confidence:.8}],devices:[]}};
    const out=LF.DesignAnalysis.applyOne(exp,'solution',0,'all');
    assert(out.changed>=2,'missing fields should be filled');
    assert(exp.design.solutions[0].solutes==='USER-SOLUTE','researcher solute must be preserved');
    assert(exp.design.solutions[0].solvents==='DMF:DMSO','missing solvent should be applied');
    assert(exp.design.solutions[0].concentration==='1.2 M','missing concentration should be applied');
  };
  t['AI stack apply fills existing gaps and appends missing layers']=function(){
    const exp={design:{status:'reviewing',solutions:[],devices:[{id:'d1',name:'D1',sampleNames:['S1'],solutionIds:[],process:{},stack:[{id:'l1',role:'',material:'ITO',thickness:'',process:'',status:'user_confirmed'}],status:'user_confirmed'}]},aiDesignProposal:{solutions:[],devices:[{sample_names:['S1'],stack:[{role:'substrate',material:'AI-ITO',thickness:'150 nm',process:''},{role:'ETL',material:'SnO2',thickness:'20 nm',process:'spin coat'}]}]}};
    const out=LF.DesignAnalysis.applyOne(exp,'device',0,'stack');
    assert(out.changed>=3,'stack should fill gaps and append a layer');
    const stack=exp.design.devices[0].stack;
    assert(stack.length===2,'second AI layer should be appended');
    assert(stack[0].material==='ITO','existing researcher material must not be overwritten');
    assert(stack[0].role==='substrate','missing role should be filled');
    assert(stack[1].material==='SnO2','new layer should be applied');
  };
  t['AI Design apply-all can add solutions then link them to selected device']=function(){
    const exp={design:{status:'reviewing',solutions:[],devices:[{id:'d1',name:'D1',sampleNames:['S1'],solutionIds:[],process:{},stack:[],status:'user_confirmed'}]},aiDesignProposal:{solutions:[{name:'Ink A',role:'absorber',solvents:'DMF'}],devices:[{sample_names:['S1'],solution_names:['Ink A'],process:{coating:'spin coating'},stack:[]}]}};
    const out=LF.DesignAnalysis.applyAll(exp);
    assert(out.changed>=3,'apply all should change design');
    assert(exp.design.solutions.length===1,'solution should be created');
    assert(exp.design.devices[0].solutionIds.includes(exp.design.solutions[0].id),'solution should be linked');
    assert(exp.design.devices[0].process.coating==='spin coating','fabrication should be applied');
  };
};
