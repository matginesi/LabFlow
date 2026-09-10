(function () {
  'use strict';
  const LF = window.LabFlow = window.LabFlow || {};
  const C = LF.Core || {};
  const Log = LF.Logger ? LF.Logger.scope('structured') : null;

  /* ------------------------------------------------------------------ *
   * Provider JSON parsing shared by every schema-backed AI Action
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
      const properties=schema.properties||{};
      if(schema.additionalProperties===false)Object.keys(value).forEach(function(key){if(!Object.prototype.hasOwnProperty.call(properties,key))errors.push(path+' contains unexpected field '+key+'.');});
      Object.keys(properties).forEach(function (key) {
        if (!(key in value)) return;
        errors.push.apply(errors, schemaErrors(properties[key], value[key], path + '.' + key));
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

  function normalizeDesignSource(value, inherited) {
    const raw=String(value==null?'':value).trim().toLowerCase();
    if(raw==='experiment'||raw==='evidence'||raw==='source'||raw==='raw')return'experiment';
    if(raw==='model_inference'||raw==='model'||raw==='inference'||raw==='ai')return'model_inference';
    return inherited||'model_inference';
  }
  function designText(value) {
    if(value==null)return'';
    if(Array.isArray(value))return value.map(designText).filter(Boolean).join(', ');
    if(typeof value==='object'){
      if(value.value!=null)return designText(value.value);
      if(value.name!=null)return designText(value.name);
      if(value.text!=null)return designText(value.text);
      return'';
    }
    return String(value).trim();
  }
  function designList(value) {
    if(Array.isArray(value))return value;
    return value==null||value===''?[]:[value];
  }
  function designStringList(value, limit) {
    return designList(value).map(designText).filter(Boolean).slice(0,limit||99);
  }
  function designConfidence(value, fallback) {
    let n=Number(value);
    if(!Number.isFinite(n)&&typeof value==='string'&&/%/.test(value))n=parseFloat(value)/100;
    if(Number.isFinite(n)&&n>1&&n<=100)n/=100;
    return Number.isFinite(n)?Math.max(0,Math.min(1,n)):(fallback==null?0.5:fallback);
  }
  function clip(value, max) { const text=designText(value);return max&&text.length>max?text.slice(0,max):text; }
  function unwrapDesign(value) {
    if(Array.isArray(value))return value.length===1&&value[0]&&typeof value[0]==='object'?value[0]:{devices:value};
    let v=value&&typeof value==='object'?value:{};
    ['result','proposal','design','suggestion','output'].some(function(key){if(v[key]&&typeof v[key]==='object'&&!Array.isArray(v[key])){v=v[key];return true;}return false;});
    return v;
  }
  function normalizeDesignLayer(item, inheritedSource, inheritedConfidence) {
    item=item&&typeof item==='object'?item:{material:item};
    const source=normalizeDesignSource(item.provenance_kind||item.provenanceKind||item.source_kind,inheritedSource),confidence=designConfidence(item.confidence,inheritedConfidence==null?0.5:inheritedConfidence);
    return{
      role:designText(item.role||item.layer||item.function||item.type),
      material:designText(item.material||item.material_name||item.name||item.composition),
      thickness:designText(item.thickness||item.thickness_nm),
      evidence:clip(item.evidence||item.source,500),
      confidence:confidence,
      provenance_kind:source,
      reason:clip(item.reason||item.rationale||'Model suggestion for researcher review.',180)
    };
  }
  function normalizeDesignSolution(item,index) {
    item=item&&typeof item==='object'?item:{name:item};
    const source=normalizeDesignSource(item.provenance_kind||item.provenanceKind||item.source_kind,'model_inference');
    let solutes=designText(item.solutes||item.solute||item.materials||item.precursors||item.precursor),solvents=designText(item.solvents||item.solvent||item.solvent_system||item.solventSystem);
    const recipe=designText(item.chemistry||item.formulation||item.recipe||item.composition_text||item.compositionText);
    if(recipe&&(!solutes||!solvents)){
      const match=recipe.match(/^(.*?)\s+(?:in|using|dissolved in)\s+(.+)$/i);
      if(match){if(!solutes)solutes=designText(match[1]);if(!solvents)solvents=designText(match[2]);}
      else if(!solutes)solutes=recipe;
    }
    const role=designText(item.role||item.type||item.function||item.purpose),explicitName=designText(item.name||item.title||item.solution_name||item.solutionName),fallbackName=role?role.replace(/\b\w/g,function(ch){return ch.toUpperCase();}):((solutes||solvents)?'Solution '+((index||0)+1):'');
    return{
      name:explicitName||fallbackName,
      role:role,
      solutes:solutes,
      solvents:solvents,
      concentration:designText(item.concentration||item.composition||item.ratio||item.composition_or_concentration),
      additives:designText(item.additives||item.additive),
      preparation:designText(item.preparation||item.process||item.notes),
      evidence:clip(item.evidence||item.source,500),
      confidence:designConfidence(item.confidence,0.5),
      provenance_kind:source,
      reason:clip(item.reason||item.rationale||'Model suggestion for researcher review.',180)
    };
  }
    function recoverDesignText(value) {
    const raw=String(value==null?'':value).trim();if(!raw)return null;
    function field(label){const re=new RegExp('(?:^|\\n)\\s*(?:[-*]\\s*)?(?:'+label+')\\s*[:=-]\\s*([^\\n]+)','i'),m=raw.match(re);return m?String(m[1]||'').replace(/[`*_]/g,'').trim():'';}
    let solutes=field('solutes?|precursors?'),solvents=field('solvents?|solvent\\s*system'),role=field('role|solution\\s*role'),name=field('solution\\s*name|formulation\\s*name');
    const chemistry=field('solution|formulation|chemistry|precursor\\s*solution');
    if(chemistry&&(!solutes||!solvents)){const m=chemistry.match(/^(.*?)\\s+(?:in|using|dissolved\\s+in)\\s+(.+)$/i);if(m){if(!solutes)solutes=m[1].trim();if(!solvents)solvents=m[2].trim();}}
    const coating=field('coating|deposition|deposition\\s*method'),annealing=field('annealing|anneal'),atmosphere=field('atmosphere|environment'),notes=field('process\\s*notes|fabrication\\s*notes');
    const recognized=!!(solutes||solvents||coating||annealing||atmosphere||notes);if(!recognized)return null;
    const solution=(solutes||solvents)?[{name:name||role||'Suggested solution',role:role,solutes:solutes,solvents:solvents,provenance_kind:'model_inference',confidence:0.5,reason:'Recovered from a provider response that did not use the requested JSON envelope.'}]:[];
    return normalizeDesignProposal({status:'suggested',summary:'Recovered qualitative Design fields from provider text for researcher review.',solutions:solution,stack:[],process:{coating:coating,annealing:annealing,atmosphere:atmosphere,notes:notes,provenance_kind:'model_inference',confidence:0.5,reason:'Recovered from provider text.'},unknowns:[]});
  }
  function normalizeDesignProposal(value) {
    const v=unwrapDesign(value);
    let solutionSource=v.solutions||v.formulations||v.recipes||v.solution_chemistry||v.solutionChemistry||v.solution_suggestion||v.solutionSuggestion||v.formulation||v.recipe||v.chemistry||v.solution||[];
    if(solutionSource&&typeof solutionSource==='object'&&!Array.isArray(solutionSource)&&Array.isArray(solutionSource.solutions))solutionSource=solutionSource.solutions;
    /* Small/local models often return chemistry as a keyed object or expose
       solutes/solvents directly. Normalize those common shapes before schema
       validation instead of turning a scientifically useful answer into a
       provider-contract failure. */
    if(solutionSource&&typeof solutionSource==='object'&&!Array.isArray(solutionSource)){
      const chemistryKeys=['name','title','role','type','solutes','solute','solvents','solvent','chemistry','formulation','recipe'];
      const isOne=chemistryKeys.some(function(k){return Object.prototype.hasOwnProperty.call(solutionSource,k);});
      if(!isOne)solutionSource=Object.keys(solutionSource).slice(0,4).map(function(key){const value=solutionSource[key];return value&&typeof value==='object'?Object.assign({name:key},value):{name:key,chemistry:value};});
    }
    if(!designList(solutionSource).length&&(v.solutes||v.solute||v.solvents||v.solvent))solutionSource=[{name:v.solution_name||v.solutionName||'Suggested solution',role:v.solution_role||v.solutionRole||'',solutes:v.solutes||v.solute||'',solvents:v.solvents||v.solvent||'',evidence:v.evidence||'',confidence:v.confidence,provenance_kind:v.provenance_kind||v.provenanceKind}];
    let stackSource=v.stack||v.layers||v.device_stack||v.deviceStack||v.stack_suggestion||v.stackSuggestion||v.suggested_stack||v.suggestedStack||v.materials||[];
    if(!designList(stackSource).length){
      const deviceSource=designList(v.devices||v.variants||v.device_variants||v.deviceVariants||v.device_suggestion||v.deviceSuggestion||v.device);
      if(deviceSource.length&&deviceSource[0]&&typeof deviceSource[0]==='object')stackSource=deviceSource[0].stack||deviceSource[0].layers||deviceSource[0].device_stack||deviceSource[0].deviceStack||[];
    }
    const solutions=designList(solutionSource).slice(0,4).map(normalizeDesignSolution).filter(function(x){return x.name;});
    const stack=designList(stackSource).slice(0,12).map(function(layer){return normalizeDesignLayer(layer,'model_inference',0.5);}).filter(function(x){return x.role||x.material;});
    const processSource=v.process||v.fabrication_process||v.fabricationProcess||v.protocol||v.processing||{};
    const po=processSource&&typeof processSource==='object'&&!Array.isArray(processSource)?processSource:{};
    const process={coating:designText(po.coating||po.deposition||po.method),annealing:designText(po.annealing||po.anneal),atmosphere:designText(po.atmosphere||po.environment),notes:designText(po.notes||po.details),evidence:clip(po.evidence||po.source,500),confidence:designConfidence(po.confidence,0.5),provenance_kind:normalizeDesignSource(po.provenance_kind||po.provenanceKind||po.source_kind,'model_inference'),reason:clip(po.reason||po.rationale||'Model suggestion for researcher review.',180)};
    const processUseful=[process.coating,process.annealing,process.atmosphere,process.notes].some(function(x){return !!designText(x);});
    return{
      status:'suggested',
      summary:clip(v.summary||v.assessment||v.description||'Design suggestion ready for validation and review.',260),
      solutions:solutions,
      stack:stack,
      process:process,
      unknowns:designStringList(v.unknowns||v.unresolved||v.missing,10).map(function(x){return clip(x,160);})
    };
  }
  function resultText(value,max){
    if(value==null)return'';
    if(Array.isArray(value))value=value.map(function(x){return resultText(x);}).filter(Boolean).join(', ');
    else if(typeof value==='object')value=value.statement!=null?value.statement:(value.text!=null?value.text:(value.name!=null?value.name:''));
    const out=String(value).trim();return max&&out.length>max?out.slice(0,max):out;
  }
  function resultList(value){return Array.isArray(value)?value:(value==null||value===''?[]:[value]);}
  function resultConfidence(value,fallback){if(typeof value==='string'&&/%/.test(value)){const p=parseFloat(value);if(Number.isFinite(p))return Math.max(0,Math.min(1,p/100));}let n=Number(value);if(Number.isFinite(n)&&n>1&&n<=100)n/=100;return Number.isFinite(n)?Math.max(0,Math.min(1,n)):(fallback==null?0.5:fallback);}
  function unwrapResult(value){let v=value;if(Array.isArray(v)&&v.length===1&&v[0]&&typeof v[0]==='object')v=v[0];if(!v||typeof v!=='object'||Array.isArray(v))return v;['result','output','interpretation','comparison'].some(function(k){if(v[k]&&typeof v[k]==='object'&&!Array.isArray(v[k])){v=v[k];return true;}return false;});return v;}
  function evidenceItem(item){const x=item&&typeof item==='object'&&!Array.isArray(item)?item:{statement:item};return{statement:resultText(x.statement||x.observation||x.finding||x.text,260),evidence:resultList(x.evidence||x.basis||x.sources).map(function(v){return resultText(v,120);}).filter(Boolean).slice(0,5),confidence:resultConfidence(x.confidence,0.6)};}
  function hypothesisItem(item){const x=item&&typeof item==='object'&&!Array.isArray(item)?item:{statement:item};return{statement:resultText(x.statement||x.hypothesis||x.explanation||x.text,260),basis:resultList(x.basis||x.evidence||x.sources).map(function(v){return resultText(v,140);}).filter(Boolean).slice(0,5),confidence:resultConfidence(x.confidence,0.4)};}
  function normalizeResultsInterpretation(value){const v=unwrapResult(value);if(!v||typeof v!=='object'||Array.isArray(v))return value;const recognized=['summary','observations','findings','hypotheses','interpretations','limitations','caveats','next_checks','nextChecks','recommendations','status'];if(!recognized.some(function(k){return Object.prototype.hasOwnProperty.call(v,k);}))return value;const observations=resultList(v.observations||v.findings).map(evidenceItem).filter(function(x){return x.statement;}).slice(0,8),hypotheses=resultList(v.hypotheses||v.interpretations).map(hypothesisItem).filter(function(x){return x.statement;}).slice(0,6),limitations=resultList(v.limitations||v.caveats).map(function(x){return resultText(x,220);}).filter(Boolean).slice(0,8),next=resultList(v.next_checks||v.nextChecks||v.recommendations).map(function(x){return resultText(x,220);}).filter(Boolean).slice(0,8),explicit=String(v.status||'').toLowerCase();return{status:explicit==='limited'||(!observations.length&&!hypotheses.length)?'limited':'interpreted',summary:resultText(v.summary||v.assessment||v.description,700),observations:observations,hypotheses:hypotheses,limitations:limitations,next_checks:next};}
  function normalizeResultsComparison(value){const v=unwrapResult(value);if(!v||typeof v!=='object'||Array.isArray(v))return value;const recognized=['summary','groups','contrasts','differences','observations','hypotheses','limitations','caveats','next_checks','nextChecks','recommendations','status'];if(!recognized.some(function(k){return Object.prototype.hasOwnProperty.call(v,k);}))return value;const contrasts=resultList(v.contrasts||v.differences||v.observations).map(evidenceItem).filter(function(x){return x.statement;}).slice(0,10),hypotheses=resultList(v.hypotheses).map(hypothesisItem).filter(function(x){return x.statement;}).slice(0,6),groups=resultList(v.groups).map(function(x){return resultText(x,100);}).filter(Boolean).slice(0,12),limitations=resultList(v.limitations||v.caveats).map(function(x){return resultText(x,220);}).filter(Boolean).slice(0,8),next=resultList(v.next_checks||v.nextChecks||v.recommendations).map(function(x){return resultText(x,220);}).filter(Boolean).slice(0,8),explicit=String(v.status||'').toLowerCase();return{status:explicit==='insufficient_evidence'||!contrasts.length?'insufficient_evidence':'compared',summary:resultText(v.summary||v.assessment||v.description,600),groups:groups,contrasts:contrasts,hypotheses:hypotheses,limitations:limitations,next_checks:next};}

  function recoverForSchema(schemaId, text) {
    if(schemaId==='design_suggestion')return recoverDesignText(text);
    return null;
  }

  function normalizeForSchema(schemaId, value) {
    if (schemaId === 'design_suggestion') return normalizeDesignProposal(value);
    if (schemaId === 'results_interpretation') return normalizeResultsInterpretation(value);
    if (schemaId === 'results_comparison') return normalizeResultsComparison(value);
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
    validate: validate,
    normalizeForSchema: normalizeForSchema,
    recoverForSchema: recoverForSchema,
    contractError: contractError
  };
  if (Log) Log.info('structured.ready', { parsers: ['balanced-json', 'syntax-normalize'], validator: 'schema-based' });
}());
