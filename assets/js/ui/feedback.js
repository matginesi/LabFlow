/*
 * Shared Message and Action Totem lifecycle plus foreground feedback primitives.
 * Boundary: Mirror application and Action state without owning hidden work queues.
 */
(function () {
  'use strict';

  const LF = window.LabFlow = window.LabFlow || {};
  const C = LF.Core;
  const Log = LF.Logger.scope('ui');

  let activity = null;
  let hideTimer = null;
  let activityFrame = 0;
  let activityTimer = null;
  /* Terminal Action totems close with their button, with Escape, or after this idle window.
     Interaction inside the totem restarts the window; a running Action is never auto-hidden. */
  const ACTIVITY_IDLE_CLOSE_MS = 5000;
  let modalSession = null;

  function modalFocusable(dialog) {
    if (!dialog) return [];
    return Array.from(dialog.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(function (el) {
      return !el.hidden && el.getAttribute('aria-hidden') !== 'true' && (el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    });
  }

  function closeModalSurface(shade, options) {
    if (!shade) return;
    const session = modalSession && modalSession.shade === shade ? modalSession : null;
    if (session) {
      document.removeEventListener('keydown', session.keyHandler, true);
      modalSession = null;
    }
    shade.hidden = true;
    shade.removeAttribute('data-modal-open');
    if (!(options && options.restoreFocus === false) && session && session.previousFocus && session.previousFocus.isConnected && session.previousFocus.focus) {
      window.setTimeout(function () { session.previousFocus.focus(); }, 0);
    }
  }

  function openModalSurface(shade, options) {
    options = options || {};
    if (!shade) return;
    if (modalSession && modalSession.shade !== shade) closeModalSurface(modalSession.shade);
    const dialog = options.dialog || shade.querySelector('[role="dialog"]') || shade.firstElementChild;
    const previousFocus = options.previousFocus || document.activeElement;
    const keyHandler = function (event) {
      if (event.key === 'Escape' && options.escape !== false) {
        event.preventDefault();
        if (typeof options.onEscape === 'function') options.onEscape();
        else closeModalSurface(shade);
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = modalFocusable(dialog);
      if (!focusable.length) { event.preventDefault(); if (dialog.focus) dialog.focus(); return; }
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    shade.hidden = false;
    shade.setAttribute('data-modal-open', 'true');
    modalSession = { shade: shade, dialog: dialog, previousFocus: previousFocus, keyHandler: keyHandler };
    document.addEventListener('keydown', keyHandler, true);
    window.setTimeout(function () {
      const preferred = options.focus || modalFocusable(dialog)[0] || dialog;
      if (preferred && preferred.focus) { if (preferred === dialog && !preferred.hasAttribute('tabindex')) preferred.setAttribute('tabindex', '-1'); preferred.focus(); }
    }, 0);
  }

  const renderedContent = new WeakMap();


  function byId(id) {
    return document.getElementById(id);
  }


  function text(value) {
    return value == null ? '' : String(value);
  }


  function clampProgress(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
  }

  function message(message, type, titleText) {
    const semantic=type==='error'?'danger':(type || 'info'),titles={success:'Completed',danger:'Could not complete',warning:'Attention',info:'LabFlow'};
    Log.debug('message', {type:semantic, message:text(message).slice(0, 300)});
    const region = byId('messageRegion');
    if (!region) return;
    const element = document.createElement('div');
    element.className = 'message-totem ' + semantic;
    const head=document.createElement('div');head.className='message-totem-head';
    const marker=document.createElement('span');marker.className='message-totem-marker';marker.setAttribute('aria-hidden','true');
    const titleWrap=document.createElement('div'),title=document.createElement('strong');
    title.textContent=text(titleText||titles[semantic]||'LabFlow');titleWrap.appendChild(title);head.appendChild(marker);head.appendChild(titleWrap);
    const body=document.createElement('div');body.className='message-totem-body';body.textContent=text(message);
    element.appendChild(head);element.appendChild(body);
    region.appendChild(element);
    window.setTimeout(function () { element.classList.add('leaving');window.setTimeout(function(){element.remove();},180); }, 4200);
  }

  let confirmPending=null;
  function closeConfirmation(result){
    if(!confirmPending)return;const pending=confirmPending;confirmPending=null;
    const shade=byId('messageShade');if(shade)closeModalSurface(shade);
    Log.info('confirm', {message:pending.message.slice(0,300),result:String(result)});pending.resolve(result);
  }


  function confirmAction(message, options) {
    options=options||{};if(confirmPending)closeConfirmation(false);
    const shade=byId('messageShade'),totem=byId('messageTotem'),title=byId('messageTotemTitle'),body=byId('messageTotemBody'),eyebrow=byId('messageTotemEyebrow'),confirm=byId('messageTotemConfirm'),cancel=byId('messageTotemCancel'),alternate=byId('messageTotemAlternate');
    if(!shade||!title||!body||!confirm||!cancel)return Promise.resolve(false);
    const tone=options.danger?'danger':(options.tone||'info');title.textContent=text(options.title||'Confirm action');
    if(options.bodyHtml){body.innerHTML=options.bodyHtml;body.classList.add('message-totem-body-rich');if(totem)totem.classList.add('rich');}else{body.textContent=text(message);body.classList.remove('message-totem-body-rich');if(totem)totem.classList.remove('rich');}
    if(eyebrow)eyebrow.textContent=text(options.eyebrow||'LabFlow confirmation');if(totem)totem.className='message-totem '+tone;confirm.textContent=text(options.confirmLabel||'Confirm');cancel.textContent=text(options.cancelLabel||'Cancel');
    confirm.className='button '+(options.danger?'danger':'primary');
    return new Promise(function(resolve){
      const previousFocus=document.activeElement;
      confirmPending={resolve:resolve,message:text(message),previousFocus:previousFocus};
      confirm.onclick=function(){closeConfirmation(Object.prototype.hasOwnProperty.call(options,'confirmValue')?options.confirmValue:true);};cancel.onclick=function(){closeConfirmation(Object.prototype.hasOwnProperty.call(options,'cancelValue')?options.cancelValue:false);};
      if(alternate){alternate.hidden=!options.alternateLabel;alternate.textContent=text(options.alternateLabel||'');alternate.onclick=options.alternateLabel?function(){closeConfirmation(Object.prototype.hasOwnProperty.call(options,'alternateValue')?options.alternateValue:'alternate');}:null;}
      shade.onclick=function(event){if(event.target===shade)closeConfirmation(Object.prototype.hasOwnProperty.call(options,'cancelValue')?options.cancelValue:false);};
      openModalSurface(shade,{focus:confirm,previousFocus:previousFocus,onEscape:function(){closeConfirmation(false);}});
    });
  }


  function activityElapsedMs() {
    if (!activity) return 0;
    return Math.max(0, (activity.endedAt || Date.now()) - activity.startedAt);
  }


  function stopActivityClock() {
    if (!activity) return;
    if (!activity.endedAt) activity.endedAt = Date.now();
    window.clearInterval(activityTimer);
    activityTimer = null;
  }

  function normalizeSteps(steps) {
    return (Array.isArray(steps) ? steps : []).map(function (step, index) {
      if (typeof step === 'string') {
        return {id:'step-' + index, label:step, status:'pending', note:''};
      }
      step = step || {};
      return {
        id:step.id || ('step-' + index),
        label:step.label || step.title || ('Step ' + (index + 1)),
        status:step.status || 'pending',
        note:step.note || ''
      };
    });
  }


  function humanKey(key) {
    return text(key).replace(/_/g, ' ').replace(/\b\w/g, function (character) {
      return character.toUpperCase();
    });
  }


  function structuredItemTitle(item, index) {
    if (!item || typeof item !== 'object') return 'Item ' + (index + 1);
    return item.title || item.name || item.patch_type || item.field || item.check ||
      item.labflow_path || item.item || ('Item ' + (index + 1));
  }

  function structuredObjectHtml(object) {
    if (object == null) return '<span class="structured-empty">—</span>';
    if (typeof object !== 'object') {
      return '<span>' + C.escapeHtml(String(object)) + '</span>';
    }

    const primitiveFields = [];
    const nestedFields = [];
    Object.keys(object).forEach(function (key) {
      const value = object[key];
      (value == null || typeof value !== 'object' ? primitiveFields : nestedFields).push([key, value]);
    });

    let html = '';
    if (primitiveFields.length) {
      html += '<div class="structured-kv">' + primitiveFields.map(function (field) {
        let value = field[1];
        if (typeof value === 'boolean') value = value ? 'Yes' : 'No';
        return '<div><span>' + C.escapeHtml(humanKey(field[0])) + '</span><strong>' +
          C.escapeHtml(value == null ? '—' : String(value)) + '</strong></div>';
      }).join('') + '</div>';
    }

    nestedFields.forEach(function (field) {
      const key = field[0];
      const value = field[1];
      if (!Array.isArray(value)) {
        html += '<details class="structured-nested"><summary>' + C.escapeHtml(humanKey(key)) +
          '</summary>' + structuredObjectHtml(value) + '</details>';
        return;
      }

      const items = value.map(function (item, index) {
        if (!item || typeof item !== 'object') {
          return '<article class="structured-item"><strong>' + C.escapeHtml(String(item)) + '</strong></article>';
        }
        const content = Object.assign({}, item);
        delete content.title;
        delete content.name;
        return '<article class="structured-item"><header><strong>' +
          C.escapeHtml(structuredItemTitle(item, index)) + '</strong></header>' +
          structuredObjectHtml(content) + '</article>';
      }).join('');

      html += '<div class="structured-block"><div class="structured-block-title">' +
        C.escapeHtml(humanKey(key)) + ' <span>' + value.length + '</span></div>' +
        (value.length ? '<div class="structured-items">' + items + '</div>' : '<div class="structured-empty">None</div>') +
        '</div>';
    });

    return html || '<span class="structured-empty">No structured fields.</span>';
  }


  function structuredActivityHtml(raw) {
    let parsed;
    try { parsed=JSON.parse(text(raw)); }
    catch (_) { return '<pre class="streaming-output">'+C.escapeHtml(raw||'—')+'</pre>'; }
    const pretty=JSON.stringify(parsed,null,2);
    const highlighted=C.highlightCode?C.highlightCode(pretty,'json'):C.escapeHtml(pretty);
    return '<pre class="json-highlight compact"><code>'+highlighted+'</code></pre>';
  }

  function compactStreamText(raw){return text(raw).replace(/\r\n/g,'\n').replace(/\n[ \t]*\n+/g,'\n');}


  function authorizationStatus(headers) {
    return headers && headers.Authorization ? 'Configured · redacted' : 'Not set';
  }

  function requestActivityHtml(raw) {
    let request;
    try {
      request = JSON.parse(text(raw));
    } catch (_) {
      return '<pre>' + C.escapeHtml(raw || '—') + '</pre>';
    }

    const body = request && request.body || {};
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const providerId = LF.Storage && LF.Storage.getAiSettings ? String((LF.Storage.getAiSettings() || {}).provider || '') : '';
    const displayModel = C.modelDisplayName ? C.modelDisplayName(providerId, body.model) : body.model;
    const config = Object.assign({}, body, body.model != null ? {model:displayModel} : {});
    delete config.messages;

    const facts = '<div class="activity-request-facts">' +
      '<div><span>Method</span><strong>' + C.escapeHtml(request.method || 'POST') + '</strong></div>' +
      '<div><span>Endpoint</span><strong>' + C.escapeHtml(request.endpoint || '—') + '</strong></div>' +
      '<div><span>Messages</span><strong>' + messages.length + '</strong></div>' +
      '<div><span>Authorization</span><strong>' + C.escapeHtml(authorizationStatus(request.headers)) + '</strong></div>' +
      '</div>';
    const configHtml = '<details class="activity-request-config"><summary>Provider parameters</summary>' +
      structuredObjectHtml(config) + '</details>';
    const messagesHtml = '<div class="activity-request-messages">' + messages.map(function (message, index) {
      const content = text(message.content);
      return '<article class="activity-request-message"><header><span>' + (index + 1) + '</span><strong>' +
        C.escapeHtml(text(message.role || 'message').toUpperCase()) + '</strong><small>' +
        content.length + ' characters</small></header><pre>' + C.escapeHtml(content) + '</pre></article>';
    }).join('') + '</div>';

    const safeBody = Object.assign({}, body, body.model != null ? {model:displayModel} : {});
    const safeRequest = Object.assign({}, request, {
      headers:Object.assign({}, request.headers || {}, {Authorization:authorizationStatus(request.headers)}),
      body:safeBody
    });
    return facts + configHtml + messagesHtml +
      '<details class="structured-raw"><summary>Raw request JSON</summary><div class="markdown">' +
      (C.markdown ? C.markdown('```json\n' + JSON.stringify(safeRequest, null, 2) + '\n```') : '<pre>' + C.escapeHtml(JSON.stringify(safeRequest, null, 2)) + '</pre>') + '</div></details>';
  }


  function renderStable(element, key, render) {
    if (!element || renderedContent.get(element) === key) return;
    render();
    renderedContent.set(element, key);
  }


  function renderActivityDetails(details) {
    const list = byId('activityDetails');
    if (!list) return;
    list.innerHTML = '';
    Object.keys(details).slice(0, 14).forEach(function (key) {
      const value = details[key];
      if (value == null || value === '') return;
      const term = document.createElement('dt');
      const definition = document.createElement('dd');
      term.textContent = key;
      definition.textContent = text(value);
      list.appendChild(term);
      list.appendChild(definition);
    });
  }


  function renderActivityTimeline() {
    const checklist = byId('activityChecklist');
    if (checklist) {
      checklist.innerHTML = (activity.steps || []).map(function (step) {
        const iconName = step.status === 'done' ? 'check' : step.status === 'error' ? 'triangle-alert' : '';
        const mark = iconName && LF.Icons ? LF.Icons.icon(iconName) : step.status === 'active' ? '•' : '';
        return '<div class="activity-check-item ' + step.status + '"><i>' + mark + '</i><strong>' +
          C.escapeHtml(step.label) + '</strong><span>' + C.escapeHtml(step.note || '') + '</span></div>';
      }).join('');
    }

    const history = byId('activityHistory');
    if (!history) return;
    history.innerHTML = '';
    (activity.history || []).slice(-8).forEach(function (item) {
      const row = document.createElement('div');
      const timestamp = document.createElement('span');
      const stage = document.createElement('strong');
      timestamp.textContent = item.time;
      stage.textContent = item.stage;
      row.appendChild(timestamp);
      row.appendChild(stage);
      history.appendChild(row);
    });
  }


  function renderActivityPayloads() {
    const trace = byId('activityAiTrace');
    const request = byId('activityRequest');
    const response = byId('activityResponse');
    if (trace) trace.hidden = !activity.showAiTrace;
    if (request && request.parentElement) request.parentElement.hidden = !activity.request;

    const requestState = byId('activityRequestState');
    if (requestState) {
      requestState.textContent = activity.request ? 'Prepared request · key redacted' : 'No request data';
    }
    renderStable(request, (activity.requestIsJson ? 'json:' : 'text:') + activity.request, function () {
      request.classList.toggle('json-response', activity.requestIsJson);
      if (activity.requestIsJson) request.innerHTML = requestActivityHtml(activity.request || '{}');
      else request.textContent = activity.request || '—';
    });
    const streaming=!!(activity.stream&&activity.stream.active);
    renderStable(response, (streaming?'stream:':activity.responseIsJson ? 'json:' : 'text:') + activity.response, function () {
      response.classList.toggle('json-response', activity.responseIsJson&&!streaming);
      response.classList.toggle('is-streaming',streaming);
      if(streaming)response.innerHTML='<pre class="streaming-output">'+C.escapeHtml(compactStreamText(activity.response||'Waiting for model content…'))+'</pre>';
      else if (activity.responseIsJson) response.innerHTML = structuredActivityHtml(activity.response || '{}');
      else response.innerHTML = C.markdown ? C.markdown(activity.response || '—') : C.escapeHtml(activity.response || '—');
    });
  }


  function hasActiveCancellationTarget() {
    if (!activity || activity.status !== 'running') return false;
    if (activity.cancellable) return true;
    if (LF.ActionRunner && typeof LF.ActionRunner.isRunning === 'function' && LF.ActionRunner.isRunning()) return true;
    return Boolean(LF.AI && typeof LF.AI.isBusy === 'function' && LF.AI.isBusy());
  }


  function renderActivityCommands() {
    const finished = activity.status !== 'running';
    const canStop = !finished && hasActiveCancellationTarget();
    const actions = byId('activityHeadActions');
    if (actions) actions.dataset.status = activity.status;
    const cancel = byId('activityCancel');
    if (cancel) {
      cancel.hidden = !canStop;
      cancel.disabled = !!activity.cancelling;
      cancel.textContent = activity.cancelling ? 'Stopping…' : 'Stop';
      cancel.className = 'button danger compact activity-button';
    }
    const close = byId('activityClose');
    if (close) {
      close.hidden = !finished;
      close.disabled = false;
      close.textContent = activity.closeLabel || 'Close';
      close.className = 'button primary compact activity-button';
    }

    const logs = byId('activityLogs');
    if (logs) {
      logs.hidden = !finished;
      logs.className = 'button compact activity-button';
    }
    const retry=byId('activityRetry');
    if(retry){retry.hidden=!(activity.status==='error'&&activity.onRetry);retry.textContent=activity.retryLabel||'Retry checkpoint';}
    const outputLabel = byId('activityOutputLabel');
    const outputState = byId('activityOutputState');
    if (outputLabel) outputLabel.textContent = activity.status === 'error' ? 'Provider error' : 'Provider output';
    if (outputState) {
      outputState.textContent = activity.status === 'error'
        ? 'Full diagnostic detail'
        : activity.status === 'complete' ? 'Final response'
          : activity.stream && activity.stream.active ? 'Streaming · ' + Math.round(Number(activity.stream.completionTokens||activity.stream.tokens)||0) + ' completion tok'
            : 'Waiting for response';
    }
  }


  function renderActivityStream() {
    const panel = byId('activityStream');
    const stream = activity.stream;
    if (!panel) return;
    panel.hidden = !stream;
    if (!stream) return;
    const completionTokens = Math.max(0, Number(stream.completionTokens == null ? stream.tokens : stream.completionTokens) || 0);
    const answerTokens = Math.max(0, Number(stream.answerTokens) || 0);
    const target = Math.max(0, Number(stream.targetTokens) || 0);
    const budget = Math.max(0, Number(stream.budgetTokens) || 0);
    const used = budget ? Math.min(1, completionTokens / budget) : 0;
    const percent = Math.round(used * 100);
    const state = stream.status === 'complete' ? 'Stream complete'
      : stream.status === 'interrupted' ? 'Stream interrupted'
        : completionTokens > 0 ? 'Receiving provider output' : 'Waiting for first token';
    byId('activityStreamState').textContent = state;
    byId('activityStreamRate').textContent = Number(stream.rate) > 0 ? (stream.estimated === false ? '' : '~') + Number(stream.rate).toFixed(1) + ' tok/s' : 'rate pending';
    const inputEl=byId('activityStreamInput'),ceilingEl=byId('activityStreamCeiling');
    if(inputEl)inputEl.textContent=Number(stream.inputTokens)>0?'~'+Math.round(Number(stream.inputTokens)).toLocaleString()+' tok':'—';
    if(ceilingEl)ceilingEl.textContent=budget?
      (stream.completionEstimated===false?'':'~')+Math.round(completionTokens).toLocaleString()+' / '+Math.round(budget).toLocaleString()+' tok':'—';
    byId('activityStreamTtft').textContent = Number.isFinite(Number(stream.ttftMs)) ? Math.round(Number(stream.ttftMs)) + ' ms' : 'waiting';
    byId('activityStreamTokens').textContent = (stream.answerEstimated===false?'':'~') + Math.round(answerTokens) +
      (target ? ' / ~' + Math.round(target).toLocaleString() + ' target' : '') + ' tok';
    const bar = byId('activityStreamBar');
    const progress = byId('activityStreamProgress');
    if (bar) bar.style.width = (used * 100).toFixed(1) + '%';
    if (progress) {
      progress.setAttribute('aria-valuenow', String(percent));
      progress.setAttribute('aria-valuetext', (stream.completionEstimated === false ? '' : 'Estimated ') +
        Math.round(completionTokens) + (budget ? ' of ' + Math.round(budget) : '') + ' completion budget tokens');
    }
  }


  function renderActivityPrimary(elapsedMs) {
    const elapsed=byId('activityPrimaryElapsed');
    if(elapsed)elapsed.textContent=elapsedMs<1000?elapsedMs+' ms':(elapsedMs/1000).toFixed(1)+' s';
    const steps=activity.steps||[],done=steps.filter(function(step){return step.status==='done';}).length;
    const stepShell=byId('activityStepProgressShell'),stepText=byId('activityStepProgressText'),stepProgress=byId('activityStepProgress'),stepBar=byId('activityStepBar');
    const showSteps=steps.length>1&&activity.status!=='complete';
    if(stepShell)stepShell.hidden=!showSteps;
    if(showSteps){const pct=Math.round(done/steps.length*100);if(stepText)stepText.textContent=done+' / '+steps.length;if(stepProgress){stepProgress.setAttribute('aria-valuenow',String(pct));stepProgress.setAttribute('aria-valuetext',done+' of '+steps.length+' steps completed');}if(stepBar)stepBar.style.width=pct+'%';}
    const stream=activity.stream,tokenShell=byId('activityTokenProgressShell'),tokensItem=byId('activityPrimaryTokensItem'),rateItem=byId('activityPrimaryRateItem'),speedItem=byId('activityPrimarySpeedItem');
    const completion=stream?Math.max(0,Number(stream.completionTokens==null?stream.tokens:stream.completionTokens)||0):0,budget=stream?Math.max(0,Number(stream.budgetTokens)||0):0;
    if(tokenShell)tokenShell.hidden=!stream;
    if(tokensItem)tokensItem.hidden=!stream;
    if(rateItem)rateItem.hidden=!(stream&&Number(stream.rate)>0);
    if(stream){
      const tokenText=byId('activityPrimaryTokens'),rate=byId('activityPrimaryRate'),
        tokenProgressText=byId('activityTokenProgressText'),used=Math.round(completion).toLocaleString(),
        limit=budget?' / '+Math.round(budget).toLocaleString():'';
      if(tokenText)tokenText.textContent=used+limit;
      if(rate)rate.textContent=Number(stream.rate)>0?Number(stream.rate).toFixed(1):'—';
      if(tokenProgressText)tokenProgressText.textContent=used+limit+' tok';
    }
    const speedEl=byId('activityPrimarySpeed'),speedText=text(activity.speed);
    if(speedItem)speedItem.hidden=!speedText;
    if(speedEl)speedEl.textContent=speedText||'—';
  }

  function renderActivityNow() {
    const shade = byId('activityShade');
    if (!shade || !activity) return;

    const progress = clampProgress(activity.progress);
    const progressPercent = Math.round(progress * 100);
    const elapsedMs = activityElapsedMs();
    const progressLabel = activity.status === 'error'
      ? progressPercent + '% · Failed'
      : activity.status === 'complete'
        ? progressPercent + '% · ' + (activity.progressLabel || 'Complete')
        : progressPercent + '%' + (activity.progressLabel ? ' · ' + activity.progressLabel : activity.indeterminate ? ' · Waiting' : '');

    if (shade.hidden) openModalSurface(shade,{escape:false});
    shade.classList.toggle('blurred', !!activity.shadeBlur);
    shade.setAttribute('aria-busy', activity.status === 'running' ? 'true' : 'false');
    document.body.classList.add('activity-open');
    byId('activityTitle').textContent = activity.title || 'Working';
    byId('activitySubtitle').textContent = activity.subtitle || '';
    byId('activityKind').textContent = (activity.kind || 'LOCAL').toUpperCase();
    byId('activityStage').textContent = activity.stage || 'Working';
    byId('activityMessage').textContent = activity.message || '';

    const percent = byId('activityPercent');
    const bar = byId('activityBar');
    const progressElement = bar && bar.parentElement;
    if (percent) {
      percent.textContent = progressLabel;
      percent.className = 'activity-percent';
    }
    if (progressElement) {
      progressElement.classList.toggle('indeterminate', activity.indeterminate);
      progressElement.classList.toggle('error', activity.status === 'error');
      progressElement.classList.toggle('complete', activity.status === 'complete');
      progressElement.setAttribute('aria-valuenow', String(progressPercent));
      progressElement.setAttribute('aria-valuetext', progressLabel);
    }
    if (bar) bar.style.width = (progress * 100).toFixed(1) + '%';

    const details = Object.assign({}, activity.details || {});
    details.Elapsed = elapsedMs < 1000 ? elapsedMs + ' ms' : (elapsedMs / 1000).toFixed(1) + ' s';
    renderActivityPrimary(elapsedMs);
    renderActivityDetails(details);
    renderActivityTimeline();
    renderActivityStream();
    renderActivityPayloads();
    renderActivityCommands();
  }


  function renderActivity() {
    if (activityFrame) return;
    activityFrame = window.requestAnimationFrame(function () {
      activityFrame = 0;
      renderActivityNow();
    });
  }

  function resetActivitySurface() {
    window.clearTimeout(hideTimer);
    hideTimer = null;
    window.clearInterval(activityTimer);
    activityTimer = null;
    if (activityFrame) {
      window.cancelAnimationFrame(activityFrame);
      activityFrame = 0;
    }

    const shade = byId('activityShade');
    if (shade) {
      shade.classList.remove('blurred');
      closeModalSurface(shade);
      shade.setAttribute('aria-busy', 'false');
    }
    document.body.classList.remove('activity-open');

    const defaults = {
      activityTitle:'Working',
      activitySubtitle:'',
      activityKind:'LOCAL',
      activityStage:'Starting',
      activityMessage:'',
      activityPercent:'0%',
      activityRequest:'—',
      activityResponse:'—',
      activityRequestState:'No request data',
      activityOutputLabel:'Provider output',
      activityOutputState:'Waiting for response',
      activityPrimaryElapsed:'0.0 s',activityPrimarySpeed:'—',activityPrimaryTokens:'—',activityPrimaryRate:'—',
      activityStepProgressText:'0 / 0',activityTokenProgressText:'0 tok'
    };
    Object.keys(defaults).forEach(function (id) {
      const element = byId(id);
      if (element) element.textContent = defaults[id];
    });
    ['activityDetails', 'activityChecklist', 'activityHistory'].forEach(function (id) {
      const element = byId(id);
      if (element) element.innerHTML = '';
    });

    // User-controlled diagnostic disclosure must survive progress/SSE re-renders.
    // Reset it only when the Activity Totem lifecycle itself is reset.
    ['activityPrimarySpeedItem','activityPrimaryTokensItem','activityPrimaryRateItem','activityStepProgressShell','activityTokenProgressShell'].forEach(function(id){const el=byId(id);if(el)el.hidden=true;});
    ['activityStepBar','activityStreamBar'].forEach(function(id){const el=byId(id);if(el)el.style.width='0%';});

    const technical = byId('activityTechnical');
    if (technical) technical.open = false;

    const trace = byId('activityAiTrace');
    if (trace) {
      trace.hidden = true;
      trace.querySelectorAll('details').forEach(function (disclosure) {
        disclosure.open = false;
      });
    }

    const request = byId('activityRequest');
    const response = byId('activityResponse');
    [request, response].forEach(function (element) {
      if (!element) return;
      element.classList.remove('json-response');
      renderedContent.delete(element);
    });
    if (request && request.parentElement) request.parentElement.hidden = true;

    const percent = byId('activityPercent');
    if (percent) percent.className = 'activity-percent';
    const bar = byId('activityBar');
    const progress = bar && bar.parentElement;
    if (bar) bar.style.width = '0%';
    if (progress) {
      progress.classList.remove('indeterminate', 'error', 'complete');
      progress.setAttribute('aria-valuenow', '0');
      progress.setAttribute('aria-valuetext', '0%');
    }
    const streamPanel=byId('activityStream');if(streamPanel)streamPanel.hidden=true;
    const streamBar=byId('activityStreamBar');if(streamBar)streamBar.style.width='0%';
    const retry=byId('activityRetry');if(retry)retry.hidden=true;
  }

    // The Action Totem projects one foreground lifecycle; it is not a background job queue.
  function activityStart(options) {
    resetActivitySurface();
    const input = options || {};
    activity = {
      title:text(input.title || 'Working'),
      subtitle:text(input.subtitle),
      kind:text(input.kind || 'LOCAL'),
      status:'running',
      stage:text(input.stage || 'Starting'),
      message:text(input.message),
      progress:clampProgress(input.progress),
      progressLabel:text(input.progressLabel),
      indeterminate:Boolean(input.indeterminate),
      cancellable:Boolean(input.cancellable),
      cancelling:false,
      details:Object.assign({}, input.details || {}),
      history:[],
      startedAt:Date.now(),
      endedAt:null,
      showAiTrace:Boolean(input.showAiTrace),
      shadeBlur:Boolean(input.shadeBlur),
      request:text(input.request),
      requestIsJson:Boolean(input.requestIsJson),
      response:text(input.response),
      responseIsJson:Boolean(input.responseIsJson),
      steps:normalizeSteps(input.steps),
      stream:input.stream ? Object.assign({}, input.stream) : null,
      onCancel:typeof input.onCancel === 'function' ? input.onCancel : null,
      onRetry:typeof input.onRetry === 'function' ? input.onRetry : null,
      retryLabel:text(input.retryLabel || 'Retry checkpoint'),
      closeLabel:text(input.closeLabel || 'Close details'),
      speed:text(input.speed)
    };
    activity.history.push({time:'0.0 s', stage:activity.stage});
    window.clearInterval(activityTimer);
    activityTimer = window.setInterval(renderActivity, 250);
    renderActivity();
    Log.info('activity.start', {
      title:activity.title,
      kind:activity.kind,
      stage:activity.stage,
      progress:activity.progress
    });
  }

  function activityUpdate(options) {
    if (!activity) return;
    const input = options || {};
    const textFields = ['title', 'subtitle', 'kind', 'message', 'request', 'response', 'closeLabel', 'progressLabel', 'speed'];
    textFields.forEach(function (field) {
      if (input[field] != null) activity[field] = text(input[field]);
    });
    if (input.progress != null) { const next=clampProgress(input.progress); activity.progress=activity.status==='running'?Math.max(clampProgress(activity.progress),next):next; }
    if (input.indeterminate != null) activity.indeterminate = Boolean(input.indeterminate);
    if (input.cancellable != null) activity.cancellable = Boolean(input.cancellable);
    if (input.cancelling != null) activity.cancelling = Boolean(input.cancelling);
    if (input.requestIsJson != null) activity.requestIsJson = Boolean(input.requestIsJson);
    if (input.responseIsJson != null) activity.responseIsJson = Boolean(input.responseIsJson);
    if (input.showAiTrace != null) activity.showAiTrace = Boolean(input.showAiTrace);
    if (input.details) activity.details = Object.assign({}, activity.details, input.details);
    if (input.stream) activity.stream = Object.assign({}, activity.stream || {}, input.stream);
    if (Array.isArray(input.steps)) activity.steps = normalizeSteps(input.steps);

    if (input.stepId) {
      activity.steps.forEach(function (step) {
        if (step.id !== input.stepId) return;
        if (input.stepStatus) step.status = input.stepStatus;
        if (input.stepNote != null) step.note = text(input.stepNote);
      });
    }
    if (input.stage != null && text(input.stage) !== activity.stage) {
      activity.stage = text(input.stage);
      activity.history.push({
        time:(activityElapsedMs() / 1000).toFixed(1) + ' s',
        stage:activity.stage
      });
    }

    renderActivity();
    Log.debug('activity.update', {stage:activity.stage, progress:activity.progress});
  }


  function activityHide() {
    activity = null;
    resetActivitySurface();
  }


  function scheduleActivityHide(holdMs) {
    window.clearTimeout(hideTimer);
    const explicit = Number(holdMs);
    // A caller may ask for a longer window than the default; shorter holds no longer hide a result early.
    const delay = Number.isFinite(explicit) && explicit > ACTIVITY_IDLE_CLOSE_MS ? explicit : ACTIVITY_IDLE_CLOSE_MS;
    hideTimer = window.setTimeout(activityHide, delay);
  }


  function activityInteracted() {
    if (activity && activity.status !== 'running') scheduleActivityHide();
  }


  function activityFinish(options) {
    if (!activity) return;
    const input = options || {};
    activity.status = 'complete';
    if(activity.stream)activity.stream=Object.assign({},activity.stream,{active:false,status:'complete'});
    stopActivityClock();
    if (input.preserveStepStates !== true) {
      activity.steps.forEach(function (step) {
        if (step.status === 'active' || step.status === 'pending') step.status = 'done';
      });
    }
    activityUpdate({
      stage:input.stage || 'Complete',
      message:input.message || 'Action completed.',
      progress:input.progress != null ? input.progress : 1,
      progressLabel:input.progressLabel != null ? input.progressLabel : 'Complete',
      indeterminate:false,
      cancellable:false,
      details:input.details || {},
      response:input.response,
      responseIsJson:input.responseIsJson,
      closeLabel:input.closeLabel
    });
    Log.info('activity.finish', {
      title:activity.title,
      stage:activity.stage,
      elapsedMs:activityElapsedMs()
    });
    scheduleActivityHide(input.holdMs);
  }


  function activityError(error, options) {
    if (!activity) return;
    const input = options || {};
    const message = input.message || (error && error.message) || String(error || 'Action failed.');
    activity.kind = 'ERROR';
    activity.status = 'error';
    if(activity.stream)activity.stream=Object.assign({},activity.stream,{active:false,status:'interrupted'});
    stopActivityClock();
    const activeStep = activity.steps.find(function (step) { return step.status === 'active'; });
    if (activeStep) activeStep.status = 'error';
    activityUpdate({
      stage:input.stage || 'Failed',
      message:message,
      indeterminate:false,
      cancellable:false,
      details:input.details || {},
      response:input.response,
      responseIsJson:input.responseIsJson,
      closeLabel:input.closeLabel
    });
    activity.onRetry=typeof input.onRetry==='function'?input.onRetry:null;
    if(input.retryLabel!=null)activity.retryLabel=text(input.retryLabel);
    Log.warn('activity.error', {
      title:activity.title,
      message:message,
      elapsedMs:activityElapsedMs()
    });
    scheduleActivityHide(input.holdMs);
  }

  function activityCancel() {
    if (!activity) return false;
    if (activity.status !== 'running') {
      activityHide();
      return true;
    }
    if (!hasActiveCancellationTarget() || activity.cancelling) return false;

    let stopped = false;
    try {
      if (activity.onCancel) stopped = activity.onCancel() !== false;
      else if (LF.ActionRunner && typeof LF.ActionRunner.isRunning === 'function' && LF.ActionRunner.isRunning() && typeof LF.ActionRunner.cancel === 'function') stopped = LF.ActionRunner.cancel();
      else if (LF.AI && typeof LF.AI.cancel === 'function') stopped = LF.AI.cancel();
    } catch (error) {
      Log.warn('activity.cancel-failed', {error:error});
    }
    if (stopped) {
      activity.cancelling = true;
      activity.message = 'Stopping…';
      renderActivity();
    }
    return Boolean(stopped);
  }


  function isActivityOpen() {
    return Boolean(activity);
  }

  const activityCancelButton = byId('activityCancel');
  if (activityCancelButton) activityCancelButton.addEventListener('click', activityCancel);
  const activityCloseButton = byId('activityClose');
  if (activityCloseButton) activityCloseButton.addEventListener('click', activityHide);

  const activityLogsButton = byId('activityLogs');
  if (activityLogsButton) {
    activityLogsButton.addEventListener('click', function () {
      activityHide();
      if (LF.State) { LF.State.state.ui.settingsSection='diagnostics'; LF.State.setRoute('settings'); }
    });
  }

  const activityRetryButton=byId('activityRetry');
  if(activityRetryButton)activityRetryButton.addEventListener('click',function(){
    if(!activity||activity.status!=='error'||typeof activity.onRetry!=='function')return;
    const retry=activity.onRetry;activityHide();Promise.resolve().then(retry).catch(function(error){Log.error('activity.retry-failed',{error:error});});
  });

  const activityTotem = document.querySelector('#activityShade .activity-totem');
  if (activityTotem) {
    ['pointerdown','pointermove','keydown','wheel','touchstart','focusin'].forEach(function (type) {
      activityTotem.addEventListener(type, activityInteracted, { passive:true });
    });
  }

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape' || !activity) return;
    if (activity.status === 'running' && !hasActiveCancellationTarget()) return;
    event.preventDefault();
    if (activity.status === 'running') activityCancel();
    else activityHide();
  });

  LF.UI = {
    message:message,
    confirmAction:confirmAction,
    openModal:openModalSurface,
    closeModal:closeModalSurface,
    activityStart:activityStart,
    activityUpdate:activityUpdate,
    activityFinish:activityFinish,
    activityError:activityError,
    activityHide:activityHide,
    activityCancel:activityCancel,
    structuredHtml:structuredObjectHtml,
    isActivityOpen:isActivityOpen
  };
}());
