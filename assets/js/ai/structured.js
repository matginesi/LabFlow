(function () {
  'use strict';
  const LF = window.LabFlow = window.LabFlow || {};
  const C = LF.Core || {};
  const Log = LF.Logger ? LF.Logger.scope('structured') : null;

  /* ------------------------------------------------------------------ *
   * JSON transport parsing (ported unchanged from the old assistant.js)
   * ------------------------------------------------------------------ */

  /** Locate complete JSON values without confusing braces inside quoted text. */
  function balancedJsonCandidates(raw) {
    const out = [];
    for (let start = 0; start < raw.length; start++) {
      const opening = raw[start]; if (opening !== '{' && opening !== '[') continue;
      const stack = [], closeFor = { '{': '}', '[': ']' }; let quote = false, escaped = false;
      for (let i = start; i < raw.length; i++) {
        const ch = raw[i];
        if (quote) { if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === '"') quote = false; continue; }
        if (ch === '"') { quote = true; continue; }
        if (ch === '{' || ch === '[') stack.push(closeFor[ch]);
        else if (ch === '}' || ch === ']') {
          if (!stack.length || stack.pop() !== ch) break;
          if (!stack.length) { out.push(raw.slice(start, i + 1)); start = i; break; }
        }
      }
    }
    return out;
  }

  /** Repair JSON presentation syntax only: comments, control chars, trailing commas. */
  function normalizeJsonSyntax(source) {
    let out = '', quote = false, escaped = false, lineComment = false, blockComment = false, changed = false;
    for (let i = 0; i < source.length; i++) {
      const ch = source[i], next = source[i + 1];
      if (lineComment) { if (ch === '\n') { lineComment = false; out += ch; } else changed = true; continue; }
      if (blockComment) { changed = true; if (ch === '*' && next === '/') { blockComment = false; i++; } continue; }
      if (quote) {
        if (escaped) { out += ch; escaped = false; continue; }
        if (ch === '\\') { out += ch; escaped = true; continue; }
        if (ch === '"') { out += ch; quote = false; continue; }
        if (ch === '\n' || ch === '\r' || ch === '\t') { out += ch === '\t' ? '\\t' : '\\n'; changed = true; continue; }
        out += ch; continue;
      }
      if (ch === '"') { quote = true; out += ch; continue; }
      if (ch === '/' && next === '/') { lineComment = true; changed = true; i++; continue; }
      if (ch === '/' && next === '*') { blockComment = true; changed = true; i++; continue; }
      out += ch;
    }
    let withoutTrailing = '', inString = false, isEscaped = false;
    for (let k = 0; k < out.length; k++) {
      const current = out[k];
      if (inString) { withoutTrailing += current; if (isEscaped) isEscaped = false; else if (current === '\\') isEscaped = true; else if (current === '"') inString = false; continue; }
      if (current === '"') { inString = true; withoutTrailing += current; continue; }
      if (current === ',') {
        let look = k + 1; while (look < out.length && /\s/.test(out[look])) look++;
        if (out[look] === '}' || out[look] === ']') { changed = true; continue; }
      }
      withoutTrailing += current;
    }
    return { text: withoutTrailing, changed: changed || withoutTrailing !== out };
  }

  /** Parse provider text into a value plus an audit-friendly account. */
  function parse(text) {
    const raw = String(text || '').replace(/^\uFEFF/, '').trim();
    const candidates = [];
    function add(label, value) {
      value = String(value || '').trim();
      if (value && !candidates.some(function (x) { return x.text === value; })) candidates.push({ label: label, text: value });
    }
    const fence = /```(?:json)?\s*([\s\S]*?)```/gi; let match;
    while ((match = fence.exec(raw))) add('Markdown JSON block', match[1]);
    add('complete response', raw);
    balancedJsonCandidates(raw).forEach(function (value) { add('embedded JSON value', value); });
    const failures = [];
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i], variants = [{ text: candidate.text, repaired: false }];
      const normalized = normalizeJsonSyntax(candidate.text); if (normalized.changed) variants.push({ text: normalized.text, repaired: true });
      for (let j = 0; j < variants.length; j++) {
        try {
          let value = JSON.parse(variants[j].text), doubleEncoded = false;
          if (typeof value === 'string' && /^[\s\r\n]*[\[{]/.test(value)) { value = JSON.parse(value); doubleEncoded = true; }
          return { value: value, strategy: candidate.label + (variants[j].repaired ? ' + safe syntax cleanup' : '') + (doubleEncoded ? ' + decoded JSON string' : ''), repaired: variants[j].repaired || doubleEncoded, raw: raw, diagnosis: '' };
        } catch (err) { failures.push(err && err.message || String(err)); }
      }
    }
    const opens = (raw.match(/[\[{]/g) || []).length, closes = (raw.match(/[\]}]/g) || []).length;
    let diagnosis = 'No complete JSON object or array was found.';
    if (opens > closes) diagnosis = 'The response appears truncated: one or more JSON objects/arrays were not closed.';
    else if (/(^|[^\\])'\s*:|:\s*'/.test(raw)) diagnosis = 'The response uses single quotes. Strict JSON requires double quotes.';
    else if (failures.length) diagnosis = 'JSON syntax error: ' + failures[failures.length - 1];
    if (Log) Log.warn('parse.failed', { chars: raw.length, diagnosis: diagnosis, attempts: candidates.length });
    return { value: null, strategy: 'failed', repaired: false, diagnosis: diagnosis, raw: raw };
  }

  function extractJson(text) { return parse(text).value; }

  /* ------------------------------------------------------------------ *
   * Schema validation (no per-handler code)
   * ------------------------------------------------------------------ */

  function schemaErrors(schema, value, path) {
    path = path || 'result';
    const errors = [];
    if (!schema || typeof schema !== 'object') return [path + ' has no schema definition.'];
    const type = schema.type;
    const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    if (type) {
      const allowed = Array.isArray(type) ? type : [type];
      if (allowed.indexOf(actual) < 0) {
        return [path + ' must be ' + (Array.isArray(type) ? type.join('|') : type) + ' but is ' + actual + '.'];
      }
    }
    if (actual === 'object' && schema.required) {
      schema.required.forEach(function (key) {
        if (!(key in value)) errors.push(path + ' is missing required field ' + key + '.');
      });
    }
    if (Array.isArray(value)) {
      if (Number.isInteger(schema.minItems) && value.length < schema.minItems) errors.push(path + ' requires at least ' + schema.minItems + ' item(s).');
      if (Number.isInteger(schema.maxItems) && value.length > schema.maxItems) errors.push(path + ' exceeds the contract limit of ' + schema.maxItems + ' items.');
      if (schema.items && schema.items.type) value.forEach(function (item, i) { errors.push.apply(errors, schemaErrors(schema.items, item, path + '[' + i + ']')); });
      return errors;
    }
    if (actual === 'object') {
      Object.keys(schema.properties || {}).forEach(function (key) {
        if (!(key in value)) return;
        errors.push.apply(errors, schemaErrors(schema.properties[key], value[key], path + '.' + key));
      });
      return errors;
    }
    if (actual === 'string') {
      if (Array.isArray(schema.enum) && schema.enum.indexOf(value) < 0) errors.push(path + ' must be one of: ' + schema.enum.join(', ') + ' but is ' + JSON.stringify(value) + '.');
      if (Number.isInteger(schema.minLength) && value.length < schema.minLength) errors.push(path + ' is shorter than ' + schema.minLength + ' characters.');
      if (Number.isInteger(schema.maxLength) && value.length > schema.maxLength) errors.push(path + ' exceeds the maximum length of ' + schema.maxLength + ' characters.');
      return errors;
    }
    if (actual === 'number') {
      if (Number.isFinite(schema.minimum) && value < schema.minimum) errors.push(path + ' must be >= ' + schema.minimum + '.');
      if (Number.isFinite(schema.maximum) && value > schema.maximum) errors.push(path + ' must be <= ' + schema.maximum + '.');
      return errors;
    }
    return errors;
  }

  function schemaIdFor(actionId, ActionRegistry) {
    const def = ActionRegistry && ActionRegistry.action ? ActionRegistry.action(actionId) : null;
    if (!def || !Array.isArray(def.steps)) return null;
    for (let i = def.steps.length - 1; i >= 0; i--) {
      const step = def.steps[i];
      if (step.schema) return step.schema;
    }
    return null;
  }

  function normalizeForSchema(schemaId, value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    const v = Object.assign({}, value);
    if (schemaId === 'dataset_corrections') {
      if (typeof v.summary !== 'string') v.summary = '';
      if (!Array.isArray(v.proposals)) v.proposals = [];
      if (!Array.isArray(v.unresolved)) v.unresolved = [];
      v.proposals=v.proposals.map(function(p){if(!p||typeof p!=='object')return p;const x=Object.assign({},p);if(!Object.prototype.hasOwnProperty.call(x,'before'))x.before=null;if(!Object.prototype.hasOwnProperty.call(x,'after'))x.after=null;if(typeof x.requires_human_review!=='boolean')x.requires_human_review=true;return x;});
      return v;
    }
    return value;
  }

  function validate(schemaId, value, opts) {
    opts = opts || {};
    const registry = opts.registry || (LF.ActionRegistry || null);
    const schema = (registry && registry.schema) ? registry.schema(schemaId) : (registry && registry.schemas ? registry.schemas[schemaId] : null);
    if (!schema) return ['SCHEMA_UNKNOWN:' + schemaId];
    return schemaErrors(schema, value);
  }

  function contractError(schemaId, value, opts) {
    const errors = validate(schemaId, value, opts);
    if (!errors.length) return null;
    const diagnosis = (parseDiagnosis(opts)) || '';
    const truncated = /truncat/i.test(diagnosis);
    const error = new Error(truncated ? 'The model stopped before completing the JSON Action response. Nothing was stored.' : 'The provider response does not match the Action contract. Nothing was stored.');
    error.isContract = true;
    error.code = truncated ? 'MODEL_OUTPUT_TRUNCATED' : 'MODEL_OUTPUT_INVALID';
    error.providerResponse = errors.join('\n') + (diagnosis ? '\n\nParser diagnosis\n' + diagnosis : '') + '\n\n' + String(opts && opts.providerResponse || '');
    return error;
  }

  function parseDiagnosis(opts) {
    if (opts && opts.parseResult && opts.parseResult.diagnosis) return opts.parseResult.diagnosis;
    if (opts && opts.text) {
      const r = parse(opts.text);
      return r.diagnosis || '';
    }
    return '';
  }

  LF.StructuredOutput = {
    parse: parse,
    extractJson: extractJson,
    validate: validate,
    normalizeForSchema: normalizeForSchema,
    contractError: contractError,
    schemaErrors: schemaErrors,
    schemaIdFor: schemaIdFor
  };
  if (Log) Log.info('structured.ready', { parsers: ['balanced-json', 'syntax-normalize'], validator: 'schema-based' });
}());