(function () {
  'use strict';

  /**
   * Global feedback service.
   *
   * This is the only module allowed to own toast notifications and the single
   * operation totem. It does not start work, call providers, navigate the app,
   * or maintain experiment state; callers report lifecycle changes through the
   * public `LabFlow.UI` methods exported at the bottom of the file.
   */
  const LF = window.LabFlow = window.LabFlow || {};
  const C = LF.Core;
  const Log = LF.Logger.scope('ui');

  let activity = null;
  let hideTimer = null;
  let activityFrame = 0;
  let activityTimer = null;

  // Timer refreshes must not rebuild disclosures: doing so closes <details>,
  // loses selection and causes flicker. The last rendered payload is remembered
  // per element and replaced only when its content actually changes.
  const renderedContent = new WeakMap();

  /** Return an element by id, or null when the host page omits that surface. */
  function byId(id) {
    return document.getElementById(id);
  }

  /** Convert nullable values to display-safe strings. */
  function text(value) {
    return value == null ? '' : String(value);
  }

  /** Constrain application progress to the inclusive 0..1 range. */
  function clampProgress(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
  }

  /** Format live transport bytes without implying token precision. */
  function formatBytes(value) {
    const bytes = Math.max(0, Number(value) || 0);
    if (bytes < 1024) return Math.round(bytes) + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(bytes < 10240 ? 1 : 0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  /**
   * Show a short, non-blocking notification in the shared live region.
   * @param {string} message Human-readable notification text.
   * @param {string} [type] Optional semantic class such as `success` or `danger`.
   */
  function toast(message, type) {
    Log.debug('toast', {type:type || '', message:text(message).slice(0, 300)});
    const region = byId('toastRegion');
    if (!region) return;

    const element = document.createElement('div');
    element.className = 'toast ' + (type || '');
    element.textContent = text(message);
    region.appendChild(element);
    window.setTimeout(function () { element.remove(); }, 3800);
  }

  /**
   * Ask for explicit confirmation and record only the prompt and decision.
   * @param {string} message Confirmation question.
   * @returns {boolean} The native dialog result.
   */
  function confirmAction(message) {
    const result = window.confirm(message);
    Log.info('confirm', {message:text(message).slice(0, 300), result:result});
    return result;
  }

  /** Return elapsed milliseconds, frozen at the terminal timestamp when set. */
  function activityElapsedMs() {
    if (!activity) return 0;
    return Math.max(0, (activity.endedAt || Date.now()) - activity.startedAt);
  }

  /** Freeze elapsed time and stop periodic repaints on every terminal path. */
  function stopActivityClock() {
    if (!activity) return;
    if (!activity.endedAt) activity.endedAt = Date.now();
    window.clearInterval(activityTimer);
    activityTimer = null;
  }

  /**
   * Normalize string or object operation declarations into one renderable shape.
   * @param {Array<string|Object>} operations Caller-provided checklist items.
   * @returns {Array<{id:string,label:string,status:string,note:string}>}
   */
  function normalizeOperations(operations) {
    return (Array.isArray(operations) ? operations : []).map(function (operation, index) {
      if (typeof operation === 'string') {
        return {id:'operation-' + index, label:operation, status:'pending', note:''};
      }
      operation = operation || {};
      return {
        id:operation.id || ('operation-' + index),
        label:operation.label || operation.title || ('Step ' + (index + 1)),
        status:operation.status || 'pending',
        note:operation.note || ''
      };
    });
  }

  /** Turn an internal snake_case key into a compact display label. */
  function humanKey(key) {
    return text(key).replace(/_/g, ' ').replace(/\b\w/g, function (character) {
      return character.toUpperCase();
    });
  }

  /** Choose the most useful identity field for an item in structured output. */
  function structuredItemTitle(item, index) {
    if (!item || typeof item !== 'object') return 'Item ' + (index + 1);
    return item.title || item.name || item.patch_type || item.field || item.check ||
      item.labflow_path || item.item || ('Item ' + (index + 1));
  }

  /**
   * Render JSON-like data as readable facts, collections and nested disclosures.
   * All values are escaped because provider output and filenames are untrusted.
   * @param {*} object Value to render.
   * @returns {string} Safe HTML fragment.
   */
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

  /** Present final structured provider output as compact, theme-aware JSON. */
  function structuredActivityHtml(raw) {
    let parsed;
    try { parsed=JSON.parse(text(raw)); }
    catch (_) { return '<pre class="streaming-output">'+C.escapeHtml(raw||'—')+'</pre>'; }
    const pretty=JSON.stringify(parsed,null,2);
    const highlighted=C.highlightCode?C.highlightCode(pretty,'json'):C.escapeHtml(pretty);
    return '<pre class="json-highlight compact"><code>'+highlighted+'</code></pre>';
  }

  function compactStreamText(raw){return text(raw).replace(/\r\n/g,'\n').replace(/\n[ \t]*\n+/g,'\n');}

  /** Return a disclosure-safe authorization status, never the header value. */
  function authorizationStatus(headers) {
    return headers && headers.Authorization ? 'Configured · redacted' : 'Not set';
  }

  /**
   * Format the exact sanitized provider payload for inspection.
   * Authorization is redacted again here as defence in depth.
   */
  function requestActivityHtml(raw) {
    let request;
    try {
      request = JSON.parse(text(raw));
    } catch (_) {
      return '<pre>' + C.escapeHtml(raw || '—') + '</pre>';
    }

    const body = request && request.body || {};
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const config = Object.assign({}, body);
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

    const safeRequest = Object.assign({}, request, {
      headers:Object.assign({}, request.headers || {}, {Authorization:authorizationStatus(request.headers)})
    });
    return facts + configHtml + messagesHtml +
      '<details class="structured-raw"><summary>Raw request JSON</summary><div class="markdown">' +
      (C.markdown ? C.markdown('```json\n' + JSON.stringify(safeRequest, null, 2) + '\n```') : '<pre>' + C.escapeHtml(JSON.stringify(safeRequest, null, 2)) + '</pre>') + '</div></details>';
  }

  /** Preserve disclosure state, selection and scroll during timer refreshes. */
  function renderStable(element, key, render) {
    if (!element || renderedContent.get(element) === key) return;
    render();
    renderedContent.set(element, key);
  }

  /** Update the definition list of compact operation facts. */
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

  /** Render checklist and stage history, whose contents may change each update. */
  function renderActivityTimeline() {
    const checklist = byId('activityChecklist');
    if (checklist) {
      checklist.innerHTML = (activity.operations || []).map(function (operation) {
        const iconName = operation.status === 'done' ? 'check' : operation.status === 'error' ? 'triangle-alert' : '';
        const mark = iconName && LF.Icons ? LF.Icons.icon(iconName) : operation.status === 'active' ? '•' : '';
        return '<div class="activity-check-item ' + operation.status + '"><i>' + mark + '</i><strong>' +
          C.escapeHtml(operation.label) + '</strong><span>' + C.escapeHtml(operation.note || '') + '</span></div>';
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

  /** Render request/response disclosures only when their underlying data changes. */
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

  /** Render command labels and enabled states from the operation lifecycle. */
  function renderActivityCommands() {
    const finished = activity.status !== 'running';
    const cancel = byId('activityCancel');
    if (cancel) {
      cancel.hidden = !finished && !activity.cancellable;
      cancel.disabled = !finished && activity.cancelling;
      cancel.textContent = finished ? (activity.closeLabel || 'Close details') : activity.cancelling ? 'Stopping…' : 'Stop';
      cancel.className = 'button compact activity-button ' + (finished ? 'primary' : 'danger');
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
        : activity.status === 'complete' ? 'Complete response'
          : activity.stream && activity.stream.active ? 'Streaming · ' + (activity.stream.events || 0) + ' events'
            : 'Waiting for response';
    }
  }

  /** Render real SSE telemetry separately from application-stage progress. */
  function renderActivityStream() {
    const panel = byId('activityStream');
    const stream = activity.stream;
    if (!panel) return;
    panel.hidden = !stream;
    if (!stream) return;
    const tokens = Math.max(0, Number(stream.tokens) || 0);
    const budget = Math.max(0, Number(stream.budgetTokens) || 0);
    const used = budget ? Math.min(1, tokens / budget) : 0;
    const percent = Math.round(used * 100);
    const state = stream.status === 'complete' ? 'Stream complete'
      : stream.status === 'interrupted' ? 'Stream interrupted'
        : stream.events ? 'Receiving provider output' : 'Waiting for first byte';
    byId('activityStreamState').textContent = state;
    byId('activityStreamRate').textContent = Number(stream.rate) > 0 ? (stream.estimated === false ? '' : '~') + Number(stream.rate).toFixed(1) + ' tok/s' : 'rate pending';
    byId('activityStreamEvents').textContent = String(Math.max(0, Number(stream.events) || 0));
    byId('activityStreamBytes').textContent = formatBytes(stream.bytes);
    byId('activityStreamTtft').textContent = Number.isFinite(Number(stream.ttftMs)) ? Math.round(Number(stream.ttftMs)) + ' ms' : 'waiting';
    byId('activityStreamTokens').textContent = (stream.estimated === false ? '' : '~') + Math.round(tokens) + (budget ? ' / ' + budget : '') + ' tok';
    const bar = byId('activityStreamBar');
    const progress = byId('activityStreamProgress');
    if (bar) bar.style.width = (used * 100).toFixed(1) + '%';
    if (progress) {
      progress.setAttribute('aria-valuenow', String(percent));
      progress.setAttribute('aria-valuetext', (stream.estimated === false ? '' : 'Estimated ') + Math.round(tokens) + (budget ? ' of ' + budget : '') + ' output tokens');
    }
  }

  /** Paint the current activity snapshot. Called at most once per animation frame. */
  function renderActivityNow() {
    const shade = byId('activityShade');
    if (!shade || !activity) return;

    const progress = clampProgress(activity.progress);
    const progressPercent = Math.round(progress * 100);
    const elapsedMs = activityElapsedMs();
    const progressLabel = activity.status === 'error'
      ? progressPercent + '% · Failed'
      : activity.status === 'complete'
        ? '100% · Complete'
        : progressPercent + '%' + (activity.progressLabel ? ' · ' + activity.progressLabel : activity.indeterminate ? ' · Waiting' : '');

    shade.hidden = false;
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
    renderActivityDetails(details);
    renderActivityTimeline();
    renderActivityStream();
    renderActivityPayloads();
    renderActivityCommands();
  }

  /** Coalesce multiple state changes into one animation-frame paint. */
  function renderActivity() {
    if (activityFrame) return;
    activityFrame = window.requestAnimationFrame(function () {
      activityFrame = 0;
      renderActivityNow();
    });
  }

  /**
   * Restore the operation surface to a neutral, closed state.
   *
   * A fresh action must never inherit payloads, disclosure state, progress
   * classes or timers from the previous action. This function deliberately
   * does not read `activity`, so it is safe before a start and after a close.
   */
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
      shade.hidden = true;
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
      activityOutputState:'Waiting for response'
    };
    Object.keys(defaults).forEach(function (id) {
      const element = byId(id);
      if (element) element.textContent = defaults[id];
    });
    ['activityDetails', 'activityChecklist', 'activityHistory'].forEach(function (id) {
      const element = byId(id);
      if (element) element.innerHTML = '';
    });

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

  /**
   * Open the one global operation totem.
   * @param {Object} [options] Initial display state and optional cancel callback.
   */
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
      request:text(input.request),
      requestIsJson:Boolean(input.requestIsJson),
      response:text(input.response),
      responseIsJson:Boolean(input.responseIsJson),
      operations:normalizeOperations(input.operations),
      stream:input.stream ? Object.assign({}, input.stream) : null,
      onCancel:typeof input.onCancel === 'function' ? input.onCancel : null,
      onRetry:typeof input.onRetry === 'function' ? input.onRetry : null,
      retryLabel:text(input.retryLabel || 'Retry checkpoint'),
      closeLabel:text(input.closeLabel || 'Close details')
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

  /**
   * Merge an incremental activity update without replacing unspecified fields.
   * A operation can be updated by passing `operationId`, `operationStatus`, and `operationNote`.
   * @param {Object} [options] Partial activity state.
   */
  function activityUpdate(options) {
    if (!activity) return;
    const input = options || {};
    const textFields = ['title', 'subtitle', 'kind', 'message', 'request', 'response', 'closeLabel', 'progressLabel'];
    textFields.forEach(function (field) {
      if (input[field] != null) activity[field] = text(input[field]);
    });
    if (input.progress != null) activity.progress = clampProgress(input.progress);
    if (input.indeterminate != null) activity.indeterminate = Boolean(input.indeterminate);
    if (input.cancellable != null) activity.cancellable = Boolean(input.cancellable);
    if (input.cancelling != null) activity.cancelling = Boolean(input.cancelling);
    if (input.requestIsJson != null) activity.requestIsJson = Boolean(input.requestIsJson);
    if (input.responseIsJson != null) activity.responseIsJson = Boolean(input.responseIsJson);
    if (input.showAiTrace != null) activity.showAiTrace = Boolean(input.showAiTrace);
    if (input.details) activity.details = Object.assign({}, activity.details, input.details);
    if (input.stream) activity.stream = Object.assign({}, activity.stream || {}, input.stream);
    if (Array.isArray(input.operations)) activity.operations = normalizeOperations(input.operations);

    if (input.operationId) {
      activity.operations.forEach(function (operation) {
        if (operation.id !== input.operationId) return;
        if (input.operationStatus) operation.status = input.operationStatus;
        if (input.operationNote != null) operation.note = text(input.operationNote);
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

  /** Close the totem and release all timers and animation frames. */
  function activityHide() {
    activity = null;
    resetActivitySurface();
  }

  /** Schedule optional auto-dismissal; zero keeps terminal details open. */
  function scheduleActivityHide(holdMs, fallback) {
    window.clearTimeout(hideTimer);
    const delay = Number.isFinite(Number(holdMs)) ? Number(holdMs) : fallback;
    if (delay > 0) hideTimer = window.setTimeout(activityHide, delay);
  }

  /** Mark the current operation complete and freeze its final duration. */
  function activityFinish(options) {
    if (!activity) return;
    const input = options || {};
    activity.status = 'complete';
    if(activity.stream)activity.stream=Object.assign({},activity.stream,{active:false,status:'complete'});
    stopActivityClock();
    activity.operations.forEach(function (operation) {
      if (operation.status === 'active' || operation.status === 'pending') operation.status = 'done';
    });
    activityUpdate({
      stage:input.stage || 'Complete',
      message:input.message || 'Operation completed.',
      progress:1,
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
    scheduleActivityHide(input.holdMs, activity.showAiTrace ? 3000 : 650);
  }

  /** Mark the current operation failed, preserve its detail, and freeze time. */
  function activityError(error, options) {
    if (!activity) return;
    const input = options || {};
    const message = input.message || (error && error.message) || String(error || 'Operation failed.');
    activity.kind = 'ERROR';
    activity.status = 'error';
    if(activity.stream)activity.stream=Object.assign({},activity.stream,{active:false,status:'interrupted'});
    stopActivityClock();
    const activeOperation = activity.operations.find(function (operation) { return operation.status === 'active'; });
    if (activeOperation) activeOperation.status = 'error';
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
    scheduleActivityHide(input.holdMs, 2800);
  }

  /**
   * Cancel a running operation, or close a completed/failed one.
   * @returns {boolean} Whether a close/cancel action was accepted.
   */
  function activityCancel() {
    if (!activity) return false;
    if (activity.status !== 'running') {
      activityHide();
      return true;
    }
    if (!activity.cancellable || activity.cancelling) return false;

    let stopped = false;
    try {
      if (activity.onCancel) stopped = activity.onCancel() !== false;
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

  /** Return whether the global operation surface currently owns the UI. */
  function isActivityOpen() {
    return Boolean(activity);
  }

  const activityCancelButton = byId('activityCancel');
  if (activityCancelButton) activityCancelButton.addEventListener('click', activityCancel);

  const activityLogsButton = byId('activityLogs');
  if (activityLogsButton) {
    activityLogsButton.addEventListener('click', function () {
      activityHide();
      if (LF.State) LF.State.setRoute('logs');
    });
  }

  const activityRetryButton=byId('activityRetry');
  if(activityRetryButton)activityRetryButton.addEventListener('click',function(){
    if(!activity||activity.status!=='error'||typeof activity.onRetry!=='function')return;
    const retry=activity.onRetry;activityHide();Promise.resolve().then(retry).catch(function(error){Log.error('activity.retry-failed',{error:error});});
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape' || !activity) return;
    if (!activity.cancellable && activity.status === 'running') return;
    event.preventDefault();
    activityCancel();
  });

  // Keep this stable public surface small. Callers should not reach into
  // the private activity object or manipulate totem DOM directly.
  LF.UI = {
    toast:toast,
    confirmAction:confirmAction,
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
