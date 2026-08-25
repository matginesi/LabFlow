'use strict';
const fs=require('fs');
const path=require('path');

function assert(actual,expected,label){if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error((label||'assert')+': expected '+JSON.stringify(expected)+' got '+JSON.stringify(actual));}

module.exports=function(t){
  const root=path.resolve(__dirname,'../..');
  const js=fs.readFileSync(path.join(root,'assets/js/ai/assistant.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'assets/css/app.css'),'utf8');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const context=fs.readFileSync(path.join(root,'assets/js/ai/context.js'),'utf8');

  t['01 one request creates exactly one durable Assistant response']=function(){assert((js.match(/role:'assistant',content:'',state:'requesting'/g)||[]).length,1,'single pending message creation');assert(js.includes("push(exp,{role:'user',content:text},false)"),true,'user and Assistant form one turn');};
  t['02 spinner is present in the initial requesting state']=function(){assert(js.includes('pending?transientHtml(m)'),true,'requesting state renders transient');assert(js.includes('chat-spinner'),true,'spinner markup exists');};
  t['03 first useful content hides the spinner']=function(){assert(js.includes("if(content){run.message.state='streaming'"),true,'content changes state');assert(js.includes("status.hidden=true;status.innerHTML=''"),true,'content removes transient spinner');};
  t['04 completion always closes transient state']=function(){assert(js.includes("state:'complete'"),true,'completion state');assert(js.includes("if(message.state==='requesting'||message.state==='streaming')message.state="),true,'finally closes transient state');};
  t['05 error reuses message and has no spinner']=function(){assert(js.includes("state:'error'"),true,'error state');assert(js.includes('data-retry-message'),true,'same message exposes retry');};
  t['06 abort becomes a clean cancelled message']=function(){assert(js.includes("out.status==='aborted'"),true,'Action abort handled');assert(js.includes("state:'cancelled'"),true,'cancelled state');assert(js.includes('LF.ActionRunner.cancel'),true,'existing cancellation API used');};
  t['07 thinking never creates a second bubble']=function(){assert(js.includes('chat-thinking'),false,'legacy thinking bubble removed');assert(js.includes("if(reasoning)run.message.reasoning=reasoning"),true,'reasoning stays on same message');};
  t['08 reasoning and telemetry use closed Details']=function(){assert(js.includes('<details class="chat-details"><summary>Details</summary>'),true,'details has no open attribute');assert(js.includes('Reasoning details'),true,'reasoning is secondary');};
  t['09 streamed text updates the current message body']=function(){assert(js.includes('body.innerHTML=answerHtml(run.message)'),true,'targeted body update');assert(js.includes('messageNode(run.message.id)'),true,'message identity retained');};
  t['10 chunks do not render or append response containers']=function(){const progress=js.slice(js.indexOf('function syncProgress'),js.indexOf('function syncFinal'));assert(progress.includes('render('),false,'no full render per progress event');assert(progress.includes('createElement'),false,'no response node per chunk');};
  t['11 normal responses have no vertical scroll container']=function(){assert(/\.chat-body\s*\{[^}]*overflow-y/s.test(css),false,'no body vertical overflow');assert(/\.chat-message(?:\.ai)?\s*\{[^}]*max-height/s.test(css),false,'no response max height');};
  t['12 thinking has no nested scroll container']=function(){assert(css.includes('.chat-thinking'),false,'legacy scrolling thinking component removed');assert(/\.chat-transient\s*\{[^}]*overflow/s.test(css),false,'transient does not scroll');};
  t['13 conversation is the sole ordinary vertical scroll area']=function(){assert(/\.chat-log\s*\{[^}]*overflow-y:auto/s.test(css),true,'conversation scrolls');assert(/\.chat-details-body\s*\{[^}]*overflow-y/s.test(css),false,'details grows naturally');};
  t['14 concurrent send cannot leave a second spinner']=function(){assert(js.includes("if(!text||active||runnerBusy()"),true,'active turn blocks another send');assert(js.includes('if(active){cancel();return;}'),true,'Send becomes Stop while active');};
  t['15 Action results are compact system events']=function(){assert(js.includes("role:'system'"),true,'Action uses system role');assert(js.includes('chat-event'),true,'compact event markup');assert(css.includes('.chat-event {'),true,'event styling exists');};
  t['16 page context is shown once in the header']=function(){assert(html.includes('assistantContextPayload'),true,'header disclosure retained');assert(js.includes('updateHeader(has)'),true,'context refreshes');assert(js.includes('assistant-context-card'),false,'duplicate conversation context removed');};
  t['17 Knowledge Base and context contracts stay connected']=function(){assert(context.includes("LF.KnowledgeBase.search"),true,'Knowledge Base lookup preserved');assert(context.includes("profile==='assistant'"),true,'Assistant context pack preserved');assert(context.includes("m.role==='user'||m.role==='assistant'"),true,'events excluded from memory');};
  t['18 Markdown continues to render both stream and final answer']=function(){assert(js.includes('return clean?C.markdown(clean)'),true,'answer Markdown');assert(js.includes('body.innerHTML=answerHtml(run.message)'),true,'stream Markdown');};
  t['19 Enter sends while Shift Enter remains multiline']=function(){assert(js.includes("e.key==='Enter'&&!e.shiftKey"),true,'keyboard contract');assert(js.includes('e.preventDefault();go();'),true,'Enter submits');};
  t['20 spinner cleanup is structural rather than cosmetic']=function(){assert(js.includes('finally{'),true,'finally cleanup');assert(js.includes('clearInterval(run.clock)'),true,'clock cleanup');assert(js.includes('setTimeout'),false,'no cosmetic spinner timeout');};
  t['Assistant retains useful telemetry behind Details']=function(){['ttftMs','usage','finishReason','requestCount','responseBytes','requestLogId'].forEach(function(key){assert(js.includes(key),true,key+' retained');});};
  t['Assistant composer remains compact and provider prompt contract stays intact']=function(){const prompt=fs.readFileSync(path.join(root,'actions/assistant.chat/prompt.md'),'utf8');assert(js.includes("input.style.height='30px'"),true,'compact composer');assert(css.includes(':placeholder-shown'),true,'one-line placeholder');assert(prompt.includes('same language as the researcher'),true,'language contract');};
  return t;
};
