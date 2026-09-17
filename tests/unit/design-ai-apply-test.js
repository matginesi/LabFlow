'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/core.js');
require('../../assets/js/experiment/data-model.js');
require('../../assets/js/experiment/action-data.js');
require('../../assets/js/experiment/data-contracts.js');
require('../../assets/js/experiment/derived-state.js');
require('../../assets/js/data/parser.js');
require('../../assets/js/experiment/canonical-store.js');
require('../../assets/js/data/analysis.js');
require('../../assets/js/data/analysis-summary.js');
require('../../assets/js/experiment/design-model.js');
require('../../assets/js/data/dataset-corrections.js');
require('../../assets/js/experiment/design-analysis.js');
require('../../assets/js/data/pipeline.js');
require('../../assets/js/ai/action-steps.js');
function assert(ok,msg){if(!ok)throw new Error(msg||'assertion failed');}
module.exports=function(t,LF){
  function put(exp,proposal,targetId){const id=String(targetId||proposal&&proposal.targetDeviceId||'active');if(proposal&& !proposal.targetDeviceId && targetId)proposal.targetDeviceId=id;LF.ActionData.setProposal(exp,'design.infer',id,proposal);return exp;}
  function map(exp){return LF.ActionData.proposals(exp,'design.infer');}
  function status(exp,id){return LF.ActionData.status(exp,'design.infer',id)||{};}

  t['AI Design apply fills missing solution fields without overwriting researcher values']=function(){
    const exp=put({design:{status:'reviewing',solutions:[{id:'s1',name:'Ink A',role:'absorber',solutes:'USER-SOLUTE',solvents:'',concentration:'',status:'user_confirmed'}],devices:[]}},{solutions:[{name:'Ink A',role:'absorber',solutes:'AI-SOLUTE',solvents:'DMF:DMSO',concentration:'1.2 M',confidence:.8}],devices:[]},'d1');
    const out=LF.DesignAnalysis.applyOne(exp,'solution',0,'all');
    assert(out.changed>=2,'missing fields should be filled');
    assert(exp.design.solutions[0].solutes==='USER-SOLUTE','researcher solute must be preserved');
    assert(exp.design.solutions[0].solvents==='DMF:DMSO','missing solvent should be applied');
    assert(exp.design.solutions[0].concentration==='1.2 M','missing concentration should be applied');
  };
  t['AI stack apply fills existing gaps and appends missing layers']=function(){
    const exp=put({design:{status:'reviewing',solutions:[],devices:[{id:'d1',name:'D1',sampleNames:['S1'],solutionIds:[],process:{},stack:[{id:'l1',role:'',material:'ITO',thickness:'',process:'',status:'user_confirmed'}],status:'user_confirmed'}]}},{targetDeviceId:'d1',solutions:[],devices:[{sample_names:['S1'],stack:[{role:'substrate',material:'AI-ITO',thickness:'150 nm',process:''},{role:'ETL',material:'SnO2',thickness:'20 nm',process:'spin coat'}]}]},'d1');
    const out=LF.DesignAnalysis.applyOne(exp,'device',0,'stack');
    assert(out.changed>=3,'stack should fill gaps and append a layer');
    const stack=exp.design.devices[0].stack;
    assert(stack.length===2,'second AI layer should be appended');
    assert(stack[0].material==='ITO','existing researcher material must not be overwritten');
    assert(stack[0].role==='substrate','missing role should be filled');
    assert(stack[1].material==='SnO2','new layer should be applied');
  };
  t['AI Design apply-all can add solutions then link them to selected device']=function(){
    const exp=put({design:{status:'reviewing',solutions:[],devices:[{id:'d1',name:'D1',sampleNames:['S1'],solutionIds:[],process:{},stack:[],status:'user_confirmed'}]}},{targetDeviceId:'d1',solutions:[{name:'Ink A',role:'absorber',solvents:'DMF'}],devices:[{sample_names:['S1'],solution_names:['Ink A'],process:{coating:'spin coating'},stack:[]}]},'d1');
    const out=LF.DesignAnalysis.applyAll(exp);
    assert(out.changed>=3,'apply all should change design');
    assert(exp.design.solutions.length===1,'solution should be created');
    assert(exp.design.devices[0].solutionIds.includes(exp.design.solutions[0].id),'solution should be linked');
    assert(exp.design.devices[0].process.coating==='spin coating','fabrication should be applied');
  };
  function twoDeviceFixture(){return put({design:{status:'reviewing',solutions:[{id:'sol1',name:'Ink A',role:'absorber',solutes:'USER-SOLUTE',solvents:'',concentration:'',status:'user_confirmed'}],devices:[{id:'deviceA',name:'Device A',sampleNames:['S1'],solutionIds:[],process:{coating:'A-USER',annealing:'',atmosphere:''},stack:[],status:'user_confirmed'},{id:'deviceB',name:'Device B',sampleNames:['S2'],solutionIds:[],process:{coating:'B-USER',annealing:'',atmosphere:''},stack:[],status:'user_confirmed'}]}},{solutions:[{name:'Ink A',role:'absorber',solutes:'AI-SOLUTE',solvents:'DMF',concentration:'1.2 M',confidence:.8}],devices:[{id:'deviceA',name:'Device A',sample_names:['S1'],solution_names:['Ink A'],process:{coating:'A-AI',annealing:'400 C'},stack:[]},{id:'deviceB',name:'Device B',sample_names:['S2'],solution_names:['Ink A'],process:{coating:'B-AI',annealing:'450 C'},stack:[]}]},'active');}
  t['applySelectedDevice changes only the selected device and linked solution']=function(){
    const exp=twoDeviceFixture(),out=LF.DesignAnalysis.applySelectedDevice(exp,'deviceB');
    assert(out.changed===5,'device + shared solution fields changed');
    assert(exp.design.devices[1].process.annealing==='450 C','selected device missing field applied');
    assert(exp.design.devices[1].process.coating==='B-USER','user_confirmed coating not overwritten');
    assert(exp.design.devices[0].process.annealing==='','untouched device keeps empty field');
    assert(exp.design.devices[0].process.coating==='A-USER','untouched device keeps its value');
    assert(exp.design.solutions[0].solvents==='DMF','shared solution missing field applied');
    assert(exp.design.solutions[0].solutes==='USER-SOLUTE','researcher solution value preserved');
  };
  t['applySelectedDevice is a no-op on repeat and throws without a proposal']=function(){
    const exp=twoDeviceFixture();LF.DesignAnalysis.applySelectedDevice(exp,'deviceB');
    let threw=false;try{LF.DesignAnalysis.applySelectedDevice(exp,'deviceB');}catch(e){threw=true;assert(/already present or protected/.test(String(e.message)),'repeat apply reports protected values');}
    assert(threw,'repeat apply is a safe no-op');
    const bare={design:{devices:[],solutions:[]}};let threwMissing=false;try{LF.DesignAnalysis.applySelectedDevice(bare,'deviceB');}catch(e){threwMissing=true;}
    assert(threwMissing,'missing proposal throws');
  };
  t['apply all per-variant AI proposals preserves researcher values and may leave real gaps']=function(){
    LF.State={state:{ui:{selectedDesignDeviceId:'a'}}};
    const exp={design:{status:'reviewing',solutions:[],devices:[
      {id:'a',name:'A',sampleNames:['A1'],solutionIds:[],stack:[],process:{coating:'researcher spin',annealing:'',atmosphere:''},status:'user_confirmed'},
      {id:'b',name:'B',sampleNames:['B1'],solutionIds:[],stack:[],process:{coating:'',annealing:'',atmosphere:''},status:'user_confirmed'}
    ]}};put(exp,{targetDeviceId:'a',solutions:[],devices:[{id:'a',sample_names:['A1'],process:{coating:'AI coating',annealing:'100 C'}}]},'a');put(exp,{targetDeviceId:'b',solutions:[],devices:[{id:'b',sample_names:['B1'],process:{annealing:'120 C'}}]},'b');
    const out=LF.DesignAnalysis.applyAllProposals(exp);
    assert(out.proposals===2,'both proposals should be applied');
    assert(exp.design.devices[0].process.coating==='researcher spin','researcher coating protected');
    assert(exp.design.devices[0].process.annealing==='100 C','A annealing applied');
    assert(exp.design.devices[1].process.annealing==='120 C','B annealing applied');
    assert(exp.design.devices[0].stack.length===0&&exp.design.devices[1].stack.length===0,'missing stack remains missing rather than fabricated');
  };

  t['Design proposals are stored per experimental variant for sequential review']=function(){
    const oldModel=LF.DesignModel;LF.DesignModel=Object.assign({},oldModel,{normalizeProposal:function(v){return v;}});
    const exp={design:{devices:[{id:'a'},{id:'b'}],solutions:[]}};
    const store=LF.ActionSteps['design.store-proposal'];
    store({exp:exp,outputs:{infer:{summary:'A',solutions:[],devices:[{sample_names:['A1']}]}},lastResult:null,params:{deviceId:'a'},sourceRevision:3});
    store({exp:exp,outputs:{infer:{summary:'B',solutions:[],devices:[{sample_names:['B1']}]}},lastResult:null,params:{deviceId:'b'},sourceRevision:3});
    const saved=map(exp);assert(saved.a&&saved.b,'proposals should be retained for both variants');
    assert(saved.a.summary==='A'&&saved.b.summary==='B','per-variant proposals must not overwrite each other');
    assert(!Object.prototype.hasOwnProperty.call(exp,'aiDesignProposal'),'Action output must not create an ad-hoc active proposal field');
    LF.DesignModel=oldModel;
  };

  t['Design normalizer accepts natural solution_chemistry and device_stack provider keys']=function(){
    const p=LF.DesignModel.normalizeProposal({summary:'candidate',solution_chemistry:{name:'Perovskite ink',role:'absorber',solute:'FAI + PbI2',solvent:'DMF:DMSO',confidence:.82,provenance_kind:'model_inference',reason:'plausible'},device_stack:[{role:'ETL',material:'SnO2',confidence:.8,provenance_kind:'model_inference',reason:'plausible'},{role:'absorber',material:'perovskite',confidence:.8,provenance_kind:'model_inference',reason:'plausible'}],unknowns:[]});
    assert(p.solutions.length===1&&p.solutions[0].solutes==='FAI + PbI2'&&p.solutions[0].solvents==='DMF:DMSO','natural chemistry keys normalize');
    assert(p.devices.length===1&&p.devices[0].stack.length===2&&p.devices[0].stack[0].material==='SnO2','natural stack key normalizes');
  };

  t['Design validation binds provider output to the selected canonical variant']=function(){
    const oldModel=LF.DesignModel;LF.DesignModel=Object.assign({},oldModel,{normalizeProposal:function(v){return v;}});
    const proposal={solutions:[],devices:[{sample_names:['MODEL-GUESSED'],stack:[{role:'Transparent electrode',material:'ITO'},{role:'electron transport layer',material:'SnO2'},{role:'Absorber',material:'Perovskite'}],provenance_kind:'model_inference',confidence:.3,reason:'candidate'}],unknowns:[]},ctx={outputs:{collect:{device_id:'deviceA',sample_names:['A1','A2'],unknown_fields:['stack']},infer:proposal},lastResult:proposal};
    const out=LF.ActionSteps['design.validate-coverage'](ctx);
    assert(JSON.stringify(out.devices[0].sample_names)===JSON.stringify(['A1','A2']),'model-provided sample identity must be replaced by selected canonical scope');
    assert(out.validation.targetDeviceId==='deviceA'&&out.validation.applicableFields[0]==='stack','deterministic target binding/applicability result missing');
    LF.DesignModel=oldModel;
  };

  t['Design validation converts an empty scientific domain into an auditable known unknown']=function(){
    const oldModel=LF.DesignModel;LF.DesignModel=Object.assign({},oldModel,{normalizeProposal:function(v){return v;}});
    const proposal={status:'insufficient_evidence',summary:'Not enough source context',solutions:[],devices:[{sample_names:['MODEL-GUESSED'],stack:[],provenance_kind:'model_inference',confidence:.3,reason:'candidate only'}],unresolved_domains:[],unknowns:['stack']};
    const out=LF.ActionSteps['design.validate-coverage']({outputs:{collect:{device_id:'deviceA',sample_names:['A1'],unknown_fields:['stack']},infer:proposal},lastResult:proposal});
    LF.DesignModel=oldModel;
    assert(out.unresolved_domains.includes('stack'),'empty requested stack becomes a known unknown');
    assert(out.validation.autoUnresolvedDomains.includes('stack'),'automatic downgrade remains auditable');
  };

  t['Design validation keeps qualitative model inference reviewable and exact quantities non-automatic']=function(){
    const oldModel=LF.DesignModel;LF.DesignModel=Object.assign({},oldModel,{normalizeProposal:function(v){return v;}});
    const proposal={solutions:[{name:'Ink',role:'absorber precursor',solutes:'perovskite precursor family',concentration:'1.2 M',preparation:'stir 12 h',provenance_kind:'model_inference',confidence:.86}],devices:[{sample_names:['MODEL'],process:{coating:'spin 4000 rpm',annealing:'100 C',atmosphere:'nitrogen'},provenance_kind:'model_inference',confidence:.84,stack:[{role:'Transparent electrode',material:'ITO',provenance_kind:'model_inference',confidence:.88},{role:'electron transport layer',material:'C60',thickness:'30 nm',process:'evaporate below 4e-6 torr',provenance_kind:'model_inference',confidence:.88},{role:'Absorber',material:'Perovskite',provenance_kind:'model_inference',confidence:.88}]}],unknowns:[]};
    const ctx={exp:{design:{devices:[],solutions:[]}},outputs:{collect:{device_id:'deviceA',sample_names:['A1'],unknown_fields:['solutions','stack']},infer:proposal},lastResult:proposal};
    const out=LF.ActionSteps['design.validate-coverage'](ctx),clean=out;
    assert(clean.solutions[0].concentration==='1.2 M'&&clean.solutions[0].preparation==='stir 12 h','model-only quantities remain visible for researcher review');
    assert(clean.solutions[0].role==='absorber precursor'&&clean.solutions[0].solutes==='perovskite precursor family','qualitative model inference is retained');
    assert(clean.solutions[0].provenance_kind==='model_inference','model-only suggestion keeps explicit provenance');
    assert(clean.solutions[0].field_decisions.find(function(x){return x.field==='concentration';}).auto_apply===false,'unsupported exact concentration is review-only');
    assert(out.validation&&out.validation.targetDeviceId==='deviceA','validation stays successful for useful reviewable content');
    LF.DesignModel=oldModel;
  };

  t['Design apply accepts high-confidence qualitative model inference but not unsourced exact quantities']=function(){
    const proposal={solutions:[{name:'Ink',role:'absorber precursor',concentration:'1.2 M',provenance_kind:'model_inference',confidence:.86}],devices:[{sample_names:['A1'],solution_names:['Ink'],process:{coating:'spin 4000 rpm',annealing:'100 C',atmosphere:'N2'},provenance_kind:'model_inference',confidence:.86,stack:[{role:'electron transport layer',material:'C60',thickness:'30 nm',process:'evaporate 4e-6 torr',provenance_kind:'model_inference',confidence:.86}]}],unknowns:[]};
    LF.DesignAnalysis.sanitizeProposal(proposal);
    const exp=put({design:{solutions:[],devices:[{id:'deviceA',name:'A',sampleNames:['A1'],solutionIds:[],stack:[],process:{coating:'',annealing:'',atmosphere:''}}]}},proposal,'deviceA');
    const out=LF.DesignAnalysis.applyAll(exp);
    const device=exp.design.devices[0],solution=exp.design.solutions[0],layer=device.stack[0];
    assert(device.process.atmosphere==='N2','chemical formula with a digit is qualitative and may be applied');
    assert(device.process.coating===''&&device.process.annealing==='','unsourced exact process quantities remain review-only');
    assert(solution&&solution.name==='Ink'&&!String(solution.concentration||''),'solution identity may apply but unsourced concentration may not');
    assert(layer&&layer.material==='C60'&&!String(layer.thickness||'')&&!String(layer.process||''),'material formula may apply but unsourced thickness/process quantities may not');
    assert(out.changed>0,'safe qualitative fields should still be applied');
    LF.DesignAnalysis.applyOne(exp,'device',0,'process');
    assert(device.process.coating==='spin 4000 rpm'&&device.process.annealing==='100 C','an explicit researcher Apply should accept preserved review suggestions');
  };

  t['Chemical formulas are not treated as quantities merely because they contain digits']=function(){
    ['SnO2','C60','2PACz','4PACz','N2','FA0.85Cs0.15PbI3'].forEach(function(value){assert(!LF.DesignAnalysis.isQuantitative(value),value+' must remain a qualitative material identifier');});
    ['4000 rpm','100 C','30 nm','4e-6 torr','25 min','1.2 M'].forEach(function(value){assert(LF.DesignAnalysis.isQuantitative(value),value+' should be recognized as an exact quantity');});
  };

  t['Experiment-backed numeric Design values may auto-apply when confidence and direct evidence are sufficient']=function(){
    const proposal={solutions:[],devices:[{sample_names:['A1'],process:{annealing:'100 C'},evidence:'RAW process metadata',provenance_kind:'experiment',confidence:.84,stack:[]}],unknowns:[]};
    LF.DesignAnalysis.sanitizeProposal(proposal);
    const exp=put({design:{solutions:[],devices:[{id:'d1',sampleNames:['A1'],solutionIds:[],stack:[],process:{annealing:''}}]}},proposal,'d1'),out=LF.DesignAnalysis.applyAll(exp,'d1');
    assert(out.changed>0&&exp.design.devices[0].process.annealing==='100 C','evidence-backed numeric field may auto-apply');
  };

  t['Mixed Design proposal reports six applied, two review and two unresolved fields']=function(){
    const proposal={solutions:[{name:'Ink',role:'absorber',solutes:'FAI + PbI2',solvents:'DMF',provenance_kind:'model_inference',confidence:.86}],devices:[{sample_names:['A1'],solution_names:['Ink'],process:{coating:'4000 rpm',annealing:'100 C',atmosphere:'N2'},provenance_kind:'model_inference',confidence:.86,stack:[]}],unknowns:['thickness','annealing time']};
    LF.DesignAnalysis.sanitizeProposal(proposal);
    const exp=put({design:{solutions:[],devices:[{id:'d1',sampleNames:['A1'],solutionIds:[],stack:[],process:{coating:'',annealing:'',atmosphere:''}}]}},proposal,'d1'),out=LF.DesignAnalysis.applyAll(exp,'d1');
    assert(out.autoApplied===6&&out.review===2&&out.unresolved===2,'mixed proposal counts should remain field-level and independent');
    assert(exp.design.devices[0].process.atmosphere==='N2'&&exp.design.devices[0].process.coating===''&&exp.design.devices[0].process.annealing==='','only the safe qualitative process value should apply');
  };

  t['Manual Design variant exposes direct gaps without requiring imported sample identity']=function(){
    const exp={sync:{revision:4},designAnalysis:{sourceRevision:4,samples:[]},design:{solutions:[],devices:[{id:'manual1',name:'New experiment',sampleNames:[],solutionIds:[],stack:[],process:{coating:'',annealing:'',atmosphere:'',notes:''},status:'user_confirmed'}]}};
    const out=LF.ActionSteps['design.collect-selected']({exp:exp,params:{deviceId:'manual1'}});
    assert(out.manual_variant===true,'new user-created variant should be recognized as manual');
    assert(JSON.stringify(out.unknown_fields.sort())===JSON.stringify(['solutions','stack','process'].sort()),'Design gaps cover chemistry, stack and fabrication process');
  };

  t['Manual Design variant validation does not require canonical sample names']=function(){
    const oldModel=LF.DesignModel;LF.DesignModel=Object.assign({},oldModel,{normalizeProposal:function(v){return v;}});
    const proposal={summary:'candidate',solutions:[],devices:[{name:'Suggested design',sample_names:['MODEL-GUESS'],stack:[{role:'Transparent electrode',material:'ITO',provenance_kind:'model_inference',confidence:.86,reason:'plausible'},{role:'ETL',material:'SnO2',provenance_kind:'model_inference',confidence:.86,reason:'plausible'},{role:'Absorber',material:'Perovskite',provenance_kind:'model_inference',confidence:.86,reason:'plausible'}],provenance_kind:'model_inference',confidence:.86,reason:'plausible'}],unknowns:[]};
    const ctx={outputs:{collect:{device_id:'manual1',sample_names:[],manual_variant:true,unknown_fields:['stack']},infer:proposal},lastResult:proposal};
    const out=LF.ActionSteps['design.validate-coverage'](ctx);
    assert(out.validation&&out.validation.manualVariant===true,'manual variant should validate successfully');
    assert(out.devices[0].sample_names.length===0,'provider-guessed sample identity must be removed for a manual variant');
    assert(out.devices[0].stack.some(function(x){return x.material==='SnO2';}),'qualitative stack suggestion remains usable');
    LF.DesignModel=oldModel;
  };

  t['AI completion is deterministically applied to the selected manual variant']=function(){
    const proposal={targetDeviceId:'manual2',solutions:[],devices:[{name:'AI renamed candidate',sample_names:[],process:{atmosphere:'N2'},provenance_kind:'model_inference',confidence:.86,reason:'plausible'}],unknowns:[]};
    LF.DesignAnalysis.sanitizeProposal(proposal);
    const exp=put({design:{solutions:[],devices:[{id:'manual1',name:'New experiment',sampleNames:[],solutionIds:[],stack:[],process:{atmosphere:''},status:'user_confirmed'},{id:'manual2',name:'New experiment',sampleNames:[],solutionIds:[],stack:[],process:{atmosphere:''},status:'user_confirmed'}]}},proposal,'manual2');
    const out=LF.DesignAnalysis.applyAll(exp);
    assert(out.changed>0,'safe qualitative completion should apply');
    assert(exp.design.devices[0].process.atmosphere===''&&exp.design.devices[1].process.atmosphere==='N2','only the targetDeviceId variant should receive the completion');
  };


  t['Sequential Design validation and storage bind each proposal to its exact experiment ID']=function(){
    const oldModel=LF.DesignModel,oldContext=LF.ContextBuilder;
    LF.DesignModel=Object.assign({},oldModel,{normalizeProposal:function(v){return v;}});
    LF.ContextBuilder={pack:function(){return{design_evidence_summary:{evidence_items:0,design_relevant_items:0}};}};
    const exp={design:{solutions:[],devices:[
      {id:'manualA',name:'New experiment',sampleNames:[],solutionIds:[],stack:[],process:{}},
      {id:'manualB',name:'New experiment',sampleNames:[],solutionIds:[],stack:[],process:{}}
    ]}};
    function validateAndStore(deviceId,material){
      const proposal={summary:deviceId,solutions:[],devices:[{sample_names:['MODEL-GUESS'],stack:[{role:'Transparent electrode',material:'ITO',provenance_kind:'model_inference',confidence:.84,reason:'candidate'},{role:'transport',material:material,provenance_kind:'model_inference',confidence:.84,reason:'candidate'},{role:'Absorber',material:'Perovskite',provenance_kind:'model_inference',confidence:.84,reason:'candidate'}],provenance_kind:'model_inference',confidence:.84,reason:'candidate'}],unknowns:[]};
      const ctx={exp:exp,params:{deviceId:deviceId},outputs:{collect:{device_id:deviceId,sample_names:[],manual_variant:true,unknown_fields:['stack']},infer:proposal},lastResult:proposal,sourceRevision:7};
      ctx.outputs.infer=LF.ActionSteps['design.validate-coverage'](ctx);
      LF.ActionSteps['design.store-proposal'](ctx);
    }
    validateAndStore('manualA','SnO2');validateAndStore('manualB','PTAA');
    const saved=map(exp);assert(saved.manualA.targetDeviceId==='manualA','A bound to exact experiment ID');
    assert(saved.manualB.targetDeviceId==='manualB','B bound to exact experiment ID');
    assert(saved.manualA.devices[0].sample_names.length===0&&saved.manualB.devices[0].sample_names.length===0,'manual experiments never inherit guessed sample identity');
    assert(saved.manualA.devices[0].stack.some(function(x){return x.material==='SnO2';})&&saved.manualB.devices[0].stack.some(function(x){return x.material==='PTAA';}),'independent suggestions remain independent');
    LF.DesignModel=oldModel;LF.ContextBuilder=oldContext;
  };

  t['Single Design collect refuses complete experiments and exposes only missing fields']=function(){
    const exp={sync:{revision:2},designAnalysis:{sourceRevision:2,samples:[]},design:{solutions:[{id:'s1',name:'Ink',role:'absorber precursor',solutes:'FAI + PbI2',solvents:'DMF'}],devices:[
      {id:'done',sampleNames:[],solutionIds:['s1'],stack:[{role:'Transparent electrode',material:'ITO'},{role:'Electron transport',material:'SnO2'},{role:'Absorber',material:'Perovskite'}],process:{coating:'spin coating'}},
      {id:'todo',sampleNames:[],solutionIds:[],stack:[],process:{}}
    ]}};
    let completeBlocked=false;try{LF.ActionSteps['design.collect-selected']({exp:exp,params:{deviceId:'done'}});}catch(err){completeBlocked=/no pending Design domains/i.test(String(err.message));}
    assert(completeBlocked,'complete experiment must not spend an AI request');
    const todo=LF.ActionSteps['design.collect-selected']({exp:exp,params:{deviceId:'todo'}});
    assert(JSON.stringify(todo.unknown_fields.sort())===JSON.stringify(['solutions','stack','process'].sort()),'incomplete experiment declares its exact missing domains');
  };

  t['A lone perovskite layer remains an incomplete architecture']=function(){
    const exp={sync:{revision:3},designAnalysis:{sourceRevision:3,samples:[]},design:{solutions:[{id:'s1',name:'Ink',role:'absorber precursor',solutes:'FAI + PbI2',solvents:'DMF'}],devices:[{id:'partial',sampleNames:[],solutionIds:['s1'],stack:[{role:'Absorber',material:'Perovskite'}],process:{coating:'spin coating'}}]}};
    const out=LF.ActionSteps['design.collect-selected']({exp:exp,params:{deviceId:'partial'}});
    assert(out.unknown_fields.length===1&&out.unknown_fields[0]==='stack','partial absorber evidence should request the missing device architecture');
  };

  t['Design semantic validation refuses to apply a one-layer stack and marks the domain unresolved']=function(){
    const proposal={status:'suggested',summary:'partial stack',solutions:[],stack:[{role:'Absorber',material:'Perovskite'}],process:{},unresolved_domains:[],unknowns:[]};
    const out=LF.ActionSteps['design.validate-coverage']({outputs:{collect:{device_id:'d1',sample_names:[],manual_variant:true,unknown_fields:['stack']},infer:proposal},lastResult:proposal});
    assert(out.unresolved_domains.includes('stack'),'incoherent one-layer stack is unresolved');
    assert(out.devices[0].stack.length===0,'incomplete stack candidate cannot be applied accidentally');
    assert(out.validation.autoUnresolvedDomains.includes('stack'),'safe downgrade is visible in validation metadata');
  };

  t['Accept experiment applies only that saved suggestion and clears it from review']=function(){
    LF.State={state:{ui:{selectedDesignDeviceId:'a'}}};
    const exp={design:{status:'reviewing',solutions:[],devices:[
      {id:'a',name:'A',sampleNames:[],solutionIds:[],stack:[],process:{},status:'user_confirmed'},
      {id:'b',name:'B',sampleNames:[],solutionIds:[],stack:[],process:{},status:'user_confirmed'}
    ]}};
    put(exp,{targetDeviceId:'a',solutions:[{name:'Ink A',role:'absorber',solutes:'FAI + PbI2',solvents:'DMF',provenance_kind:'model_inference',confidence:.8,reason:'candidate'}],devices:[{sample_names:[],solution_names:['Ink A'],process:{coating:'spin coating'},stack:[{role:'Transparent electrode',material:'ITO'},{role:'ETL',material:'SnO2'},{role:'Absorber',material:'Perovskite'}],provenance_kind:'model_inference',confidence:.8,reason:'candidate'}],unknowns:[]},'a');
    put(exp,{targetDeviceId:'b',solutions:[{name:'Ink B',role:'absorber',solutes:'CsI + PbI2',solvents:'DMSO',provenance_kind:'model_inference',confidence:.8}],devices:[{sample_names:[],solution_names:['Ink B'],process:{coating:'spin coating'},stack:[{role:'Transparent electrode',material:'ITO'},{role:'HTL',material:'PTAA'},{role:'Absorber',material:'Perovskite'}]}],unknowns:[]},'b');
    const out=LF.DesignAnalysis.acceptProposal(exp,'a');
    assert(out.deviceId==='a'&&out.changed>0&&out.complete===true,'selected suggestion should complete and be accepted');
    assert(exp.design.devices[0].stack.some(function(x){return x.material==='SnO2';}),'selected stack should be copied into editable Design');
    assert(exp.design.devices[1].stack.length===0,'other experiment must remain untouched');
    assert(status(exp,'a').state==='accepted','accepted experiment gets a simple accepted state');
    assert(!map(exp).a&&!!map(exp).b,'only accepted suggestion should leave the review queue');
  };

  t['Accept all suggestions validates saved experiments independently']=function(){
    LF.State={state:{ui:{selectedDesignDeviceId:'a'}}};
    const exp={design:{status:'reviewing',solutions:[],devices:[
      {id:'a',name:'A',sampleNames:[],solutionIds:[],stack:[],process:{},status:'user_confirmed'},
      {id:'b',name:'B',sampleNames:[],solutionIds:[],stack:[],process:{},status:'user_confirmed'}
    ]}};
    put(exp,{targetDeviceId:'a',solutions:[{name:'Ink A',role:'absorber',solutes:'FAI + PbI2',solvents:'DMF'}],devices:[{sample_names:[],solution_names:['Ink A'],process:{coating:'spin coating'},stack:[{role:'Transparent electrode',material:'ITO'},{role:'ETL',material:'SnO2'},{role:'Absorber',material:'Perovskite'}]}],unknowns:[]},'a');
    put(exp,{targetDeviceId:'b',solutions:[{name:'Ink B',role:'absorber',solutes:'CsI + PbI2',solvents:'DMSO'}],devices:[{sample_names:[],solution_names:['Ink B'],process:{coating:'spin coating'},stack:[{role:'Transparent electrode',material:'ITO'},{role:'HTL',material:'PTAA'},{role:'Absorber',material:'Perovskite'}]}],unknowns:[]},'b');
    const out=LF.DesignAnalysis.acceptAllProposals(exp);
    assert(out.accepted===2&&out.incomplete.length===0&&out.failed.length===0,'all independent complete suggestions should be accepted');
    assert(exp.design.devices[0].stack.some(function(x){return x.material==='SnO2';})&&exp.design.devices[1].stack.some(function(x){return x.material==='PTAA';}),'each experiment keeps its own accepted stack');
    assert(Object.keys(map(exp)).length===0,'accepted queue should be empty');
  };

  t['Accept all keeps same-named but scientifically different solutions separated']=function(){
    LF.State={state:{ui:{selectedDesignDeviceId:'a'}}};
    const exp={design:{status:'reviewing',solutions:[],devices:[
      {id:'a',name:'A',sampleNames:[],solutionIds:[],stack:[],process:{},status:'user_confirmed'},
      {id:'b',name:'B',sampleNames:[],solutionIds:[],stack:[],process:{},status:'user_confirmed'}
    ]}};
    const stack=[{role:'Transparent electrode',material:'ITO'},{role:'ETL',material:'SnO2'},{role:'Absorber',material:'Perovskite'}];
    put(exp,{targetDeviceId:'a',solutions:[{name:'Perovskite precursor',role:'absorber',solutes:'FAI + PbI2',solvents:'DMF'}],devices:[{sample_names:[],solution_names:['Perovskite precursor'],process:{coating:'spin coating'},stack:stack}],unknowns:[]},'a');
    put(exp,{targetDeviceId:'b',solutions:[{name:'Perovskite precursor',role:'absorber',solutes:'CsI + PbI2',solvents:'DMSO'}],devices:[{sample_names:[],solution_names:['Perovskite precursor'],process:{coating:'spin coating'},stack:stack}],unknowns:[]},'b');
    const out=LF.DesignAnalysis.acceptAllProposals(exp),a=exp.design.devices[0],b=exp.design.devices[1];
    assert(out.accepted===2&&exp.design.solutions.length===2,'different chemistry must create two distinct Design solutions even when AI names match');
    assert(a.solutionIds.length===1&&b.solutionIds.length===1&&a.solutionIds[0]!==b.solutionIds[0],'each experiment must link only its own accepted solution');
    const sa=exp.design.solutions.find(function(x){return x.id===a.solutionIds[0];}),sb=exp.design.solutions.find(function(x){return x.id===b.solutionIds[0];});
    assert(sa.solutes==='FAI + PbI2'&&sb.solutes==='CsI + PbI2','Accept all must not cross-contaminate solution chemistry');
  };

  t['Accept never labels a partial stale Design suggestion as complete']=function(){
    LF.State={state:{ui:{selectedDesignDeviceId:'a'}}};
    const exp={design:{status:'reviewing',solutions:[],devices:[{id:'a',name:'A',sampleNames:[],solutionIds:[],stack:[],process:{},status:'user_confirmed'}]}};
    put(exp,{targetDeviceId:'a',solutions:[],devices:[{sample_names:[],stack:[{role:'Absorber',material:'Perovskite'}]}],unknowns:[]},'a');
    const out=LF.DesignAnalysis.acceptProposal(exp,'a');
    assert(out.complete===false&&out.remaining.includes('stack')&&out.remaining.includes('solutions')&&out.remaining.includes('process'),'post-accept completeness must be checked against the real Design model');
    assert(status(exp,'a').state==='incomplete','stale partial proposal must not be marked accepted');
    assert(!map(exp).a,'exhausted partial proposal is cleared so Complete with AI can run again');
  };

  t['A sparse Design attempt can be downgraded safely without removing an independently stored success']=function(){
    const oldModel=LF.DesignModel,oldContext=LF.ContextBuilder;
    LF.DesignModel=Object.assign({},oldModel,{normalizeProposal:function(v){return v;}});LF.ContextBuilder={pack:function(){return{};}};
    const exp={design:{solutions:[],devices:[{id:'a',sampleNames:[],solutionIds:[],stack:[]},{id:'b',sampleNames:[],solutionIds:[],stack:[]}]}};
    try{
      const good={status:'suggested',summary:'A',solutions:[],devices:[{sample_names:[],stack:[{role:'Transparent electrode',material:'ITO',provenance_kind:'model_inference',confidence:.8,reason:'candidate'},{role:'ETL',material:'SnO2',provenance_kind:'model_inference',confidence:.8,reason:'candidate'},{role:'Absorber',material:'Perovskite',provenance_kind:'model_inference',confidence:.8,reason:'candidate'}],provenance_kind:'model_inference',confidence:.8,reason:'candidate'}],unknowns:[]};
      const goodCtx={exp:exp,params:{deviceId:'a'},sourceRevision:1,outputs:{collect:{device_id:'a',sample_names:[],manual_variant:true,unknown_fields:['stack']},infer:good},lastResult:good};
      goodCtx.outputs.infer=LF.ActionSteps['design.validate-coverage'](goodCtx);LF.ActionSteps['design.store-proposal'](goodCtx);
      const sparse={status:'insufficient_evidence',summary:'B lacks context',solutions:[],devices:[{sample_names:[],stack:[],provenance_kind:'model_inference',confidence:.5,reason:'unknown'}],unknowns:['stack']};
      const sparseCtx={exp:exp,params:{deviceId:'b'},sourceRevision:1,outputs:{collect:{device_id:'b',sample_names:[],manual_variant:true,unknown_fields:['stack']},infer:sparse},lastResult:sparse};
      const downgraded=LF.ActionSteps['design.validate-coverage'](sparseCtx);
      assert(downgraded.unresolved_domains.includes('stack'),'sparse second experiment becomes an explicit known unknown');
      assert(map(exp).a&&status(exp,'a').state==='suggested','successful first proposal remains stored');
      assert(!map(exp).b,'validation alone does not overwrite or create another stored proposal');
    }finally{LF.DesignModel=oldModel;LF.ContextBuilder=oldContext;}
  };

  t['Name-only or role-only solution does not satisfy Design chemistry']=function(){
    const exp={design:{solutions:[{id:'s1',name:'Ink',role:'absorber precursor'}],devices:[{id:'d1',solutionIds:['s1'],stack:[{role:'Substrate',material:'glass/ITO'},{role:'ETL',material:'SnO2'},{role:'Absorber',material:'Perovskite'}],process:{coating:'spin coating'}}]}};
    const missing=LF.DesignModel.missingDomains(exp,exp.design.devices[0]);
    assert(missing.includes('solutions'),'chemistry must remain missing until a solute or solvent is present');
  };

  t['Canonical Design Action output preserves chemistry and applies it to the selected experiment']=function(){
    const exp={design:{status:'reviewing',solutions:[],devices:[{id:'chem',name:'Chemistry target',sampleNames:[],solutionIds:[],stack:[],process:{coating:'',annealing:'',atmosphere:'',notes:''},status:'user_confirmed'}]}};
    const canonical={
      status:'suggested',summary:'Qualitative candidate',
      solutions:[{name:'Perovskite precursor',role:'absorber precursor',solutes:'FAI + PbI2',solvents:'DMF + DMSO',confidence:.82,provenance_kind:'model_inference',reason:'plausible qualitative chemistry'}],
      stack:[{role:'Substrate / transparent contact',material:'glass/ITO',confidence:.8,provenance_kind:'model_inference'},{role:'Electron transport layer',material:'SnO2',confidence:.8,provenance_kind:'model_inference'},{role:'Absorber',material:'Perovskite',confidence:.8,provenance_kind:'model_inference'},{role:'Hole transport layer',material:'PTAA',confidence:.8,provenance_kind:'model_inference'},{role:'Top contact',material:'Au',confidence:.8,provenance_kind:'model_inference'}],
      process:{coating:'spin coating',annealing:'thermal annealing',atmosphere:'inert atmosphere',confidence:.8,provenance_kind:'model_inference'},unknowns:[]
    };
    const ctx={exp:exp,params:{deviceId:'chem'},outputs:{collect:{device_id:'chem',sample_names:[],manual_variant:true,unknown_fields:['solutions','stack','process']},infer:canonical},lastResult:canonical,sourceRevision:1};
    const validated=LF.ActionSteps['design.validate-coverage'](ctx);
    assert(validated.status==='suggested','canonical public output should be useful');
    assert(validated.devices.length===1,'LabFlow must synthesize one internal target wrapper');
    assert(validated.devices[0].solution_names.includes('Perovskite precursor'),'solution must be linked deterministically');
    assert(validated.devices[0].stack.length===5,'top-level stack must survive internal normalization');
    assert(validated.devices[0].process.coating==='spin coating','top-level process must survive internal normalization');
    ctx.outputs.infer=validated;LF.ActionSteps['design.store-proposal'](ctx);
    const accepted=LF.DesignAnalysis.acceptProposal(exp,'chem');
    assert(accepted.changed>0,'accepted proposal should change Design');
    const solution=exp.design.solutions[0],device=exp.design.devices[0];
    assert(solution.solutes==='FAI + PbI2'&&solution.solvents==='DMF + DMSO','solute and solvent chemistry must be preserved');
    assert(device.solutionIds.includes(solution.id),'accepted solution must be linked to selected experiment');
    assert(device.process.coating==='spin coating'&&device.process.annealing==='thermal annealing'&&device.process.atmosphere==='inert atmosphere','Accept must apply process fields too');
    assert(device.stack.length===5,'accepted stack must be applied');
  };

  t['Name-only Design chemistry is safely downgraded to unresolved instead of failing the Action']=function(){
    const proposal={status:'suggested',summary:'placeholder',solutions:[{name:'Perovskite ink'}],stack:[],process:{},unresolved_domains:[],unknowns:[]};
    const out=LF.ActionSteps['design.validate-coverage']({outputs:{collect:{device_id:'d1',sample_names:[],manual_variant:true,unknown_fields:['solutions']},infer:proposal},lastResult:proposal});
    assert(out.unresolved_domains.includes('solutions'),'name-only chemistry becomes an explicit known unknown');
    assert(out.solutions.length===0,'incomplete chemistry candidate is removed so it cannot be applied');
    assert(out.validation.autoUnresolvedDomains.includes('solutions'),'deterministic fallback is auditable');
  };

  t['Partial Design suggestion preserves useful domains and safely marks omitted chemistry unresolved']=function(){
    const proposal={status:'suggested',summary:'stack and process only',solutions:[],stack:[{role:'Substrate',material:'glass/ITO'},{role:'ETL',material:'SnO2'},{role:'Absorber',material:'Perovskite'}],process:{coating:'spin coating'},unresolved_domains:[],unknowns:[]};
    const out=LF.ActionSteps['design.validate-coverage']({outputs:{collect:{device_id:'d1',sample_names:[],manual_variant:true,unknown_fields:['solutions','stack','process']},infer:proposal},lastResult:proposal});
    assert(out.validation.applicableFields.includes('stack')&&out.validation.applicableFields.includes('process'),'valid stack/process remain reviewable');
    assert(out.unresolved_domains.includes('solutions'),'omitted solution chemistry is conservatively unresolved');
    assert(out.validation.autoUnresolvedDomains.includes('solutions'),'automatic unresolved downgrade is recorded');
  };

  t['Design coverage never fails when small model omits required solutions and stack']=function(){
    const proposal={status:'suggested',summary:'Only process could be supported.',solutions:[],stack:[],process:{coating:'spin coating'},unresolved_domains:[],unknowns:[]};
    const out=LF.ActionSteps['design.validate-coverage']({outputs:{collect:{device_id:'d1',sample_names:[],manual_variant:true,unknown_fields:['solutions','stack','process']},infer:proposal},lastResult:proposal});
    assert(out.validation.applicableFields.includes('process'),'supported process remains applicable');
    assert(JSON.stringify(out.unresolved_domains.sort())===JSON.stringify(['solutions','stack']),'missing solutions and stack are deterministically unresolved');
    assert(JSON.stringify(out.validation.autoUnresolvedDomains.sort())===JSON.stringify(['solutions','stack']),'automatic downgrade is explicit in validation metadata');
  };

  t['Design accepts an explicitly unresolved domain instead of forcing unsupported chemistry']=function(){
    const proposal={status:'suggested',summary:'Stack and process are useful; chemistry is not established.',solutions:[],stack:[{role:'Substrate / transparent contact',material:'glass/ITO'},{role:'Electron transport layer',material:'SnO2'},{role:'Absorber',material:'Perovskite'}],process:{coating:'spin coating'},unresolved_domains:['solutions'],unknowns:['solutions: no supported precursor or solvent evidence']};
    const out=LF.ActionSteps['design.validate-coverage']({outputs:{collect:{device_id:'d1',sample_names:[],manual_variant:true,unknown_fields:['solutions','stack','process']},infer:proposal},lastResult:proposal});
    assert(out.validation.applicableFields.includes('stack')&&out.validation.applicableFields.includes('process'),'supported domains remain useful');
    assert(out.validation.unresolvedDomains.includes('solutions'),'unsupported chemistry is explicit rather than fabricated');
    assert(out.unresolved_domains.length===1,'only the unresolved domain is retained');
  };

  t['Design can safely return all requested domains unresolved when context is insufficient']=function(){
    const proposal={status:'suggested',summary:'Available context does not establish fabrication design.',solutions:[],stack:[],process:{},unresolved_domains:['solutions','stack','process'],unknowns:[]};
    const out=LF.ActionSteps['design.validate-coverage']({outputs:{collect:{device_id:'d1',sample_names:[],manual_variant:true,unknown_fields:['solutions','stack','process']},infer:proposal},lastResult:proposal});
    assert(out.validation.applicableFields.length===0,'no scientific values are fabricated');
    assert(out.validation.unresolvedDomains,['solutions','stack','process'],'all unresolved domains are explicit');
    assert(out.unknowns.length>=3,'LabFlow adds deterministic unresolved explanations when the model omits them');
  };

  t['Accepted unresolved Design domains become reviewed known unknowns, not an endless incomplete loop']=function(){
    const exp={design:{status:'reviewing',solutions:[],devices:[{id:'u1',name:'U1',sampleNames:[],solutionIds:[],stack:[],process:{},status:'user_confirmed'}]}};
    const raw={status:'suggested',summary:'No coherent supported candidate remains.',solutions:[],stack:[],process:{},unresolved_domains:['solutions','stack','process'],unknowns:['solutions: unknown','stack: unknown','process: unknown']};
    const ctx={exp:exp,params:{deviceId:'u1'},sourceRevision:1,outputs:{collect:{device_id:'u1',sample_names:[],manual_variant:true,unknown_fields:['solutions','stack','process']},infer:raw},lastResult:raw};
    ctx.outputs.infer=LF.ActionSteps['design.validate-coverage'](ctx);LF.ActionSteps['design.store-proposal'](ctx);
    const out=LF.DesignAnalysis.acceptProposal(exp,'u1'),dev=exp.design.devices[0];
    assert(out.complete===true&&out.reviewed===true&&out.scientificallyComplete===false,'review acceptance closes workflow without pretending scientific completeness');
    assert(status(exp,'u1').state==='reviewed','accepted unknowns get reviewed state');
    assert(LF.DesignModel.missingDomains(exp,dev).length===3,'scientific gaps remain explicit');
    assert(LF.DesignModel.pendingDomains(exp,dev).length===0,'reviewed gaps are no longer pending AI work');
    assert(dev.acknowledgedUnknownDomains.length===3,'reviewed unknown domains persist on Design');
    let blocked=false;try{LF.ActionSteps['design.collect-selected']({exp:exp,params:{deviceId:'u1'}});}catch(err){blocked=/no pending Design domains/i.test(String(err.message));}
    assert(blocked,'reviewed unknowns are not immediately requested again');
  };

  t['Editing a reviewed unknown domain reopens only that Design domain']=function(){
    const exp={design:{solutions:[],devices:[{id:'u2',name:'U2',sampleNames:[],solutionIds:[],stack:[],process:{},acknowledgedUnknownDomains:['solutions','stack','process'],status:'user_confirmed'}]}};
    LF.DesignModel.updateDeviceProcessField(exp,'u2','notes','researcher changed process context');
    const dev=exp.design.devices[0];
    assert(!dev.acknowledgedUnknownDomains.includes('process'),'editing process invalidates prior process unknown acknowledgement');
    assert(dev.acknowledgedUnknownDomains.includes('solutions')&&dev.acknowledgedUnknownDomains.includes('stack'),'unrelated reviewed unknowns remain acknowledged');
    assert(LF.DesignModel.pendingDomains(exp,dev).length===0,'a now-populated process is not pending');
    LF.DesignModel.updateDeviceProcessField(exp,'u2','notes','');
    assert(LF.DesignModel.pendingDomains(exp,dev).length===1&&LF.DesignModel.pendingDomains(exp,dev)[0]==='process','clearing edited process makes only process pending again');
  };

  t['Design reference fallback prefers Cabinet resources before unresolved']=function(){
    const oldContext=LF.ContextBuilder;
    LF.ContextBuilder={pack:function(){return{
      cabinet:{items:[{id:'cab-sol',kind:'solution',name:'Cabinet ink',role:'absorber precursor',solutes:'FAI + PbI2',solvents:'DMF + DMSO'},{id:'cab-stack',kind:'stack',name:'Cabinet stack',layers:[{role:'substrate',material:'ITO'},{role:'HTL',material:'2PACz'},{role:'absorber',material:'perovskite'},{role:'ETL',material:'C60'},{role:'electrode',material:'Ag'}]},{id:'cab-proc',kind:'protocol',name:'Cabinet process',coating:'spin coating',annealing:'thermal annealing',atmosphere:'N2'}],domain_candidates:{solutions:[{id:'cab-sol',kind:'solution',name:'Cabinet ink',role:'absorber precursor',solutes:'FAI + PbI2',solvents:'DMF + DMSO'}],stack:[{id:'cab-stack',kind:'stack',name:'Cabinet stack',layers:[{role:'substrate',material:'ITO'},{role:'HTL',material:'2PACz'},{role:'absorber',material:'perovskite'},{role:'ETL',material:'C60'},{role:'electrode',material:'Ag'}]}],process:[{id:'cab-proc',kind:'protocol',name:'Cabinet process',coating:'spin coating',annealing:'thermal annealing',atmosphere:'N2'}]}},
      knowledge:{entries:[],domain_candidates:{solutions:[],stack:[],process:[]}}
    };}};
    try{
      const raw={status:'suggested',summary:'small model omitted domains',solutions:[],stack:[],process:{},unresolved_domains:[],unknowns:[]};
      const ctx={exp:{design:{solutions:[],devices:[{id:'d1',sampleNames:[],solutionIds:[],stack:[],process:{}}]}},params:{deviceId:'d1'},outputs:{collect:{device_id:'d1',sample_names:[],manual_variant:true,unknown_fields:['solutions','stack','process']},infer:raw},lastResult:raw};
      const out=LF.ActionSteps['design.validate-coverage'](ctx);
      assert(out.validation.referenceFallbackDomains.length===3,'Cabinet should fill all three omitted domains');
      assert(out.validation.unresolvedDomains.length===0,'usable Cabinet references should prevent unresolved downgrade');
      assert(out.solutions[0].provenance_kind==='cabinet_reference'&&/^CABINET:/.test(out.solutions[0].evidence),'solution nature should remain Cabinet reference');
      assert(out.devices[0].stack.length>=3&&out.devices[0].stack[0].provenance_kind==='cabinet_reference','stack should come from Cabinet');
      assert(out.devices[0].process.provenance_kind==='cabinet_reference','process should come from Cabinet');
      assert(out.solutions[0].confidence>0.7&&out.solutions[0].confidence<0.95,'Cabinet confidence should be strong but not imply experiment proof');
    }finally{LF.ContextBuilder=oldContext;}
  };

  t['Design reference fallback uses structured KB hints when Cabinet has no candidate']=function(){
    const oldContext=LF.ContextBuilder;
    LF.ContextBuilder={pack:function(){return{
      cabinet:{items:[],domain_candidates:{solutions:[],stack:[],process:[]}},
      knowledge:{entries:[
        {id:'kb-sol',design_hint:{solution:{name:'Reference ink',role:'absorber precursor',solutes:'FAI + PbI2',solvents:'DMF + DMSO'},reference_confidence:.74}},
        {id:'kb-stack',design_hint:{stack:[{role:'substrate',material:'ITO'},{role:'HTL',material:'2PACz'},{role:'absorber',material:'perovskite'},{role:'ETL',material:'C60'},{role:'electrode',material:'Ag'}],reference_confidence:.78}},
        {id:'kb-proc',design_hint:{process:{coating:'spin coating',annealing:'thermal annealing',atmosphere:''},reference_confidence:.7}}
      ],domain_candidates:{solutions:[],stack:[],process:[]}}
    };}};
    try{
      const raw={status:'suggested',summary:'no useful model proposal',solutions:[],stack:[],process:{},unresolved_domains:[],unknowns:[]};
      const ctx={exp:{design:{solutions:[],devices:[{id:'d2',sampleNames:[],solutionIds:[],stack:[],process:{}}]}},params:{deviceId:'d2'},outputs:{collect:{device_id:'d2',sample_names:[],manual_variant:true,unknown_fields:['solutions','stack','process']},infer:raw},lastResult:raw};
      const out=LF.ActionSteps['design.validate-coverage'](ctx);
      assert(out.validation.referenceFallbackDomains.length===3,'structured KB hints should fill omitted domains');
      assert(out.validation.unresolvedDomains.length===0,'structured KB hints should be preferred over empty unresolved output');
      assert(out.solutions[0].provenance_kind==='knowledge_reference'&&out.solutions[0].evidence==='KB:kb-sol','solution should retain KB nature');
      assert(out.devices[0].stack[0].evidence==='KB:kb-stack','stack should cite exact KB source');
      assert(out.devices[0].process.evidence==='KB:kb-proc','process should cite exact KB source');
      assert(out.solutions[0].confidence<0.85,'KB confidence should stay below experiment-evidence confidence');
    }finally{LF.ContextBuilder=oldContext;}
  };


  t['Accepting one Design inference preserves sibling pending proposals']=function(){
    const exp={design:{status:'reviewing',solutions:[],devices:[
      {id:'a',name:'A',sampleNames:['A1'],solutionIds:[],stack:[],process:{},status:'user_confirmed'},
      {id:'b',name:'B',sampleNames:['B1'],solutionIds:[],stack:[],process:{},status:'user_confirmed'}
    ]}};
    put(exp,{targetDeviceId:'a',solutions:[],devices:[{id:'a',sample_names:['A1'],stack:[{role:'ETL',material:'SnO2'}],process:{coating:'spin'}}],unresolved_domains:['solutions'],unknowns:['solutions unknown']},'a');
    put(exp,{targetDeviceId:'b',solutions:[],devices:[{id:'b',sample_names:['B1'],stack:[{role:'ETL',material:'TiO2'}],process:{coating:'spin'}}],unresolved_domains:['solutions'],unknowns:['solutions unknown']},'b');
    LF.DesignAnalysis.acceptProposal(exp,'a');
    LF.DerivedState.invalidate(exp,'design',{preserveDesignProposals:true});
    assert(!LF.ActionData.proposal(exp,'design.infer','a'),'accepted target proposal is removed');
    assert(!!LF.ActionData.proposal(exp,'design.infer','b'),'sibling proposal remains available for review');
  };


};
