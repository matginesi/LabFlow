'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/core.js');
require('../../assets/js/storage.js');
require('../../assets/js/workspace/workspace.js');
module.exports=function(t,LF){
  t['Workspace persists Ready-PV style laboratory context without credentials']=function(){
    LF.Workspace.reset({name:'Ready PV Lab',institution:'Example Institute'});
    LF.Workspace.setRoleContact('data_responsible',{name:'Data Lead',email:'lead@example.org'});
    LF.Workspace.setLocationsFromNames('Lab A\nLab B');
    LF.Workspace.setPrimaryStorage({type:'institutional_storage',locationHint:'Research storage'});
    const item=LF.Workspace.addProcess({name:'JV characterization',kind:'characterization',variables:[{name:'Scan rate',unit:'V/s'}],observables:[{name:'Voc',unit:'V'}],sampleTypes:['device']});
    const current=LF.Workspace.current();
    if(current.institution!=='Example Institute'||current.locations.length!==2||current.processes.length!==1)throw new Error('Workspace context was not persisted');
    if(item.variables[0].role!=='controlled_variable'||item.observables[0].role!=='observable')throw new Error('Quantity roles were not normalized');
    const safe=LF.Workspace.snapshot({includeContacts:false});
    if(safe.contacts[0]&&safe.contacts[0].email)throw new Error('Contact email leaked into safe snapshot');
  };
  t['Workspace binds stable workspace and process identifiers to experiments']=function(){
    LF.Workspace.reset({id:'workspace-test',name:'Lab',processes:[{id:'process-jv',name:'JV',kind:'measurement'}]});
    const exp={meta:{}};LF.Workspace.bindExperiment(exp);
    if(exp.meta.workspaceId!=='workspace-test'||exp.meta.processId!=='process-jv'||exp.meta.schemaVersion<2)throw new Error('Experiment workspace/process binding failed');
  };
  t['Workspace quantity line parser preserves name unit and description']=function(){
    const rows=LF.Workspace.parseQuantityLines('Voltage | V | Bias voltage\nCurrent | A | Recorded current','observable');
    if(rows.length!==2||rows[0].unit!=='V'||rows[1].description!=='Recorded current'||rows[0].role!=='observable')throw new Error('Quantity text parser failed');
  };
};
