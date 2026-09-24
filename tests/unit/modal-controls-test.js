'use strict';
const fs=require('fs');
const path=require('path');
function assert(actual,expected,label){if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error((label||'assert')+': expected '+JSON.stringify(expected)+' got '+JSON.stringify(actual));}
module.exports=function(t){
  const root=path.resolve(__dirname,'../..');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const feedback=fs.readFileSync(path.join(root,'assets/js/ui/feedback.js'),'utf8');
  const app=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
  const uiCss=fs.readFileSync(path.join(root,'assets/css/ui.css'),'utf8');
  const designPage=fs.readFileSync(path.join(root,'assets/js/pages/design-page.js'),'utf8');
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
    assert(feedback.includes("event.key === 'Escape'")&&feedback.includes('openModalSurface'),true,'shared modal Escape handler');
    assert(app.includes("ev.key==='Escape'&&!LF.UI.isActivityOpen()&&S.state.ui.resultInspectorId"),true,'inspector Escape handler');
  };

  t['Action Technical details stays under user control while progress re-renders']=function(){
    assert(feedback.includes("const technical = byId('activityTechnical');"),true,'technical disclosure is explicitly reset with the Activity lifecycle');
    assert(feedback.includes("if (technical) technical.open = false;"),true,'new Activity starts collapsed');
    const payloadBody=feedback.slice(feedback.indexOf('function renderActivityPayloads()'),feedback.indexOf('function hasActiveCancellationTarget()'));
    assert(payloadBody.includes('technical.open=false')||payloadBody.includes('technical.open = false'),false,'payload/progress render must not close user-open diagnostics');
  };
  t['Confirmation Cancel is a bordered secondary control']=function(){
    assert(html.includes('class="button" type="button" id="messageTotemCancel"'),true,'Cancel uses canonical bordered button');
    assert(html.includes('class="button ghost" type="button" id="messageTotemCancel"'),false,'Cancel is not borderless ghost');
  };
  t['Hidden optional Totem actions cannot become empty visible buttons']=function(){
    assert(uiCss.includes('.button[hidden] { display: none !important; }'),true,'hidden wins over generic button display');
  };
  t['Design Discard uses a bordered secondary control']=function(){
    assert(designPage.includes('<button class="button compact" type="button" data-discard-design-experiment='),true,'Discard is bordered');
    assert(designPage.includes('<button class="button ghost compact" type="button" data-discard-design-experiment='),false,'Discard is not ghost');
  };
  t['Action Totem closes by its button, Escape, or a 5 second idle window']=function(){
    assert(feedback.includes('const ACTIVITY_IDLE_CLOSE_MS = 5000;'),true,'idle close window is 5 seconds');
    assert(feedback.includes("if (event.key !== 'Escape' || !activity) return;"),true,'Escape targets the Action Totem');
    assert(feedback.includes('else activityHide();'),true,'Escape closes a terminal totem');
    assert(feedback.includes('scheduleActivityHide(input.holdMs);'),true,'terminal totems arm the idle window');
    const fixedHides=feedback.match(/scheduleActivityHide\([^)]*,\s*(?:\d|activity\.showAiTrace)/g)||[];
    assert(fixedHides,[],'no fixed short auto-hide remains');
    assert(feedback.includes('function activityInteracted()'),true,'interaction restarts the idle window');
    assert(feedback.includes("if (activity && activity.status !== 'running') scheduleActivityHide();"),true,'a running Action is never auto-hidden');
    assert(feedback.includes("['pointerdown','pointermove','keydown','wheel','touchstart','focusin']"),true,'interaction listeners are bound inside the totem');
    assert(feedback.includes("byId('activityClose')"),true,'dedicated close control remains');
  };
  return t;
};
