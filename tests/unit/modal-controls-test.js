'use strict';
const fs=require('fs');
const path=require('path');
function assert(actual,expected,label){if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error((label||'assert')+': expected '+JSON.stringify(expected)+' got '+JSON.stringify(actual));}
module.exports=function(t){
  const root=path.resolve(__dirname,'../..');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const feedback=fs.readFileSync(path.join(root,'assets/js/ui/feedback.js'),'utf8');
  const app=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
  t['modal surfaces expose explicit cancel or close controls']=function(){
    assert(html.includes('id="activityCancel"'),true,'Action cancel button');
    assert(html.includes('id="activityClose"'),true,'Action close button');
    assert(html.includes('id="messageTotemCancel"'),true,'confirmation cancel button');
    assert(html.includes('id="resultInspectorClose"'),true,'inspector close button');
  };
  t['Escape cancels running Actions and closes terminal or inspector dialogs']=function(){
    assert(feedback.includes("if (activity.status === 'running') activityCancel();"),true,'Escape cancels active Action');
    assert(feedback.includes("LF.ActionRunner.isRunning()"),true,'running ActionRunner exposes Stop even if caller omitted cancellable flag');
    assert(feedback.includes("cancel.textContent = activity.cancelling ? 'Stopping…' : 'Stop';"),true,'running Action uses explicit Stop label');
    assert(feedback.includes('else activityHide();'),true,'Escape closes terminal Action');
    assert(feedback.includes("event.key==='Escape'"),true,'confirmation Escape handler');
    assert(app.includes("ev.key==='Escape'&&!LF.UI.isActivityOpen()&&S.state.resultInspectorId"),true,'inspector Escape handler');
  };
  return t;
};
