'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/experiment/model.js');
require('../../assets/js/ai/action-steps.js');
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
  t['Knowledge-backed Design filling preserves retrieved record IDs']=function(){
    const exp={design:{status:'reviewing',solutions:[],devices:[{id:'d1',name:'D1',sampleNames:['S1'],solutionIds:[],process:{coating:'',annealing:'',atmosphere:''},stack:[],status:'user_confirmed'}]},aiDesignProposal:{solutions:[{name:'Paper ink',role:'absorber',solvents:'DMF:DMSO',knowledge_refs:['kb_solution_paper'],provenance_kind:'knowledge'}],devices:[{sample_names:['S1'],solution_names:['Paper ink'],process:{annealing:'100 °C'},knowledge_refs:['kb_process_paper'],provenance_kind:'knowledge',stack:[]}]}};
    LF.DesignAnalysis.applyAll(exp);assert(exp.design.solutions[0].knowledge_refs[0]==='kb_solution_paper','solution Knowledge Base ID retained');assert(exp.design.devices[0].knowledge_refs[0]==='kb_process_paper','process Knowledge Base ID retained');
  };
  function twoDeviceFixture(){return{design:{status:'reviewing',solutions:[{id:'sol1',name:'Ink A',role:'absorber',solutes:'USER-SOLUTE',solvents:'',concentration:'',status:'user_confirmed'}],devices:[{id:'deviceA',name:'Device A',sampleNames:['S1'],solutionIds:[],process:{coating:'A-USER',annealing:'',atmosphere:''},stack:[],status:'user_confirmed'},{id:'deviceB',name:'Device B',sampleNames:['S2'],solutionIds:[],process:{coating:'B-USER',annealing:'',atmosphere:''},stack:[],status:'user_confirmed'}]},aiDesignProposal:{solutions:[{name:'Ink A',role:'absorber',solutes:'AI-SOLUTE',solvents:'DMF',concentration:'1.2 M',confidence:.8}],devices:[{id:'deviceA',name:'Device A',sample_names:['S1'],solution_names:['Ink A'],process:{coating:'A-AI',annealing:'400 C'},stack:[]},{id:'deviceB',name:'Device B',sample_names:['S2'],solution_names:['Ink A'],process:{coating:'B-AI',annealing:'450 C'},stack:[]}]}};}
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
    LF.State={state:{selectedDesignDeviceId:'a'}};
    const exp={design:{status:'reviewing',solutions:[],devices:[
      {id:'a',name:'A',sampleNames:['A1'],solutionIds:[],stack:[],process:{coating:'researcher spin',annealing:'',atmosphere:''},status:'user_confirmed'},
      {id:'b',name:'B',sampleNames:['B1'],solutionIds:[],stack:[],process:{coating:'',annealing:'',atmosphere:''},status:'user_confirmed'}
    ]},aiDesignProposals:{
      a:{targetDeviceId:'a',solutions:[],devices:[{id:'a',sample_names:['A1'],process:{coating:'AI coating',annealing:'100 C'}}]},
      b:{targetDeviceId:'b',solutions:[],devices:[{id:'b',sample_names:['B1'],process:{annealing:'120 C'}}]}
    }};
    const out=LF.DesignAnalysis.applyAllProposals(exp);
    assert(out.proposals===2,'both proposals should be applied');
    assert(exp.design.devices[0].process.coating==='researcher spin','researcher coating protected');
    assert(exp.design.devices[0].process.annealing==='100 C','A annealing applied');
    assert(exp.design.devices[1].process.annealing==='120 C','B annealing applied');
    assert(exp.design.devices[0].stack.length===0&&exp.design.devices[1].stack.length===0,'missing stack remains missing rather than fabricated');
  };

  t['Design proposals are stored per experimental variant for sequential review']=function(){
    const oldModel=LF.ExperimentModel;LF.ExperimentModel={normalizeDesignProposal:function(v){return v;}};
    const exp={design:{devices:[{id:'a'},{id:'b'}],solutions:[]}};
    const store=LF.ActionSteps['design.store-proposal'];
    store({exp:exp,outputs:{infer:{summary:'A',solutions:[],devices:[{sample_names:['A1']}]}},lastResult:null,params:{deviceId:'a'},sourceRevision:3});
    store({exp:exp,outputs:{infer:{summary:'B',solutions:[],devices:[{sample_names:['B1']}]}},lastResult:null,params:{deviceId:'b'},sourceRevision:3});
    assert(exp.aiDesignProposals&&exp.aiDesignProposals.a&&exp.aiDesignProposals.b,'proposals should be retained for both variants');
    assert(exp.aiDesignProposals.a.summary==='A'&&exp.aiDesignProposals.b.summary==='B','per-variant proposals must not overwrite each other');
    assert(exp.aiDesignProposal===exp.aiDesignProposals.b,'legacy active proposal alias should point at latest proposal');
    LF.ExperimentModel=oldModel;
  };

  t['Design normalizer accepts natural solution_chemistry and device_stack provider keys']=function(){
    const p=LF.ExperimentModel.normalizeDesignProposal({summary:'candidate',solution_chemistry:{name:'Perovskite ink',role:'absorber',solute:'FAI + PbI2',solvent:'DMF:DMSO',confidence:.82,provenance_kind:'model_inference',reason:'plausible'},device_stack:[{role:'ETL',material:'SnO2',confidence:.8,provenance_kind:'model_inference',reason:'plausible'},{role:'absorber',material:'perovskite',confidence:.8,provenance_kind:'model_inference',reason:'plausible'}],unknowns:[]});
    assert(p.solutions.length===1&&p.solutions[0].solutes==='FAI + PbI2'&&p.solutions[0].solvents==='DMF:DMSO','natural chemistry keys normalize');
    assert(p.devices.length===1&&p.devices[0].stack.length===2&&p.devices[0].stack[0].material==='SnO2','natural stack key normalizes');
  };

  t['Design decision metric averages only proposed fields without provenance caps']=function(){
    const metric=LF.DesignDecisionMetric.calculate({solutions:[{name:'Ink',confidence:.95,provenance_kind:'model_inference'}],devices:[{confidence:.9,provenance_kind:'experiment',evidence:'RAW metadata',process:{annealing:'100 C'},stack:[{material:'SnO2',confidence:.88,provenance_kind:'experiment',evidence:'source row'}]}]});
    assert(metric.value===91,'mean field confidence should be deterministic');assert(metric.decisions===3,'only proposed fields should be counted');assert(metric.modelInferred===1&&metric.experimentBacked===2,'simple source counts retained');assert(metric.estimated===true&&metric.method==='proposed_field_confidence_mean_v2','score must be explicit and explainable');
  };

  t['Design validation binds provider output to the selected canonical variant']=function(){
    const oldModel=LF.ExperimentModel;LF.ExperimentModel={normalizeDesignProposal:function(v){return v;}};
    const proposal={solutions:[],devices:[{sample_names:['MODEL-GUESSED'],stack:[{role:'electron transport layer',material:'SnO2'}],provenance_kind:'knowledge',confidence:.3,reason:'candidate'}],unknowns:[]},ctx={outputs:{collect:{device_id:'deviceA',sample_names:['A1','A2'],unknown_fields:['stack']},infer:proposal},lastResult:proposal};
    const out=LF.ActionSteps['design.validate-coverage'](ctx);
    assert(JSON.stringify(ctx.outputs.infer.devices[0].sample_names)===JSON.stringify(['A1','A2']),'model-provided sample identity must be replaced by selected canonical scope');
    assert(out.targetDeviceId==='deviceA'&&out.actionSuccess===true&&out.applicableFields[0]==='stack','deterministic target binding/applicability result missing');
    LF.ExperimentModel=oldModel;
  };

  t['Design validation rejects an empty visual suggestion even when unknowns are listed']=function(){
    const oldModel=LF.ExperimentModel;LF.ExperimentModel={normalizeDesignProposal:function(v){return v;}};
    const proposal={solutions:[],devices:[{sample_names:['MODEL-GUESSED'],stack:[],provenance_kind:'knowledge',confidence:.3,reason:'candidate only'}],unknowns:['stack']};
    let threw=false;try{LF.ActionSteps['design.validate-coverage']({outputs:{collect:{device_id:'deviceA',sample_names:['A1'],unknown_fields:['stack']},infer:proposal},lastResult:proposal});}catch(e){threw=true;assert(/no usable solution or stack suggestion/i.test(String(e.message)),'empty suggestion gives retryable explanation');}
    assert(threw,true,'unknown-only output must not masquerade as Suggested');
    LF.ExperimentModel=oldModel;
  };

  t['Design validation keeps reviewable suggestions but removes invented Knowledge Base references']=function(){
    const oldModel=LF.ExperimentModel,oldContext=LF.ContextBuilder;
    LF.ExperimentModel={normalizeDesignProposal:function(v){return v;}};
    LF.ContextBuilder={pack:function(){return{design_evidence_summary:{retrieved_knowledge_ids:['kb_allowed']}};}};
    const proposal={solutions:[{name:'Ink',role:'absorber precursor',solutes:'perovskite precursor family',concentration:'1.2 M',preparation:'stir 12 h',knowledge_refs:['kb_fake'],provenance_kind:'knowledge',confidence:.86}],devices:[{sample_names:['MODEL'],process:{coating:'spin 4000 rpm',annealing:'100 C',atmosphere:'nitrogen'},knowledge_refs:['kb_fake','kb_allowed'],provenance_kind:'knowledge',confidence:.84,stack:[{material:'C60',thickness:'30 nm',process:'evaporate below 4e-6 torr',knowledge_refs:['kb_fake'],provenance_kind:'knowledge',confidence:.88}]}],unknowns:[]};
    const ctx={exp:{design:{devices:[],solutions:[]}},outputs:{collect:{device_id:'deviceA',sample_names:['A1'],unknown_fields:['solutions','coating','annealing','atmosphere','stack']},infer:proposal},lastResult:proposal};
    const out=LF.ActionSteps['design.validate-coverage'](ctx),clean=ctx.outputs.infer;
    assert(clean.solutions[0].knowledge_refs.length===0,'invented solution record ID removed');
    assert(clean.solutions[0].concentration==='1.2 M'&&clean.solutions[0].preparation==='stir 12 h','model-only quantities remain visible for review');
    assert(clean.solutions[0].role==='absorber precursor'&&clean.solutions[0].solutes==='perovskite precursor family','qualitative model inference is retained');
    assert(clean.solutions[0].provenance_kind==='model_inference'&&clean.solutions[0].confidence===.76,'invalid KB reference should downgrade source and reduce confidence only slightly');
    assert(JSON.stringify(clean.devices[0].knowledge_refs)===JSON.stringify(['kb_allowed']),'retrieved device record retained');
    assert(clean.devices[0].process.annealing==='100 C','quantities backed by a retrieved device record retained');
    assert(clean.devices[0].stack[0].knowledge_refs.length===0&&clean.devices[0].stack[0].thickness==='30 nm'&&clean.devices[0].stack[0].process==='evaporate below 4e-6 torr','unsourced layer values remain visible for review');
    assert(out.actionSuccess===true&&out.targetDeviceId==='deviceA','validation should stay successful after provenance cleanup');
    LF.ExperimentModel=oldModel;LF.ContextBuilder=oldContext;
  };

  t['Design apply accepts high-confidence qualitative model inference but not unsourced exact quantities']=function(){
    const proposal={solutions:[{name:'Ink',role:'absorber precursor',concentration:'1.2 M',knowledge_refs:[],provenance_kind:'model_inference',confidence:.86}],devices:[{sample_names:['A1'],solution_names:['Ink'],process:{coating:'spin 4000 rpm',annealing:'100 C',atmosphere:'N2'},knowledge_refs:[],provenance_kind:'model_inference',confidence:.86,stack:[{role:'electron transport layer',material:'C60',thickness:'30 nm',process:'evaporate 4e-6 torr',knowledge_refs:[],provenance_kind:'model_inference',confidence:.86}]}],unknowns:[]};
    LF.DesignAnalysis.sanitizeProposal(proposal,[]);
    const exp={design:{solutions:[],devices:[{id:'deviceA',name:'A',sampleNames:['A1'],solutionIds:[],stack:[],process:{coating:'',annealing:'',atmosphere:''}}]},aiDesignProposal:proposal};
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

  t['KB-backed numeric Design values may auto-apply when confidence is sufficient']=function(){
    const proposal={solutions:[],devices:[{sample_names:['A1'],process:{annealing:'100 C'},knowledge_refs:['kb_anneal'],provenance_kind:'knowledge',confidence:.84,stack:[]}],unknowns:[]};
    LF.DesignAnalysis.sanitizeProposal(proposal,['kb_anneal']);
    const exp={design:{solutions:[],devices:[{id:'d1',sampleNames:['A1'],solutionIds:[],stack:[],process:{annealing:''}}]},aiDesignProposal:proposal},out=LF.DesignAnalysis.applyAll(exp);
    assert(exp.design.devices[0].process.annealing==='100 C','supported numeric value should be applied');
    assert(out.autoApplied===1&&out.review===0,'supported numeric value should count as one safe field');
  };

  t['Mixed Design proposal reports six applied, two review and two unresolved fields']=function(){
    const proposal={solutions:[{name:'Ink',role:'absorber',solutes:'FAI + PbI2',solvents:'DMF',provenance_kind:'model_inference',confidence:.86}],devices:[{sample_names:['A1'],solution_names:['Ink'],process:{coating:'4000 rpm',annealing:'100 C',atmosphere:'N2'},provenance_kind:'model_inference',confidence:.86,stack:[]}],unknowns:['thickness','annealing time']};
    LF.DesignAnalysis.sanitizeProposal(proposal,[]);
    const exp={design:{solutions:[],devices:[{id:'d1',sampleNames:['A1'],solutionIds:[],stack:[],process:{coating:'',annealing:'',atmosphere:''}}]},aiDesignProposal:proposal},out=LF.DesignAnalysis.applyAll(exp);
    assert(out.autoApplied===6&&out.review===2&&out.unresolved===2,'mixed proposal counts should remain field-level and independent');
    assert(exp.design.devices[0].process.atmosphere==='N2'&&exp.design.devices[0].process.coating===''&&exp.design.devices[0].process.annealing==='','only the safe qualitative process value should apply');
  };

  t['Manual Design variant exposes direct gaps without requiring imported sample identity']=function(){
    const exp={sync:{revision:4},designAnalysis:{sourceRevision:4,samples:[]},design:{solutions:[],devices:[{id:'manual1',name:'New experiment',sampleNames:[],solutionIds:[],stack:[],process:{coating:'',annealing:'',atmosphere:'',notes:''},status:'user_confirmed'}]}};
    const out=LF.ActionSteps['design.collect-selected']({exp:exp,params:{deviceId:'manual1'}});
    assert(out.manual_variant===true,'new user-created variant should be recognized as manual');
    assert(JSON.stringify(out.unknown_fields.sort())===JSON.stringify(['solutions','stack'].sort()),'POC Design gaps should be limited to solution chemistry and stack');
  };

  t['Manual Design variant validation does not require canonical sample names']=function(){
    const oldModel=LF.ExperimentModel;LF.ExperimentModel={normalizeDesignProposal:function(v){return v;}};
    const proposal={summary:'candidate',solutions:[],devices:[{name:'Suggested design',sample_names:['MODEL-GUESS'],stack:[{role:'ETL',material:'SnO2',provenance_kind:'model_inference',confidence:.86,reason:'plausible'}],provenance_kind:'model_inference',confidence:.86,reason:'plausible'}],unknowns:[]};
    const ctx={outputs:{collect:{device_id:'manual1',sample_names:[],manual_variant:true,unknown_fields:['stack']},infer:proposal},lastResult:proposal};
    const out=LF.ActionSteps['design.validate-coverage'](ctx);
    assert(out.actionSuccess===true&&out.manualVariant===true,'manual variant should validate successfully');
    assert(ctx.outputs.infer.devices[0].sample_names.length===0,'provider-guessed sample identity must be removed for a manual variant');
    assert(ctx.outputs.infer.devices[0].stack[0].material==='SnO2','qualitative stack suggestion remains usable');
    LF.ExperimentModel=oldModel;
  };

  t['AI completion is deterministically applied to the selected manual variant']=function(){
    const proposal={targetDeviceId:'manual2',solutions:[],devices:[{name:'AI renamed candidate',sample_names:[],process:{atmosphere:'N2'},provenance_kind:'model_inference',confidence:.86,reason:'plausible'}],unknowns:[]};
    LF.DesignAnalysis.sanitizeProposal(proposal,[]);
    const exp={design:{solutions:[],devices:[{id:'manual1',name:'New experiment',sampleNames:[],solutionIds:[],stack:[],process:{atmosphere:''},status:'user_confirmed'},{id:'manual2',name:'New experiment',sampleNames:[],solutionIds:[],stack:[],process:{atmosphere:''},status:'user_confirmed'}]},aiDesignProposal:proposal};
    const out=LF.DesignAnalysis.applyAll(exp);
    assert(out.changed>0,'safe qualitative completion should apply');
    assert(exp.design.devices[0].process.atmosphere===''&&exp.design.devices[1].process.atmosphere==='N2','only the targetDeviceId variant should receive the completion');
  };



  t['Accept experiment applies only that saved suggestion and clears it from review']=function(){
    LF.State={state:{selectedDesignDeviceId:'a'}};
    const exp={design:{status:'reviewing',solutions:[],devices:[
      {id:'a',name:'A',sampleNames:[],solutionIds:[],stack:[],process:{},status:'user_confirmed'},
      {id:'b',name:'B',sampleNames:[],solutionIds:[],stack:[],process:{},status:'user_confirmed'}
    ]},aiDesignProposals:{
      a:{targetDeviceId:'a',solutions:[{name:'Ink A',role:'absorber',solutes:'FAI + PbI2',solvents:'DMF',provenance_kind:'model_inference',confidence:.8,reason:'candidate'}],devices:[{sample_names:[],solution_names:['Ink A'],stack:[{role:'ETL',material:'SnO2',provenance_kind:'model_inference',confidence:.8,reason:'candidate'}],provenance_kind:'model_inference',confidence:.8,reason:'candidate'}],unknowns:[]},
      b:{targetDeviceId:'b',solutions:[],devices:[{sample_names:[],stack:[{role:'HTL',material:'PTAA',provenance_kind:'model_inference',confidence:.8,reason:'candidate'}],provenance_kind:'model_inference',confidence:.8,reason:'candidate'}],unknowns:[]}
    }};
    const out=LF.DesignAnalysis.acceptProposal(exp,'a');
    assert(out.deviceId==='a'&&out.changed>0,'selected suggestion should be accepted');
    assert(exp.design.devices[0].stack[0].material==='SnO2','selected stack should be copied into editable Design');
    assert(exp.design.devices[1].stack.length===0,'other experiment must remain untouched');
    assert(exp.designAiStatus.a.state==='accepted','accepted experiment gets a simple accepted state');
    assert(!exp.aiDesignProposals.a&&!!exp.aiDesignProposals.b,'only accepted suggestion should leave the review queue');
  };

  t['Accept all suggestions validates saved experiments independently']=function(){
    LF.State={state:{selectedDesignDeviceId:'a'}};
    const exp={design:{status:'reviewing',solutions:[],devices:[
      {id:'a',name:'A',sampleNames:[],solutionIds:[],stack:[],process:{},status:'user_confirmed'},
      {id:'b',name:'B',sampleNames:[],solutionIds:[],stack:[],process:{},status:'user_confirmed'}
    ]},aiDesignProposals:{
      a:{targetDeviceId:'a',solutions:[],devices:[{sample_names:[],stack:[{role:'ETL',material:'SnO2',provenance_kind:'model_inference',confidence:.8,reason:'candidate'}],provenance_kind:'model_inference',confidence:.8,reason:'candidate'}],unknowns:[]},
      b:{targetDeviceId:'b',solutions:[],devices:[{sample_names:[],stack:[{role:'HTL',material:'PTAA',provenance_kind:'model_inference',confidence:.8,reason:'candidate'}],provenance_kind:'model_inference',confidence:.8,reason:'candidate'}],unknowns:[]}
    }};
    const out=LF.DesignAnalysis.acceptAllProposals(exp);
    assert(out.accepted===2&&out.failed.length===0,'all independent suggestions should be accepted');
    assert(exp.design.devices[0].stack[0].material==='SnO2'&&exp.design.devices[1].stack[0].material==='PTAA','each experiment keeps its own accepted stack');
    assert(Object.keys(exp.aiDesignProposals).length===0,'accepted queue should be empty');
  };

};
