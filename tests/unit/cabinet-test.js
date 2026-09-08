'use strict';
require('../../assets/js/core.js');
require('../../assets/js/cabinet/cabinet.js');
module.exports=function(t,LF){
 t['Cabinet snapshot is detached and later Cabinet edits do not mutate Design copy']=function(){LF.Cabinet.reset({items:[]});const item=LF.Cabinet.create('solution',{name:'Ink A',role:'absorber',solutes:'FAI'}),exp={design:{solutions:[],devices:[{id:'d1',solutionIds:[],stack:[],process:{}}]}};LF.Cabinet.applyToDesign(exp,'d1',item.id);const sol=exp.design.solutions[0];LF.Cabinet.update(item.id,{solutes:'FAI, PbI2'});if(sol.solutes!=='FAI')throw new Error('Design snapshot mutated after Cabinet edit');if(!sol.cabinetRef||sol.cabinetRef.cabinetId!==item.id)throw new Error('Cabinet provenance missing');};
 t['Cabinet process protocol snapshots into selected Design experiment']=function(){LF.Cabinet.reset({items:[]});const p=LF.Cabinet.create('protocol',{name:'Spin',coating:'spin coating',atmosphere:'N2'}),exp={design:{solutions:[],devices:[{id:'d1',solutionIds:[],stack:[],process:{coating:'',annealing:'',atmosphere:'',notes:''}}]}};LF.Cabinet.applyToDesign(exp,'d1',p.id);if(exp.design.devices[0].process.coating!=='spin coating'||exp.design.devices[0].process.atmosphere!=='N2')throw new Error('Protocol not applied');if(!exp.design.devices[0].processSourceRef)throw new Error('Protocol source ref missing');};
};
