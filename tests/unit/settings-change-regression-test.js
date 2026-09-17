'use strict';
const fs=require('fs'),path=require('path');
require('../../assets/js/controllers/settings-controller.js');
module.exports=function(t,LF,ctx){
  function assert(value,label){if(!value)throw new Error(label||'assertion failed');}
  t['Unhandled Settings changes stay in the draft form and do not trigger a catch-all render']=function(){
    let renders=0;
    const handled=LF.SettingsController.handleChange({target:{id:'aiRememberKey',value:'',checked:true}},{state:{state:{ui:{}}},render:function(){renders++;}});
    assert(handled===false,'Remember-key checkbox should not be treated as a provider navigation event');
    assert(renders===0,'Remember-key checkbox must not render the Settings page');
    const source=fs.readFileSync(path.join(ctx.root,'assets/js/app.js'),'utf8');
    assert(source.indexOf("handleChange(e,{state:S,render:render}))return;{")<0,'app change listener must not have a stray catch-all render after SettingsController');
  };
};
