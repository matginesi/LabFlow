/*
 * Central field-aware redaction for diagnostics and shareable exports.
 * Boundary: Redact by field name, value shape and explicit field opt-in only; never remove
 * scientific values (measurements, materials, process parameters, provenance hashes).
 * Loaded before logger.js so one sanitizer serves logs, diagnostics and export projections.
 */
(function () {
  'use strict';

  const LF = window.LabFlow = window.LabFlow || {};
  const VALUE = '[redacted]';
  const MAX_DEPTH = 10;
  const MAX_KEYS = 300;
  const MAX_ARRAY = 300;

  // Credential-bearing field names: values under these keys never enter a log, diagnostic or shareable export.
  const SECRET_KEY = /api.?key|authorization|password|passwd|secret|access.?token|refresh.?token|bearer|credential|cookie|session.?token|auth.?token|private.?key|client.?secret|nomad.?token/i;
  // Direct personal identifiers. Kept narrow so technical keys (targetAddressSpace, experiment name) stay visible.
  // Word-bounded person keys avoid swallowing lookalike technical keys such as userAgent.
  const PERSONAL_KEY = new RegExp([
    'e-?mails?','phones?','telephones?','mobiles?','contacts?','orcid','ssn','passport','postal','street',
    'full.?name','first.?name','last.?name','surname','display.?name','nickname','initials',
    'researcher','author','username','user.?name','account.?id','user.?id',
    'reviewed.?by','created.?by','modified.?by','updated.?by','deleted.?by','requested.?by','signed.?by','approved.?by',
    '\\busers?\\b','\\boperators?\\b','\\bmembers?\\b','\\bparticipants?\\b','\\battendees?\\b','\\brecipients?\\b','\\bpresenters?\\b',
    '\\bnome\\b','\\bcognome\\b','\\butente\\b','\\bcontatto\\b','\\brecapito\\b'
  ].join('|'), 'i');
  const PERSONAL_LEAF = /^(?:name|e-?mail|phone|telephone|mobile|id)$/i;
  // Non-identifying fields keep their value even inside a personal container (Ready-PV institution is required).
  const NON_PERSONAL_LEAF = /^(?:institution|organisation|organization|role|department|laboratory|site|building|room)$/i;
  // Personal container segments make their identifying leaves (name/email/phone) redactable.
  const PERSONAL_CONTEXT = /contact|responsible|parser|contributor|researcher|author|person|profile|account|owner|created.?by|modified.?by|updated.?by|\busers?\b|\boperators?\b|\bmembers?\b|\bparticipants?\b|\battendees?\b|\brecipients?\b|\bpresenters?\b/i;
  // Free text that can embed personal or identifying content. Only applied when the caller opts in.
  const FREE_TEXT_KEY = /^(?:messages?|content|prompt|prompts|providerResponse|rawProviderResponse|rawResponse|requestBody|responseBody|body|answer|reasoning|notes?|remarks?|comments?|annotations?)$/i;

  const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  const BEARER = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
  const BASIC = /Basic\s+[A-Za-z0-9+/=]{12,}/gi;
  const USERINFO = /([a-z][a-z0-9+.-]*:\/\/)[^/\s@]+@/gi;
  const QUERY_SECRET = /([?&][^=&#\s]*(?:key|token|secret|credential|password|auth)[^=&#\s]*=)[^&#\s]+/gi;
  const KEY_SHAPE = /\b(?:sk|rk|pk)-[A-Za-z0-9_-]{12,}\b|\bsk-or-v1-[A-Za-z0-9]{16,}\b|\bAIza[0-9A-Za-z_-]{30,}\b|\bgh[pousr]_[A-Za-z0-9]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b|\bxox[baprs]-[A-Za-z0-9-]{10,}\b|\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\b/g;

  function bounded(text, maxChars) {
    const cleaned = String(text);
    const limit = Math.max(0, Number(maxChars) || 0);
    if (!limit || cleaned.length <= limit) return cleaned;
    const head = Math.floor(limit * 0.78), tail = Math.floor(limit * 0.18);
    return cleaned.slice(0, head) + '\n… [LabFlow payload bounded · ' + cleaned.length + ' chars total] …\n' + cleaned.slice(-tail);
  }

  // String-level credential and email removal for values whose field name is not informative.
  function redactText(value, options) {
    options = options || {};
    let out = String(value == null ? '' : value);
    out = out.replace(USERINFO, '$1' + VALUE + '@');
    out = out.replace(BEARER, 'Bearer ' + VALUE);
    out = out.replace(BASIC, 'Basic ' + VALUE);
    out = out.replace(QUERY_SECRET, '$1' + VALUE);
    out = out.replace(KEY_SHAPE, VALUE);
    if (options.personal === true) out = out.replace(EMAIL, VALUE);
    return options.maxChars ? bounded(out, options.maxChars) : out;
  }

  function isSecretKey(key) { return SECRET_KEY.test(String(key || '')); }
  function isPersonalKey(key) { return PERSONAL_KEY.test(String(key || '')); }
  function isFreeTextKey(key) { return FREE_TEXT_KEY.test(String(key || '')); }

  // A leaf is personal when its own name identifies a person or when it sits inside a personal container.
  function isPersonalAt(path, key) {
    const leaf = String(key || '');
    if (NON_PERSONAL_LEAF.test(leaf)) return false;
    if (isPersonalKey(leaf)) return true;
    if (!PERSONAL_LEAF.test(leaf)) return false;
    return (path || []).some(function (segment) { return PERSONAL_CONTEXT.test(String(segment || '')); });
  }

  function normalizeError(value, depth, seen, options) {
    const out = { name: value.name || 'Error', message: redactText(value.message || String(value), options), stack: redactText(value.stack || '', options) };
    ['status', 'statusText', 'code', 'providerCode', 'providerMessage', 'requestId', 'requestLogId', 'providerId', 'phase', 'url', 'transport',
      'directBrowser', 'isNetwork', 'isContract', 'cancelled', 'timedOut', 'truncated', 'finishReason', 'timeoutMs', 'elapsedMs', 'usage'].forEach(function (key) {
      if (value[key] != null && value[key] !== '') out[key] = sanitize(value[key], options, depth + 1, seen, []);
    });
    if (value.providerResponse) out.providerResponse = redactText(value.providerResponse, options);
    if (value.rawProviderResponse) {
      const raw = String(value.rawProviderResponse), provider = String(value.providerResponse || '');
      out.rawProviderResponse = raw === provider ? '[same as providerResponse]' : redactText(raw, options);
    }
    if (value.cause) out.cause = sanitize(value.cause, options, depth + 1, seen, []);
    return out;
  }

  function sanitize(value, options, depth, seen, path) {
    options = options || {};
    depth = depth == null ? 0 : depth;
    seen = seen || new WeakSet();
    path = path || [];
    if (depth > (Number(options.maxDepth) || MAX_DEPTH)) return '[max-depth]';
    if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value === 'string') return redactText(value, options);
    if (value instanceof Error) return normalizeError(value, depth, seen, options);
    if (typeof Blob !== 'undefined' && value instanceof Blob && !(typeof File !== 'undefined' && value instanceof File)) {
      return { type: 'Blob', mime: value.type || '', size: value.size };
    }
    if (typeof File !== 'undefined' && value instanceof File) {
      return { type: 'File', name: value.name, mime: value.type || '', size: value.size, lastModified: value.lastModified };
    }
    if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) return { type: 'ArrayBuffer', bytes: value.byteLength };
    if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(value)) return { type: (value.constructor && value.constructor.name) || 'TypedArray', length: value.length, bytes: value.byteLength };
    if (typeof value !== 'object') return String(value);
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    if (Array.isArray(value)) {
      const max = Math.max(1, Number(options.maxArray) || MAX_ARRAY);
      const out = value.slice(0, max).map(function (item, index) { return sanitize(item, options, depth + 1, seen, path.concat(String(index))); });
      if (value.length > max) out.push('[+' + (value.length - max) + ' more]');
      return out;
    }
    const out = {};
    // Metadata tables are stored as {key, value} rows: the row is as sensitive as the key it names.
    const pairLabel = typeof value.key === 'string'
      ? value.key
      : (typeof value.name === 'string' && Object.prototype.hasOwnProperty.call(value, 'value') ? value.name : '');
    const pairPersonal = !!pairLabel && options.personal === true && isPersonalAt([], pairLabel);
    const pairSecret = !!pairLabel && isSecretKey(pairLabel);
    const pairFreeText = !!pairLabel && options.freeText === true && isFreeTextKey(pairLabel);
    Object.keys(value).slice(0, Math.max(1, Number(options.maxKeys) || MAX_KEYS)).forEach(function (key) {
      const childPath = path.concat(String(key));
      if (isSecretKey(key)) { out[key] = VALUE; return; }
      const child = value[key];
      if ((key === 'value' || key === 'val') && (typeof child === 'string' || typeof child === 'number')) {
        if (pairSecret || pairPersonal || (pairFreeText && typeof child === 'string')) { out[key] = VALUE; return; }
      }
      const personalHit = options.personal === true && isPersonalAt(path, key);
      if (personalHit && (typeof child === 'string' || typeof child === 'number')) { out[key] = VALUE; return; }
      if (typeof child === 'string') {
        if (options.freeText === true && (isFreeTextKey(key) || path.some(isFreeTextKey))) { out[key] = VALUE; return; }
        // Free text inside a personal container (for example contact notes) never reaches a log,
        // even in the local buffer that keeps scientific prompts and responses.
        if (isFreeTextKey(key) && path.some(function (segment) { return PERSONAL_CONTEXT.test(String(segment || '')); })) { out[key] = VALUE; return; }
        out[key] = redactText(child, options);
        return;
      }
      out[key] = sanitize(child, options, depth + 1, seen, childPath);
    });
    return out;
  }

  // Copy-safe facade: every caller gets an independent sanitized structure.
  function redact(value, options) { return sanitize(value, options || {}, 0, new WeakSet(), []); }

  const PROFILES = Object.freeze({
    // Logs keep full prompts/responses for local debugging but never credentials or direct identifiers.
    log: Object.freeze({ secrets: true, personal: true, freeText: false }),
    // Diagnostic bundles are shared with support: prompts, responses and free text are removed by default.
    diagnostic: Object.freeze({ secrets: true, personal: true, freeText: true }),
    // Shareable exports keep scientific fields and drop personal contact fields and free-text remarks.
    shareable: Object.freeze({ secrets: true, personal: true, freeText: true }),
    // Backups must remain restorable: credentials are excluded, everything else is preserved.
    backup: Object.freeze({ secrets: true, personal: false, freeText: false })
  });

  function profile(name) { return Object.assign({}, PROFILES[String(name || 'log')] || PROFILES.log); }

  LF.Redact = {
    VALUE: VALUE,
    redactText: redactText,
    isSecretKey: isSecretKey,
    isPersonalKey: isPersonalKey,
    isFreeTextKey: isFreeTextKey,
    sanitize: redact,
    profile: profile,
    profiles: PROFILES
  };
}());
