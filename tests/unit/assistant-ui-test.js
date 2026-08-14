'use strict';
const fs=require('fs');
const path=require('path');

function assert(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error((label||'assert')+': expected '+JSON.stringify(expected)+' got '+JSON.stringify(actual));
}

module.exports=function(t){
  const root=path.resolve(__dirname,'../..');
  const js=fs.readFileSync(path.join(root,'assets/js/ai/assistant.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'assets/css/app.css'),'utf8');

  t['Assistant hides raw streaming transport counters and exposes semantic status']=function(){
    assert(/Waiting for provider|Thinking|Writing response/.test(js),true,'semantic streaming states');
    assert(/chunks\s*·|events\s*·|bytes\s*·/.test(js),false,'no raw transport counters in chat UI');
  };
  t['Assistant completed responses expose reasoning disclosure and useful telemetry']=function(){
    assert(js.includes('ttftMs'),true,'TTFT tracked');
    assert(js.includes('tokensPerSecond'),true,'throughput tracked');
    assert(js.includes('chat-thinking'),true,'thinking disclosure');
    assert(js.includes('finishReason'),true,'finish reason tracked');
  };
  t['Assistant visual contract uses compact flat rows']=function(){
    assert(css.includes('.assistant-panel .chat-row'),true,'message rows styled');
    assert(css.includes('.chat-thinking'),true,'thinking styled');
    assert(css.includes('.chat-metrics'),true,'metrics styled');
  };

  t['Assistant empty composer stays one line and uses a short placeholder']=function(){
    assert(js.includes("input.style.height='30px'"),true,'empty composer fixed height');
    assert(js.includes('Ask LabFlow…'),true,'short placeholder');
    assert(css.includes(':placeholder-shown'),true,'placeholder cannot grow composer');
  };

  t['Assistant user messages shrink to content and keep copy control out of normal flow']=function(){
    assert(css.includes('width:fit-content!important'),true,'user bubble fit content');
    assert(js.includes('chat-user-tools'),true,'user copy control overlay');
  };

  t['Assistant prompt hides implementation tokens and answers suggestions directly']=function(){
    const prompt=fs.readFileSync(path.join(root,'actions/assistant.chat/prompt.md'),'utf8');
    const actions=fs.readFileSync(path.join(root,'assets/js/ai/actions.js'),'utf8');
    assert(prompt.includes('Never emit opaque internal placeholder/protection markers'),true,'no protocol marker rule');
    assert(prompt.includes('paper title'),true,'direct suggestion rule');
    assert(prompt.includes('same language as the researcher'),true,'language follows researcher');
    assert(actions.includes('blank or placeholder document field is not sufficient evidence to stop'),true,'planner does not stop at placeholder');
  };

  t['Sidebar AI model status uses a two-row copy layout']=function(){
    assert(css.includes('.sidebar-status-copy'),true,'status copy styled');
    assert(css.includes('grid-template-columns:6px minmax(0,1fr)'),true,'status marker and copy grid');
  };
  return t;
};
