'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/core.js');
require('../../assets/js/storage.js');
require('../../assets/js/knowledge/kb-bundle.js');
require('../../assets/js/knowledge/knowledge-base.js');
require('../../assets/js/experiment/data-model.js');
require('../../assets/js/experiment/action-data.js');
require('../../assets/js/experiment/data-contracts.js');
require('../../assets/js/experiment/derived-state.js');
require('../../assets/js/data/parser.js');
require('../../assets/js/experiment/canonical-store.js');
require('../../assets/js/data/analysis.js');
require('../../assets/js/data/analysis-summary.js');
require('../../assets/js/experiment/design-model.js');
require('../../assets/js/cabinet/cabinet.js');
require('../../assets/js/data/dataset-corrections.js');
require('../../assets/js/experiment/design-analysis.js');
require('../../assets/js/data/pipeline.js');
require('../../assets/js/page-context.js');
require('../../assets/js/ai/context.js');
require('../../assets/js/ai/action-steps.js');
function assert(ok,msg){if(!ok)throw new Error(msg||'assertion failed');}
module.exports=function(t,LF){
  function fixture(){
    const exp=LF.DataModel.create({sourceName:'reference-demo.zip'});
    exp.meta.name='reference-demo';
    exp.samples=[{id:'s1',name:'REF',rawName:'REF',group:'REF',isRef:true,measurementIds:[]}];
    exp.design={status:'reviewing',solutions:[],devices:[{id:'ref-device',name:'REF',group:'REF',sampleIds:['s1'],sampleNames:['REF'],solutionIds:[],stack:[],process:{},status:'unknown'}]};
    LF.CanonicalStore.build(exp);
    return exp;
  }
  t['Real bundled KB fills empty Design domains even when Cabinet is empty']=function(){
    LF.Cabinet.reset({items:[]});
    const exp=fixture(),raw={status:'suggested',summary:'Minimal model output',solutions:[],stack:[],process:{},unresolved_domains:['solutions','stack','process'],unknowns:['No experiment-specific design evidence.']};
    const ctx={exp:exp,params:{deviceId:'ref-device'},outputs:{collect:{device_id:'ref-device',sample_names:['REF'],manual_variant:false,unknown_fields:['solutions','stack','process']},infer:raw},lastResult:raw};
    const out=LF.ActionSteps['design.validate-coverage'](ctx);
    assert(out.validation.referenceFallbackDomains.length===3,'real KB resolver should fill all three missing domains');
    assert(out.validation.unresolvedDomains.length===0,'usable bundled KB references should prevent empty unresolved output');
    assert(out.solutions.length>0&&out.solutions[0].provenance_kind==='knowledge_reference','solution should be a KB reference');
    assert(out.devices[0].stack.length>=3&&out.devices[0].stack.every(function(x){return x.provenance_kind==='knowledge_reference';}),'stack should be a coherent KB reference');
    assert(out.devices[0].process.provenance_kind==='knowledge_reference','process should be a KB reference');
    assert(out.solutions[0].confidence>=0.55,'KB-backed candidate should have a meaningful review confidence');
  };
};
