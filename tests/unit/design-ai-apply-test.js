'use strict';
require('../../assets/js/logger.js');
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

  t['Design decision metric caps knowledge-only confidence and rewards sourced evidence']=function(){
    const metric=LF.DesignDecisionMetric.calculate({solutions:[{confidence:.95,provenance_kind:'knowledge'}],devices:[{confidence:.9,provenance_kind:'evidence',evidence:'RAW metadata',process:{annealing:'100 C'},stack:[{confidence:.88,provenance_kind:'evidence',evidence:'source row'}]}]});
    assert(metric.value===74,'evidence-weighted score should be deterministic');assert(metric.decisions===3,'solution, process and layer decisions counted');assert(metric.knowledgeOnly===1&&metric.evidenceBacked===2,'provenance counts retained');assert(metric.estimated===true,'score must be explicitly estimated');
  };

  t['Design validation binds provider output to the selected canonical variant']=function(){
    const oldModel=LF.ExperimentModel;LF.ExperimentModel={normalizeDesignProposal:function(v){return v;}};
    const proposal={solutions:[],devices:[{sample_names:['MODEL-GUESSED'],stack:[{role:'electron transport layer',material:'SnO2'}],provenance_kind:'knowledge',confidence:.3,reason:'candidate'}],unknowns:[]},ctx={outputs:{collect:{device_id:'deviceA',sample_names:['A1','A2'],unknown_fields:['stack']},infer:proposal},lastResult:proposal};
    const out=LF.ActionSteps['design.validate-coverage'](ctx);
    assert(JSON.stringify(ctx.outputs.infer.devices[0].sample_names)===JSON.stringify(['A1','A2']),'model-provided sample identity must be replaced by selected canonical scope');
    assert(out.binding==='selected-design-variant'&&out.covered===2&&out.applicableFields[0]==='stack','deterministic binding/applicability result missing');
    LF.ExperimentModel=oldModel;
  };

  t['Design validation rejects a successful-looking proposal that cannot fill anything']=function(){
    const oldModel=LF.ExperimentModel;LF.ExperimentModel={normalizeDesignProposal:function(v){return v;}};
    const proposal={solutions:[],devices:[{sample_names:['MODEL-GUESSED'],provenance_kind:'knowledge',confidence:.3,reason:'candidate only'}],unknowns:['stack']};
    let error=null;try{LF.ActionSteps['design.validate-coverage']({outputs:{collect:{device_id:'deviceA',sample_names:['A1'],unknown_fields:['stack']},infer:proposal},lastResult:proposal});}catch(err){error=err;}
    assert(error&&error.code==='MODEL_OUTPUT_INVALID'&&error.isContract===true,'non-actionable proposal must fail the Action contract');
    LF.ExperimentModel=oldModel;
  };

  t['Design validation rejects invented Knowledge Base references and untraceable quantities']=function(){
    const oldModel=LF.ExperimentModel,oldContext=LF.ContextBuilder;
    LF.ExperimentModel={normalizeDesignProposal:function(v){return v;}};
    LF.ContextBuilder={pack:function(){return{design_evidence_summary:{retrieved_knowledge_ids:['kb_allowed']}};}};
    const proposal={solutions:[{name:'Ink',role:'absorber precursor',solutes:'perovskite precursor family',concentration:'1.2 M',preparation:'stir 12 h',knowledge_refs:['kb_fake'],provenance_kind:'knowledge'}],devices:[{sample_names:['MODEL'],process:{coating:'spin 4000 rpm',annealing:'100 C',atmosphere:'nitrogen'},knowledge_refs:['kb_fake','kb_allowed'],provenance_kind:'knowledge',stack:[{material:'C60',thickness:'30 nm',process:'evaporate below 4e-6 torr',knowledge_refs:['kb_fake'],provenance_kind:'knowledge'}]}],unknowns:[]};
    const ctx={exp:{design:{devices:[],solutions:[]}},outputs:{collect:{device_id:'deviceA',sample_names:['A1'],unknown_fields:['solutions','coating','annealing','atmosphere','stack']},infer:proposal},lastResult:proposal};
    const out=LF.ActionSteps['design.validate-coverage'](ctx),clean=ctx.outputs.infer;
    assert(clean.solutions[0].knowledge_refs.length===0,'invented solution record ID removed');
    assert(clean.solutions[0].concentration===''&&clean.solutions[0].preparation==='','untraceable solution quantities removed');
    assert(clean.solutions[0].role==='absorber precursor'&&clean.solutions[0].solutes==='perovskite precursor family','qualitative LLM fallback is retained');
    assert(clean.solutions[0].confidence===.25&&/Model-knowledge fallback/.test(clean.solutions[0].reason),'unsourced LLM fallback is retained but confidence-capped');
    assert(JSON.stringify(clean.devices[0].knowledge_refs)===JSON.stringify(['kb_allowed']),'retrieved device record retained');
    assert(clean.devices[0].process.annealing==='100 C','quantities backed by a retrieved device record retained');
    assert(clean.devices[0].stack[0].knowledge_refs.length===0&&clean.devices[0].stack[0].thickness===''&&clean.devices[0].stack[0].process==='','untraceable layer quantities removed');
    assert(out.knowledge.rejectedKnowledgeRefs===3&&out.knowledge.strippedQuantities===4&&out.knowledge.llmFallbackItems===2,'validation reports rejected references, stripped values and LLM fallbacks');
    LF.ExperimentModel=oldModel;LF.ContextBuilder=oldContext;
  };

};
