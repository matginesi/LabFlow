(function () {
  'use strict';

  const LF = window.LabFlow = window.LabFlow || {};
  const LEVELS = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, off: 99 };
  const DEFAULTS = {
    enabled: true,
    level: 'info',
    console: true,
    buffer: true,
    maxEntries: 1200,
    interactions: false,
    network: true
  };
  const buffer = [];
  const onceKeys = new Set();
  const sessionId = 'session_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  const sessionStartedAt = nowIso();
  const sessionStartedPerf = perfNow();
  let sequence = 0;
  let installed = false;

  function nowIso() { return new Date().toISOString(); }
  function perfNow() { return (window.performance && performance.now) ? performance.now() : Date.now(); }

  function loadSettings() {
    try {
      const raw = localStorage.getItem('labflow.logging.settings');
      const stored = raw ? JSON.parse(raw) : {};
      const out = Object.assign({}, DEFAULTS, stored);
      if (!stored.performanceDefaultsV1) {
        out.level = 'info';
        out.interactions = false;
        out.maxEntries = Math.min(Number(out.maxEntries) || DEFAULTS.maxEntries, 1200);
        out.performanceDefaultsV1 = true;
      }
      return out;
    } catch (_) { return Object.assign({performanceDefaultsV1:true}, DEFAULTS); }
  }

  let settings = loadSettings();

  function saveSettings(next) {
    settings = Object.assign({}, settings, next || {});
    try { localStorage.setItem('labflow.logging.settings', JSON.stringify(settings)); } catch (_) {}
    info('logger', 'settings.updated', settings);
    return Object.assign({}, settings);
  }

  function getSettings() { return Object.assign({}, settings); }
  function shouldLog(level) {
    if (!settings.enabled) return false;
    return (LEVELS[level] || LEVELS.info) >= (LEVELS[settings.level] || LEVELS.debug);
  }

  function isSecretKey(key) {
    return /api.?key|authorization|password|passwd|secret|access.?token|refresh.?token|bearer|credential|cookie|session.?token/i.test(String(key || ''));
  }

  function sanitizeString(value) {
    return String(value)
      .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [redacted]')
      .replace(/([?&](?:api_?key|access_?token|token|key)=)[^&#\s]+/gi, '$1[redacted]');
  }

  function normalizeError(value, depth, seen) {
    const out = {
      name:value.name || 'Error', message:sanitizeString(value.message || String(value)),
      stack:sanitizeString(value.stack || '')
    };
    ['status','statusText','code','providerCode','providerMessage','requestId','requestLogId','isNetwork','isContract','cancelled','timedOut','truncated','finishReason','timeoutMs','elapsedMs','usage'].forEach(function (key) {
      if (value[key] != null && value[key] !== '') out[key] = sanitize(value[key], depth + 1, seen);
    });
    if (value.providerResponse) out.providerResponse = sanitizeString(value.providerResponse);
    if (value.rawProviderResponse) out.rawProviderResponse = sanitizeString(value.rawProviderResponse);
    if (value.cause) out.cause = sanitize(value.cause, depth + 1, seen);
    return out;
  }

  function sanitize(value, depth, seen) {
    depth = depth == null ? 0 : depth;
    seen = seen || new WeakSet();
    if (depth > 10) return '[max-depth]';
    if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value === 'string') return sanitizeString(value);
    if (value instanceof Error) return normalizeError(value, depth, seen);
    if (value instanceof Blob) return { type:'Blob', mime:value.type || '', size:value.size };
    if (value instanceof File) return { type:'File', name:value.name, mime:value.type || '', size:value.size, lastModified:value.lastModified };
    if (value instanceof ArrayBuffer) return { type:'ArrayBuffer', bytes:value.byteLength };
    if (ArrayBuffer.isView(value)) return { type:value.constructor && value.constructor.name || 'TypedArray', length:value.length, bytes:value.byteLength };
    if (typeof value !== 'object') return String(value);
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    if (Array.isArray(value)) {
      const max = 300;
      const arr = value.slice(0, max).map(function (x) { return sanitize(x, depth + 1, seen); });
      if (value.length > max) arr.push('[+' + (value.length - max) + ' more]');
      return arr;
    }
    const out = {};
    Object.keys(value).slice(0, 300).forEach(function (key) {
      if (isSecretKey(key)) out[key] = '[redacted]';
      else out[key] = sanitize(value[key], depth + 1, seen);
    });
    return out;
  }

  function write(level, scopeName, event, data) {
    if (!shouldLog(level)) return;
    const entry = {
      id: sessionId + '_' + (++sequence),
      seq: sequence,
      sessionId: sessionId,
      ts: nowIso(),
      elapsedMs: Math.round((perfNow() - sessionStartedPerf) * 10) / 10,
      level: level.toUpperCase(),
      scope: scopeName || 'app',
      event: event || '',
      route: LF.State && LF.State.state ? LF.State.state.route || '' : '',
      experimentId: LF.State && LF.State.state && LF.State.state.experiment && LF.State.state.experiment.meta ? LF.State.state.experiment.meta.id || '' : '',
      data: sanitize(data)
    };
    if (settings.buffer) {
      buffer.push(entry);
      const max = Math.max(100, Number(settings.maxEntries) || DEFAULTS.maxEntries);
      if (buffer.length > max) buffer.splice(0, buffer.length - max);
    }
    if (settings.console && window.console) {
      const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : level === 'info' ? 'info' : 'debug';
      const prefix = '[LabFlow][' + entry.level + '][' + entry.scope + '] ' + entry.event;
      try {
        if (entry.data === undefined) console[method](prefix);
        else console[method](prefix, entry.data);
      } catch (_) {}
    }
  }

  function trace(scopeName, event, data) { write('trace', scopeName, event, data); }
  function debug(scopeName, event, data) { write('debug', scopeName, event, data); }
  function info(scopeName, event, data) { write('info', scopeName, event, data); }
  function warn(scopeName, event, data) { write('warn', scopeName, event, data); }
  function error(scopeName, event, data) { write('error', scopeName, event, data); }

  function scope(scopeName) {
    return {
      trace: function (event, data) { trace(scopeName, event, data); },
      debug: function (event, data) { debug(scopeName, event, data); },
      info: function (event, data) { info(scopeName, event, data); },
      warn: function (event, data) { warn(scopeName, event, data); },
      error: function (event, data) { error(scopeName, event, data); },
      timer: function (event, data) { return timer(scopeName, event, data); }
    };
  }

  function timer(scopeName, event, startData) {
    const started = perfNow();
    debug(scopeName, event + '.start', startData);
    let ended = false;
    return function (endData, level) {
      if (ended) return;
      ended = true;
      const targetLevel=level || 'debug';
      if(!shouldLog(targetLevel))return;
      const payload = Object.assign({ durationMs: Math.round((perfNow() - started) * 10) / 10 }, sanitize(endData || {}));
      write(targetLevel, scopeName, event + '.end', payload);
    };
  }

  function once(key, level, scopeName, event, data) {
    if (onceKeys.has(key)) return;
    onceKeys.add(key);
    write(level || 'info', scopeName, event, data);
  }

  function entries() { return buffer.slice(); }
  function clear() {
    buffer.splice(0, buffer.length);
    info('logger', 'buffer.cleared', { maxEntries:settings.maxEntries });
  }

  function download() {
    const lines = buffer.map(function (e) { return JSON.stringify(e); }).join('\n') + '\n';
    const blob = new Blob([lines], { type:'application/x-ndjson;charset=utf-8' });
    const name = 'labflow-debug-' + new Date().toISOString().replace(/[:.]/g, '-') + '.jsonl';
    if (LF.Core && LF.Core.downloadBlob) LF.Core.downloadBlob(blob, name);
    else {
      const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=u; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){URL.revokeObjectURL(u);},1000);
    }
    info('logger', 'buffer.downloaded', { entries:buffer.length, filename:name });
  }

  function environmentSnapshot() {
    return sanitize({
      sessionId:sessionId, startedAt:sessionStartedAt, generatedAt:nowIso(),
      app:{route:LF.State&&LF.State.state&&LF.State.state.route||'', experimentId:LF.State&&LF.State.state&&LF.State.state.experiment&&LF.State.state.experiment.meta&&LF.State.state.experiment.meta.id||''},
      browser:{userAgent:navigator.userAgent, language:navigator.language, online:navigator.onLine, storage:'localStorage'},
      page:{protocol:location.protocol, host:location.host, pathname:location.pathname},
      viewport:{width:window.innerWidth, height:window.innerHeight, devicePixelRatio:window.devicePixelRatio||1},
      logging:getSettings()
    });
  }

  function downloadDiagnostics() {
    const payload={format:'labflow-diagnostics', environment:environmentSnapshot(), entries:buffer.slice()};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
    const name='labflow-diagnostics-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
    if (LF.Core && LF.Core.downloadBlob) LF.Core.downloadBlob(blob,name);
    else { const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u);},1000); }
    info('logger','diagnostics.downloaded',{entries:buffer.length,filename:name});
  }

  function installErrorHooks() {
    window.addEventListener('error', function (ev) {
      error('window', 'uncaught.error', { message:ev.message, filename:ev.filename, lineno:ev.lineno, colno:ev.colno, error:ev.error });
    });
    window.addEventListener('unhandledrejection', function (ev) {
      error('window', 'unhandled.rejection', { reason:ev.reason });
    });
  }

  function interactionDescriptor(el) {
    if (!el) return null;
    const out = { tag:el.tagName, id:el.id || undefined };
    ['route','operation','resultTab','resolveFinding','applyPatch'].forEach(function(k){
      if (el.dataset && el.dataset[k] != null) out[k]=el.dataset[k];
    });
    if (el.getAttribute) {
      const type = el.getAttribute('type'); if (type) out.type=type;
      const name = el.getAttribute('name'); if (name) out.name=name;
    }
    const text = (el.textContent || '').trim().replace(/\s+/g,' ');
    if (text && text.length < 100) out.label=text;
    return out;
  }

  function installInteractionHooks() {
    document.addEventListener('click', function (ev) {
      if (!settings.interactions) return;
      const el = ev.target && ev.target.closest ? ev.target.closest('button,a,[data-route],[data-action]') : null;
      if (el) trace('ui.event', 'click', interactionDescriptor(el));
    }, true);
    document.addEventListener('change', function (ev) {
      if (!settings.interactions) return;
      const el = ev.target;
      if (!el || !/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return;
      const d = interactionDescriptor(el) || {};
      if (el.type === 'password') d.value='[redacted]';
      else if (el.type === 'file') d.files=Array.from(el.files||[]).map(function(f){return{name:f.name,size:f.size,type:f.type};});
      else if (el.tagName === 'TEXTAREA' || el.type === 'text' || el.type === 'search') d.valueLength=String(el.value||'').length;
      else d.value=el.value;
      trace('ui.event', 'change', d);
    }, true);
  }

  function installNetworkHook() { /* AI/network calls log themselves directly. */ }

  function installGlobalHooks() {
    if (installed) return;
    installed = true;
    installErrorHooks();
    installInteractionHooks();
    installNetworkHook();
    info('logger', 'ready', environmentSnapshot());
  }

  LF.Logger = {
    LEVELS:LEVELS,
    trace:trace, debug:debug, info:info, warn:warn, error:error,
    scope:scope, timer:timer, once:once,
    sanitize:sanitize, entries:entries, clear:clear, download:download, downloadDiagnostics:downloadDiagnostics,
    environmentSnapshot:environmentSnapshot,
    getSettings:getSettings, saveSettings:saveSettings,
    installGlobalHooks:installGlobalHooks
  };
}());
