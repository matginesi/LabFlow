'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/core.js');
require('../../assets/js/experiment/data-model.js');
require('../../assets/js/experiment/derived-state.js');
require('../../assets/js/state.js');
require('../../assets/js/storage.js');
require('../../assets/js/knowledge/kb-bundle.js');
require('../../assets/js/knowledge/knowledge-base.js');
require('../../assets/js/ai/providers.js');
require('../../assets/js/ai/action-registry.js');
require('../../assets/js/ai/contracts.js');
require('../../assets/js/experiment/design-model.js');
require('../../assets/js/cabinet/cabinet.js');
require('../../assets/js/ai/actions.js');
require('../../assets/js/ai/assistant.js');

module.exports=function(t,LF){
  t['Structure catalog is valid and covers canonical, workspace, reference, AI and runtime boundaries']=function(){
    const validation=LF.Structures.validate();
    if(!validation.ok)throw new Error(validation.errors.join('; '));
    const ids=new Set(LF.Structures.list().map(function(x){return x.id;}));
    [
      'experiment.aggregate','experiment.action-data','runtime.application-state','runtime.ui-state','action.active-run',
      'cabinet.state','cabinet.context','knowledge.entry','knowledge.source','knowledge.context',
      'ai.settings','assistant.settings','ai.provider','action.definition','action.execution-run',
      'action.execution-outcome','assistant.message'
    ].forEach(function(id){if(!ids.has(id))throw new Error('Missing structure definition: '+id);});
    if(validation.count<30)throw new Error('Structure catalog unexpectedly small: '+validation.count);
  };
  t['Structure ownership filters make extension boundaries discoverable']=function(){
    const cabinet=LF.Structures.list({owner:'Cabinet'}),domain=LF.Structures.list({owner:'DomainSchema'});
    if(!cabinet.some(function(x){return x.id==='cabinet.item.solution';}))throw new Error('Cabinet owner filter missing formulation structure');
    if(!domain.some(function(x){return x.id==='experiment.aggregate';}))throw new Error('DomainSchema owner filter missing aggregate');
    const aggregate=LF.Structures.describe('experiment.aggregate');
    if(!aggregate||aggregate.fields.design.owner!=='design'||aggregate.fields.actionData.owner!=='actions')throw new Error('Aggregate field ownership is not exposed');
  };
  t['Every generated Action definition is represented in the structure catalog']=function(){
    LF.ActionRegistry.actions().forEach(function(id){
      if(!LF.Structures.describe('action.definition.'+id))throw new Error('Action contract not registered: '+id);
    });
  };
};
