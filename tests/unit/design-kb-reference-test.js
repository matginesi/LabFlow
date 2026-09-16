'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/core.js');
require('../../assets/js/storage.js');
require('../../assets/js/knowledge/kb-bundle.js');
require('../../assets/js/knowledge/knowledge-base.js');
require('../../assets/js/experiment/data-model.js');
require('../../assets/js/experiment/design-model.js');
require('../../assets/js/data/parser.js');
require('../../assets/js/experiment/canonical-store.js');
require('../../assets/js/data/analysis.js');
require('../../assets/js/data/analysis-summary.js');
require('../../assets/js/experiment/design-analysis.js');

function assert(ok,msg){if(!ok)throw new Error(msg||'assertion failed');}
module.exports=function(t,LF){
  t['Design keeps a real KB citation as review-only knowledge_reference']=function(){
    const proposal={solutions:[{name:'Referenced ink',role:'absorber precursor',solutes:'FAI + PbI2',solvents:'DMF + DMSO',evidence:'KB:formulation.perovskite-precursor-family',provenance_kind:'knowledge_reference',confidence:.9}],devices:[],unknowns:[],unresolved_domains:[]};
    const stats=LF.DesignAnalysis.sanitizeProposal(proposal);
    assert(proposal.solutions[0].provenance_kind==='knowledge_reference','valid bundled KB id should survive');
    assert(stats.knowledgeItems===1,'knowledge-backed item should be counted');
    assert(proposal.solutions[0].field_decisions.every(function(x){return x.auto_apply===false;}),'KB-backed values must remain review-only');
  };
  t['Design downgrades an invented KB citation to model_inference']=function(){
    const proposal={solutions:[{name:'Fake referenced ink',role:'absorber precursor',solutes:'X',solvents:'Y',evidence:'KB:not.a.real.entry',provenance_kind:'knowledge_reference',confidence:.9}],devices:[],unknowns:[],unresolved_domains:[]};
    LF.DesignAnalysis.sanitizeProposal(proposal);
    assert(proposal.solutions[0].provenance_kind==='model_inference','invented KB ids must not acquire reference authority');
  };
  return t;
};
