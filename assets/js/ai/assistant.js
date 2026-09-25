/*
 * Assistant UI/controller with deterministic routing and a bounded provider fallback.
 * Boundary: LabFlow resolves scope and facts first; the model is used only for questions that need interpretation.
 */
(function(){
'use strict';
const LF=window.LabFlow=window.LabFlow||{},C=LF.Core,Log=LF.Logger?LF.Logger.scope('assistant'):null;let active=null;
function configured(){const s=LF.Storage.getAiSettings(),p=(LF.AIProviders&&LF.AIProviders[s.provider])||{},key=LF.Storage.getApiKey(s.provider);if(!s.endpoint||!s.model||(p.keyRequired&&!key)){LF.UI.message('Configure the AI provider in Settings first.','warning');LF.State.state.ui.settingsSection='provider';LF.State.setRoute('settings');return false;}return true;}
function runnerBusy(){return!!(LF.ActionRunner&&LF.ActionRunner.isRunning());}
function conversation(exp){const d=LF.State.ensureDerived(exp);d.chat=d.chat||{conversation:[]};d.chat.conversation=Array.isArray(d.chat.conversation)?d.chat.conversation:[];return d.chat.conversation;}
function push(exp,msg,notify){const ctx=contextSnapshot(),item=Object.assign({id:C.uid('msg'),createdAt:new Date().toISOString(),route:String(LF.State&&LF.State.state&&LF.State.state.ui.route||''),page:String(ctx.page||''),view:String(ctx.view||'')},msg);conversation(exp).push(item);if(notify!==false&&LF.State&&LF.State.notify)LF.State.notify('assistant');return item;}
function compact(v){const raw=C.cleanModelText?C.cleanModelText(v):String(v||'');return raw.replace(/\r\n/g,'\n').replace(/\n[ \t]*\n+/g,'\n');}
function parseJson(text){const raw=String(text||'').trim();if(!/^[\[{]/.test(raw))return null;try{const v=JSON.parse(raw);return v&&typeof v==='object'?v:null;}catch(_){return null;}}
function jsonHtml(v){const raw=JSON.stringify(v,null,2),highlighted=C.highlightCode?C.highlightCode(raw,'json'):C.escapeHtml(raw);return '<div class="structured-response"><pre class="json-highlight"><code>'+highlighted+'</code></pre></div>';}
function fmtMs(ms){const n=Number(ms);return Number.isFinite(n)?(n<1000?Math.round(n)+' ms':(n/1000).toFixed(n<10000?1:0)+' s'):'—';}
function fmtBytes(value){const n=Number(value);if(!Number.isFinite(n))return'—';if(n<1024)return Math.round(n)+' B';if(n<1048576)return(n/1024).toFixed(1)+' KB';return(n/1048576).toFixed(1)+' MB';}
function routeBadge(m){const mode=String(m.executionMode||(m.model==='deterministic'?'local':'')||'').toLowerCase();
  if(mode==='local')return '<span class="chat-route-badge local" title="Answered by LabFlow without a provider request">LOCAL · 0 tokens</span>';
  if(mode==='routed-local')return '<span class="chat-route-badge local" title="Intent classified by a tiny provider request; answer computed by LabFlow">LOCAL · LLM router</span>';
  if(mode==='llm')return '<span class="chat-route-badge ai" title="Answered with the configured AI provider">LLM</span>';
  return'';}
function requestContextMeta(info){const request=info&&info.request||{},body=request.body||{},messages=Array.isArray(body.messages)?body.messages:[],meta={
  messageCount:messages.length,messageChars:messages.reduce(function(n,m){return n+String(m&&m.content||'').length;},0),
  inputTokens:Number(info&&info.inputTokens)||null,inputCapTokens:Number(info&&info.inputCapTokens)||null,
  maxTokens:Number(info&&info.maxTokens)||null,targetTokens:Number(info&&info.targetTokens)||null,
  reasoningReserveTokens:Number(info&&info.reasoningReserveTokens)||0,allowedKbIds:[],knowledgeCount:0,evidenceCount:0,
  measurementCount:0,sampleCount:0};
  const user=messages.filter(function(m){return m&&m.role==='user';}).map(function(m){return String(m.content||'');}).join('\n');
  const match=user.match(/<research_context_pack>\s*([\s\S]*?)\s*<\/research_context_pack>/i);
  if(match)try{const ctx=JSON.parse(match[1]),entries=ctx&&ctx.knowledge&&Array.isArray(ctx.knowledge.entries)?ctx.knowledge.entries:[],facts=ctx&&ctx.facts||{};
    meta.allowedKbIds=entries.map(function(x){return String(x&&x.id||'');}).filter(Boolean);meta.knowledgeCount=meta.allowedKbIds.length;
    meta.evidenceCount=Array.isArray(facts.open_findings)?facts.open_findings.length:0;meta.measurementCount=Array.isArray(facts.measurements)?facts.measurements.length:0;
    meta.sampleCount=Array.isArray(facts.samples)?facts.samples.length:0;
  }catch(_){}
  return meta;}
function validateKbAnswer(text,allowedIds){const raw=String(text||''),allowed=new Set((allowedIds||[]).map(String)),ids=[],re=/\[KB\\?:([A-Za-z0-9._:-]+)\]/g;let m;
  while((m=re.exec(raw)))if(!ids.includes(m[1]))ids.push(m[1]);const invalid=ids.filter(function(id){return!allowed.has(id);});
  if(!invalid.length)return{ok:true,content:raw,citations:ids,invalid:[]};
  return{ok:false,content:'I could not verify the Knowledge Base references returned by the model, so LabFlow rejected that answer instead of presenting it as grounded. Please retry or ask a narrower question.',citations:ids,invalid:invalid};}
function captureRequest(run,info){const meta=requestContextMeta(info);run.requestContext=meta;run.allowedKbIds=meta.allowedKbIds;}
function syncAssistantPhase(run,info){if(!active||active!==run)return;const phase=String(info&&info.phase||'');
  if(phase==='prepare')updateTransient(run,'LLM · Preparing context');
  else if(phase==='request')updateTransient(run,'LLM · Waiting for provider');
  else if(phase==='validate')updateTransient(run,'LLM · Validating answer');
}
function answerHtml(m){const env=m&&m.envelope;if(env&&env.answer)return C.markdown(env.answer);const clean=compact(m.content||''),detected=!m.structured?parseJson(clean):null;if(m.structured||detected)return jsonHtml(m.structured||detected);return clean?C.markdown(clean):'';}
// Envelope extras reuse existing help/notice primitives; the answer prose stays in the message body.
function envelopeExtra(m){const env=m&&m.envelope;if(!env)return'';
  const basis=Array.isArray(env.basis)?env.basis.filter(Boolean):[];
  const basisHtml=basis.length?'<div class="help chat-envelope-basis">Basis · '+C.escapeHtml(basis.join(', '))+'</div>':'';
  const unknownHtml=env.unknown?'<div class="notice info compact-notice"><strong>Unknown</strong><span>'+C.markdown(env.unknown)+'</span></div>':'';
  return basisHtml+unknownHtml;}
function copyButton(id){return '<button class="button ghost compact icon-only chat-copy" type="button" data-copy-message="'+C.escapeHtml(id)+'" aria-label="Copy message" title="Copy">'+(LF.Icons?LF.Icons.icon('copy'):'⧉')+'</button>';}
function detailRows(m){const u=m.usage||{},rows=[],providerUsed=Number(m.requestCount)>0||m.executionMode==='llm'||m.executionMode==='routed-local';function row(label,value){if(value==null||value==='')return;
rows.push('<div><dt>'+C.escapeHtml(label)+'</dt><dd>'+C.escapeHtml(String(value))+'</dd></div>');
  }if(m.executionMode){const label=m.executionMode==='local'?'Deterministic · no provider':m.executionMode==='routed-local'?'Deterministic answer · LLM intent router':'LLM answer';row('Execution',label);}
  if(m.routeReason)row('Route',m.routeReason);
  if(m.routeCached)row('Intent routing','Reused cached route');
  if(m.focusLabel)row('Conversation focus',m.focusLabel);
  if(m.envelopeWarning)row('Answer grounding',m.envelopeWarning);
  if(m.intent)row('Intent',m.intent);if(m.scopeLabel)row('Scope',m.scopeLabel);
  if(providerUsed&&(m.provider||m.model))row('Provider / model',(m.provider||'—')+' / '+(C.modelDisplayName?C.modelDisplayName(m.provider,m.model||'—'):(m.model||'—')));
  if(Number.isFinite(Number(m.latencyMs)))row('Total turn',fmtMs(m.latencyMs));
  if(providerUsed&&Number(m.requestCount)>0)row('Provider calls',Number(m.requestCount));
  if(Number(m.routerCalls)>0)row('Intent-router calls',Number(m.routerCalls));
  if(providerUsed&&Number.isFinite(Number(m.providerElapsedMs)))row('Provider time',fmtMs(m.providerElapsedMs));
  if(providerUsed&&Number.isFinite(Number(m.ttftMs)))row('Final TTFT',fmtMs(m.ttftMs));
  if(providerUsed&&Number.isFinite(Number(m.tokensPerSecond)))row('Throughput',Number(m.tokensPerSecond).toFixed(1)+' tok/s');
  if(providerUsed&&(m.thinkingMode||m.thinkingEffective))row('Reasoning',[(m.thinkingMode||'auto')+' requested',m.thinkingEffective?m.thinkingEffective+' effective':'',m.reasoningObserved?'observed':''].filter(Boolean).join(' · '));
  if(providerUsed&&Number.isFinite(Number(u.totalTokens)))row('Usage',Number(u.promptTokens||0).toLocaleString()+' input · '+Number(u.completionTokens||0).toLocaleString()+' output · '+Number(u.totalTokens).toLocaleString()+' total'+(u.estimated?' · estimated':''));
  if(m.executionMode==='llm'&&Number.isFinite(Number(m.contextTokens)))row('Answer context input',Math.round(Number(m.contextTokens)).toLocaleString()+' tok');
  if(m.executionMode==='llm'&&Number.isFinite(Number(m.contextChars)))row('Answer context size',Math.round(Number(m.contextChars)).toLocaleString()+' chars');
  if(m.executionMode==='llm'&&Number.isFinite(Number(m.completionBudgetTokens)))row('Answer output budget',Math.round(Number(m.completionBudgetTokens)).toLocaleString()+' tok');
  if(m.executionMode==='llm'&&Number.isFinite(Number(m.answerTargetTokens)))row('Answer target',Math.round(Number(m.answerTargetTokens)).toLocaleString()+' tok');
  if(m.executionMode==='llm'&&Number.isFinite(Number(m.reasoningReserveTokens)))row('Reasoning reserve',Math.round(Number(m.reasoningReserveTokens)).toLocaleString()+' tok');
  if(m.executionMode==='llm'&&Number.isFinite(Number(m.contextMessageCount)))row('Answer context messages',Number(m.contextMessageCount));
  if(m.executionMode==='llm'&&Number.isFinite(Number(m.evidenceItemsSupplied)))row('Evidence items supplied',Number(m.evidenceItemsSupplied));
  if(m.executionMode==='llm'&&Number.isFinite(Number(m.measurementsSupplied)))row('Measurements supplied',Number(m.measurementsSupplied));
  if(m.executionMode==='llm'&&Number.isFinite(Number(m.samplesSupplied)))row('Samples supplied',Number(m.samplesSupplied));
  if(m.executionMode==='llm'&&Number.isFinite(Number(m.kbEntriesSupplied)))row('KB entries supplied',Number(m.kbEntriesSupplied));
  if(m.executionMode==='llm'&&m.groundingWarning)row('Grounding',m.groundingWarning);
  if(providerUsed&&Number.isFinite(Number(m.responseBytes)))row('Response payloads',fmtBytes(m.responseBytes));
  if(providerUsed&&m.streamed!=null)row('Answer transport',m.executionMode==='llm'?(m.streamed?'Streamed':'Non-streaming'):'Non-streaming router');
  if(m.finishReason)row('Finish reason',m.finishReason);if(providerUsed&&m.requestId)row('Request ID',m.requestId);
  if(providerUsed&&m.requestLogId)row('Log correlation',m.requestLogId);return rows;}
function detailsHtml(m,event){const reasoning=compact(m.reasoning||''),rows=detailRows(m),
structured=event&&m.structured?jsonHtml(m.structured):'';if(!reasoning&&!rows.length&&!structured)return'';
  return '<details class="chat-details"><summary>Details</summary><div class="chat-details-body">'+
  (structured?'<section><strong>Structured Action output</strong>'+structured+'</section>':'')+
  (reasoning?'<section><strong>Reasoning details</strong><div class="markdown-view">'+C.markdown(reasoning)+
  '</div></section>':'')+(rows.length?'<dl>'+rows.join('')+'</dl>':'')+'</div></details>';}
function transientHtml(m){const label=m.statusLabel||'Thinking';return '<div class="chat-transient" data-chat-status role="status" aria-live="polite"><span class="chat-thinking-dot" aria-hidden="true"></span><span>'+C.escapeHtml(label)+'</span></div>';}
function kbSourcesHtml(m){if(!LF.KnowledgeBase)return'';
const refs=LF.KnowledgeBase.referencesFromText(m&&m.content||'');if(!refs.length)return'';
  const rows=refs.map(function(entry){const sources=(entry.sources||[]).slice(0,4).map(function(src){
  const href=LF.KnowledgeBase.sourceHref(src),meta=[src.authors,src.year].filter(Boolean).join(' · '),
  label=src.citation||src.title||src.doi||src.url||'Source';
  return '<div class="chat-kb-source"><strong>'+C.escapeHtml('KB:'+entry.id+' · '+entry.title)+'</strong>'+(meta?'<span>'+
  C.escapeHtml(meta)+'</span>':'')+(href?'<a href="'+C.escapeHtml(href)+'" target="_blank" rel="noopener noreferrer">'+
  C.escapeHtml(label)+'</a>':'<span>'+C.escapeHtml(label)+'</span>')+'</div>';}).join('');
  return sources||'<div class="chat-kb-source"><strong>'+C.escapeHtml('KB:'+entry.id+' · '+entry.title)+
  '</strong><span>Stored source metadata unavailable.</span></div>';}).join('');
  return '<details class="chat-kb-sources"><summary>Knowledge Base sources · '+refs.length+
  '</summary><div class="chat-kb-source-list">'+rows+'</div></details>';}
function assistantInnerHtml(m){const pending=m.state==='requesting'&&!compact(m.content||''),failed=m.state==='error',
cancelled=m.state==='cancelled';return '<div class="chat-message-label"><strong>Assistant</strong>'+routeBadge(m)+'<span class="spacer"></span>'+
  (m.state==='complete'?copyButton(m.id):'')+'</div>'+
  (pending?transientHtml(m):'<div class="chat-transient" data-chat-status hidden></div>')+
  '<div class="chat-body markdown-view" data-chat-body'+(!m.content?' hidden':'')+'>'+answerHtml(m)+'</div>'+
  envelopeExtra(m)+
  (m.state==='complete'?kbSourcesHtml(m):'')+
  (failed?'<div class="chat-error-actions"><button class="button compact" type="button" data-retry-message="'+
  C.escapeHtml(m.id)+'">Retry</button></div>':'')+(cancelled?'<small class="chat-cancelled">Request stopped.</small>':'')+
  (m.state==='complete'?detailsHtml(m,false):'');}
function eventHtml(m){const body=compact(m.content||''),kind=m.unavailable?'unavailable':(m.error?'error':'done'),
icon=kind==='error'?'!':kind==='unavailable'?'○':'✓',cmd=m.actionId?actionCommand(m.actionId):'';
  return '<article class="chat-event '+kind+'" data-message-row="'+C.escapeHtml(m.id)+
  '"><div class="chat-action-head"><span aria-hidden="true">'+icon+'</span>'+(cmd?'<code class="chat-action-command">'+
  C.escapeHtml(cmd)+'</code>':'')+'<strong>'+C.escapeHtml(m.eventTitle||m.actionTitle||
  'Action completed')+'</strong>'+(Number.isFinite(Number(m.latencyMs))?'<small>'+fmtMs(m.latencyMs)+'</small>':'')+
  '<span class="spacer"></span>'+(body?copyButton(m.id):'')+'</div>'+
  (body?'<div class="chat-action-result markdown-view">'+C.markdown(body)+'</div>':'')+detailsHtml(m,true)+'</article>';}
function messageHtml(m){if(m.role==='system')return eventHtml(m);
const ai=m.role==='assistant',clean=String(m.content||'');
  return '<article class="chat-row '+(ai?'assistant-row':'user-row')+'" data-message-row="'+C.escapeHtml(m.id)+
  '"><div class="chat-message '+(ai?'ai':'user')+(m.state==='error'||
  m.error?' error':'')+'" data-message-id="'+C.escapeHtml(m.id)+'">'+
  (ai?assistantInnerHtml(m):'<div class="chat-body"><p>'+C.escapeHtml(clean).replace(/\n/g,
  '<br>')+'</p></div><div class="chat-user-tools">'+copyButton(m.id)+'</div>')+'</div></article>';}
function contextSnapshot(){return LF.PageContext&&LF.PageContext.snapshot?LF.PageContext.snapshot():{};}
function updateHeader(has){const ctx=document.getElementById('assistantContext'),payload=document.getElementById('assistantContextPayload'),summary=has&&LF.PageContext?LF.PageContext.summary():'Current page';if(ctx)ctx.textContent=summary;if(payload)payload.textContent=JSON.stringify(contextSnapshot(),null,2);}
function isNearBottom(log){return!log||log.scrollHeight-log.scrollTop-log.clientHeight<72;}
function setJump(show){const b=document.getElementById('chatJumpLatest');if(b)b.hidden=!show;}
function followLatest(force){const log=document.getElementById('chatLog');if(!log)return;if(force||isNearBottom(log)){log.scrollTop=log.scrollHeight;setJump(false);}else setJump(true);}
// Assistant consumes the same capability catalog as UI surfaces and does not invent hidden workflows.
function actionCatalog(){return LF.ActionCapabilities&&LF.ActionCapabilities.catalog?LF.ActionCapabilities.catalog():[];}
function actionCommand(id){return LF.ActionCapabilities&&LF.ActionCapabilities.command?LF.ActionCapabilities.command(id):('/action '+id);}
function renderActionMenu(has){const menu=document.getElementById('assistantActionMenu'),
toggle=document.getElementById('assistantActionsToggle');if(!menu||!toggle)return;toggle.disabled=!has;
  if(!has){menu.hidden=true;toggle.setAttribute('aria-expanded','false');return;}const actions=actionCatalog();
  menu.innerHTML='<div class="chat-action-menu-head"><strong>LabFlow Actions</strong><span>Recommended Actions first · unavailable Actions explain why</span></div>'+
  actions.map(function(a){return '<button type="button" class="chat-action-item" data-assistant-action="'+
  C.escapeHtml(a.id)+'" '+(a.available?'':'disabled')+' title="'+C.escapeHtml(a.available?(a.purpose||
  a.title):a.reason)+'"><span><strong>'+C.escapeHtml(a.title)+(a.recommended?' <mark>Recommended</mark>':'')+
  '</strong><small>'+C.escapeHtml(a.purpose||'')+'</small></span><code>'+C.escapeHtml(a.command||
  actionCommand(a.id))+'</code>'+(a.available?'':'<em>'+C.escapeHtml(a.reason)+'</em>')+'</button>';}).join('');}
function setActionMenu(open){const menu=document.getElementById('assistantActionMenu'),toggle=document.getElementById('assistantActionsToggle');if(!menu||!toggle)return;menu.hidden=!open;toggle.setAttribute('aria-expanded',open?'true':'false');}
function toggleActionMenu(){const menu=document.getElementById('assistantActionMenu');if(menu)setActionMenu(menu.hidden);}
function setComposer(has){
  const input=document.getElementById('chatInput'),send=document.getElementById('chatSend');
  if(input){input.disabled=!has||!!active;input.placeholder=has?'Ask about this page or use /actions…':'Upload a ZIP first';}
  if(send){send.disabled=!has;send.textContent=active?'Stop':'Send';
  send.setAttribute('aria-label',active?'Stop response':'Send message');}
  renderActionMenu(has);
}
function restoreInterrupted(items){items.forEach(function(m){if(m.role==='assistant'&&(m.state==='requesting'||m.state==='streaming')){m.state='cancelled';m.statusLabel='';}});}
function render(options){options=options||{};const log=document.getElementById('chatLog');if(!log)return;
const e=LF.State.state.experiment,items=e&&e.derived&&e.derived.chat&&e.derived.chat.conversation||[],has=!!(e&&e.id),
  pinned=isNearBottom(log),previous=log.scrollTop;if(!active)restoreInterrupted(items);
  log.innerHTML=items.length?items.map(messageHtml).join(''):'<div class="assistant-empty"><strong>'+
  (has?'Ask, inspect, or run an Action':'Upload a ZIP to activate the assistant')+'</strong><span>'+
  (has?'The Assistant uses current-page evidence. Use the Actions menu for bounded LabFlow operations and review their output here.':
  'AI stays disabled until an experiment is loaded.')+'</span></div>';updateHeader(has);setComposer(has);
  if(options.forceBottom||pinned)followLatest(true);else{log.scrollTop=previous;setJump(true);}}
function messageNode(id){return document.querySelector('[data-message-id="'+String(id).replace(/"/g,'\\"')+'"]');}
function updateTransient(run,label){const node=messageNode(run.message.id);if(!node)return;const status=node.querySelector('[data-chat-status]');run.message.statusLabel=label;if(status){status.hidden=false;status.innerHTML='<span class="chat-thinking-dot" aria-hidden="true"></span><span>'+C.escapeHtml(label)+'</span>';}}
function syncProgress(run,p){if(!active||active!==run)return;
const log=document.getElementById('chatLog'),pinned=isNearBottom(log),node=messageNode(run.message.id);
  run.progress=p||{};const content=compact(run.progress.content||''),reasoning=compact(run.progress.reasoning||'');
  if(reasoning)run.message.reasoning=reasoning;
  if(run.progress.transportState==='rate_limit'){updateTransient(run,'Provider rate limit');return;}if(!node)return;
  if(content){run.message.state='streaming';run.message.content=content;
  const status=node.querySelector('[data-chat-status]'),body=node.querySelector('[data-chat-body]');
  if(status){status.hidden=true;status.innerHTML='';}if(body){body.hidden=false;body.innerHTML=answerHtml(run.message);
  }}else updateTransient(run,reasoning?'Thinking':'Waiting for provider');if(pinned)followLatest(true);else setJump(true);
  }
function syncFinal(run){const log=document.getElementById('chatLog'),pinned=isNearBottom(log),node=messageNode(run.message.id);if(node){node.classList.toggle('error',run.message.state==='error');node.innerHTML=assistantInnerHtml(run.message);}else render({forceBottom:true});if(pinned)followLatest(true);else setJump(true);}
function addActionMessage(payload){payload=payload||{};const exp=LF.State&&LF.State.state&&LF.State.state.experiment;
if(!exp||!exp.id)return null;const failed=!!payload.error,unavailable=!!payload.unavailable,item=push(exp,{
  role:'system',content:compact(payload.content||''),structured:payload.structured||null,error:failed,
  unavailable:unavailable,executionMode:payload.executionMode||(payload.provider||payload.model||payload.usage?'llm':'local'),
  eventTitle:String(payload.actionTitle||payload.actionId||
  'Action')+(failed?' failed':unavailable?' unavailable':' completed'),actionId:String(payload.actionId||''),
  actionTitle:String(payload.actionTitle||payload.actionId||'Action'),model:payload.model||'',
  provider:payload.provider||'',latencyMs:payload.latencyMs||null,providerElapsedMs:payload.providerElapsedMs||null,
  ttftMs:payload.ttftMs||null,tokensPerSecond:payload.tokensPerSecond||null,usage:payload.usage||null,
  finishReason:payload.finishReason||'',requestCount:payload.requestCount||null,
  planningRequests:payload.planningRequests||null,responseBytes:payload.responseBytes||null,streamed:!!payload.streamed,
  requestId:payload.requestId||'',requestLogId:payload.requestLogId||'',
  tools:Array.isArray(payload.tools)?payload.tools:[]},false);render();
  if(LF.State&&LF.State.notify)LF.State.notify('assistant');return item;}
function addUsage(target,source){source=source||{};['promptTokens','completionTokens','totalTokens','cachedTokens'].forEach(function(k){if(Number.isFinite(Number(source[k])))target[k]+=Number(source[k]);});target.estimated=target.estimated||!!source.estimated;}
function routerTelemetry(classified,settings){const r=classified&&classified.response||{},cached=!!(classified&&classified.cached),usage={promptTokens:0,completionTokens:0,totalTokens:0,cachedTokens:0,estimated:false};addUsage(usage,r.usage||{});return{
  model:r.model||settings.model,provider:r.provider||settings.provider,providerElapsedMs:Number(r.latencyMs)||0,
  ttftMs:Number(r.ttftMs)||null,tokensPerSecond:Number(r.tokensPerSecond)||null,thinkingMode:r.thinkingPolicy&&r.thinkingPolicy.requested||r.thinkingMode||'off',
  thinkingEffective:r.thinkingPolicy&&r.thinkingPolicy.effective||r.thinkingMode||'off',reasoningObserved:!!r.reasoningObserved,
  usage:usage.totalTokens||usage.promptTokens||usage.completionTokens?usage:null,requestCount:cached?0:1,routerCalls:cached?0:1,cached:cached,
  responseBytes:Number(r.responseBytes)||0,requestId:r.requestId||'',requestLogId:r.requestLogId||'',streamed:false,
  finishReason:r.finishReason||'',routerInputTokens:Number(classified&&classified.inputTokens)||null
};}
function aggregateRunMeta(out,settings,elapsed,routerMeta){const entries=Object.keys(out&&out.requestMeta||{}).map(function(key){
return{key:key,meta:out.requestMeta[key]||{}};
  }),last=(entries[entries.length-1]||{}).meta||{},usage={promptTokens:0,completionTokens:0,totalTokens:0,cachedTokens:0,estimated:false};
  let seen=false,providerElapsedMs=Number(routerMeta&&routerMeta.providerElapsedMs)||0,responseBytes=Number(routerMeta&&routerMeta.responseBytes)||0;
  if(routerMeta&&routerMeta.usage){addUsage(usage,routerMeta.usage);seen=true;}
  entries.forEach(function(x){const m=x.meta||{},u=m.usage||{};if(Object.keys(u).length){addUsage(usage,u);seen=true;}
  if(Number.isFinite(Number(m.latencyMs)))providerElapsedMs+=Number(m.latencyMs);
  if(Number.isFinite(Number(m.responseBytes)))responseBytes+=Number(m.responseBytes);});
  return{model:last.model||routerMeta&&routerMeta.model||settings.model,provider:last.provider||routerMeta&&routerMeta.provider||settings.provider,latencyMs:elapsed,
  providerElapsedMs:providerElapsedMs||null,ttftMs:last.ttftMs||routerMeta&&routerMeta.ttftMs||null,tokensPerSecond:last.tokensPerSecond||routerMeta&&routerMeta.tokensPerSecond||null,
  thinkingMode:last.thinkingRequested||last.thinkingMode||routerMeta&&routerMeta.thinkingMode||'',thinkingEffective:last.thinkingEffective||routerMeta&&routerMeta.thinkingEffective||'',
  reasoningObserved:!!last.reasoningObserved||!!(routerMeta&&routerMeta.reasoningObserved),streamed:entries.length?!!last.streamed:false,usage:seen?usage:null,
  finishReason:last.finishReason||routerMeta&&routerMeta.finishReason||'',requestCount:entries.length+Number(routerMeta&&routerMeta.requestCount||0),routerCalls:Number(routerMeta&&routerMeta.routerCalls||0),responseBytes:responseBytes||null,
  requestId:last.requestId||routerMeta&&routerMeta.requestId||'',requestLogId:last.requestLogId||routerMeta&&routerMeta.requestLogId||''};}
async function runTurn(exp,text,message,plan){const settings=LF.Storage.getAiSettings(),assistantSettings=LF.Storage.getAssistantSettings?LF.Storage.getAssistantSettings():{},run={
started:performance.now(),message:message,controller:null,clock:null,firstContentLogged:false,requestContext:null,allowedKbIds:[],plan:plan||{}};active=run;
  message.state='requesting';message.content='';message.error=false;message.statusLabel='Preparing provider request';message.executionMode='llm';
  message.routeReason=run.plan.reason||'Deterministic routing selected provider fallback.';message.intent=run.plan.intent||'';message.scopeLabel=run.plan.scope&&run.plan.scope.page||'';message.provider=settings.provider;message.model=settings.model;
  message.routeCached=!!(run.plan.routerTelemetry&&run.plan.routerTelemetry.cached);
  message.focusLabel=run.plan.focus?String(run.plan.focus.kind||'')+':'+String(run.plan.focus.label||run.plan.focus.id||''):'';
  if(Log)Log.info('turn.start',{messageId:message.id,provider:settings.provider,model:settings.model,
  questionChars:String(text||'').length});render({forceBottom:true});
  run.clock=setInterval(function(){if(active===run&&message.state==='requesting'&&!message.content)updateTransient(run,
  'LLM · Thinking · '+fmtMs(performance.now()-run.started));},500);let out=null;
  try{out=await Promise.race([LF.ActionRunner.run('assistant.chat',{userText:text,params:{assistantPlan:run.plan},thinkingMode:assistantSettings.thinkingMode||'off',
  onPhase:function(info){syncAssistantPhase(run,info);},onRequest:function(info){captureRequest(run,info);},onProgress:function(p){
  if(!run.firstContentLogged&&p&&compact(p.content||'')){run.firstContentLogged=true;
  if(Log)Log.info('turn.first-content',{messageId:message.id,elapsedMs:Math.round(performance.now()-run.started)});
  }syncProgress(run,p);}}),new Promise(function(_,reject){run.watchdog=window.setTimeout(function(){try{
  if(LF.ActionRunner&&LF.ActionRunner.cancel)LF.ActionRunner.cancel();
  }catch(_){}const e=new Error('Assistant timed out after 95 seconds. Retry the question.');e.code='ASSISTANT_TIMEOUT';
  reject(e);},95000);})]);const elapsed=Math.round(performance.now()-run.started);
  if(out&&out.status==='done'){let finalMeta=null;
  Object.keys(out.requestMeta||{}).forEach(function(k){finalMeta=out.requestMeta[k]||finalMeta;});
  const raw=compact(out.result||message.content||''),requestMeta=run.requestContext||{},pack=(run.plan&&(run.plan.pack||run.plan.context))||null;
  const envelope=LF.AssistantCore&&LF.AssistantCore.parseEnvelope?LF.AssistantCore.parseEnvelope(raw):null;
  const envelopeCheck=envelope&&LF.AssistantCore&&LF.AssistantCore.validateEnvelope?LF.AssistantCore.validateEnvelope(envelope,pack,text):null;
  const envelopeSevere=!!(envelopeCheck&&envelopeCheck.severe),answerText=envelope&&!envelopeSevere?envelope.answer:raw;
  const grounding=validateKbAnswer(answerText,run.allowedKbIds||[]),fallback=run.plan&&run.plan.fallback;
  const safeContent=grounding.ok?(envelopeSevere&&fallback?fallback:answerText):(fallback||grounding.content);
  const envelopeWarnings=[];
  if(envelopeCheck&&envelopeCheck.unknownBasis&&envelopeCheck.unknownBasis.length)envelopeWarnings.push('Basis keys not supplied: '+envelopeCheck.unknownBasis.join(', '));
  if(envelopeCheck&&envelopeCheck.unsupportedNumbers&&envelopeCheck.unsupportedNumbers.length)envelopeWarnings.push('Numbers not present in supplied facts: '+envelopeCheck.unsupportedNumbers.join(', '));
  if(envelopeSevere)envelopeWarnings.push('Answer grounding failed; returned the deterministic fallback.');
  Object.assign(message,{state:'complete',content:compact(safeContent),
  envelope:envelope&&!envelopeSevere&&grounding.ok?{answer:compact(envelope.answer),basis:envelope.basis,unknown:compact(envelope.unknown)}:null,
  reasoning:compact(finalMeta&&finalMeta.reasoning||message.reasoning||''),error:false,executionMode:'llm',
  contextTokens:requestMeta.inputTokens||null,contextChars:requestMeta.messageChars||null,
  completionBudgetTokens:requestMeta.maxTokens||null,answerTargetTokens:requestMeta.targetTokens||null,
  reasoningReserveTokens:requestMeta.reasoningReserveTokens||0,contextMessageCount:requestMeta.messageCount||0,
  evidenceItemsSupplied:requestMeta.evidenceCount||0,measurementsSupplied:requestMeta.measurementCount||0,
  samplesSupplied:requestMeta.sampleCount||0,kbEntriesSupplied:requestMeta.knowledgeCount||0,
  envelopeWarning:envelopeWarnings.join(' · '),
  groundingWarning:grounding.ok?'':('Rejected unsupported KB citation'+(grounding.invalid.length===1?'':'s')+': '+grounding.invalid.join(', '))}
  ,aggregateRunMeta(out,settings,elapsed,run.plan&&run.plan.routerTelemetry));
  if(!grounding.ok)message.finishReason='grounding_fallback';
  else if(envelopeSevere)message.finishReason='envelope_fallback';
  if(Log)Log.info('turn.done',{messageId:message.id,elapsedMs:elapsed,requests:message.requestCount||1,
  ttftMs:message.ttftMs||null,answerChars:String(message.content||'').length,grounding:grounding.ok?'passed':'rejected',
  envelope:envelope?'parsed':'absent',envelopeSevere:envelopeSevere});
  }else if(out&&(out.status==='cancelled'||out.status==='aborted')){Object.assign(message,{
  state:'cancelled',content:'',error:false,finishReason:'cancelled',latencyMs:elapsed,executionMode:'llm'});
  if(Log)Log.info('turn.cancelled',{messageId:message.id,elapsedMs:elapsed});
  }else{Object.assign(message,{state:'error',content:compact(out&&out.message||'Assistant request failed.'),error:true,
  model:settings.model,provider:settings.provider,latencyMs:elapsed,requestCount:Object.keys(out&&out.requestMeta||{}
  ).length||null,finishReason:out&&out.code||'ASSISTANT_FAILED',executionMode:'llm'});
  if(Log)Log.warn('turn.failed',{messageId:message.id,elapsedMs:elapsed,code:message.finishReason,message:message.content}
  );LF.UI.message(message.content,'error');
  }}catch(error){Object.assign(message,{state:error&&error.name==='AbortError'?'cancelled':'error',
  content:error&&error.name==='AbortError'?'':String(error&&error.message||error||'Assistant request failed.'),
  error:!(error&&error.name==='AbortError'),model:settings.model,provider:settings.provider,executionMode:'llm',
  latencyMs:Math.round(performance.now()-run.started),finishReason:error&&error.code||'ASSISTANT_FAILED'});
  if(Log)(message.error?Log.error:Log.info)('turn.exception',{
  messageId:message.id,elapsedMs:message.latencyMs,code:message.finishReason,error:error});
  if(message.error)LF.UI.message(message.content,'error');}finally{if(run.clock)clearInterval(run.clock);
  if(run.watchdog)window.clearTimeout(run.watchdog);if(active===run)active=null;
  if(message.state==='requesting'||message.state==='streaming')message.state=message.content?'complete':'cancelled';
  try{syncFinal(run);}catch(renderError){if(Log)Log.error('turn.final-render-failed',{
  messageId:message.id,error:renderError});try{render({forceBottom:true});}catch(_){}}finally{setComposer(true);
  if(LF.State&&LF.State.notify)LF.State.notify('assistant');}}}
function deterministicAnswer(exp,text){const decision=LF.AssistantCore&&LF.AssistantCore.localAnswer?LF.AssistantCore.localAnswer(exp,text):null;return decision&&decision.answer||null;}
function commandAction(text){const raw=String(text||'').trim(),lower=raw.toLowerCase();if(lower==='/actions'){toggleActionMenu();return true;}const id=LF.ActionCapabilities&&LF.ActionCapabilities.resolveCommand?LF.ActionCapabilities.resolveCommand(raw):'';if(!id)return false;runAction(id,raw);return true;}
function runAction(id,sourceText){if(active||runnerBusy()||!LF.ActionUI||!LF.ActionUI.run)return Promise.resolve(null);
const capability=LF.ActionCapabilities&&LF.ActionCapabilities.evaluate?LF.ActionCapabilities.evaluate(id):null,
  d=capability&&capability.definition;if(!d||d.visibility!=='public'){
  LF.UI.message('Unknown Assistant Action: '+id,'error');return Promise.resolve(null);
  }const exp=LF.State.ensureExperiment('assistant-action:'+id);if(!exp.id)return Promise.resolve(null);
  if(sourceText)push(exp,{role:'user',content:sourceText},false);setActionMenu(false);render({forceBottom:true});
  return LF.ActionUI.run(id,'',{params:capability.params,fromAssistant:true});}
function applyLocalMessage(message,decision,meta,elapsed){meta=meta||{};Object.assign(message,{state:'complete',content:decision.answer,error:false,
  executionMode:meta.requestCount?'routed-local':'local',routeReason:decision.reason,intent:decision.intent||'',
  scopeLabel:decision.scope&&decision.scope.page||'',localSource:decision.source,latencyMs:Math.round(elapsed||0),
  finishReason:meta.requestCount?'routed-local':'deterministic'},meta.requestCount?meta:{requestCount:0,usage:{promptTokens:0,completionTokens:0,totalTokens:0,estimated:false}});}
async function resolveNaturalTurn(exp,text,message,initial){const settings=LF.Storage.getAiSettings(),routeRun={started:performance.now(),message:message,controller:null,phase:'route'};active=routeRun;
  message.state='requesting';message.content='';message.error=false;message.statusLabel='Routing request';message.executionMode='routing';message.provider=settings.provider;message.model=settings.model;message.scopeLabel=initial&&initial.scope&&initial.scope.page||'';
  render({forceBottom:true});setComposer(true);
  try{
    const cached=LF.AssistantCore&&LF.AssistantCore.cachedRoute?LF.AssistantCore.cachedRoute(text,initial.scope):null;
    const classified=cached?{route:cached,response:null,inputTokens:0,cached:true}:await LF.AssistantCore.classify(text,initial.scope),rmeta=routerTelemetry(classified,settings),plan=LF.AssistantCore.planFromRoute(exp,text,classified.route,initial.scope);
    plan.routerTelemetry=rmeta;
    if(!cached&&LF.AssistantCore.rememberRoute)LF.AssistantCore.rememberRoute(text,initial.scope,classified.route);
    if(LF.AssistantCore.noteTurn)LF.AssistantCore.noteTurn({focus:plan.focus||null,lastIntent:plan.intent||'',
      lastTarget:classified.route&&classified.route.target||'',lastFocusAt:new Date().toISOString()});
    if(plan.mode==='local'){
      applyLocalMessage(message,plan,rmeta,performance.now()-routeRun.started);if(classified.response&&classified.response.reasoning)message.reasoning=compact(classified.response.reasoning);
      if(Log)Log.info('route.local',{messageId:message.id,intent:plan.intent,scope:message.scopeLabel,providerCalls:1});
      active=null;syncFinal(routeRun);setComposer(true);if(LF.State&&LF.State.notify)LF.State.notify('assistant');
      return{status:'done',result:plan.answer,deterministic:true,routed:true};
    }
    if(Log)Log.info('route.provider-answer',{messageId:message.id,intent:plan.intent,scope:plan.scope&&plan.scope.page||'',providerCallsBeforeAnswer:1});
    active=null;message.executionMode='llm';message.statusLabel='Preparing bounded answer';message.routeReason=plan.reason;message.intent=plan.intent||'';message.scopeLabel=plan.scope&&plan.scope.page||'';
    return runTurn(exp,text,message,plan);
  }catch(error){
    active=null;
    Object.assign(message,{
      state:error&&error.name==='AbortError'?'cancelled':'error',
      content:error&&error.name==='AbortError'?'':String(error&&error.message||error||'Assistant routing failed.'),
      error:!(error&&error.name==='AbortError'),provider:settings.provider,model:settings.model,
      executionMode:'llm',latencyMs:Math.round(performance.now()-routeRun.started),
      finishReason:error&&error.code||'ASSISTANT_ROUTE_FAILED'
    });
    if(message.error){if(Log)Log.error('route.failed',{messageId:message.id,error:error});LF.UI.message(message.content,'error');}
    syncFinal(routeRun);setComposer(true);if(LF.State&&LF.State.notify)LF.State.notify('assistant');return null;
  }
}
async function sendChat(text){
  if(LF.State&&LF.State.commitAllDrafts)LF.State.commitAllDrafts();
  text=String(text||'').trim();if(!text||active||runnerBusy())return;
  if(commandAction(text))return;
  const exp=LF.State.ensureExperiment('action:assistant.chat');if(!exp.id)return;
  const initial=LF.AssistantCore&&LF.AssistantCore.initialPlan?LF.AssistantCore.initialPlan(exp,text):null,decision=initial&&initial.mode==='local'?initial:null;
  if(!decision&&!configured())return;
  push(exp,{role:'user',content:text},false);
  if(decision){const message=push(exp,{role:'assistant',content:'',state:'requesting',retryText:text},false);applyLocalMessage(message,decision,null,0);render({forceBottom:true});if(LF.State&&LF.State.notify)LF.State.notify('assistant');return{status:'done',result:decision.answer,deterministic:true};}
  const settings=LF.Storage.getAiSettings(),message=push(exp,{role:'assistant',content:'',state:'requesting',retryText:text,statusLabel:'Routing request',executionMode:'routing',routeReason:initial&&initial.reason||'Natural-language intent routing.',scopeLabel:initial&&initial.scope&&initial.scope.page||'',provider:settings.provider,model:settings.model},false);
  return resolveNaturalTurn(exp,text,message,initial||{scope:LF.AssistantCore.scope(exp)});
}
function retryMessage(id){
  if(active||runnerBusy()||!configured())return;
  const exp=LF.State.state.experiment,m=conversation(exp).find(function(x){
    return x.id===id&&x.role==='assistant'&&x.state==='error';
  });
  if(!m)return;
  const text=m.retryText||'',initial=LF.AssistantCore&&LF.AssistantCore.initialPlan
    ?LF.AssistantCore.initialPlan(exp,text):{mode:'route',scope:LF.AssistantCore.scope(exp)};
  if(initial.mode==='local'){
    applyLocalMessage(m,initial,null,0);render({forceBottom:true});
    return Promise.resolve({status:'done',result:initial.answer,deterministic:true});
  }
  return resolveNaturalTurn(exp,text,m,initial);
}
function cancel(){if(!active)return;if(LF.ActionRunner&&LF.ActionRunner.isRunning&&LF.ActionRunner.isRunning()&&LF.ActionRunner.cancel)LF.ActionRunner.cancel();else if(LF.AI&&LF.AI.abort)LF.AI.abort();else if(active.controller)active.controller.abort();}
function bind(){document.addEventListener('click',function(e){const c=e.target.closest('[data-copy-message]');
if(c){const m=conversation(LF.State.state.experiment).find(function(x){return x.id===c.dataset.copyMessage;});
  if(m)C.copyText(m.envelope&&m.envelope.answer?m.envelope.answer:(m.structured?JSON.stringify(m.structured,null,2):m.content));return;
  }const retry=e.target.closest('[data-retry-message]');if(retry){retryMessage(retry.dataset.retryMessage);return;
  }const action=e.target.closest('[data-assistant-action]');if(action){e.preventDefault();
  runAction(action.dataset.assistantAction,'');return;}if(e.target.closest('#assistantActionsToggle')){e.preventDefault();
  toggleActionMenu();return;}if(e.target.closest('#chatJumpLatest')){followLatest(true);return;
  }const menu=document.getElementById('assistantActionMenu'),toggle=document.getElementById('assistantActionsToggle');
  if(menu&&!menu.hidden&&toggle&&!toggle.contains(e.target)&&!menu.contains(e.target))setActionMenu(false);});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')setActionMenu(false);});
  const input=document.getElementById('chatInput'),button=document.getElementById('chatSend');
  function fit(){if(!input)return;if(!String(input.value||'')){input.style.height='30px';input.style.overflowY='hidden';
  return;}input.style.height='30px';const next=Math.min(92,Math.max(30,input.scrollHeight));input.style.height=next+'px';
  input.style.overflowY=next>=92?'auto':'hidden';}function go(){if(active){cancel();return;}if(!input)return;
  const v=input.value;if(!v.trim())return;input.value='';fit();sendChat(v);}if(button)button.addEventListener('click',go);
  if(input){input.addEventListener('input',fit);
  input.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();go();}});fit();}}
if(LF.Structures){
  LF.Structures.define('assistant.message',{
    owner:'Assistant',layer:'derived_runtime',persistence:'experiment_derived',
    description:'Bounded conversation/event item. It can reference canonical data and Actions but is never itself scientific evidence.',
    variants:['user','assistant','system'],
    fields:{
      id:{type:'string',required:true},createdAt:{type:'string',required:true},route:{type:'string'},
      page:{type:'string'},view:{type:'string'},role:{type:'string',required:true,enum:['user','assistant','system']},
      content:{type:'string'},structured:{type:'object',nullable:true},state:{type:'string'},error:{type:'boolean'},
      actionId:{type:'string'},model:{type:'string'},provider:{type:'string'},executionMode:{type:'string'},routeReason:{type:'string'},
      usage:{type:'object',nullable:true},finishReason:{type:'string'}
    }
  });
}
function clearMemory(){if(LF.AssistantCore&&LF.AssistantCore.clearMemory)LF.AssistantCore.clearMemory();}
LF.Assistant={render:render,bind:bind,sendChat:sendChat,runAction:runAction,addActionMessage:addActionMessage,
deterministicAnswer:deterministicAnswer,clearMemory:clearMemory,
cancel:cancel};
// Session memory follows the session lifecycle, not the persisted experiment snapshot.
if(LF.State&&LF.State.subscribe)LF.State.subscribe(function(reason){if(reason==='reset')clearMemory();});
}());
