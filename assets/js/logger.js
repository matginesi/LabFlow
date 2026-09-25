/*
 * Structured bounded diagnostics with sanitization and console mirroring.
 * Boundary: Remove secrets and unbounded payloads before events enter the buffer.
 */
(function () {
  'use strict';

  const LF = window.LabFlow = window.LabFlow || {};
  if (!LF.Redact) throw new Error('LabFlow.Redact must be loaded before logger.js.');
  const LEVELS = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, off: 99 };
  const MAX_LOG_STRING_CHARS = 60000;
  const LOG_REDACTION = { personal:true, freeText:false, maxChars:MAX_LOG_STRING_CHARS, maxDepth:10, maxKeys:300, maxArray:300 };
  const DEFAULTS = {
    enabled: true,
    level: 'info',
    console: true,
    buffer: true,
    maxEntries: 2500,
    interactions: false,
    network: true
  };
  const buffer = [];
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
        out.maxEntries = Math.min(Number(out.maxEntries) || DEFAULTS.maxEntries, 2500);
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

  function sanitizeString(value, maxChars) {
    // The console summary line must apply the same personal redaction as the buffered payload.
    return LF.Redact.redactText(value, { personal: true, maxChars: Math.max(1200, Number(maxChars) || MAX_LOG_STRING_CHARS) });
  }

  function consoleScalar(value) {
    if (value == null || value === '') return '';
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (typeof value === 'string') return sanitizeString(value, 900).replace(/\s+/g, ' ').trim();
    return '';
  }

  function consoleSummary(data) {
    if (data == null) return '';
    if (typeof data !== 'object') return consoleScalar(data);
    const preferred = ['diagnosticId','action','provider','phase','transport','model','endpoint','url','status','providerCode','code','elapsedMs','durationMs','requestId','requestLogId','providerMessage','targetAddressSpace','keyConfigured','step','route','experimentId','entries','policies','message'];
    const parts = [];
    const used = new Set();
    preferred.forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) return;
      const value = consoleScalar(data[key]);
      if (!value) return;
      used.add(key);
      parts.push(key + '=' + value);
    });
    if (data.error && typeof data.error === 'object') {
      const message = consoleScalar(data.error.message);
      if (message) parts.push('error=' + message);
      const nestedCode = consoleScalar(data.error.providerCode || data.error.code);
      if (nestedCode && !used.has('providerCode') && !used.has('code')) parts.push('code=' + nestedCode);
    }
    if (parts.length < 6) {
      Object.keys(data).forEach(function (key) {
        if (parts.length >= 6 || used.has(key) || key === 'error') return;
        const value = consoleScalar(data[key]);
        if (!value) return;
        used.add(key);
        parts.push(key + '=' + value);
      });
    }
    return parts.join(' · ');
  }

  function sanitize(value) {
    return LF.Redact.sanitize(value, LOG_REDACTION);
  }

  function contextIds() {
    const state = LF.State && LF.State.state ? LF.State.state : null;
    const experiment = state && state.experiment ? state.experiment : null;
    const meta = experiment && experiment.meta ? experiment.meta : {};
    return {
      route: state && state.ui ? state.ui.route || '' : '',
      workspaceId: state && state.workspace ? state.workspace.id || '' : '',
      experimentId: meta.id || '',
      processId: meta.processId || ''
    };
  }

  function write(level, scopeName, event, data) {
    if (!shouldLog(level)) return;
    const context = contextIds();
    const entry = {
      id: sessionId + '_' + (++sequence),
      seq: sequence,
      sessionId: sessionId,
      ts: nowIso(),
      elapsedMs: Math.round((perfNow() - sessionStartedPerf) * 10) / 10,
      level: level.toUpperCase(),
      scope: scopeName || 'app',
      event: event || '',
      route: context.route,
      workspaceId: context.workspaceId,
      experimentId: context.experimentId,
      processId: context.processId,
      data: sanitize(data)
    };
    if (settings.buffer) {
      buffer.push(entry);
      const max = Math.max(100, Number(settings.maxEntries) || DEFAULTS.maxEntries);
      if (buffer.length > max) buffer.splice(0, buffer.length - max);
    }
    if (settings.console && window.console) {
      const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : level === 'info' ? 'info' : 'debug';
      const clock = entry.ts.slice(11, 23);
      const prefix = '[LabFlow][' + clock + '][+' + Math.round(entry.elapsedMs) + 'ms][' + entry.level + '][' + entry.scope + '] ' + entry.event;
      try {
        if (entry.data === undefined) console[method](prefix);
        else {
          const summary = consoleSummary(entry.data), line=summary ? prefix + ' · ' + summary : prefix;
          console[method](line, entry.data);
          if (level === 'error' && entry.data && entry.data.error) {
            const err=entry.data.error, hasDetails=!!(err.stack||err.cause);
            // Keep one scannable console entry per error: stack/cause live in a collapsed child group.
            if(hasDetails&&typeof console.groupCollapsed==='function'){
              console.groupCollapsed('[LabFlow][details] '+entry.event);
              if(err.stack)console[method]('[LabFlow][stack] '+String(err.stack));
              if(err.cause)console[method]('[LabFlow][cause]',err.cause);
              console.groupEnd();
            }else{
              if(err.stack) console[method]('[LabFlow][stack] '+String(err.stack));
              if(err.cause) console[method]('[LabFlow][cause]',err.cause);
            }
          }
        }
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

  function entries() { return buffer.slice(); }
  function clear() {
    buffer.splice(0, buffer.length);
    info('logger', 'buffer.cleared', { maxEntries:settings.maxEntries });
  }

  // Diagnostics leave the browser, so exported bundles drop prompts, responses and free text by default.
  function diagnosticEntries() {
    return buffer.map(function (entry) {
      return LF.Redact.sanitize(entry, { personal:true, freeText:true, maxChars:MAX_LOG_STRING_CHARS });
    });
  }

  function download() {
    const exported = diagnosticEntries();
    const lines = exported.map(function (e) { return JSON.stringify(e); }).join('\n') + '\n';
    const blob = new Blob([lines], { type:'application/x-ndjson;charset=utf-8' });
    const name = 'labflow-debug-' + new Date().toISOString().replace(/[:.]/g, '-') + '.jsonl';
    if (LF.Core && LF.Core.downloadBlob) LF.Core.downloadBlob(blob, name);
    else {
      const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=u; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){URL.revokeObjectURL(u);},1000);
    }
    info('logger', 'buffer.downloaded', { entries:buffer.length, filename:name, redacted:true });
  }

  function environmentSnapshot() {
    return sanitize({
      sessionId:sessionId, startedAt:sessionStartedAt, generatedAt:nowIso(),
      app:{build:String(window.LABFLOW_BUILD||'dev'),route:LF.State&&LF.State.state&&LF.State.state.ui.route||'', experimentId:LF.State&&LF.State.state&&LF.State.state.experiment&&LF.State.state.experiment.meta&&LF.State.state.experiment.meta.id||''},
      browser:{userAgent:navigator.userAgent, language:navigator.language, online:navigator.onLine, storage:'localStorage'},
      page:{protocol:location.protocol, host:location.host, pathname:location.pathname},
      viewport:{width:window.innerWidth, height:window.innerHeight, devicePixelRatio:window.devicePixelRatio||1},
      logging:getSettings()
    });
  }

  function downloadDiagnostics() {
    const payload={format:'labflow-diagnostics', generatedAt:nowIso(), redaction:'privacy-safe',
      environment:LF.Redact.sanitize(environmentSnapshot(),{personal:true,freeText:true}),
      entries:diagnosticEntries()};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
    const name='labflow-diagnostics-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
    if (LF.Core && LF.Core.downloadBlob) LF.Core.downloadBlob(blob,name);
    else { const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u);},1000); }
    info('logger','diagnostics.downloaded',{entries:buffer.length,filename:name,redacted:true});
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


  function installGlobalHooks() {
    if (installed) return;
    installed = true;
    installErrorHooks();
    installInteractionHooks();
    info('logger', 'ready', environmentSnapshot());
  }

  LF.Logger = {
    LEVELS:LEVELS,
    trace:trace, debug:debug, info:info, warn:warn, error:error,
    scope:scope, timer:timer,
    sanitize:sanitize, entries:entries, clear:clear, download:download, downloadDiagnostics:downloadDiagnostics,
    environmentSnapshot:environmentSnapshot,
    getSettings:getSettings, saveSettings:saveSettings,
    installGlobalHooks:installGlobalHooks
  };
}());
